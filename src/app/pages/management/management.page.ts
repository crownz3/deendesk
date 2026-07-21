import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap, Subject, BehaviorSubject, take, tap, scan } from 'rxjs';
import { CollectionReference, DocumentData, collection, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { DEFAULT_STAGES_BY_COURSE_TYPE, PERMISSION_LABELS, ROLE_LABELS, ROLE_ORDER } from '../../core/constants/defaults';
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
import { RolePermissionsService } from '../../core/services/role-permissions.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { QuickAddDialogComponent, QuickAddResult } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { UserDetailsDialogComponent } from '../../shared/components/user-details-dialog/user-details-dialog.component';
import { CourseDetailsDialogComponent } from './course-details-dialog/course-details-dialog.component';
import { ClassDetailsDialogComponent } from './class-details-dialog/class-details-dialog.component';
import { MadrasaDetailsDialogComponent } from '../../shared/components/madrasa-details-dialog/madrasa-details-dialog.component';
import { PageEvent } from '@angular/material/paginator';
import { ClassDeactivationDialogComponent, ClassDeactivationData, ClassDeactivationAction } from './class-deactivation-dialog/class-deactivation-dialog.component';
import { ClassTransferWizardDialogComponent } from './class-transfer-wizard-dialog/class-transfer-wizard-dialog.component';
import { StudentTransferDialogComponent } from './student-transfer-dialog/student-transfer-dialog.component';
import { PromoteDemoteDialogComponent } from './promote-demote-dialog/promote-demote-dialog.component';
import { UserSwapDialogComponent } from './user-swap-dialog/user-swap-dialog.component';
import { CourseStagesDialogComponent } from './course-stages-dialog/course-stages-dialog.component';
import { AcademicTreeAssignStudentsDialogComponent } from '../tree-view/academic-tree-assign-students-dialog.component';
import { AcademicTreeAssignStaffDialogComponent } from '../tree-view/academic-tree-assign-staff-dialog.component';

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
  allowDelete?: boolean;
  allowTransfer?: boolean;
  allowSwap?: boolean;
  allowAssignStudents?: boolean;
  allowAssignStaff?: boolean;
  allowImpersonate?: boolean;
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
  totalItems?: number;
  madrasas?: EntityRecord[];
  courses?: EntityRecord[];
  classes?: EntityRecord[];
  organizations?: EntityRecord[];
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

const genderField: QuickAddField = {
  key: 'gender',
  label: 'Gender',
  type: 'select',
  required: true,
  options: [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
  ],
};

const joinTypeField: QuickAddField = {
  key: 'joinType',
  label: 'Join Method',
  type: 'select',
  required: true,
  options: [
    { label: 'New Join / Enrollment', value: 'new' },
    { label: 'Rejoin / Re-enrollment', value: 'rejoin' },
  ],
};

const MANAGEMENT_CONFIGS: Record<string, ManagementConfig> = {
  organizations: {
    resource: 'organizations',
    title: 'Organizations',
    subtitle: 'Create and manage customer organizations.',
    collection: 'organizations',
    allowDelete: true,
    emptyTitle: 'No organizations found',
    emptyText: 'Create your first organization to start managing madrasas, users, courses, and reports.',
    emptyButton: 'Add Organization',
    emptyIcon: 'business-outline',
    columns: [
      { key: 'name', label: 'Organization' },
      { key: 'code', label: 'Code' },
      { key: 'email', label: 'Organization Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
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
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber' },
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
    allowDelete: true,
    allowDetails: true,
    emptyTitle: 'No madrasas found',
    emptyText: 'Create your first madrasa to start mapping courses, classes, and assigning students.',
    emptyButton: 'Add Madrasa',
    emptyIcon: 'school-outline',
    columns: [
      { key: 'name', label: 'Madrasa' },
      { key: 'code', label: 'Code' },
      { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' },
      { key: 'coordinatorIds', label: 'Coordinators', type: 'idRef', referenceType: 'coordinator' },
      { key: 'inchargeIds', label: 'Incharges', type: 'idRef', referenceType: 'incharge' },
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
    allowDelete: true,
    emptyTitle: 'No users found',
    emptyText: 'Create users and assign them to specific roles, madrasas, and classes.',
    emptyButton: 'Add User',
    emptyIcon: 'people-outline',
    columns: [
      { key: 'photoURL', label: 'Profile', type: 'avatar' },
      { key: 'displayName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
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
    allowImpersonate: true,
    specialCreate: 'userAccess',
    fields: [
      { key: 'displayName', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      { key: 'role', label: 'Role', type: 'select', required: true },
      joinTypeField,
      genderField,
      { key: 'organizationId', label: 'Organization', type: 'select', quickAddResource: 'organizations' },
      { key: 'madrasaIds', label: 'Assigned madrasas', type: 'multiselect', quickAddResource: 'madrasas' },
      { key: 'permissions', label: 'Custom permissions', type: 'multiselect' },
      baseStatusField,
    ],
  },
  coordinators: {
    resource: 'coordinators',
    title: 'Coordinators',
    subtitle: 'Assign coordinators to one or more madrasas.',
    collection: 'users',
    allowDelete: true,
    fixedRole: 'coordinator',
    allowCredentials: true,
    allowDetails: true,
    allowImpersonate: true,
    specialCreate: 'userAccess',
    emptyTitle: 'No coordinators found',
    emptyText: 'Add coordinators and assign them to oversee one or more madrasas.',
    emptyButton: 'Add Coordinator',
    emptyIcon: 'git-network-outline',
    columns: [
      { key: 'displayName', label: 'Coordinator' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
      { key: 'madrasaIds', label: 'Madrasas', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
    ],
    fields: [
      { key: 'displayName', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      joinTypeField,
      genderField,
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
    allowDelete: true,
    fixedRole: 'madrasaIncharge',
    allowCredentials: true,
    allowDetails: true,
    specialCreate: 'userAccess',
    emptyTitle: 'No incharges found',
    emptyText: 'Add madrasa incharges and assign them to specific madrasas.',
    emptyButton: 'Add Incharge',
    emptyIcon: 'person-circle-outline',
    columns: [
      { key: 'displayName', label: 'Incharge' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
      { key: 'madrasaIds', label: 'Madrasas', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
    ],
    fields: [
      { key: 'displayName', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      joinTypeField,
      genderField,
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
    allowDelete: true,
    fixedRole: 'teacher',
    allowCredentials: true,
    allowDetails: true,
    allowTransfer: true,
    allowSwap: true,
    specialCreate: 'staffAccess',
    emptyTitle: 'No staff found',
    emptyText: 'Add teachers and staff to assign them to classes and subjects.',
    emptyButton: 'Add Staff',
    emptyIcon: 'briefcase-outline',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
      { key: 'assignedClassGroup', label: 'Assigned Class Group' },
      { key: 'madrasaIds', label: 'Madrasas', type: 'idRef', referenceType: 'madrasa' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
    ],
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber', required: true },
      { key: 'password', label: 'Initial password', type: 'password' },
      joinTypeField,
      genderField,
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaIds', label: 'Assigned madrasas', type: 'multiselect', required: true, quickAddResource: 'madrasas' },
      { key: 'permissions', label: 'Custom permissions', type: 'multiselect' },
      baseStatusField,
    ],
  },
  students: {
    resource: 'students',
    title: 'Students',
    subtitle: 'Create student and parent logins with correct academic mapping.',
    collection: 'students',
    allowDelete: true,
    fixedRole: 'student',
    allowCredentials: true,
    allowPromotion: true,
    allowTransfer: true,
    allowDetails: true,
    specialCreate: 'student',
    emptyTitle: 'No students found',
    emptyText: 'Enroll students to assign them to courses, classes, and stages.',
    emptyButton: 'Add Student',
    emptyIcon: 'person-outline',
    columns: [
      { key: 'name', label: 'Student' },
      { key: 'fatherName', label: 'Father' },
      { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' },
      { key: 'classId', label: 'Class', type: 'idRef', referenceType: 'class' },
      { key: 'groupId', label: 'Group', type: 'idRef', referenceType: 'classGroup' },
      { key: 'stage', label: 'Stage' },
      { key: 'madrasaId', label: 'Madrasa', type: 'idRef', referenceType: 'madrasa' },
      { key: 'email', label: 'Student Mail' },
      { key: 'parentEmail', label: 'Parent Mail' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
    ],
    fields: [
      { key: 'name', label: 'Student name', type: 'text', required: true },
      { key: 'fatherName', label: 'Father name', type: 'text', required: true },
      { key: 'parentName', label: 'Parent display name', type: 'text' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
      { key: 'admissionDate', label: 'Admission date', type: 'date' },
      joinTypeField,
      genderField,
      { key: 'email', label: 'Student email (optional)', type: 'email' },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber', required: true },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', quickAddResource: 'courses' },
      { key: 'courseTypeDisplay', label: 'Course Type', type: 'info' },
      { key: 'classId', label: 'Class', type: 'select', quickAddResource: 'classes' },
      { key: 'groupId', label: 'Group (Section)', type: 'select', quickAddResource: 'classGroups' },
      { key: 'stage', label: 'Stage', type: 'text' },
      baseStatusField,
    ],
  },
  parents: {
    resource: 'parents',
    title: 'Parents',
    subtitle: 'View parent accounts linked to students.',
    collection: 'users',
    allowDelete: true,
    fixedRole: 'parent',
    allowDetails: true,
    emptyTitle: 'No parents found',
    emptyText: 'Parents are automatically created when enrolling students, but you can also add them manually.',
    emptyButton: 'Add Parent',
    emptyIcon: 'people-circle-outline',
    columns: [
      { key: 'name', label: 'Parent' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
      { key: 'studentNames', label: 'Students' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'temporaryPasswordDisplay', label: 'Temporary Password', type: 'temporaryPassword' },
      { key: 'credentialStatus', label: 'Credential Status', type: 'credentialStatus' },
    ],
    allowCredentials: true,
    fields: [
      { key: 'name', label: 'Parent name', type: 'text', required: true },
      joinTypeField,
      genderField,
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'linkedStudentIds', label: 'Linked students', type: 'multiselect', quickAddResource: 'students' },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'mobileNumber', required: true },
      baseStatusField,
    ],
  },
  courses: {
    resource: 'courses',
    title: 'Courses',
    subtitle: 'Customize Maktab, Aalim, Hifz, Muballigh, and custom course structures.',
    collection: 'courses',
    allowDelete: true,
    emptyTitle: 'No courses found',
    emptyText: 'Create courses like Maktab or Hifz to define your academic structure.',
    emptyButton: 'Add Course',
    emptyIcon: 'library-outline',
    columns: [
      { key: 'name', label: 'Course' },
      { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' },
      { key: 'madrasaId', label: 'Madrasa', type: 'idRef', referenceType: 'madrasa' },
      { key: 'code', label: 'Code' },
      { key: 'typeDisplay', label: 'Course Type' },
      { key: 'stagesDisplay', label: 'Stages' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    allowDetails: true,
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
      { key: 'levels', label: 'Levels (comma separated)', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      baseStatusField,
    ],
  },
  stages: {
    resource: 'stages',
    title: 'Course Stages',
    subtitle: 'Define, order, and configure stages for each course structure.',
    collection: 'stages',
    allowDelete: true,
    emptyTitle: 'No course stages found',
    emptyText: 'Add stages (e.g. Stage 1, Miftah, Sabaq) and assign them to your courses.',
    emptyButton: 'Add Stage',
    emptyIcon: 'layers-outline',
    columns: [
      { key: 'courseName', label: 'Course' },
      { key: 'name', label: 'Stage Name' },
      { key: 'order', label: 'Sequence Order' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    allowDetails: true,
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', required: true, quickAddResource: 'courses' },
      { key: 'name', label: 'Stage Name', type: 'text', required: true, placeholder: 'e.g. Stage 1 or Miftah' },
      { key: 'order', label: 'Sequence Order Number', type: 'text', required: true, placeholder: '1, 2, 3...' },
      { key: 'description', label: 'Description', type: 'textarea' },
      baseStatusField,
    ],
  },
  courseTypes: {
    resource: 'courseTypes',
    title: 'Course Types',
    subtitle: 'Customize course categories and default academic structures.',
    collection: 'courseTypes',
    allowDelete: true,
    emptyTitle: 'No course types found',
    emptyText: 'Create course types like Maktab, Aalim, or Hifz to organize your curriculum.',
    emptyButton: 'Add Course Type',
    emptyIcon: 'library-outline',
    columns: [
      { key: 'name', label: 'Course Type Name' },
      { key: 'code', label: 'Code' },
      { key: 'defaultStagesDisplay', label: 'Default Stages' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    allowDetails: true,
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', quickAddResource: 'madrasas' },
      { key: 'name', label: 'Course Type Name', type: 'text', required: true, placeholder: 'e.g. Maktab, Aalim, Hifz' },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. MAKTAB, AALIM' },
      { key: 'description', label: 'Description', type: 'textarea' },
      baseStatusField,
    ],
  },
  classes: {
    resource: 'classes',
    title: 'Classes',
    subtitle: 'Create classes and map them to courses, stages, and sections.',
    collection: 'classes',
    allowDelete: true,
    allowDetails: true,
    allowAssignStudents: true,
    allowAssignStaff: true,
    emptyTitle: 'No classes found',
    emptyText: 'Create classes to organize students within specific courses and stages.',
    emptyButton: 'Add Class',
    emptyIcon: 'easel-outline',
    columns: [
      { key: 'name', label: 'Class' },
      { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' },
      { key: 'stage', label: 'Stage' },
      { key: 'groupStaff', label: 'Staff', type: 'staffChips' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', required: true, quickAddResource: 'courses' },
      { key: 'name', label: 'Class name', type: 'text', required: true },
      { key: 'stage', label: 'Stage', type: 'text' },
      baseStatusField,
    ],
  },
  classGroups: {
    resource: 'classGroups',
    title: 'Class Groups',
    subtitle: 'Manage groups or sections within a class.',
    collection: 'classGroups',
    allowDelete: true,
    allowAssignStudents: true,
    allowAssignStaff: true,
    emptyTitle: 'No class groups found',
    emptyText: 'Create groups to split classes into multiple sections.',
    emptyButton: 'Add Group',
    emptyIcon: 'people-circle-outline',
    columns: [
      { key: 'name', label: 'Group Name' },
      { key: 'madrasaId', label: 'Madrasa', type: 'idRef', referenceType: 'madrasa' },
      { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' },
      { key: 'classId', label: 'Class', type: 'idRef', referenceType: 'class' },
      { key: 'assignedStaffIds', label: 'Assigned Staff', type: 'idRef', referenceType: 'staff' },
      { key: 'studentCount', label: 'Students' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', quickAddResource: 'courses' },
      { key: 'classId', label: 'Class', type: 'select', required: true, quickAddResource: 'classes' },
      { key: 'name', label: 'Group name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text' },
      { key: 'capacity', label: 'Capacity', type: 'text' },
      { key: 'assignedStaffIds', label: 'Assigned staff', type: 'multiselect', quickAddResource: 'staff' },
      baseStatusField,
    ],
  },
  subjects: {
    resource: 'subjects',
    title: 'Subjects',
    subtitle: 'Manage subjects within the course and class structure.',
    collection: 'subjects',
    allowDelete: true,
    emptyTitle: 'No subjects found',
    emptyText: 'Add subjects to build out your curriculum within courses and classes.',
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
      baseStatusField,
    ],
  },
  propertyCategories: {
    resource: 'propertyCategories',
    title: 'Property Categories',
    subtitle: 'Manage categories for Madrasa properties and assets.',
    collection: 'propertyCategories',
    allowDelete: true,
    emptyTitle: 'No categories found',
    emptyText: 'Add property categories to organize assets and properties.',
    emptyButton: 'Add Category',
    emptyIcon: 'category',
    columns: [
      { key: 'name', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'name', label: 'Category name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
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

  orgSearch = '';
  madrasaSearch = '';
  courseSearch = '';
  classSearch = '';

  getFilteredOrganizations(orgs: EntityRecord[]): EntityRecord[] {
    if (!orgs || !this.orgSearch) return orgs;
    const q = this.orgSearch.toLowerCase();
    return orgs.filter(o => String(o['name'] || '').toLowerCase().includes(q));
  }

  getFilteredMadrasas(madrasas: EntityRecord[]): EntityRecord[] {
    if (!madrasas || !this.madrasaSearch) return madrasas;
    const q = this.madrasaSearch.toLowerCase();
    return madrasas.filter(m => String(m['name'] || '').toLowerCase().includes(q));
  }

  getFilteredCourses(courses: EntityRecord[]): EntityRecord[] {
    if (!courses || !this.courseSearch) return courses;
    const q = this.courseSearch.toLowerCase();
    return courses.filter(c => String(c['name'] || '').toLowerCase().includes(q));
  }

  getFilteredClasses(classes: EntityRecord[]): EntityRecord[] {
    if (!classes || !this.classSearch) return classes;
    const q = this.classSearch.toLowerCase();
    return classes.filter(c => String(c['name'] || '').toLowerCase().includes(q));
  }

  readonly madrasaFilter$ = new BehaviorSubject<string>('all');
  readonly roleFilter$ = new BehaviorSubject<string>('all');
  readonly organizationFilter$ = new BehaviorSubject<string>('all');
  
  readonly courseFilter$ = new BehaviorSubject<string>('all');
  readonly classFilter$ = new BehaviorSubject<string>('all');
  readonly stageFilter$ = new BehaviorSubject<string>('all');
  readonly statusFilter$ = new BehaviorSubject<string>('active');
  readonly genderFilter$ = new BehaviorSubject<string>('all');

  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly vm$ = combineLatest([
    this.config$,
    this.auth.profile$,
    this.madrasaFilter$,
    this.roleFilter$,
    this.organizationFilter$,
    this.searchQuery$,
    this.genderFilter$,
    this.pageIndex$,
    this.pageSize$,
    combineLatest([this.courseFilter$, this.classFilter$, this.stageFilter$, this.statusFilter$])
  ]).pipe(
    switchMap(([config, profile, madrasaFilter, roleFilter, organizationFilter, searchQuery, genderFilter, pageIndex, pageSize, [courseFilter, classFilter, stageFilter, statusFilter]]) => {
      return combineLatest([
        this.rowsForConfig(config, profile, madrasaFilter, roleFilter),
        this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('courses', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('students', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
        profile?.role === 'superAdmin'
          ? this.repo.list<EntityRecord>('organizations', profile).pipe(catchError(() => of([])))
          : of([] as EntityRecord[])
      ]).pipe(
        map(([rows, madrasas, courses, classes, students, classGroups, staffRows, organizations]) => {
           let filteredRows = this.decorateRows(config, this.filterRows(config, rows));
           let displayMadrasas = madrasas;
           let displayCourses = courses;
           let displayClasses = classes;

           if (profile?.role === 'superAdmin' && organizationFilter !== 'all') {
             filteredRows = filteredRows.filter(r => r['organizationId'] === organizationFilter);
             displayMadrasas = madrasas.filter(m => m['organizationId'] === organizationFilter);
             displayCourses = courses.filter(c => c['organizationId'] === organizationFilter);
             displayClasses = classes.filter(c => c['organizationId'] === organizationFilter);
           }
            
           if (config.resource === 'classGroups') {
             filteredRows = filteredRows.map(group => {
               const count = students.filter(s => s['groupId'] === group.id && s['status'] !== 'inactive').length;
                return { ...group, studentCount: count };
              });
            }

            if (config.resource === 'classes') {
              filteredRows = this.withClassGroupStaff(filteredRows, classGroups, staffRows);
            }
           
            if (config.resource === 'students') {
               if (courseFilter !== 'all') {
                 filteredRows = filteredRows.filter(r => r['courseId'] === courseFilter);
                 displayClasses = classes.filter(c => c['courseId'] === courseFilter);
               }
               if (classFilter !== 'all') {
                 filteredRows = filteredRows.filter(r => r['classId'] === classFilter);
               }
               if (stageFilter !== 'all') {
                 filteredRows = filteredRows.filter(r => r['stage'] === stageFilter || r['level'] === stageFilter);
               }
            }
            
            if (['users', 'students', 'incharges', 'coordinators', 'staff', 'parents'].includes(config.resource)) {
               if (madrasaFilter !== 'all') {
                 filteredRows = filteredRows.filter(r => r['madrasaId'] === madrasaFilter || (Array.isArray(r['madrasaIds']) && r['madrasaIds'].includes(madrasaFilter)));
               }

               if (statusFilter !== 'all') {
                 filteredRows = filteredRows.filter(r => (r['status'] || 'active') === statusFilter);
               }

               if (genderFilter !== 'all') {
                 filteredRows = filteredRows.filter(r => r['gender'] === genderFilter);
               }
            }

            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              filteredRows = filteredRows.filter(r => 
                (r['name']?.toString().toLowerCase() || '').includes(q) ||
                (r['displayName']?.toString().toLowerCase() || '').includes(q) ||
                (r['email']?.toString().toLowerCase() || '').includes(q) ||
                (r['code']?.toString().toLowerCase() || '').includes(q)
              );
            }

            const totalItems = filteredRows.length;
            const startIndex = pageIndex * pageSize;
            filteredRows = filteredRows.slice(startIndex, startIndex + pageSize);

            if (['users', 'students', 'incharges', 'coordinators', 'staff', 'parents'].includes(config.resource)) {
               return { rows: filteredRows, profile, totalItems, madrasas: displayMadrasas, courses: displayCourses, classes: displayClasses, organizations };
            }
 
            return { rows: filteredRows, profile, totalItems, madrasas: displayMadrasas, courses: displayCourses, classes: displayClasses, organizations };
        }),
        map(({ rows, profile, totalItems, madrasas, courses, classes, organizations }): PageState<ManagementVm> => ({
          data: {
            config,
            rows,
            profile,
            totalItems,
            madrasas,
            courses,
            classes,
            organizations
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
      );
    }),
    scan((acc: PageState<ManagementVm>, curr: PageState<ManagementVm>) => ({
      ...curr,
      data: curr.data || (curr.loading && acc.data ? acc.data : undefined)
    }), { loading: true } as PageState<ManagementVm>)
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
    private readonly rolePermissionsService: RolePermissionsService
  ) { }

  refreshData() {
    this.repo.clearCache();
    // Force re-emission by re-publishing the current search query
    this.searchQuery$.next(this.searchQuery$.value);
  }

  private rowsForConfig(config: ManagementConfig, profile: AppUser | null, madrasaFilter: string = 'all', roleFilter: string = 'all'): Observable<EntityRecord[]> {
    if (['students', 'parents', 'staff'].includes(config.resource)) {
      return this.businessEntityRows(config, profile);
    }

    if (config.allowCredentials && config.collection !== 'users') {
      return this.credentialRowsForCollection(config, profile);
    }

    if (config.collection === 'users') {
      return this.userRowsForResource(config, profile, madrasaFilter, roleFilter);
    }

    return this.repo.list<EntityRecord>(config.collection, profile);
  }

  private businessEntityRows(config: ManagementConfig, profile: AppUser | null): Observable<EntityRecord[]> {
    const collectionObs$ = this.repo.list<EntityRecord>(config.collection, profile);
    switch (config.resource) {
      case 'students':
        return this.studentRows(collectionObs$, profile);
      case 'parents':
        return this.parentRows(collectionObs$, profile);
      case 'staff':
        return this.staffRows(collectionObs$, profile);
      default:
        return collectionObs$;
    }
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

  private userRowsForResource(config: ManagementConfig, profile: AppUser | null, madrasaFilter: string = 'all', roleFilter: string = 'all'): Observable<EntityRecord[]> {
    const roles = this.rolesForResource(config.resource);
    
    // Apply filters at query level when viewing users page
    let queryRoles = roles ? roles : undefined;
    if (config.resource === 'users' && roleFilter !== 'all') {
      queryRoles = [roleFilter];
    }
    
    // For madrasa filtering in repository service, we can't easily pass it without changing repo.list signature.
    // Instead we will fetch with standard repo logic and apply madrasa filter in memory, 
    // unless the RepositoryService gets an update to accept custom constraints.
    // Given the constraints of repo.list, we fetch scoped users and filter in-memory if needed.
    // We already fetch scoped by role.

    const usersObs$ = this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(
      map(rows => {
        if (queryRoles && queryRoles.length > 0) {
           rows = rows.filter(r => queryRoles!.includes(String(r['role'])));
        }
        if (config.resource === 'users' && madrasaFilter !== 'all') {
           rows = rows.filter(r => r['madrasaId'] === madrasaFilter || (Array.isArray(r['madrasaIds']) && r['madrasaIds'].includes(madrasaFilter)));
        }
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
      default:
        return usersObs$.pipe(map((rows) => this.credentialRows(rows)));
    }
  }

  private rolesForResource(resource: string): string[] | undefined {
    switch (resource) {
      case 'coordinators': return ['coordinator'];
      case 'incharges': return ['madrasaIncharge'];
      case 'staff': return ['teacher', 'staff', 'madrasaIncharge', 'coordinator', 'organizationAdmin'];
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
        mobileNumber: row['mobileNumber'] || row['phone'] || '',
        phone: row['phone'] || row['mobileNumber'] || '',
        credentialStatus: creds.status,
        temporaryPasswordDisplay: creds.display,
      } as EntityRecord;
    });
  }

  private studentRows(studentsObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      studentsObs$,
      this.repo.list<EntityRecord>('courses', profile).pipe(catchError((e) => {
        console.warn('[Students] Courses load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('classes', profile).pipe(catchError((e) => {
        console.warn('[Students] Classes load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('parents', profile).pipe(catchError((e) => {
        console.warn('[Students] Parents load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(
        map(rows => rows.filter(r => r['role'] === 'student')),
        catchError((e) => {
          console.warn('[Students] Users load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError((e) => {
        console.warn('[Students] Madrasas load failed:', e);
        return of([] as EntityRecord[]);
      })),
    ]).pipe(
      map(([students, courses, classes, parents, userRows, madrasas]) => {
        if (profile?.role === 'teacher' || (profile?.role as string) === 'staff') {
          const allowedClassIds = classes.map(c => c.id);
          students = students.filter(s => allowedClassIds.includes(String(s['classId'])));
        }
        return students.map((row) => {
        const studentUserId = this.recordId(row);
        const userRow = userRows.find(u => u['uid'] === studentUserId || u.id === studentUserId || u['entityId'] === row.id) || row;
        const creds = this.credentialService.getCredentialStatus(userRow);
        
        const studentIds = this.uniqueStrings([row.id, row['userId'], row['uid']]);
        const parentEmail = this.resolveParentEmail(userRow, row, parents, studentUserId, studentIds);

        return {
          ...userRow,
          ...row,
          role: 'student',
          id: row.id,
          userId: studentUserId,
          uid: userRow['uid'] || userRow.id || row.id,
          name: row['name'] || row['studentName'] || userRow['displayName'] || userRow['name'] || '',
          email: row['email'] || userRow['email'] || '',
          fatherName: row['fatherName'] || userRow['fatherName'] || row['parentName'] || userRow['parentName'] || '',
          courseId: userRow['courseId'] || row['courseId'],
          classId: userRow['classId'] || row['classId'],
          groupId: userRow['groupId'] || row['groupId'],
          courseName: row['courseName'] || courses.find((c: any) => c.id === (userRow['courseId'] || row['courseId']))?.['title'] || courses.find((c: any) => c.id === (userRow['courseId'] || row['courseId']))?.['name'] || '',
          className: row['className'] || classes.find((c: any) => c.id === (userRow['classId'] || row['classId']))?.['name'] || classes.find((c: any) => c.id === (userRow['classId'] || row['classId']))?.['title'] || '',
          madrasaName: row['madrasaName'] || madrasas.find((m: any) => m.id === (userRow['madrasaId'] || row['madrasaId']))?.['name'] || '',
          stage: this.getStudentStage(userRow) !== '-' ? this.getStudentStage(userRow) : this.getStudentStage(row),
          parentEmail,
          organizationId: userRow['organizationId'] || row['organizationId'],
          madrasaId: userRow['madrasaId'] || row['madrasaId'],
          madrasaIds: (Array.isArray(userRow['madrasaIds']) && userRow['madrasaIds'].length > 0) ? userRow['madrasaIds'] : row['madrasaIds'],
          credentialStatus: creds.status,
          temporaryPasswordDisplay: creds.display,
        } as EntityRecord;
      });
      }),
      tap((students) => {
        console.log('[Students Page Stage Mapping Debug]', {
          students: students.map((user: any) => ({
            id: user.id || user.uid,
            name: user.name || user.displayName,
            rawStage: user.stage,
            rawLevel: user.level,
            rawStageName: user.stageName,
            rawLevelName: user.levelName,
            rawCurrentStage: user.currentStage,
            rawCurrentLevel: user.currentLevel,
            displayedStage: this.getStudentStage(user),
            courseName: user.courseName,
            className: user.className,
          }))
        });
      })
    );
  }

  private getStudentStage(user: any): string {
    return user?.stage
      || user?.stageLevel
      || user?.level
      || user?.stageName
      || user?.levelName
      || user?.currentStage
      || user?.currentLevel
      || '-';
  }

  private staffRows(staffObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      staffObs$,
      this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(
        catchError((e) => {
          console.warn('[Staff] Users load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('classGroups', profile, [], undefined).pipe(
        catchError((e) => {
          console.warn('[Staff] Class groups load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
    ]).pipe(
      map(([staffs, users, groups]) => {
        const allStaffRecordsMap = new Map<string, any>();
        staffs.forEach(s => allStaffRecordsMap.set(String(s['userId'] || s.id || ''), s));
        
        // Only explicitly add users to the staff table if they have a staff role
        const staffRoleUsers = users.filter(r => ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin'].includes(String(r['role'])));
        
        staffRoleUsers.forEach(u => {
          const uidStr = String(u['uid'] || u.id || '');
          const uEmail = String(u['email'] || '').toLowerCase().trim();
          const existingByEmail = Array.from(allStaffRecordsMap.values()).find(s => {
             const sEmail = String(s['email'] || '').toLowerCase().trim();
             return sEmail && sEmail === uEmail;
          });
          if (!allStaffRecordsMap.has(uidStr) && !existingByEmail) {
            allStaffRecordsMap.set(uidStr, u);
          }
        });
        const combinedStaffRaw = Array.from(allStaffRecordsMap.values());

        return combinedStaffRaw.map((row) => {
          const rowEmail = String(row['email'] || '').toLowerCase().trim();
          const userRow = users.find(u => {
             const uEmail = String(u['email'] || '').toLowerCase().trim();
             return u['uid'] === row['userId'] || u.id === row['userId'] || u['entityId'] === row.id || (uEmail && uEmail === rowEmail);
          }) || row;
          const creds = this.credentialService.getCredentialStatus(userRow);
        return {
          ...userRow,
          ...row,
          id: row.id,
          uid: userRow['uid'] || userRow.id || row.id,
          name: userRow['displayName'] || userRow['name'] || row['name'] || '',
          displayName: userRow['displayName'] || userRow['name'] || row['name'] || '',
          email: userRow['email'] || row['email'] || '',
          role: userRow['role'] || row['role'] || 'teacher',
          mobileNumber: userRow['mobileNumber'] || row['mobileNumber'] || userRow['phone'] || row['phone'] || '',
          phone: userRow['phone'] || row['phone'] || userRow['mobileNumber'] || row['mobileNumber'] || '',
          designation: userRow['designation'] || row['designation'] || '',
          organizationId: userRow['organizationId'] || row['organizationId'],
          madrasaId: userRow['madrasaId'] || row['madrasaId'],
          madrasaIds: (Array.isArray(userRow['madrasaIds']) && userRow['madrasaIds'].length > 0) ? userRow['madrasaIds'] : row['madrasaIds'],
          roles: Array.from(new Set([
            ...(Array.isArray(userRow['roles']) ? userRow['roles'] : []),
            ...(Array.isArray(row['roles']) ? row['roles'] : [])
          ])),
          credentialStatus: creds.status,
          temporaryPasswordDisplay: creds.display,
          assignedClassGroup: (() => {
            const possibleIds = [row.id, userRow.id, userRow['uid'], userRow['userId'], row['userId'], userRow['entityId'], row['email'], userRow['email']]
              .map(v => String(v || '').trim())
              .filter(Boolean);
            return groups
              .filter(g => Array.isArray(g['assignedStaffIds']) && possibleIds.some(id => (g['assignedStaffIds'] as any[]).map(String).includes(id)))
              .map(g => g['name'] || 'Unnamed Class')
              .join(', ');
          })(),
        } as EntityRecord;
        });
      })
    );
  }

  private parentRows(parentsObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      parentsObs$,
      this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(
        map(rows => rows.filter(r => r['role'] === 'parent')),
        catchError((e) => {
          console.warn('[Parents] Users load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('students', profile).pipe(catchError((e) => {
        console.warn('[Parents] Student metadata load failed:', e);
        return of([] as EntityRecord[]);
      })),
    ]).pipe(
      switchMap(([parents, users, studentMetaRows]) => {
        if (!parents.length) {
          return of([] as EntityRecord[]);
        }

        const rowStreams = parents.map((row) => {
          const userRow = users.find(u => u['uid'] === row['userId'] || u.id === row['userId'] || u['entityId'] === row.id) || row;
          return this.parentRow(row, userRow, studentMetaRows);
        });
        return combineLatest(rowStreams);
      }),
    );
  }

  private parentRow(parentRow: EntityRecord, userRow: EntityRecord, studentMetaRows: EntityRecord[]): Observable<EntityRecord> {
    const creds = this.credentialService.getCredentialStatus(userRow);
    const resolvedParentName = parentRow['name'] || userRow['displayName'] || userRow['name'] || parentRow['email'] || userRow['email'] || 'N/A';
    const parentUserId = this.recordId(parentRow) || this.recordId(userRow);

    const linkedStudentIds = this.uniqueStrings([
      ...(Array.isArray(parentRow['linkedStudentIds']) ? parentRow['linkedStudentIds'] : []),
      ...(Array.isArray(userRow['linkedStudentIds']) ? userRow['linkedStudentIds'] : []),
      ...(Array.isArray(userRow['studentIds']) ? userRow['studentIds'] : []),
    ]);

    const linkedStudentUserIds = this.uniqueStrings([
      ...(Array.isArray(parentRow['linkedStudentUserIds']) ? parentRow['linkedStudentUserIds'] : []),
      ...(Array.isArray(userRow['linkedStudentUserIds']) ? userRow['linkedStudentUserIds'] : []),
    ]);

    const localNames = this.studentNamesFromMetadata(linkedStudentIds, linkedStudentUserIds, studentMetaRows);
    const unresolvedIds = linkedStudentIds.filter((id) => !studentMetaRows.some((student) => this.studentRecordMatches(student, id)));

    const buildRow = (resolvedNames: string[]): EntityRecord => {
      const studentNames = this.uniqueStrings([...localNames, ...resolvedNames])
        .filter((name) => name !== 'Unknown' && name !== 'N/A' && name !== 'Unnamed')
        .join(', ') || 'N/A';

      return {
        ...userRow,
        ...parentRow,
        id: parentRow.id,
        userId: parentUserId,
        uid: userRow['uid'] || userRow.id || parentRow.id,
        name: resolvedParentName,
        displayName: resolvedParentName,
        linkedStudentIds,
        linkedStudentUserIds,
        studentNames,
        linkedStudentNames: studentNames,
        organizationId: parentRow['organizationId'] || userRow['organizationId'],
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

  async impersonateUser(row: EntityRecord) {
    if (!row['id']) return;
    
    const confirm = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Login As User',
        message: `Are you sure you want to log in as ${row['name'] || row['displayName'] || row['email']}? You will need to log out to return to your super admin account.`,
        confirmText: 'Login As User',
        isDestructive: false
      }
    }).afterClosed());

    if (!confirm) return;

    this.loader.show('Authenticating...');
    try {
      await this.auth.impersonateUser(row['id']);
    } catch (error: any) {
      this.snackBar.open(error?.message || 'Failed to login as user.', 'Close', { duration: 5000 });
    } finally {
      this.loader.hide();
    }
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

  private recordIdentityValues(row: EntityRecord): string[] {
    return this.uniqueStrings([
      row.id,
      row['uid'],
      row['userId'],
      row['entityId'],
      row['email'],
    ]);
  }

  private staffAssignmentId(row: EntityRecord): string {
    return String(row['entityId'] || row.id || row['uid'] || row['userId'] || '').trim();
  }

  private withClassGroupStaff(classes: EntityRecord[], classGroups: EntityRecord[], staffRows: EntityRecord[]): EntityRecord[] {
    const staffById = new Map<string, EntityRecord>();
    staffRows.forEach((staff) => {
      this.recordIdentityValues(staff).forEach((id) => staffById.set(id, staff));
    });

    return classes.map((classRow) => {
      const groups = classGroups.filter((group) => String(group['classId'] || '') === String(classRow.id || ''));
      const staffIds = this.uniqueStrings(
        groups.flatMap((group) => Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'] : [])
      );

      const groupStaff = staffIds.map((id) => {
        const staff = staffById.get(id);
        return {
          id,
          name: String(staff?.['name'] || staff?.['displayName'] || staff?.['email'] || id),
          email: staff?.['email'] || '',
          photoURL: staff?.['photoURL'] || '',
        };
      });

      return {
        ...classRow,
        groupStaff,
      };
    });
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

  async viewDetails(config: ManagementConfig, row: EntityRecord): Promise<void> {
    if (config.resource === 'courses') {
      this.dialog.open(CourseDetailsDialogComponent, {
        data: { course: row },
        width: '90vw',
        height: '90vh',
        maxWidth: '90vw',
        maxHeight: '90vh'
      });
      return;
    }

    if (config.resource === 'classes') {
      this.dialog.open(ClassDetailsDialogComponent, {
        data: { classRecord: row },
        width: '90vw',
        height: '90vh',
        maxWidth: '90vw',
        maxHeight: '90vh'
      });
      return;
    }

    if (config.resource === 'madrasas') {
      this.dialog.open(MadrasaDetailsDialogComponent, {
        data: { madrasa: row },
        width: '90vw',
        height: '90vh',
        maxWidth: '90vw',
        maxHeight: '90vh'
      });
      return;
    }

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
      this.snackBar.open('You cannot deactivate your own profile.', 'Close', { duration: 4000 });
      return;
    }

    if (config.collection === 'users' && row['role'] === 'organizationAdmin') {
      this.snackBar.open('Organization Admins cannot be deactivated.', 'Close', { duration: 4000 });
      return;
    }

    if (config.collection === 'classGroups') {
      if (row['isDefault']) {
        this.dialog.open(ConfirmDialogComponent, {
          data: { title: 'Cannot Deactivate', message: 'Cannot deactivate the default class section.', hideCancel: true, confirmLabel: 'OK' }
        });
        return;
      }
      if (row['studentCount'] && Number(row['studentCount']) > 0) {
        this.dialog.open(ConfirmDialogComponent, {
          data: { title: 'Cannot Deactivate', message: 'Cannot deactivate a group with enrolled students. Reassign them first.', hideCancel: true, confirmLabel: 'OK' }
        });
        return;
      }
    }

    if (config.collection === 'classes' && row.id) {
      const profile = await firstValueFrom(this.auth.profile$);
      
      const [studentsData, timetables, attendance, groups] = await Promise.all([
        this.repo.getAllOnce('students', profile),
        this.repo.getAllOnce('classPlans', profile),
        this.repo.getAllOnce('attendance', profile),
        this.repo.getAllOnce('classGroups', profile)
      ]);

      const activeStudents = studentsData.filter(s => s['classId'] === row.id && s['status'] !== 'inactive');
      const classStaffIds = this.uniqueStrings(
        groups
          .filter(group => group['classId'] === row.id)
          .flatMap(group => Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'] : [])
      );
      const activeTimetables = timetables.filter(t => t['classId'] === row.id);
      const activeAttendance = attendance.filter(a => a['classId'] === row.id);

      if (activeStudents.length > 0 || classStaffIds.length > 0 || activeTimetables.length > 0 || activeAttendance.length > 0) {
        const dialogRef = this.dialog.open(ClassDeactivationDialogComponent, {
          data: {
            classRecord: row,
            counts: {
              students: activeStudents.length,
              staff: classStaffIds.length,
              timetables: activeTimetables.length,
              attendance: activeAttendance.length
            }
          },
          width: '500px'
        });

        const action = await firstValueFrom(dialogRef.afterClosed());
        
        if (action === 'transfer-students' || action === 'transfer-staff') {
           const type = action === 'transfer-students' ? 'students' : 'staff';
           const transferRef = this.dialog.open(ClassTransferWizardDialogComponent, {
             data: {
               transferType: type,
               sourceClassRecord: row
             },
             width: '600px'
           });
           
           const transferSuccess = await firstValueFrom(transferRef.afterClosed());
           if (transferSuccess) {
              // Optionally trigger a refresh
              this.pageIndex$.next(0);
           }
        }
        
        return; // Abort deactivation since it has dependencies
      }
    }

    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Deactivate ${config.title}`,
        message: `Deactivate "${row['name'] ?? row['displayName'] ?? 'this record'}"? They will lose access to the system.`,
        confirmLabel: 'Deactivate',
      },
    }).afterClosed());

    if (confirmed && row.id) {
      await this.loader.withLoader('Deactivating record...', async () => {
        const profile = await firstValueFrom(this.auth.profile$);
        await this.repo.update(config.collection, row.id!, { status: 'inactive' }, profile);
        if (config.collection !== 'users' && row['userId']) {
          await this.repo.update('users', String(row['userId']), { status: 'inactive' }, profile).catch(() => {});
        }
      });
      this.snackBar.open('Record deactivated.', 'Close', { duration: 3000 });
    }
  }

  async activate(config: ManagementConfig, row: EntityRecord): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Activate ${config.title}`,
        message: `Activate "${row['name'] ?? row['displayName'] ?? 'this record'}"? They will regain access to the system.`,
        confirmLabel: 'Activate',
      },
    }).afterClosed());

    if (confirmed && row.id) {
      await this.loader.withLoader('Activating record...', async () => {
        const profile = await firstValueFrom(this.auth.profile$);
        await this.repo.update(config.collection, row.id!, { status: 'active' }, profile);
        if (config.collection !== 'users' && row['userId']) {
          await this.repo.update('users', String(row['userId']), { status: 'active' }, profile).catch(() => {});
        }
      });
      this.snackBar.open('Record activated.', 'Close', { duration: 3000 });
    }
  }

  async bulkDeactivate(config: ManagementConfig, rows: EntityRecord[], dataTable: any): Promise<void> {
    if (config.collection === 'classGroups') {
      const invalidRows = rows.filter(r => r['isDefault'] || (r['studentCount'] && Number(r['studentCount']) > 0));
      if (invalidRows.length > 0) {
        this.snackBar.open('Selection contains default sections or groups with students, which cannot be deactivated.', 'Close', { duration: 5000 });
        return;
      }
    }

    let validRows = rows;
    if (config.collection === 'users') {
      validRows = rows.filter(r => r['role'] !== 'organizationAdmin');
      if (validRows.length < rows.length) {
        this.snackBar.open('Organization Admins were excluded from the selection as they cannot be deactivated.', 'Close', { duration: 4000 });
        if (validRows.length === 0) {
           dataTable.selection.clear();
           return;
        }
      }
    }

    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Deactivate ${validRows.length} ${config.title}`,
        message: `Are you sure you want to deactivate ${validRows.length} records? They will lose access to the system.`,
        confirmLabel: 'Deactivate All',
      },
    }).afterClosed());

    if (confirmed) {
      await this.loader.withLoader(`Deactivating ${validRows.length} records...`, async () => {
        const profile = await firstValueFrom(this.auth.profile$);
        await Promise.all(validRows.map(async (row) => {
          if (row.id) {
            await this.repo.update(config.collection, row.id, { status: 'inactive' }, profile);
            if (config.collection !== 'users' && row['userId']) {
              await this.repo.update('users', String(row['userId']), { status: 'inactive' }, profile).catch(() => {});
            }
          }
        }));
      });
      this.snackBar.open(`${validRows.length} records deactivated.`, 'Close', { duration: 4000 });
      dataTable.selection.clear();
    }
  }

  async bulkDelete(config: ManagementConfig, rows: EntityRecord[], dataTable: any): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete ${rows.length} ${config.title}`,
        message: `Are you sure you want to permanently delete ${rows.length} records? This action cannot be undone.`,
        confirmLabel: 'Delete All',
        confirmColor: 'warn'
      },
    }).afterClosed());

    if (confirmed) {
      await this.loader.withLoader(`Deleting ${rows.length} records...`, async () => {
        let successCount = 0;
        let failCount = 0;
        await Promise.all(rows.map(async (row) => {
          if (row.id) {
            try {
              await this.repo.remove(config.collection, row.id);
              if (config.collection !== 'users' && row['userId']) {
                await this.repo.remove('users', String(row['userId'])).catch(() => {});
              }
              if (config.collection === 'users' && row['entityId'] && row['entityType']) {
                await this.repo.remove(String(row['entityType']) + 's', String(row['entityId'])).catch(() => {});
              }
              successCount++;
            } catch (e) {
              failCount++;
            }
          }
        }));
        if (failCount > 0) {
          this.snackBar.open(`Deleted ${successCount} records. Failed to delete ${failCount}.`, 'Close', { duration: 5000 });
        } else {
          this.snackBar.open(`${successCount} records permanently deleted.`, 'Close', { duration: 4000 });
        }
      });
      dataTable.selection.clear();
    }
  }

  async permanentlyDelete(config: ManagementConfig, row: EntityRecord): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Permanently Delete ${config.title.slice(0, -1)}`,
        message: `Are you sure you want to completely delete "${row['name'] || row['displayName'] || row['email'] || 'this record'}"? This action cannot be undone.`,
        confirmLabel: 'Permanently Delete',
        confirmColor: 'warn',
      },
    }).afterClosed());

    if (confirmed && row.id) {
      await this.loader.withLoader(`Deleting record...`, async () => {
        try {
          await this.repo.remove(config.collection, row.id!);
          // If it's a person/business record, also delete the linked user account to avoid orphans
          if (config.collection !== 'users' && row['userId']) {
            await this.repo.remove('users', String(row['userId'])).catch(() => {});
          }
          // If it's a user account, also attempt to delete the business record
          if (config.collection === 'users' && row['entityId'] && row['entityType']) {
            await this.repo.remove(String(row['entityType']) + 's', String(row['entityId'])).catch(() => {});
          }
          this.snackBar.open(`Record permanently deleted.`, 'Close', { duration: 4000 });
        } catch (error: any) {
          this.dialog.open(ConfirmDialogComponent, {
            data: { title: 'Cannot Delete', message: error.message || 'Failed to delete record.', hideCancel: true, confirmLabel: 'OK' }
          });
        }
      });
    }
  }

  async migrateGroups(config: ManagementConfig): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Migrate Class Groups`,
        message: `This will scan all classes. If a class has no groups, it will automatically create "Section A". It will then assign any students or staff in that class to the default group. Proceed?`,
        confirmLabel: 'Run Migration',
      },
    }).afterClosed());

    if (!confirmed) return;

    await this.loader.withLoader('Migrating groups...', async () => {
      const profile = await firstValueFrom(this.auth.profile$);
      const classes = await this.repo.getAllOnce<EntityRecord>('classes', profile);
      const allGroups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile);
      const allStudents = await this.repo.getAllOnce<EntityRecord>('students', profile);
      
      let migratedCount = 0;

      for (const cls of classes) {
        if (!cls.id) continue;
        let classGroups = allGroups.filter(g => g['classId'] === cls.id);
        
        let targetGroupId: string;

        try {
          if (classGroups.length === 0) {
            // Create Section A
            targetGroupId = await this.repo.create('classGroups', {
              classId: cls.id,
              organizationId: cls['organizationId'] || undefined,
              madrasaId: cls['madrasaId'] || undefined,
              courseId: cls['courseId'] || undefined,
              name: 'Section A',
              isDefault: true,
              displayOrder: 1,
              assignedStaffIds: [],
              studentCount: 0,
              capacity: 50,
            }, profile);
            migratedCount++;
          } else if (classGroups.length === 1) {
            targetGroupId = String(classGroups[0].id);
          } else {
            continue; // Cannot auto-migrate if there are multiple groups
          }
        } catch (e: any) {
          console.error(`[Migrate Groups] Failed CREATING classGroup for class ${cls.id}:`, e);
          this.snackBar.open(`Error creating group for ${cls['name']}: ${e.message}`, 'Close', { duration: 5000 });
          return;
        }

        // Migrate Students
        const studentsWithoutGroup = allStudents.filter(s => s['classId'] === cls.id && !s['groupId']);
        for (const student of studentsWithoutGroup) {
          if (student.id) {
            try {
              await this.repo.update('students', student.id, { groupId: targetGroupId }, profile);
              migratedCount++;
            } catch (e: any) {
              console.error(`[Migrate Groups] Failed UPDATING student ${student.id} in class ${cls.id}:`, e);
              this.snackBar.open(`Error updating student in ${cls['name']}: ${e.message}`, 'Close', { duration: 5000 });
              return;
            }
          }
        }

      }

      this.snackBar.open(`Migration complete. Updated ${migratedCount} records.`, 'Close', { duration: 5000 });
    });
  }

  async swap(row: EntityRecord): Promise<void> {
    const role = row['role'];
    const isStudent = role === 'student';
    const isStaff = ['teacher', 'staff', 'madrasaIncharge', 'coordinator'].includes(String(role));

    if (!isStudent && !isStaff) {
      this.dialog.open(ConfirmDialogComponent, {
        data: { title: 'Transfer Unavailable', message: 'Transfers are only supported for students and staff.', hideCancel: true, confirmLabel: 'OK' }
      });
      return;
    }

    const dialogRef = this.dialog.open(UserSwapDialogComponent, {
      data: { currentUser: row },
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Refresh rows
        this.pageIndex$.next(0);
      }
    });
  }

  async assignStudents(config: ManagementConfig, row: EntityRecord) {
    if (config.resource !== 'classGroups' && config.resource !== 'classes') return;
    
    await this.loader.withLoader('Loading students...', async () => {
      const profile = await firstValueFrom(this.auth.profile$);
      const allStudents = await this.repo.getAllOnce<EntityRecord>('students', profile);
      
      let assignedStudents: any[] = [];
      let nodeType = '';
      if (config.resource === 'classGroups') {
        nodeType = 'classGroup';
        assignedStudents = allStudents.filter((s: any) => s['groupId'] === row.id);
      } else if (config.resource === 'classes') {
        nodeType = 'class';
        assignedStudents = allStudents.filter((s: any) => s['classId'] === row.id);
      }
      
      const node = {
        id: row['id'] || row.id,
        title: row['name'] || 'Class Group',
        type: nodeType,
        parentClassId: row['classId'],
        parentClassName: row['className'],
        parentCourseId: row['courseId'],
        parentCourseName: row['courseName'],
        parentMadrasaId: row['madrasaId'],
        assignedStudents
      };
      
      this.dialog.open(AcademicTreeAssignStudentsDialogComponent, {
        width: '90vw',
        height: '90vh',
        maxWidth: '90vw',
        maxHeight: '90vh',
        panelClass: 'academic-tree-assign-dialog-panel',
        data: {
          mode: assignedStudents.length > 0 ? 'edit' : 'add',
          node,
          assignedStudents,
          availableStudents: allStudents.filter((s: any) => {
            if (config.resource === 'classGroups') return s['groupId'] !== row.id;
            return s['classId'] !== row.id;
          }),
          allStudents
        },
        autoFocus: false,
      });
    });
  }

  async assignStaff(config: ManagementConfig, row: EntityRecord) {
    if (config.resource !== 'classGroups' && config.resource !== 'classes') return;
    
    await this.loader.withLoader('Loading staff...', async () => {
      const users = await this.repo.getAllOnce<EntityRecord>('users', null);
      const allStaff = users.filter((u: any) => ['staff', 'coordinator', 'incharge', 'teacher'].includes(String(u['role'])));
      
      let assignedStaff: any[] = [];
      let nodeType = '';
      if (config.resource === 'classGroups') {
        nodeType = 'classGroup';
        const assignedStaffIds = Array.isArray(row['assignedStaffIds']) ? row['assignedStaffIds'] : [];
        assignedStaff = allStaff.filter((s: any) => assignedStaffIds.includes(s.id));
      } else if (config.resource === 'classes') {
        nodeType = 'class';
        const assignedStaffIds = Array.isArray(row['assignedStaffIds']) ? row['assignedStaffIds'] : [];
        assignedStaff = allStaff.filter((s: any) => assignedStaffIds.includes(s.id));
      }
      
      const node = {
        id: row['id'] || row.id,
        title: row['name'] || 'Class Group',
        type: nodeType,
        parentClassId: row['classId'],
        parentCourseId: row['courseId'],
        parentMadrasaId: row['madrasaId'],
        assignedStaff
      };
      
      const assignedIds = new Set(assignedStaff.map(s => s.id));
      this.dialog.open(AcademicTreeAssignStaffDialogComponent, {
        width: '90vw',
        height: '90vh',
        maxWidth: '90vw',
        maxHeight: '90vh',
        panelClass: 'academic-tree-assign-dialog-panel',
        data: {
          mode: assignedStaff.length > 0 ? 'edit' : 'add',
          node,
          assignedStaff,
          availableStaff: allStaff.filter((s: any) => !assignedIds.has(s.id)),
          allStaff
        },
        autoFocus: false,
      });
    });
  }

  async migrateLegacyUsers(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Migrate Legacy Users`,
        message: `This will scan the "users" collection for legacy student, parent, and staff records. If they are missing from their dedicated collections, they will be created and linked. Proceed?`,
        confirmLabel: 'Run Migration',
      },
    }).afterClosed());

    if (!confirmed) return;

    await this.loader.withLoader('Migrating legacy users...', async () => {
      const profile = await firstValueFrom(this.auth.profile$);
      const allUsers = await this.repo.getAllOnce<EntityRecord>('users', profile);
      const allStudents = await this.repo.getAllOnce<EntityRecord>('students', profile);
      const allParents = await this.repo.getAllOnce<EntityRecord>('parents', profile);
      const allStaff = await this.repo.getAllOnce<EntityRecord>('staff', profile);

      let migratedCount = 0;

      for (const user of allUsers) {
        if (!user.id) continue;
        const role = String(user['role']);
        
        if (role === 'student') {
           const exists = allStudents.some(s => s['userId'] === user.id || s['uid'] === user.id || s.id === user['entityId']);
           if (!exists) {
              const studentId = await this.repo.create('students', {
                 ...user,
                 userId: user.id,
                 name: user['displayName'] || user['name'] || 'Legacy Student',
                 status: user['status'] || 'active',
              }, profile);
              await this.repo.update('users', user.id, { entityId: studentId, entityType: 'student' }, profile);
              migratedCount++;
           }
        }
        
        if (role === 'parent') {
           const exists = allParents.some(p => p['userId'] === user.id || p['uid'] === user.id || p.id === user['entityId']);
           if (!exists) {
              const parentId = await this.repo.create('parents', {
                 ...user,
                 userId: user.id,
                 name: user['displayName'] || user['name'] || 'Legacy Parent',
                 status: user['status'] || 'active',
              }, profile);
              await this.repo.update('users', user.id, { entityId: parentId, entityType: 'parent' }, profile);
              migratedCount++;
           }
        }
        
        if (['teacher', 'staff', 'coordinator', 'madrasaIncharge'].includes(role)) {
           const exists = allStaff.some(s => s['userId'] === user.id || s['uid'] === user.id || s.id === user['entityId']);
           if (!exists) {
              const staffId = await this.repo.create('staff', {
                 ...user,
                 userId: user.id,
                 name: user['displayName'] || user['name'] || 'Legacy Staff',
                 status: user['status'] || 'active',
              }, profile);
              await this.repo.update('users', user.id, { entityId: staffId, entityType: 'staff' }, profile);
              migratedCount++;
           }
        }
      }

      this.snackBar.open(`Migration complete. Created ${migratedCount} business records.`, 'Close', { duration: 5000 });
      this.pageIndex$.next(0); // Trigger refresh
    });
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
    const result = await firstValueFrom(this.dialog.open(PromoteDemoteDialogComponent, {
      data: { student: row },
      width: '620px',
    }).afterClosed());

    if (result?.success) {
      this.snackBar.open('Academic history updated.', 'Close', { duration: 4000 });
      // The dialog handles Firestore updates. 
      // The local table will refresh via the data stream.
    }
  }

  async openCourseStagesDialog(courseId?: string): Promise<void> {
    const result = await firstValueFrom(
      this.dialog.open(CourseStagesDialogComponent, {
        data: { courseId },
        width: '680px',
        maxWidth: '92vw'
      }).afterClosed()
    );

    if (result?.success) {
      this.pageIndex$.next(this.pageIndex$.value);
    }
  }

  async transfer(row: EntityRecord): Promise<void> {
    const result = await firstValueFrom(this.dialog.open(StudentTransferDialogComponent, {
      data: { student: row },
      width: '600px',
      maxWidth: '90vw'
    }).afterClosed());

    if (result?.success) {
      this.snackBar.open('Student transferred successfully.', 'Close', { duration: 4000 });
      // The snapshot listener will automatically refresh the list
    }
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
        saveFn: async (rawValue: Record<string, unknown>) => {
          const initialPassword = rawValue['password'] ? String(rawValue['password']).trim() : undefined;
          const profile = await firstValueFrom(this.auth.profile$);
          const payload = this.normalizePayload(config, rawValue, profile);

          if (config.resource === 'courses') {
            console.log('[Course Save Debug]', {
              organizationId: payload['organizationId'],
              madrasaId: payload['madrasaId'],
              name: payload['name'],
              code: payload['code'],
              courseType: payload['type'],
              stages: payload['stages'],
              levels: payload['levels'],
            });
          }

          if (initial?.id) {
            const processedPayload = { ...payload };

            if ('permissions' in payload) processedPayload['permissions'] = this.asStringArray(payload['permissions']);
            if ('madrasaIds' in payload) processedPayload['madrasaIds'] = this.asStringArray(payload['madrasaIds']);
            if ('linkedStudentIds' in payload) processedPayload['linkedStudentIds'] = this.asStringArray(payload['linkedStudentIds']);

            await this.repo.update(config.collection, initial.id, processedPayload, profile);

            // Sync coordinator/incharge into madrasa documents when madrasaIds changes
            const userRole = String(initial['role'] || processedPayload['role'] || '');
            const updatedMadrasaIds = this.asStringArray(processedPayload['madrasaIds'] || initial['madrasaIds'] || []);
            const userUid = String(initial['uid'] || initial.id || '');
            if (['coordinator', 'madrasaIncharge'].includes(userRole) && updatedMadrasaIds.length > 0 && userUid) {
              await this.syncUserToMadrasas(userUid, userRole, updatedMadrasaIds, profile);
            }

            // If we are editing a user document and it has an associated business entity, update that entity
            if (config.collection === 'users' && initial['entityId'] && initial['entityType']) {
              const entityCollection = initial['entityType'] === 'student' ? 'students' : 
                                       initial['entityType'] === 'parent' ? 'parents' : 'staff';
              const entityPayload: Partial<EntityRecord> = {};
              if ('permissions' in processedPayload) entityPayload['permissions'] = processedPayload['permissions'];
              if ('madrasaId' in processedPayload) entityPayload['madrasaId'] = processedPayload['madrasaId'];
              if ('madrasaIds' in processedPayload) entityPayload['madrasaIds'] = processedPayload['madrasaIds'];
              if ('linkedStudentIds' in processedPayload) entityPayload['linkedStudentIds'] = processedPayload['linkedStudentIds'];
              if ('organizationId' in processedPayload) entityPayload['organizationId'] = processedPayload['organizationId'];
              
              if (Object.keys(entityPayload).length > 0) {
                 await this.repo.update(entityCollection, String(initial['entityId']), entityPayload, profile);
              }
            }

            if (initial['userId']) {
              const userPayload: Partial<EntityRecord> = {};
              if ('permissions' in processedPayload) userPayload['permissions'] = processedPayload['permissions'];
              if ('madrasaId' in processedPayload) userPayload['madrasaId'] = processedPayload['madrasaId'];
              if ('madrasaIds' in processedPayload) userPayload['madrasaIds'] = processedPayload['madrasaIds'];
              if ('linkedStudentIds' in processedPayload) userPayload['linkedStudentIds'] = processedPayload['linkedStudentIds'];
              if ('organizationId' in processedPayload) userPayload['organizationId'] = processedPayload['organizationId'];
              if ('phone' in processedPayload) userPayload['phone'] = processedPayload['phone'];
              if ('mobileNumber' in processedPayload) userPayload['mobileNumber'] = processedPayload['mobileNumber'];
              if ('gender' in processedPayload) userPayload['gender'] = processedPayload['gender'];

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
          } else {
            if (config.specialCreate === 'student') {
              await this.createStudent(payload, profile);
            } else if (config.specialCreate === 'userAccess') {
              await this.createUserAccess(payload, config.fixedRole, profile, initialPassword);
            } else if (config.specialCreate === 'staffAccess') {
              await this.createStaffAccess(payload, profile, initialPassword);
            } else if (config.specialCreate === 'organization') {
              await this.createOrganization(payload, profile);
            } else if (config.collection === 'classes') {
              await this.repo.create(config.collection, payload, profile);
            } else {
              await this.repo.create(config.collection, payload, profile);
            }
          }
        }
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

    // Success message since saveFn was successful
    if (!config.specialCreate) {
      const loaderMessage = initial?.id ? `Record updated.` : `Record created.`;
      this.snackBar.open(loaderMessage, 'Close', { duration: 3000 });
    }
  }

  /**
   * When a coordinator or incharge is created/updated, sync their UID into the
   * madrasa documents' coordinatorIds / inchargeIds arrays.
   */
  private async syncUserToMadrasas(uid: string, role: string, madrasaIds: string[], profile: AppUser | null): Promise<void> {
    if (!['coordinator', 'madrasaIncharge'].includes(role) || madrasaIds.length === 0) return;
    const field = role === 'coordinator' ? 'coordinatorIds' : 'inchargeIds';
    const allMadrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile);
    await Promise.all(
      madrasaIds.map(async (madrasaId) => {
        try {
          const madrasa = allMadrasas.find(m => m.id === madrasaId);
          if (!madrasa) return;
          const existing: string[] = Array.isArray(madrasa[field]) ? (madrasa[field] as string[]) : [];
          if (!existing.includes(uid)) {
            await this.repo.update('madrasas', madrasaId, { [field]: [...existing, uid] } as any, profile, true);
          }
        } catch (e) {
          console.warn(`[syncUserToMadrasas] Failed to update madrasa ${madrasaId}:`, e);
        }
      })
    );
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
        phone: String(payload['phone'] || ''),
        mobileNumber: String(payload['mobileNumber'] || ''),
        gender: String(payload['gender'] || ''),
      });

      const credential = {
        uid: result.data.uid,
        label: String(payload['displayName']),
        email: result.data.email,
        password,
        role
      };

      const staffId = await this.repo.create('staff', {
        ...payload,
        name: payload['displayName'],
        userId: credential.uid,
        role: role,
        roles: [role],
        organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
        madrasaId: this.asStringArray(payload['madrasaIds'])[0] || '',
        madrasaIds: this.asStringArray(payload['madrasaIds']),
      }, profile);

      await this.repo.update('users', credential.uid, { entityId: staffId, entityType: 'staff' }, profile);

      // Sync coordinator/incharge into madrasa documents
      await this.syncUserToMadrasas(
        credential.uid,
        role,
        this.asStringArray(payload['madrasaIds']),
        profile
      );

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
        phone: String(payload['phone'] || ''),
        mobileNumber: String(payload['mobileNumber'] || ''),
        gender: String(payload['gender'] || ''),
      });

      const credential = {
        uid: result.data.uid,
        label: String(payload['name']),
        email: result.data.email,
        password,
        role: 'teacher' as UserRole
      };

      const staffId = await this.repo.create('staff', {
        ...payload,
        userId: credential.uid,
        role: 'teacher',
        roles: ['teacher'],
        organizationId: String(payload['organizationId'] || profile?.organizationId || ''),
        madrasaId: this.asStringArray(payload['madrasaIds'])[0] || '',
        madrasaIds: this.asStringArray(payload['madrasaIds']),
      }, profile);

      await this.repo.update('users', credential.uid, { entityId: staffId, entityType: 'staff' }, profile);

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

    let formattedDob = '';
    const dobValue = payload['dateOfBirth'];
    if (dobValue instanceof Date) {
      formattedDob = dobValue.toISOString().split('T')[0];
    } else if (typeof dobValue === 'string') {
      formattedDob = dobValue;
    } else if (dobValue && (dobValue as any).toDate) {
      formattedDob = (dobValue as any).toDate().toISOString().split('T')[0];
    }

    const generated = this.credentialService.buildStudentCredentials(
      String(payload['name']),
      String(payload['fatherName']),
      madrasaId,
      formattedDob,
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
        status: payload.status ?? 'active',
      }, profile);

      await this.repo.update('parents', parentId, { linkedStudentIds: [studentId] }, profile);
      if (parentCredential.uid) {
        await this.repo.update('users', parentCredential.uid, {
          entityId: parentId,
          entityType: 'parent',
          linkedStudentIds: [studentId],
          linkedStudentUserIds: [studentCredential.uid],
          studentIds: [studentId],
          updatedAt: new Date(),
        }, profile);
      }
      if (studentCredential.uid) {
        await this.repo.update('users', studentCredential.uid, {
          entityId: studentId,
          entityType: 'student',
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

      const joinMethod = String(payload['joinType'] || 'new').toLowerCase();
      const isRejoin = joinMethod === 'rejoin';

      await this.repo.create('userLifecycleHistory', {
        userId: studentId,
        userName: studentCredential.label || 'Student',
        personType: 'student',
        lifecycleAction: isRejoin ? 'Rejoined' : 'Joined',
        actionType: isRejoin ? 'Rejoin' : 'Enrollment',
        reason: isRejoin ? 'Rejoined / Re-enrolled student account' : 'Newly enrolled student account',
        effectiveDate: new Date().toISOString(),
        effectiveDateMs: Date.now(),
        performedBy: profile?.displayName || profile?.email || 'System',
        organizationId: profile?.organizationId || '',
        madrasaId,
        status: 'active'
      }, profile).catch(e => console.warn('Failed to log student lifecycle join history', e));

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
      permissions: Object.entries(PERMISSION_LABELS)
        .filter(([value]) => value !== 'manageOrganizations')
        .map(([value, label]) => ({ label, value })),
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

    if (hasField('groupId') || hasField('groupIds')) {
      const classGroups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile);
      const groupOptions = classGroups.map(g => ({
        label: g['name'] as string,
        value: g.id as string,
        data: g,
        dependentOn: g['classId'] ? { field: 'classId', value: g['classId'] } : undefined
      }));
      if (hasField('groupId')) options['groupId'] = groupOptions;
      if (hasField('groupIds')) options['groupIds'] = groupOptions;
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

    if (hasField('assignedStaffIds')) {
      const staff = await this.repo.getAllOnce<EntityRecord>('staff', profile);
      if (hasField('assignedStaffIds')) options['assignedStaffIds'] = this.toOptions(staff, 'name');
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
        permissions: config.fixedRole ? this.rolePermissionsService.getPermissionsForRole(config.fixedRole) : [],
      };
    }

    if (config.resource === 'courses') {
      return {
        ...initial,
        stages: Array.isArray(initial['stages']) ? initial['stages'].join(', ') : String(initial['stages'] || ''),
        levels: Array.isArray(initial['levels']) ? initial['levels'].join(', ') : String(initial['levels'] || ''),
        passwordStatus: initial['mustChangePassword'] ? 'Temporary password pending' : 'Password changed',
      };
    }

    if (config.resource === 'courseTypes') {
      return {
        ...initial,
        defaultStages: Array.isArray(initial['defaultStages']) ? initial['defaultStages'].join(', ') : String(initial['defaultStages'] || ''),
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
      let stages = this.normalizeStages(payload['stages']);
      const courseType = String(payload['type'] || 'custom').toLowerCase();
      if (!stages || stages.length === 0) {
        stages = DEFAULT_STAGES_BY_COURSE_TYPE[courseType] || DEFAULT_STAGES_BY_COURSE_TYPE['custom'];
      }
      payload['stages'] = stages;
      payload['levels'] = this.splitList(String(payload['levels'] || ''));
      delete payload['stagesText'];
      delete payload['levelsText'];
    }

    if (config.resource === 'courseTypes') {
      payload['defaultStages'] = this.normalizeStages(payload['defaultStages']);
    }

    return payload;
  }

  private filterRows(config: ManagementConfig, rows: EntityRecord[]): EntityRecord[] {
    if (!config.fixedRole) {
      return rows;
    }

    if (config.fixedRole === 'student') {
      return rows.filter((row) => {
        const role = String(row['role'] || '').trim().toLowerCase();
        const entityType = String(row['entityType'] || '').trim().toLowerCase();
        if (['parent', 'teacher', 'staff', 'coordinator', 'madrasaincharge', 'organizationadmin', 'superadmin'].includes(role)) {
          return false;
        }
        return role === 'student' || entityType === 'student' || !role || !!row['fatherName'];
      });
    }

    if (config.fixedRole === 'teacher') {
      return rows.filter((row) => ['teacher', 'staff', 'coordinator', 'madrasaincharge', 'organizationadmin'].includes(String(row['role'] || '').trim().toLowerCase()));
    }

    if (config.fixedRole === 'parent') {
      return rows.filter((row) => {
        const role = String(row['role'] || '').trim().toLowerCase();
        const entityType = String(row['entityType'] || '').trim().toLowerCase();
        return role === 'parent' || entityType === 'parent';
      });
    }

    return rows.filter((row) => String(row['role'] || '').trim().toLowerCase() === String(config.fixedRole).trim().toLowerCase());
  }

  private decorateRows(config: ManagementConfig, rows: EntityRecord[]): EntityRecord[] {
    const decorated = rows.map((row) => ({
      ...row,
      stage: row['stage'] || row['level'] || row['stageOrLevel'] || '-',
      organizationName: row['organizationName'] || row['organizationId'] || '-',
      madrasaNames: Array.isArray(row['madrasaIds']) ? row['madrasaIds'].join(', ') : row['madrasaId'] || '-',
      courseName: row['courseName'] || row['courseId'] || '-',
      className: row['className'] || row['classId'] || '-',
      stagesDisplay: this.formatList(row['stages']),
      defaultStagesDisplay: this.formatList(row['defaultStages'] || row['stages']),
      levelsDisplay: this.formatList(row['levels']),
      studentNames:
        row['studentNames'] ||
        row['linkedStudentNames'] ||
        (Array.isArray(row['linkedStudentIds'])
          ? row['linkedStudentIds'].join(', ')
          : '-'),
      typeDisplay: this.formatCourseType(row['courseType'] || row['type']),
    }));

    if (config.resource === 'courses') {
      console.log('[Courses Page Data Debug]', {
        coursesCount: decorated.length,
        courses: (decorated as any[]).map(course => ({
          id: course.id,
          name: course['name'] || course['title'],
          code: course['code'],
          type: course['typeDisplay'],
          organizationId: course['organizationId'],
          organizationName: course['organizationName'],
          madrasaId: course['madrasaId'],
          madrasaName: course['madrasaNames'],
          stages: course['stages'],
          levels: course['levels'],
          status: course['status'],
          createdAt: course['createdAt'],
          updatedAt: course['updatedAt'],
        })),
      });
    }

    return decorated;
  }

  private toOptions(rows: EntityRecord[], labelKey: string): SelectOption[] {
    return rows.map((row) => ({
      label: String(row[labelKey] || row['displayName'] || row['email'] || row.id),
      value: String(row.id || row['uid'] || row['email']),
      data: row
    }));
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : value ? [String(value)] : [];
  }

  private splitList(value: string): string[] {
    return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
  }

  formatCourseType(val: any): string {
    if (!val) return 'Maktab';
    const s = String(val).trim();
    if (s === 'maktab') return 'Maktab';
    if (s === 'aalim') return 'Aalim';
    if (s === 'hifz') return 'Hifz';
    if (s === 'muballigh') return 'Muballigh';
    if (s === 'custom') return 'Custom';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private normalizeStages(value: any): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  formatList(value: any): string {
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : '-';
    }
    if (typeof value === 'string') {
      return value.trim() || '-';
    }
    return '-';
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

  onPageChange(event: PageEvent) {
    this.pageIndex$.next(event.pageIndex);
    this.pageSize$.next(event.pageSize);
  }
}
