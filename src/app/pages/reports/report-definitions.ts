import { ReportDefinition, ReportFieldMetadata } from '../../core/models/report.model';

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // --- CUSTOM INDEPENDENT BUILDERS ---
  {
    id: 'custom-staff-builder',
    name: 'Custom Independent Staff & User Builder',
    category: 'custom',
    collection: 'users',
    requiredFilters: [],
    emptyText: 'No staff or user records found.',
    columns: [
      { key: 'staffNameDisplay', label: 'Staff / User Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'phoneDisplay', label: 'Mobile / Phone Number', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'role', label: 'Role', type: 'role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Assigned Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'custom-students-builder',
    name: 'Custom Independent Students Builder',
    category: 'custom',
    collection: 'students',
    requiredFilters: [],
    emptyText: 'No student records found.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'fatherNameDisplay', label: 'Father Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'custom-classgroups-builder',
    name: 'Custom Independent Class Groups Builder',
    category: 'custom',
    collection: 'classGroups',
    requiredFilters: [],
    emptyText: 'No class group records found.',
    columns: [
      { key: 'name', label: 'Group Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Assigned Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  {
    id: 'monthly-student-movement-strength-report',
    name: 'Monthly Student Movement & Strength Report (மாதாந்திர மாணவர்கள் அறிக்கை)',
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
    requiredFilters: ['madrasa', 'status'], // Will default filter to inactive/dropped
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
  {
    id: 'staff-assigned-class-groups',
    name: 'Staff & Assigned Class Groups Report',
    category: 'staff',
    collection: 'users',
    roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge'],
    requiredFilters: ['madrasa', 'status', 'search'],
    emptyText: 'No staff assignment records found for the selected filters.',
    columns: [
      { key: 'staffNameDisplay', label: 'Staff Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'role', label: 'Role', type: 'role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedClassGroupDisplay', label: 'Assigned Class Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'coordinator-list',
    name: 'Coordinator List',
    category: 'staff',
    collection: 'users',
    roles: ['coordinator'],
    requiredFilters: ['madrasa', 'status', 'search'],
    emptyText: 'No coordinators found for the selected filters.',
    columns: [
      { key: 'staffNameDisplay', label: 'Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'madrasa-incharge-list',
    name: 'Madrasa Incharge List',
    category: 'staff',
    collection: 'users',
    roles: ['madrasaIncharge'],
    requiredFilters: ['madrasa', 'status', 'search'],
    emptyText: 'No madrasa incharge found for the selected filters.',
    columns: [
      { key: 'name', label: 'Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
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

  // --- ACADEMIC REPORTS ---
  {
    id: 'course-summary',
    name: 'Course Summary',
    category: 'academic',
    collection: 'courses',
    requiredFilters: ['status'],
    emptyText: 'No courses found.',
    columns: [
      { key: 'name', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'code', label: 'Code', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'type', label: 'Type', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'class-summary',
    name: 'Class Summary',
    category: 'academic',
    collection: 'classes',
    requiredFilters: ['madrasa', 'course', 'status'],
    emptyText: 'No classes found.',
    columns: [
      { key: 'name', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'stage', label: 'Stage', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'subject-summary',
    name: 'Subject List & Allocation',
    category: 'academic',
    collection: 'subjects',
    requiredFilters: ['course', 'status'],
    emptyText: 'No subjects found.',
    columns: [
      { key: 'name', label: 'Subject Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseNameDisplay', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'type', label: 'Type', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- TIMETABLE & SYLLABUS REPORTS ---
  {
    id: 'timetable-master',
    name: 'Master Timetable Report',
    category: 'academic',
    collection: 'classPlans',
    requiredFilters: ['madrasa', 'class', 'dateRange'],
    emptyText: 'No timetable entries found.',
    columns: [
      { key: 'startDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'title', label: 'Activity/Subject', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Assigned Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-weekly-monthly-pages',
    name: 'Pages Taught / Memorized per Student (Weekly & Monthly)',
    category: 'academic',
    collection: 'classPlanAttendance',
    requiredFilters: ['madrasa', 'course', 'class', 'dateRange'],
    emptyText: 'No student page completion records found for the selected period.',
    columns: [
      { key: 'date', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentName', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'courseName', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'className', label: 'Class/Group', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'portionCovered', label: 'Pages / Portion Covered', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'performanceRating', label: 'Performance', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'student-performance-summary',
    name: 'Student Performance & Struggling Area Matrix',
    category: 'academic',
    collection: 'classPlanAttendance',
    requiredFilters: ['madrasa', 'course', 'class', 'dateRange'],
    emptyText: 'No performance evaluation data found.',
    columns: [
      { key: 'studentName', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'performanceRating', label: 'Rating', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'struggledAreasDisplay', label: 'Struggling Areas', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'hasPersonalizedPlanDisplay', label: 'Remedial Sub-Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'personalizedTargetPortion', label: 'Remedial Target', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'hifz-recitation-accuracy',
    name: 'Hifz Recitation Accuracy & Mistake Details Report',
    category: 'academic',
    collection: 'classPlanAttendance',
    requiredFilters: ['madrasa', 'course', 'class', 'dateRange'],
    emptyText: 'No Hifz recitation detail logs found.',
    columns: [
      { key: 'date', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentName', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'portionCovered', label: 'Portion (Sabaq/Sabqi/Manzil)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'mistakeCount', label: 'Mistakes (Ghalati)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'hesitationCount', label: 'Hesitations (Luqmah)', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'lineNumbers', label: 'Line Numbers', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'wordDetails', label: 'Word/Ayah Notes', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'substitute-teacher-audit',
    name: 'Substitute Teacher Usage & Audit Report',
    category: 'academic',
    collection: 'classPlanAttendance',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No substitute teacher session records found.',
    columns: [
      { key: 'date', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'activityName', label: 'Session Activity', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'primaryTeacherName', label: 'Assigned Primary Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'substituteTeacherName', label: 'Substitute Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Session Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'academic-movement-audit',
    name: 'Student Transfer, Demotion & Re-memorization Audit',
    category: 'academic',
    collection: 'academicMovementLogs',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No academic movement logs found.',
    columns: [
      { key: 'effectiveDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentName', label: 'Student Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'movementType', label: 'Action Type', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'fromCourseName', label: 'Original Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'toCourseName', label: 'Target Course / Stage', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reason', label: 'Reason', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'approvedByName', label: 'Approved By', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- ATTENDANCE REPORTS ---
  {
    id: 'attendance-daily',
    name: 'Daily Attendance',
    category: 'attendance',
    collection: 'attendance',
    requiredFilters: ['madrasa', 'course', 'class', 'dateRange'],
    emptyText: 'No attendance records found for the selected date.',
    columns: [
      { key: 'date', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentNameDisplay', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'classNameDisplay', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'notes', label: 'Notes', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-attendance-daily',
    name: 'Staff Daily Attendance',
    category: 'attendance',
    collection: 'attendance',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No staff attendance records found.',
    columns: [
      { key: 'date', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentNameDisplay', label: 'Staff Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'notes', label: 'Notes', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- GENERIC COUNT REPORTS ---
  {
    id: 'student-strength-by-madrasa',
    name: 'Student Strength by Madrasa',
    category: 'count',
    collection: 'users',
    roles: ['student'],
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
    id: 'student-strength-by-course',
    name: 'Student Strength by Course',
    category: 'count',
    collection: 'users',
    roles: ['student'],
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
    id: 'student-strength-by-gender',
    name: 'Student Strength by Gender',
    category: 'count',
    collection: 'users',
    roles: ['student'],
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'gender',
    columns: [
      { key: 'groupLabel', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-count',
    name: 'Staff Count by Role',
    category: 'count',
    collection: 'users',
    roles: ['staff', 'teacher', 'coordinator', 'madrasaIncharge'],
    requiredFilters: ['status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'role',
    columns: [
      { key: 'groupLabel', label: 'Role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'staff-strength-by-madrasa',
    name: 'Staff Strength by Madrasa',
    category: 'count',
    collection: 'users',
    roles: ['staff', 'teacher', 'coordinator', 'madrasaIncharge'],
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
    id: 'student-strength-by-class',
    name: 'Student Strength by Class',
    category: 'count',
    collection: 'students',
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'classId',
    columns: [
      { key: 'groupLabel', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Total Students', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
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
  
  // --- ACTIVITY REPORTS ---
  {
    id: 'activity-tarbiyah',
    name: 'Tarbiyah Completion',
    category: 'activity',
    collection: 'classPlans', // Derived from timetable
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No Tarbiyah activities found in this period.',
    activityType: 'Tarbiyah',
    columns: [
      { key: 'title', label: 'Activity', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'className', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assignedStaffNamesDisplay', label: 'Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'startDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },

  // --- FEE REPORTS ---
  {
    id: 'fee-collection-summary',
    name: 'Fee Collection Summary',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'feePlan', 'paidStatus', 'dateRange'],
    emptyText: 'No fee assignments found for the selected filters.',
    columns: [
      { key: 'studentName', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'feePlanTitle', label: 'Fee Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'feeType', label: 'Fee Type', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paidAmount', label: 'Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'balanceAmount', label: 'Balance', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentStatus', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-unpaid-students',
    name: 'Unpaid Students Report',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'feePlan', 'dateRange'],
    emptyText: 'No unpaid students found.',
    defaultFilters: { paidStatus: 'notPaid' },
    columns: [
      { key: 'studentName', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'feePlanTitle', label: 'Fee Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentStatus', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-paid-students',
    name: 'Paid Students Report',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'feePlan', 'dateRange'],
    emptyText: 'No paid students found.',
    defaultFilters: { paidStatus: 'paid' },
    columns: [
      { key: 'studentName', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'feePlanTitle', label: 'Fee Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paidAmount', label: 'Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'lastPaymentDate', label: 'Last Payment', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentStatus', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-collection-by-madrasa',
    name: 'Collection by Madrasa',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['status'],
    emptyText: 'No fee data to aggregate.',
    aggregationLogic: 'sum-by-field',
    groupByField: 'madrasaId',
    columns: [
      { key: 'groupLabel', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Assignments', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Total Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paidAmount', label: 'Total Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'balanceAmount', label: 'Total Balance', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-collection-by-course',
    name: 'Collection by Course',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No fee data to aggregate.',
    aggregationLogic: 'sum-by-field',
    groupByField: 'courseId',
    columns: [
      { key: 'groupLabel', label: 'Course', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Assignments', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Total Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paidAmount', label: 'Total Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'balanceAmount', label: 'Total Balance', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-collection-by-class',
    name: 'Collection by Class',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'course', 'status'],
    emptyText: 'No fee data to aggregate.',
    aggregationLogic: 'sum-by-field',
    groupByField: 'classId',
    columns: [
      { key: 'groupLabel', label: 'Class', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Assignments', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Total Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paidAmount', label: 'Total Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'balanceAmount', label: 'Total Balance', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-collection-by-plan',
    name: 'Collection by Fee Plan',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'status'],
    emptyText: 'No fee data to aggregate.',
    aggregationLogic: 'sum-by-field',
    groupByField: 'feePlanId',
    columns: [
      { key: 'groupLabel', label: 'Fee Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Assignments', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amount', label: 'Total Amount', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paidAmount', label: 'Total Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'balanceAmount', label: 'Total Balance', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-overdue-report',
    name: 'Fee Overdue Report',
    category: 'fees',
    collection: 'feeAssignments',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No overdue fee assignments found.',
    columns: [
      { key: 'studentName', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'feePlanTitle', label: 'Fee Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'balanceAmount', label: 'Balance', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentStatus', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-payment-history',
    name: 'Fee Payment History',
    category: 'fees',
    collection: 'feePayments',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No payment records found.',
    columns: [
      { key: 'studentName', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'feePlanTitle', label: 'Fee Plan', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amountPaid', label: 'Amount Paid', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentDate', label: 'Payment Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentMethod', label: 'Method', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'receiptNumber', label: 'Receipt #', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'collectedByStaffName', label: 'Collected By', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  {
    id: 'fee-staff-collection',
    name: 'Staff-wise Fee Collection',
    category: 'fees',
    collection: 'feePayments',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No payment records found.',
    columns: [
      { key: 'collectedByStaffName', label: 'Staff', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'studentName', label: 'Student', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'amountPaid', label: 'Amount Collected', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentDate', label: 'Date', type: 'date', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'paymentMethod', label: 'Method', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'receiptNumber', label: 'Receipt #', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
    ]
  },
  
  // --- EVENT REPORTS PLACEHOLDERS ---
  {
    id: 'event-list',
    name: 'Event List',
    category: 'events',
    collection: 'events',
    requiredFilters: ['madrasa'],
    emptyText: 'No events found.',
    columns: [
      { key: 'name', label: 'Event Name', defaultVisible: true, sortable: true },
      { key: 'eventType', label: 'Event Type', defaultVisible: true, sortable: true },
      { key: 'startDate', label: 'Start Date', defaultVisible: true, sortable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true },
    ]
  },
  
  // --- ISSUE REPORTS ---
  {
    id: 'issue-register',
    name: 'Complete Issue Register',
    category: 'issues',
    collection: 'issues',
    requiredFilters: ['madrasa', 'dateRange', 'search'],
    emptyText: 'No issues found.',
    columns: [
      { key: 'title', label: 'Title', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'description', label: 'Description', defaultVisible: false, sortable: false, filterable: true, exportable: true },
      { key: 'categoryId', label: 'Category', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'location', label: 'Location', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'severity', label: 'Severity', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reporterNameSnapshot', label: 'Reporter', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reporterRole', label: 'Reporter Role', defaultVisible: false, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reportedAt', label: 'Reported At', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'dueAt', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'resolvedAt', label: 'Resolved At', type: 'date', defaultVisible: false, sortable: true, exportable: true }
    ]
  },
  {
    id: 'open-issues',
    name: 'Open Issues Register',
    category: 'issues',
    collection: 'issues',
    requiredFilters: ['madrasa', 'search'],
    emptyText: 'No open issues found.',
    columns: [
      { key: 'title', label: 'Title', defaultVisible: true, sortable: true, exportable: true },
      { key: 'categoryId', label: 'Category', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'severity', label: 'Severity', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'reporterNameSnapshot', label: 'Reporter', defaultVisible: true, sortable: true, exportable: true },
      { key: 'reportedAt', label: 'Reported At', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'dueAt', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'closed-issues',
    name: 'Closed & Resolved Issues',
    category: 'issues',
    collection: 'issues',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No resolved or closed issues found.',
    columns: [
      { key: 'title', label: 'Title', defaultVisible: true, sortable: true, exportable: true },
      { key: 'categoryId', label: 'Category', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'reportedAt', label: 'Reported At', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'resolvedAt', label: 'Resolved At', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'closedAt', label: 'Closed At', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'overdue-issues',
    name: 'Overdue Issues Report',
    category: 'issues',
    collection: 'issues',
    requiredFilters: ['madrasa'],
    emptyText: 'No overdue issues found.',
    columns: [
      { key: 'title', label: 'Title', defaultVisible: true, sortable: true, exportable: true },
      { key: 'categoryId', label: 'Category', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'reportedAt', label: 'Reported At', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'dueAt', label: 'Due Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'critical-issues',
    name: 'Critical & High-Priority Issues',
    category: 'issues',
    collection: 'issues',
    requiredFilters: ['madrasa'],
    emptyText: 'No critical or high-priority issues found.',
    columns: [
      { key: 'title', label: 'Title', defaultVisible: true, sortable: true, exportable: true },
      { key: 'categoryId', label: 'Category', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'reporterNameSnapshot', label: 'Reporter', defaultVisible: true, exportable: true },
      { key: 'reportedAt', label: 'Reported At', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'issue-resolution-report',
    name: 'Issue Resolution Performance',
    category: 'issues',
    collection: 'issues',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No performance records found.',
    columns: [
      { key: 'title', label: 'Title', defaultVisible: true, sortable: true, exportable: true },
      { key: 'categoryId', label: 'Category', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, groupable: true, exportable: true },
      { key: 'reportedAt', label: 'Reported At', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'resolvedAt', label: 'Resolved At', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },

  
  // --- PROPERTY REPORTS PLACEHOLDERS ---
  // --- PROPERTY AND ASSET MANAGEMENT REPORTS ---
  {
    id: 'asset-register',
    name: 'Complete Asset Register',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No assets registered.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'categoryId', label: 'Category ID', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'quantity', label: 'Total Qty', defaultVisible: true, sortable: true, exportable: true },
      { key: 'availableQuantity', label: 'Available Qty', defaultVisible: true, sortable: true, exportable: true },
      { key: 'condition', label: 'Condition', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'location', label: 'Location', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'purchaseAt', label: 'Purchase Date', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'purchaseAmount', label: 'Purchase Cost', defaultVisible: true, sortable: true, exportable: true },
      { key: 'responsibleInchargeId', label: 'Assignee Staff ID', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'assets-by-madrasa',
    name: 'Madrasa-Wise Asset Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No assets registered for this madrasa.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'madrasaId', label: 'Madrasa ID', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'quantity', label: 'Total Qty', defaultVisible: true, sortable: true, exportable: true },
      { key: 'condition', label: 'Condition', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'assets-by-category',
    name: 'Category-Wise Asset Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No assets found under this category.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'categoryId', label: 'Category ID', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'condition', label: 'Condition', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'assets-available',
    name: 'Available Assets Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No available assets found.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'quantity', label: 'Total Qty', defaultVisible: true, sortable: true, exportable: true },
      { key: 'availableQuantity', label: 'Available Qty', defaultVisible: true, sortable: true, exportable: true },
      { key: 'location', label: 'Location', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-in-use',
    name: 'Assets In Use Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No assets currently marked in use.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'quantity', label: 'Qty In Use', defaultVisible: true, sortable: true, exportable: true },
      { key: 'responsibleInchargeId', label: 'Incharge Staff ID', defaultVisible: true, sortable: true, exportable: true },
      { key: 'location', label: 'Location', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-damaged',
    name: 'Damaged & Broken Assets Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No assets currently reported as damaged.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'condition', label: 'Condition', defaultVisible: true, sortable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, exportable: true },
      { key: 'location', label: 'Location', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-missing',
    name: 'Missing Assets Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No missing assets logged.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, exportable: true },
      { key: 'responsibleInchargeId', label: 'Responsible Staff ID', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-under-maintenance',
    name: 'Under-Maintenance Assets',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No assets under maintenance.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, exportable: true },
      { key: 'nextMaintenanceAt', label: 'Next Maintenance Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-maintenance-due',
    name: 'Maintenance Due Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No maintenance schedules due soon.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'lastMaintenanceAt', label: 'Last Maintenance', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'nextMaintenanceAt', label: 'Next Maintenance Due', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-maintenance-history',
    name: 'Maintenance & Service History',
    category: 'properties',
    collection: 'assetMaintenance',
    requiredFilters: ['madrasa'],
    emptyText: 'No maintenance logs found.',
    columns: [
      { key: 'assetId', label: 'Asset ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'maintenanceType', label: 'Type', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'complaint', label: 'Complaint details', defaultVisible: true, exportable: true },
      { key: 'serviceProvider', label: 'Service Provider', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'actualCost', label: 'Actual Cost', defaultVisible: true, sortable: true, exportable: true },
      { key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'completedAt', label: 'Completed Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-financial-value',
    name: 'Asset Financial Value Summary',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No purchase value data found.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'quantity', label: 'Qty', defaultVisible: true, exportable: true },
      { key: 'unitPrice', label: 'Unit Price', defaultVisible: true, sortable: true, exportable: true },
      { key: 'purchaseAmount', label: 'Total Purchase Amount', defaultVisible: true, sortable: true, exportable: true },
      { key: 'fundingSource', label: 'Funding Source', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true }
    ]
  },
  {
    id: 'assets-warranty-expiry',
    name: 'Warranty Expiry Report',
    category: 'properties',
    collection: 'madrasaAssets',
    requiredFilters: ['madrasa'],
    emptyText: 'No active warranties registered.',
    columns: [
      { key: 'name', label: 'Asset Name', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetCode', label: 'Code', defaultVisible: true, sortable: true, exportable: true },
      { key: 'warrantyProvider', label: 'Provider', defaultVisible: true, sortable: true, exportable: true },
      { key: 'warrantyStartAt', label: 'Start Date', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'warrantyEndAt', label: 'Expiry Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-transfer-history',
    name: 'Asset Transfer History',
    category: 'properties',
    collection: 'assetTransactions',
    requiredFilters: ['madrasa'],
    emptyText: 'No transfer logs found.',
    columns: [
      { key: 'assetId', label: 'Asset ID', defaultVisible: true, sortable: true, exportable: true },
      { key: 'previousMadrasaId', label: 'Source Madrasa ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'newMadrasaId', label: 'Destination Madrasa ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'quantityChanged', label: 'Quantity Transferred', defaultVisible: true, exportable: true },
      { key: 'reason', label: 'Reason', defaultVisible: true, exportable: true },
      { key: 'performedAt', label: 'Transfer Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  {
    id: 'assets-disposed',
    name: 'Disposed Assets Report',
    category: 'properties',
    collection: 'assetTransactions',
    requiredFilters: ['madrasa'],
    emptyText: 'No disposed assets logged.',
    columns: [
      { key: 'assetId', label: 'Asset ID', defaultVisible: true, sortable: true, exportable: true },
      { key: 'quantityChanged', label: 'Quantity Disposed', defaultVisible: true, exportable: true },
      { key: 'previousStatus', label: 'Previous Status', defaultVisible: true, exportable: true },
      { key: 'newStatus', label: 'New Status', defaultVisible: true, exportable: true },
      { key: 'reason', label: 'Disposal Details', defaultVisible: true, exportable: true },
      { key: 'performedAt', label: 'Disposal Date', type: 'date', defaultVisible: true, sortable: true, exportable: true }
    ]
  },
  
  // --- LIFECYCLE REPORTS ---
  {
    id: 'lifecycle-history',
    name: 'Lifecycle Action History',
    category: 'lifecycle',
    collection: 'userLifecycleHistory',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No lifecycle records found for the selected period.',
    columns: [
      { key: 'userId', label: 'User ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'personType', label: 'Type', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'lifecycleAction', label: 'Action', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'previousStatus', label: 'Previous Status', defaultVisible: true, sortable: true, exportable: true },
      { key: 'newStatus', label: 'New Status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'effectiveDate', label: 'Effective Date', type: 'date', defaultVisible: true, sortable: true, exportable: true },
      { key: 'actionPerformedBy', label: 'Performed By', defaultVisible: true, sortable: true, exportable: true },
    ]
  },
  {
    id: 'lifecycle-dismissed-students',
    name: 'Dismissed & Withdrawn Students',
    category: 'lifecycle',
    collection: 'userLifecycleHistory',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No students were dismissed or withdrawn in this period.',
    columns: [
      { key: 'userId', label: 'Student ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'lifecycleAction', label: 'Action', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reasonCode', label: 'Reason Code', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reasonText', label: 'Reason Description', defaultVisible: true, exportable: true },
      { key: 'effectiveDate', label: 'Effective Date', type: 'date', defaultVisible: true, sortable: true, exportable: true },
    ]
  },
  {
    id: 'lifecycle-relieved-staff',
    name: 'Relieved & Transferred Staff',
    category: 'lifecycle',
    collection: 'userLifecycleHistory',
    requiredFilters: ['madrasa', 'dateRange'],
    emptyText: 'No staff were relieved or transferred in this period.',
    columns: [
      { key: 'userId', label: 'Staff ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'lifecycleAction', label: 'Action', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reasonCode', label: 'Reason Code', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'reasonText', label: 'Reason Description', defaultVisible: true, exportable: true },
      { key: 'effectiveDate', label: 'Effective Date', type: 'date', defaultVisible: true, sortable: true, exportable: true },
    ]
  },
  {
    id: 'lifecycle-clearance-status',
    name: 'Pending Clearances',
    category: 'lifecycle',
    collection: 'lifecycleClearances',
    requiredFilters: ['madrasa'],
    emptyText: 'No pending clearances found.',
    columns: [
      { key: 'userId', label: 'User ID', defaultVisible: true, sortable: true, filterable: true, exportable: true },
      { key: 'department', label: 'Department', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'status', label: 'Status', type: 'status', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'pendingAmount', label: 'Pending Dues', defaultVisible: true, sortable: true, exportable: true },
      { key: 'assetIds', label: 'Pending Assets', defaultVisible: true, exportable: true },
    ]
  }
];
