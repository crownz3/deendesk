import { Timestamp } from 'firebase/firestore';

export type UserRole =
  | 'superAdmin'
  | 'organizationAdmin'
  | 'coordinator'
  | 'madrasaIncharge'
  | 'stageHead'
  | 'teacher'
  | 'student'
  | 'parent';

export interface CourseStageAssignment {
  courseId: string;
  stage?: string;
  madrasaId?: string;
  genderScope?: 'male' | 'female' | 'all';
}

export type EntityStatus = 'active' | 'pending' | 'disabled' | 'archived';

export type PermissionKey =
  | 'viewDashboard'
  | 'manageOrganizations'
  | 'manageMadrasas'
  | 'manageUsers'
  | 'manageCoordinators'
  | 'manageIncharges'
  | 'manageStaff'
  | 'manageStageHeads'
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
  | 'viewFees'
  | 'viewEvents'
  | 'manageEvents'
  | 'recordEventAttendance'
  | 'rescheduleEvents'
  | 'completeEvents'
  | 'viewIssues'
  | 'reportIssues'
  | 'manageIssues'
  | 'viewConfidentialIssues'
  | 'closeIssues'
  | 'reopenIssues'
  | 'viewProperties'
  | 'manageProperties'
  | 'reportPropertyDamage'
  | 'transferProperties'
  | 'disposeProperties'
  | 'viewLifecycleHistory'
  | 'manageUserLifecycle'
  | 'dismissStaff'
  | 'dismissStudents'
  | 'relieveStaff'
  | 'rejoinStaff'
  | 'rejoinStudents'
  | 'transferStaff'
  | 'transferStudents'
  | 'generateEventReports'
  | 'generateIssueReports'
  | 'generatePropertyReports'
  | 'generateLifecycleReports'
  | 'viewFirebaseUsage'
  | 'manageFirebaseUsage';

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
  assignedCourseIds?: string[];
  assignedStages?: string[];
  assignedCourseStages?: CourseStageAssignment[];
  genderScope?: 'male' | 'female' | 'all';
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
  hasSubjects?: boolean;
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
  assignedCourseIds?: string[];
  assignedStages?: string[];
  assignedCourseStages?: CourseStageAssignment[];
  genderScope?: 'male' | 'female' | 'all';
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
  | 'profile'
  | 'staffAssignment'
  | 'event';
  recipientUserIds: string[];
  recipientRole?: UserRole;
  relatedRequestId?: string;
  readBy: string[];
  severity: 'info' | 'success' | 'warning' | 'danger';
}

export interface AcademicMovementLog extends ScopedEntity {
  studentId: string;
  studentName: string;
  movementType: 'TRANSFER' | 'DEMOTION' | 'PROMOTION' | 'RE_MEMORIZE_RESET';
  fromCourseId: string;
  fromCourseName: string;
  toCourseId: string;
  toCourseName: string;
  fromClassId?: string;
  toClassId?: string;
  fromGroupId?: string;
  toGroupId?: string;
  reason?: string;
  reMemorizePortion?: string;
  effectiveDate: string;
  approvedBy: string;
  approvedByName?: string;
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
  type: 'text' | 'email' | 'password' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'multiselect' | 'button-toggle' | 'info' | 'mobileNumber' | 'hidden';
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
  courseType?: 'hifz' | 'aalim' | 'maktab' | 'muallim' | 'muballigh' | 'custom';
  subjectId?: string;
  subjectName?: string;
  academicPlanId?: string;
  academicPlanName?: string;
  classId: string;
  className: string;
  groupId?: string;
  groupName?: string;
  title: string;
  scheduleType: 'oneTime' | 'weekly' | 'monthly' | 'customDates' | 'dateRange';
  startDate: string;
  endDate: string | null;
  selectedDates: string[];
  weekDays: string[];
  dailySyllabusSchedule?: {
    date: string;
    dayOfWeek: string;
    subjectName?: string;
    bookName?: string;
    lessonName?: string;
    startPage?: number;
    endPage?: number;
    sabaqTarget?: string;
    sabqiTarget?: string;
    manzilTarget?: string;
    isHoliday?: boolean;
    isExam?: boolean;
  }[];
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
  subjectName?: string;
  roomId?: string;
  description?: string;
  status: 'active' | 'cancelled' | 'completed';

