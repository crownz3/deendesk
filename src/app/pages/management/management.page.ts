import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap, Subject, BehaviorSubject, take, tap, scan, debounceTime, distinctUntilChanged } from 'rxjs';
import { CollectionReference, DocumentData, collection, getFirestore, query, where, QueryConstraint, getDocs, limit, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from '../../core/services/firebase-app';
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
import { StaffManagementDataService } from './services/staff-management-data.service';
import { StudentManagementDataService } from './services/student-management-data.service';
import { ParentManagementDataService } from './services/parent-management-data.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { QuickAddDialogComponent, QuickAddResult } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { UserDetailsDialogComponent } from '../../shared/components/user-details-dialog/user-details-dialog.component';
import { StudentProgressTrackerDialogComponent } from '../../shared/components/student-progress-tracker-dialog/student-progress-tracker-dialog.component';
import { CourseDetailsDialogComponent } from './course-details-dialog/course-details-dialog.component';
import { CourseMadrasasDialogComponent } from './course-madrasas-dialog/course-madrasas-dialog.component';
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
import { AcademicTreeStudentsDialogComponent } from '../tree-view/academic-tree-students-dialog.component';

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

export function extractId(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') return String(val.id || val.uid || val.docId || val._id || '').trim();
  return String(val).trim();
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
  classGroups?: EntityRecord[];
  organizations?: EntityRecord[];
  shifts?: EntityRecord[];
  availableShifts?: string[];
}

const baseStatusField: QuickAddField = {
  key: 'status',
  label: 'Status',
  type: 'select',
  options: [
    { label: 'Active', value: 'active' },
    { label: 'Pending', value: 'pending' },
    { label: 'Inactive', value: 'inactive' },
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
      { key: 'academicSettings_defaultDawrRounds', label: 'Required Dawr Revision Cycles (for Sanad)', type: 'number' },
      baseStatusField,
    ],
    specialCreate: 'organization',
  },
  madrasas: {
    resource: 'madrasas',
    title: 'Madrasas',
    subtitle: 'Map madrasas to organizations, coordinators, incharges, and course types.',
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
      { key: 'courseType', label: 'Course Type', type: 'select', options: [
        { label: 'Maktab (Academic)', value: 'maktab' },
        { label: 'Hifz (Quran Memorization)', value: 'hifz' },
        { label: 'Both (Maktab & Hifz)', value: 'both' },
      ] },
      { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' },
      { key: 'coordinatorIds', label: 'Coordinators', type: 'idRef', referenceType: 'coordinator' },
      { key: 'inchargeIds', label: 'Incharges', type: 'idRef', referenceType: 'incharge' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'name', label: 'Madrasa name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'courseType', label: 'Course Type', type: 'select', required: true, options: [
        { label: 'Maktab (Academic)', value: 'maktab' },
        { label: 'Hifz (Quran Memorization)', value: 'hifz' },
        { label: 'Both (Maktab & Hifz)', value: 'both' },
      ] },
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
      { key: 'roles', label: 'Role', type: 'role' },
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
      { key: 'roles', label: 'Other Roles', type: 'role' },
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
      { key: 'roles', label: 'Other Roles', type: 'role' },
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
      { key: 'displayName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'gender', label: 'Gender' },
      { key: 'roles', label: 'Other Roles', type: 'role' },
      { key: 'assignedClassGroup', label: 'Assigned Class Group' },
      { key: 'studentCount', label: 'Assigned Students', type: 'studentCount' },
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
      { key: 'groupStaff', label: 'Assigned Staff', type: 'staffChips' },
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
      { key: 'createStudentLogin', label: 'Create Login for Student?', type: 'boolean' },
      { key: 'createParentLogin', label: 'Create Login for Parent?', type: 'boolean' },
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
      { key: 'code', label: 'Code' },
      { key: 'typeDisplay', label: 'Course Type' },
      { key: 'stagesDisplay', label: 'Stages', type: 'stageChips' },
      { key: 'madrasaCount', label: 'Madrasas', type: 'madrasaCount' },
      { key: 'classCount', label: 'Classes', type: 'classCount' },
      { key: 'groupCount', label: 'Class Groups', type: 'groupCount' },
      { key: 'studentCount', label: 'Students', type: 'studentCount' },
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
          { label: 'Muallim', value: 'muallim' },
          { label: 'Custom', value: 'custom' },
        ]
      },
      {
        key: 'courseDurationYears', label: 'Course Duration (Years)', type: 'select', options: [
          { label: '1 Year', value: 1 as any },
          { label: '2 Years', value: 2 as any },
          { label: '3 Years', value: 3 as any },
          { label: '4 Years', value: 4 as any },
          { label: '5 Years', value: 5 as any },
          { label: '6 Years', value: 6 as any },
          { label: '7 Years', value: 7 as any },
          { label: '8 Years', value: 8 as any },
          { label: '9 Years', value: 9 as any },
          { label: '10 Years', value: 10 as any },
        ]
      },
      {
        key: 'promotionRule', label: 'Promotion Exam Rule', type: 'select', options: [
          { label: 'Mandatory Exam Pass', value: 'exam_mandatory' },
          { label: 'Optional Exam / Manual Teacher Override', value: 'exam_optional_manual' },
          { label: 'Daur Count Completion', value: 'daur_count_required' },
        ]
      },
      {
        key: 'requiredDaurCount', label: 'Required Daur Count', type: 'text', placeholder: 'Enter required Daur count (e.g. 1, 2, 3, 5...)'
      },
      {
        key: 'evaluationMode', label: 'Daily Evaluation Mode', type: 'select', options: [
          { label: 'Portion-Based (Sabaq / Sabqi / Manzil / Daur)', value: 'portion_based' },
          { label: 'Subject-Based (Kitabs / Books)', value: 'subject_based' },
          { label: 'Hybrid (Both Portion & Subject Evaluation)', value: 'hybrid' },
        ]
      },
      {
        key: 'hasSubjects', label: 'Subject Scoping (Does this course have multiple subjects?)', type: 'select', options: [
          { label: 'Yes - Has Multiple Subjects (Requires Subject selection in Class Plans)', value: true as any },
          { label: 'No - Single Subject / General Course', value: false as any }
        ]
      },
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
    emptyTitle: 'No classes found',
    emptyText: 'Create classes to organize students within specific courses and stages.',
    emptyButton: 'Add Class',
    emptyIcon: 'easel-outline',
    columns: [
      { key: 'name', label: 'Class' },
      { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' },
      { key: 'groupStaff', label: 'Staff', type: 'staffChips' },
      { key: 'studentCount', label: 'Students', type: 'studentCount' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', required: true, quickAddResource: 'courses' },
      { key: 'name', label: 'Class name', type: 'text', required: true },
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
      { key: 'shiftName', label: 'Shift / Session' },
      { key: 'assignedStaffIds', label: 'Assigned Staff', type: 'idRef', referenceType: 'staff' },
      { key: 'studentCount', label: 'Students', type: 'studentCount' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', quickAddResource: 'courses' },
      { key: 'classId', label: 'Class', type: 'select', required: true, quickAddResource: 'classes' },
      { key: 'shiftId', label: 'Shift / Session', type: 'select' },
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
      { key: 'assignedStaffIds', label: 'Assigned Teachers', type: 'idRef', referenceType: 'staff' },
      { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'organizationId', label: 'Organization', type: 'select', required: true, quickAddResource: 'organizations' },
      { key: 'madrasaId', label: 'Madrasa', type: 'select', required: true, quickAddResource: 'madrasas' },
      { key: 'courseId', label: 'Course', type: 'select', quickAddResource: 'courses' },
      { key: 'classId', label: 'Class', type: 'select', quickAddResource: 'classes' },
      { key: 'name', label: 'Subject name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'assignedStaffIds', label: 'Assigned Staff / Teachers', type: 'multiselect', quickAddResource: 'staff' },
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
    tap(() => {
      this.repo.clearCache();
      this.assignmentFilter$.next('all');
      this.shiftFilter$.next('all');
    })
  );

  orgSearch = '';
  madrasaSearch = '';
  courseSearch = '';
  classSearch = '';
  classGroupSearch = '';

  getFilteredOrganizations(orgs: EntityRecord[]): EntityRecord[] {
    if (!orgs || !this.orgSearch) return orgs;
    const q = this.orgSearch.toLowerCase();
    return orgs.filter(o => String(o['name'] || '').toLowerCase().includes(q));
  }

  getFilteredMadrasas(madrasas: EntityRecord[]): EntityRecord[] {
    if (!madrasas) return [];
    const uniqueMap = new Map<string, EntityRecord>();
    madrasas.forEach(m => {
      const nameKey = String(m['name'] || m['title'] || '').trim().toLowerCase();
      const key = nameKey || m.id;
      if (key && !uniqueMap.has(key)) uniqueMap.set(key, m);
    });
    const list = Array.from(uniqueMap.values());
    if (!this.madrasaSearch) return list;
    const q = this.madrasaSearch.toLowerCase();
    return list.filter(m => String(m['name'] || m['title'] || '').toLowerCase().includes(q));
  }

  getFilteredCourses(courses: EntityRecord[]): EntityRecord[] {
    if (!courses) return [];
    const uniqueMap = new Map<string, EntityRecord>();
    courses.forEach(c => {
      const nameKey = String(c['name'] || c['title'] || '').trim().toLowerCase();
      const key = nameKey || c.id;
      if (key && !uniqueMap.has(key)) uniqueMap.set(key, c);
    });
    const list = Array.from(uniqueMap.values());
    if (!this.courseSearch) return list;
    const q = this.courseSearch.toLowerCase();
    return list.filter(c => String(c['name'] || c['title'] || '').toLowerCase().includes(q));
  }

  getFilteredClasses(classes: EntityRecord[]): EntityRecord[] {
    if (!classes) return [];
    const uniqueMap = new Map<string, EntityRecord>();
    classes.forEach(c => {
      const nameKey = String(c['name'] || c['title'] || '').trim().toLowerCase();
      const key = nameKey || c.id;
      if (key && !uniqueMap.has(key)) uniqueMap.set(key, c);
    });
    const list = Array.from(uniqueMap.values());
    if (!this.classSearch) return list;
    const q = this.classSearch.toLowerCase();
    return list.filter(c => String(c['name'] || c['title'] || '').toLowerCase().includes(q));
  }

  getFilteredClassGroups(groups: EntityRecord[]): EntityRecord[] {
    if (!groups) return [];
    const uniqueMap = new Map<string, EntityRecord>();
    groups.forEach(g => {
      const nameKey = String(g['name'] || g['title'] || '').trim().toLowerCase();
      const key = nameKey || g.id;
      if (key && !uniqueMap.has(key)) uniqueMap.set(key, g);
    });
    const list = Array.from(uniqueMap.values());
    if (!this.classGroupSearch) return list;
    const q = this.classGroupSearch.toLowerCase();
    return list.filter(g => String(g['name'] || g['title'] || '').toLowerCase().includes(q));
  }

  readonly madrasaFilter$ = new BehaviorSubject<string>('all');
  readonly roleFilter$ = new BehaviorSubject<string>('all');
  readonly roleOptions$: Observable<SelectOption[]> = this.auth.profile$.pipe(
    switchMap(profile => this.rolePermissionsService.getAllRoleOptions(profile?.role))
  );
  readonly organizationFilter$ = new BehaviorSubject<string>('all');
  
  readonly courseFilter$ = new BehaviorSubject<string>('all');
  readonly classFilter$ = new BehaviorSubject<string>('all');
  readonly classGroupFilter$ = new BehaviorSubject<string>('all');
  readonly stageFilter$ = new BehaviorSubject<string>('all');
  readonly statusFilter$ = new BehaviorSubject<string>('active');
  readonly genderFilter$ = new BehaviorSubject<string>('all');
  readonly assignmentFilter$ = new BehaviorSubject<string>('all');
  readonly shiftFilter$ = new BehaviorSubject<string>('all');

  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly debouncedSearchQuery$ = this.searchQuery$.pipe(
    debounceTime(600),
    map(s => s ? s.trim() : ''),
    distinctUntilChanged(),
    tap(() => this.pageIndex$.next(0))
  );

  triggerSearchImmediately() {
    const val = this.searchQuery$.value;
    this.searchQuery$.next(val);
  }
  readonly pageIndex$ = new BehaviorSubject<number>(0);
  readonly pageSize$ = new BehaviorSubject<number>(10);

  readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly vm$ = combineLatest([
    this.refresh$,
    this.config$,
    this.auth.profile$,
    this.madrasaFilter$,
    this.roleFilter$,
    this.organizationFilter$,
    this.debouncedSearchQuery$,
    this.genderFilter$,
    this.pageIndex$,
    this.pageSize$,
    combineLatest([this.courseFilter$, this.classFilter$, this.classGroupFilter$, this.stageFilter$, this.statusFilter$, this.assignmentFilter$, this.shiftFilter$])
  ]).pipe(
    // Micro-debounce: batch rapid filter changes (e.g. dropdown selects) into a single vm$ evaluation.
    // Without this, selecting a madrasa could fire multiple switchMap cycles in quick succession
    // because combineLatest emits once per source change.
    debounceTime(50),
    switchMap(([_, config, profile, madrasaFilter, roleFilter, organizationFilter, searchQuery, genderFilter, pageIndex, pageSize, [courseFilter, classFilter, classGroupFilter, stageFilter, statusFilter, assignmentFilter, shiftFilter]]) => {
      if (!profile) {
        return of({
          loading: true,
        } as PageState<ManagementVm>);
      }
      const studentExtraConstraints: QueryConstraint[] = [];

      // Determine which secondary collections are actually needed for this resource
      // to avoid opening unnecessary Firestore listeners. repo.list() caches streams via
      // streamCache so they are reused for free on subsequent visits.
      const needsStudents = ['students', 'classes', 'classGroups', 'courses',
        'staff', 'incharges', 'coordinators', 'users'].includes(config.resource);
      const needsShifts   = config.resource === 'classGroups';
      const needsOrgs     = profile?.role === 'superAdmin';

      const students$ = needsStudents
        ? this.repo.list<EntityRecord>('students', profile, studentExtraConstraints).pipe(catchError(() => of([])))
        : of([] as EntityRecord[]);

      const shifts$ = needsShifts
        ? this.repo.list<EntityRecord>('shifts', profile).pipe(catchError(() => of([])))
        : of([] as EntityRecord[]);

      const organizations$ = needsOrgs
        ? this.repo.list<EntityRecord>('organizations', profile).pipe(catchError(() => of([])))
        : of([] as EntityRecord[]);

      return combineLatest([
        this.rowsForConfig(config, profile, madrasaFilter, roleFilter),
        this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('courses', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([]))),
        students$,
        this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('users', profile, studentExtraConstraints, { roles: ['student', 'teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin'] }).pipe(catchError(() => of([]))),
        organizations$,
        shifts$,
      ]).pipe(
        map(([rows, madrasas, courses, classes, students, classGroups, staffRows, usersRows, organizations, shifts]) => {
            const allStaffRows = [...staffRows, ...usersRows];
            let filteredRows = this.decorateRows(config, this.filterRows(config, rows));
            let displayMadrasas = madrasas;
            const _isOrgAdmin = profile?.role === 'organizationAdmin' || profile?.role === 'superAdmin';
            let displayClasses = _isOrgAdmin ? classes : this.getScopedClasses(classes, classGroups, profile, madrasas);
            let displayClassGroups = _isOrgAdmin ? classGroups : this.getScopedClassGroups(classGroups, classes, profile, madrasas);

            const studentUserRows = usersRows.filter(u => {
              const r = String(u['role'] || '').toLowerCase();
              const rs = Array.isArray(u['roles']) ? u['roles'].map(x => String(x).toLowerCase()) : [];
              return r === 'student' || rs.includes('student');
            });

            const allStudentsMap = new Map<string, EntityRecord>();
            (students || []).forEach(s => {
              const ids = [
                extractId(s.id),
                extractId(s['uid']),
                extractId(s['userId']),
                extractId(s['studentId'])
              ].filter(Boolean);

              ids.forEach(id => {
                if (!allStudentsMap.has(id)) {
                  allStudentsMap.set(id, s);
                }
              });
            });

            studentUserRows.forEach(u => {
              const ids = [
                extractId(u.id),
                extractId(u['uid']),
                extractId(u['userId']),
                extractId(u['studentId'])
              ].filter(Boolean);

              const existingKey = ids.find(id => allStudentsMap.has(id));
              if (existingKey) {
                const s = allStudentsMap.get(existingKey)!;
                const merged: EntityRecord = {
                  ...u,
                  ...s,
                  displayName: s['displayName'] || s['name'] || u['displayName'] || u['name'] || '',
                  name: s['name'] || s['displayName'] || u['name'] || u['displayName'] || '',
                  email: s['email'] || u['email'] || '',
                  groupId: s['groupId'] || s['classGroupId'] || u['groupId'] || u['classGroupId'] || '',
                  classGroupId: s['classGroupId'] || s['groupId'] || u['classGroupId'] || u['groupId'] || '',
                  classId: s['classId'] || u['classId'] || '',
                  courseId: s['courseId'] || u['courseId'] || '',
                  madrasaId: s['madrasaId'] || u['madrasaId'] || '',
                  organizationId: s['organizationId'] || u['organizationId'] || '',
                };
                ids.forEach(id => allStudentsMap.set(id, merged));
              } else {
                const newKey = ids[0];
                if (newKey) {
                  allStudentsMap.set(newKey, u);
                }
              }
            });

            const uniqueStudentInstances = Array.from(new Set(allStudentsMap.values()));
            const allActiveStudents: EntityRecord[] = uniqueStudentInstances.map(s => {
              let updated = { ...s };
              if (!updated['madrasaId'] || !updated['organizationId']) {
                const sGId = extractId(updated['groupId'] || updated['classGroupId']);
                const gDoc = classGroups.find(g => extractId(g.id) === sGId);
                const sCId = extractId(updated['classId']);
                const clsDoc = classes.find(c => extractId(c.id) === sCId);
                const sMId = extractId(updated['madrasaId']) || extractId(gDoc?.['madrasaId']) || extractId(clsDoc?.['madrasaId']);
                const mDoc = madrasas.find(m => extractId(m.id) === sMId);

                if (!updated['madrasaId'] && sMId) {
                  updated['madrasaId'] = sMId;
                }
                if (!updated['organizationId']) {
                  updated['organizationId'] = mDoc?.['organizationId'] || gDoc?.['organizationId'] || clsDoc?.['organizationId'] || '';
                }
              }
              return updated;
            }).filter(s => {
              const status = String(s['status'] || s['state'] || '').toLowerCase();
              return !['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(status);
            });

            const groupDistribution: Record<string, number> = {};
            allActiveStudents.forEach(st => {
              const gId = extractId(st['groupId'] || st['classGroupId']) || 'NO_GROUP';
              groupDistribution[gId] = (groupDistribution[gId] || 0) + 1;
            });

            const getStudentGroupTokens = (s: EntityRecord): Set<string> => {
              const tokens = new Set<string>();
              const add = (val: unknown) => {
                if (Array.isArray(val)) {
                  val.forEach(v => { const id = extractId(v); if (id) tokens.add(id); });
                } else {
                  const id = extractId(val); if (id) tokens.add(id);
                }
              };
              add(s['groupId']);
              add(s['classGroupId']);
              add(s['assignedGroupId']);
              add(s['group']);
              add(s['sectionId']);
              add(s['section']);
              add(s['groupIds']);
              add(s['classGroupIds']);
              add(s['assignedGroupIds']);
              add(s['groups']);
              add(s['sections']);
              return tokens;
            };

           // For non-admin users, include courses linked to their madrasa, master courses, or courses referenced by students
           const _myMadrasaId = (profile as any)?.madrasaId || (profile as any)?.primaryMadrasaId || '';
           const studentCourseIds = new Set(students.map(s => String(s['courseId'] || '')).filter(Boolean));

           let displayCourses = (_isOrgAdmin || !_myMadrasaId)
             ? courses
             : courses.filter(c =>
                 !c['madrasaId'] ||
                 c['madrasaId'] === _myMadrasaId ||
                 (Array.isArray(c['madrasaIds']) && c['madrasaIds'].includes(_myMadrasaId)) ||
                 studentCourseIds.has(String(c.id))
               );

           if (profile?.role === 'superAdmin' && organizationFilter !== 'all') {
             filteredRows = filteredRows.filter(r => r['organizationId'] === organizationFilter);
             displayMadrasas = madrasas.filter(m => m['organizationId'] === organizationFilter);
             displayCourses = courses.filter(c => c['organizationId'] === organizationFilter);
             displayClasses = displayClasses.filter(c => c['organizationId'] === organizationFilter);
           }

           // Deduplicate displayCourses by unique course ID so no courses are lost due to matching names/codes
           const courseMap = new Map<string, EntityRecord>();
           displayCourses.forEach(c => {
             const key = String(c.id || c['uid'] || c['docId'] || c['name']);
             if (key && !courseMap.has(key)) {
               courseMap.set(key, c);
             }
           });
           displayCourses = Array.from(courseMap.values());
            
            let availableShifts: string[] = [];

            if (config.resource === 'classGroups') {
              filteredRows = this.getScopedClassGroups(filteredRows, classes, profile, madrasas);
              const shiftMap = new Map<string, string>();
              shifts.forEach(s => {
                if (s.id && s['name']) shiftMap.set(String(s.id), String(s['name']));
              });

              // Pre-build group→studentCount map in O(N) instead of O(N×M) per-row scan.
              // Two passes: first count by student's groupId field, then add students from
              // the group's explicit assignedStudentIds roster that aren't already counted.
              const groupStudentCountMap = new Map<string, number>();
              allActiveStudents.forEach(st => {
                const gId = extractId(st['groupId'] || st['classGroupId'] || st['assignedGroupId'] || st['group'] || st['sectionId'] || st['section']) || '';
                if (gId) groupStudentCountMap.set(gId, (groupStudentCountMap.get(gId) || 0) + 1);
                // Also count against all groupIds array
                const extraGIds: string[] = [
                  ...(Array.isArray(st['groupIds']) ? (st['groupIds'] as any[]).map(extractId) : []),
                  ...(Array.isArray(st['classGroupIds']) ? (st['classGroupIds'] as any[]).map(extractId) : [])
                ].filter(Boolean);
                extraGIds.forEach(gid => {
                  if (gid && gid !== gId) groupStudentCountMap.set(gid, (groupStudentCountMap.get(gid) || 0) + 1);
                });
              });

              // Track student identities already counted to avoid double-counting from roster
              const studentIdentitySet = new Set<string>();
              allActiveStudents.forEach(st => {
                [st.id, st['uid'], st['userId'], st['entityId'], st['docId'], st['studentId'], st['email']]
                  .filter(Boolean).forEach(v => studentIdentitySet.add(String(v).toLowerCase().trim()));
              });

              // Second pass: add roster-only students from each group doc
              filteredRows.forEach(group => {
                const gIdStr = extractId(group.id);
                if (!gIdStr) return;
                const roster: string[] = [
                  ...this.extractAllStrings(group['assignedStudentIds']),
                  ...this.extractAllStrings(group['assignedStudents']),
                  ...this.extractAllStrings(group['studentIds']),
                  ...this.extractAllStrings(group['students']),
                  ...this.extractAllStrings(group['assignedStudentId']),
                  ...this.extractAllStrings(group['studentId'])
                ].map(v => String(v).toLowerCase().trim()).filter(Boolean);
                roster.forEach(id => {
                  if (!studentIdentitySet.has(id)) {
                    // This roster ID isn't in allActiveStudents by field — count it additionally
                    groupStudentCountMap.set(gIdStr, (groupStudentCountMap.get(gIdStr) || 0) + 1);
                    studentIdentitySet.add(id); // prevent double-counting for same group
                  }
                });
              });

              const availableShiftSet = new Set<string>();
              shifts.forEach(s => {
                const sName = String(s['name'] || '').trim();
                if (sName) availableShiftSet.add(sName);
              });

              filteredRows = filteredRows.map(group => {
                const gIdStr = extractId(group.id);
                const sId = String(group['shiftId'] || group['shift'] || '');
                const sName = shiftMap.get(sId) || group['shiftName'] || group['shift'] || group['shiftId'] || '-';
                if (sName && sName !== '-') availableShiftSet.add(sName);
                return { ...group, studentCount: groupStudentCountMap.get(gIdStr) ?? 0, shiftName: sName };
              });
              availableShifts = Array.from(availableShiftSet).sort((a, b) => a.localeCompare(b));
            }

            if (config.resource === 'classes') {
              filteredRows = this.getScopedClasses(filteredRows, classGroups, profile, madrasas);

              // Pre-build class→studentCount map in O(N) instead of O(N×M) per-row scan.
              const classStudentCountMap = new Map<string, number>();
              allActiveStudents.forEach(st => {
                const cId = extractId(st['classId'] || st['class'] || st['assignedClassId']) || '';
                if (cId) classStudentCountMap.set(cId, (classStudentCountMap.get(cId) || 0) + 1);
                const extraCIds: string[] = Array.isArray(st['classIds'])
                  ? (st['classIds'] as any[]).map(extractId).filter(Boolean) : [];
                extraCIds.forEach(cid => {
                  if (cid && cid !== cId) classStudentCountMap.set(cid, (classStudentCountMap.get(cid) || 0) + 1);
                });
              });

              filteredRows = filteredRows.map(cls => {
                const clsIdStr = extractId(cls.id);
                return { ...cls, studentCount: classStudentCountMap.get(clsIdStr) ?? 0 };
              });
              filteredRows = this.withClassGroupStaff(filteredRows, classGroups, allStaffRows);
            }

            if (config.resource === 'courses') {
              filteredRows = filteredRows.map(course => {
                const courseIdStr = extractId(course.id);
                const courseCodeStr = String(course['code'] || '').toLowerCase();
                const courseNameStr = String(course['name'] || '').toLowerCase();

                // Find classes linked to this course
                const matchingClasses = classes.filter(cls => {
                  const cId = extractId(cls['courseId'] || cls['course']);
                  const cCode = String(cls['courseCode'] || '').toLowerCase();
                  const cName = String(cls['courseName'] || '').toLowerCase();

                  return (cId && cId === courseIdStr) ||
                         (courseCodeStr && cCode && cCode === courseCodeStr) ||
                         (courseNameStr && cName && cName === courseNameStr);
                });

                // Find classGroups linked to these classes or directly to this course
                const classIds = new Set(matchingClasses.map(c => extractId(c.id)));
                const matchingGroups = classGroups.filter(grp => {
                  const gCourseId = extractId(grp['courseId'] || grp['course']);
                  const gClassId = extractId(grp['classId'] || grp['class']);
                  return (gCourseId && gCourseId === courseIdStr) || (gClassId && classIds.has(gClassId));
                });

                // Calculate total active students in this course
                const totalStudents = students.filter(s => {
                  if (s['status'] === 'inactive') return false;
                  const sCourseId = extractId(s['courseId'] || s['course']);
                  const sClassId = extractId(s['classId'] || s['class']);
                  return (sCourseId && sCourseId === courseIdStr) || (sClassId && classIds.has(sClassId));
                }).length;

                // Collect ALL madrasas associated with this course
                let mIds: string[] = [];
                const directMId = extractId(course['madrasaId']);
                if (directMId) mIds.push(directMId);

                if (Array.isArray(course['madrasaIds'])) {
                  course['madrasaIds'].forEach(m => {
                    const id = extractId(m);
                    if (id && !mIds.includes(id)) mIds.push(id);
                  });
                }
                matchingClasses.forEach(cls => {
                  const id = extractId(cls['madrasaId']);
                  if (id && !mIds.includes(id)) mIds.push(id);
                });
                matchingGroups.forEach(grp => {
                  const id = extractId(grp['madrasaId']);
                  if (id && !mIds.includes(id)) mIds.push(id);
                });

                const mNames = mIds.map(mId => {
                  const mDoc = madrasas.find(m => extractId(m.id) === mId);
                  return mDoc ? String(mDoc['name'] || mDoc['title'] || mId) : mId;
                });

                return {
                  ...course,
                  classCount: matchingClasses.length,
                  groupCount: matchingGroups.length,
                  madrasaCount: mNames.length,
                  madrasaNames: mNames,
                  studentCount: totalStudents
                };
              });
            }

            // Enrich 'users', 'incharges', 'coordinators', 'staff' rows with effective roles derived from madrasa membership.
            // A person may have role='teacher' in their user doc but also appear in a madrasa's inchargeIds or coordinatorIds.
             if (['users', 'incharges', 'coordinators', 'staff'].includes(config.resource)) {
               // ── Pre-build inverted indexes ONCE outside the per-row loop ─────────────────
               // groupStaffIndex: groupId → Set of lowercase staff token strings
               const groupStaffIndex = new Map<string, Set<string>>();
               classGroups.forEach(g => {
                 const gId = extractId(g.id || g['docId']);
                 if (!gId) return;
                 const tokens = new Set<string>([
                   ...this.extractAllStrings(g['assignedStaffIds']),
                   ...this.extractAllStrings(g['assignedStaff']),
                   ...this.extractAllStrings(g['staffIds']),
                   ...this.extractAllStrings(g['teacherIds']),
                   ...this.extractAllStrings(g['teachers']),
                   ...this.extractAllStrings(g['staff']),
                   ...this.extractAllStrings(g['groupStaff'])
                 ].map(v => v.toLowerCase()));
                 groupStaffIndex.set(gId, tokens);
               });

               // staffTokenToGroupIds: staffToken → groupIds that this token belongs to
               const staffTokenToGroupIds = new Map<string, string[]>();
               groupStaffIndex.forEach((tokens, gId) => {
                 tokens.forEach(tok => {
                   if (!staffTokenToGroupIds.has(tok)) staffTokenToGroupIds.set(tok, []);
                   staffTokenToGroupIds.get(tok)!.push(gId);
                 });
               });

               // groupIdToDoc: groupId → group document for O(1) lookup
               const groupIdToDoc = new Map<string, EntityRecord>();
               classGroups.forEach(g => { const gId = extractId(g.id); if (gId) groupIdToDoc.set(gId, g); });

               // studentTeacherTokens: student → set of their teacher reference tokens (lowercase)
               const studentTeacherTokenMap = new Map<string, Set<string>>();
               allActiveStudents.forEach(st => {
                 const stKey = extractId(st.id || st['uid'] || st['userId']);
                 if (!stKey) return;
                 const toks = new Set<string>([
                   st['teacherId'], st['assignedStaffId'], st['staffId'], st['teacherUid'],
                   st['assignedTeacherId'], st['ustadhId'], st['teacher'], st['staff'], st['assignedStaff']
                 ].filter(Boolean).map(v => String(v).trim().toLowerCase()));
                 if (toks.size > 0) studentTeacherTokenMap.set(stKey, toks);
               });

               // groupStudentCountIndex: groupId → Set of student keys (O(1) size lookup)
               const groupStudentKeys = new Map<string, Set<string>>();
               allActiveStudents.forEach(st => {
                 const stKey = extractId(st.id || st['uid'] || st['userId']);
                 if (!stKey) return;
                 const gId = extractId(st['groupId'] || st['classGroupId'] || st['assignedGroupId'] || st['group'] || st['sectionId'] || st['section']) || '';
                 if (gId) {
                   if (!groupStudentKeys.has(gId)) groupStudentKeys.set(gId, new Set());
                   groupStudentKeys.get(gId)!.add(stKey);
                 }
                 const extraGIds: string[] = [
                   ...(Array.isArray(st['groupIds']) ? (st['groupIds'] as any[]).map(extractId) : []),
                   ...(Array.isArray(st['classGroupIds']) ? (st['classGroupIds'] as any[]).map(extractId) : [])
                 ].filter(Boolean);
                 extraGIds.forEach(egId => {
                   if (egId && egId !== gId) {
                     if (!groupStudentKeys.has(egId)) groupStudentKeys.set(egId, new Set());
                     groupStudentKeys.get(egId)!.add(stKey);
                   }
                 });
               });
               // ────────────────────────────────────────────────────────────────────────────

               filteredRows = filteredRows.map(row => {
                 const roles = this.getEffectiveRoles(row, madrasas);

                 const sTokens = [
                   row.id,
                   row['id'],
                   row['uid'],
                   row['userId'],
                   row['entityId'],
                   row['staffId'],
                   row['docId'],
                   row['email']
                 ].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);

                 const directGroupIds = [
                   row['groupId'],
                   row['classGroupId'],
                   row['assignedGroupId'],
                   ...(Array.isArray(row['groupIds']) ? row['groupIds'] : []),
                   ...(Array.isArray(row['classGroupIds']) ? row['classGroupIds'] : []),
                   ...(Array.isArray(row['assignedGroupIds']) ? row['assignedGroupIds'] : [])
                 ].map(v => extractId(v)).filter(Boolean);

                 // O(1) lookup per staff token instead of O(N×M) scan of all groups
                 const matchedGroupIds: string[] = [];
                 sTokens.forEach(tok => {
                   const gIds = staffTokenToGroupIds.get(tok);
                   if (gIds) matchedGroupIds.push(...gIds);
                 });

                 const assignedGroupIds = Array.from(new Set([...directGroupIds, ...matchedGroupIds]));

                 // Count students for this staff member using pre-built indexes
                 const staffStudentKeySet = new Set<string>();

                 assignedGroupIds.forEach(gId => {
                   // Add students matched by groupId field
                   const byGroupId = groupStudentKeys.get(gId);
                   if (byGroupId) byGroupId.forEach(k => staffStudentKeySet.add(k));
                   // Add students from the group's explicit roster
                   const grpDoc = groupIdToDoc.get(gId);
                   if (grpDoc) {
                     const roster = [
                       ...this.extractAllStrings(grpDoc['assignedStudentIds']),
                       ...this.extractAllStrings(grpDoc['assignedStudents']),
                       ...this.extractAllStrings(grpDoc['studentIds']),
                       ...this.extractAllStrings(grpDoc['students'])
                     ].map(v => String(v).toLowerCase().trim()).filter(Boolean);
                     roster.forEach(id => staffStudentKeySet.add(id));
                   }
                 });

                 // Also find students that directly reference this staff member
                 studentTeacherTokenMap.forEach((toks, stKey) => {
                   if (sTokens.some(tok => toks.has(tok))) staffStudentKeySet.add(stKey);
                 });

                 const isPureStudent = row['role'] === 'student' || (roles.includes('student') && !roles.some(r => ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin'].includes(r)));
                 const count = isPureStudent ? undefined : staffStudentKeySet.size;
                 return { ...row, roles, studentCount: count };
               });
             }

             // Resource-level role filtering using effective roles:
             // e.g. 'incharges' page shows anyone holding 'madrasaIncharge' role (primary, secondary, or derived from madrasa doc)
             // 'coordinators' page shows anyone holding 'coordinator' role
             if (['incharges', 'coordinators', 'staff', 'students', 'parents'].includes(config.resource)) {
               const reqRoles = this.rolesForResource(config.resource);
               if (reqRoles && reqRoles.length > 0) {
                 filteredRows = filteredRows.filter(r => {
                   const userRoles = this.getEffectiveRoles(r, madrasas);
                   return reqRoles.some(req => userRoles.includes(req));
                 });
               }
             }

            if (config.resource === 'students' && profile && ['teacher', 'staff', 'ustadh', 'teacher_assistant'].includes(String(profile.role).toLowerCase()) && !['superadmin', 'organizationadmin', 'super_admin', 'orgadmin', 'madrasaincharge', 'coordinator'].includes(String(profile.role).toLowerCase())) {
              const profAny = profile as Record<string, any>;
              const teacherIdentities = new Set<string>([
                ...this.extractAllStrings(profAny?.['id']),
                ...this.extractAllStrings(profAny?.['uid']),
                ...this.extractAllStrings(profAny?.['userId']),
                ...this.extractAllStrings(profAny?.['docId']),
                ...this.extractAllStrings(profAny?.['entityId']),
                ...this.extractAllStrings(profAny?.['staffId']),
                ...this.extractAllStrings(profAny?.['email']),
                ...this.extractAllStrings(profAny?.['displayName']),
                ...this.extractAllStrings(profAny?.['name'])
              ].map(v => v.toLowerCase().trim()).filter(Boolean));

              const assignedGroups = classGroups.filter(g => {
                const allStaff = this.extractAllStrings([
                  g['assignedStaffIds'], g['assignedStaff'], g['staffIds'], g['teacherIds'], g['teachers'], g['staff'], g['groupStaff'], g['teacherId'], g['staffId']
                ]).map(v => v.toLowerCase().trim());
                return allStaff.some(id => teacherIdentities.has(id));
              });

              const assignedGroupIds = new Set<string>([
                ...assignedGroups.flatMap(g => [
                  extractId(g.id),
                  extractId(g['docId']),
                  extractId(g['groupId']),
                  String(g.id || '').trim(),
                  String(g['docId'] || '').trim(),
                  String(g['groupId'] || '').trim(),
                ]),
                ...this.extractAllStrings([
                  profAny?.['groupId'], profAny?.['groupIds'], profAny?.['classGroupId'], profAny?.['classGroupIds'],
                  profAny?.['assignedGroupId'], profAny?.['assignedGroupIds']
                ]).map(v => v.trim())
              ].map(v => v.toLowerCase()).filter(Boolean));

              const assignedClasses = classes.filter(c => {
                const allStaff = this.extractAllStrings([
                  c['assignedStaffIds'], c['assignedStaff'], c['staffIds'], c['teacherIds'], c['teachers'], c['staff'], c['teacherId']
                ]).map(v => v.toLowerCase().trim());
                return allStaff.some(id => teacherIdentities.has(id));
              });

              const assignedClassIds = new Set<string>([
                ...assignedGroups.flatMap(g => [
                  extractId(g['classId'] || g['class']),
                  String(g['classId'] || g['class'] || '').trim(),
                  String(g['className'] || '').trim()
                ]),
                ...assignedClasses.flatMap(c => [
                  extractId(c.id),
                  String(c.id || '').trim(),
                  String(c['name'] || c['title'] || '').trim()
                ]),
                ...this.extractAllStrings([
                  profAny?.['classId'], profAny?.['classIds'], profAny?.['assignedClassId'], profAny?.['assignedClassIds']
                ]).map(v => v.trim())
              ].map(v => v.toLowerCase()).filter(Boolean));

              const staffGroupStudentTokens = new Set<string>();
              classGroups.filter(g => {
                const gTokens = [
                  extractId(g.id), extractId(g['docId']), extractId(g['groupId']),
                  String(g.id || ''), String(g['docId'] || ''), String(g['groupId'] || ''),
                  String(g['name'] || ''), String(g['groupName'] || ''), String(g['title'] || ''), String(g['code'] || '')
                ].map(v => v.toLowerCase().trim()).filter(Boolean);
                return gTokens.some(tok => assignedGroupIds.has(tok));
              }).forEach(g => {
                [
                  ...this.extractAllStrings(g['assignedStudentIds']),
                  ...this.extractAllStrings(g['assignedStudents']),
                  ...this.extractAllStrings(g['studentIds']),
                  ...this.extractAllStrings(g['students']),
                  ...this.extractAllStrings(g['assignedStudentId']),
                  ...this.extractAllStrings(g['studentId'])
                ].forEach(id => staffGroupStudentTokens.add(id.toLowerCase().trim()));
              });

              filteredRows = filteredRows.filter(s => {
                const sTeacherIds = this.extractAllStrings([
                  s['teacherId'], s['assignedStaffId'], s['staffId'], s['teacherUid'], s['assignedTeacherId'],
                  s['ustadhId'], s['teacher'], s['staff'], s['assignedStaff']
                ]).map(v => v.toLowerCase().trim());
                if (sTeacherIds.some(id => teacherIdentities.has(id))) return true;

                const sIdentities = [
                  s.id, s['uid'], s['userId'], s['entityId'], s['docId'], s['studentId'], s['email']
                ].filter(Boolean).map(v => String(v).toLowerCase().trim());
                if (sIdentities.some(id => staffGroupStudentTokens.has(id))) return true;

                const sGroupTokens = new Set<string>([
                  ...Array.from(getStudentGroupTokens(s)),
                  ...this.extractAllStrings([
                    s['groupId'], s['classGroupId'], s['assignedGroupId'], s['group'], s['sectionId'], s['section'],
                    s['groupIds'], s['classGroupIds'], s['assignedGroupIds'], s['groupName'], s['sectionName']
                  ]).map(v => v.toLowerCase().trim())
                ].filter(Boolean));

                if (Array.from(sGroupTokens).some(gId => assignedGroupIds.has(gId))) return true;

                if (assignedGroupIds.size > 0) return false;

                const sClassTokens = new Set<string>([
                  ...this.extractAllStrings([
                    s['classId'], s['assignedClassId'], s['class'], s['classIds'], s['assignedClassIds'], s['className']
                  ]).map(v => v.toLowerCase().trim())
                ].filter(Boolean));

                if (Array.from(sClassTokens).some(cId => assignedClassIds.has(cId))) return true;

                return false;
              });
            }
           
             if (['students', 'classGroups', 'classes'].includes(config.resource)) {
                 if (courseFilter !== 'all') {
                   filteredRows = filteredRows.filter(r => r['courseId'] === courseFilter);
                   displayClasses = displayClasses.filter(c => c['courseId'] === courseFilter);
                   displayClassGroups = displayClassGroups.filter(g => g['courseId'] === courseFilter);
                 }
                 if (classFilter !== 'all' && config.resource !== 'classes') {
                   const selectedClass = classes.find(c => c.id === classFilter);
                   const selectedName = selectedClass ? String(selectedClass['name'] || selectedClass['title'] || '').trim().toLowerCase() : '';
                   const matchingClassIds = selectedName
                     ? classes.filter(c => String(c['name'] || c['title'] || '').trim().toLowerCase() === selectedName).map(c => c.id)
                     : [classFilter];

                   filteredRows = filteredRows.filter(r => matchingClassIds.includes(r['classId']) || r['classId'] === classFilter);
                   displayClassGroups = displayClassGroups.filter(g => matchingClassIds.includes(g['classId']) || g['classId'] === classFilter);
                 }
                 if (config.resource === 'classGroups' && shiftFilter !== 'all') {
                   if (shiftFilter === 'assigned') {
                     filteredRows = filteredRows.filter(r => {
                       const s = String(r['shiftName'] || r['shiftId'] || r['shift'] || '').trim();
                       return Boolean(s && s !== '-' && s.toLowerCase() !== 'unassigned');
                     });
                   } else if (shiftFilter === 'unassigned') {
                     filteredRows = filteredRows.filter(r => {
                       const s = String(r['shiftName'] || r['shiftId'] || r['shift'] || '').trim();
                       return !s || s === '-' || s.toLowerCase() === 'unassigned';
                     });
                   } else {
                     const targetLower = shiftFilter.toLowerCase().trim();
                     filteredRows = filteredRows.filter(r => {
                       const sName = String(r['shiftName'] || '').toLowerCase().trim();
                       const sId = String(r['shiftId'] || r['shift'] || '').toLowerCase().trim();
                       return sName === targetLower || sId === targetLower;
                     });
                   }
                 }
                 if (classGroupFilter !== 'all' && config.resource === 'students') {
                   const selectedGroupDoc = classGroups.find(g => extractId(g.id) === classGroupFilter);
                   const groupExplicitStudentSet = new Set<string>([
                     ...(selectedGroupDoc ? [
                       ...this.extractAllStrings(selectedGroupDoc['assignedStudentIds']),
                       ...this.extractAllStrings(selectedGroupDoc['assignedStudents']),
                       ...this.extractAllStrings(selectedGroupDoc['studentIds']),
                       ...this.extractAllStrings(selectedGroupDoc['students']),
                       ...this.extractAllStrings(selectedGroupDoc['assignedStudentId']),
                       ...this.extractAllStrings(selectedGroupDoc['studentId'])
                     ] : [])
                   ].map(s => String(s).toLowerCase().trim()));

                   filteredRows = filteredRows.filter(r => {
                     const sGroupTokens = getStudentGroupTokens(r);
                     if (Array.from(sGroupTokens).some(gId => String(gId).trim() === classGroupFilter)) return true;

                     const rIdentities = [
                       r.id, r['uid'], r['userId'], r['entityId'], r['docId'], r['studentId'], r['email']
                     ].filter(Boolean).map(v => String(v).toLowerCase().trim());

                     if (rIdentities.some(id => groupExplicitStudentSet.has(id))) return true;

                     return false;
                   });
                 }
                 if (stageFilter !== 'all' && config.resource === 'students') {
                   filteredRows = filteredRows.filter(r => r['stage'] === stageFilter || r['level'] === stageFilter);
                 }
                 if (assignmentFilter !== 'all' && config.resource === 'students') {
                   const allGroupExplicitStudentSet = new Set<string>();
                   classGroups.forEach(g => {
                     [
                       ...this.extractAllStrings(g['assignedStudentIds']),
                       ...this.extractAllStrings(g['assignedStudents']),
                       ...this.extractAllStrings(g['studentIds']),
                       ...this.extractAllStrings(g['students']),
                       ...this.extractAllStrings(g['assignedStudentId']),
                       ...this.extractAllStrings(g['studentId'])
                     ].forEach(id => {
                       if (id) allGroupExplicitStudentSet.add(id.toLowerCase().trim());
                     });
                   });

                   filteredRows = filteredRows.filter(r => {
                     const hasGroupId = Boolean(
                       extractId(r['groupId'] || r['classGroupId'] || r['assignedGroupId'] || r['group'] || r['sectionId'] || r['section'])
                     );
                     let isAssigned = hasGroupId;
                     if (!isAssigned) {
                       const gIds = Array.isArray(r['groupIds']) ? r['groupIds'] : (Array.isArray(r['classGroupIds']) ? r['classGroupIds'] : []);
                       if (gIds.some((id: any) => Boolean(extractId(id)))) isAssigned = true;
                     }
                     if (!isAssigned && allGroupExplicitStudentSet.size > 0) {
                       const identities = [
                         r.id, r['uid'], r['userId'], r['entityId'], r['docId'], r['studentId'], r['email']
                       ].filter(Boolean).map(v => String(v).toLowerCase().trim());
                       if (identities.some(id => allGroupExplicitStudentSet.has(id))) isAssigned = true;
                     }

                     return assignmentFilter === 'assigned' ? isAssigned : !isAssigned;
                   });
                 }
              }

              if (['users', 'students', 'incharges', 'coordinators', 'staff', 'parents', 'classGroups', 'classes', 'courses'].includes(config.resource)) {
                   if (madrasaFilter !== 'all') {
                     const selectedMadrasa = madrasas.find(m => extractId(m.id) === madrasaFilter);
                     const madrasaClasses = displayClasses.filter(cls => extractId(cls['madrasaId']) === madrasaFilter || (Array.isArray(cls['madrasaIds']) && cls['madrasaIds'].map(extractId).includes(madrasaFilter)));
                     const madrasaClassCourseIds = new Set(madrasaClasses.map(cls => String(cls['courseId'] || '')).filter(Boolean));

                     const madrasaStudents = students.filter(s => extractId(s['madrasaId']) === madrasaFilter || (Array.isArray(s['madrasaIds']) && s['madrasaIds'].map(extractId).includes(madrasaFilter)));
                     const madrasaStudentCourseIds = new Set(madrasaStudents.map(s => String(s['courseId'] || '')).filter(Boolean));

                     displayCourses = displayCourses.filter(c => {
                       const cId = String(c.id);
                       if (!c['madrasaId']) return true;
                       if (extractId(c['madrasaId']) === madrasaFilter) return true;
                       if (Array.isArray(c['madrasaIds']) && c['madrasaIds'].map(extractId).includes(madrasaFilter)) return true;
                       if (madrasaClassCourseIds.has(cId)) return true;
                       if (madrasaStudentCourseIds.has(cId)) return true;
                       return false;
                     });

                     displayClasses = madrasaClasses;
                     const madrasaClassIds = new Set(madrasaClasses.map(cls => extractId(cls.id)).filter(Boolean));
                     displayClassGroups = displayClassGroups.filter(g => {
                       const gMadId = extractId(g['madrasaId']);
                       const gMadIds = Array.isArray(g['madrasaIds']) ? g['madrasaIds'].map(extractId) : [];
                       const gClassId = extractId(g['classId'] || g['class']);
                       return (gMadId && gMadId === madrasaFilter) ||
                              gMadIds.includes(madrasaFilter) ||
                              (gClassId && madrasaClassIds.has(gClassId));
                     });
                   }

                  if (['staff', 'incharges', 'coordinators'].includes(config.resource)) {
                    const inchargeMadrasaIds = !_isOrgAdmin ? this.getInchargeMadrasaIdsForUser(profile, madrasas) : [];
                    let activeTargetMadrasas: string[] = [];
                    if (madrasaFilter !== 'all') {
                      activeTargetMadrasas = [madrasaFilter];
                    } else if (!_isOrgAdmin && inchargeMadrasaIds.length > 0) {
                      activeTargetMadrasas = inchargeMadrasaIds;
                    }

                    if (activeTargetMadrasas.length > 0) {
                      filteredRows = filteredRows.filter(r => {
                        const rName = r['displayName'] || r['name'] || r['email'] || r.id;
                        const rMId = extractId(r['madrasaId']);
                        const rMIds = Array.isArray(r['madrasaIds']) ? r['madrasaIds'].map(extractId) : [];
                        const rAssignedMIds = Array.isArray(r['assignedMadrasaIds']) ? r['assignedMadrasaIds'].map(extractId) : [];
                        const userId = String(r['uid'] || r['userId'] || r.id || '');

                        const rowMadrasaSet = new Set<string>([
                          ...(rMId ? [rMId] : []),
                          ...rMIds,
                          ...rAssignedMIds
                        ]);

                        let isMatch = false;
                        if (rowMadrasaSet.size > 0) {
                          isMatch = Array.from(rowMadrasaSet).some(id => activeTargetMadrasas.includes(id));
                        } else {
                          const isLinkedToTargetMadrasa = madrasas.some(m => {
                            const mId = extractId(m.id);
                            if (!activeTargetMadrasas.includes(mId)) return false;
                            const mIncharges = [
                              ...(Array.isArray(m['inchargeIds']) ? m['inchargeIds'] : []),
                              ...(m['inchargeId'] ? [m['inchargeId']] : []),
                              ...(m['incharge'] ? [m['incharge']] : []),
                              ...(Array.isArray(m['coordinatorIds']) ? m['coordinatorIds'] : []),
                              ...(m['coordinatorId'] ? [m['coordinatorId']] : []),
                              ...(m['coordinator'] ? [m['coordinator']] : [])
                            ].map(String);
                            return userId && mIncharges.includes(userId);
                          });
                          isMatch = isLinkedToTargetMadrasa;
                        }

                        return isMatch;
                      });
                    }
                  } else if (madrasaFilter !== 'all') {
                    const selectedMadrasa = madrasas.find(m => extractId(m.id) === madrasaFilter);
                    const madrasaInchargeIds: string[] = Array.isArray(selectedMadrasa?.['inchargeIds']) ? selectedMadrasa!['inchargeIds'].map(String) : [];
                    const madrasaCoordinatorIds: string[] = Array.isArray(selectedMadrasa?.['coordinatorIds']) ? selectedMadrasa!['coordinatorIds'].map(String) : [];

                    filteredRows = filteredRows.filter(r => {
                      const userId = String(r['uid'] || r.id || '');
                      const rowMId = extractId(r['madrasaId']);
                      const rowMIds = Array.isArray(r['madrasaIds']) ? r['madrasaIds'].map(extractId) : [];
                      const ownLink = rowMId === madrasaFilter || rowMIds.includes(madrasaFilter);
                      const madrasaLink = (userId && (madrasaInchargeIds.includes(userId) || madrasaCoordinatorIds.includes(userId)));
                      return ownLink || madrasaLink;
                    });
                  }
             }

                if (config.resource === 'users' && roleFilter !== 'all') {
                  filteredRows = filteredRows.filter(r => this.getEffectiveRoles(r).includes(roleFilter));
                }

                if (genderFilter !== 'all' && ['users', 'students', 'incharges', 'coordinators', 'staff', 'parents'].includes(config.resource)) {
                  filteredRows = filteredRows.filter(r => r['gender'] === genderFilter);
                }

             if (statusFilter !== 'all') {
               const sf = statusFilter.toLowerCase();
               filteredRows = filteredRows.filter(r => {
                 const raw = String(r['status'] || r['state'] || '').toLowerCase();
                 if (sf === 'active') {
                   return !['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(raw);
                 }
                 return raw === sf;
               });
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
               return { rows: filteredRows, profile, totalItems, madrasas: displayMadrasas, courses: displayCourses, classes: displayClasses, classGroups: displayClassGroups, organizations, shifts, availableShifts };
            }
 
            return { rows: filteredRows, profile, totalItems, madrasas: displayMadrasas, courses: displayCourses, classes: displayClasses, classGroups: displayClassGroups, organizations, shifts, availableShifts };
        }),
        map(({ rows, profile, totalItems, madrasas, courses, classes, classGroups, organizations, shifts, availableShifts }): PageState<ManagementVm> => {
          let dynamicConfig = config;
          if (config.resource === 'courses') {
            const isOrgAdminOrCoordinator = profile?.role === 'organizationAdmin' || profile?.role === 'superAdmin' || profile?.role === 'coordinator';
            if (!isOrgAdminOrCoordinator) {
              // For Madrasa Incharge / Staff: Show their Madrasa column instead of all-madrasas count button
              dynamicConfig = {
                ...config,
                columns: [
                  { key: 'name', label: 'Course' },
                  { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' },
                  { key: 'madrasaId', label: 'Madrasa', type: 'idRef', referenceType: 'madrasa' },
                  { key: 'code', label: 'Code' },
                  { key: 'typeDisplay', label: 'Course Type' },
                  { key: 'stagesDisplay', label: 'Stages', type: 'stageChips' },
                  { key: 'studentCount', label: 'Students', type: 'studentCount' },
                  { key: 'status', label: 'Status', type: 'status' },
                ]
              };
            }
          }

          return {
            data: {
              config: dynamicConfig,
              rows,
              profile,
              totalItems,
              madrasas,
              courses,
              classes,
              classGroups,
              organizations,
              shifts,
              availableShifts
            },
            loading: false,
          };
        }),
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
    private readonly staffData: StaffManagementDataService,
    private readonly studentData: StudentManagementDataService,
    private readonly parentData: ParentManagementDataService,
    private readonly loader: LoaderService,
    private readonly nameResolver: NameResolverService,
    private readonly rolePermissionsService: RolePermissionsService
  ) { }

  refreshData() {
    this.repo.clearCache();
    this.refresh$.next();
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
    const options = config.resource === 'staff'
      ? { roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin', 'ustadh', 'stageHead', 'headTeacher', 'teacher_assistant'] }
      : undefined;
    const collectionObs$ = this.repo.list<EntityRecord>(config.collection, profile, [], options);
    switch (config.resource) {
      case 'students':
        return this.studentData.getStudentRows(collectionObs$, profile);
      case 'parents':
        return this.parentData.getParentRows(collectionObs$, profile);
      case 'staff':
        return this.staffData.getStaffRows(collectionObs$, profile);
      case 'courses':
        return this.courseRows(collectionObs$, profile);
      default:
        return collectionObs$;
    }
  }

  private courseRows(coursesObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return coursesObs$.pipe(
      map((courses) => courses.map((c) => ({
        ...c,
        typeDisplay: String(c['type'] || 'custom').toUpperCase(),
        hasSubjectsDisplay: c['hasSubjects'] ? 'Yes' : 'No',
        stagesDisplay: Array.isArray(c['stages']) ? c['stages'].join(', ') : (c['stages'] || '-'),
      })))
    );
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
    let queryRoles = roles ? roles : undefined;
    // For 'users' resource, roleFilter is applied row-by-row using getEffectiveRoles()
    // to support multi-role users. For other resources, queryRoles does the initial
    // collection-level filter based on the fixed role set for that resource.

    const users$ = this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(catchError(() => of([])));
    const staff$ = this.repo.list<EntityRecord>('staff', profile, [], undefined).pipe(catchError(() => of([])));

    return combineLatest([users$, staff$]).pipe(
      map(([userRows, staffRows]) => {
        const staffMap = new Map<string, EntityRecord>();
        staffRows.forEach(s => {
          const uid = String(s['userId'] || s['uid'] || s.id || '');
          if (uid) staffMap.set(uid, s);
          const email = String(s['email'] || '').toLowerCase().trim();
          if (email) staffMap.set(email, s);
        });

        // Merge staff entity data over user data so updates in staff collection reflect in the table!
        let merged = userRows.map(userRow => {
          const uid = String(userRow['uid'] || userRow.id || '');
          const email = String(userRow['email'] || '').toLowerCase().trim();
          const staffDoc = (uid ? staffMap.get(uid) : undefined) || (email ? staffMap.get(email) : undefined);
          if (staffDoc) {
            return {
              ...userRow,
              name: staffDoc['name'] || staffDoc['displayName'] || userRow['name'] || userRow['displayName'],
              displayName: staffDoc['displayName'] || staffDoc['name'] || userRow['displayName'] || userRow['name'],
              mobileNumber: staffDoc['mobileNumber'] || staffDoc['phone'] || userRow['mobileNumber'] || userRow['phone'],
              phone: staffDoc['phone'] || staffDoc['mobileNumber'] || userRow['phone'] || userRow['mobileNumber'],
              gender: staffDoc['gender'] || userRow['gender'],
              madrasaId: staffDoc['madrasaId'] || userRow['madrasaId'],
              madrasaIds: staffDoc['madrasaIds'] || userRow['madrasaIds'],
              status: staffDoc['status'] || userRow['status'],
              permissions: staffDoc['permissions'] || userRow['permissions'],
              role: staffDoc['role'] || userRow['role'],
              entityId: staffDoc.id,
              entityType: 'staff',
            };
          }
          return userRow;
        });

        // Also include any standalone staff documents from `staff` collection that don't have a linked user document
        const userUidSet = new Set(userRows.map(u => String(u['uid'] || u.id || '').toLowerCase().trim()));
        const userEmailSet = new Set(userRows.map(u => String(u['email'] || '').toLowerCase().trim()).filter(Boolean));

        const orphanStaffRows: EntityRecord[] = [];
        staffRows.forEach(s => {
          const uid = String(s['userId'] || s['uid'] || s.id || '').toLowerCase().trim();
          const email = String(s['email'] || '').toLowerCase().trim();
          if (!userUidSet.has(uid) && (!email || !userEmailSet.has(email))) {
            orphanStaffRows.push({
              ...s,
              role: s['role'] || 'teacher',
              roles: Array.isArray(s['roles']) ? s['roles'] : [s['role'] || 'teacher'],
              displayName: s['displayName'] || s['name'] || 'Staff Member',
              entityId: s.id,
              entityType: 'staff'
            });
          }
        });

        // Effective role filtering is performed uniformly in the vm$ pipeline using getEffectiveRoles(r, madrasas)
        // so multi-role users (e.g. Incharges/Coordinators with teaching duties) match consistently on all pages.
        return this.credentialRows([...merged, ...orphanStaffRows]);
      })
    );
  }

  private rolesForResource(resource: string): string[] | undefined {
    switch (resource) {
      case 'coordinators': return ['coordinator'];
      case 'incharges': return ['madrasaIncharge'];
      case 'staff': return ['teacher', 'staff', 'stageHead', 'madrasaIncharge', 'coordinator', 'ustadh', 'headTeacher', 'teacher_assistant', 'organizationAdmin'];
      case 'students': return ['student'];
      case 'parents': return ['parent'];
      default: return undefined;
    }
  }

  /**
   * Returns all roles a user effectively holds.
   * This mirrors the logic in RoleBadgeComponent so that the role filter
   * matches exactly what is visually shown to the admin.
   *
   * Sources:
   *  1. The primary `role` field (always present)
   *  2. A `roles` array field (for users with multiple stored roles)
   *  3. Implicit expansions:  madrasaIncharge & stageHead also count as 'teacher'
   */
  private getEffectiveRoles(row: EntityRecord, madrasas?: EntityRecord[]): string[] {
    const primary = String(row['role'] || '');
    const secondary: string[] = Array.isArray(row['roles']) ? row['roles'].map(String) : [];

    const effective = new Set<string>([...secondary]);
    if (primary) effective.add(primary);

    const userId = String(row['uid'] || row['userId'] || row.id || '');
    if (userId && madrasas && madrasas.length > 0) {
      for (const m of madrasas) {
        const inchargeIds: string[] = Array.isArray(m['inchargeIds']) ? m['inchargeIds'].map(String) : [];
        const coordinatorIds: string[] = Array.isArray(m['coordinatorIds']) ? m['coordinatorIds'].map(String) : [];
        if (inchargeIds.includes(userId) || (row.id && inchargeIds.includes(row.id))) {
          effective.add('madrasaIncharge');
        }
        if (coordinatorIds.includes(userId) || (row.id && coordinatorIds.includes(row.id))) {
          effective.add('coordinator');
        }
      }
    }

    // Mirror role-badge implicit expansions:
    // madrasaIncharge, coordinator, stageHead, ustadh count as 'teacher'
    if (effective.has('madrasaIncharge') || effective.has('stageHead') || effective.has('coordinator') || effective.has('ustadh') || effective.has('headTeacher')) {
      effective.add('teacher');
    }

    if (!primary || primary === 'student' || row['classId'] || row['groupId'] || row['studentId'] || row['admissionNumber'] || row['rollNumber'] || row['fatherName'] || row['parentName']) {
      effective.add('student');
    }

    return Array.from(effective);
  }

  private getInchargeMadrasaIdsForUser(profile: AppUser | null, madrasas: EntityRecord[]): string[] {
    if (!profile) return [];

    const userTokens = [
      profile.uid,
      profile.id,
      profile.entityId,
      profile.email
    ].map(v => String(v || '').trim()).filter(Boolean);

    const inchargeSet = new Set<string>();
    (madrasas || []).forEach(m => {
      const mId = extractId(m.id);
      const incharges = [
        ...(Array.isArray(m['inchargeIds']) ? m['inchargeIds'] : []),
        ...(m['inchargeId'] ? [m['inchargeId']] : []),
        ...(m['incharge'] ? [m['incharge']] : []),
        ...(Array.isArray(m['coordinatorIds']) ? m['coordinatorIds'] : []),
        ...(m['coordinatorId'] ? [m['coordinatorId']] : []),
        ...(m['coordinator'] ? [m['coordinator']] : [])
      ].map(v => String(v || '').trim()).filter(Boolean);

      if (incharges.some(id => userTokens.includes(id))) {
        if (mId) inchargeSet.add(mId);
      }
    });

    if (inchargeSet.size === 0 && Array.isArray(profile.inchargeMadrasaIds) && profile.inchargeMadrasaIds.length > 0) {
      profile.inchargeMadrasaIds.forEach(id => {
        const clean = extractId(id);
        if (clean) inchargeSet.add(clean);
      });
    }

    if (inchargeSet.size === 0 && (profile.role === 'madrasaIncharge' || profile.role === 'coordinator')) {
      const primaryId = extractId(profile.madrasaId);
      if (primaryId) {
        inchargeSet.add(primaryId);
      } else if (Array.isArray(profile.madrasaIds) && profile.madrasaIds.length > 0) {
        const first = extractId(profile.madrasaIds[0]);
        if (first) inchargeSet.add(first);
      }
    }

    return Array.from(inchargeSet);
  }

  private credentialRows(rows: EntityRecord[]): EntityRecord[] {
    return rows.map((row) => {
      const creds = this.credentialService.getCredentialStatus(row);
      const fullName = row['displayName'] || row['name'] || row['email'] || 'N/A';
      return {
        ...row,
        name: fullName,
        displayName: fullName,
        mobileNumber: row['mobileNumber'] || row['phone'] || '',
        phone: row['phone'] || row['mobileNumber'] || '',
        credentialStatus: creds.status,
        temporaryPasswordDisplay: creds.display,
      } as EntityRecord;
    });
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

  findDuplicateAccounts(rows: EntityRecord[]): void {
    const normalizeName = (name: string) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizeEmail = (email: string) => (email || '').toLowerCase().trim();

    const isParent = (u: EntityRecord) => {
      const role = String(u['role'] || '');
      const roles = Array.isArray(u['roles']) ? u['roles'].map(String) : [];
      return role === 'parent' || roles.includes('parent');
    };

    const groups: { original: EntityRecord; duplicates: EntityRecord[]; reason: string }[] = [];
    const seenUids = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const u1 = rows[i];
      if (isParent(u1)) continue;
      const uid1 = String(u1['uid'] || u1.id || '');
      if (seenUids.has(uid1)) continue;

      const name1 = normalizeName(String(u1['displayName'] || u1['name'] || ''));
      const email1 = normalizeEmail(String(u1['email'] || ''));
      const phone1 = String(u1['mobileNumber'] || u1['phone'] || '').trim();

      const matchedDuplicates: EntityRecord[] = [];
      let matchReason = '';

      for (let j = i + 1; j < rows.length; j++) {
        const u2 = rows[j];
        if (isParent(u2)) continue;
        const uid2 = String(u2['uid'] || u2.id || '');
        if (seenUids.has(uid2)) continue;

        const name2 = normalizeName(String(u2['displayName'] || u2['name'] || ''));
        const email2 = normalizeEmail(String(u2['email'] || ''));
        const phone2 = String(u2['mobileNumber'] || u2['phone'] || '').trim();

        let isMatch = false;
        if (name1 && name2 && name1 === name2 && uid1 !== uid2) {
          isMatch = true;
          matchReason = 'Identical / Similar Name';
        } else if (email1 && email2 && this.isSimilarEmail(email1, email2) && uid1 !== uid2) {
          isMatch = true;
          matchReason = 'Similar Email';
        } else if (phone1 && phone2 && phone1 === phone2 && phone1.length >= 10 && uid1 !== uid2) {
          isMatch = true;
          matchReason = 'Same Phone Number';
        }

        if (isMatch) {
          matchedDuplicates.push(u2);
          seenUids.add(uid2);
        }
      }

      if (matchedDuplicates.length > 0) {
        seenUids.add(uid1);
        groups.push({ original: u1, duplicates: matchedDuplicates, reason: matchReason });
      }
    }

    if (groups.length === 0) {
      this.snackBar.open('No duplicate accounts found!', 'Close', { duration: 4000 });
      return;
    }

    let messageText = `Found ${groups.length} potential duplicate account group(s):\n\n`;
    groups.forEach((g, idx) => {
      const origName = g.original['displayName'] || g.original['name'] || 'N/A';
      const origEmail = g.original['email'] || 'N/A';
      messageText += `${idx + 1}. Main Account: ${origName} (${origEmail})\n`;
      g.duplicates.forEach(d => {
        const dupName = d['displayName'] || d['name'] || 'N/A';
        const dupEmail = d['email'] || 'N/A';
        messageText += `   - Duplicate Account: ${dupName} (${dupEmail}) [Match Reason: ${g.reason}]\n`;
      });
      messageText += '\n';
    });

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Duplicate Accounts Audit (${groups.length} Found)`,
        message: messageText,
        confirmLabel: 'OK',
        hideCancel: true,
      }
    });
  }

  private isSimilarEmail(e1: string, e2: string): boolean {
    if (e1 === e2) return true;
    const [user1, domain1] = e1.split('@');
    const [user2, domain2] = e2.split('@');
    if (!user1 || !user2 || domain1 !== domain2) return false;
    if (user1.includes(user2) || user2.includes(user1)) return true;
    let diff = 0;
    const maxLen = Math.max(user1.length, user2.length);
    for (let i = 0; i < maxLen; i++) {
      if (user1[i] !== user2[i]) diff++;
    }
    return diff <= 2;
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

  private getScopedClassGroups(
    classGroups: EntityRecord[],
    classes: EntityRecord[],
    profile: AppUser | null,
    madrasas?: EntityRecord[]
  ): EntityRecord[] {
    if (!profile) return classGroups;

    const role = String(profile.role || '').toLowerCase();
    const isSuperOrOrgAdmin = ['superadmin', 'organizationadmin', 'super_admin', 'orgadmin'].includes(role);
    if (isSuperOrOrgAdmin) return classGroups;

    const userIdentities = [
      profile.uid,
      profile.id,
      profile.entityId,
      (profile as any).userId,
      (profile as any).docId,
      (profile as any).staffId,
      profile.email
    ].filter(Boolean).map(s => String(s).trim().toLowerCase());

    const isMadrasaInchargeRole = role === 'madrasaincharge' ||
      role === 'madrasa_incharge' ||
      role === 'incharge' ||
      role === 'coordinator' ||
      (Array.isArray((profile as any).roles) && (profile as any).roles.some((r: string) => String(r).toLowerCase().includes('incharge')));

    const inchargeMadrasaIds = new Set<string>();

    if (madrasas && madrasas.length > 0) {
      const idsFromMadrasas = this.getInchargeMadrasaIdsForUser(profile, madrasas);
      idsFromMadrasas.forEach(id => inchargeMadrasaIds.add(id));
    }

    if (Array.isArray((profile as any).inchargeMadrasaIds) && (profile as any).inchargeMadrasaIds.length > 0) {
      (profile as any).inchargeMadrasaIds.forEach((id: string) => inchargeMadrasaIds.add(String(id).trim()));
    }

    if (isMadrasaInchargeRole && inchargeMadrasaIds.size === 0) {
      if ((profile as any).madrasaId) inchargeMadrasaIds.add(String((profile as any).madrasaId).trim());
      if (Array.isArray((profile as any).madrasaIds)) {
        (profile as any).madrasaIds.forEach((id: string) => inchargeMadrasaIds.add(String(id).trim()));
      }
    }

    const isMadrasaIncharge = isMadrasaInchargeRole || inchargeMadrasaIds.size > 0;

    // 1. If user is Madrasa Incharge / Coordinator: return ALL class groups assigned to their incharge madrasas, PLUS directly assigned class groups!
    if (isMadrasaIncharge && inchargeMadrasaIds.size > 0) {
      const madrasaClasses = new Set(
        classes.filter(c => {
          const cMadId = String(c['madrasaId'] || '').trim();
          const cMadIds = Array.isArray(c['madrasaIds']) ? c['madrasaIds'].map(String) : [];
          return (cMadId && inchargeMadrasaIds.has(cMadId)) || cMadIds.some(id => inchargeMadrasaIds.has(id));
        }).map(c => String(c.id).trim())
      );

      const inchargeMadrasaGroups = classGroups.filter(g => {
        const gMadId = String(g['madrasaId'] || '').trim();
        const gMadIds = Array.isArray(g['madrasaIds']) ? g['madrasaIds'].map(String) : [];
        const gClassId = String(g['classId'] || g['class'] || '').trim();
        const belongsToMadrasa = (gMadId && inchargeMadrasaIds.has(gMadId)) ||
               gMadIds.some(id => inchargeMadrasaIds.has(id)) ||
               (gClassId && madrasaClasses.has(gClassId));

        if (belongsToMadrasa) return true;

        const gId = String(g.id || '').trim();
        const profileGroupIds = [
          (profile as any).groupId,
          (profile as any).classGroupId,
          (profile as any).assignedGroupId,
          ...((profile as any).groupIds || []),
          ...((profile as any).classGroupIds || []),
          ...((profile as any).assignedGroupIds || [])
        ].filter(Boolean).map(s => String(s).trim());

        if (profileGroupIds.includes(gId)) return true;

        const groupStaffTokens = [
          ...this.extractAllStrings(g['assignedStaffIds']),
          ...this.extractAllStrings(g['assignedStaff']),
          ...this.extractAllStrings(g['staffIds']),
          ...this.extractAllStrings(g['teacherIds']),
          ...this.extractAllStrings(g['teachers']),
          ...this.extractAllStrings(g['staff']),
          ...this.extractAllStrings(g['groupStaff'])
        ].map(s => s.toLowerCase());

        return userIdentities.some(id => groupStaffTokens.includes(id));
      });

      if (inchargeMadrasaGroups.length > 0) {
        return inchargeMadrasaGroups;
      }
    }

    // 2. Regular Staff / Teacher Login (NOT a Madrasa Incharge): Return ONLY explicitly assigned class groups!
    const assignedClassGroups = classGroups.filter(g => {
      const gId = String(g.id || '').trim();

      const profileGroupIds = [
        (profile as any).groupId,
        (profile as any).classGroupId,
        (profile as any).assignedGroupId,
        ...((profile as any).groupIds || []),
        ...((profile as any).classGroupIds || []),
        ...((profile as any).assignedGroupIds || [])
      ].filter(Boolean).map(s => String(s).trim());

      if (profileGroupIds.includes(gId)) return true;

      const groupStaffTokens = [
        ...this.extractAllStrings(g['assignedStaffIds']),
        ...this.extractAllStrings(g['assignedStaff']),
        ...this.extractAllStrings(g['staffIds']),
        ...this.extractAllStrings(g['teacherIds']),
        ...this.extractAllStrings(g['teachers']),
        ...this.extractAllStrings(g['staff']),
        ...this.extractAllStrings(g['groupStaff'])
      ].map(s => s.toLowerCase());

      return userIdentities.some(id => groupStaffTokens.includes(id));
    });

    if (assignedClassGroups.length > 0) {
      return assignedClassGroups;
    }

    // 3. Fallback: If user is assigned to a specific class (classId), return class groups under that class
    const profileClassIds = new Set([
      (profile as any).classId,
      ...((profile as any).classIds || []),
      (profile as any).assignedClassId
    ].filter(Boolean).map(s => String(s).trim()));

    if (profileClassIds.size > 0) {
      const classGroupsUnderClass = classGroups.filter(g => {
        const gClassId = String(g['classId'] || g['class'] || '').trim();
        return gClassId && profileClassIds.has(gClassId);
      });
      if (classGroupsUnderClass.length > 0) {
        return classGroupsUnderClass;
      }
    }

    // If regular staff user has no assigned class groups, return empty array
    return [];
  }

  private getScopedClasses(
    classes: EntityRecord[],
    classGroups: EntityRecord[],
    profile: AppUser | null,
    madrasas?: EntityRecord[]
  ): EntityRecord[] {
    if (!profile) return classes;

    const role = String(profile.role || '').toLowerCase();
    const isSuperOrOrgAdmin = ['superadmin', 'organizationadmin', 'super_admin', 'orgadmin'].includes(role);
    if (isSuperOrOrgAdmin) return classes;

    const userIdentities = [
      profile.uid,
      profile.id,
      profile.entityId,
      (profile as any).userId,
      (profile as any).docId,
      (profile as any).staffId,
      profile.email
    ].filter(Boolean).map(s => String(s).trim().toLowerCase());

    const isMadrasaInchargeRole = role === 'madrasaincharge' ||
      role === 'madrasa_incharge' ||
      role === 'incharge' ||
      role === 'coordinator' ||
      (Array.isArray((profile as any).roles) && (profile as any).roles.some((r: string) => String(r).toLowerCase().includes('incharge')));

    const inchargeMadrasaIds = new Set<string>();

    if (madrasas && madrasas.length > 0) {
      const idsFromMadrasas = this.getInchargeMadrasaIdsForUser(profile, madrasas);
      idsFromMadrasas.forEach(id => inchargeMadrasaIds.add(id));
    }

    if (Array.isArray((profile as any).inchargeMadrasaIds) && (profile as any).inchargeMadrasaIds.length > 0) {
      (profile as any).inchargeMadrasaIds.forEach((id: string) => inchargeMadrasaIds.add(String(id).trim()));
    }

    if (isMadrasaInchargeRole && inchargeMadrasaIds.size === 0) {
      if ((profile as any).madrasaId) inchargeMadrasaIds.add(String((profile as any).madrasaId).trim());
      if (Array.isArray((profile as any).madrasaIds)) {
        (profile as any).madrasaIds.forEach((id: string) => inchargeMadrasaIds.add(String(id).trim()));
      }
    }

    const isMadrasaIncharge = isMadrasaInchargeRole || inchargeMadrasaIds.size > 0;

    // 1. If user is Madrasa Incharge / Coordinator, return ALL classes for their incharge madrasas FIRST!
    if (isMadrasaIncharge && inchargeMadrasaIds.size > 0) {
      const madrasaClasses = classes.filter(c => {
        const cMadId = String(c['madrasaId'] || '').trim();
        const cMadIds = Array.isArray(c['madrasaIds']) ? c['madrasaIds'].map(String) : [];
        return (cMadId && inchargeMadrasaIds.has(cMadId)) || cMadIds.some(id => inchargeMadrasaIds.has(id));
      });

      if (madrasaClasses.length > 0) {
        return madrasaClasses;
      }
    }

    // 2. Check direct class assignments or classes containing assigned class groups
    const profileClassIds = new Set([
      (profile as any).classId,
      (profile as any).assignedClassId,
      ...((profile as any).classIds || []),
      ...((profile as any).assignedClassIds || [])
    ].filter(Boolean).map(s => String(s).trim()));

    const assignedClassGroups = this.getScopedClassGroups(classGroups, classes, profile, madrasas);
    const assignedGroupClassIds = new Set(
      assignedClassGroups.map(g => String(g['classId'] || g['class'] || '').trim()).filter(Boolean)
    );

    const assignedClasses = classes.filter(c => {
      const cId = String(c.id || '').trim();

      if (profileClassIds.has(cId) || assignedGroupClassIds.has(cId)) return true;

      const classStaffTokens = [
        ...this.extractAllStrings(c['assignedStaffIds']),
        ...this.extractAllStrings(c['assignedStaff']),
        ...this.extractAllStrings(c['staffIds']),
        ...this.extractAllStrings(c['teacherIds']),
        ...this.extractAllStrings(c['teachers']),
        ...this.extractAllStrings(c['staff'])
      ].map(s => s.toLowerCase());

      return userIdentities.some(id => classStaffTokens.includes(id));
    });

    if (assignedClasses.length > 0) {
      return assignedClasses;
    }

    return classes;
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
      row['docId'],
      row['staffId'],
      row['email'],
      row['name'],
      row['displayName']
    ]);
  }

  private staffAssignmentId(row: EntityRecord): string {
    return String(row['entityId'] || row.id || row['uid'] || row['userId'] || '').trim();
  }

  private withClassGroupStaff(classes: EntityRecord[], classGroups: EntityRecord[], staffRows: EntityRecord[]): EntityRecord[] {
    const staffById = new Map<string, EntityRecord>();
    staffRows.forEach((staff) => {
      // Exclude student & parent roles
      const role = String(staff['role'] || '');
      const roles: string[] = Array.isArray(staff['roles']) ? staff['roles'].map(String) : (role ? [role] : []);
      if (roles.includes('student') || roles.includes('parent') || role === 'student' || role === 'parent') {
        return;
      }
      this.recordIdentityValues(staff).forEach((id) => staffById.set(id, staff));
    });

    return classes.map((classRow) => {
      const groups = classGroups.filter((group) => String(group['classId'] || group['class'] || '') === String(classRow.id || ''));
      
      const directStaffIds = this.uniqueStrings([
        ...(Array.isArray(classRow['assignedStaffIds']) ? classRow['assignedStaffIds'] : []),
        ...groups.flatMap((group) => Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'] : [])
      ]);

      const staffIds = [...directStaffIds];

      // Also match staff whose profile has classId matching this class
      staffRows.forEach((staff) => {
        const role = String(staff['role'] || '');
        const roles: string[] = Array.isArray(staff['roles']) ? staff['roles'].map(String) : (role ? [role] : []);
        if (roles.includes('student') || roles.includes('parent') || role === 'student' || role === 'parent') {
          return;
        }

        const sClassId = String(staff['classId'] || staff['assignedClassId'] || '');
        const sClassIds = Array.isArray(staff['classIds']) ? staff['classIds'].map(String) : (Array.isArray(staff['assignedClassIds']) ? staff['assignedClassIds'].map(String) : []);
        
        if (classRow.id && (sClassId === classRow.id || sClassIds.includes(classRow.id))) {
          this.recordIdentityValues(staff).forEach((id) => {
            if (!staffIds.includes(id)) staffIds.push(id);
          });
        }
      });

      const groupStaff = staffIds.map((id) => {
        const staff = staffById.get(id);
        if (!staff) return null;

        const staffTokens = this.recordIdentityValues(staff).map(s => s.toLowerCase());

        // Find which class groups under this class this staff member is assigned to
        const assignedGroupsForStaff = groups.filter((g) => {
          const gStaffTokens = [
            ...this.extractAllStrings(g['assignedStaffIds']),
            ...this.extractAllStrings(g['assignedStaff']),
            ...this.extractAllStrings(g['staffIds']),
            ...this.extractAllStrings(g['teacherIds']),
            ...this.extractAllStrings(g['teachers']),
            ...this.extractAllStrings(g['staff']),
            ...this.extractAllStrings(g['groupStaff'])
          ].map(s => s.toLowerCase());

          const staffGroupIds = [
            ...this.extractAllStrings(staff['groupId']),
            ...this.extractAllStrings(staff['classGroupId']),
            ...this.extractAllStrings(staff['groupIds']),
            ...this.extractAllStrings(staff['classGroupIds']),
            ...this.extractAllStrings(staff['assignedGroupId'])
          ];

          return staffTokens.some(tok => gStaffTokens.includes(tok)) || staffGroupIds.includes(String(g.id));
        });

        const assignedGroupNames = assignedGroupsForStaff
          .map(g => String(g['name'] || g['title'] || '').trim())
          .filter(Boolean);

        const groupName = Array.from(new Set(assignedGroupNames)).join(', ');

        return {
          id,
          name: String(staff['displayName'] || staff['name'] || staff['email'] || id),
          email: staff['email'] || '',
          photoURL: staff['photoURL'] || '',
          groupName: groupName || undefined,
        };
      }).filter(s => !!s && !!s.name);

      return {
        ...classRow,
        groupStaff,
      };
    });
  }

  trackCredential(_: number, credential: GeneratedCredential): string {
    return credential.email;
  }

  async openMadrasasDialog(row: EntityRecord): Promise<void> {
    if (!row) return;

    await this.loader.withLoader('Loading madrasa details...', async () => {
      const profile = await firstValueFrom(this.auth.profile$);
      const allMadrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => []);
      const allClasses = await this.repo.getAllOnce<EntityRecord>('classes', profile).catch(() => []);
      const allGroups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile).catch(() => []);

      let rawIds: string[] = [];
      if (Array.isArray(row['madrasaIds'])) {
        rawIds.push(...row['madrasaIds'].map(String).filter(Boolean));
      }
      if (row['madrasaId']) {
        rawIds.push(String(row['madrasaId']));
      }
      if (Array.isArray(row['assignedMadrasaIds'])) {
        rawIds.push(...row['assignedMadrasaIds'].map(String).filter(Boolean));
      }

      const rowTokens = [
        row.id,
        row['id'],
        row['uid'],
        row['userId'],
        row['email']
      ].map(v => String(v || '').trim()).filter(Boolean);

      allMadrasas.forEach(m => {
        const mIncharges = [
          ...(Array.isArray(m['inchargeIds']) ? m['inchargeIds'] : []),
          ...(m['inchargeId'] ? [m['inchargeId']] : []),
          ...(m['incharge'] ? [m['incharge']] : []),
          ...(Array.isArray(m['coordinatorIds']) ? m['coordinatorIds'] : []),
          ...(m['coordinatorId'] ? [m['coordinatorId']] : []),
          ...(m['coordinator'] ? [m['coordinator']] : [])
        ].map(v => String(v || '').trim()).filter(Boolean);

        if (mIncharges.some(id => rowTokens.includes(id))) {
          if (m.id) rawIds.push(String(m.id));
        }
      });

      rawIds = Array.from(new Set(rawIds));

      const assignedMadrasas = allMadrasas.filter(m => 
        rawIds.includes(String(m.id)) || 
        rawIds.includes(String(m['code']))
      );
      
      const madrasaIds = assignedMadrasas.length > 0 ? assignedMadrasas.map(m => String(m.id)) : rawIds;
      const madrasaNames = assignedMadrasas.map(m => String(m['name'] || m['title'] || m['code'] || m.id));

      const title = String(row['name'] || row['displayName'] || row['title'] || 'Assigned Madrasas');

      this.dialog.open(CourseMadrasasDialogComponent, {
        data: {
          courseId: row.id,
          courseName: title,
          courseCode: String(row['code'] || ''),
          madrasaIds,
          madrasaNames,
          userId: String(row['uid'] || row['userId'] || row.id || ''),
          user: row
        },
        width: '640px',
        maxWidth: '92vw',
        maxHeight: '90vh'
      });
    });
  }

  canCreateResource(config: ManagementConfig, profile: AppUser | null): boolean {
    if (!profile) return false;
    const role = String(profile.role || '').toLowerCase();
    if (config.resource === 'organizations') {
      return role === 'superadmin';
    }
    if (role === 'superadmin' || role === 'organizationadmin') return true;

    const resourceAddPermissionMap: Record<string, PermissionKey[]> = {
      courses: ['addCourses', 'manageCourses'],
      classes: ['addClasses', 'manageClasses'],
      classGroups: ['addClassGroups', 'manageClassGroups', 'addClasses', 'manageClasses'],
      madrasas: ['manageMadrasas'],
      coordinators: ['manageCoordinators'],
      incharges: ['manageIncharges'],
      staff: ['manageStaff'],
      students: ['manageStudents'],
      parents: ['manageParents'],
      subjects: ['manageSubjects']
    };

    const allowedPermissions = resourceAddPermissionMap[config.resource];
    if (!allowedPermissions) return true;

    const userPermissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    return allowedPermissions.some(p => userPermissions.includes(p));
  }

  canEditResource(config: ManagementConfig, profile: AppUser | null): boolean {
    if (!profile) return false;
    const role = String(profile.role || '').toLowerCase();
    if (config.resource === 'organizations') {
      return role === 'superadmin';
    }
    if (role === 'superadmin' || role === 'organizationadmin') return true;

    // Madrasa Incharge cannot edit org-level resources (organizations, madrasas, coordinators, incharges)
    if (role === 'madrasaincharge') {
      if (['organizations', 'madrasas', 'coordinators', 'incharges'].includes(config.resource)) {
        return false;
      }
      return true;
    }

    // Coordinator cannot edit organizations or coordinators
    if (role === 'coordinator') {
      if (['organizations', 'coordinators'].includes(config.resource)) {
        return false;
      }
      return true;
    }

    const resourceEditPermissionMap: Record<string, PermissionKey[]> = {
      courses: ['editCourses', 'manageCourses'],
      classes: ['editClasses', 'manageClasses'],
      classGroups: ['editClassGroups', 'manageClassGroups', 'editClasses', 'manageClasses'],
      madrasas: ['manageMadrasas'],
      coordinators: ['manageCoordinators'],
      incharges: ['manageIncharges'],
      staff: ['manageStaff'],
      students: ['manageStudents'],
      parents: ['manageParents'],
      subjects: ['manageSubjects']
    };

    const allowedPermissions = resourceEditPermissionMap[config.resource];
    if (!allowedPermissions) return true;

    const userPermissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    return allowedPermissions.some(p => userPermissions.includes(p));
  }

  canDeleteResource(config: ManagementConfig, profile: AppUser | null): boolean {
    if (!profile) return false;
    if (!config.allowDelete) return false;
    const role = String(profile.role || '').toLowerCase();
    if (config.resource === 'organizations') {
      return role === 'superadmin';
    }
    return role === 'superadmin' || role === 'organizationadmin';
  }

  async openCreate(config: ManagementConfig): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!this.canCreateResource(config, profile)) {
      this.snackBar.open(`You do not have permission to add ${config.title.toLowerCase()}.`, 'Close', { duration: 4000 });
      return;
    }
    await this.openEditor(config);
  }

  async edit(config: ManagementConfig, row: EntityRecord): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!this.canEditResource(config, profile)) {
      this.snackBar.open(`You do not have permission to edit ${config.title.toLowerCase()}.`, 'Close', { duration: 4000 });
      return;
    }
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
      width: '95vw',
      maxWidth: '900px',
      maxHeight: '90vh',
      panelClass: 'user-details-dialog-panel'
    });
  }

  openProgressTracker(row: EntityRecord): void {
    this.dialog.open(StudentProgressTrackerDialogComponent, {
      data: { student: row },
      width: '95vw',
      maxWidth: '1000px',
      maxHeight: '92vh',
      panelClass: 'student-progress-tracker-dialog-panel'
    });
  }

  async showRowStudents(config: ManagementConfig, row: EntityRecord): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    await this.loader.withLoader('Loading students...', async () => {
      let studentsList: EntityRecord[] = [];
      const baseName = String(row['name'] || row['displayName'] || 'Enrolled Students');
      const targetGroupName = String(row['targetGroupName'] || '').trim();
      const dialogTitle = targetGroupName ? `${targetGroupName} (${baseName})` : baseName;

      const usersStudents = await this.repo.getAllOnce<EntityRecord>('users', profile, { roles: ['student'] }).catch(() => []);
      const directStudents = await this.repo.getAllOnce<EntityRecord>('students', profile).catch(() => []);

      const studentMap = new Map<string, EntityRecord>();
      [...usersStudents, ...directStudents].forEach(st => {
        const nameStr = String(st['displayName'] || st['name'] || st['studentName'] || '').trim().toLowerCase();
        const emailStr = String(st['email'] || '').trim().toLowerCase();
        const uidStr = extractId(st['uid'] || st['userId'] || st['studentId']);
        const docId = extractId(st.id);

        const key = docId || uidStr || (emailStr && emailStr !== 'n/a' ? emailStr : '') || nameStr;
        if (key) {
          const existing = studentMap.get(key) || {};
          studentMap.set(key, { ...existing, ...st });
        }
      });
      const allStudents = Array.from(studentMap.values());

      const classGroupDocs = await this.repo.getAllOnce<EntityRecord>('classGroups', profile).catch(() => []);
      const allClasses = await this.repo.getAllOnce<EntityRecord>('classes', profile).catch(() => []);
      const allCourses = await this.repo.getAllOnce<EntityRecord>('courses', profile).catch(() => []);
      const allUsers = await this.repo.getAllOnce<EntityRecord>('users', profile).catch(() => []);
      const allStaff = await this.repo.getAllOnce<EntityRecord>('staff', profile).catch(() => []);

      if (config.resource === 'classGroups') {
        const grpIdStr = extractId(row.id || row['docId']);
        const targetMadrasaId = extractId(row['madrasaId']);
        const targetClassId = extractId(row['classId']);
        const targetCourseId = extractId(row['courseId']);
        const grpCode = String(row['code'] || '').toLowerCase().trim();
        const grpName = String(row['name'] || '').toLowerCase().trim();

        const rosterIds = new Set<string>([
          ...this.extractAllStrings(row['assignedStudentIds']),
          ...this.extractAllStrings(row['assignedStudents']),
          ...this.extractAllStrings(row['studentIds']),
          ...this.extractAllStrings(row['students']),
          ...this.extractAllStrings(row['assignedStudentId']),
          ...this.extractAllStrings(row['studentId']),
        ].map(v => v.toLowerCase()));

        studentsList = allStudents.filter(s => {
          const sStatus = String(s['status'] || s['state'] || '').toLowerCase();
          if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(sStatus)) return false;

          const sIdentities = [
            s.id, s['uid'], s['userId'], s['entityId'], s['docId'], s['studentId'], s['email']
          ].filter(Boolean).map(v => String(v).trim().toLowerCase());

          if (sIdentities.some(id => rosterIds.has(id))) return true;

          const sGrpIds = [
            extractId(s['groupId']),
            extractId(s['classGroupId']),
            extractId(s['group']),
            extractId(s['sectionId']),
            extractId(s['section']),
            ...(Array.isArray(s['groupIds']) ? s['groupIds'].map(extractId) : []),
            ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'].map(extractId) : [])
          ].filter(Boolean);

          if (grpIdStr && sGrpIds.includes(grpIdStr)) return true;

          const sMadrasaId = extractId(s['madrasaId']);
          const sClassId = extractId(s['classId'] || s['assignedClassId']);
          const sCourseId = extractId(s['courseId'] || s['assignedCourseId']);

          const sameMadrasa = !targetMadrasaId || !sMadrasaId || sMadrasaId === targetMadrasaId;
          const sameClass = !targetClassId || !sClassId || sClassId === targetClassId;
          const sameCourse = !targetCourseId || !sCourseId || sCourseId === targetCourseId;

          if (sameMadrasa && sameClass && sameCourse) {
            const sGrpNames = [
              String(s['groupName'] || '').toLowerCase().trim(),
              String(s['sectionName'] || '').toLowerCase().trim(),
              String(s['group'] || '').toLowerCase().trim()
            ].filter(Boolean);

            if (grpCode && sGrpNames.includes(grpCode)) return true;
            if (grpName && sGrpNames.includes(grpName)) return true;
          }

          return false;
        });
      } else if (config.resource === 'classes') {
        const classIdStr = extractId(row.id);
        const classNameStr = String(row['name'] || '').toLowerCase().trim();

        const classGroupsUnderThisClass = new Set(
          classGroupDocs.filter(g => {
            const gClassId = extractId(g['classId'] || g['class']);
            const gClassName = String(g['className'] || '').toLowerCase().trim();
            return (classIdStr && gClassId === classIdStr) || (classNameStr && gClassName === classNameStr);
          }).map(g => extractId(g.id))
        );

        studentsList = allStudents.filter(s => {
          const sStatus = String(s['status'] || s['state'] || '').toLowerCase();
          if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(sStatus)) return false;

          const sClassIds = [
            extractId(s['classId']),
            extractId(s['assignedClassId']),
            ...(Array.isArray(s['classIds']) ? s['classIds'].map(extractId) : [])
          ].filter(Boolean);

          const sClassNames = [
            String(s['className'] || '').toLowerCase().trim()
          ].filter(Boolean);

          const sGroupIds = [
            extractId(s['groupId']),
            extractId(s['classGroupId']),
            extractId(s['group']),
            extractId(s['sectionId']),
            extractId(s['section']),
            ...(Array.isArray(s['groupIds']) ? s['groupIds'].map(extractId) : []),
            ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'].map(extractId) : [])
          ].filter(Boolean);

          if (classIdStr && sClassIds.includes(classIdStr)) return true;
          if (classNameStr && sClassNames.includes(classNameStr)) return true;
          if (sGroupIds.some(gId => classGroupsUnderThisClass.has(gId))) return true;

          return false;
        });
      } else if (config.resource === 'courses') {
        const courseIdStr = extractId(row.id);
        const courseCodeStr = String(row['code'] || '').toLowerCase().trim();
        const courseNameStr = String(row['name'] || '').toLowerCase().trim();

        const matchingCourseIds = new Set([courseIdStr]);
        allCourses.filter(c => {
          const cId = extractId(c.id);
          const cCode = String(c['code'] || '').toLowerCase().trim();
          const cName = String(c['name'] || '').toLowerCase().trim();
          return (cId && cId === courseIdStr) || (courseCodeStr && cCode === courseCodeStr) || (courseNameStr && cName === courseNameStr);
        }).forEach(c => matchingCourseIds.add(extractId(c.id)));

        const matchingClassIds = new Set(
          allClasses.filter(cls => matchingCourseIds.has(extractId(cls['courseId'] || cls['course']))).map(cls => extractId(cls.id))
        );

        studentsList = allStudents.filter(s => {
          const sStatus = String(s['status'] || s['state'] || '').toLowerCase();
          if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(sStatus)) return false;

          const sCourseId = extractId(s['courseId'] || s['course']);
          const sClassId = extractId(s['classId'] || s['class']);
          return matchingCourseIds.has(sCourseId) || (sClassId && matchingClassIds.has(sClassId));
        });
      } else {
        const sTokens = [
          row.id,
          row['id'],
          row['uid'],
          row['userId'],
          row['entityId'],
          row['staffId'],
          row['docId'],
          row['email']
        ].map(v => String(v || '').trim()).filter(Boolean);

        const directGroupIds = [
          row['groupId'],
          row['classGroupId'],
          row['assignedGroupId'],
          ...(Array.isArray(row['groupIds']) ? row['groupIds'] : []),
          ...(Array.isArray(row['classGroupIds']) ? row['classGroupIds'] : []),
          ...(Array.isArray(row['assignedGroupIds']) ? row['assignedGroupIds'] : [])
        ].map(v => String(v || '').trim()).filter(Boolean);

        const matchedGroupIds = classGroupDocs.filter(g => {
          const gId = String(g.id || g['docId'] || '').trim();
          if (directGroupIds.includes(gId)) return true;

          const gStaffTokens = [
            ...this.extractAllStrings(g['assignedStaffIds']),
            ...this.extractAllStrings(g['assignedStaff']),
            ...this.extractAllStrings(g['staffIds']),
            ...this.extractAllStrings(g['teacherIds']),
            ...this.extractAllStrings(g['teachers']),
            ...this.extractAllStrings(g['staff']),
            ...this.extractAllStrings(g['groupStaff'])
          ].map(v => v.toLowerCase());
          return sTokens.some(tok => gStaffTokens.includes(tok.toLowerCase()));
        }).map(g => String(g.id).trim());

        const assignedGroupIds = new Set<string>([...directGroupIds, ...matchedGroupIds]);

        const directClassIds = [
          row['classId'],
          row['assignedClassId'],
          ...(Array.isArray(row['classIds']) ? row['classIds'] : []),
          ...(Array.isArray(row['assignedClassIds']) ? row['assignedClassIds'] : [])
        ].map(v => String(v || '').trim()).filter(Boolean);

        const matchedClassIds = allClasses.filter(c => {
          const cStaffTokens = [
            ...this.extractAllStrings(c['assignedStaffIds']),
            ...this.extractAllStrings(c['assignedStaff']),
            ...this.extractAllStrings(c['staffIds']),
            ...this.extractAllStrings(c['teacherIds']),
            ...this.extractAllStrings(c['teachers']),
            ...this.extractAllStrings(c['staff'])
          ].map(v => v.toLowerCase());
          return sTokens.some(tok => cStaffTokens.includes(tok.toLowerCase()));
        }).map(c => String(c.id).trim());

        const explicitClassIds = new Set<string>([...directClassIds, ...matchedClassIds]);

        const assignedClassIds = new Set<string>([
          ...matchedGroupIds.map(gId => {
            const grp = classGroupDocs.find(g => String(g.id) === gId);
            return grp ? String(grp['classId'] || '') : '';
          }).filter(Boolean),
          ...directClassIds,
          ...matchedClassIds
        ]);

        const staffGroupStudentTokens = new Set<string>();
        classGroupDocs.filter(g => assignedGroupIds.has(String(g.id).trim())).forEach(g => {
          [
            ...this.extractAllStrings(g['assignedStudentIds']),
            ...this.extractAllStrings(g['assignedStudents']),
            ...this.extractAllStrings(g['studentIds']),
            ...this.extractAllStrings(g['students']),
            ...this.extractAllStrings(g['assignedStudentId']),
            ...this.extractAllStrings(g['studentId'])
          ].forEach(id => staffGroupStudentTokens.add(id.toLowerCase()));
        });

        studentsList = allStudents.filter(s => {
          const sStatus = String(s['status'] || s['state'] || '').toLowerCase();
          if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(sStatus)) return false;

          const sTeacherTokens = [
            s['teacherId'], s['assignedStaffId'], s['staffId'], s['teacherUid'], s['assignedTeacherId'],
            s['ustadhId'], s['teacher'], s['staff'], s['assignedStaff']
          ].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);

          const sTokensLower = sTokens.map(t => t.toLowerCase());

          if (sTeacherTokens.some(tok => sTokensLower.includes(tok))) return true;

          const sIdentities = [
            s.id, s['uid'], s['userId'], s['entityId'], s['docId'], s['studentId'], s['email']
          ].filter(Boolean).map(v => String(v).trim().toLowerCase());

          if (sIdentities.some(id => staffGroupStudentTokens.has(id))) return true;

          const sGroupTokens = [
            s['groupId'], s['classGroupId'], s['assignedGroupId'],
            ...(Array.isArray(s['groupIds']) ? s['groupIds'] : []),
            ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'] : [])
          ].map(v => String(v || '').trim()).filter(Boolean);

          if (sGroupTokens.some(gId => assignedGroupIds.has(gId))) return true;

          const sClassTokens = [
            s['classId'], s['assignedClassId'], s['class'],
            ...(Array.isArray(s['classIds']) ? s['classIds'].map(extractId) : [])
          ].map(v => String(v || '').trim()).filter(Boolean);

          if (sClassTokens.some(cId => explicitClassIds.has(cId))) return true;

          if (assignedGroupIds.size === 0 && sClassTokens.some(cId => assignedClassIds.has(cId))) return true;

          return false;
        });
      }

      // If opening for a specific Class Group, filter studentsList further by targetGroupId / targetGroupName
      if (row['targetGroupId'] || row['targetGroupName']) {
        const tGrpId = extractId(row['targetGroupId']);
        const tGrpName = String(row['targetGroupName'] || '').toLowerCase().trim();
        const targetDoc = classGroupDocs.find(g => extractId(g.id) === tGrpId || String(g['name'] || g['title'] || '').toLowerCase().trim() === tGrpName);
        const targetRosterIds = targetDoc ? new Set([
          ...this.extractAllStrings(targetDoc['assignedStudentIds']),
          ...this.extractAllStrings(targetDoc['assignedStudents']),
          ...this.extractAllStrings(targetDoc['studentIds']),
          ...this.extractAllStrings(targetDoc['students']),
          ...this.extractAllStrings(targetDoc['assignedStudentId']),
          ...this.extractAllStrings(targetDoc['studentId'])
        ].map(v => v.toLowerCase())) : new Set<string>();

        studentsList = studentsList.filter(s => {
          const sGrpIds = [
            extractId(s['groupId']),
            extractId(s['classGroupId']),
            extractId(s['group']),
            extractId(s['sectionId']),
            extractId(s['section']),
            ...(Array.isArray(s['groupIds']) ? s['groupIds'].map(extractId) : []),
            ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'].map(extractId) : [])
          ].filter(Boolean);

          if (tGrpId && sGrpIds.includes(tGrpId)) return true;

          const sIdentities = [
            s.id, s['uid'], s['userId'], s['entityId'], s['docId'], s['studentId'], s['email']
          ].filter(Boolean).map(v => String(v).trim().toLowerCase());

          if (sIdentities.some(id => targetRosterIds.has(id))) return true;

          const sGrpNames = [
            String(s['groupName'] || '').toLowerCase().trim(),
            String(s['sectionName'] || '').toLowerCase().trim(),
            String(s['group'] || '').toLowerCase().trim()
          ].filter(Boolean);

          if (tGrpName && sGrpNames.includes(tGrpName)) return true;

          return false;
        });
      }

      // Deduplicate studentsList by student name / email / UID so no student appears twice in the dialog
      const uniqueStudentsMap = new Map<string, EntityRecord>();
      studentsList.forEach(st => {
        const nameStr = String(st['displayName'] || st['name'] || st['studentName'] || '').trim().toLowerCase();
        const emailStr = String(st['email'] || '').trim().toLowerCase();
        const uidStr = extractId(st['uid'] || st['userId'] || st['studentId']);
        const docId = extractId(st.id);

        const dedupeKey = docId || uidStr || (emailStr && emailStr !== 'n/a' ? emailStr : '') || nameStr;
        if (dedupeKey && !uniqueStudentsMap.has(dedupeKey)) {
          uniqueStudentsMap.set(dedupeKey, st);
        } else if (dedupeKey && uniqueStudentsMap.has(dedupeKey)) {
          const existing = uniqueStudentsMap.get(dedupeKey)!;
          uniqueStudentsMap.set(dedupeKey, { ...existing, ...st });
        }
      });
      studentsList = Array.from(uniqueStudentsMap.values());

      const allParents = await this.repo.getAllOnce<EntityRecord>('users', profile, { roles: ['parent'] }).catch(() => []);

      const enrichedStudents = studentsList.map(st => {
        const cId = extractId(st['courseId'] || st['course']);
        const clsId = extractId(st['classId'] || st['class']);
        const grpId = extractId(st['groupId'] || st['classGroupId'] || st['group'] || st['sectionId'] || st['section']);
        const stMadrasaId = extractId(st['madrasaId']);

        const courseDoc = allCourses.find(c => extractId(c.id) === cId);
        const classDoc = allClasses.find(c => extractId(c.id) === clsId);
        
        let groupDoc = classGroupDocs.find(g => extractId(g.id) === grpId);
        if (!groupDoc && grpId) {
          groupDoc = classGroupDocs.find(g => {
            const gName = String(g['name'] || g['title'] || g['code'] || '').toLowerCase().trim();
            const gMadrasaId = extractId(g['madrasaId']);
            const gClassId = extractId(g['classId']);
            const sameM = !stMadrasaId || !gMadrasaId || gMadrasaId === stMadrasaId;
            const sameC = !clsId || !gClassId || gClassId === clsId;
            return gName === grpId.toLowerCase().trim() && sameM && sameC;
          });
        }
        if (!groupDoc && config.resource === 'classGroups') {
          groupDoc = row;
        }

        const parentDoc = allParents.find(p => String(p.id) === String(st['parentId'] || st['parentUid']) || (st['parentEmail'] && String(p['email']).toLowerCase() === String(st['parentEmail']).toLowerCase()));

        const courseName = String(st['courseName'] || courseDoc?.['name'] || courseDoc?.['title'] || row['name'] || row['title'] || '');
        const className = String(st['className'] || classDoc?.['name'] || classDoc?.['title'] || '');
        const groupName = String(st['groupName'] || st['sectionName'] || st['group'] || groupDoc?.['name'] || groupDoc?.['title'] || groupDoc?.['groupName'] || '');

        const studentPhone = String(
          st['mobileNumber'] || st['phone'] || st['mobile'] || st['studentPhone'] || st['studentMobile'] || st['contactNumber'] || st['studentContact'] || ''
        );

        const parentPhone = String(
          st['parentMobileNumber'] || st['fatherMobileNumber'] || st['fatherPhone'] || st['parentPhone'] ||
          st['guardianMobileNumber'] || st['guardianPhone'] || st['parentMobile'] || st['emergencyContact'] ||
          parentDoc?.['mobileNumber'] || parentDoc?.['phone'] || parentDoc?.['mobile'] || ''
        );

        const parentName = String(
          st['fatherName'] || st['parentName'] || st['guardianName'] || parentDoc?.['name'] || parentDoc?.['displayName'] || ''
        );

        let staffNames: string[] = [];
        if (groupDoc) {
          const staffIds: string[] = [
            ...this.extractAllStrings(groupDoc['assignedStaffIds']),
            ...this.extractAllStrings(groupDoc['assignedStaff']),
            ...this.extractAllStrings(groupDoc['staffIds']),
            ...this.extractAllStrings(groupDoc['teacherIds']),
            ...this.extractAllStrings(groupDoc['groupStaff'])
          ];
          staffNames = staffIds.map(id => {
            const cleanId = String(id || '').trim();
            if (!cleanId) return null;

            const u = allUsers.find(usr =>
              String(usr['uid'] || usr.id || '').toLowerCase() === cleanId.toLowerCase() ||
              String(usr['email'] || '').toLowerCase() === cleanId.toLowerCase() ||
              String(usr['displayName'] || usr['name'] || '').toLowerCase() === cleanId.toLowerCase()
            );
            if (u) return String(u['displayName'] || u['name'] || u['email'] || cleanId);

            const s = allStaff.find(stf =>
              String(stf.id || stf['userId'] || stf['uid'] || '').toLowerCase() === cleanId.toLowerCase() ||
              String(stf['email'] || '').toLowerCase() === cleanId.toLowerCase() ||
              String(stf['name'] || stf['displayName'] || '').toLowerCase() === cleanId.toLowerCase()
            );
            if (s) return String(s['name'] || s['displayName'] || s['email'] || cleanId);

            return cleanId.length > 20 ? 'Staff Member' : cleanId;
          }).filter((name): name is string => !!name);
        }

        if (staffNames.length === 0 && row['assignedStaffName']) {
          staffNames = [String(row['assignedStaffName'])];
        }

        const assignedStaffName = staffNames.length > 0 ? Array.from(new Set(staffNames)).join(', ') : 'None';

        return {
          ...st,
          studentPhone: studentPhone || 'N/A',
          parentPhone: parentPhone || 'N/A',
          parentName: parentName || '',
          courseName: courseName || 'N/A',
          className: className || 'N/A',
          groupName: groupName || 'N/A',
          assignedStaffName
        };
      });

      this.dialog.open(AcademicTreeStudentsDialogComponent, {
        data: {
          nodeTitle: dialogTitle,
          nodeType: config.resource,
          students: enrichedStudents
        },
        width: '780px',
        maxWidth: '92vw'
      });
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

        this.repo.clearCache(config.collection);
        this.repo.clearCache('students');
        this.repo.clearCache('users');
        this.repo.clearCache('classes');
        this.repo.clearCache('classGroups');
        this.repo.clearCache('courses');
        this.refreshData();

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
    const currentUid = await firstValueFrom(this.auth.profile$).then(u => u?.uid);
    const rowUid = row.id || row['uid'] || row['userId'];

    if (currentUid && rowUid === currentUid) {
      this.snackBar.open('You cannot delete your own profile.', 'Close', { duration: 4000 });
      return;
    }

    if (config.collection === 'users' && row['role'] === 'organizationAdmin') {
      this.snackBar.open('Organization Admins cannot be deleted.', 'Close', { duration: 4000 });
      return;
    }

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

          this.repo.clearCache(config.collection);
          this.repo.clearCache('students');
          this.repo.clearCache('users');
          this.repo.clearCache('classes');
          this.repo.clearCache('classGroups');
          this.repo.clearCache('courses');
          this.refreshData();

          this.snackBar.open(`Record permanently deleted.`, 'Close', { duration: 4000 });
        } catch (error: any) {
          this.dialog.open(ConfirmDialogComponent, {
            data: { title: 'Cannot Delete', message: error.message || 'Failed to delete record.', hideCancel: true, confirmLabel: 'OK' }
          });
        }
      });
    }
  }

  async deleteAllStudents(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete ALL Students',
        message: 'Are you sure you want to permanently delete ALL students in this scope? This will delete all student profiles, student user accounts, and reset student counts across classes and courses. This action CANNOT be undone.',
        confirmLabel: 'Delete All Students',
        confirmColor: 'warn',
      },
    }).afterClosed());

    if (!confirmed) return;

    await this.loader.withLoader('Deleting all students...', async () => {
      try {
        const profile = await firstValueFrom(this.auth.profile$);
        const allStudents = await firstValueFrom(this.repo.list<EntityRecord>('students', profile));
        const allStudentUsers = await firstValueFrom(this.repo.list<EntityRecord>('users', profile, [], { roles: ['student'] }));

        let count = 0;
        for (const s of allStudents) {
          if (s.id) {
            await this.repo.remove('students', s.id).catch(() => {});
            count++;
          }
        }
        for (const u of allStudentUsers) {
          if (u.id) {
            await this.repo.remove('users', u.id).catch(() => {});
          }
        }

        // Also update studentCount: 0 on classes and classGroups in Firestore
        const allClasses = await firstValueFrom(this.repo.list<EntityRecord>('classes', profile));
        for (const cls of allClasses) {
          if (cls.id && cls['studentCount'] !== 0) {
            await this.repo.update('classes', cls.id, { studentCount: 0 }, profile).catch(() => {});
          }
        }

        const allGroups = await firstValueFrom(this.repo.list<EntityRecord>('classGroups', profile));
        for (const grp of allGroups) {
          if (grp.id && grp['studentCount'] !== 0) {
            await this.repo.update('classGroups', grp.id, { studentCount: 0 }, profile).catch(() => {});
          }
        }

        this.repo.clearCache('students');
        this.repo.clearCache('users');
        this.repo.clearCache('classes');
        this.repo.clearCache('classGroups');
        this.repo.clearCache('courses');
        this.refreshData();

        this.snackBar.open(`Successfully deleted all students (${count} student profiles removed). Counts reset to 0.`, 'Close', { duration: 5000 });
      } catch (err: any) {
        console.error('[Delete All Students Error]', err);
        this.snackBar.open(`Error deleting all students: ${err.message || err}`, 'Close', { duration: 5000 });
      }
    });
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
      
      const targetId = extractId(row['id'] || row['docId'] || row.id);
      const groupRosterSet = new Set<string>([
        ...this.extractAllStrings(row['assignedStudentIds']),
        ...this.extractAllStrings(row['assignedStudents']),
        ...this.extractAllStrings(row['studentIds']),
        ...this.extractAllStrings(row['students']),
        ...this.extractAllStrings(row['assignedStudentId']),
        ...this.extractAllStrings(row['studentId']),
      ]);

      const isAssigned = (s: any) => {
        if (!s) return false;
        const status = String(s['status'] || s['state'] || '').toLowerCase();
        if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(status)) return false;

        const sTokens = this.extractAllStrings(s);
        if (sTokens.some(tok => groupRosterSet.has(tok))) return true;

        if (config.resource === 'classGroups') {
          const gId = extractId(s['groupId'] || s['classGroupId'] || s['assignedGroupId'] || s['group'] || s['sectionId'] || s['section']);
          if (gId && gId === targetId) return true;

          const gIds = [
            ...(Array.isArray(s['groupIds']) ? s['groupIds'].map(extractId) : []),
            ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'].map(extractId) : [])
          ];
          if (gIds.includes(targetId)) return true;
        } else if (config.resource === 'classes') {
          const cId = extractId(s['classId'] || s['class'] || s['assignedClassId'] || s['currentClassId']);
          if (cId && cId === targetId) return true;

          const cIds = [
            ...(Array.isArray(s['classIds']) ? s['classIds'].map(extractId) : []),
            ...(Array.isArray(s['assignedClassIds']) ? s['assignedClassIds'].map(extractId) : [])
          ];
          if (cIds.includes(targetId)) return true;
        }
        return false;
      };

      const assignedStudents = allStudents.filter(isAssigned);

      const parentClassId = extractId(row['classId'] || row['class']);
      const parentCourseId = extractId(row['courseId'] || row['course']);
      const parentMadrasaId = extractId(row['madrasaId'] || row['madrasa']);

      const assignedIdentitySet = new Set<string>();
      assignedStudents.forEach(as => {
        this.extractAllStrings(as).forEach(tok => assignedIdentitySet.add(tok));
      });

      const availableStudents = allStudents.filter((s: any) => {
        if (!s) return false;
        const status = String(s['status'] || s['state'] || '').toLowerCase();
        if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(status)) return false;

        const sTokens = this.extractAllStrings(s);
        if (sTokens.some(tok => assignedIdentitySet.has(tok))) return false;

        if (config.resource === 'classGroups') {
          const sClassId = extractId(s['classId'] || s['class'] || s['assignedClassId']);
          const sCourseId = extractId(s['courseId'] || s['course']);
          const sMadrasaId = extractId(s['madrasaId'] || s['madrasa']);
          const sGroupId = extractId(s['groupId'] || s['classGroupId'] || s['assignedGroupId']);

          // If student belongs to a DIFFERENT group in the same class, exclude them from available list
          if (sGroupId && sGroupId !== targetId) return false;

          // Scope available students to the parent class, course, or madrasa
          if (parentClassId && sClassId) {
            return sClassId === parentClassId;
          }
          if (parentCourseId && sCourseId) {
            return sCourseId === parentCourseId;
          }
          if (parentMadrasaId && sMadrasaId) {
            return sMadrasaId === parentMadrasaId;
          }
          return !sGroupId;
        } else if (config.resource === 'classes') {
          const sClassId = extractId(s['classId'] || s['class'] || s['assignedClassId']);
          const sCourseId = extractId(s['courseId'] || s['course']);
          const sMadrasaId = extractId(s['madrasaId'] || s['madrasa']);

          if (sClassId && sClassId !== targetId) return false;

          if (parentCourseId && sCourseId) {
            return sCourseId === parentCourseId;
          }
          if (parentMadrasaId && sMadrasaId) {
            return sMadrasaId === parentMadrasaId;
          }
          return !sClassId;
        }
        return false;
      });

      let nodeType = '';
      if (config.resource === 'classGroups') {
        nodeType = 'classGroup';
      } else if (config.resource === 'classes') {
        nodeType = 'class';
      }
      
      const node = {
        id: row['id'] || row['id'],
        title: row['name'] || row['groupName'] || 'Class Group',
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
          availableStudents,
          allStudents
        },
        autoFocus: false,
      });
    });
  }

  private extractAllStrings(val: any): string[] {
    if (!val) return [];
    if (typeof val === 'string') return [val.trim().toLowerCase()];
    if (typeof val === 'number') return [String(val).toLowerCase()];
    if (Array.isArray(val)) {
      return val.flatMap(item => this.extractAllStrings(item));
    }
    if (typeof val === 'object') {
      const tokens: string[] = [];
      if (val.id) tokens.push(String(val.id).trim().toLowerCase());
      if (val.uid) tokens.push(String(val.uid).trim().toLowerCase());
      if (val.userId) tokens.push(String(val.userId).trim().toLowerCase());
      if (val.entityId) tokens.push(String(val.entityId).trim().toLowerCase());
      if (val.docId) tokens.push(String(val.docId).trim().toLowerCase());
      if (val.email) tokens.push(String(val.email).trim().toLowerCase());
      if (val.name) tokens.push(String(val.name).trim().toLowerCase());
      if (val.displayName) tokens.push(String(val.displayName).trim().toLowerCase());
      return tokens;
    }
    return [];
  }

  async assignStaff(config: ManagementConfig, row: EntityRecord) {
    if (config.resource !== 'classGroups' && config.resource !== 'classes') return;
    
    await this.loader.withLoader('Loading staff...', async () => {
      const profile = await firstValueFrom(this.auth.profile$);
      const [usersRows, staffRows] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('users', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('staff', profile).catch(() => [])
      ]);

      const staffRoles = ['staff', 'coordinator', 'madrasaincharge', 'teacher', 'organizationadmin', 'ustadh', 'usthad', 'stagehead', 'headteacher', 'teacher_assistant', 'admin', 'principal'];
      const isStaff = (u: any) => {
        if (!u) return false;
        if (!u['role'] && !u['roles'] && (u['name'] || u['displayName'] || u['id'] || u['email'] || typeof u === 'string')) {
          return true;
        }
        const r = String(u['role'] || '').toLowerCase();
        if (staffRoles.some(sr => r.includes(sr))) return true;
        if (Array.isArray(u['roles'])) {
          return u['roles'].some((ro: any) => staffRoles.some(sr => String(ro || '').toLowerCase().includes(sr)));
        }
        return false;
      };
      
      const rawAll = [...staffRows, ...usersRows].filter((u: any) => isStaff(u));
      const allStaffMap = new Map<string, any>();
      for (const u of rawAll) {
        const idKey = String(u['id'] || u['uid'] || u['userId'] || u['entityId'] || u['docId'] || u['email'] || u['name'] || '').trim().toLowerCase();
        if (!idKey) continue;
        if (!allStaffMap.has(idKey)) {
          allStaffMap.set(idKey, u);
        } else {
          const existing = allStaffMap.get(idKey);
          allStaffMap.set(idKey, {
            ...existing,
            ...u,
            name: u['name'] || u['displayName'] || existing['name'] || existing['displayName'],
            displayName: u['displayName'] || u['name'] || existing['displayName'] || existing['name'],
            role: u['role'] || existing['role']
          });
        }
      }

      const rowDirectStaff = [
        ...(Array.isArray(row['groupStaff']) ? row['groupStaff'] : []),
        ...(Array.isArray(row['assignedStaff']) ? row['assignedStaff'] : []),
      ];
      for (const ds of rowDirectStaff) {
        if (ds && typeof ds === 'object') {
          const idKey = String(ds['id'] || ds['uid'] || ds['userId'] || ds['entityId'] || ds['docId'] || ds['email'] || ds['name'] || '').trim().toLowerCase();
          if (idKey && !allStaffMap.has(idKey)) {
            allStaffMap.set(idKey, ds);
          }
        }
      }

      const allStaff = Array.from(allStaffMap.values());
      
      const assignedTokens = new Set([
        ...this.extractAllStrings(row['assignedStaffIds']),
        ...this.extractAllStrings(row['assignedStaff']),
        ...this.extractAllStrings(row['staffIds']),
        ...this.extractAllStrings(row['teacherIds']),
        ...this.extractAllStrings(row['groupStaff']),
        ...this.extractAllStrings(row['assignedStaffNames']),
        ...this.extractAllStrings(row['assignedStaffName']),
      ]);

      let assignedStaff = allStaff.filter((s: any) => {
        const sTokens = this.extractAllStrings(s);
        return Array.from(assignedTokens).some(tok => sTokens.includes(tok));
      });

      if (assignedStaff.length === 0 && rowDirectStaff.length > 0) {
        assignedStaff = rowDirectStaff.filter(s => !!s);
      }

      let nodeType = '';
      if (config.resource === 'classGroups') {
        nodeType = 'classGroup';
      } else if (config.resource === 'classes') {
        nodeType = 'class';
      }
      
      const node = {
        id: row['id'] || row['id'],
        title: row['name'] || row['groupName'] || 'Class Group',
        type: nodeType,
        parentClassId: row['classId'],
        parentCourseId: row['courseId'],
        parentMadrasaId: row['madrasaId'],
        assignedStaff,
        assignedStaffIds: Array.from(assignedTokens)
      };
      
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
          availableStaff: allStaff.filter(s => !assignedStaff.some(as => {
            const asId = String(as['id'] || as['uid'] || as['userId'] || as['entityId'] || as['docId'] || as['email'] || as['name'] || '').trim().toLowerCase();
            const sId = String(s['id'] || s['uid'] || s['userId'] || s['entityId'] || s['docId'] || s['email'] || s['name'] || '').trim().toLowerCase();
            return asId === sId;
          })),
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
              await this.repo.update('users', user.id, { entityId: studentId, entityType: 'student' }, profile, true).catch(e => console.warn('[LinkedAccount] users update skipped:', e));
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
              await this.repo.update('users', user.id, { entityId: parentId, entityType: 'parent' }, profile, true).catch(e => console.warn('[LinkedAccount] users update skipped:', e));
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
              await this.repo.update('users', user.id, { entityId: staffId, entityType: 'staff' }, profile, true).catch(e => console.warn('[LinkedAccount] users update skipped:', e));
              migratedCount++;
           }
        }
      }

      this.snackBar.open(`Migration complete. Created ${migratedCount} business records.`, 'Close', { duration: 5000 });
      this.pageIndex$.next(0); // Trigger refresh
    });
  }

  async syncStaffMadrasaIds(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Sync Staff Madrasa Assignments`,
        message: `This will scan all class groups and ensure that assigned staff members have the correct Madrasa IDs in their profile, making them visible to Madrasa Incharges. Proceed?`,
        confirmLabel: 'Run Sync',
      },
    }).afterClosed());

    if (!confirmed) return;

    await this.loader.withLoader('Syncing staff madrasa assignments...', async () => {
      const profile = await firstValueFrom(this.auth.profile$);
      const allClassGroups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile);
      const allUsers = await this.repo.getAllOnce<EntityRecord>('users', profile);
      
      let syncedCount = 0;
      const userUpdates = new Map<string, Set<string>>();

      for (const group of allClassGroups) {
        const mId = String(group['madrasaId'] || group['madrasa'] || group['parentMadrasaId'] || '').trim();
        const staffIds = Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'] : [];
        if (mId && staffIds.length > 0) {
          for (const staffId of staffIds) {
            if (!userUpdates.has(staffId)) userUpdates.set(staffId, new Set<string>());
            userUpdates.get(staffId)!.add(mId);
          }
        }
      }

      for (const [userId, mIds] of Array.from(userUpdates.entries())) {
        const userDoc = allUsers.find(u => String(u.id) === userId || String(u['uid']) === userId || String(u['entityId']) === userId);
        if (userDoc) {
          const currentMadrasaIds = Array.isArray(userDoc['madrasaIds']) ? userDoc['madrasaIds'].map(String) : [];
          let updated = false;
          const newMadrasaIds = [...currentMadrasaIds];
          for (const mId of Array.from(mIds)) {
            if (!newMadrasaIds.includes(mId)) {
              newMadrasaIds.push(mId);
              updated = true;
            }
          }
          if (updated) {
            await this.repo.update('users', userDoc.id!, { madrasaIds: newMadrasaIds }, profile).catch(() => {});
            syncedCount++;
          }
        }
      }

      this.snackBar.open(`Sync complete. ${syncedCount} users updated.`, 'Close', { duration: 4000 });
      this.refreshData();
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

        const targetUid = await this.resolveTargetUid(row);

        if (!targetUid) {
          throw new Error('User ID not found for this record.');
        }

        console.log(`[Cloud Function Call] name=resetUserTemporaryPassword, targetUid=${targetUid}`);
        await resetFn({ targetUid, newTemporaryPassword: password });

        // Clean up pending requests in `passwordResetRequests` for this user's email
        const userEmail = String(row['email'] || row['generatedEmail'] || row['workEmail'] || '').trim().toLowerCase();
        if (userEmail) {
          try {
            const firestore = getDeenDeskFirestore();
            const reqRef = collection(firestore, 'passwordResetRequests');
            const qPending = query(reqRef, where('email', '==', userEmail), where('status', 'in', ['PENDING', 'pending']));
            const pendingSnap = await getDocs(qPending);
            for (const pDoc of pendingSnap.docs) {
              await updateDoc(doc(firestore, `passwordResetRequests/${pDoc.id}`), {
                status: 'COMPLETED',
                updatedAt: serverTimestamp(),
              });
            }
          } catch (cleanErr) {
            console.warn('[ManagementPage] Password request cleanup skipped:', cleanErr);
          }
        }
      });
      this.snackBar.open('Temporary password updated successfully. User must change it on next login.', 'Close', { duration: 5000 });
    } catch (e: any) {
      console.error('[ResetTempPassword] Error:', e);
      this.snackBar.open(e.message || 'Failed to update temporary password.', 'Close', { duration: 4000 });
    }
  }

  private async resolveTargetUid(row: EntityRecord): Promise<string> {
    let targetUid = String(row['userId'] || row['uid'] || row['primaryOrganizerId'] || row['userUid'] || '').trim();
    const currentResource = this.route.snapshot.data['resource'] || '';

    if (targetUid && targetUid !== row.id) {
      return targetUid;
    }

    if (currentResource === 'users' && row.id) {
      return row.id;
    }

    // Try finding by entityId in `users` collection
    const firestore = getDeenDeskFirestore();
    const usersRef = collection(firestore, 'users');

    if (row.id) {
      const qByEntity = query(usersRef, where('entityId', '==', row.id), limit(1));
      const snapByEntity = await getDocs(qByEntity);
      if (!snapByEntity.empty) {
        return snapByEntity.docs[0].id;
      }
    }

    // Try finding by email
    const email = String(row['email'] || row['generatedEmail'] || row['workEmail'] || row['parentEmail'] || '').trim().toLowerCase();
    if (email) {
      const qByEmail = query(usersRef, where('email', '==', email), limit(1));
      const snapByEmail = await getDocs(qByEmail);
      if (!snapByEmail.empty) {
        return snapByEmail.docs[0].id;
      }

      const qByGen = query(usersRef, where('generatedEmail', '==', email), limit(1));
      const snapByGen = await getDocs(qByGen);
      if (!snapByGen.empty) {
        return snapByGen.docs[0].id;
      }
    }

    if (targetUid) return targetUid;
    if (row.id) return row.id;

    throw new Error('Could not find Auth User Account ID for this record.');
  }

  async promote(row: EntityRecord): Promise<void> {
    const result = await firstValueFrom(this.dialog.open(PromoteDemoteDialogComponent, {
      data: { student: row },
      width: '620px',
    }).afterClosed());

    if (result?.success) {
      this.repo.clearCache('students');
      this.repo.clearCache('users');
      this.pageIndex$.next(this.pageIndex$.value);
      this.snackBar.open('Student stage updated successfully.', 'Close', { duration: 4000 });
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
      this.repo.clearCache('students');
      this.repo.clearCache('users');
      this.pageIndex$.next(this.pageIndex$.value);
      this.snackBar.open('Student transferred successfully.', 'Close', { duration: 4000 });
    }
  }

  async bulkPromote(rows: EntityRecord[], dataTable: any): Promise<void> {
    if (!rows || rows.length === 0) return;
    const result = await firstValueFrom(this.dialog.open(PromoteDemoteDialogComponent, {
      data: { students: rows },
      width: '640px',
      maxWidth: '92vw'
    }).afterClosed());

    if (result?.success) {
      this.repo.clearCache('students');
      this.repo.clearCache('users');
      dataTable.selection.clear();
      this.pageIndex$.next(this.pageIndex$.value);
    }
  }

  async bulkTransfer(rows: EntityRecord[], dataTable: any): Promise<void> {
    if (!rows || rows.length === 0) return;
    const result = await firstValueFrom(this.dialog.open(StudentTransferDialogComponent, {
      data: { students: rows },
      width: '640px',
      maxWidth: '92vw'
    }).afterClosed());

    if (result?.success) {
      this.repo.clearCache('students');
      this.repo.clearCache('users');
      dataTable.selection.clear();
      this.pageIndex$.next(this.pageIndex$.value);
    }
  }

  getAvailableStages(rows: EntityRecord[] = [], courses: EntityRecord[] = []): string[] {
    const stageSet = new Set<string>();
    
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        const s = String(r['stage'] || '').trim();
        if (s) stageSet.add(s);
      });
    }

    if (Array.isArray(courses)) {
      courses.forEach(c => {
        const rawStages = c['stages'];
        if (Array.isArray(rawStages)) {
          rawStages.forEach(s => {
            const st = String(s || '').trim();
            if (st) stageSet.add(st);
          });
        }
      });
    }

    return Array.from(stageSet).sort();
  }

  downloadCredentials(): void {
    const labels = this.rolePermissionsService.getAllLabels();
    const rows = this.credentials.map((credential) => ({
      label: credential.label,
      role: labels[credential.role] || ROLE_LABELS[credential.role as UserRole] || credential.role,
      email: credential.email,
      initialPassword: credential.password,
    }));
    this.csv.download('deendesk-generated-credentials.csv', this.csv.toCsv(rows));
  }

  private async openEditor(config: ManagementConfig, initial?: EntityRecord): Promise<void> {
    const fields = await this.buildFields(config, initial);
    const initialVal = await this.initialDialogValue(config, initial);
    const result = await firstValueFrom(this.dialog.open<QuickAddDialogComponent, unknown, QuickAddResult>(QuickAddDialogComponent, {
      data: {
        title: `${initial ? 'Edit' : 'Add'} ${config.title}`,
        fields,
        initialValue: initialVal,
        isEdit: !!initial,
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

            const isStaffOrUserCollection = config.collection === 'users' || config.resource === 'staff';

            if (isStaffOrUserCollection) {
              const targetUid = initial.id;
              const newName = processedPayload['name'] || processedPayload['displayName'];

              const userPayload: Record<string, any> = { ...processedPayload };
              if (newName) {
                userPayload['name'] = newName;
                userPayload['displayName'] = newName;
              }
              const orgId = initial['organizationId'] || profile?.organizationId;
              if (orgId) userPayload['organizationId'] = orgId;
              const role = processedPayload['role'] || initial['role'];
              if (role) userPayload['role'] = role;

              console.log('=============== 🛠️ [STAFF / USER UPDATE DEBUG START] ===============');
              console.log('👉 [Staff/User Update] targetUid (User UID):', targetUid);
              console.log('👉 [Staff/User Update] initial object:', initial);
              console.log('👉 [Staff/User Update] userPayload being written to users collection:', userPayload);

              // 1. Update the primary user document in users/{uid} collection
              await this.repo.update('users', targetUid, userPayload, profile);
              console.log('✅ [Staff/User Update] Successfully updated users/' + targetUid);

              // 2. Sync linked staff entity document if it exists in staff collection
              const staffSnap = await this.repo.getAllOnce<EntityRecord>('staff', profile).catch(() => []);
              const matchedStaff = staffSnap.find(s => String(s['userId'] || s['uid'] || s.id).trim() === targetUid);

              if (matchedStaff && matchedStaff.id) {
                const staffPayload: Record<string, any> = { ...processedPayload };
                if (newName) {
                  staffPayload['name'] = newName;
                  staffPayload['displayName'] = newName;
                }
                await this.repo.update('staff', matchedStaff.id, staffPayload, profile);
                console.log('✅ [Staff/User Update] Successfully synced linked staff/' + matchedStaff.id);
              } else {
                console.log('ℹ️ [Staff/User Update] No separate linked staff entity doc found for UID:', targetUid);
              }
              console.log('=============== 🛠️ [STAFF / USER UPDATE DEBUG END] =================');
            }
            // Case 3: Other collections (students, courses, classes, subjects, madrasas, etc.)
            else {
              await this.repo.update(config.collection, initial.id, processedPayload, profile);

              if (config.collection === 'students') {
                const oldMadrasaId = initial['madrasaId'];
                const newMadrasaId = processedPayload['madrasaId'] !== undefined ? processedPayload['madrasaId'] : oldMadrasaId;
                const oldCourseId = initial['courseId'];
                const newCourseId = processedPayload['courseId'] !== undefined ? processedPayload['courseId'] : oldCourseId;
                const oldClassId = initial['classId'];
                const newClassId = processedPayload['classId'] !== undefined ? processedPayload['classId'] : oldClassId;
                const oldGroupId = initial['groupId'];
                const newGroupId = processedPayload['groupId'] !== undefined ? processedPayload['groupId'] : oldGroupId;

                const isAcademicChange = (
                  (newMadrasaId && newMadrasaId !== oldMadrasaId) ||
                  (newCourseId && newCourseId !== oldCourseId) ||
                  (newClassId && newClassId !== oldClassId) ||
                  (newGroupId !== undefined && newGroupId !== oldGroupId)
                );

                if (isAcademicChange) {
                  if (newGroupId !== undefined) {
                    processedPayload['classGroupId'] = newGroupId;
                    processedPayload['assignedGroupId'] = newGroupId;
                    processedPayload['groupIds'] = newGroupId ? [newGroupId] : [];
                    processedPayload['classGroupIds'] = newGroupId ? [newGroupId] : [];
                    processedPayload['assignedGroupIds'] = newGroupId ? [newGroupId] : [];
                  }
                  processedPayload['movementStatus'] = 'Transferred';
                  processedPayload['movementType'] = 'TRANSFER';
                  processedPayload['movementTag'] = 'Transferred';
                  processedPayload['lastTransferDate'] = new Date().toISOString().substring(0, 10);

                  const studentId = String(initial.id || initial['uid'] || initial['userId']);
                  const sName = String(processedPayload['name'] || initial['name'] || initial['displayName'] || 'Student');

                  const [classes, groups, madrasas] = await Promise.all([
                    this.repo.getAllOnce('classes', profile).catch(() => []),
                    this.repo.getAllOnce('classGroups', profile).catch(() => []),
                    this.repo.getAllOnce('madrasas', profile).catch(() => []),
                  ]);

                  const oldClassName = classes.find((c: any) => c.id === oldClassId)?.['name'] || initial['className'] || '';
                  const oldGroupName = groups.find((g: any) => g.id === oldGroupId)?.['name'] || initial['groupName'] || '';
                  const oldMadrasaName = madrasas.find((m: any) => m.id === oldMadrasaId)?.['name'] || initial['madrasaName'] || '';

                  const newClassName = classes.find((c: any) => c.id === newClassId)?.['name'] || processedPayload['className'] || '';
                  const newGroupName = groups.find((g: any) => g.id === newGroupId)?.['name'] || processedPayload['groupName'] || '';
                  const newMadrasaName = madrasas.find((m: any) => m.id === newMadrasaId)?.['name'] || processedPayload['madrasaName'] || '';

                  const fromText = `${oldMadrasaName ? oldMadrasaName + ' • ' : ''}${oldClassName || 'Class'}${oldGroupName ? ' (' + oldGroupName + ')' : ''}`;
                  const toText = `${newMadrasaName ? newMadrasaName + ' • ' : ''}${newClassName || 'Class'}${newGroupName ? ' (' + newGroupName + ')' : ''}`;

                  await this.repo.create('userLifecycleHistory', {
                    userId: studentId,
                    userName: sName,
                    personType: 'student',
                    lifecycleAction: 'Transferred',
                    actionType: 'Transfer',
                    reason: `Transferred from ${fromText} to ${toText} via Edit Student form`,
                    fromStage: fromText,
                    toStage: toText,
                    previousMadrasaId: oldMadrasaId || '',
                    previousMadrasaName: oldMadrasaName,
                    newMadrasaId: newMadrasaId || '',
                    newMadrasaName: newMadrasaName,
                    previousCourseId: oldCourseId || '',
                    newCourseId: newCourseId || '',
                    previousClassId: oldClassId || '',
                    previousClassName: oldClassName,
                    newClassId: newClassId || '',
                    newClassName: newClassName,
                    previousGroupId: oldGroupId || '',
                    previousGroupName: oldGroupName,
                    newGroupId: newGroupId || '',
                    newGroupName: newGroupName,
                    effectiveDate: new Date().toISOString(),
                    effectiveDateMs: Date.now(),
                    performedBy: profile?.displayName || profile?.email || 'System',
                    actionPerformedByName: profile?.displayName || profile?.email || 'System',
                    organizationId: profile?.organizationId || initial['organizationId'] || '',
                    madrasaId: newMadrasaId || oldMadrasaId || '',
                    status: 'active'
                  }, profile).catch(e => console.warn('Failed to log userLifecycleHistory for edit academic change:', e));

                  await this.repo.create('studentTransfers', {
                    studentId: studentId,
                    studentName: sName,
                    previousMadrasaId: oldMadrasaId || undefined,
                    previousMadrasaName: oldMadrasaName || undefined,
                    previousCourseId: oldCourseId || undefined,
                    previousClassId: oldClassId || undefined,
                    previousClassName: oldClassName || undefined,
                    previousGroupId: oldGroupId || undefined,
                    previousGroupName: oldGroupName || undefined,
                    newMadrasaId: newMadrasaId || undefined,
                    newMadrasaName: newMadrasaName || undefined,
                    newCourseId: newCourseId || undefined,
                    newClassId: newClassId || undefined,
                    newClassName: newClassName || undefined,
                    newGroupId: newGroupId || undefined,
                    newGroupName: newGroupName || undefined,
                    fromStage: fromText,
                    toStage: toText,
                    reason: `Transferred from ${fromText} to ${toText}`,
                    actionDate: new Date().toISOString().substring(0, 10),
                    actionType: 'Transfer',
                    movementType: 'TRANSFER',
                    movementStatus: 'Transferred',
                    organizationId: profile?.organizationId || initial['organizationId'] || undefined,
                    madrasaId: newMadrasaId || oldMadrasaId || undefined,
                    createdAt: new Date().toISOString(),
                    createdBy: profile?.displayName || profile?.email || 'System'
                  }, profile).catch(e => console.warn('Failed to log studentTransfers for edit academic change:', e));

                  this.repo.clearCache('userLifecycleHistory');
                  this.repo.clearCache('studentTransfers');
                  this.repo.clearCache('classGroups');
                }

                // Also shadow sync to users/{uid} document
                const candidateIds = [initial.id, initial['uid'], initial['userId']]
                  .map(v => String(v || '').trim())
                  .filter(Boolean);

                for (const sId of candidateIds) {
                  await this.repo.update('users', sId, processedPayload, profile, true).catch(() => {});
                }

                this.repo.clearCache('students');
                this.repo.clearCache('users');
                this.repo.clearCache('classGroups');
              }
            }

            // Sync coordinator/incharge into/out of madrasa documents when user role or madrasaIds changes
            const isUserOrStaff = config.collection === 'users' || config.resource === 'staff';
            if (isUserOrStaff) {
              const updatedRole = String(processedPayload['role'] || initial['role'] || '');
              const updatedMadrasaIds = this.asStringArray(processedPayload['madrasaIds'] ?? initial['madrasaIds'] ?? (initial['madrasaId'] ? [initial['madrasaId']] : []));
              const userUid = String(initial['uid'] || initial['userId'] || initial.id || '');
              if (userUid) {
                await this.syncUserToMadrasas(userUid, updatedRole, updatedMadrasaIds, profile);
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

    // Invalidate caches and trigger table UI refresh for updated collection
    this.repo.clearCache(config.collection);
    this.repo.clearCache('madrasas');
    if (config.resource === 'staff') this.repo.clearCache('staff');
    if (config.collection === 'users') this.repo.clearCache('users');
    if (this.pageIndex$) {
      this.pageIndex$.next(this.pageIndex$.value);
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
   * When a user's role or assigned madrasas are created/updated, sync their UID into or out of
   * the madrasa documents' coordinatorIds / inchargeIds arrays.
   */
  private async syncUserToMadrasas(uid: string, newRole: string, madrasaIds: string[], profile: AppUser | null): Promise<void> {
    if (!uid) return;
    const cleanMadrasaIds = (madrasaIds || []).map(id => extractId(id)).filter(Boolean);
    const allMadrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile);

    await Promise.all(
      allMadrasas.map(async (madrasa) => {
        try {
          const mId = extractId(madrasa.id);
          if (!mId) return;

          let existingIncharges: string[] = Array.isArray(madrasa['inchargeIds']) ? (madrasa['inchargeIds'] as string[]).map(String) : [];
          let existingCoordinators: string[] = Array.isArray(madrasa['coordinatorIds']) ? (madrasa['coordinatorIds'] as string[]).map(String) : [];

          let changed = false;

          // Should user be in inchargeIds for this madrasa?
          const shouldBeIncharge = newRole === 'madrasaIncharge' && cleanMadrasaIds.includes(mId);
          if (shouldBeIncharge && !existingIncharges.includes(uid)) {
            existingIncharges = [...existingIncharges, uid];
            changed = true;
          } else if (!shouldBeIncharge && existingIncharges.includes(uid)) {
            existingIncharges = existingIncharges.filter(id => id !== uid);
            changed = true;
          }

          // Should user be in coordinatorIds for this madrasa?
          const shouldBeCoordinator = newRole === 'coordinator' && cleanMadrasaIds.includes(mId);
          if (shouldBeCoordinator && !existingCoordinators.includes(uid)) {
            existingCoordinators = [...existingCoordinators, uid];
            changed = true;
          } else if (!shouldBeCoordinator && existingCoordinators.includes(uid)) {
            existingCoordinators = existingCoordinators.filter(id => id !== uid);
            changed = true;
          }

          if (changed) {
            await this.repo.update('madrasas', mId, {
              inchargeIds: existingIncharges,
              coordinatorIds: existingCoordinators,
            } as any, profile, true);
          }
        } catch (e) {
          console.warn(`[syncUserToMadrasas] Failed to sync user ${uid} with madrasa ${madrasa.id}:`, e);
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

      await this.repo.update('users', credential.uid, { entityId: staffId, entityType: 'staff' }, profile, true).catch(e => console.warn('[createUserAccess] users update skipped:', e));

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

      await this.repo.update('users', credential.uid, { entityId: staffId, entityType: 'staff' }, profile, true).catch(e => console.warn('[createStaffAccess] users update skipped:', e));

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
    const madrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile);
    const madrasaCode = (madrasas.find((m: any) => m.id === madrasaId)?.['code'] as string) || undefined;

    let dob: Date | null = null;
    const rawDob = payload['dateOfBirth'];
    if (rawDob instanceof Date) {
      dob = rawDob;
    } else if (typeof rawDob === 'string') {
      dob = new Date(rawDob);
    } else if (rawDob && (rawDob as any).toDate) {
      dob = (rawDob as any).toDate();
    }

    if (dob && !isNaN(dob.getTime())) {
      const today = new Date();
      if (dob > today) {
        this.snackBar.open('Date of birth cannot be in the future.', 'Close', { duration: 5000 });
        throw new Error('Date of birth cannot be in the future.');
      }
      const minAgeDate = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
      if (dob > minAgeDate) {
        this.snackBar.open('Student must be at least 3 years old.', 'Close', { duration: 5000 });
        throw new Error('Student must be at least 3 years old.');
      }
    }

    const createStudentLogin = payload['createStudentLogin'] === true || payload['createStudentLogin'] === 'true';
    const createParentLogin = payload['createParentLogin'] === true || payload['createParentLogin'] === 'true';

    // 1. If NO logins requested, create student record directly in 'students' collection
    if (!createStudentLogin && !createParentLogin) {
      const studentId = await this.repo.create('students', {
        ...payload,
        status: payload.status ?? 'active',
        credentialStatus: 'NO_LOGIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      }, profile);

      const joinMethod = String(payload['joinType'] || 'new').toLowerCase();
      const isRejoin = joinMethod === 'rejoin';

      await this.repo.create('userLifecycleHistory', {
        userId: studentId,
        userName: String(payload['name'] || 'Student'),
        personType: 'student',
        lifecycleAction: isRejoin ? 'Rejoined' : 'Joined',
        actionType: isRejoin ? 'Rejoin' : 'Enrollment',
        reason: isRejoin ? 'Rejoined / Re-enrolled student account' : 'Newly enrolled student account',
        effectiveDate: new Date().toISOString(),
        effectiveDateMs: Date.now(),
        performedBy: profile?.displayName || profile?.email || 'System',
        organizationId: profile?.organizationId || payload['organizationId'] || '',
        madrasaId,
      }, profile).catch(e => console.warn('[createStudent] lifecycle log skipped:', e));

      this.repo.clearCache('students');
      this.snackBar.open('Student record created successfully without login accounts.', 'Close', { duration: 5000 });
      return;
    }

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
      const createUserWithTemporaryPassword = httpsCallable<any, any>(this.functions, 'createUserWithTemporaryPassword');

      const studentLoginTask = createStudentLogin ? (async () => {
        let studentEmail = String(payload['email'] || generated.studentEmail);
        let isStudentEmailGenerated = !payload['email'];
        let studentResult;
        let counter = 0;

        while (!studentResult) {
          try {
            studentResult = await createUserWithTemporaryPassword({
              displayName: String(payload['name']),
              fatherName: payload['fatherName'],
              parentName: payload['parentName'],
              courseId: payload['courseId'],
              classId: payload['classId'],
              classIds: payload['classId'] ? [payload['classId']] : [],
              groupId: payload['groupId'],
              groupIds: payload['groupId'] ? [payload['groupId']] : [],
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

        return {
          uid: studentResult.data.uid,
          label: String(payload['name']),
          email: studentResult.data.email,
          password,
          role: 'student' as UserRole
        };
      })() : Promise.resolve(null);

      const parentLoginTask = createParentLogin ? (async () => {
        let parentEmail = generated.parentEmail;
        const parentDisplayName = String(payload['parentName'] || `${payload['fatherName']} Parent`);
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

        return {
          uid: parentResult.data.uid,
          label: parentDisplayName,
          email: parentResult.data.email,
          password,
          role: 'parent' as UserRole
        };
      })() : Promise.resolve(null);

      const [sCred, pCred] = await Promise.all([studentLoginTask, parentLoginTask]);
      studentCredential = sCred;
      parentCredential = pCred;

    } catch (error: any) {
      console.error('Failed to create student/parent access:', error);
      let message = 'Failed to create student/parent access.';
      if (error?.code === 'functions/already-exists') {
        message = 'The email is already in use by another account.';
      } else if (error?.message) {
        message = error.message;
      }
      this.snackBar.open(message, 'Close', { duration: 7000, panelClass: ['error-snackbar'] });
      throw error;
    }

    let parentId = '';
    if (parentCredential) {
      parentId = await this.repo.create('parents', {
        name: parentCredential.label,
        email: parentCredential.email,
        generatedEmail: parentCredential.email,
        userId: parentCredential.uid,
        linkedStudentIds: [],
        organizationId: payload.organizationId,
        madrasaId,
        status: 'active',
      }, profile);
    }

    const studentId = await this.repo.create('students', {
      ...payload,
      userId: studentCredential?.uid || '',
      parentId: parentId || '',
      parentUserId: parentCredential?.uid || '',
      parentName: parentCredential?.label || payload['parentName'] || `${payload['fatherName']} Parent`,
      parentEmail: parentCredential?.email || '',
      email: studentCredential?.email || payload['email'] || '',
      status: payload.status ?? 'active',
      credentialStatus: studentCredential ? 'TEMP_PASSWORD_PENDING' : 'NO_LOGIN',
    }, profile);

    const postCreateTasks: Promise<any>[] = [];

    if (parentId && parentCredential) {
      postCreateTasks.push(this.repo.update('parents', parentId, { linkedStudentIds: [studentId] }, profile));
      if (parentCredential.uid) {
        postCreateTasks.push(this.repo.update('users', parentCredential.uid, {
          entityId: parentId,
          entityType: 'parent',
          linkedStudentIds: [studentId],
          studentIds: [studentId],
          updatedAt: new Date(),
        }, profile, true).catch(() => {}));
      }
    }

    if (studentCredential?.uid) {
      postCreateTasks.push(this.repo.update('users', studentCredential.uid, {
        entityId: studentId,
        entityType: 'student',
        studentIds: [studentId],
        updatedAt: new Date(),
      }, profile, true).catch(() => {}));
    }

    const joinMethod = String(payload['joinType'] || 'new').toLowerCase();
    const isRejoin = joinMethod === 'rejoin';

    postCreateTasks.push(this.repo.create('userLifecycleHistory', {
      userId: studentId,
      userName: studentCredential?.label || String(payload['name'] || 'Student'),
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
    }, profile).catch(e => console.warn('Failed to log student lifecycle join history', e)));

    await Promise.all(postCreateTasks);

    this.repo.clearCache('students');
    this.repo.clearCache('parents');
    this.repo.clearCache('users');

    const creds = [studentCredential, parentCredential].filter(Boolean);
    if (creds.length > 0) {
      this.credentials.splice(0, this.credentials.length, ...creds);
      this.snackBar.open('Student login credentials created. Save them before leaving this page.', 'Close', { duration: 7000 });
    }
  }

  private async buildFields(config: ManagementConfig, initial?: EntityRecord): Promise<QuickAddField[]> {
    const profile = await firstValueFrom(this.auth.profile$);
    const roleOptions = await this.rolePermissionsService.getAllRoleOptions(profile?.role);
    const options: Record<string, SelectOption[]> = {
      role: roleOptions,
      permissions: this.rolePermissionsService.getValidPermissionsForRole(
        config.fixedRole || (initial ? String(initial['role']) : undefined),
        profile?.role,
        profile?.permissions
      ),
    };

    const hasField = (key: string) => config.fields.some(f => f.key === key);

    const needsMadrasas = hasField('madrasaId') || hasField('madrasaIds') || hasField('classId') || hasField('classIds') || hasField('groupId') || hasField('groupIds');
    const needsClasses = hasField('classId') || hasField('classIds') || hasField('groupId') || hasField('groupIds');
    const needsClassGroups = hasField('classId') || hasField('classIds') || hasField('groupId') || hasField('groupIds');

    const [orgs, mads, courses, rawClasses, rawClassGroups, shifts, subjects, users, rawStaff, students] = await Promise.all([
      hasField('organizationId') ? this.repo.getAllOnce<EntityRecord>('organizations', profile) : Promise.resolve([]),
      needsMadrasas ? this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => []) : Promise.resolve([]),
      (hasField('courseId') || hasField('newCourseId')) ? this.repo.getAllOnce<EntityRecord>('courses', profile) : Promise.resolve([]),
      needsClasses ? this.repo.getAllOnce<EntityRecord>('classes', profile) : Promise.resolve([]),
      needsClassGroups ? this.repo.getAllOnce<EntityRecord>('classGroups', profile) : Promise.resolve([]),
      hasField('shiftId') ? this.repo.getAllOnce<EntityRecord>('shifts', profile).catch(() => []) : Promise.resolve([]),
      hasField('subjectIds') ? this.repo.getAllOnce<EntityRecord>('subjects', profile) : Promise.resolve([]),
      (hasField('coordinatorIds') || hasField('inchargeIds')) ? this.repo.getAllOnce<EntityRecord>('users', profile) : Promise.resolve([]),
      hasField('assignedStaffIds') ? this.repo.getAllOnce<EntityRecord>('staff', profile) : Promise.resolve([]),
      hasField('linkedStudentIds') ? this.repo.getAllOnce<EntityRecord>('students', profile) : Promise.resolve([]),
    ]);

    if (hasField('organizationId')) {
      options['organizationId'] = this.toOptions(orgs, 'name');
    }

    if (hasField('madrasaId') || hasField('madrasaIds')) {
      options['madrasaId'] = this.toOptions(mads, 'name');
      options['madrasaIds'] = this.toOptions(mads, 'name');
    }

    if (hasField('courseId') || hasField('newCourseId')) {
      options['courseId'] = this.toOptions(courses, 'name');
      options['newCourseId'] = this.toOptions(courses, 'name');
    }

    if (hasField('classId') || hasField('classIds')) {
      const classes = this.getScopedClasses(rawClasses, rawClassGroups, profile, mads);
      options['classId'] = this.toOptions(classes, 'name');
      options['classIds'] = this.toOptions(classes, 'name');
    }

    if (hasField('groupId') || hasField('groupIds')) {
      const classGroups = this.getScopedClassGroups(rawClassGroups, rawClasses, profile, mads);
      const groupOptions = classGroups.map(g => ({
        label: g['name'] as string,
        value: g.id as string,
        data: g,
        dependentOn: g['classId'] ? { field: 'classId', value: g['classId'] } : undefined
      }));
      if (hasField('groupId')) options['groupId'] = groupOptions;
      if (hasField('groupIds')) options['groupIds'] = groupOptions;
    }

    if (hasField('shiftId')) {
      if (shifts.length === 0) {
        const defaultNames = ['Morning', 'Evening', 'After Maghrib', 'Night'];
        options['shiftId'] = defaultNames.map(n => ({ label: n, value: n }));
      } else {
        options['shiftId'] = shifts.map(s => ({
          label: String(s['name']),
          value: String(s.id || s['name']),
          data: s
        }));
      }
    }

    if (hasField('subjectIds')) {
      options['subjectIds'] = this.toOptions(subjects, 'name');
    }

    if (hasField('coordinatorIds') || hasField('inchargeIds')) {
      if (hasField('coordinatorIds')) {
        options['coordinatorIds'] = this.toOptions(users.filter((user) => this.getEffectiveRoles(user).includes('coordinator')), 'displayName');
      }
      if (hasField('inchargeIds')) {
        options['inchargeIds'] = this.toOptions(users.filter((user) => this.getEffectiveRoles(user).includes('madrasaIncharge')), 'displayName');
      }
    }

    if (hasField('assignedStaffIds')) {
      const staffByIdentity = new Map<string, EntityRecord>();
      for (const s of rawStaff) {
        const email = String(s['email'] || '').toLowerCase().trim();
        const userId = String(s['userId'] || s['uid'] || '').trim();
        const identityKey = (email && email.includes('@')) ? email : (userId || String(s.id || ''));
        if (!identityKey) continue;
        if (!staffByIdentity.has(identityKey)) {
          staffByIdentity.set(identityKey, { ...s });
        } else {
          const existing = staffByIdentity.get(identityKey)!;
          const existingRoles: string[] = Array.isArray(existing['roles']) ? existing['roles'] as string[] : (existing['role'] ? [String(existing['role'])] : []);
          const newRoles: string[] = Array.isArray(s['roles']) ? s['roles'] as string[] : (s['role'] ? [String(s['role'])] : []);
          const merged = Array.from(new Set([...existingRoles, ...newRoles]));
          staffByIdentity.set(identityKey, { ...existing, roles: merged, role: merged[0] || existing['role'] });
        }
      }
      const staff = Array.from(staffByIdentity.values());
      options['assignedStaffIds'] = this.toStaffOptions(staff);
    }

    if (hasField('linkedStudentIds')) {
      options['linkedStudentIds'] = this.toOptions(students, 'name');
    }

    if (hasField('permissions')) {
      options['permissions'] = this.rolePermissionsService.getValidPermissionsForRole(
        config.fixedRole ?? (initial?.['role'] as string),
        profile?.role,
        profile?.permissions
      );
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

  private async initialDialogValue(config: ManagementConfig, initial?: EntityRecord): Promise<Record<string, unknown>> {
    if (!initial) {
      return {
        status: 'active',
        role: config.fixedRole ?? '',
        permissions: config.fixedRole ? this.rolePermissionsService.getPermissionsForRole(config.fixedRole) : [],
      };
    }

    if (config.resource === 'organizations') {
      const academicSettings = initial['academicSettings'] as any;
      return {
        ...initial,
        academicSettings_defaultDawrRounds: academicSettings?.defaultDawrRounds || 3,
      };
    }

    if (config.resource === 'madrasas') {
      const profile = await firstValueFrom(this.auth.profile$);
      const users = await this.repo.getAllOnce<EntityRecord>('users', profile).catch(() => []);
      const mId = extractId(initial.id);

      const inchargeSet = new Set<string>([
        ...this.asStringArray(initial['inchargeIds']),
        ...this.asStringArray(initial['inchargeId']),
        ...this.asStringArray(initial['incharge'])
      ]);

      const coordinatorSet = new Set<string>([
        ...this.asStringArray(initial['coordinatorIds']),
        ...this.asStringArray(initial['coordinatorId']),
        ...this.asStringArray(initial['coordinator'])
      ]);

      users.forEach(u => {
        const uId = extractId(u.id || u['uid']);
        if (!uId) return;
        const uMadrasaId = extractId(u['madrasaId']);
        const uMadrasaIds = Array.isArray(u['madrasaIds']) ? u['madrasaIds'].map(extractId) : [];
        const isBelongs = uMadrasaId === mId || uMadrasaIds.includes(mId);

        if (isBelongs) {
          const effectiveRoles = this.getEffectiveRoles(u);
          if (effectiveRoles.includes('madrasaIncharge')) {
            inchargeSet.add(uId);
          }
          if (effectiveRoles.includes('coordinator')) {
            coordinatorSet.add(uId);
          }
        }
      });

      return {
        ...initial,
        inchargeIds: Array.from(inchargeSet),
        coordinatorIds: Array.from(coordinatorSet)
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

    const userRole = String(initial['role'] || config.fixedRole || '');
    const userRoles: string[] = Array.isArray(initial['roles'])
      ? (initial['roles'] as string[])
      : (userRole ? [userRole] : []);
    if (userRole && !userRoles.includes(userRole)) userRoles.unshift(userRole);
    const userOrgId = String(initial['organizationId'] || '');

    // Use the user's stored `customPermissions` (extra permissions beyond role template) if present.
    // Union permissions across all assigned roles for multi-role users.
    const storedCustom = Array.isArray(initial['customPermissions']) ? initial['customPermissions'] as PermissionKey[] : undefined;
    const effectivePermissions = userRoles.length > 0
      ? Array.from(new Set([
          ...(Array.isArray(initial['permissions']) ? initial['permissions'] as PermissionKey[] : []),
          ...userRoles.flatMap(r => this.rolePermissionsService.getPermissionsForRole(r, storedCustom, userOrgId))
        ]))
      : (Array.isArray(initial['permissions']) ? initial['permissions'] : []);

    return {
      ...initial,
      permissions: effectivePermissions,
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

    if (config.resource === 'organizations') {
      if ('academicSettings_defaultDawrRounds' in payload) {
        payload['academicSettings'] = {
          defaultDawrRounds: Number(payload['academicSettings_defaultDawrRounds']) || 3,
        };
        delete payload['academicSettings_defaultDawrRounds'];
      }
    }

    if (config.resource === 'courses') {
      let stages = this.normalizeStages(payload['stages']);
      const courseType = String(payload['type'] || 'custom').toLowerCase();
      if (!stages || stages.length === 0) {
        stages = DEFAULT_STAGES_BY_COURSE_TYPE[courseType] || [];
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

    if (config.fixedRole === 'teacher' || config.resource === 'staff') {
      const allowed = ['teacher', 'staff', 'coordinator', 'madrasaincharge', 'organizationadmin', 'ustadh', 'stagehead', 'headteacher', 'teacher_assistant'];
      return rows.filter((row) => {
        const effective = this.getEffectiveRoles(row);
        return effective.some(r => allowed.includes(r.toLowerCase()));
      });
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
      organizationName: row['organizationName'] || '-',
      madrasaNames: row['madrasaNames'] || '-',
      courseName: row['courseName'] || '-',
      className: row['className'] || '-',
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

    return decorated;
  }

  private toOptions(rows: EntityRecord[], labelKey: string): SelectOption[] {
    const uniqueMap = new Map<string, EntityRecord>();
    for (const row of rows) {
      const key = String(row.id || row['uid'] || row['docId'] || row['email']);
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, row);
      }
    }
    const uniqueRows = Array.from(uniqueMap.values());

    const labelCounts = new Map<string, number>();
    for (const row of uniqueRows) {
      const lbl = String(row[labelKey] || row['displayName'] || row['name'] || row['email'] || row.id).trim();
      labelCounts.set(lbl, (labelCounts.get(lbl) || 0) + 1);
    }

    return uniqueRows.map((row) => {
      const baseLabel = String(row[labelKey] || row['displayName'] || row['name'] || row['email'] || row.id).trim();
      const isDuplicate = (labelCounts.get(baseLabel) || 0) > 1;
      let finalLabel = baseLabel;
      if (isDuplicate) {
        // Use human-readable disambiguation — code, type, or madrasa name — never raw UID
        const extra = row['code'] || row['madrasaName'] || row['type'];
        finalLabel = extra ? `${baseLabel} (${extra})` : baseLabel;
      }
      return {
        label: finalLabel,
        value: String(row.id || row['uid'] || row['email']),
        data: row
      };
    });
  }

  /** Staff-specific options builder that shows role label as sublabel instead of raw UID. */
  private toStaffOptions(staff: EntityRecord[]): SelectOption[] {
    const ROLE_MAP: Record<string, string> = {
      teacher: 'Teacher',
      staff: 'Staff',
      madrasaIncharge: 'Madrasa Incharge',
      madrasaincharge: 'Madrasa Incharge',
      coordinator: 'Coordinator',
      organizationAdmin: 'Admin',
      organizationadmin: 'Admin',
      ustadh: 'Ustadh',
      stageHead: 'Stage Head',
      stagehead: 'Stage Head',
      headTeacher: 'Head Teacher',
      headteacher: 'Head Teacher',
      teacher_assistant: 'Teacher Assistant',
    };
    const getRoleLabel = (s: EntityRecord): string => {
      const roles: string[] = Array.isArray(s['roles']) ? (s['roles'] as string[]) : [];
      const single = String(s['role'] || '').trim();
      const all = roles.length > 0 ? roles : (single ? [single] : []);
      const labels = all.map(r => ROLE_MAP[r] || ROLE_MAP[r.toLowerCase()] || '').filter(Boolean);
      return labels.length > 0 ? labels.join(' / ') : (single || '');
    };

    return staff.map(s => {
      const name = String(s['name'] || s['displayName'] || s['email'] || '').trim();
      const roleLabel = getRoleLabel(s);
      return {
        label: name,
        value: String(s.id || s['uid'] || s['email']),
        data: { ...s, role: roleLabel || s['role'] },  // put readable label in data.role for template
      };
    });
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

  downloadStaffReportCsv(rows: EntityRecord[]): void {
    const csvRows = rows.map(row => {
      const groups = row['assignedClassGroup'] || row['groupName'] || row['group'] || row['section'] || 'Unassigned';
      const madrasas = row['madrasaNames'] || row['madrasaName'] || row['madrasa'] || 'Unassigned';
      return {
        'Staff Name': row['displayName'] || row['name'] || '',
        'Email': row['email'] || '',
        'Mobile Number': row['mobileNumber'] || row['phone'] || row['mobile'] || 'N/A',
        'Gender': row['gender'] || 'N/A',
        'Role': this.formatRole(row['role'] || row['roles']),
        'Assigned Madrasa(s)': String(madrasas),
        'Assigned Class Group(s)': String(groups),
        'Status': row['status'] || 'active',
        'Credential Status': this.getCredentialStatusLabel(row)
      };
    });

    const csv = this.csv.toCsv(csvRows);
    this.csv.download(`staff-assigned-groups-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  private formatRole(roleVal: any): string {
    if (!roleVal) return 'N/A';
    const roles: string[] = Array.isArray(roleVal) ? roleVal.map(String) : [String(roleVal)];
    const labels = ROLE_LABELS as Record<string, string>;
    return roles.map(r => labels[r] || labels[r.toLowerCase()] || r).join(', ');
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

  onPageChange(event: any): void {
    if (!event) return;
    if (typeof event.pageIndex === 'number') {
      this.pageIndex$.next(event.pageIndex);
    }
    if (typeof event.pageSize === 'number') {
      this.pageSize$.next(event.pageSize);
    }
  }
}