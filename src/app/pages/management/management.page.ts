import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { PERMISSION_LABELS, ROLE_LABELS, ROLE_ORDER, permissionsForRole } from '../../core/constants/defaults';
import {
  AppUser,
  GeneratedCredential,
  PermissionKey,
  QuickAddField,
  SelectOption,
  TableColumn,
  UserRole,
} from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { CredentialService } from '../../core/services/credential.service';
import { CsvService } from '../../core/services/csv.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { UserProvisioningService } from '../../core/services/user-provisioning.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { QuickAddDialogComponent, QuickAddResult } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';

interface ManagementConfig {
  resource: string;
  title: string;
  subtitle: string;
  collection: string;
  emptyTitle?: string;
  emptyText: string;
  emptyButton?: string;
  emptyIcon?: string;
  columns: TableColumn[];
  fields: QuickAddField[];
  fixedRole?: UserRole;
  allowCredentials?: boolean;
  allowPromotion?: boolean;
  specialCreate?: 'student' | 'userAccess' | 'staffAccess';
}

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface ManagementVm {
  config: ManagementConfig;
  rows: EntityRecord[];
}

const baseStatusField: QuickAddField = {
  key: 'status',
  label: 'Status',
  type: 'select',
  options: [
    { label: 'Active', value: 'active' },
    { label: 'Pending', value: 'pending' },
    { label: 'Disabled', value: 'disabled' },
  ],
};

