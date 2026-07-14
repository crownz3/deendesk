import { ReportDefinition, ReportFieldMetadata } from '../../core/models/report.model';

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // --- STUDENT REPORTS ---
  {
    id: 'student-list',
    name: 'Student List',
    category: 'student',
    collection: 'users',
    roles: ['student'],
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
    collection: 'users',
    roles: ['student'],
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
    id: 'staff-list',
    name: 'Staff List',
    category: 'staff',
    collection: 'users',
    roles: ['teacher', 'staff', 'coordinator', 'madrasaIncharge'],
    requiredFilters: ['madrasa', 'status', 'search'],
    emptyText: 'No staff found for the selected filters.',
    columns: [
      { key: 'name', label: 'Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'email', label: 'Email', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'gender', label: 'Gender', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'role', label: 'Role', type: 'role', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'madrasaNameDisplay', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
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
      { key: 'name', label: 'Name', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
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

  // --- TIMETABLE REPORTS ---
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
    collection: 'users',
    roles: ['student'],
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
    collection: 'users',
    roles: ['student'],
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
    aggregationLogic: 'count-by-field',
    groupByField: 'madrasaId',
    columns: [
      { key: 'groupLabel', label: 'Madrasa', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
      { key: 'count', label: 'Assignments', defaultVisible: true, sortable: true, filterable: true, groupable: true, exportable: true },
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
];

