import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap, Subject, take } from 'rxjs';
import { CollectionReference, DocumentData, collection, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
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
import { NameResolverService } from '../../core/services/name-resolver.service';
import { CredentialService } from '../../core/services/credential.service';
import { CsvService } from '../../core/services/csv.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { UserProvisioningService } from '../../core/services/user-provisioning.service';
import { LoaderService } from '../../core/services/loader.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { QuickAddDialogComponent, QuickAddResult } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { UserDetailsDialogComponent } from '../../shared/components/user-details-dialog/user-details-dialog.component';

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
  allowDetails?: boolean;
  specialCreate?: 'student' | 'userAccess' | 'staffAccess' | 'organization';
}

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface ManagementVm {
  config: ManagementConfig;
  rows: EntityRecord[];
  profile: AppUser | null;
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
      { key: 'email', label: 'Organization Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'primaryOrganizerName', label: 'Primary Organizer Name' },
      { key: 'primaryOrganizerEmail', label: 'Primary Organizer Email' },
      { key: 'temporaryPassword', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Organization name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'primaryOrganizerName', label: 'Primary Organizer Name', type: 'text', required: true },
      { key: 'primaryOrganizerEmail', label: 'Primary Organizer Email', type: 'email', required: true },
      { key: 'organizerPassword', label: 'Organizer Password (optional)', type: 'password' },
      baseStatusField,
    ],
    specialCreate: 'organization',
  },
  madrasas: {
    resource: 'madrasas',
    title: 'Madrasas',
    subtitle: 'Map madrasas to organizations, coordinators, and incharges.',
    collection: 'madrasas',
    emptyTitle: 'No madrasas found',
    emptyText: 'Create your first madrasa to start mapping courses, classes, and assigning students.',
    emptyButton: 'Add Madrasa',
    emptyIcon: 'school-outline',
    columns: [
      { key: 'name', label: 'Madrasa' },
      { key: 'code', label: 'Code' },
      { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' },
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
    emptyTitle: 'No users found',
    emptyText: 'Create users and assign them to specific roles, madrasas, and classes.',
    emptyButton: 'Add User',
    emptyIcon: 'people-outline',
    columns: [
      { key: 'photoURL', label: 'Profile', type: 'avatar' },
      { key: 'displayName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', type: 'role' },
      { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' },
      { key: 'madrasaIds', label: 'Madrasa', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
      { key: 'mustChangePassword', label: 'Must Change Password', type: 'boolean' },
      { key: 'createdAt', label: 'Created At', type: 'date' },
      { key: 'lastLoginAt', label: 'Last Login', type: 'date' },
    ],
    allowCredentials: true,
    allowDetails: true,
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
    emptyTitle: 'No coordinators found',
    emptyText: 'Add coordinators and assign them to oversee one or more madrasas.',
    emptyButton: 'Add Coordinator',
    emptyIcon: 'git-network-outline',
    columns: [
      { key: 'displayName', label: 'Coordinator' },
      { key: 'email', label: 'Email' },
      { key: 'madrasaIds', label: 'Madrasas', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
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
    emptyTitle: 'No incharges found',
    emptyText: 'Add madrasa incharges and assign them to specific madrasas.',
    emptyButton: 'Add Incharge',
    emptyIcon: 'person-circle-outline',
    columns: [
      { key: 'displayName', label: 'Incharge' },
      { key: 'email', label: 'Email' },
      { key: 'madrasaIds', label: 'Madrasas', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
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
    collection: 'users',
    fixedRole: 'teacher',
    allowCredentials: true,
    specialCreate: 'staffAccess',
    emptyTitle: 'No staff found',
    emptyText: 'Add teachers and staff to assign them to classes and subjects.',
    emptyButton: 'Add Staff',
    emptyIcon: 'briefcase-outline',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'madrasaIds', label: 'Madrasas', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
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
    collection: 'users',
    fixedRole: 'student',
    allowCredentials: true,
    allowPromotion: true,
    specialCreate: 'student',
    emptyTitle: 'No students found',
    emptyText: 'Enroll students to assign them to courses, classes, and stages.',
    emptyButton: 'Add Student',
    emptyIcon: 'person-outline',
    columns: [
      { key: 'name', label: 'Student' },
      { key: 'fatherName', label: 'Father' },
      { key: 'courseName', label: 'Course' },
      { key: 'className', label: 'Class' },
      { key: 'stageLevel', label: 'Stage / Level' },
      { key: 'email', label: 'Student Mail' },
      { key: 'parentEmail', label: 'Parent Mail' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
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
    collection: 'users',
    fixedRole: 'parent',
    emptyTitle: 'No parents found',
    emptyText: 'Parents are automatically created when enrolling students, but you can also add them manually.',
    emptyButton: 'Add Parent',
    emptyIcon: 'people-circle-outline',
    columns: [
      { key: 'name', label: 'Parent' },
      { key: 'email', label: 'Email' },
      { key: 'studentNames', label: 'Students' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
    ],
    allowCredentials: true,
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
    emptyTitle: 'No courses found',
    emptyText: 'Create courses like Maktab or Hifz to define your academic structure.',
    emptyButton: 'Add Course',
    emptyIcon: 'library-outline',
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
      {
        key: 'type', label: 'Course type', type: 'select', required: true, options: [
          { label: 'Maktab', value: 'maktab' },
          { label: 'Aalim', value: 'aalim' },
          { label: 'Hifz', value: 'hifz' },
          { label: 'Muballigh', value: 'muballigh' },
          { label: 'Custom', value: 'custom' },
        ]
      },
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
    emptyTitle: 'No classes found',
    emptyText: 'Create classes to organize students within specific courses and stages.',
    emptyButton: 'Add Class',
    emptyIcon: 'easel-outline',
    columns: [
      { key: 'name', label: 'Class' },
      { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' },
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
    emptyTitle: 'No subjects found',
    emptyText: 'Add subjects to assign teachers and build out your curriculum.',
    emptyButton: 'Add Subject',
    emptyIcon: 'book-outline',
    columns: [
      { key: 'name', label: 'Subject' },
      { key: 'code', label: 'Code' },
      { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' },
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
  readonly generatedCredentials: Record<string, GeneratedCredential> = {};

  private readonly config$ = this.route.data.pipe(
    map((data) => MANAGEMENT_CONFIGS[String(data['resource'])]),
  );

  readonly vm$ = this.config$.pipe(
    switchMap((config) => this.auth.profile$.pipe(
      switchMap((profile) => this.rowsForConfig(config, profile).pipe(
        map((rows) => ({ rows, profile })),
      )),
      map(({ rows, profile }): PageState<ManagementVm> => ({
        data: {
          config,
          rows: this.decorateRows(this.filterRows(config, rows)),
          profile,
        },
        loading: false,
      })),
      startWith({ loading: true } as PageState<ManagementVm>),
      catchError((err) => {
        console.error('[Management] Page load failed:', err);
        return of({
          loading: false,
          error: 'Something went wrong while loading this page. Please try again.',
        } as PageState<ManagementVm>);
      })
    )),
  );

  private readonly functions = getFunctions(getDeenDeskFirebaseApp());

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly provisioning: UserProvisioningService,
    private readonly credentialService: CredentialService,
    private readonly csv: CsvService,
    private readonly loader: LoaderService,
    private readonly nameResolver: NameResolverService,
  ) { }

  private rowsForConfig(config: ManagementConfig, profile: AppUser | null): Observable<EntityRecord[]> {
    if (config.allowCredentials && config.collection !== 'users') {
      return this.credentialRowsForCollection(config, profile);
    }

    if (config.collection === 'users') {
      return this.userRowsForResource(config, profile);
    }

    return this.repo.list<EntityRecord>(config.collection, profile);
  }

  private credentialRowsForCollection(config: ManagementConfig, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      this.repo.list<EntityRecord>(config.collection, profile),
      this.repo.list<EntityRecord>('users', profile),
    ]).pipe(
      map(([rows, users]) => rows.map((row) => {
        const user = this.findLinkedUserForRow(config, row, users);
        const creds = this.credentialService.getCredentialStatus(
          user,
          config.collection === 'organizations' ? String(row['organizerPassword'] || '') || undefined : undefined,
        );

        if (user && user['mustChangePassword'] === true && !user['temporaryPasswordForAdminView'] && config.collection === 'organizations' && row['organizerPassword']) {
          this.repo.update('users', String(user['uid'] || user.id), { temporaryPasswordForAdminView: row['organizerPassword'] }, null).catch(console.error);
        }

        return {
          ...row,
          primaryOrganizerName: config.collection === 'organizations' ? (row['primaryOrganizerName'] || user?.['displayName'] || user?.['name'] || '-') : undefined,
          primaryOrganizerEmail: config.collection === 'organizations' ? (row['primaryOrganizerEmail'] || user?.['email'] || '-') : undefined,
          mustChangePassword: user ? user['mustChangePassword'] : null,
          credentialStatus: creds.status,
          temporaryPasswordDisplay: creds.display,
          organizerUser: user,
          linkedUser: user,
        } as EntityRecord;
      })),
    );
  }

  private userRowsForResource(config: ManagementConfig, profile: AppUser | null): Observable<EntityRecord[]> {
    const roles = this.rolesForResource(config.resource);
    const usersObs$ = this.repo.list<EntityRecord>(config.collection, profile, [], roles ? { roles } : undefined).pipe(
      map(rows => {
        if (config.resource === 'students') {
           console.log('[Student Page Access Debug]', {
             currentUserRole: profile?.role,
             organizationId: profile?.organizationId,
             madrasaId: profile?.madrasaId,
             madrasaIds: profile?.madrasaIds,
             requestedRoles: roles,
           });
           if (rows.length === 0) {
             console.warn('[Student Page Empty State Debug]', {
               reason: 'No scoped student users returned',
               organizationId: profile?.organizationId,
               madrasaIds: profile?.madrasaIds,
               requestedRoles: roles,
             });
           }
        } else if (config.resource === 'staff') {
           console.log('[Staff Page Access Debug]', {
             currentUserRole: profile?.role,
             organizationId: profile?.organizationId,
             madrasaId: profile?.madrasaId,
             madrasaIds: profile?.madrasaIds,
             requestedRoles: roles,
           });
           if (rows.length === 0) {
             console.warn('[Staff Page Empty State Debug]', {
               reason: 'No scoped staff/teacher users returned',
               organizationId: profile?.organizationId,
               madrasaIds: profile?.madrasaIds,
               requestedRoles: roles,
             });
           }
        }
        return rows;
      })
    );

    switch (config.resource) {
      case 'students':
        return this.studentRows(usersObs$, profile);
      case 'parents':
        return this.parentRows(usersObs$, profile);
      case 'staff':
        return this.staffRows(usersObs$);
      default:
        return usersObs$.pipe(map((rows) => this.credentialRows(rows)));
    }
  }

  private rolesForResource(resource: string): string[] | undefined {
    switch (resource) {
      case 'coordinators': return ['coordinator'];
      case 'incharges': return ['madrasaIncharge'];
      case 'staff': return ['teacher', 'staff'];
      case 'students': return ['student'];
      case 'parents': return ['parent'];
      default: return undefined;
    }
  }

  private credentialRows(rows: EntityRecord[]): EntityRecord[] {
    return rows.map((row) => {
      const creds = this.credentialService.getCredentialStatus(row);
      return {
        ...row,
        name: row['name'] || row['displayName'] || row['email'] || 'N/A',
        displayName: row['displayName'] || row['name'] || row['email'] || 'N/A',
        credentialStatus: creds.status,
        temporaryPasswordDisplay: creds.display,
      } as EntityRecord;
    });
  }

  private studentRows(usersObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      usersObs$,
      this.repo.list<EntityRecord>('courses', profile).pipe(catchError((e) => {
        console.warn('[Students] Courses load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('classes', profile).pipe(catchError((e) => {
        console.warn('[Students] Classes load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('users', profile, [], { roles: ['parent'] }).pipe(catchError((e) => {
        console.warn('[Students] Parents load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('students', profile).pipe(catchError((e) => {
        console.warn('[Students] Students metadata load failed:', e);
        return of([] as EntityRecord[]);
      })),
    ]).pipe(
      map(([rows, courses, classes, parents, studentsMeta]) => rows.map((row) => {
        const creds = this.credentialService.getCredentialStatus(row);
        const studentUserId = this.recordId(row);
        const studentIds = this.uniqueStrings([
          ...(Array.isArray(row['studentIds']) ? row['studentIds'] : []),
          row.id,
          row['uid'],
          row['userId'],
        ]);

        const studentMeta = studentsMeta.find((s: any) => {
          const metaUserId = String(s['userId'] || '').trim();
          const metaId = String(s.id || '').trim();
          return metaUserId === studentUserId || studentIds.includes(metaId) || studentIds.includes(metaUserId);
        });

        const parentEmail = this.resolveParentEmail(row, studentMeta, parents, studentUserId, studentIds);

        return {
          ...row,
          id: row.id,
          uid: row['uid'],
          name: row['name'] || row['displayName'] || '',
          email: row['email'] || '',
          fatherName: row['fatherName'] || row['parentName'] || row['guardianName'] || '',
          courseName: row['courseName'] || courses.find((c: any) => c.id === row['courseId'])?.['name'] || '',
          className: row['className'] || classes.find((c: any) => c.id === row['classId'])?.['name'] || '',
          stageLevel: row['stageLevel'] || row['stage'] || row['level'] || '',
          parentEmail,
          organizationId: row['organizationId'],
          madrasaId: row['madrasaId'],
          madrasaIds: row['madrasaIds'],
          credentialStatus: creds.status,
          temporaryPasswordDisplay: creds.display,
        } as EntityRecord;
      })),
    );
  }

  private staffRows(usersObs$: Observable<EntityRecord[]>): Observable<EntityRecord[]> {
    return usersObs$.pipe(
      map(rows => rows.map(user => {
        const creds = this.credentialService.getCredentialStatus(user);
        return {
          ...user,
          id: user.id,
          uid: user['uid'],
          name: user['name'] || user['displayName'] || '',
          displayName: user['displayName'] || user['name'] || '',
          email: user['email'] || '',
          role: user['role'],
          phone: user['phone'] || '',
          designation: user['designation'] || '',
          organizationId: user['organizationId'],
          madrasaId: user['madrasaId'],
          madrasaIds: user['madrasaIds'],
          credentialStatus: creds.status,
          temporaryPasswordDisplay: creds.display,
        } as EntityRecord;
      }))
    );
  }

  private parentRows(usersObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      usersObs$,
      this.repo.list<EntityRecord>('parents', profile).pipe(catchError((e) => {
        console.warn('[Parents] Parent metadata load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('students', profile).pipe(catchError((e) => {
        console.warn('[Parents] Student metadata load failed:', e);
        return of([] as EntityRecord[]);
      })),
    ]).pipe(
      switchMap(([parentUsers, parentMetaRows, studentMetaRows]) => {
        if (!parentUsers.length) {
          return of([] as EntityRecord[]);
        }

        const rowStreams = parentUsers.map((row) => this.parentRow(row, parentMetaRows, studentMetaRows));
        return combineLatest(rowStreams);
      }),
    );
  }

  private parentRow(row: EntityRecord, parentMetaRows: EntityRecord[], studentMetaRows: EntityRecord[]): Observable<EntityRecord> {
    const creds = this.credentialService.getCredentialStatus(row);
    const resolvedParentName = row['displayName'] || row['name'] || row['parentName'] || row['email'] || 'N/A';
    const parentMeta = this.findParentMeta(row, parentMetaRows);

    const linkedStudentIds = this.uniqueStrings([
      ...(Array.isArray(row['linkedStudentIds']) ? row['linkedStudentIds'] : []),
      ...(Array.isArray(row['studentIds']) ? row['studentIds'] : []),
      ...(Array.isArray(parentMeta?.['linkedStudentIds']) ? (parentMeta?.['linkedStudentIds'] as unknown[]) : []),
      ...(Array.isArray(parentMeta?.['studentIds']) ? (parentMeta?.['studentIds'] as unknown[]) : []),
    ]);

    const linkedStudentUserIds = this.uniqueStrings([
      ...(Array.isArray(row['linkedStudentUserIds']) ? row['linkedStudentUserIds'] : []),
      ...(Array.isArray(parentMeta?.['linkedStudentUserIds']) ? (parentMeta?.['linkedStudentUserIds'] as unknown[]) : []),
    ]);

    const localNames = this.studentNamesFromMetadata(linkedStudentIds, linkedStudentUserIds, studentMetaRows);
    const unresolvedIds = linkedStudentIds.filter((id) => !studentMetaRows.some((student) => this.studentRecordMatches(student, id)));

    const buildRow = (resolvedNames: string[]): EntityRecord => {
      const studentNames = this.uniqueStrings([...localNames, ...resolvedNames])
        .filter((name) => name !== 'Unknown' && name !== 'N/A' && name !== 'Unnamed')
        .join(', ') || 'N/A';

      return {
        ...row,
        name: resolvedParentName,
        displayName: resolvedParentName,
        linkedStudentIds,
        linkedStudentUserIds,
        studentNames,
        linkedStudentNames: studentNames,
        credentialStatus: creds.status,
        temporaryPasswordDisplay: creds.display,
      } as EntityRecord;
    };

    if (!unresolvedIds.length) {
      return of(buildRow([]));
    }

    return combineLatest(
      unresolvedIds.map((id) => this.nameResolver.resolveName(id, 'student')),
    ).pipe(map((names) => buildRow(names)));
  }

  private findLinkedUserForRow(config: ManagementConfig, row: EntityRecord, users: EntityRecord[]): EntityRecord | undefined {
    if (config.collection === 'organizations') {
      return users.find((u: any) =>
        (u.uid && u.uid === row['primaryOrganizerId']) ||
        (u.id && u.id === row['primaryOrganizerId']) ||
        (u.email && row['primaryOrganizerEmail'] && this.normalizeEmail(u.email) === this.normalizeEmail(row['primaryOrganizerEmail']))
      );
    }

    return users.find((u: any) =>
      (u.uid && u.uid === row['userId']) ||
      (u.id && u.id === row['userId']) ||
      (u.email && row['email'] && this.normalizeEmail(u.email) === this.normalizeEmail(row['email']))
    );
  }

  private findParentMeta(parentUser: EntityRecord, parentMetaRows: EntityRecord[]): EntityRecord | undefined {
    const parentUserId = this.recordId(parentUser);
    const parentEmail = this.normalizeEmail(parentUser['email']);

    return parentMetaRows.find((meta: any) =>
      String(meta['userId'] || '') === parentUserId ||
      String(meta['uid'] || '') === parentUserId ||
      String(meta.id || '') === String(parentUser['parentDocId'] || '') ||
      (!!parentEmail && (
        this.normalizeEmail(meta['email']) === parentEmail ||
        this.normalizeEmail(meta['generatedEmail']) === parentEmail
      ))
    );
  }

  private resolveParentEmail(row: EntityRecord, studentMeta: EntityRecord | undefined, parents: EntityRecord[], studentUserId: string, studentIds: string[]): string {
    let parentEmail = String(
      row['parentEmail'] ||
      row['parentGeneratedEmail'] ||
      studentMeta?.['parentEmail'] ||
      studentMeta?.['parentGeneratedEmail'] ||
      ''
    ).trim();

    if (parentEmail) {
      return parentEmail;
    }

    const parentKeys = this.uniqueStrings([
      row['parentUserId'],
      row['parentUid'],
      row['parentId'],
      row['parentDocId'],
      studentMeta?.['parentUserId'],
      studentMeta?.['parentUid'],
      studentMeta?.['parentId'],
    ]);

    const parentDoc = parents.find((p: any) => {
      const parentIds = this.uniqueStrings([p.uid, p.id, p.userId]);
      const linkedStudentIds = Array.isArray(p['linkedStudentIds']) ? p['linkedStudentIds'].map(String) : [];
      const linkedStudentUserIds = Array.isArray(p['linkedStudentUserIds']) ? p['linkedStudentUserIds'].map(String) : [];

      return (
        parentIds.some((id) => parentKeys.includes(id)) ||
        linkedStudentUserIds.includes(studentUserId) ||
        linkedStudentIds.some((id: string) => studentIds.includes(id))
      );
    });

    parentEmail = String(parentDoc?.['email'] || parentDoc?.['generatedEmail'] || '').trim();

    if (!parentEmail) {
      console.log('[Parent Mail Debug]', {
        studentName: row['name'] || row['displayName'],
        row,
        studentMeta,
        studentUserId,
        studentIds,
        parentKeys,
        parentsCount: parents.length,
      });
    }

    return parentEmail || 'N/A';
  }

  private studentNamesFromMetadata(studentIds: string[], studentUserIds: string[], studentMetaRows: EntityRecord[]): string[] {
    return studentMetaRows
      .filter((student) => {
        const ids = this.studentRecordIds(student);
        return ids.some((id) => studentIds.includes(id) || studentUserIds.includes(id));
      })
      .map((student) => String(student['name'] || student['displayName'] || student['studentName'] || '').trim())
      .filter(Boolean);
  }

  private studentRecordMatches(student: EntityRecord, id: string): boolean {
    return this.studentRecordIds(student).includes(String(id));
  }

  private studentRecordIds(student: EntityRecord): string[] {
    return this.uniqueStrings([
      student.id,
      student['uid'],
      student['userId'],
      ...(Array.isArray(student['studentIds']) ? student['studentIds'] : []),
    ]);
  }

  private recordId(row: EntityRecord): string {
    return String(row['uid'] || row['userId'] || row.id || '').trim();
  }

  private normalizeEmail(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private uniqueStrings(values: unknown[]): string[] {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
  }

  trackCredential(_: number, credential: GeneratedCredential): string {
    return credential.email;
  }

  async openCreate(config: ManagementConfig): Promise<void> {
    await this.openEditor(config);
  }

  async edit(config: ManagementConfig, row: EntityRecord): Promise<void> {
    await this.openEditor(config, row);
  }

  async viewDetails(row: EntityRecord): Promise<void> {
    this.dialog.open(UserDetailsDialogComponent, {
      data: { user: row },
      width: '80vw',
      maxWidth: '80vw',
      height: '85vh',
      panelClass: 'user-details-dialog-panel'
    });
  }

  async remove(config: ManagementConfig, row: EntityRecord): Promise<void> {
    const currentUid = await firstValueFrom(this.auth.profile$).then(u => u?.uid);
    const rowUid = row.id || row['uid'] || row['userId'];

    if (currentUid && rowUid === currentUid) {
      this.snackBar.open('You cannot delete your own profile.', 'Close', { duration: 4000 });
      return;
    }

    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete ${config.title}`,
        message: `Delete "${row['name'] ?? row['displayName'] ?? 'this record'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
      },
    }).afterClosed());

    if (confirmed && row.id) {
      await this.loader.withLoader('Deleting record...', async () => {
        await this.repo.remove(config.collection, row.id!);
      });
      this.snackBar.open('Record deleted.', 'Close', { duration: 3000 });
    }
  }

  async sendPasswordResetEmail(row: EntityRecord): Promise<void> {
    try {
      const email = String(row['email'] || row['generatedEmail'] || '');
      if (!email || email.endsWith('@deendesk.app')) {
        this.snackBar.open('User does not have a real email address to receive reset link.', 'Close', { duration: 4000 });
        return;
      }
      await this.loader.withLoader('Sending password reset link...', async () => {
        await this.auth.sendReset(email);
      });
      this.snackBar.open('Password reset email sent successfully.', 'Close', { duration: 4000 });
    } catch (e) {
      this.snackBar.open('Failed to send reset email.', 'Close', { duration: 4000 });
    }
  }

  async setTemporaryPassword(row: EntityRecord): Promise<void> {
    const fields: QuickAddField[] = [
      { key: 'password', label: 'New temporary password', type: 'password', required: true },
      { key: 'confirmPassword', label: 'Confirm password', type: 'password', required: true },
    ];

    const result = await firstValueFrom(this.dialog.open<QuickAddDialogComponent, unknown, QuickAddResult>(QuickAddDialogComponent, {
      data: { title: `Set Temporary Password`, fields, submitLabel: 'Set Password' },
      width: '560px',
      maxWidth: '92vw',
      panelClass: 'temporary-password-dialog',
    }).afterClosed());

    if (!result?.value) return;

    const password = String(result.value['password']);
    const confirmPassword = String(result.value['confirmPassword']);

    if (password !== confirmPassword) {
      this.snackBar.open('Passwords do not match.', 'Close', { duration: 4000 });
      return;
    }

    if (password.length < 8) {
      this.snackBar.open('Password must be at least 8 characters.', 'Close', { duration: 4000 });
      return;
    }

    try {
      await this.loader.withLoader('Setting temporary password...', async () => {
        const functions = getFunctions(getDeenDeskFirebaseApp());
        const resetFn = httpsCallable(functions, 'resetUserTemporaryPassword');

        const targetUid = row['userId'] || row['primaryOrganizerId'] || row.id;

        if (!targetUid) {
          throw new Error('User ID not found for this record.');
        }

        console.log(`[Cloud Function Call] name=resetUserTemporaryPassword, targetUid=${targetUid}`);
        await resetFn({ targetUid, newTemporaryPassword: password });
      });
      this.snackBar.open('Temporary password updated successfully. User must change it on next login.', 'Close', { duration: 5000 });
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to update temporary password.', 'Close', { duration: 4000 });
    }
  }

  async promote(row: EntityRecord): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    const fields = await this.buildFields({
      ...MANAGEMENT_CONFIGS['students'],
      fields: [
        {
          key: 'action', label: 'Action', type: 'select', required: true, options: [
            { label: 'Promotion', value: 'promotion' },
            { label: 'Demotion', value: 'demotion' },
          ]
        },
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

    await this.loader.withLoader('Updating student details...', async () => {
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

      await this.repo.update('students', row.id!, {
        courseId: String(value['newCourseId'] || row['courseId'] || ''),
        stage: String(value['newStageOrLevel'] || row['stage'] || ''),
      }, profile);
    });

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

    const rawValue = result.value as Record<string, unknown>;
    const initialPassword = rawValue['password'] ? String(rawValue['password']).trim() : undefined;

    const profile = await firstValueFrom(this.auth.profile$);
    const payload = this.normalizePayload(config, rawValue, profile);

    const loaderMessage = initial?.id ? `Updating ${config.resource.slice(0, -1)}...` : `Creating ${config.resource.slice(0, -1)}...`;

    try {
      await this.loader.withLoader(loaderMessage, async () => {
        if (initial?.id) {
          const processedPayload = { ...payload };

          if ('permissions' in payload) processedPayload['permissions'] = this.asStringArray(payload['permissions']);
          if ('madrasaIds' in payload) processedPayload['madrasaIds'] = this.asStringArray(payload['madrasaIds']);
          if ('classIds' in payload) processedPayload['classIds'] = this.asStringArray(payload['classIds']);
          if ('subjectIds' in payload) processedPayload['subjectIds'] = this.asStringArray(payload['subjectIds']);
          if ('linkedStudentIds' in payload) processedPayload['linkedStudentIds'] = this.asStringArray(payload['linkedStudentIds']);

          await this.repo.update(config.collection, initial.id, processedPayload, profile);

          if (initial['userId']) {
            const userPayload: Partial<EntityRecord> = {};
            if ('permissions' in processedPayload) userPayload['permissions'] = processedPayload['permissions'];
            if ('madrasaIds' in processedPayload) userPayload['madrasaIds'] = processedPayload['madrasaIds'];
            if ('classIds' in processedPayload) userPayload['classIds'] = processedPayload['classIds'];
            if ('subjectIds' in processedPayload) userPayload['subjectIds'] = processedPayload['subjectIds'];
            if ('linkedStudentIds' in processedPayload) userPayload['linkedStudentIds'] = processedPayload['linkedStudentIds'];
            if ('organizationId' in processedPayload) userPayload['organizationId'] = processedPayload['organizationId'];

            if (Object.keys(userPayload).length > 0) {
              const finalUserPayload = { ...userPayload };
              if (!this.auth.hasPermission(profile, 'manageUsers')) {
                delete finalUserPayload['organizationId'];
                delete finalUserPayload['role'];
                delete finalUserPayload['email'];
                delete finalUserPayload['uid'];
              }
              if (Object.keys(finalUserPayload).length > 0) {
                await this.repo.update('users', String(initial['userId']), finalUserPayload, profile);
              }
            }
          }

          this.snackBar.open('Record updated.', 'Close', { duration: 3000 });
          return;
        }

        if (config.specialCreate === 'student') {
          await this.createStudent(payload, profile);
        } else if (config.specialCreate === 'userAccess') {
          await this.createUserAccess(payload, config.fixedRole, profile, initialPassword);
        } else if (config.specialCreate === 'staffAccess') {
          await this.createStaffAccess(payload, profile, initialPassword);
        } else if (config.specialCreate === 'organization') {
          await this.createOrganization(payload, profile);
        } else {
          await this.repo.create(config.collection, payload, profile);
          this.snackBar.open('Record created.', 'Close', { duration: 3000 });
        }
      });
    } catch (e) {
      console.error(e);
      this.snackBar.open(`Unable to save ${config.resource.slice(0, -1)}. Please try again.`, 'Close', { duration: 4000 });
    }
  }

  private async createOrganization(payload: EntityRecord, profile: AppUser | null): Promise<void> {
    const orgPayload = { ...payload };
    const email = String(payload['primaryOrganizerEmail']);
    const name = String(payload['primaryOrganizerName']);
    const password = String(payload['organizerPassword'] || this.credentialService.createPassword(name));

    delete orgPayload['organizerName'];
    delete orgPayload['organizerEmail'];
    delete orgPayload['organizerPassword'];
    delete orgPayload['passwordStatus'];
    delete orgPayload['primaryOrganizerName'];
    delete orgPayload['primaryOrganizerEmail'];

    const functions = getFunctions(getDeenDeskFirebaseApp());
    const createOrgFn = httpsCallable<any, { organizationId: string; adminUid: string }>(functions, 'createOrganizationWithAdmin');

    try {
      const result = await createOrgFn({
        organization: orgPayload,
        email,
        password,
      });

      const credential = {
        uid: result.data.adminUid,
        label: name,
        email,
        password,
        role: 'organizationAdmin' as UserRole,
      };

      this.generatedCredentials[result.data.organizationId] = credential;
      this.snackBar.open('Organization created successfully.', 'Close', { duration: 7000 });
    } catch (error: any) {
      console.error('Failed to create organization:', error);
      let message = 'Failed to create organization.';
      if (error?.code === 'functions/already-exists') {
        message = 'The primary email is already in use by another account.';
      } else if (error?.message) {
        message = error.message;
      }
      this.snackBar.open(message, 'Close', { duration: 7000, panelClass: ['error-snackbar'] });
      throw error; // Re-throw to be caught by the modal wrapper
    }
  }

  private async createUserAccess(payload: EntityRecord, fixedRole: UserRole | undefined, profile: AppUser | null, initialPassword?: string): Promise<void> {
    const role = fixedRole ?? payload['role'] as UserRole;
    const password = initialPassword || String(payload['password'] || this.credentialService.createPassword(String(payload['displayName'] || 'user')));

    try {
      const createUserWithTemporaryPassword = httpsCallable<any, any>(this.functions, 'createUserWithTemporaryPassword');
      const result = await createUserWithTemporaryPassword({
        displayName: String(payload['displayName']),
        email: String(payload['email']),
        password,
        role,
        organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
        madrasaId: this.asStringArray(payload['madrasaIds'])[0] || '',
        madrasaIds: this.asStringArray(payload['madrasaIds']),
        classIds: this.asStringArray(payload['classIds']),
        subjectIds: this.asStringArray(payload['subjectIds']),
      });

      const credential = {
        uid: result.data.uid,
        label: String(payload['displayName']),
        email: result.data.email,
        password,
        role
      };

      this.credentials.splice(0, this.credentials.length, credential);
      this.snackBar.open('User access created. Save the generated credentials.', 'Close', { duration: 5000 });
    } catch (error: any) {
      console.error('Failed to create user access:', error);
      let message = 'Failed to create user.';
      if (error?.code === 'functions/already-exists') {
        message = 'The email is already in use by another account.';
      } else if (error?.message) {
        message = error.message;
      }
      this.snackBar.open(message, 'Close', { duration: 7000, panelClass: ['error-snackbar'] });
      throw error;
    }
  }

  private async createStaffAccess(payload: EntityRecord, profile: AppUser | null, initialPassword?: string): Promise<void> {
    const password = initialPassword || String(payload['password'] || this.credentialService.createPassword(String(payload['name'] || 'staff')));

    try {
      const createUserWithTemporaryPassword = httpsCallable<any, any>(this.functions, 'createUserWithTemporaryPassword');
      const result = await createUserWithTemporaryPassword({
        displayName: String(payload['name']),
        email: String(payload['email']),
        password,
        role: 'teacher',
        organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
        madrasaId: this.asStringArray(payload['madrasaIds'])[0] || '',
        madrasaIds: this.asStringArray(payload['madrasaIds']),
        classIds: this.asStringArray(payload['classIds']),
        subjectIds: this.asStringArray(payload['subjectIds']),
      });

      const credential = {
        uid: result.data.uid,
        label: String(payload['name']),
        email: result.data.email,
        password,
        role: 'teacher' as UserRole
      };

      await this.repo.create('staff', {
        ...payload,
        userId: credential.uid,
        role: 'teacher',
        organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
        madrasaId: this.asStringArray(payload['madrasaIds'])[0],
        madrasaIds: this.asStringArray(payload['madrasaIds']),
        classIds: this.asStringArray(payload['classIds']),
        subjectIds: this.asStringArray(payload['subjectIds']),
      }, profile);

      this.credentials.splice(0, this.credentials.length, credential);
      this.snackBar.open('Staff access created. Save the generated credentials.', 'Close', { duration: 5000 });
    } catch (error: any) {
      console.error('Failed to create staff access:', error);
      let message = 'Failed to create staff user.';
      if (error?.code === 'functions/already-exists') {
        message = 'The email is already in use by another account.';
      } else if (error?.message) {
        message = error.message;
      }
      this.snackBar.open(message, 'Close', { duration: 7000, panelClass: ['error-snackbar'] });
      throw error;
    }
  }

  private async createStudent(payload: EntityRecord, profile: AppUser | null): Promise<void> {
    const madrasaId = String(payload['madrasaId']);
    const madrasas = await firstValueFrom(this.repo.list('madrasas', profile).pipe(take(1)));
    const madrasaCode = (madrasas.find((m: any) => m.id === madrasaId)?.['code'] as string) || undefined;

    const generated = this.credentialService.buildStudentCredentials(
      String(payload['name']),
      String(payload['fatherName']),
      madrasaId,
      String(payload['dateOfBirth']),
      madrasaCode
    );
    const password = generated.password;

    let studentCredential: any;
    let parentCredential: any;

    try {
      console.log('[Create Student Payload]', payload);

      const createUserWithTemporaryPassword = httpsCallable<any, any>(this.functions, 'createUserWithTemporaryPassword');

      let studentEmail = String(payload['email'] || generated.studentEmail);
      let isStudentEmailGenerated = !payload['email'];
      let parentEmail = generated.parentEmail;
      const parentDisplayName = String(payload['parentName'] || `${payload['fatherName']} Parent`);
      let studentResult;
      let counter = 0;

      while (!studentResult) {
        try {
          studentResult = await createUserWithTemporaryPassword({
            displayName: String(payload['name']),
            fatherName: payload['fatherName'],
            parentName: payload['parentName'],
            parentEmail,
            parentGeneratedEmail: parentEmail,
            courseId: payload['courseId'],
            classId: payload['classId'],
            classIds: payload['classId'] ? [payload['classId']] : [],
            subjectIds: payload['subjectIds'] || [],
            stage: payload['stage'],
            level: payload['level'],
            email: studentEmail,
            password,
            role: 'student',
            organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
            madrasaId,
            madrasaIds: [madrasaId],
          });
        } catch (error: any) {
          if (error?.code === 'functions/already-exists' && isStudentEmailGenerated) {
            counter++;
            studentEmail = this.credentialService.getShortLoginEmail(generated.base, 'student', counter);
          } else {
            throw error;
          }
        }
      }

      studentCredential = {
        uid: studentResult.data.uid,
        label: String(payload['name']),
        email: studentResult.data.email,
        password,
        role: 'student' as UserRole
      };

      let parentResult;
      let parentCounter = 0;

      while (!parentResult) {
        try {
          parentResult = await createUserWithTemporaryPassword({
            displayName: parentDisplayName,
            email: parentEmail,
            password,
            role: 'parent',
            organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
            madrasaId,
            madrasaIds: [madrasaId],
            linkedStudentIds: [],
          });
        } catch (error: any) {
          if (error?.code === 'functions/already-exists') {
            parentCounter++;
            parentEmail = this.credentialService.getShortLoginEmail(generated.base, 'parent', parentCounter);
          } else {
            throw error;
          }
        }
      }

      parentCredential = {
        uid: parentResult.data.uid,
        label: parentDisplayName,
        email: parentResult.data.email,
        password,
        role: 'parent' as UserRole
      };

    } catch (error: any) {
      console.error('Failed to create student/parent access:', error);
      let message = 'Failed to create student/parent.';
      if (error?.code === 'functions/already-exists') {
        message = 'The email is already in use by another account.';
      } else if (error?.message) {
        message = error.message;
      }
      this.snackBar.open(message, 'Close', { duration: 7000, panelClass: ['error-snackbar'] });
      throw error;
    }

    this.snackBar.open('Student and parent credentials created. Save them before leaving this page.', 'Close', { duration: 7000 });

    try {
      const parentId = await this.repo.create('parents', {
        name: parentCredential.label,
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

        // Parent metadata doc id
        parentId,

        // Parent Auth/User id
        parentUserId: parentCredential.uid,

        // Parent metadata and Auth/User references
        parentName: parentCredential.label,
        parentEmail: parentCredential.email,
        parentGeneratedEmail: parentCredential.email,

        email: studentCredential.email,
        generatedEmail: payload['email'] ? '' : studentCredential.email,
        teacherIds: [],
        status: payload.status ?? 'active',
      }, profile);

      await this.repo.update('parents', parentId, { linkedStudentIds: [studentId] }, profile);
      if (parentCredential.uid) {
        await this.repo.update('users', parentCredential.uid, {
          linkedStudentIds: [studentId],
          linkedStudentUserIds: [studentCredential.uid],
          studentIds: [studentId],
          updatedAt: new Date(),
        }, profile);
      }
      if (studentCredential.uid) {
        await this.repo.update('users', studentCredential.uid, {
          studentIds: [studentId],

          // Parent Auth/User reference
          parentUserId: parentCredential.uid,

          // Parent metadata document reference
          parentDocId: parentId,

          // Keep parentId as Auth/User uid for backward compatibility with table resolver
          parentId: parentCredential.uid,

          parentName: parentCredential.label,
          parentEmail: parentCredential.email,
          parentGeneratedEmail: parentCredential.email,

          updatedAt: new Date(),
        }, profile);
      }

    } catch (metadataError: any) {
      this.credentials.splice(0, this.credentials.length, studentCredential, parentCredential);
      console.warn('[Students] Created successfully but metadata/reload failed:', metadataError);
      this.snackBar.open('Student created, but table refresh failed. Please refresh the page.', 'Close', { duration: 7000 });
    }

    this.credentials.splice(0, this.credentials.length, studentCredential, parentCredential);
  }

  private async buildFields(config: ManagementConfig, initial?: EntityRecord): Promise<QuickAddField[]> {
    const profile = await firstValueFrom(this.auth.profile$);
    const options: Record<string, SelectOption[]> = {
      role: ROLE_ORDER
        .filter((role) => profile?.role === 'superAdmin' || role !== 'superAdmin')
        .map((role) => ({ label: ROLE_LABELS[role], value: role })),
      permissions: Object.entries(PERMISSION_LABELS).map(([value, label]) => ({ label, value })),
    };

    const hasField = (key: string) => config.fields.some(f => f.key === key);

    if (hasField('organizationId')) {
      const orgs = await this.repo.getAllOnce<EntityRecord>('organizations', profile);
      options['organizationId'] = this.toOptions(orgs, 'name');
    }

    if (hasField('madrasaId') || hasField('madrasaIds')) {
      const mads = await this.repo.getAllOnce<EntityRecord>('madrasas', profile);
      options['madrasaId'] = this.toOptions(mads, 'name');
      options['madrasaIds'] = this.toOptions(mads, 'name');
    }

    if (hasField('courseId') || hasField('newCourseId')) {
      const courses = await this.repo.getAllOnce<EntityRecord>('courses', profile);
      options['courseId'] = this.toOptions(courses, 'name');
      options['newCourseId'] = this.toOptions(courses, 'name');
    }

    if (hasField('classId') || hasField('classIds')) {
      const classes = await this.repo.getAllOnce<EntityRecord>('classes', profile);
      options['classId'] = this.toOptions(classes, 'name');
      options['classIds'] = this.toOptions(classes, 'name');
    }

    if (hasField('subjectIds')) {
      const subjects = await this.repo.getAllOnce<EntityRecord>('subjects', profile);
      options['subjectIds'] = this.toOptions(subjects, 'name');
    }

    if (hasField('coordinatorIds') || hasField('inchargeIds')) {
      const users = await this.repo.getAllOnce<EntityRecord>('users', profile);
      if (hasField('coordinatorIds')) {
        options['coordinatorIds'] = this.toOptions(users.filter((user) => user['role'] === 'coordinator'), 'displayName');
      }
      if (hasField('inchargeIds')) {
        options['inchargeIds'] = this.toOptions(users.filter((user) => user['role'] === 'madrasaIncharge'), 'displayName');
      }
    }

    if (hasField('teacherIds')) {
      const staff = await this.repo.getAllOnce<EntityRecord>('staff', profile);
      options['teacherIds'] = this.toOptions(staff, 'name');
    }

    if (hasField('linkedStudentIds')) {
      const students = await this.repo.getAllOnce<EntityRecord>('students', profile);
      options['linkedStudentIds'] = this.toOptions(students, 'name');
    }

    return config.fields
      .map((field) => {
        if (initial && (field.key === 'password' || field.key === 'organizerPassword')) {
          return {
            key: 'passwordStatus',
            label: 'Password Status',
            type: 'info' as const,
            required: false,
          };
        }
        return {
          ...field,
          required: field.key === 'password' && !initial ? false : field.required,
          options: field.options ?? options[field.key] ?? field.options,
        };
      });
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
        passwordStatus: initial['mustChangePassword'] ? 'Temporary password pending' : 'Password changed',
      };
    }

    return {
      ...initial,
      passwordStatus: initial['mustChangePassword'] ? 'Temporary password pending' : 'Password changed',
    };
  }

  private normalizePayload(config: ManagementConfig, value: Record<string, unknown>, profile: AppUser | null): EntityRecord {
    const payload: EntityRecord = { ...value } as EntityRecord;
    delete payload['password'];
    delete payload['passwordStatus'];

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

    if (config.fixedRole === 'teacher') {
      return rows.filter((row) => row['role'] === 'teacher' || row['role'] === 'staff');
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
      studentNames:
        row['studentNames'] ||
        row['linkedStudentNames'] ||
        (Array.isArray(row['linkedStudentIds'])
          ? row['linkedStudentIds'].join(', ')
          : '-'),
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

  downloadOrganizationsCsv(rows: EntityRecord[]): void {
    const csvRows = rows.map(row => ({
      'Organization Name': row['name'] || '',
      'Code': row['code'] || '',
      'Organization Email': row['email'] || '',
      'Phone': row['phone'] || '',
      'Address': row['address'] || '',
      'Status': row['status'] || '',
      'Primary Organizer Name': row['primaryOrganizerName'] || '',
      'Primary Organizer Email': row['primaryOrganizerEmail'] || '',
      'Organizer Role': (row['organizerUser'] as any)?.role || 'ORGANIZATION_ADMIN',
      'Organizer Login Created': row['organizerUser'] ? 'Yes' : 'No',
      'Credential Status': this.getCredentialStatusLabel(row),
      'Temporary Password': row['temporaryPasswordDisplay'] || 'N/A',
      'Must Change Password': (row['organizerUser'] as any)?.mustChangePassword ? 'Yes' : 'No',
      'Created At': this.formatDateForCsv(row['createdAt']),
      'Updated At': this.formatDateForCsv(row['updatedAt'])
    }));

    const csv = this.csv.toCsv(csvRows);
    this.csv.download(`organizations-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  private getCredentialStatusLabel(row: EntityRecord): string {
    const status = row['credentialStatus'];
    if (status === 'TEMP_PASSWORD_PENDING') return 'Temporary password pending';
    if (status === 'PASSWORD_CHANGED') return 'Password changed';
    return 'Login not created';
  }

  private formatDateForCsv(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'object' && 'toDate' in value) {
      return (value as any).toDate().toISOString();
    }
    return String(value);
  }
}
