export type UserRole =
  | 'superAdmin'
  | 'organizationAdmin'
  | 'coordinator'
  | 'madrasaIncharge'
  | 'teacher'
  | 'student'
  | 'parent';

export type EntityStatus = 'active' | 'pending' | 'disabled' | 'archived';

export type PermissionKey =
  | 'viewDashboard'
  | 'manageOrganizations'
  | 'manageMadrasas'
  | 'manageUsers'
  | 'manageCoordinators'
  | 'manageIncharges'
  | 'manageStaff'
  | 'manageStudents'
  | 'manageParents'
  | 'manageCourses'
  | 'manageClasses'
  | 'manageSubjects'
  | 'takeAttendance'
  | 'viewAttendance'
  | 'generateReports'
  | 'importCsv'
  | 'manageNotifications'
  | 'editProfile'
  | 'viewAnalytics'
  | 'manageSettings'
  | 'managePermissions'
  | 'manageAcademicPlans'
  | 'managePromotions'
  | 'managePasswordRequests';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface AuditFields {
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface ScopedEntity extends AuditFields {
  id?: string;
  organizationId?: string;
  madrasaId?: string;
  status?: EntityStatus | AttendanceStatus | string;
}

export interface AppUser extends AuditFields {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: PermissionKey[];
  status: EntityStatus;
  organizationId?: string;
  madrasaId?: string;
  madrasaIds: string[];
  classIds: string[];
  subjectIds: string[];
  teacherIds?: string[];
  studentIds: string[];
  linkedStudentIds: string[];
  parentId?: string;
  coordinatorId?: string;
  madrasaInchargeId?: string;
  authProvider: 'google' | 'password' | 'generated' | 'unknown';
  phone?: string;
  photoURL?: string;
  gender?: string;
  lastLoginAt?: unknown;
  mustChangePassword?: boolean;
  passwordChangedAt?: unknown;
  temporaryPasswordForAdminView?: string;
}

export interface Organization extends ScopedEntity {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  adminUserIds: string[];
  primaryOrganizerId?: string;
  primaryOrganizerEmail?: string;
  primaryOrganizerName?: string;
  /** @deprecated Legacy field. Temporary passwords are now stored in AppUser.temporaryPasswordForAdminView */
  organizerPassword?: string;
}

export interface Madrasa extends ScopedEntity {
  name: string;
  code: string;
  coordinatorIds: string[];
  inchargeIds: string[];
  address?: string;
}

export interface Course extends ScopedEntity {
  name: string;
  code: string;
  type: 'maktab' | 'hifz' | 'aalim' | 'muballigh' | 'custom';
  stages: string[];
  levels: string[];
  description?: string;
}

export interface AcademicClass extends ScopedEntity {
  name: string;
  courseId: string;
  stageOrLevel?: string;
  teacherIds: string[];
}

export interface Subject extends ScopedEntity {
  name: string;
  code: string;
  courseId?: string;
  classId?: string;
  teacherIds: string[];
}

export interface Student extends ScopedEntity {
  userId?: string;
  parentId?: string;
  name: string;
  fatherName: string;
  dateOfBirth: string;
  email?: string;
  generatedEmail?: string;
  courseId?: string;
  classId?: string;
  stage?: string;
  level?: string;
  teacherIds: string[];
}

export interface Parent extends ScopedEntity {
  userId?: string;
  name: string;
  email?: string;
  generatedEmail?: string;
  phone?: string;
  linkedStudentIds: string[];
}

export interface Staff extends ScopedEntity {
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  madrasaIds: string[];
  classIds: string[];
  subjectIds: string[];
}

export interface AttendanceRecord extends Omit<ScopedEntity, 'status'> {
  date: string;
  courseId?: string;
  classId?: string;
  subjectId?: string;
  studentId: string;
  teacherId?: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface NotificationItem extends ScopedEntity {
  title: string;
  message: string;
  type:
  | 'approval'
  | 'passwordReset'
  | 'passwordResetRequest'
  | 'attendance'
  | 'promotion'
  | 'hifzPlan'
  | 'report'
  | 'csvImport'
  | 'profile';
  recipientUserIds: string[];
  recipientRole?: UserRole;
  relatedRequestId?: string;
  readBy: string[];
  severity: 'info' | 'success' | 'warning' | 'danger';
}

export interface PromotionHistory extends ScopedEntity {
  studentId: string;
  previousCourseId?: string;
  previousStageOrLevel?: string;
  newCourseId?: string;
  newStageOrLevel?: string;
  reason: string;
  action: 'promotion' | 'demotion';
  actionDate: string;
}

export interface CsvImportLog extends ScopedEntity {
  module: string;
  totalRows: number;
  validRows: number;
  failedRows: number;
  skippedRows: number;
  errors: string[];
}

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'status' | 'role' | 'list' | 'temporaryPassword' | 'credentialStatus' | 'avatar' | 'boolean' | 'idRef';
  referenceType?: 'organization' | 'madrasa' | 'user' | 'course' | 'class' | 'subject' | 'student' | 'parent' | 'staff' | 'teacher' | 'coordinator' | 'incharge';
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface QuickAddField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'date' | 'textarea' | 'select' | 'multiselect' | 'info';
  required?: boolean;
  options?: SelectOption[];
  quickAddResource?: string;
  placeholder?: string;
}

export interface GeneratedCredential {
  uid?: string;
  label: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface PasswordResetRequest extends ScopedEntity {
  requesterEmail: string;
  normalizedEmail?: string;
  source?: 'LOGIN_PAGE' | 'DASHBOARD';
  requesterUid?: string | null;
  requesterName?: string | null;
  requesterRole?: UserRole | null;
  assignedToUid?: string | null;
  assignedToName?: string | null;
  assignedToRole?: UserRole | null;
  status: 'PENDING' | 'ASSIGNED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  requestMessage?: string;
  emailType?: 'CUSTOM_INTERNAL_EMAIL' | 'REAL_EMAIL' | 'UNKNOWN';
}