  courseType?: 'hifz' | 'aalim' | 'maktab' | 'muallim' | 'muballigh' | 'custom';
  bookName?: string;
  lessonName?: string;
  startPage?: number | null;
  endPage?: number | null;
  dailyTargetPages?: number | null;
  unitType?: 'pages' | 'hadith' | 'lessons' | 'paras' | 'chapters';
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
  substituteTeacherId?: string;
  substituteTeacherName?: string;
  isSubstituteConducted?: boolean;
  studentIds: string[];
  staffIds: string[];
  students: {
    studentId: string;
    studentName: string;
    status: AttendanceStatus;
    performanceRating?: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'NOT_PERFORMED';
    portionCovered?: string;
    mistakeCount?: number;
    hesitationCount?: number;
    lineNumbers?: string;
    wordDetails?: string;
    struggledAreas?: ('SABAQ' | 'SABQI' | 'MANZIL' | 'TAJWEED' | 'MEMORIZATION' | 'UNDERSTANDING')[];
    hasPersonalizedPlan?: boolean;
    personalizedTargetDate?: string;
    personalizedTargetPortion?: string;
    remedialStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
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

export interface LifecycleSnapshot {
  personName: string;
  employeeOrAdmissionNumber: string;
  madrasaName: string;
  roleName: string;
  courseName: string;
  className: string;
  groupName: string;
}

export interface EventEntity extends ScopedEntity {
  name: string;
  description: string;
  eventType: 'emergency' | 'scheduled' | 'academic' | 'religious' | 'staffMeeting' | 'studentProgramme' | 'parentMeeting' | 'competition' | 'awareness' | 'annual' | 'custom';
  customEventType?: string;
  venueLevel: 'organization' | 'madrasa' | 'external';
  madrasaVenueId?: string;
  customVenueName?: string;
  venueAddress: string;
  startDate: Timestamp;
  endDate: Timestamp;
  allDay: boolean;
  conductorType: 'internal' | 'external';
  conductorStaffId?: string;
  externalConductorDetails?: string;
  specialGuestDetails?: string;
  chiefGuestDetails?: string;
  staffInChargeId: string;
  additionalResponsibleStaffIds: string[];
  attendanceRequired: boolean;
  targetAudienceType: 'all' | 'courses' | 'classes' | 'classGroups' | 'selective';
  targetCourseIds: string[];
  targetClassIds: string[];
  targetClassGroupIds: string[];
  selectedStaffIds: string[];
  selectedStudentIds: string[];
  entireMadrasaParticipation: boolean;
  instructions?: string;
  estimatedBudget?: number;
  actualExpense?: number;
  attachments?: Array<{ name: string; url: string }>;
  
  // Soft delete & tracking fields
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deactivationReason?: string;
}

export interface EventParticipant extends ScopedEntity {
  eventId: string;
  participantId: string;
  participantType: 'staff' | 'student' | 'invitee' | 'external';
  participantNameSnapshot: string;
  courseId?: string;
  classId?: string;
  classGroupId?: string;
  isRequired: boolean;
  invitationStatus: 'invited' | 'confirmed' | 'declined' | 'tentative';
  attendanceStatus: 'present' | 'absent' | 'excused' | 'notApplicable';
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface EventAttendance extends ScopedEntity {
  eventId: string;
  participantId: string;
  participantType: 'staff' | 'student' | 'invitee' | 'external';
  participantName: string;
  status: 'present' | 'absent' | 'excused' | 'notApplicable';
  markedBy: string;
  markedAt: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface EventScheduleHistory extends ScopedEntity {
  eventId: string;
  previousStartDate: Timestamp;
  previousEndDate: Timestamp;
  newStartDate: Timestamp;
  newEndDate: Timestamp;
  changeType: 'reschedule' | 'postpone' | 'prepone';
  reason: string;
  changedBy: string;
  changedAt: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
}

export interface IssueCategory extends ScopedEntity {
  name: string;
  description?: string;
  severityDefault?: 'low' | 'medium' | 'high' | 'critical';
  defaultSeverity?: 'low' | 'medium' | 'high' | 'critical';
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
  personInvolved: boolean;
  infrastructureInvolved?: boolean;
  assetInvolved?: boolean;
  evidenceRequired: boolean;
  defaultResolutionDeadlineDays?: number;
  defaultResolutionDays?: number;
  confidentialByDefault?: boolean;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface Issue extends ScopedEntity {
  title: string;
  description: string;
  categoryId: string;
  subcategoryName?: string;
  customCategoryName?: string;
  reportedAt: Timestamp;
  incidentAt: Timestamp;
  reportedBy: string;
  reporterRole: string;
  reporterContact?: string;
  personAgainstUid?: string;
  personAgainstName?: string;
  personAffectedUid?: string;
  personAffectedName?: string;
  staffIds: string[];
  studentIds: string[];
  parentIds: string[];
  externalPersonDetails?: string;
  location?: string;
  assetId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidential: boolean;
  evidenceAttachments?: Array<{ name: string; url: string }>;
  assignedCoordinatorId?: string;
  assignedMadrasaInchargeId?: string;
  assignedStaffId?: string;
  dueDate: Timestamp;
  followUpRequired: boolean;
  followUpDate?: Timestamp;
  closedBy?: string;
  closedAt?: Timestamp;
  
  // Soft delete & tracking fields
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deactivationReason?: string;
}

export interface IssuePrivateDetails {
  id?: string;
  issueId: string;
  organizationId: string;
  madrasaId?: string;
  personAgainstDetails?: string;
  personAffectedDetails?: string;
  staffIds?: string[];
  studentIds?: string[];
  parentIds?: string[];
  externalPersonDetails?: string;
  investigationNotes?: string;
  investigationSummary?: string;
  safeguardingDetails?: string;
  disciplinaryRecommendation?: string;
  internalNotes?: string;
  resolution?: string;
  actionTaken?: string;
  closedBy?: string;
  closedAt?: Timestamp;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface IssueInternalNote {
  id?: string;
  issueId: string;
  organizationId: string;
  madrasaId?: string;
  note: string;
  noteType?: 'general' | 'confidential' | 'safeguarding' | 'action';
  createdBy: string;
  createdByName?: string;
  createdByNameSnapshot?: string;
  createdAt: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  isEdited?: boolean;
  editedAt?: Timestamp;
}

export interface IssueStatusHistory {
  id?: string;
  issueId: string;
  organizationId: string;
  madrasaId?: string;
  previousStatus: string;
  newStatus: string;
  notes?: string;
  reason?: string;
  changedBy: string;
  changedByName?: string;
  changedByNameSnapshot?: string;
  changedAt: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
}

export interface AssetCategory extends ScopedEntity {
  name: string;
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface Asset extends ScopedEntity {
  name: string;
  categoryId: string;
  customCategoryName?: string;
  assetCode: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  description?: string;
  quantity: number;
  unit: string;
  purchaseDate: Timestamp;
  purchaseAmount?: number;
  vendor?: string;
  billAttachmentUrl?: string;
  warrantyStartDate?: Timestamp;
  warrantyEndDate?: Timestamp;
  currentCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'broken';
  location?: string;
  personResponsibleId?: string;
  personResponsibleName?: string;
  inchargeResponsibleId?: string;
  inchargeResponsibleName?: string;
  maintenanceFrequencyDays?: number;
  lastMaintenanceDate?: Timestamp;
  nextMaintenanceDate?: Timestamp;
  notes?: string;
  photoUrl?: string;
  
  // Soft delete & tracking fields
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deactivationReason?: string;
}



// ==========================================
// LIFECYCLE STATUS & SNAPSHOT TYPES
// ==========================================

export type LifecycleStatus =
  | 'pending'
  | 'invited'
  | 'active'
  | 'suspended'
  | 'inactive'
  | 'transferred'
  | 'dismissed'
  | 'relieved'
  | 'resigned'
  | 'terminated'
  | 'retired'
  | 'graduated'
  | 'courseCompleted'
  | 'withdrawn'
  | 'archived'
  | 'rejoinPending'
  | 'rejoined'
  | 'deceased';

export type StudentExitReason =
  | 'graduated'
  | 'courseCompleted'
  | 'transferred'
  | 'dismissedForDiscipline'
  | 'dismissedForAttendance'
  | 'dismissedForFees'
  | 'parentRequest'
  | 'relocation'
  | 'healthReason'
  | 'duplicateAdmission'
  | 'incorrectAdmission'
  | 'other';

export type StaffExitReason =
  | 'resigned'
  | 'contractCompleted'
  | 'relieved'
  | 'terminated'
  | 'retired'
  | 'transferred'
  | 'longAbsence'
  | 'performanceReason'
  | 'disciplinaryReason'
  | 'organizationRestructure'
  | 'other';

export type ParentExitReason =
  | 'studentLeft'
  | 'relationshipChanged'
  | 'duplicateAccount'
  | 'inactiveGuardian'
  | 'accessRevoked'
  | 'other';

export interface LifecycleSnapshot {
  name?: string;
  email?: string;
  role?: string;
  madrasaIds?: string[];
  madrasaId?: string;
  courseId?: string;
  classId?: string;
  groupId?: string;
  designationTitle?: string;
  admissionNumber?: string;
  rollNumber?: string;
  academicYear?: string;
  joiningDate?: string;
  employmentType?: string;
  capturedAt: string; // ISO string
}

export interface UserLifecycleHistory extends ScopedEntity {
  userId: string;
  operationalRecordId?: string;
  personType: 'coordinator' | 'madrasaIncharge' | 'teacher' | 'staff' | 'student' | 'parent';
  previousMadrasaIds: string[];
  newMadrasaIds: string[];
  previousRole?: string;
  newRole?: string;
  previousCourseId?: string;
  newCourseId?: string;
  previousClassId?: string;
  newClassId?: string;
  previousGroupId?: string;
  newGroupId?: string;
  lifecycleAction: 'firstJoining' | 'rejoining' | 'transfer' | 'promotion' | 'roleChange' | 'madrasaReassignment' | 'suspension' | 'relief' | 'resignation' | 'dismissal' | 'retirement' | 'courseCompletion' | 'dropout' | 'reactivation' | 'custom';
  effectiveDate: Timestamp;
  reason?: string;
  detailedNotes?: string;
  supportingDocumentUrl?: string;
  approvedByUid?: string;
  approvedByName?: string;
  actionPerformedByUid: string;
  actionPerformedByName: string;
  previousStatus?: string;
  newStatus?: string;
  snapshot: LifecycleSnapshot;
  // Extended fields (Phase 5)
  lifecycleRecordId?: string;
  approvalStatus?: 'notRequired' | 'pending' | 'approved' | 'rejected';
  clearanceStatus?: 'notRequired' | 'pending' | 'cleared' | 'overridden';
  notificationSent?: boolean;
  isActive: boolean;
  isDeleted: boolean;
}

export interface UserServicePeriod extends ScopedEntity {
  userId: string;
  operationalRecordId?: string;
  personType: 'coordinator' | 'madrasaIncharge' | 'teacher' | 'staff' | 'student' | 'parent';
  madrasaIds: string[];
  role: string;
  courseId?: string;
  classId?: string;
  classGroupId?: string;
  joiningType: 'new' | 'rejoining';
  joiningAt: Timestamp;
  exitType?: 'relief' | 'resignation' | 'dismissal' | 'retirement' | 'dropout' | 'courseCompletion' | 'transfer';
  exitAt?: Timestamp;
  exitReason?: string;
  snapshot: LifecycleSnapshot;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export interface IssueEntity extends ScopedEntity {
  title: string;
  description: string;
  categoryId: string;
  subcategoryId?: string;
  customCategoryName?: string;
  incidentAt: Timestamp;
  reportedAt: Timestamp;
  reportedBy: string;
  reporterRole: string;
  reporterNameSnapshot: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidential: boolean;
  emergency: boolean;
  personInvolvementSummary?: string;
  assetId?: string;
  assignedCoordinatorId?: string;
  assignedMadrasaInchargeId?: string;
  assignedStaffId?: string;
  dueAt?: Timestamp;
  followUpRequired?: boolean;
  followUpAt?: Timestamp;
  status: 'reported' | 'acknowledged' | 'assigned' | 'underInvestigation' | 'actionRequired' | 'inProgress' | 'resolved' | 'closed' | 'reopened' | 'rejected' | 'duplicate';
  resolvedAt?: Timestamp;
  closedAt?: Timestamp;
  reopenedAt?: Timestamp;
  isActive: boolean;
  isDeleted: boolean;
}

export interface IssueAssignment extends ScopedEntity {
  issueId: string;
  previousAssigneeId?: string;
  newAssigneeId: string;
  assignmentType: 'coordinator' | 'incharge' | 'staff';
  reason?: string;
  assignedBy: string;
  assignedAt: Timestamp;
  endedAt?: Timestamp;
  status: 'active' | 'ended';
}

export interface IssueAttachment extends ScopedEntity {
  issueId: string;
  maintenanceId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  storagePath?: string;
  attachmentType: 'evidence' | 'manual' | 'receipt' | 'other';
  uploadedBy: string;
  uploadedAt: Timestamp;
}

export interface PropertyCategory extends ScopedEntity {
  name: string;
  description?: string;
  defaultAssetTypes: string[];
  defaultUnit: string;
  serialNumberRequired: boolean;
  warrantyApplicable: boolean;
  maintenanceApplicable: boolean;
  defaultMaintenanceFrequencyDays: number;
  quantityTrackingMode: 'bulk' | 'individual';
  status: 'active' | 'inactive';
  isSystemDefault: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MadrasaAsset extends ScopedEntity {
  name: string;
  categoryId: string;
  assetTypeId: string;
  customAssetType?: string;
  assetCode: string;
  barcodeValue?: string;
  description?: string;
  trackingMode: 'bulk' | 'individual';
  quantity: number;
  availableQuantity: number;
  unit: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  manufacturer?: string;
  specifications?: string;
  condition: 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'unusable';
  status: 'available' | 'inUse' | 'reserved' | 'underMaintenance' | 'damaged' | 'missing' | 'transferred' | 'disposed' | 'inactive';
  location: string;
  purchaseAt: Timestamp;
  purchaseQuantity: number;
  unitPrice: number;
  purchaseAmount: number;
  vendorName?: string;
  vendorContact?: string;
  invoiceNumber?: string;
  fundingSource?: string;
  donorDetails?: string;
  warrantyAvailable: boolean;
  warrantyStartAt?: Timestamp;
  warrantyEndAt?: Timestamp;
  warrantyProvider?: string;
  maintenanceRequired: boolean;
  maintenanceFrequencyDays?: number;
  lastMaintenanceAt?: Timestamp;
  nextMaintenanceAt?: Timestamp;
  responsibleInchargeId?: string;
  responsibleStaffIds?: string[];
  assignedAt?: Timestamp;
  notes?: string;
  photoUrl?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AssetUnit {
  id?: string;
  assetId: string;
  organizationId: string;
  madrasaId: string;
  unitCode: string;
  serialNumber?: string;
  barcodeValue?: string;
  condition: 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'unusable';
  status: 'available' | 'inUse' | 'reserved' | 'underMaintenance' | 'damaged' | 'missing' | 'transferred' | 'disposed' | 'inactive';
  location: string;
  responsiblePersonId?: string;
  assignedAt?: Timestamp;
  purchaseAt?: Timestamp;
  warrantyEndAt?: Timestamp;
  lastMaintenanceAt?: Timestamp;
  nextMaintenanceAt?: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AssetTransaction {
  id?: string;
  assetId: string;
  assetUnitId?: string;
  organizationId: string;
  previousMadrasaId?: string;
  newMadrasaId?: string;
  transactionType: 'creation' | 'quantityIncrease' | 'quantityDecrease' | 'assignment' | 'handover' | 'transfer' | 'maintenance' | 'repair' | 'damage' | 'loss' | 'recovery' | 'disposal' | 'reactivation' | 'statusChange' | 'conditionChange';
  previousQuantity?: number;
  newQuantity?: number;
  quantityChanged?: number;
  previousStatus?: string;
  newStatus?: string;
  previousCondition?: string;
  newCondition?: string;
  previousResponsiblePersonId?: string;
  newResponsiblePersonId?: string;
  reason?: string;
  notes?: string;
  performedBy: string;
  performedAt: Timestamp;
  referenceId?: string;
  snapshot?: any;
}

export interface AssetMaintenance extends ScopedEntity {
  assetId: string;
  assetUnitId?: string;
  organizationId: string;
  madrasaId: string;
  maintenanceType: 'routine' | 'repair' | 'calibration' | 'upgrade' | 'other';
  complaint: string;
  reportedAt: Timestamp;
  scheduledAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  serviceProvider?: string;
  serviceProviderContact?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  resolution?: string;
  nextMaintenanceAt?: Timestamp;
  status: 'reported' | 'scheduled' | 'inProgress' | 'completed' | 'cancelled';
  attachments?: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AssetAttachment {
  id?: string;
  assetId: string;
  assetUnitId?: string;
  maintenanceId?: string;
  organizationId: string;
  madrasaId: string;
  attachmentType: 'photo' | 'invoice' | 'warranty' | 'manual' | 'receipt' | 'other';
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
}


// ==========================================
// PHASE 5 — LIFECYCLE OPERATIONAL MODELS
// ==========================================

/** Operational record for a lifecycle request (pending → approved → completed) */
export interface LifecycleRecord extends ScopedEntity {
  userId: string;
  personType: 'coordinator' | 'madrasaIncharge' | 'teacher' | 'staff' | 'student' | 'parent';
  actionType:
    | 'dismiss' | 'relieve' | 'resign' | 'terminate' | 'retire'
    | 'suspend' | 'reactivate' | 'transfer' | 'graduate' | 'completeCourse'
    | 'withdraw' | 'archive' | 'rejoin' | 'rehire';
  previousStatus: LifecycleStatus;
  newStatus: LifecycleStatus;
  reasonCode: string;
  reasonText: string;
  effectiveDate: Timestamp;
  lastWorkingOrStudyDate?: Timestamp;
  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;
  approvalRequired: boolean;
  approvalStatus: 'notRequired' | 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  completedBy?: string;
  completedAt?: Timestamp;
  notes?: string;
  clearanceRequired: boolean;
  clearanceStatus: 'notRequired' | 'pending' | 'cleared' | 'overridden';
  clearanceOverrideBy?: string;
  clearanceOverrideReason?: string;
  isReversible: boolean;
  reversedBy?: string;
  reversedAt?: Timestamp;
  reversalReason?: string;
  rejoinEligible?: boolean;
  rejoinWaitingDays?: number;
  snapshot: LifecycleSnapshot;
  notificationsSent?: boolean;
}

/** One approval step in the lifecycle approval chain */
export interface LifecycleApproval extends ScopedEntity {
  lifecycleRecordId: string;
  userId: string;
  level: number;
  approverRole: string;
  approverId?: string;
  approverName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  decisionAt?: Timestamp;
  remarks?: string;
}

/** One clearance item for a lifecycle action */
export interface LifecycleClearance extends ScopedEntity {
  lifecycleRecordId: string;
  userId: string;
  department:
    | 'academic' | 'finance' | 'property' | 'library'
    | 'hostel' | 'transport' | 'itAccess' | 'administration' | 'humanResources';
  required: boolean;
  status: 'notRequired' | 'pending' | 'cleared' | 'waived' | 'rejected';
  assignedApproverId?: string;
  completedBy?: string;
  completedAt?: Timestamp;
  remarks?: string;
  pendingAmount?: number;
  assetIds?: string[];
  attachmentIds?: string[];
}

/** Document/evidence attached to a lifecycle record */
export interface LifecycleAttachment extends ScopedEntity {
  lifecycleRecordId: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  storagePath?: string;
  attachmentType: 'letter' | 'notice' | 'certificate' | 'id' | 'other';
  uploadedBy: string;
  uploadedAt: Timestamp;
}

/** Request to rejoin a madrasa or for re-employment */
export interface RejoinRequest extends ScopedEntity {
  previousUserId: string;
  previousLifecycleRecordId?: string;
  personType: 'student' | 'staff' | 'teacher' | 'coordinator' | 'madrasaIncharge';
  requestedMadrasaId: string;
  requestedCourseId?: string;
  requestedClassId?: string;
  requestedClassGroupId?: string;
  requestedRole?: string;
  reasonForReturn: string;
  requestedStartDate: Timestamp;
  previousExitReason?: string;
  previousExitDate?: Timestamp;
  previousStatus?: string;
  unresolvedFeeAmount?: number;
  hasDisciplinaryRestriction?: boolean;
  eligibilityStatus: 'eligible' | 'restricted' | 'underReview' | 'blocked';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  reviewNotes?: string;
  requestedBy: string;
  requestedAt: Timestamp;
}

/** Student dismissal checklist — warning flags only, does not block */
export interface StudentExitChecklist {
  hasActiveClassGroupMembership: boolean;
  hasPendingFees: boolean;
  hasBorrowedAssets: boolean;
  hasActiveIssues: boolean;
  hasCertificatesRequired: boolean;
  parentHasOtherActiveStudents: boolean;
  checkedAt: string;
}

/** Staff relieving checklist — warning flags only */
export interface StaffRelievingChecklist {
  hasActiveClassGroups: boolean;
  hasActiveTimetableResponsibilities: boolean;
  hasPendingSalary: boolean;
  hasPropertyToReturn: boolean;
  hasActiveIssues: boolean;
  checkedAt: string;
}

export type FirebaseOperationType = 'read' | 'write' | 'delete' | 'storage_upload' | 'storage_download' | 'function_call';

export type AppModuleId =
  | 'users'
  | 'attendance'
  | 'fees'
  | 'events'
  | 'issues'
  | 'properties'
  | 'lifecycle'
  | 'class-plans'
  | 'management'
  | 'system';

export interface FirebaseUsageRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  organizationId: string;
  organizationName?: string;
  moduleId: AppModuleId;
  readsCount: number;
  writesCount: number;
  deletesCount: number;
  storageBytesUploaded: number;
  storageBytesDownloaded: number;
  storageActiveBytes?: number;
  functionCallsCount: number;
  functionDurationMs: number;
  estimatedCost: number;
  updatedAt?: unknown;
}

export interface FirebasePricingRules {
  firestoreReadCostPer100k: number; // e.g. 0.06
  firestoreWriteCostPer100k: number; // e.g. 0.18
  firestoreDeleteCostPer100k: number; // e.g. 0.02
  firestoreStorageCostPerGbMonth: number; // e.g. 0.18
  storageDownloadCostPerGb: number; // e.g. 0.12
  storageUploadOpCostPer10k: number; // e.g. 0.05
  storageDownloadOpCostPer10k: number; // e.g. 0.004
  functionInvocationCostPerMillion: number; // e.g. 0.40
  functionComputeCostPerGbSecond: number; // e.g. 0.0000025
}

export interface OrganizationQuotaAlert {
  organizationId: string;
  monthlyReadLimit: number;
  monthlyWriteLimit: number;
  monthlyStorageGbLimit: number;
  monthlyCostLimitUsd: number;
  alertEmail?: string;
}

