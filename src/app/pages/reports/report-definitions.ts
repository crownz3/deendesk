import { ReportDefinition } from '../../core/models/report.model';

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // --- STUDENT REPORTS ---
  {
    id: 'student-list',
    name: 'Student List',
    category: 'student',
    collection: 'users',
    roles: ['student'],
    requiredFilters: ['madrasa', 'course', 'class', 'stageLevel', 'status', 'gender', 'admissionDateRange', 'search'],
    emptyText: 'No students found for the selected filters.',
    columns: [
      { key: 'studentNameDisplay', label: 'Student' }, 
      { key: 'fatherNameDisplay', label: 'Father' }, 
      { key: 'parentNameDisplay', label: 'Parent' },
      { key: 'studentEmailDisplay', label: 'Email' },
      { key: 'madrasaNameDisplay', label: 'Madrasa' },
      { key: 'courseNameDisplay', label: 'Course' }, 
      { key: 'classNameDisplay', label: 'Class' }, 
      { key: 'stageLevelDisplay', label: 'Stage / Level' },
      { key: 'admissionDate', label: 'Admission Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'status' },
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
      { key: 'studentNameDisplay', label: 'Student' }, 
      { key: 'madrasaNameDisplay', label: 'Madrasa' },
      { key: 'admissionDate', label: 'Admission Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'status' }
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
      { key: 'actionDate', label: 'Date', type: 'date' },
      { key: 'studentNameDisplay', label: 'Student' },
      { key: 'action', label: 'Action' },
      { key: 'reason', label: 'Reason' }
    ]
  },

  // --- STAFF REPORTS ---
  {
    id: 'staff-list',
    name: 'Staff List',
    category: 'staff',
    collection: 'users',
    roles: ['teacher', 'staff'],
    requiredFilters: ['madrasa', 'status', 'search'],
    emptyText: 'No staff found for the selected filters.',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', type: 'role' },
      { key: 'madrasaNameDisplay', label: 'Madrasa' },
      { key: 'status', label: 'Status', type: 'status' }
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
      { key: 'name', label: 'Madrasa' },
      { key: 'code', label: 'Code' },
      { key: 'status', label: 'Status', type: 'status' }
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
      { key: 'name', label: 'Course' },
      { key: 'code', label: 'Code' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status', type: 'status' }
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
      { key: 'name', label: 'Class' },
      { key: 'courseNameDisplay', label: 'Course' },
      { key: 'stageOrLevel', label: 'Stage / Level' },
      { key: 'status', label: 'Status', type: 'status' }
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
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'studentNameDisplay', label: 'Student' },
      { key: 'classNameDisplay', label: 'Class' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'notes', label: 'Notes' }
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
      { key: 'groupLabel', label: 'Madrasa' },
      { key: 'count', label: 'Total Students' }
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
      { key: 'groupLabel', label: 'Course' },
      { key: 'count', label: 'Total Students' }
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
      { key: 'groupLabel', label: 'Gender' },
      { key: 'count', label: 'Total Students' }
    ]
  },
  {
    id: 'staff-count',
    name: 'Staff Count',
    category: 'count',
    collection: 'users',
    roles: ['staff', 'teacher'],
    requiredFilters: ['status'],
    emptyText: 'No data to aggregate.',
    aggregationLogic: 'count-by-field',
    groupByField: 'role',
    columns: [
      { key: 'groupLabel', label: 'Role' },
      { key: 'count', label: 'Total Staff' }
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
      { key: 'title', label: 'Activity' },
      { key: 'className', label: 'Class' },
      { key: 'assignedStaffNamesDisplay', label: 'Staff' },
      { key: 'startDate', label: 'Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'status' }
    ]
  }
];
