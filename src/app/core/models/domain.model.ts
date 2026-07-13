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
  | 'managePasswordRequests'
  | 'manageClassPlans'
  | 'manageFees'
  | 'viewFees';

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
  
  entityId?: string;
  entityType?: 'staff' | 'student' | 'parent';

  organizationId?: string;
  madrasaId?: string;
  
  // These fields are merged in from the business entity after login
  madrasaIds?: string[];
  classIds?: string[];
  subjectIds?: string[];
  studentIds?: string[];
  linkedStudentIds?: string[];
  parentId?: string;
  coordinatorId?: string;
  madrasaInchargeId?: string;
  mobileNumber?: string;
  gender?: string;

  authProvider: 'google' | 'password' | 'generated' | 'unknown';
  photoURL?: string;
  lastLoginAt?: unknown;
  mustChangePassword?: boolean;
  passwordChangedAt?: unknown;
  temporaryPasswordForAdminView?: string;
}

export interface Organization extends ScopedEntity {
  name: string;
  code: string;
  email?: string;
  mobileNumber?: string;
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
}

export interface ClassGroup extends ScopedEntity {
  name: string;
  code?: string;
  description?: string;
  classId: string;
  courseId?: string;
  assignedStaffIds: string[];
  studentCount: number;
  capacity?: number;
  displayOrder: number;
  color?: string;
  isDefault: boolean;
}

export interface Subject extends ScopedEntity {
  name: string;
  code: string;
  courseId?: string;
  classId?: string;
}

export interface Student extends ScopedEntity {
  userId?: string; // The linked AppUser uid
  parentId?: string;
  name: string;
  fatherName: string;
  dateOfBirth: string;
  email?: string;
  generatedEmail?: string;
  courseId?: string;
  classId?: string;
  groupId?: string;
  stage?: string;
  level?: string;
  mobileNumber?: string;
}

export interface Parent extends ScopedEntity {
  userId?: string; // The linked AppUser uid
  name: string;
  email?: string;
  generatedEmail?: string;
  mobileNumber?: string;
  linkedStudentIds: string[];
}

export interface Staff extends ScopedEntity {
  userId?: string; // The linked AppUser uid
  name: string;
  email: string;
  role: UserRole; // Primary role
  roles?: UserRole[]; // Multiple roles array for scalable support
  madrasaIds: string[];
  mobileNumber?: string;
}

export interface AttendanceRecord extends Omit<ScopedEntity, 'status'> {
  date: string;
  courseId?: string;
  classId?: string;
  groupId?: string;
  subjectId?: string;
  studentId: string;
  teacherId?: string;
  status: AttendanceStatus;
  notes?: string;
  classPlanId?: string;
  timetableEntryId?: string;
  activityName?: string;
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
  previousStage?: string;
  newCourseId?: string;
  newStage?: string;
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
  type?: 'text' | 'date' | 'status' | 'role' | 'list' | 'temporaryPassword' | 'credentialStatus' | 'avatar' | 'boolean' | 'idRef' | 'staffChips';
  referenceType?: 'organization' | 'madrasa' | 'user' | 'course' | 'class' | 'classGroup' | 'subject' | 'student' | 'parent' | 'staff' | 'teacher' | 'coordinator' | 'incharge';
}

export interface SelectOption {
  label: string;
  value: string;
  data?: any;
}

export interface QuickAddField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'date' | 'textarea' | 'select' | 'multiselect' | 'button-toggle' | 'info' | 'mobileNumber' | 'hidden';
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

export interface ClassPlan extends ScopedEntity {
  courseId: string;
  courseName: string;
  classId: string;
  className: string;
  groupId?: string;
  groupName?: string;
  title: string;
  scheduleType: 'oneTime' | 'weekly' | 'monthly' | 'customDates';
  startDate: string;
  endDate: string | null;
  selectedDates: string[];
  weekDays: string[];
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  autoGenerateAttendance: boolean;
  autoMarkStudentsPresent: boolean;
  autoMarkStaffPresent: boolean;
  notes?: string;
  createdByName?: string;
}