const MANAGEMENT_CONFIGS: Record<string, ManagementConfig> = {
  organizations: {
    resource: 'organizations',
    title: 'Organizations',
    subtitle: 'Create and manage customer organizations.',
    collection: 'organizations',
    emptyTitle: 'No organizations found',
    emptyText: 'Create your first organization to start managing madrasas, users, courses, and reports.',
    emptyButton: 'Add Organization',
    emptyIcon: 'business-outline',
    columns: [
      { key: 'name', label: 'Organization' },
      { key: 'code', label: 'Code' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Organization name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea' },
      baseStatusField,
    ],
  },
  madrasas: {
    resource: 'madrasas',
    title: 'Madrasas',
    subtitle: 'Map madrasas to organizations, coordinators, and incharges.',
    collection: 'madrasas',
    emptyText: 'No madrasas found for the selected filter.',
    columns: [
      { key: 'name', label: 'Madrasa' },
      { key: 'code', label: 'Code' },
      { key: 'organizationName', label: 'Organization' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'name', label: 'Madrasa name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'coordinatorIds', label: 'Coordinators', type: 'multiselect', quickAddResource: 'coordinators' },
      { key: 'inchargeIds', label: 'Madrasa incharges', type: 'multiselect', quickAddResource: 'incharges' },
      { key: 'address', label: 'Address', type: 'textarea' },
      baseStatusField,
    ],
  },
  users: {
    resource: 'users',
    title: 'Users',
    subtitle: 'Create controlled access with role and feature permissions.',
    collection: 'users',
    emptyText: 'No users found for the selected filter.',
    columns: [
      { key: 'displayName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', type: 'role' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    allowCredentials: true,
    specialCreate: 'userAccess',
    fields: [
      { key: 'displayName', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      { key: 'role', label: 'Role', type: 'select', required: true },
      { key: 'organizationId', label: 'Organization', type: 'select', quickAddResource: 'organizations' },
      { key: 'madrasaIds', label: 'Assigned madrasas', type: 'multiselect', quickAddResource: 'madrasas' },
      { key: 'classIds', label: 'Assigned classes', type: 'multiselect', quickAddResource: 'classes' },
      { key: 'subjectIds', label: 'Assigned subjects', type: 'multiselect', quickAddResource: 'subjects' },
      { key: 'permissions', label: 'Custom permissions', type: 'multiselect' },
      baseStatusField,
    ],
  },
  coordinators: {
    resource: 'coordinators',
    title: 'Coordinators',
    subtitle: 'Assign coordinators to one or more madrasas.',
    collection: 'users',
    fixedRole: 'coordinator',
    allowCredentials: true,
    specialCreate: 'userAccess',
    emptyText: 'No coordinators found for the selected filter.',
    columns: [
      { key: 'displayName', label: 'Coordinator' },
      { key: 'email', label: 'Email' },
      { key: 'madrasaNames', label: 'Madrasas' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'displayName', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaIds', label: 'Assigned madrasas', type: 'multiselect', required: true, quickAddResource: 'madrasas' },
      { key: 'permissions', label: 'Custom permissions', type: 'multiselect' },
      baseStatusField,
    ],
  },
  incharges: {
    resource: 'incharges',
    title: 'Madrasa Incharges',
    subtitle: 'Map each incharge to the correct madrasa scope.',
    collection: 'users',
    fixedRole: 'madrasaIncharge',
    allowCredentials: true,
    specialCreate: 'userAccess',
    emptyText: 'No madrasa incharges found for the selected filter.',
    columns: [
      { key: 'displayName', label: 'Incharge' },
      { key: 'email', label: 'Email' },
      { key: 'madrasaNames', label: 'Madrasas' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'displayName', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaIds', label: 'Assigned madrasas', type: 'multiselect', required: true, quickAddResource: 'madrasas' },
      { key: 'permissions', label: 'Custom permissions', type: 'multiselect' },
      baseStatusField,
    ],
  },
  staff: {
    resource: 'staff',
    title: 'Staff / Teachers',
    subtitle: 'Assign teachers across madrasas, classes, and subjects.',
    collection: 'staff',
    fixedRole: 'teacher',
    allowCredentials: true,
    specialCreate: 'staffAccess',
    emptyText: 'No staff found for the selected filter.',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'madrasaNames', label: 'Madrasas' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaIds', label: 'Assigned madrasas', type: 'multiselect', required: true, quickAddResource: 'madrasas' },
      { key: 'classIds', label: 'Assigned classes', type: 'multiselect', quickAddResource: 'classes' },
      { key: 'subjectIds', label: 'Assigned subjects', type: 'multiselect', quickAddResource: 'subjects' },
      { key: 'permissions', label: 'Custom permissions', type: 'multiselect' },
      baseStatusField,
    ],
  },
  students: {
    resource: 'students',
    title: 'Students',
    subtitle: 'Create student and parent logins with correct academic mapping.',
    collection: 'students',
    allowCredentials: true,
    allowPromotion: true,
    specialCreate: 'student',
    emptyText: 'No students found for the selected filter.',
    columns: [
      { key: 'name', label: 'Student' },
      { key: 'fatherName', label: 'Father' },
      { key: 'courseName', label: 'Course' },
      { key: 'className', label: 'Class' },
      { key: 'stage', label: 'Stage / Level' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Student name', type: 'text', required: true },
      { key: 'fatherName', label: 'Father name', type: 'text', required: true },
      { key: 'parentName', label: 'Parent display name', type: 'text' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
      { key: 'email', label: 'Student email (optional)', type: 'email' },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', quickAddResource: 'courses' },
      { key: 'classId', label: 'Class', type: 'select', quickAddResource: 'classes' },
      { key: 'stage', label: 'Stage / level', type: 'text' },
      baseStatusField,
    ],
  },
  parents: {
    resource: 'parents',
    title: 'Parents',
    subtitle: 'View parent accounts linked to students.',
    collection: 'parents',
    emptyText: 'No parents found for the selected filter.',
    columns: [
      { key: 'name', label: 'Parent' },
      { key: 'email', label: 'Email' },
      { key: 'studentNames', label: 'Students' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Parent name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'linkedStudentIds', label: 'Linked students', type: 'multiselect', quickAddResource: 'students' },
      { key: 'phone', label: 'Phone', type: 'text' },
      baseStatusField,
    ],
  },
  courses: {
    resource: 'courses',
    title: 'Courses',
    subtitle: 'Customize Maktab, Aalim, Hifz, Muballigh, and custom course structures.',
    collection: 'courses',
    emptyText: 'No courses found for the selected filter.',
    columns: [
      { key: 'name', label: 'Course' },
      { key: 'code', label: 'Code' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', quickAddResource: 'madrasas' },
      { key: 'name', label: 'Course name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'type', label: 'Course type', type: 'select', required: true, options: [
        { label: 'Maktab', value: 'maktab' },
        { label: 'Aalim', value: 'aalim' },
        { label: 'Hifz', value: 'hifz' },
        { label: 'Muballigh', value: 'muballigh' },
        { label: 'Custom', value: 'custom' },
      ] },
      { key: 'stagesText', label: 'Stages (comma separated)', type: 'text' },
      { key: 'levelsText', label: 'Levels (comma separated)', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      baseStatusField,
    ],
  },
  classes: {
    resource: 'classes',
    title: 'Classes',
    subtitle: 'Create classes and map them to courses, stages, and teachers.',
    collection: 'classes',
    emptyText: 'No classes found for the selected filter.',
    columns: [
      { key: 'name', label: 'Class' },
      { key: 'courseName', label: 'Course' },
      { key: 'stageOrLevel', label: 'Stage / Level' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', required: true, quickAddResource: 'courses' },
      { key: 'name', label: 'Class name', type: 'text', required: true },
      { key: 'stageOrLevel', label: 'Stage / level', type: 'text' },
      { key: 'teacherIds', label: 'Assigned teachers', type: 'multiselect', quickAddResource: 'staff' },
      baseStatusField,
    ],
  },
  subjects: {
    resource: 'subjects',
    title: 'Subjects',
    subtitle: 'Manage subjects and teacher mappings.',
    collection: 'subjects',
    emptyText: 'No subjects found for the selected filter.',
    columns: [
      { key: 'name', label: 'Subject' },
      { key: 'code', label: 'Code' },
      { key: 'courseName', label: 'Course' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', quickAddResource: 'courses' },
      { key: 'classId', label: 'Class', type: 'select', quickAddResource: 'classes' },
      { key: 'name', label: 'Subject name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'teacherIds', label: 'Assigned teachers', type: 'multiselect', quickAddResource: 'staff' },
      baseStatusField,
    ],
  },
};

@Component({
  selector: 'app-management',
  templateUrl: './management.page.html',
  styleUrls: ['./management.page.scss'],
  standalone: false,
})
export class ManagementPage {
  readonly credentials: GeneratedCredential[] = [];

  readonly vm$ = this.route.data.pipe(
    map((data) => MANAGEMENT_CONFIGS[String(data['resource'])]),
    switchMap((config) => this.auth.profile$.pipe(
      switchMap((profile) => this.repo.list<EntityRecord>(config.collection, profile).pipe(
        map((rows): PageState<ManagementVm> => ({
          data: {
            config,
            rows: this.decorateRows(this.filterRows(config, rows)),
          },
          loading: false,
        })),
        startWith({ loading: true } as PageState<ManagementVm>),
        catchError((err) => {
          console.error(err);
          return of({
            loading: false,
            error: 'Something went wrong while loading this page. Please try again.',
          } as PageState<ManagementVm>);
        })
      )),
    )),
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly provisioning: UserProvisioningService,
    private readonly credentialService: CredentialService,
    private readonly csv: CsvService,
  ) {}

  trackCredential(_: number, credential: GeneratedCredential): string {
    return credential.email;
  }

  async openCreate(config: ManagementConfig): Promise<void> {
    await this.openEditor(config);
  }

  async edit(config: ManagementConfig, row: EntityRecord): Promise<void> {
    await this.openEditor(config, row);
  }

  async remove(config: ManagementConfig, row: EntityRecord): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete ${config.title}`,
        message: `Delete "${row['name'] ?? row['displayName'] ?? 'this record'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
      },
    }).afterClosed());

    if (confirmed && row.id) {
      await this.repo.remove(config.collection, row.id);
      this.snackBar.open('Record deleted.', 'Close', { duration: 3000 });
    }
  }

  showCredentials(row: EntityRecord): void {
    this.snackBar.open(`Credentials are only shown once when "${row['name'] ?? row['displayName']}" is created.`, 'Close', { duration: 5000 });
  }

  async promote(row: EntityRecord): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    const fields = await this.buildFields({
      ...MANAGEMENT_CONFIGS['students'],
      fields: [
        { key: 'action', label: 'Action', type: 'select', required: true, options: [
          { label: 'Promotion', value: 'promotion' },
          { label: 'Demotion', value: 'demotion' },
        ] },
        { key: 'newCourseId', label: 'New course', type: 'select', quickAddResource: 'courses' },
        { key: 'newStageOrLevel', label: 'New stage / level', type: 'text' },
        { key: 'reason', label: 'Reason / note', type: 'textarea', required: true },
      ],
    }, row);

    const result = await firstValueFrom(this.dialog.open<QuickAddDialogComponent, unknown, QuickAddResult>(QuickAddDialogComponent, {
      data: { title: `Promote / demote ${row['name']}`, fields, submitLabel: 'Save history' },
      width: '620px',
    }).afterClosed());

    if (!result?.value || !row.id) {
      return;
    }

    const value = result.value;
    await this.repo.create('promotionHistory', {
      studentId: row.id,
      organizationId: row.organizationId,
      madrasaId: row.madrasaId,
      previousCourseId: String(row['courseId'] ?? ''),
      previousStageOrLevel: String(row['stage'] ?? row['level'] ?? ''),
      newCourseId: String(value['newCourseId'] ?? ''),
      newStageOrLevel: String(value['newStageOrLevel'] ?? ''),
      reason: String(value['reason'] ?? ''),
      action: value['action'],
      actionDate: new Date().toISOString().slice(0, 10),
      status: 'active',
    }, profile);

    await this.repo.update('students', row.id, {
      courseId: String(value['newCourseId'] || row['courseId'] || ''),
      stage: String(value['newStageOrLevel'] || row['stage'] || ''),
    }, profile);

    this.snackBar.open('Academic history updated.', 'Close', { duration: 4000 });
  }

  downloadCredentials(): void {
    const rows = this.credentials.map((credential) => ({
      label: credential.label,
      role: ROLE_LABELS[credential.role],
      email: credential.email,
      initialPassword: credential.password,
    }));
    this.csv.download('deendesk-generated-credentials.csv', this.csv.toCsv(rows));
  }

  private async openEditor(config: ManagementConfig, initial?: EntityRecord): Promise<void> {
    const fields = await this.buildFields(config, initial);
    const result = await firstValueFrom(this.dialog.open<QuickAddDialogComponent, unknown, QuickAddResult>(QuickAddDialogComponent, {
      data: {
        title: `${initial ? 'Edit' : 'Add'} ${config.title}`,
        fields,
        initialValue: this.initialDialogValue(config, initial),
        submitLabel: initial ? 'Update' : 'Create',
      },
      width: '680px',
    }).afterClosed());

    if (!result) {
      return;
    }

    if (result.quickAddResource) {
      await this.openEditor(MANAGEMENT_CONFIGS[result.quickAddResource]);
      return;
    }

    if (!result.value) {
      return;
    }

    const profile = await firstValueFrom(this.auth.profile$);
    const payload = this.normalizePayload(config, result.value, profile);

    if (initial?.id) {
      await this.repo.update(config.collection, initial.id, payload, profile);
      this.snackBar.open('Record updated.', 'Close', { duration: 3000 });
      return;
    }

    if (config.specialCreate === 'student') {
      await this.createStudent(payload, profile);
    } else if (config.specialCreate === 'userAccess') {
      await this.createUserAccess(payload, config.fixedRole, profile);
    } else if (config.specialCreate === 'staffAccess') {
      await this.createStaffAccess(payload, profile);
    } else {
      await this.repo.create(config.collection, payload, profile);
      this.snackBar.open('Record created.', 'Close', { duration: 3000 });
    }
  }

  private async createUserAccess(payload: EntityRecord, fixedRole: UserRole | undefined, profile: AppUser | null): Promise<void> {
    const role = fixedRole ?? payload['role'] as UserRole;
    const password = String(payload['password'] || this.credentialService.createPassword(String(payload['displayName'] || 'user')));
    const credential = await this.provisioning.createAccess({
      displayName: String(payload['displayName']),
      email: String(payload['email']),
      password,
      role,
      organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
      madrasaIds: this.asStringArray(payload['madrasaIds']),
      classIds: this.asStringArray(payload['classIds']),
      subjectIds: this.asStringArray(payload['subjectIds']),
      permissions: this.asStringArray(payload['permissions']) as PermissionKey[],
      authProvider: 'password',
    }, profile);
    this.credentials.splice(0, this.credentials.length, credential);
    this.snackBar.open('User access created. Save the generated credentials.', 'Close', { duration: 5000 });
  }

  private async createStaffAccess(payload: EntityRecord, profile: AppUser | null): Promise<void> {
    const password = String(payload['password'] || this.credentialService.createPassword(String(payload['name'] || 'staff')));
    const credential = await this.provisioning.createAccess({
      displayName: String(payload['name']),
      email: String(payload['email']),
      password,
      role: 'teacher',
      organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
      madrasaIds: this.asStringArray(payload['madrasaIds']),
      classIds: this.asStringArray(payload['classIds']),
      subjectIds: this.asStringArray(payload['subjectIds']),
      permissions: this.asStringArray(payload['permissions']) as PermissionKey[],
      authProvider: 'password',
    }, profile);

    await this.repo.create('staff', {
      ...payload,
      userId: credential.uid,
      role: 'teacher',
      madrasaId: this.asStringArray(payload['madrasaIds'])[0],
    }, profile);
    this.credentials.splice(0, this.credentials.length, credential);
    this.snackBar.open('Staff access created. Save the generated credentials.', 'Close', { duration: 5000 });
  }

  private async createStudent(payload: EntityRecord, profile: AppUser | null): Promise<void> {
    const madrasaId = String(payload['madrasaId']);
    const generated = this.credentialService.buildStudentCredentials(
      String(payload['name']),
      String(payload['fatherName']),
      madrasaId,
      String(payload['dateOfBirth']),
    );
    const password = generated.password;
    const studentCredential = await this.provisioning.createAccess({
      displayName: String(payload['name']),
      email: String(payload['email'] || generated.studentEmail),
      password,
      role: 'student',
      organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
      madrasaIds: [madrasaId],
      authProvider: payload['email'] ? 'password' : 'generated',
    }, profile);
    const parentCredential = await this.provisioning.createAccess({
      displayName: String(payload['parentName'] || `${payload['fatherName']} Parent`),
      email: generated.parentEmail,
      password,
      role: 'parent',
      organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
      madrasaIds: [madrasaId],
      linkedStudentIds: [],
      authProvider: 'generated',
    }, profile);

    const parentId = await this.repo.create('parents', {
      name: String(payload['parentName'] || `${payload['fatherName']} Parent`),
      email: parentCredential.email,
      generatedEmail: parentCredential.email,
      userId: parentCredential.uid,
      linkedStudentIds: [],
      organizationId: payload.organizationId,
      madrasaId,
      status: 'active',
    }, profile);

    const studentId = await this.repo.create('students', {
      ...payload,
      userId: studentCredential.uid,
      parentId,
      email: studentCredential.email,
      generatedEmail: payload['email'] ? '' : studentCredential.email,
      teacherIds: [],
      status: payload.status ?? 'active',
    }, profile);

    await this.repo.update('parents', parentId, { linkedStudentIds: [studentId] }, profile);
    if (parentCredential.uid) {
      await this.repo.update('users', parentCredential.uid, { linkedStudentIds: [studentId] }, profile);
    }
    if (studentCredential.uid) {
      await this.repo.update('users', studentCredential.uid, { studentIds: [studentId] }, profile);
    }

    this.credentials.splice(0, this.credentials.length, studentCredential, parentCredential);
    this.snackBar.open('Student and parent credentials created. Save them before leaving this page.', 'Close', { duration: 7000 });
  }

  private async buildFields(config: ManagementConfig, initial?: EntityRecord): Promise<QuickAddField[]> {
    const profile = await firstValueFrom(this.auth.profile$);
    const [organizations, madrasas, courses, classes, subjects, users, staff, students] = await Promise.all([
      this.repo.getAllOnce<EntityRecord>('organizations', profile),
      this.repo.getAllOnce<EntityRecord>('madrasas', profile),
      this.repo.getAllOnce<EntityRecord>('courses', profile),
      this.repo.getAllOnce<EntityRecord>('classes', profile),
      this.repo.getAllOnce<EntityRecord>('subjects', profile),
      this.repo.getAllOnce<EntityRecord>('users', profile),
      this.repo.getAllOnce<EntityRecord>('staff', profile),
      this.repo.getAllOnce<EntityRecord>('students', profile),
    ]);
    const options: Record<string, SelectOption[]> = {
      organizationId: this.toOptions(organizations, 'name'),
      madrasaId: this.toOptions(madrasas, 'name'),
      madrasaIds: this.toOptions(madrasas, 'name'),
      coordinatorIds: this.toOptions(users.filter((user) => user['role'] === 'coordinator'), 'displayName'),
      inchargeIds: this.toOptions(users.filter((user) => user['role'] === 'madrasaIncharge'), 'displayName'),
      courseId: this.toOptions(courses, 'name'),
      classId: this.toOptions(classes, 'name'),
      classIds: this.toOptions(classes, 'name'),
      subjectIds: this.toOptions(subjects, 'name'),
      teacherIds: this.toOptions(staff, 'name'),
      linkedStudentIds: this.toOptions(students, 'name'),
      role: ROLE_ORDER
        .filter((role) => profile?.role === 'superAdmin' || role !== 'superAdmin')
        .map((role) => ({ label: ROLE_LABELS[role], value: role })),
      permissions: Object.entries(PERMISSION_LABELS).map(([value, label]) => ({ label, value })),
    };

    return config.fields
      .filter((field) => !initial || field.key !== 'password')
      .map((field) => ({
        ...field,
        required: field.key === 'password' && !initial ? false : field.required,
        options: field.options ?? options[field.key] ?? field.options,
      }));
  }

  private initialDialogValue(config: ManagementConfig, initial?: EntityRecord): Record<string, unknown> {
    if (!initial) {
      return {
        status: 'active',
        role: config.fixedRole ?? '',
        permissions: config.fixedRole ? permissionsForRole(config.fixedRole) : [],
      };
    }

    if (config.resource === 'courses') {
      return {
        ...initial,
        stagesText: Array.isArray(initial['stages']) ? initial['stages'].join(', ') : '',
        levelsText: Array.isArray(initial['levels']) ? initial['levels'].join(', ') : '',
      };
    }

    return initial;
  }

  private normalizePayload(config: ManagementConfig, value: Record<string, unknown>, profile: AppUser | null): EntityRecord {
    const payload: EntityRecord = { ...value } as EntityRecord;

    if (config.fixedRole) {
      payload['role'] = config.fixedRole;
    }

    if (!payload.organizationId && profile?.organizationId) {
      payload.organizationId = profile.organizationId;
    }

    if (!payload.madrasaId && Array.isArray(payload['madrasaIds']) && payload['madrasaIds'].length > 0) {
      payload.madrasaId = String(payload['madrasaIds'][0]);
    }

    if (config.resource === 'courses') {
      payload['stages'] = this.splitList(String(payload['stagesText'] || ''));
      payload['levels'] = this.splitList(String(payload['levelsText'] || ''));
      delete payload['stagesText'];
      delete payload['levelsText'];
    }

    return payload;
  }

  private filterRows(config: ManagementConfig, rows: EntityRecord[]): EntityRecord[] {
    if (!config.fixedRole) {
      return rows;
    }

    return rows.filter((row) => row['role'] === config.fixedRole);
  }

  private decorateRows(rows: EntityRecord[]): EntityRecord[] {
    return rows.map((row) => ({
      ...row,
      stage: row['stage'] || row['level'] || row['stageOrLevel'] || '-',
      organizationName: row['organizationName'] || row['organizationId'] || '-',
      madrasaNames: Array.isArray(row['madrasaIds']) ? row['madrasaIds'].join(', ') : row['madrasaId'] || '-',
      courseName: row['courseName'] || row['courseId'] || '-',
      className: row['className'] || row['classId'] || '-',
      studentNames: Array.isArray(row['linkedStudentIds']) ? row['linkedStudentIds'].join(', ') : '-',
    }));
  }

  private toOptions(rows: EntityRecord[], labelKey: string): SelectOption[] {
    return rows.map((row) => ({
      label: String(row[labelKey] || row['displayName'] || row['email'] || row.id),
      value: String(row.id || row['uid'] || row['email']),
    }));
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : value ? [String(value)] : [];
  }

  private splitList(value: string): string[] {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}
