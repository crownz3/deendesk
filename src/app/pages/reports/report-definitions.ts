import { ReportDefinition, ReportFieldMetadata } from '../../core/models/report.model';

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // --- CLIENT REQUESTED REPORTS ---
  {
    id: 'madrasa-course-type-strength-report',
    name: 'Madrasa Course Type & Staff Strength Overview',
    category: 'client',
    collection: 'madrasas',
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No madrasa course type or staff strength data found.',
    columns: [
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'code', label: 'Madrasa Code', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseTypeDisplay', label: 'Course Type (Maktab / Hifz / Both)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'totalStaffCount', label: 'Total Staff Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'maleStaffCount', label: 'Male Staff Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'femaleStaffCount', label: 'Female Staff Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'activeInchargeDisplay', label: 'Active Incharge(s)', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-movement-audit-report',
    name: 'Student Movement & Audit Trail Report',
    category: 'client',
    collection: 'promotionHistory',
    requiredFilters: ['madrasa', 'gender', 'dateRange'],
    emptyText: 'No student movement audit records found for the selected period.',
    columns: [
      { key: 'actionDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },

      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseTypeDisplay', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'movementEventType', label: 'Event Type (Joined / Transferred / Promoted / Demoted / Relieved)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'previousStage', label: 'Previous Stage / Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'newStage', label: 'New Stage / Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'reason', label: 'Reason / Remarks', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'performedBy', label: 'Performed By', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true }
    ]
  },
  {
    id: 'events-competitions-roster-report',
    name: 'Events & Academic Competitions Roster Report',
    category: 'client',
    collection: 'events',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No events or academic competition records found.',
    columns: [
      { key: 'eventDateDisplay', label: 'Event Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'title', label: 'Event Title', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'categoryDisplay', label: 'Category / Type', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseTypeDisplay', label: 'Course (Hifz / Maktab / All)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'totalParticipants', label: 'Total Participants', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'winnerStudentDisplay', label: 'Winner / Rank 1 Student', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'winnerUsthadhDisplay', label: "Winner's Usthadh", defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-master-progress-snapshot-report',
    name: 'Comprehensive Student Master & Progress Snapshot',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'gender', 'course', 'stage', 'status'],
    emptyText: 'No student records found matching the selected criteria.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },

      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Class Group / Batch', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stageDisplay', label: 'Stage / Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'currentSurah', label: 'Current Surah / Position', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'totalJuzMemorized', label: 'Total Juz Memorized', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'attendancePercent', label: 'Attendance %', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'admissionDate', label: 'Admission Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'overall-strength-report',
    name: 'Overall Strength & Movement Shift Matrix Report',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'month', 'year', 'status'],
    emptyText: 'No strength matrix data available.',
    columns: [
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Department / Section', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Shift / Timing', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'currentMonthStudentCount', label: 'Student Count', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'class-group-list',
    name: 'Class Group & Batch Details Report',
    category: 'client',
    collection: 'classGroups',
    requiredFilters: ['madrasa', 'course', 'class', 'status', 'search'],
    emptyText: 'No class groups found for the selected criteria.',
    columns: [
      { key: 'name', label: 'Class Group Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Course / Division', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class / Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Assigned Teacher(s)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'shiftDisplay', label: 'Shift / Timing', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentCount', label: 'Enrolled Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'madrasa-student-movement-details-report',
    name: 'Madrasa-Wise Movement & Student Roster Report',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'shift', 'month', 'year', 'status'],
    emptyText: 'No student movement data found for the selected madrasa(s).',
    columns: [
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh / Teacher Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Shift / Timing', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Group Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'prevMonthStudentCount', label: 'Last Month Count', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'currentMonthStudentCount', label: 'Current Month Count', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'newAdmissionCount', label: 'New Admissions', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'inactiveCount', label: 'Left / Dropouts', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'promoteDemoteCount', label: 'Promoted / Demoted', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'transferCount', label: 'Transfers', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentNameDisplay', label: 'Student Details', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'madrasa-usthadh-list-report',
    name: 'Madrasa-Wise Usthadh & Group Roster Report',
    category: 'client',
    collection: 'staff',
    requiredFilters: ['madrasa', 'gender', 'search'],
    emptyText: 'No Usthadh records found for the selected madrasa(s).',
    columns: [
      { key: 'sNo', label: 'S. No', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaName', label: 'Matharasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'usthadhName', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'phone', label: 'Phone Number', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'groupsDisplay', label: 'Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStudentsCount', label: 'Assigned Students Count', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-movement-audit-report',
    name: 'Staff Movement & Audit Trail Report',
    category: 'client',
    collection: 'userLifecycleHistory',
    requiredFilters: ['madrasa', 'gender', 'role', 'dateRange'],
    emptyText: 'No staff movement audit records found.',
    columns: [
      { key: 'effectiveDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'userName', label: 'Staff Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaName', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'lifecycleAction', label: 'Action (Joined / Transferred / Relieved)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reason', label: 'Reason / Remarks', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'performedBy', label: 'Performed By', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'maktab-to-hifz-promotions-report',
    name: 'Maktab to Hifz Cross-Course Promotion Report',
    category: 'client',
    collection: 'promotionHistory',
    requiredFilters: ['madrasa', 'gender', 'dateRange'],
    emptyText: 'No Maktab to Hifz cross-course promotion records found.',
    columns: [
      { key: 'actionDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentName', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaName', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'previousStage', label: 'Maktab Final Stage', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'newStage', label: 'New Hifz Stage', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reason', label: 'Promotion Reason', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'performedBy', label: 'Teacher / Incharge', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'hifz-completion-dawr-graduations-report',
    name: 'Monthly 30 Juz Hifz Completion & Dawr Graduation Report',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'gender', 'month'],
    emptyText: 'No Hifz completion records found for this period.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stageDisplay', label: 'Stage (Dawr)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dawrRoundNo', label: 'Current Dawr Round', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'hifzCompletionDate', label: 'Completion Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'hifz-substage-progress-report',
    name: 'Hifz Sub-Stage Progress Report (Upto 20 Juz & 30 Juz)',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'gender', 'stage', 'month'],
    emptyText: 'No Hifz sub-stage progress records found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stageDisplay', label: 'Current Stage (Upto 20 / 30 Juz)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'currentSurah', label: 'Current Surah & Ayah', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'juzCompletedThisMonth', label: 'Juz Completed This Month', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'progressPace', label: 'Pace (Juz / Month)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'dawr-cycles-certification-readiness-report',
    name: 'Dawr Revision Cycles & Certification Readiness Report',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'gender', 'status'],
    emptyText: 'No Dawr revision records found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dawrRoundNo', label: 'Current Dawr Round #', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'targetDawrRounds', label: 'Target Rounds (e.g. 3/5)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dawrDailyJuz', label: 'Daily Revision Portion', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'certificationStatus', label: 'Sanad Certification Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'habitual-latecomers-monthly-report',
    name: 'Habitual Latecomer Roster (3+ Lates in Month)',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'gender', 'month'],
    emptyText: 'No late arrival records matching threshold.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'lateCount', label: 'Late Count (3+)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'leaveCount', label: 'Leave Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'absentCount', label: 'Absent Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'presentCount', label: 'Present Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'totalDays', label: 'Total Working Days', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'attendancePercent', label: 'Attendance %', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'phoneDisplay', label: 'Parent Phone', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'attendance-risk-alert-report',
    name: 'Attendance Risk Alert (3+ Lates AND 3+ Days Leave)',
    category: 'client',
    collection: 'students',
    requiredFilters: ['madrasa', 'gender', 'month'],
    emptyText: 'No high-risk attendance alert records found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'lateCount', label: 'Late Count (3+)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'leaveCount', label: 'Leave Days (3+)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'absentCount', label: 'Absent Count', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'totalAbsences', label: 'Total Absences (Leave + Absent)', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'totalDays', label: 'Total Working Days', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'attendancePercent', label: 'Attendance %', defaultVisible: true, sortable: true, filterable: true, groupable: false, exportable: true },
      { key: 'riskLevel', label: 'Risk Level', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'phoneDisplay', label: 'Parent Contact', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-issues-grievance-register-report',
    name: 'Student Issues & Grievance Register Report',
    category: 'client',
    collection: 'issues',
    requiredFilters: ['madrasa', 'status', 'dateRange'],
    emptyText: 'No student issue/grievance records found.',
    columns: [
      { key: 'createdAt', label: 'Log Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'title', label: 'Issue Title', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'category', label: 'Category', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'userName', label: 'Student / Reporter', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaName', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedTo', label: 'Assigned To', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Resolution Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'closedDate', label: 'Closed Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'confidentialDisplay', label: 'Confidentiality', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'emergencyDisplay', label: 'Emergency', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- STUDENT REPORTS ---
  {
    id: 'monthly-student-movement-strength-report',
    name: 'Monthly Student Movement & Strength Report',
    category: 'student',
    collection: 'students',
    requiredFilters: ['madrasa', 'course', 'class', 'month', 'status', 'search'],
    defaultGroup: ['madrasaNameDisplay', 'assignedClassGroupDisplay'],
    emptyText: 'No student records or monthly movement data found for the selected criteria.',
    columns: [
      { key: 'madrasaNameDisplay', label: 'Madrasa Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Class Group / Batch', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Usthadh / Teacher Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Timing / Shift', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'fatherNameDisplay', label: 'Father Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stageDisplay', label: 'Stage / Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'movementStatusDisplay', label: 'Movement Tag', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'prevMonthStudentCount', label: 'Prev Month Count', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'currentMonthStudentCount', label: 'Current Month Count', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'newAdmissionCount', label: 'New Admissions', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'inactiveCount', label: 'Inactive / Dropouts', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'promoteDemoteCount', label: 'Promote / Demote', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'transferCount', label: 'Transfers', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'admissionDate', label: 'Admission Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-list',
    name: 'Student List',
    category: 'student',
    collection: 'students',
    requiredFilters: ['madrasa', 'course', 'class', 'stage', 'status', 'gender', 'admissionDateRange', 'search'],
    emptyText: 'No students found for the selected filters.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }, 
      { key: 'fatherNameDisplay', label: 'Father', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }, 
      { key: 'parentNameDisplay', label: 'Parent', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentEmailDisplay', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }, 
      { key: 'classNameDisplay', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }, 
      { key: 'assignedClassGroupDisplay', label: 'Assigned Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Assigned Teacher(s)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stageDisplay', label: 'Stage', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'admissionDate', label: 'Admission Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'student-registration-summary',
    name: 'Student Registration Summary',
    category: 'student',
    collection: 'students',
    requiredFilters: ['madrasa', 'admissionDateRange'],
    emptyText: 'No student registrations found for this period.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }, 
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'admissionDate', label: 'Admission Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-promotion-report',
    name: 'Student Promotion Report',
    category: 'student',
    collection: 'promotionHistory',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No promotion records found.',
    columns: [
      { key: 'actionDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentNameDisplay', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'action', label: 'Action', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reason', label: 'Reason', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-dropout-report',
    name: 'Student Dropout & Inactive Report',
    category: 'student',
    collection: 'users',
    roles: ['student'],
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No inactive or dropped students found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- STAFF REPORTS ---
  {
    id: 'staff-list-madrasa-wise',
    name: 'Madrasa-Wise Staff List & Contact Report',
    category: 'staff',
    collection: 'users',
    roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'admin', 'principal', 'ustadh', 'stageHead', 'headTeacher'],
    requiredFilters: ['madrasa', 'gender', 'role', 'status', 'search'],
    defaultGroup: ['madrasaNameDisplay'],
    emptyText: 'No staff members found for the selected criteria.',
    columns: [
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaInchargeDisplay', label: 'Madrasa Incharge', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'staffNameDisplay', label: 'Staff Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'phoneDisplay', label: 'Mobile / Phone Number', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'role', label: 'Role / Designation', type: 'role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Assigned Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'qualification', label: 'Qualification', defaultVisible: false, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'address', label: 'Address', defaultVisible: false, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-list',
    name: 'Staff List',
    category: 'staff',
    collection: 'users',
    roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge'],
    requiredFilters: ['madrasa', 'gender', 'status', 'search'],
    emptyText: 'No staff found for the selected filters.',
    columns: [
      { key: 'staffNameDisplay', label: 'Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'phoneDisplay', label: 'Mobile / Phone Number', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'role', label: 'Role', type: 'role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Assigned Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- MADRASA REPORTS ---
  {
    id: 'madrasa-list',
    name: 'Madrasa List',
    category: 'madrasa',
    collection: 'madrasas',
    requiredFilters: ['status', 'search'],
    emptyText: 'No madrasas found.',
    columns: [
      { key: 'name', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'code', label: 'Code', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- GENERIC COUNT REPORTS ---
  {
    id: 'student-count-by-madrasa',
    name: 'Student Count by Madrasa',
    category: 'count',
    collection: 'students',
    requiredFilters: ['status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'madrasaId',
    columns: [
      { key: 'groupLabel', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-count-by-course',
    name: 'Student Count by Course',
    category: 'count',
    collection: 'students',
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'courseId',
    columns: [
      { key: 'groupLabel', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-count-by-class',
    name: 'Student Count by Class',
    category: 'count',
    collection: 'students',
    requiredFilters: ['madrasa', 'course', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'classId',
    columns: [
      { key: 'groupLabel', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-count-by-group',
    name: 'Student Count by Class Group',
    category: 'count',
    collection: 'students',
    requiredFilters: ['madrasa', 'course', 'class', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'classGroupId',
    columns: [
      { key: 'groupLabel', label: 'Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-count-by-role',
    name: 'Staff Count by Role',
    category: 'count',
    collection: 'users',
    roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge'],
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'role',
    columns: [
      { key: 'groupLabel', label: 'Role', type: 'role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-count-by-madrasa',
    name: 'Staff Count by Madrasa',
    category: 'count',
    collection: 'users',
    roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge'],
    requiredFilters: ['status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'madrasaId',
    columns: [
      { key: 'groupLabel', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-strength-by-stage',
    name: 'Student Strength by Stage',
    category: 'count',
    collection: 'students',
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'stageLevel',
    columns: [
      { key: 'groupLabel', label: 'Stage Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- ATTENDANCE & DAILY PROGRESS REPORTS ---
  {
    id: 'student-attendance-summary-report',
    name: 'Student Attendance & Absence Summary Report',
    category: 'student',
    collection: 'students',
    requiredFilters: ['madrasa', 'course', 'class', 'status', 'search'],
    emptyText: 'No student attendance summary records found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class / Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-daily-progress-report',
    name: 'Daily Progress & Quran Memorization Report',
    category: 'student',
    collection: 'students',
    requiredFilters: ['madrasa', 'course', 'class', 'status', 'search'],
    emptyText: 'No daily memorization progress records found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'fatherNameDisplay', label: 'Father Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stageDisplay', label: 'Stage / Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'class-plan-timetable-schedule-report',
    name: 'Class Plan & Timetable Schedule Report',
    category: 'client',
    collection: 'classGroups',
    requiredFilters: ['madrasa', 'course', 'class', 'status', 'search'],
    emptyText: 'No timetable schedule entries found.',
    columns: [
      { key: 'name', label: 'Class Group Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Course / Shift', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class / Level', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Assigned Teacher(s)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentCount', label: 'Enrolled Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  }
];

export const AVAILABLE_FIELDS_METADATA: Record<string, ReportFieldMetadata> = {
  madrasaNameDisplay: { key: 'madrasaNameDisplay', label: 'Madrasa Name', groupable: true, filterable: true, sortable: true },
  madrasaInchargeDisplay: { key: 'madrasaInchargeDisplay', label: 'Madrasa Incharge', groupable: true, filterable: true, sortable: true },
  assignedClassGroupDisplay: { key: 'assignedClassGroupDisplay', label: 'Assigned Class Group', groupable: true, filterable: true, sortable: true },
  assignedStaffNamesDisplay: { key: 'assignedStaffNamesDisplay', label: 'Assigned Staff', groupable: true, filterable: true, sortable: true },
  courseNameDisplay: { key: 'courseNameDisplay', label: 'Course / Shift', groupable: true, filterable: true, sortable: true },
  classNameDisplay: { key: 'classNameDisplay', label: 'Class', groupable: true, filterable: true, sortable: true },
  studentNameDisplay: { key: 'studentNameDisplay', label: 'Student Name', groupable: false, filterable: true, sortable: true },
  fatherNameDisplay: { key: 'fatherNameDisplay', label: 'Father Name', groupable: false, filterable: true, sortable: true },
  parentNameDisplay: { key: 'parentNameDisplay', label: 'Parent Name', groupable: false, filterable: true, sortable: true },
  staffNameDisplay: { key: 'staffNameDisplay', label: 'Staff Name', groupable: false, filterable: true, sortable: true },
  phoneDisplay: { key: 'phoneDisplay', label: 'Phone / Mobile', groupable: false, filterable: true, sortable: true },
  email: { key: 'email', label: 'Email Address', groupable: false, filterable: true, sortable: true },
  gender: { key: 'gender', label: 'Gender', groupable: true, filterable: true, sortable: true },
  role: { key: 'role', label: 'Role / Designation', type: 'role', groupable: true, filterable: true, sortable: true },
  stageDisplay: { key: 'stageDisplay', label: 'Stage / Level', groupable: true, filterable: true, sortable: true },
  movementStatusDisplay: { key: 'movementStatusDisplay', label: 'Movement Tag', groupable: true, filterable: true, sortable: true },
  prevMonthStudentCount: { key: 'prevMonthStudentCount', label: 'Prev Month Count', groupable: false, filterable: true, sortable: true },
  currentMonthStudentCount: { key: 'currentMonthStudentCount', label: 'Current Month Count', groupable: false, filterable: true, sortable: true },
  newAdmissionCount: { key: 'newAdmissionCount', label: 'New Admissions', groupable: false, filterable: true, sortable: true },
  inactiveCount: { key: 'inactiveCount', label: 'Inactive / Dropouts', groupable: false, filterable: true, sortable: true },
  promoteDemoteCount: { key: 'promoteDemoteCount', label: 'Promote / Demote', groupable: false, filterable: true, sortable: true },
  transferCount: { key: 'transferCount', label: 'Transfers', groupable: false, filterable: true, sortable: true },
  shiftDisplay: { key: 'shiftDisplay', label: 'Shift / Timing', groupable: true, filterable: true, sortable: true },
  studentCount: { key: 'studentCount', label: 'Enrolled Students', groupable: false, filterable: true, sortable: true },
  name: { key: 'name', label: 'Class Group Name', groupable: true, filterable: true, sortable: true },
  admissionDate: { key: 'admissionDate', label: 'Admission Date', type: 'date', groupable: true, filterable: true, sortable: true },
  status: { key: 'status', label: 'Status', type: 'status', groupable: true, filterable: true, sortable: true }
};