export interface ClassPlanException extends ScopedEntity {
  classPlanId: string;
  classId: string;
  className: string;
  date: string;
  type: 'holiday' | 'suddenLeave' | 'cancelled' | 'rescheduled' | 'teacherReplacement' | 'roomChange' | 'timeChange' | 'subjectChange' | 'extraClass';
  reason?: string;
  originalStartTime: string;
  originalEndTime: string;
  rescheduledDate: string | null;
  rescheduledStartTime?: string;
  rescheduledEndTime?: string;
  timetableEntryId?: string | null; // For single session override
  newTeacherId?: string | null; // For teacher replacement
  newRoomId?: string | null; // For room change
  newSubjectId?: string | null; // For subject change
  affectsAttendance: boolean;
  createdByName?: string;
}

export interface TimetableEntry extends ScopedEntity {
  classPlanId: string;
  groupId?: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  scheduleType?: 'period' | 'fullDay'; // 'period' by default
  startTime?: string; // HH:mm, optional for fullDay
  endTime?: string; // HH:mm, optional for fullDay
  activityName: string;
  teacherId?: string;
  teacherIds?: string[];
  subjectId?: string;
  roomId?: string;
  description?: string;
  status: 'active' | 'cancelled' | 'completed';
}

export interface ClassPlanAttendance extends ScopedEntity {
  classPlanId: string;
  courseId: string;
  courseName: string;
  classId: string;
  className: string;
  groupId?: string;
  groupName?: string;
  date: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  timetableEntryId?: string;
  activityName?: string;
  type: 'class';
  status: 'draft' | 'confirmed' | 'cancelled';
  studentIds: string[];
  staffIds: string[];
  students: {
    studentId: string;
    studentName: string;
    status: AttendanceStatus;
    markedBy?: string;
    markedAt?: string | null;
  }[];
  staff: {
    staffId: string;
    staffName: string;
    role: string;
    status: AttendanceStatus;
    markedBy?: string;
    markedAt?: string | null;
  }[];
  autoGenerated: boolean;
}

export interface StudentTransferHistory extends ScopedEntity {
  studentId: string;
  previousMadrasaId?: string;
  previousCourseId?: string;
  previousClassId?: string;
  previousGroupId?: string;
  newMadrasaId?: string;
  newCourseId?: string;
  newClassId?: string;
  newGroupId?: string;
  reason: string;
  actionDate: string;
}

// ==========================================
// Fee Management Models
// ==========================================

export type FeeType =
  | 'yearly'
  | 'monthly'
  | 'amalCard'
  | 'admission'
  | 'exam'
  | 'transport'
  | 'custom';

export type PaymentPeriod = 'oneTime' | 'monthly' | 'yearly' | 'customRange';
export type FeePaymentStatus = 'paid' | 'notPaid' | 'partialPaid';
export type PaymentMethod = 'cash' | 'bankTransfer' | 'upi' | 'cheque' | 'online' | 'other';

export interface FeePlan extends ScopedEntity {
  title: string;
  feeType: FeeType;
  amount: number;
  paymentPeriod: PaymentPeriod;
  startDate: string;
  endDate: string;
  applicableMadrasaId?: string;
  applicableCourseId?: string;
  applicableClassId?: string;
  applicableGroupId?: string;
  applicableStudentIds?: string[];
  responsibleStaffId?: string;
  responsibleStaffName?: string;
  notes?: string;
  assignedCount?: number;
  collectedAmount?: number;
  pendingAmount?: number;
}

export interface FeeAssignment extends ScopedEntity {
  feePlanId: string;
  feePlanTitle?: string;
  studentId: string;
  studentName?: string;
  feeType?: FeeType;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: FeePaymentStatus;
  dueDate: string;
  lastPaymentDate?: string;
}

export interface FeePayment extends ScopedEntity {
  feePlanId: string;
  feeAssignmentId: string;
  studentId: string;
  studentName?: string;
  amountPaid: number;
  balanceAfterPayment: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  receiptNumber?: string;
  remarks?: string;
  collectedByStaffId?: string;
  collectedByStaffName?: string;
}

