import { Course, PermissionKey, UserRole } from '../models/domain.model';

export const SUPER_ADMIN_EMAIL = 'mohamedibrahim010425@gmail.com';
export const GENERATED_EMAIL_DOMAIN = 'deendesk.app';

export const ROLE_LABELS: Record<UserRole, string> = {
  superAdmin: 'Super Admin',
  organizationAdmin: 'Organization Admin',
  coordinator: 'Coordinator',
  madrasaIncharge: 'Madrasa Incharge',
  teacher: 'Teacher / Staff',
  student: 'Student',
  parent: 'Parent',
};

export const ROLE_ORDER: UserRole[] = [
  'superAdmin',
  'organizationAdmin',
  'coordinator',
  'madrasaIncharge',
  'teacher',
  'student',
  'parent',
];

export const ALL_PERMISSIONS: PermissionKey[] = [
  'viewDashboard',
  'manageOrganizations',
  'manageMadrasas',
  'manageUsers',
  'manageCoordinators',
  'manageIncharges',
  'manageStaff',
  'manageStudents',
  'manageParents',
  'manageCourses',
  'manageClasses',
  'manageSubjects',
  'takeAttendance',
  'viewAttendance',
  'generateReports',
  'importCsv',
  'manageNotifications',
  'editProfile',
  'viewAnalytics',
  'manageSettings',
  'managePermissions',
  'manageAcademicPlans',
  'managePromotions',
  'managePasswordRequests',
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewDashboard: 'View dashboard',
  manageOrganizations: 'Manage organizations',
  manageMadrasas: 'Manage madrasas',
  manageUsers: 'Manage users',
  manageCoordinators: 'Manage coordinators',
  manageIncharges: 'Manage madrasa incharges',
  manageStaff: 'Manage staff and teachers',
  manageStudents: 'Manage students',
  manageParents: 'Manage parents',
  manageCourses: 'Manage courses',
  manageClasses: 'Manage classes',
  manageSubjects: 'Manage subjects',
  takeAttendance: 'Take attendance',
  viewAttendance: 'View attendance',
  generateReports: 'Generate reports',
  importCsv: 'Import CSV',
  manageNotifications: 'Manage notifications',
  editProfile: 'Edit profile',
  viewAnalytics: 'View analytics',
  manageSettings: 'Manage settings',
  managePermissions: 'Manage permissions',
  manageAcademicPlans: 'Manage academic plans',
  managePromotions: 'Manage promotions and demotions',
  managePasswordRequests: 'Manage password requests',
};

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  superAdmin: ALL_PERMISSIONS,
  organizationAdmin: [
    'viewDashboard',
    'manageMadrasas',
    'manageUsers',
    'manageCoordinators',
    'manageIncharges',
    'manageStaff',
    'manageStudents',
    'manageParents',
    'manageCourses',
    'manageClasses',
    'manageSubjects',
    'takeAttendance',
    'viewAttendance',
    'generateReports',
    'importCsv',
    'manageNotifications',
    'editProfile',
    'viewAnalytics',
    'managePermissions',
    'manageAcademicPlans',
    'managePromotions',
    'managePasswordRequests',
  ],
  coordinator: [
    'viewDashboard',
    'manageIncharges',
    'manageStaff',
    'manageStudents',
    'manageParents',
    'manageCourses',
    'manageClasses',
    'manageSubjects',
    'takeAttendance',
    'viewAttendance',
    'generateReports',
    'importCsv',
    'manageNotifications',
    'editProfile',
    'viewAnalytics',
    'manageAcademicPlans',
    'managePromotions',
    'managePasswordRequests',
  ],
  madrasaIncharge: [
    'viewDashboard',
    'manageStaff',
    'manageStudents',
    'manageParents',
    'manageCourses',
    'manageClasses',
    'manageSubjects',
    'takeAttendance',
    'viewAttendance',
    'generateReports',
    'importCsv',
    'manageNotifications',
    'editProfile',
    'viewAnalytics',
    'manageAcademicPlans',
    'managePromotions',
    'managePasswordRequests',
  ],
  teacher: [
    'viewDashboard',
    'takeAttendance',
    'viewAttendance',
    'generateReports',
    'editProfile',
    'viewAnalytics',
    'manageAcademicPlans',
  ],
  student: ['viewDashboard', 'viewAttendance', 'editProfile'],
  parent: ['viewDashboard', 'viewAttendance', 'editProfile'],
};

export const DEFAULT_COURSES: Omit<Course, 'id'>[] = [
  {
    name: 'Maktab',
    code: 'MAKTAB',
    type: 'maktab',
    stages: ['Miftah', 'Tilawatul Quran'],
    levels: [],
    status: 'active',
    description: 'Foundational maktab course with Miftah and Tilawatul Quran stages.',
  },
  {
    name: 'Aalim',
    code: 'AALIM',
    type: 'aalim',
    stages: [],
    levels: ['Preparatory level', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Final year'],
    status: 'active',
    description: 'Structured Aalim course with customizable years, subjects, teachers, and promotions.',
  },
  {
    name: 'Hifz',
    code: 'HIFZ',
    type: 'hifz',
    stages: ['Sabaq', 'Sabaqi', 'Manzil'],
    levels: ['Juz-based', 'Surah-based', 'Ayah-based'],
    status: 'active',
    description: 'Long-term memorization planning with daily targets and progress tracking.',
  },
  {
    name: 'Muballigh',
    code: 'MUBALLIGH',
    type: 'muballigh',
    stages: [],
    levels: ['Level 1', 'Level 2', 'Level 3'],
    status: 'active',
    description: 'Flexible dawah and training course structure.',
  },
  {
    name: 'Custom',
    code: 'CUSTOM',
    type: 'custom',
    stages: [],
    levels: [],
    status: 'active',
    description: 'Template for organization-defined custom courses, stages, classes, and subjects.',
  },
];

export function permissionsForRole(role: UserRole, customPermissions?: PermissionKey[]): PermissionKey[] {
  return Array.from(new Set([...(ROLE_PERMISSIONS[role] ?? []), ...(customPermissions ?? [])]));
}

export function hasPermission(role: UserRole | undefined, permissions: PermissionKey[] | undefined, permission: PermissionKey): boolean {
  if (role === 'superAdmin') {
    return true;
  }

  return Boolean(permissions?.includes(permission));
}
