import { Component, OnInit } from '@angular/core';
import { Observable, combineLatest, map, of, BehaviorSubject } from 'rxjs';
import { AppUser, PermissionKey, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService } from '../../core/services/repository.service';

export interface ArchitectureItem {
  id: string;
  name: string;
  type: 'module' | 'feature' | 'entity' | 'role' | 'service' | 'api' | 'workflow' | 'component';
  description: string;
  module?: string;
  route?: string;
  permission?: string;
  dependencies: string[];
  dependents: string[];
  connectedEntities: string[];
  connectedServices: string[];
  connectedRoles: string[];
  relationshipChain: string[];
  metadata?: Record<string, any>;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  icon: string;
  badgeColor: string;
  purpose: string;
  featuresCount: number;
  entitiesCount: number;
  features: string[];
  components: string[];
  services: string[];
  collections: string[];
  roles: string[];
}

export interface FeatureDefinition {
  id: string;
  name: string;
  module: string;
  route: string;
  icon: string;
  permission: string;
  rolesRequired: string[];
  purpose: string;
  components: string[];
  services: string[];
  entitiesRead: string[];
  entitiesWritten: string[];
  dependencies: string[];
}

export interface DataEntityDefinition {
  id: string;
  collectionName: string;
  name: string;
  description: string;
  module: string;
  fields: { name: string; type: string; description: string; isPrimary?: boolean; isForeign?: boolean }[];
  relationships: { targetEntity: string; type: '1:1' | '1:N' | 'N:M'; foreignKey: string; description: string }[];
  crudLocations: { create: string; read: string; update: string; delete: string };
  usedInFeatures: string[];
}

export interface DataRelationshipDefinition {
  sourceEntity: string;
  targetEntity: string;
  type: '1:1' | '1:N' | 'N:M';
  sourceField: string;
  targetField: string;
  description: string;
  cascadesOnDelete?: boolean;
}

export interface RolePermissionDefinition {
  roleKey: UserRole;
  roleName: string;
  description: string;
  color: string;
  accessibleModules: string[];
  permissions: { key: PermissionKey; name: string; granted: boolean; isSuperAdminOnly?: boolean }[];
  scopeRule: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  trigger: string;
  rolesInvolved: string[];
  entitiesInvolved: string[];
  steps: { stepNumber: number; title: string; actor: string; action: string; outcome: string }[];
}

export interface SystemConnectionDefinition {
  layer: 'frontend' | 'service' | 'auth' | 'database' | 'cloud_function' | 'storage';
  name: string;
  type: string;
  technology: string;
  purpose: string;
  connectedLayers: string[];
  dataFlowDirection: 'bidirectional' | 'inbound' | 'outbound';
}

@Component({
  selector: 'app-architecture-explorer',
  templateUrl: './architecture-explorer.page.html',
  styleUrls: ['./architecture-explorer.page.scss'],
  standalone: false,
})
export class ArchitectureExplorerPage implements OnInit {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  
  // Selected Tab Index
  activeTabIndex = 0;

  // Search & Filter
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly selectedModuleFilter$ = new BehaviorSubject<string>('all');
  readonly selectedTypeFilter$ = new BehaviorSubject<string>('all');

  // Selected item for Interactive Connection Explorer Drawer
  selectedItem: ArchitectureItem | null = null;
  historyStack: ArchitectureItem[] = [];

  // Architecture Derived Stats
  stats = {
    modulesCount: 8,
    featuresCount: 38,
    entitiesCount: 28,
    rolesCount: 10,
    permissionsCount: 42,
    servicesCount: 12,
    workflowsCount: 7,
    connectionsCount: 85
  };

  // Modules List
  readonly modules: ModuleDefinition[] = [
    {
      id: 'mod_auth',
      name: 'Auth & User Management',
      icon: 'shield-checkmark-outline',
      badgeColor: '#6366f1',
      purpose: 'Handles authentication, multi-role user provisioning, security tokens, permission resolution, and password resets.',
      featuresCount: 6,
      entitiesCount: 4,
      features: ['Authentication', 'User Provisioning', 'Roles & Permissions', 'Password Reset Requests', 'User Lifecycle', 'Duplicate Users Audit'],
      components: ['LoginPage', 'ChangePasswordPage', 'ContinueAccountPage', 'PermissionsPage', 'PasswordRequestsPage', 'DuplicateUsersPage'],
      services: ['AuthService', 'CredentialService', 'RolePermissionsService'],
      collections: ['users', 'students', 'staff', 'passwordResetRequests'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'teacher', 'staff', 'student', 'parent']
    },
    {
      id: 'mod_academic',
      name: 'Academic & Curriculum Management',
      icon: 'journal-outline',
      badgeColor: '#8b5cf6',
      purpose: 'Manages courses, class structures, class groups (sections), syllabus, stages, timetables, and academic hierarchy.',
      featuresCount: 8,
      entitiesCount: 6,
      features: ['Course Catalog & Stages', 'Courses', 'Classes', 'Class Groups', 'Academic Tree Structure', 'Stage Heads', 'Subjects & Syllabus', 'Class Plans & Timetables'],
      components: ['CourseCatalogPage', 'ManagementPage', 'TreeViewPage', 'StageHeadsPage', 'ClassPlansPage', 'StudyTimePage'],
      services: ['RepositoryService', 'ClassPlanAttendanceService'],
      collections: ['courses', 'classes', 'classGroups', 'subjects', 'classPlans', 'academicPlans'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'stageHead', 'teacher']
    },
    {
      id: 'mod_institution',
      name: 'Madrasa & Institution Administration',
      icon: 'school-outline',
      badgeColor: '#ec4899',
      purpose: 'Multi-tenant organization governance, madrasa site configuration, incharge assignments, and organizational branding.',
      featuresCount: 4,
      entitiesCount: 3,
      features: ['Organizations Management', 'Madrasas Administration', 'Coordinators Assignment', 'Madrasa Incharges Governance'],
      components: ['ManagementPage', 'BrandingMenuDialogComponent', 'MadrasaDetailsDialogComponent'],
      services: ['RepositoryService', 'OrgBrandingService'],
      collections: ['organizations', 'madrasas', 'users'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge']
    },
    {
      id: 'mod_operations',
      name: 'Operations & Logistics',
      icon: 'briefcase-outline',
      badgeColor: '#10b981',
      purpose: 'Daily attendance tracking, external activities, hostel room assignments, events, competitions, asset management, and issue tracking.',
      featuresCount: 9,
      entitiesCount: 8,
      features: ['Attendance Tracking', 'External Activities', 'Hostel Management', 'Events & Scheduling', 'Competitions & Prizes', 'Issues & Support', 'Properties & Asset Management', 'Study Time & Homework', 'Alumni Tracking'],
      components: ['AttendancePage', 'ExternalActivitiesPage', 'HostelsPage', 'EventsPage', 'CompetitionsPage', 'IssuesPage', 'PropertiesPage', 'StudyTimePage', 'AlumniPage'],
      services: ['RepositoryService', 'ClassPlanAttendanceService', 'AuditLogService'],
      collections: ['attendance', 'externalActivities', 'hostels', 'events', 'competitions', 'issues', 'properties', 'studyTime'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'teacher', 'staff', 'student']
    },
    {
      id: 'mod_finance',
      name: 'Finance & Subscriptions',
      icon: 'cash-outline',
      badgeColor: '#f59e0b',
      purpose: 'Fee plan definitions, student fee assignments, payment tracking, and SaaS platform subscription billing.',
      featuresCount: 3,
      entitiesCount: 4,
      features: ['Fee Plans & Structure', 'Fee Assignments & Payments', 'Subscriptions & Billing'],
      components: ['FeesPage', 'SubscriptionsPage'],
      services: ['RepositoryService'],
      collections: ['feePlans', 'feeAssignments', 'feePayments', 'subscriptions'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge']
    },
    {
      id: 'mod_communication',
      name: 'Communication & Announcements',
      icon: 'megaphone-outline',
      badgeColor: '#3b82f6',
      purpose: 'Broadcast announcements across organization levels and real-time push/in-app notifications.',
      featuresCount: 2,
      entitiesCount: 2,
      features: ['Announcements Management', 'Real-time Notifications'],
      components: ['AnnouncementsPage', 'NotificationsPage'],
      services: ['RepositoryService'],
      collections: ['announcements', 'notifications'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'teacher', 'staff', 'student', 'parent']
    },
    {
      id: 'mod_analytics',
      name: 'Reporting & Data Integration',
      icon: 'bar-chart-outline',
      badgeColor: '#14b8a6',
      purpose: 'Custom report generation, system activity audit logs, and bulk CSV data imports/exports.',
      featuresCount: 3,
      entitiesCount: 2,
      features: ['Report Generation', 'Activity Audit Logs', 'Bulk CSV Data Imports'],
      components: ['ReportsPage', 'ActivityLogsPage', 'CsvImportsPage'],
      services: ['RepositoryService', 'AuditLogService', 'CsvImportService'],
      collections: ['activityLogs', 'reports'],
      roles: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge']
    },
    {
      id: 'mod_diagnostics',
      name: 'Quality Assurance & Diagnostics',
      icon: 'bug-outline',
      badgeColor: '#ef4444',
      purpose: 'Super Admin architectural diagnostic suite, QA bug tracking, and real-time Firebase resource usage monitoring.',
      featuresCount: 3,
      entitiesCount: 2,
      features: ['Architecture & Dependency Explorer', 'QA & Bug Tracker', 'Firebase Resource Usage Monitor'],
      components: ['ArchitectureExplorerPage', 'QaTestingPage', 'FirebaseUsagePage'],
      services: ['RepositoryService', 'UsageTrackerService'],
      collections: ['qaBugs', 'usageLogs'],
      roles: ['superAdmin', 'organizationAdmin', 'qaTester']
    }
  ];

  // Features List
  readonly features: FeatureDefinition[] = [
    {
      id: 'feat_dashboard',
      name: 'Dashboard Overview',
      module: 'mod_auth',
      route: '/dashboard',
      icon: 'grid-outline',
      permission: 'viewDashboard',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'teacher', 'staff', 'student', 'parent'],
      purpose: 'Central hub displaying role-scoped stat cards, quick action menus, upcoming events, and attendance summaries.',
      components: ['DashboardPage', 'StatCardComponent'],
      services: ['AuthService', 'RepositoryService', 'OrgBrandingService'],
      entitiesRead: ['users', 'students', 'classes', 'madrasas', 'announcements'],
      entitiesWritten: [],
      dependencies: ['mod_auth', 'mod_academic']
    },
    {
      id: 'feat_users',
      name: 'User Management',
      module: 'mod_auth',
      route: '/users',
      icon: 'people-outline',
      permission: 'manageUsers',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge'],
      purpose: 'Create, edit, view, and assign roles to system users across organization boundaries.',
      components: ['ManagementPage', 'UserDetailsDialogComponent'],
      services: ['RepositoryService', 'CredentialService'],
      entitiesRead: ['users', 'madrasas', 'classes', 'classGroups'],
      entitiesWritten: ['users'],
      dependencies: ['mod_auth', 'mod_institution']
    },
    {
      id: 'feat_students',
      name: 'Student Enrolment & Scoping',
      module: 'mod_academic',
      route: '/students',
      icon: 'school-outline',
      permission: 'manageStudents',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'teacher', 'staff'],
      purpose: 'Manages student records, class group allocations, parent links, and role-based student scoping.',
      components: ['ManagementPage', 'UserDetailsDialogComponent'],
      services: ['RepositoryService', 'CredentialService'],
      entitiesRead: ['students', 'users', 'classes', 'classGroups', 'parents'],
      entitiesWritten: ['students', 'users'],
      dependencies: ['mod_academic', 'mod_auth']
    },
    {
      id: 'feat_staff',
      name: 'Staff & Teacher Directory',
      module: 'mod_academic',
      route: '/staff',
      icon: 'briefcase-outline',
      permission: 'manageStaff',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge'],
      purpose: 'Directory of teachers, staff, and ustadhs with assigned class groups, shift allocations, and credential status.',
      components: ['ManagementPage', 'UserDetailsDialogComponent'],
      services: ['RepositoryService', 'CredentialService'],
      entitiesRead: ['staff', 'users', 'classGroups', 'madrasas'],
      entitiesWritten: ['staff', 'users'],
      dependencies: ['mod_academic', 'mod_auth']
    },
    {
      id: 'feat_course_catalog',
      name: 'Course Catalog & Stages',
      module: 'mod_academic',
      route: '/course-catalog',
      icon: 'journal-outline',
      permission: 'viewCourseCatalog',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator'],
      purpose: 'Configures academic course templates, course types, and stage hierarchies.',
      components: ['CourseCatalogPage'],
      services: ['RepositoryService'],
      entitiesRead: ['courses', 'madrasas'],
      entitiesWritten: ['courses'],
      dependencies: ['mod_academic']
    },
    {
      id: 'feat_classes',
      name: 'Classes & Class Groups',
      module: 'mod_academic',
      route: '/classes',
      icon: 'easel-outline',
      permission: 'viewClasses',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge'],
      purpose: 'Manages class units, default sections (Section A), capacity, and staff assignments.',
      components: ['ManagementPage'],
      services: ['RepositoryService'],
      entitiesRead: ['classes', 'classGroups', 'courses', 'madrasas'],
      entitiesWritten: ['classes', 'classGroups'],
      dependencies: ['mod_academic']
    },
    {
      id: 'feat_attendance',
      name: 'Attendance Engine',
      module: 'mod_operations',
      route: '/attendance',
      icon: 'checkbox-outline',
      permission: 'takeAttendance',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge', 'teacher'],
      purpose: 'Daily student attendance marking, auto-saving, offline resume queue, and attendance history reports.',
      components: ['AttendancePage'],
      services: ['RepositoryService', 'ClassPlanAttendanceService'],
      entitiesRead: ['students', 'classPlans', 'attendance'],
      entitiesWritten: ['attendance'],
      dependencies: ['mod_academic', 'mod_operations']
    },
    {
      id: 'feat_fees',
      name: 'Fee Collection & Billing',
      module: 'mod_finance',
      route: '/fees',
      icon: 'cash-outline',
      permission: 'manageFees',
      rolesRequired: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge'],
      purpose: 'Manages fee plans, individual student fee assignments, discount rules, and payment collection receipts.',
      components: ['FeesPage'],
      services: ['RepositoryService'],
      entitiesRead: ['feePlans', 'feeAssignments', 'feePayments', 'students'],
      entitiesWritten: ['feeAssignments', 'feePayments'],
      dependencies: ['mod_finance', 'mod_academic']
    },
    {
      id: 'feat_roles_permissions',
      name: 'Role & Permissions Matrix',
      module: 'mod_auth',
      route: '/roles-permissions',
      icon: 'shield-checkmark-outline',
      permission: 'managePermissions',
      rolesRequired: ['superAdmin', 'organizationAdmin'],
      purpose: 'Custom permission overrides per role, custom role creation, and permission label dictionary.',
      components: ['PermissionsPage'],
      services: ['AuthService', 'RolePermissionsService', 'RepositoryService'],
      entitiesRead: ['users', 'roles'],
      entitiesWritten: ['users', 'roles'],
      dependencies: ['mod_auth']
    },
    {
      id: 'feat_architecture_explorer',
      name: 'Architecture Explorer',
      module: 'mod_diagnostics',
      route: '/architecture-explorer',
      icon: 'git-network-outline',
      permission: 'viewArchitectureExplorer',
      rolesRequired: ['superAdmin'],
      purpose: 'Super Admin diagnostic control panel visualizing system topology, data flow, entity relationships, and interactive dependency chains.',
      components: ['ArchitectureExplorerPage'],
      services: ['AuthService', 'RepositoryService'],
      entitiesRead: ['users', 'organizations', 'madrasas'],
      entitiesWritten: [],
      dependencies: ['mod_diagnostics', 'mod_auth']
    }
  ];

  // Data Entities List
  readonly dataEntities: DataEntityDefinition[] = [
    {
      id: 'ent_users',
      collectionName: 'users',
      name: 'User Account Profile',
      description: 'Central user authentication profile holding credentials, primary role, assigned madrasas, and permission overrides.',
      module: 'mod_auth',
      fields: [
        { name: 'uid', type: 'string', description: 'Unique Firebase Auth User ID', isPrimary: true },
        { name: 'email', type: 'string', description: 'User login email address' },
        { name: 'displayName', type: 'string', description: 'Full display name' },
        { name: 'role', type: 'UserRole', description: 'Primary system role string' },
        { name: 'roles', type: 'string[]', description: 'Secondary multi-role array' },
        { name: 'organizationId', type: 'string', description: 'Organization boundary ID', isForeign: true },
        { name: 'madrasaId', type: 'string', description: 'Primary assigned madrasa ID', isForeign: true },
        { name: 'madrasaIds', type: 'string[]', description: 'Multi-madrasa scope array', isForeign: true },
        { name: 'permissions', type: 'PermissionKey[]', description: 'Custom granted permission keys' },
        { name: 'status', type: 'string', description: 'Account status (active, inactive, suspended)' }
      ],
      relationships: [
        { targetEntity: 'organizations', type: '1:1', foreignKey: 'organizationId', description: 'Belongs to an Organization' },
        { targetEntity: 'madrasas', type: '1:N', foreignKey: 'madrasaIds', description: 'Assigned to one or more Madrasas' }
      ],
      crudLocations: {
        create: 'AuthService.signup() / QuickAddDialog',
        read: 'RepositoryService.list("users") / getAllOnce("users")',
        update: 'RepositoryService.update("users", id, patch)',
        delete: 'RepositoryService.delete("users", id)'
      },
      usedInFeatures: ['feat_users', 'feat_auth', 'feat_staff', 'feat_students']
    },
    {
      id: 'ent_students',
      collectionName: 'students',
      name: 'Student Record',
      description: 'Domain-specific student profile linked to academic class, class group, course, and parent user.',
      module: 'mod_academic',
      fields: [
        { name: 'id', type: 'string', description: 'Student record document ID', isPrimary: true },
        { name: 'uid', type: 'string', description: 'Linked Auth User UID', isForeign: true },
        { name: 'studentName', type: 'string', description: 'Student full legal name' },
        { name: 'admissionNumber', type: 'string', description: 'Unique school admission ID' },
        { name: 'organizationId', type: 'string', description: 'Organization ID', isForeign: true },
        { name: 'madrasaId', type: 'string', description: 'Madrasa ID', isForeign: true },
        { name: 'courseId', type: 'string', description: 'Enrolled Course ID', isForeign: true },
        { name: 'classId', type: 'string', description: 'Enrolled Class ID', isForeign: true },
        { name: 'groupId', type: 'string', description: 'Enrolled Class Group ID', isForeign: true },
        { name: 'parentUserId', type: 'string', description: 'Linked Parent User ID', isForeign: true }
      ],
      relationships: [
        { targetEntity: 'classes', type: '1:1', foreignKey: 'classId', description: 'Enrolled in a Class' },
        { targetEntity: 'classGroups', type: '1:1', foreignKey: 'groupId', description: 'Assigned to a Section/Group' },
        { targetEntity: 'users', type: '1:1', foreignKey: 'parentUserId', description: 'Linked to Parent Account' }
      ],
      crudLocations: {
        create: 'RepositoryService.create("students")',
        read: 'RepositoryService.list("students")',
        update: 'RepositoryService.update("students")',
        delete: 'RepositoryService.delete("students")'
      },
      usedInFeatures: ['feat_students', 'feat_attendance', 'feat_fees']
    },
    {
      id: 'ent_madrasas',
      collectionName: 'madrasas',
      name: 'Madrasa Site',
      description: 'Institution site model representing an individual campus or branch under an organization.',
      module: 'mod_institution',
      fields: [
        { name: 'id', type: 'string', description: 'Madrasa document ID', isPrimary: true },
        { name: 'name', type: 'string', description: 'Madrasa campus name' },
        { name: 'code', type: 'string', description: 'Campus code identifier' },
        { name: 'organizationId', type: 'string', description: 'Parent Organization ID', isForeign: true },
        { name: 'inchargeIds', type: 'string[]', description: 'Assigned Madrasa Incharge User IDs', isForeign: true },
        { name: 'coordinatorIds', type: 'string[]', description: 'Assigned Coordinator User IDs', isForeign: true }
      ],
      relationships: [
        { targetEntity: 'organizations', type: '1:1', foreignKey: 'organizationId', description: 'Branch of Organization' },
        { targetEntity: 'classes', type: '1:N', foreignKey: 'madrasaId', description: 'Houses multiple Classes' }
      ],
      crudLocations: {
        create: 'RepositoryService.create("madrasas")',
        read: 'RepositoryService.list("madrasas")',
        update: 'RepositoryService.update("madrasas")',
        delete: 'RepositoryService.delete("madrasas")'
      },
      usedInFeatures: ['feat_madrasas', 'feat_users', 'feat_classes']
    },
    {
      id: 'ent_classes',
      collectionName: 'classes',
      name: 'Class Unit',
      description: 'Academic class definition (e.g. Standard 5 Evening Makthab) containing class groups and curriculum plans.',
      module: 'mod_academic',
      fields: [
        { name: 'id', type: 'string', description: 'Class document ID', isPrimary: true },
        { name: 'name', type: 'string', description: 'Class title' },
        { name: 'courseId', type: 'string', description: 'Parent Course ID', isForeign: true },
        { name: 'madrasaId', type: 'string', description: 'Host Madrasa ID', isForeign: true },
        { name: 'assignedStaffIds', type: 'string[]', description: 'Assigned Class Teacher IDs', isForeign: true }
      ],
      relationships: [
        { targetEntity: 'courses', type: '1:1', foreignKey: 'courseId', description: 'Part of a Course' },
        { targetEntity: 'classGroups', type: '1:N', foreignKey: 'classId', description: 'Divided into Class Groups/Sections' }
      ],
      crudLocations: {
        create: 'RepositoryService.create("classes")',
        read: 'RepositoryService.list("classes")',
        update: 'RepositoryService.update("classes")',
        delete: 'RepositoryService.delete("classes")'
      },
      usedInFeatures: ['feat_classes', 'feat_students', 'feat_attendance']
    },
    {
      id: 'ent_classGroups',
      collectionName: 'classGroups',
      name: 'Class Group / Section',
      description: 'Specific student group section (e.g. Section A / Group 1) with dedicated ustadh/teacher staff assignments.',
      module: 'mod_academic',
      fields: [
        { name: 'id', type: 'string', description: 'Class Group document ID', isPrimary: true },
        { name: 'name', type: 'string', description: 'Group name (e.g. Section A)' },
        { name: 'classId', type: 'string', description: 'Parent Class ID', isForeign: true },
        { name: 'assignedStaffIds', type: 'string[]', description: 'Assigned Section Teacher User IDs', isForeign: true },
        { name: 'isDefault', type: 'boolean', description: 'Flag indicating auto-created default section' }
      ],
      relationships: [
        { targetEntity: 'classes', type: '1:1', foreignKey: 'classId', description: 'Section of Class' },
        { targetEntity: 'students', type: '1:N', foreignKey: 'groupId', description: 'Contains Students' }
      ],
      crudLocations: {
        create: 'RepositoryService.create("classGroups")',
        read: 'RepositoryService.list("classGroups")',
        update: 'RepositoryService.update("classGroups")',
        delete: 'RepositoryService.delete("classGroups")'
      },
      usedInFeatures: ['feat_classes', 'feat_students', 'feat_staff']
    }
  ];

  // Data Relationships List
  readonly relationships: DataRelationshipDefinition[] = [
    {
      sourceEntity: 'organizations',
      targetEntity: 'madrasas',
      type: '1:N',
      sourceField: 'id',
      targetField: 'organizationId',
      description: 'An Organization contains one or more Madrasa campuses.',
      cascadesOnDelete: false
    },
    {
      sourceEntity: 'madrasas',
      targetEntity: 'classes',
      type: '1:N',
      sourceField: 'id',
      targetField: 'madrasaId',
      description: 'A Madrasa campus houses multiple academic Classes.',
      cascadesOnDelete: false
    },
    {
      sourceEntity: 'courses',
      targetEntity: 'classes',
      type: '1:N',
      sourceField: 'id',
      targetField: 'courseId',
      description: 'A Course curriculum template is instantiated across multiple Classes.',
      cascadesOnDelete: false
    },
    {
      sourceEntity: 'classes',
      targetEntity: 'classGroups',
      type: '1:N',
      sourceField: 'id',
      targetField: 'classId',
      description: 'A Class unit is divided into one or more Class Groups / Sections (e.g. Section A).',
      cascadesOnDelete: true
    },
    {
      sourceEntity: 'classGroups',
      targetEntity: 'students',
      type: '1:N',
      sourceField: 'id',
      targetField: 'groupId',
      description: 'A Class Group contains enrolled Students.',
      cascadesOnDelete: false
    },
    {
      sourceEntity: 'users',
      targetEntity: 'staff',
      type: '1:1',
      sourceField: 'uid',
      targetField: 'userId',
      description: 'A User account links 1:1 with a Staff record for teachers and in-charges.',
      cascadesOnDelete: true
    },
    {
      sourceEntity: 'students',
      targetEntity: 'feeAssignments',
      type: '1:N',
      sourceField: 'id',
      targetField: 'studentId',
      description: 'A Student receives one or more Fee Assignments for billing.',
      cascadesOnDelete: false
    },
    {
      sourceEntity: 'classPlans',
      targetEntity: 'attendance',
      type: '1:N',
      sourceField: 'id',
      targetField: 'classPlanId',
      description: 'A Class Plan session generates daily Attendance mark records.',
      cascadesOnDelete: false
    }
  ];

  // Roles & Permissions Matrix
  readonly rolesPermissions: RolePermissionDefinition[] = [
    {
      roleKey: 'superAdmin',
      roleName: 'Super Admin',
      description: 'Global system administrator with unconstrained access across all organizations, settings, diagnostics, and subscription billing.',
      color: '#ef4444',
      accessibleModules: ['Auth', 'Academic', 'Institution', 'Operations', 'Finance', 'Communication', 'Analytics', 'Diagnostics'],
      permissions: [
        { key: 'viewDashboard', name: 'View Dashboard', granted: true },
        { key: 'manageUsers', name: 'Manage Users', granted: true },
        { key: 'manageMadrasas', name: 'Manage Madrasas', granted: true },
        { key: 'manageCourses', name: 'Manage Courses', granted: true },
        { key: 'manageClasses', name: 'Manage Classes', granted: true },
        { key: 'manageStaff', name: 'Manage Staff', granted: true },
        { key: 'manageStudents', name: 'Manage Students', granted: true },
        { key: 'manageFees', name: 'Manage Fees', granted: true },
        { key: 'generateReports', name: 'Generate Reports', granted: true },
        { key: 'viewArchitectureExplorer', name: 'Architecture Explorer', granted: true, isSuperAdminOnly: true },
        { key: 'viewFirebaseUsage', name: 'Firebase Resource Usage', granted: true, isSuperAdminOnly: true }
      ],
      scopeRule: 'Unconstrained global scope across all multi-tenant organization boundaries.'
    },
    {
      roleKey: 'organizationAdmin',
      roleName: 'Organization Admin',
      description: 'Administrator over an entire tenant organization managing all madrasa sites, courses, staff, and overall operations.',
      color: '#f59e0b',
      accessibleModules: ['Auth', 'Academic', 'Institution', 'Operations', 'Finance', 'Communication', 'Analytics'],
      permissions: [
        { key: 'viewDashboard', name: 'View Dashboard', granted: true },
        { key: 'manageUsers', name: 'Manage Users', granted: true },
        { key: 'manageMadrasas', name: 'Manage Madrasas', granted: true },
        { key: 'manageCourses', name: 'Manage Courses', granted: true },
        { key: 'manageClasses', name: 'Manage Classes', granted: true },
        { key: 'manageStaff', name: 'Manage Staff', granted: true },
        { key: 'manageStudents', name: 'Manage Students', granted: true },
        { key: 'manageFees', name: 'Manage Fees', granted: true },
        { key: 'generateReports', name: 'Generate Reports', granted: true },
        { key: 'viewArchitectureExplorer', name: 'Architecture Explorer', granted: false, isSuperAdminOnly: true }
      ],
      scopeRule: 'Scoped to own organizationId across all child madrasas.'
    },
    {
      roleKey: 'madrasaIncharge',
      roleName: 'Madrasa Incharge',
      description: 'Principal / Head of a specific madrasa campus managing teachers, student enrollments, attendance, and local fees.',
      color: '#10b981',
      accessibleModules: ['Auth', 'Academic', 'Operations', 'Finance', 'Communication', 'Analytics'],
      permissions: [
        { key: 'viewDashboard', name: 'View Dashboard', granted: true },
        { key: 'manageUsers', name: 'Manage Users', granted: true },
        { key: 'manageMadrasas', name: 'Manage Madrasas', granted: false },
        { key: 'manageCourses', name: 'Manage Courses', granted: false },
        { key: 'manageClasses', name: 'Manage Classes', granted: true },
        { key: 'manageStaff', name: 'Manage Staff', granted: true },
        { key: 'manageStudents', name: 'Manage Students', granted: true },
        { key: 'manageFees', name: 'Manage Fees', granted: true },
        { key: 'generateReports', name: 'Generate Reports', granted: true }
      ],
      scopeRule: 'Scoped to assigned madrasaId / madrasaIds.'
    },
    {
      roleKey: 'teacher',
      roleName: 'Teacher / Staff',
      description: 'Ustadh / Teacher conducting class sessions, taking daily attendance, managing study time, and recording grades.',
      color: '#3b82f6',
      accessibleModules: ['Academic', 'Operations', 'Communication'],
      permissions: [
        { key: 'viewDashboard', name: 'View Dashboard', granted: true },
        { key: 'manageUsers', name: 'Manage Users', granted: false },
        { key: 'manageStudents', name: 'Manage Students', granted: false },
        { key: 'takeAttendance', name: 'Take Attendance', granted: true },
        { key: 'manageClassPlans', name: 'Manage Class Plans', granted: true }
      ],
      scopeRule: 'Scoped to students in assigned class groups (groupIds).'
    }
  ];

  // Workflows List
  readonly workflows: WorkflowDefinition[] = [
    {
      id: 'wf_student_enrolment',
      name: 'Student Enrolment Workflow',
      category: 'Academic Operations',
      description: 'End-to-end process of onboarding a new student, creating user credentials, assigning a class & section, and generating fee plans.',
      trigger: 'Quick Add Dialog / Bulk CSV Student Import',
      rolesInvolved: ['superAdmin', 'organizationAdmin', 'madrasaIncharge'],
      entitiesInvolved: ['students', 'users', 'classes', 'classGroups', 'feeAssignments'],
      steps: [
        { stepNumber: 1, title: 'Input Student Details', actor: 'Madrasa Incharge', action: 'Fills student name, parent contact, class & group selection', outcome: 'Draft student object prepared' },
        { stepNumber: 2, title: 'Persist Student & User Docs', actor: 'RepositoryService', action: 'Creates doc in students collection and generates Auth User account in users collection', outcome: 'Student profile created with unique UID & admissionId' },
        { stepNumber: 3, title: 'Class Group Allocation', actor: 'RepositoryService', action: 'Links student ID to assigned Class Group (groupId)', outcome: 'Student appears in teacher section list' },
        { stepNumber: 4, title: 'Auto Fee Assignment', actor: 'FeeService', action: 'Assigns active madrasa fee plan to student', outcome: 'Fee assignment document generated for billing' }
      ]
    },
    {
      id: 'wf_attendance_lifecycle',
      name: 'Daily Attendance & Queue Resumption',
      category: 'Daily Operations',
      description: 'Teacher attendance marking flow with offline queue caching, auto-save, and incomplete job resumption.',
      trigger: 'Teacher opens Attendance page for a Class Plan session',
      rolesInvolved: ['teacher', 'madrasaIncharge'],
      entitiesInvolved: ['classPlans', 'attendance', 'students'],
      steps: [
        { stepNumber: 1, title: 'Load Session Roster', actor: 'Teacher', action: 'Selects date, class plan, and section', outcome: 'Enrolled students loaded with default Present status' },
        { stepNumber: 2, title: 'Mark Exceptions', actor: 'Teacher', action: 'Toggles Absent, Late, or Leave status for students', outcome: 'Attendance map updated in UI state' },
        { stepNumber: 3, title: 'Batch Submit', actor: 'ClassPlanAttendanceService', action: 'Submits batch write to Firestore attendance collection', outcome: 'Attendance records saved with timestamp' },
        { stepNumber: 4, title: 'Offline Queue Fallback', actor: 'ClassPlanAttendanceService', action: 'If network drops, queues job in IndexedDB and resumes when app reopens', outcome: 'Zero data loss during network interruptions' }
      ]
    }
  ];

  // System Connections Architecture
  readonly systemConnections: SystemConnectionDefinition[] = [
    {
      layer: 'frontend',
      name: 'Angular 18 Single Page Application',
      type: 'Client Layer',
      technology: 'Angular 18, RxJS 7, Angular Material, Vanilla CSS',
      purpose: 'Renders reactive responsive UI, manages routing, guards, and local component states.',
      connectedLayers: ['Service Abstraction Layer'],
      dataFlowDirection: 'bidirectional'
    },
    {
      layer: 'service',
      name: 'Service Abstraction Layer',
      type: 'Logic & Scope Engine',
      technology: 'Injectable Angular Services (AuthService, RepositoryService)',
      purpose: 'Enforces role-based data scoping (getScopeConstraints), multi-key deduplication, and in-memory caching.',
      connectedLayers: ['Angular 18 SPA', 'Firebase Firestore DB', 'Firebase Authentication'],
      dataFlowDirection: 'bidirectional'
    },
    {
      layer: 'auth',
      name: 'Firebase Authentication',
      type: 'Identity Provider',
      technology: 'Firebase Auth SDK, JWT Tokens',
      purpose: 'Authenticates users, manages email/password logins, and maintains secure session tokens.',
      connectedLayers: ['Service Abstraction Layer'],
      dataFlowDirection: 'bidirectional'
    },
    {
      layer: 'database',
      name: 'Firebase Cloud Firestore',
      type: 'NoSQL Database',
      technology: 'Google Cloud Firestore, Indexed Queries',
      purpose: 'Stores real-time document collections across organizations, madrasas, users, students, and attendance.',
      connectedLayers: ['Service Abstraction Layer'],
      dataFlowDirection: 'bidirectional'
    },
    {
      layer: 'cloud_function',
      name: 'Firebase Cloud Functions',
      type: 'Serverless Microservices',
      technology: 'Node.js, Firebase Admin SDK',
      purpose: 'Executes privileged administrative tasks like auth user deletion and secure credential resetting.',
      connectedLayers: ['Service Abstraction Layer', 'Firebase Authentication'],
      dataFlowDirection: 'outbound'
    }
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService
  ) {}

  collectionCounts: Record<string, number> = {};
  totalLiveDocsCount = 0;

  readonly allFirebaseCollections = [
    { key: 'users', name: 'Users', icon: 'people-outline', description: 'User authentication & profile records' },
    { key: 'students', name: 'Students', icon: 'school-outline', description: 'Enrolled student domain records' },
    { key: 'madrasas', name: 'Madrasas', icon: 'business-outline', description: 'Madrasa campus sites' },
    { key: 'courses', name: 'Courses', icon: 'journal-outline', description: 'Academic course curriculum templates' },
    { key: 'classes', name: 'Classes', icon: 'easel-outline', description: 'Academic class units' },
    { key: 'classGroups', name: 'Class Groups', icon: 'people-circle-outline', description: 'Class sections & student groups' },
    { key: 'staff', name: 'Staff & Teachers', icon: 'briefcase-outline', description: 'Staff directory records' },
    { key: 'parents', name: 'Parents', icon: 'person-add-outline', description: 'Parent guardian accounts' },
    { key: 'events', name: 'Events', icon: 'calendar-outline', description: 'Institution events & schedules' },
    { key: 'issues', name: 'Issues', icon: 'warning-outline', description: 'Reported issues & tickets' },
    { key: 'properties', name: 'Properties', icon: 'cube-outline', description: 'Assets & property inventory' },
    { key: 'feePlans', name: 'Fee Plans', icon: 'cash-outline', description: 'Fee structure plan templates' },
    { key: 'feeAssignments', name: 'Fee Assignments', icon: 'receipt-outline', description: 'Student fee billing assignments' },
    { key: 'announcements', name: 'Announcements', icon: 'megaphone-outline', description: 'Broadcast announcements' },
    { key: 'organizations', name: 'Organizations', icon: 'earth-outline', description: 'Multi-tenant organizations' }
  ];

  selectedExplorerCollection = 'students';
  collectionRows: any[] = [];
  isLoadingCollectionData = false;
  collectionSearchQuery = '';
  collectionPageIndex = 0;
  collectionPageSize = 10;

  copiedId: string | null = null;

  copyToClipboard(idText: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!idText) return;
    navigator.clipboard.writeText(idText).then(() => {
      this.copiedId = idText;
      setTimeout(() => {
        if (this.copiedId === idText) this.copiedId = null;
      }, 2000);
    }).catch(err => console.error('[Clipboard Copy Failed]', err));
  }

  // Filter Dropdown Options
  availableOrganizations: { id: string; name: string }[] = [];
  availableMadrasas: { id: string; name: string }[] = [];
  availableCourses: { id: string; name: string }[] = [];
  availableClasses: { id: string; name: string; madrasaId?: string }[] = [];
  availableClassGroups: { id: string; name: string; classId?: string; madrasaId?: string }[] = [];

  // Selected Filter Values
  selectedOrgId = '';
  selectedMadrasaId = '';
  selectedCourseId = '';
  selectedClassId = '';
  selectedGroupId = '';

  // Data Scope Discrepancy Audit State
  isAuditingDiscrepancies = false;
  discrepancyAuditResults: {
    madrasaId: string;
    madrasaName: string;
    inchargeCount: number;
    orgAdminCount: number;
    superAdminCount: number;
    hasMismatch: boolean;
    discrepantStudents: {
      studentId: string;
      studentName: string;
      reason: string;
      missingOrgId: boolean;
      missingMadrasaId: boolean;
      rawDoc: Record<string, any>;
    }[];
  }[] = [];

  // Filter Search Queries for each dropdown
  orgFilterQuery = '';
  madrasaFilterQuery = '';
  courseFilterQuery = '';
  classFilterQuery = '';
  groupFilterQuery = '';

  get searchableOrganizations(): { id: string; name: string }[] {
    if (!this.orgFilterQuery.trim()) return this.availableOrganizations;
    const q = this.orgFilterQuery.toLowerCase().trim();
    return this.availableOrganizations.filter(o => o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  }

  get searchableMadrasas(): { id: string; name: string }[] {
    if (!this.madrasaFilterQuery.trim()) return this.availableMadrasas;
    const q = this.madrasaFilterQuery.toLowerCase().trim();
    return this.availableMadrasas.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }

  get searchableCourses(): { id: string; name: string }[] {
    if (!this.courseFilterQuery.trim()) return this.availableCourses;
    const q = this.courseFilterQuery.toLowerCase().trim();
    return this.availableCourses.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }

  get searchableClasses(): { id: string; name: string }[] {
    let list = this.filteredClassesForSelectedMadrasa;
    if (this.classFilterQuery.trim()) {
      const q = this.classFilterQuery.toLowerCase().trim();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    return list;
  }

  get searchableClassGroups(): { id: string; name: string }[] {
    let list = this.filteredGroupsForSelectedClass;
    if (this.groupFilterQuery.trim()) {
      const q = this.groupFilterQuery.toLowerCase().trim();
      list = list.filter(g => g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
    }
    return list;
  }

  ngOnInit(): void {
    this.loadLiveCollectionCounts();
    this.loadFilterDropdownOptions();
    this.selectCollection('students');
    this.runDataScopeAudit();
  }

  async runDataScopeAudit(): Promise<void> {
    this.isAuditingDiscrepancies = true;
    this.discrepancyAuditResults = [];

    try {
      const currentUser = await new Promise<AppUser | null>((resolve) => {
        const sub = this.profile$.subscribe(p => { resolve(p); if (sub) sub.unsubscribe(); });
      });

      const [mads, studs, users] = await Promise.all([
        this.repo.getAllOnce<any>('madrasas', currentUser, { forceRefresh: true }).catch(() => []),
        this.repo.getAllOnce<any>('students', currentUser, { forceRefresh: true }).catch(() => []),
        this.repo.getAllOnce<any>('users', currentUser, { forceRefresh: true }).catch(() => [])
      ]);

      const mergedStudents = [...studs, ...users.filter(u => String(u['role']).toLowerCase() === 'student')];

      const extractId = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'object' && val.id) return String(val.id).trim();
        return String(val).trim();
      };

      const auditList: any[] = [];

      for (const mad of mads) {
        const mId = extractId(mad.id);
        const mName = String(mad.name || mId);
        const orgId = extractId(mad.organizationId);

        // 1. Madrasa Incharge Scoped
        const inchargeStudents = mergedStudents.filter(s => {
          const sMadId = extractId(s.madrasaId || (Array.isArray(s.madrasaIds) ? s.madrasaIds[0] : null) || s['assignedMadrasaId']);
          return sMadId === mId;
        });

        // 2. Org Admin Scoped (includes fallback for missing organizationId)
        const orgAdminStudents = mergedStudents.filter(s => {
          const sOrgId = extractId(s.organizationId);
          const sMadId = extractId(s.madrasaId || (Array.isArray(s.madrasaIds) ? s.madrasaIds[0] : null) || s['assignedMadrasaId']);
          return (sOrgId === orgId || !orgId || !sOrgId) && sMadId === mId;
        });

        // 3. Super Admin Scoped
        const superAdminStudents = mergedStudents.filter(s => {
          const sMadId = extractId(s.madrasaId || (Array.isArray(s.madrasaIds) ? s.madrasaIds[0] : null) || s['assignedMadrasaId']);
          return sMadId === mId;
        });

        const inchargeCount = inchargeStudents.length;
        const orgAdminCount = orgAdminStudents.length;
        const superAdminCount = superAdminStudents.length;

        const hasMismatch = inchargeCount !== orgAdminCount || inchargeCount !== superAdminCount;

        const discrepantStudentsMap = new Map<string, any>();

        inchargeStudents.forEach(s => {
          const sId = extractId(s.id || s.uid);
          const sOrgId = extractId(s.organizationId);
          const sMadId = extractId(s.madrasaId);

          let reason = '';
          let missingOrgId = false;
          let missingMadrasaId = false;

          if (!sOrgId && orgId) {
            reason = 'Missing organizationId on student document (excluded in Org Admin view)';
            missingOrgId = true;
          } else if (!sMadId && Array.isArray(s.madrasaIds)) {
            reason = 'Uses legacy madrasaIds array format instead of madrasaId string';
            missingMadrasaId = true;
          }

          if (reason && sId && !discrepantStudentsMap.has(sId)) {
            discrepantStudentsMap.set(sId, {
              studentId: sId,
              studentName: String(s['displayName'] || s['studentName'] || s['name'] || 'Student ' + sId),
              reason,
              missingOrgId,
              missingMadrasaId,
              rawDoc: s
            });
          }
        });

        auditList.push({
          madrasaId: mId,
          madrasaName: mName,
          inchargeCount,
          orgAdminCount,
          superAdminCount,
          hasMismatch,
          discrepantStudents: Array.from(discrepantStudentsMap.values())
        });
      }

      this.discrepancyAuditResults = auditList;
    } catch (err) {
      console.error('[Data Scope Audit Error]', err);
    } finally {
      this.isAuditingDiscrepancies = false;
    }
  }

  async repairStudentScopingRecord(studentDoc: any, targetOrgId: string, targetMadrasaId: string): Promise<void> {
    try {
      const currentUser = await new Promise<AppUser | null>((resolve) => {
        const sub = this.profile$.subscribe(p => { resolve(p); if (sub) sub.unsubscribe(); });
      });

      const sId = studentDoc.id || studentDoc.uid;
      const effectiveOrgId = studentDoc.organizationId || targetOrgId || currentUser?.organizationId || 'default-org';
      const effectiveMadrasaId = studentDoc.madrasaId || targetMadrasaId || (Array.isArray(studentDoc.madrasaIds) ? studentDoc.madrasaIds[0] : '');

      const updatedFields: Record<string, any> = {
        ...studentDoc,
        organizationId: effectiveOrgId,
        madrasaId: effectiveMadrasaId,
        groupId: studentDoc.groupId || studentDoc.classGroupId || studentDoc.assignedGroupId || '',
        classGroupId: studentDoc.classGroupId || studentDoc.groupId || ''
      };

      // 1. Update in 'students' collection
      await this.repo.update<any>('students', sId, updatedFields, currentUser).catch(async () => {
        await this.repo.create<any>('students', updatedFields, currentUser, sId);
      });

      // 2. Also update in 'users' collection if it exists
      await this.repo.update<any>('users', sId, {
        organizationId: effectiveOrgId,
        madrasaId: effectiveMadrasaId,
        groupId: updatedFields['groupId'],
        classGroupId: updatedFields['classGroupId']
      }, currentUser).catch(() => {});

      alert(`Successfully synced and repaired scoping fields for student: ${studentDoc.studentName || studentDoc.displayName || sId}`);
      this.runDataScopeAudit();
    } catch (err) {
      console.error('[Repair Record Failed]', err);
      alert('Failed to repair record: ' + (err as any)?.message);
    }
  }

  async loadFilterDropdownOptions(): Promise<void> {
    try {
      const currentUser = await new Promise<AppUser | null>((resolve) => {
        const sub = this.profile$.subscribe(p => { resolve(p); if (sub) sub.unsubscribe(); });
      });

      const [orgs, mads, crs, cls, grps] = await Promise.all([
        this.repo.getAllOnce<any>('organizations', currentUser, { forceRefresh: false }).catch(() => []),
        this.repo.getAllOnce<any>('madrasas', currentUser, { forceRefresh: false }).catch(() => []),
        this.repo.getAllOnce<any>('courses', currentUser, { forceRefresh: false }).catch(() => []),
        this.repo.getAllOnce<any>('classes', currentUser, { forceRefresh: false }).catch(() => []),
        this.repo.getAllOnce<any>('classGroups', currentUser, { forceRefresh: false }).catch(() => [])
      ]);

      this.availableOrganizations = orgs.map(o => ({ id: String(o.id || o.uid), name: String(o.name || o.displayName || o.id) }));
      this.availableMadrasas = mads.map(m => ({ id: String(m.id), name: String(m.name || m.id) }));
      this.availableCourses = crs.map(c => ({ id: String(c.id), name: String(c.name || c.title || c.id) }));
      this.availableClasses = cls.map(c => ({ id: String(c.id), name: String(c.name || c.id), madrasaId: String(c.madrasaId || '') }));
      this.availableClassGroups = grps.map(g => ({ id: String(g.id), name: String(g.name || g.id), classId: String(g.classId || ''), madrasaId: String(g.madrasaId || '') }));
    } catch (err) {
      console.warn('[Dropdown Options Load Error]', err);
    }
  }

  get filteredClassesForSelectedMadrasa(): { id: string; name: string }[] {
    if (!this.selectedMadrasaId) return this.availableClasses;
    return this.availableClasses.filter(c => !c.madrasaId || c.madrasaId === this.selectedMadrasaId);
  }

  get filteredGroupsForSelectedClass(): { id: string; name: string }[] {
    let list = this.availableClassGroups;
    if (this.selectedMadrasaId) {
      list = list.filter(g => !g.madrasaId || g.madrasaId === this.selectedMadrasaId);
    }
    if (this.selectedClassId) {
      list = list.filter(g => !g.classId || g.classId === this.selectedClassId);
    }
    return list;
  }

  onMadrasaFilterChange(): void {
    this.selectedClassId = '';
    this.selectedGroupId = '';
    this.collectionPageIndex = 0;
  }

  onClassFilterChange(): void {
    this.selectedGroupId = '';
    this.collectionPageIndex = 0;
  }

  resetCollectionFilters(): void {
    this.selectedOrgId = '';
    this.selectedMadrasaId = '';
    this.selectedCourseId = '';
    this.selectedClassId = '';
    this.selectedGroupId = '';
    this.orgFilterQuery = '';
    this.madrasaFilterQuery = '';
    this.courseFilterQuery = '';
    this.classFilterQuery = '';
    this.groupFilterQuery = '';
    this.collectionSearchQuery = '';
    this.collectionPageIndex = 0;
  }

  async selectCollection(colKey: string): Promise<void> {
    this.selectedExplorerCollection = colKey;
    this.collectionPageIndex = 0;
    this.isLoadingCollectionData = true;
    try {
      const currentUser = await new Promise<AppUser | null>((resolve) => {
        const sub = this.profile$.subscribe(p => {
          resolve(p);
          if (sub) sub.unsubscribe();
        });
      });
      const rows = await this.repo.getAllOnce<any>(colKey, currentUser, { forceRefresh: true });
      this.collectionRows = rows || [];
      this.collectionCounts[colKey] = this.collectionRows.length;
    } catch (e) {
      console.error('[Collection Load Error]', e);
      this.collectionRows = [];
    } finally {
      this.isLoadingCollectionData = false;
    }
  }

  get filteredCollectionRows(): any[] {
    let rows = this.collectionRows;

    const extractId = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'object' && val.id) return String(val.id).trim();
      return String(val).trim();
    };

    if (this.selectedOrgId) {
      rows = rows.filter(r => extractId(r.organizationId) === this.selectedOrgId);
    }

    if (this.selectedMadrasaId) {
      rows = rows.filter(r => {
        const mId = extractId(r.madrasaId || (Array.isArray(r.madrasaIds) ? r.madrasaIds[0] : null));
        return mId === this.selectedMadrasaId;
      });
    }

    if (this.selectedCourseId) {
      rows = rows.filter(r => extractId(r.courseId) === this.selectedCourseId);
    }

    if (this.selectedClassId) {
      rows = rows.filter(r => {
        const cId = extractId(r.classId || r.assignedClassId);
        return cId === this.selectedClassId;
      });
    }

    if (this.selectedGroupId) {
      rows = rows.filter(r => {
        const gId = extractId(r.groupId || r.classGroupId || r.assignedGroupId);
        return gId === this.selectedGroupId;
      });
    }

    if (this.collectionSearchQuery && this.collectionSearchQuery.trim()) {
      const q = this.collectionSearchQuery.toLowerCase().trim();
      rows = rows.filter(row => {
        return Object.values(row).some(val => {
          if (!val) return false;
          if (typeof val === 'string' || typeof val === 'number') {
            return String(val).toLowerCase().includes(q);
          }
          return false;
        });
      });
    }

    return rows;
  }

  get paginatedCollectionRows(): any[] {
    const start = this.collectionPageIndex * this.collectionPageSize;
    return this.filteredCollectionRows.slice(start, start + this.collectionPageSize);
  }

  get totalCollectionPages(): number {
    return Math.ceil(this.filteredCollectionRows.length / this.collectionPageSize) || 1;
  }

  nextCollectionPage(): void {
    if (this.collectionPageIndex < this.totalCollectionPages - 1) {
      this.collectionPageIndex++;
    }
  }

  prevCollectionPage(): void {
    if (this.collectionPageIndex > 0) {
      this.collectionPageIndex--;
    }
  }

  async loadLiveCollectionCounts(): Promise<void> {
    try {
      const currentUser = await new Promise<AppUser | null>((resolve) => {
        const sub = this.profile$.subscribe(p => {
          resolve(p);
          if (sub) sub.unsubscribe();
        });
      });

      const collections = ['users', 'students', 'madrasas', 'courses', 'classes', 'classGroups', 'staff', 'parents', 'events', 'issues', 'properties', 'feePlans', 'feeAssignments', 'organizations'];
      let total = 0;
      for (const col of collections) {
        const rows = await this.repo.getAllOnce<any>(col, currentUser, { forceRefresh: false }).catch(() => []);
        this.collectionCounts[col] = rows.length;
        total += rows.length;
      }
      this.totalLiveDocsCount = total;
    } catch (e) {
      console.warn('[Live Counts Load Error]', e);
    }
  }

  lookupInputId = '';
  isSearchingId = false;
  lookupResult: {
    searchedId: string;
    found: boolean;
    collectionName?: string;
    docName?: string;
    fields?: Record<string, any>;
    fieldsCount?: number;
    moduleName?: string;
    parentHierarchy?: { label: string; id: string; name: string; collection: string }[];
    connectedStudents?: { id: string; name: string; admissionNumber?: string }[];
    connectedStaff?: { id: string; name: string; role?: string; email?: string }[];
    connectedGroups?: { id: string; name: string }[];
    connectedClasses?: { id: string; name: string }[];
    features?: string[];
    totalConnectedRecordsCount?: number;
    totalStudentsCount?: number;
    totalStaffCount?: number;
  } | null = null;

  async performIdLookup(searchId?: string): Promise<void> {
    const targetId = (searchId || this.lookupInputId || '').trim();
    if (!targetId) return;

    this.isSearchingId = true;
    this.lookupResult = null;

    try {
      const currentUser = await new Promise<AppUser | null>((resolve) => {
        const sub = this.profile$.subscribe(p => {
          resolve(p);
          if (sub) sub.unsubscribe();
        });
      });

      const collectionsToSearch = [
        'users', 'students', 'madrasas', 'courses', 'classes',
        'classGroups', 'staff', 'parents', 'events', 'issues',
        'properties', 'feePlans', 'feeAssignments', 'organizations'
      ];

      let matchCollection = '';
      let matchDoc: Record<string, any> | null = null;

      for (const colName of collectionsToSearch) {
        const rows = await this.repo.getAllOnce<any>(colName, currentUser, { forceRefresh: true });
        const found = rows.find(r => 
          String(r.id || r.uid || r.docId || '').toLowerCase() === targetId.toLowerCase() ||
          String(r.admissionNumber || r.code || '').toLowerCase() === targetId.toLowerCase()
        );
        if (found) {
          matchCollection = colName;
          matchDoc = found;
          break;
        }
      }

      if (matchDoc) {
        const extractId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val.trim();
          if (typeof val === 'object' && val.id) return String(val.id).trim();
          return String(val).trim();
        };

        const docName = matchDoc['displayName'] || matchDoc['name'] || matchDoc['studentName'] || matchDoc['code'] || targetId;

        // Fetch surrounding core datasets to resolve complete graph
        const [allStudents, allStaff, allUsers, allClasses, allGroups, allCourses, allMadrasas] = await Promise.all([
          this.repo.getAllOnce<any>('students', currentUser, { forceRefresh: true }).catch(() => []),
          this.repo.getAllOnce<any>('staff', currentUser, { forceRefresh: true }).catch(() => []),
          this.repo.getAllOnce<any>('users', currentUser, { forceRefresh: true }).catch(() => []),
          this.repo.getAllOnce<any>('classes', currentUser, { forceRefresh: true }).catch(() => []),
          this.repo.getAllOnce<any>('classGroups', currentUser, { forceRefresh: true }).catch(() => []),
          this.repo.getAllOnce<any>('courses', currentUser, { forceRefresh: true }).catch(() => []),
          this.repo.getAllOnce<any>('madrasas', currentUser, { forceRefresh: true }).catch(() => [])
        ]);

        const modName = this.getModuleForCollection(matchCollection);
        const featureNames = this.getFeaturesForCollection(matchCollection);

        // Resolve Parent Hierarchy (Course -> Class -> Madrasa -> Organization)
        const parentHierarchy: { label: string; id: string; name: string; collection: string }[] = [];
        
        const directMadrasaId = extractId(matchDoc['madrasaId'] || (Array.isArray(matchDoc['madrasaIds']) ? matchDoc['madrasaIds'][0] : null));
        const directClassId = extractId(matchDoc['classId'] || matchDoc['assignedClassId']);
        const directGroupId = extractId(matchDoc['groupId'] || matchDoc['classGroupId'] || matchDoc['assignedGroupId']);
        const directCourseId = extractId(matchDoc['courseId']);

        // Class Group parent resolution
        let parentClassObj = allClasses.find(c => extractId(c.id) === directClassId);
        if (!parentClassObj && matchCollection === 'classGroups') {
          parentClassObj = allClasses.find(c => extractId(c.id) === extractId(matchDoc!['classId']));
        }

        let parentCourseObj = allCourses.find(c => extractId(c.id) === directCourseId);
        if (!parentCourseObj && parentClassObj) {
          parentCourseObj = allCourses.find(c => extractId(c.id) === extractId(parentClassObj!['courseId']));
        }

        const effectiveMadrasaId = directMadrasaId || (parentClassObj ? extractId(parentClassObj['madrasaId']) : '');
        let parentMadrasaObj = allMadrasas.find(m => extractId(m.id) === effectiveMadrasaId);

        if (parentCourseObj) {
          parentHierarchy.push({ label: 'Parent Course', id: extractId(parentCourseObj.id), name: String(parentCourseObj['name'] || parentCourseObj.id), collection: 'courses' });
        }
        if (parentClassObj) {
          parentHierarchy.push({ label: 'Parent Class', id: extractId(parentClassObj.id), name: String(parentClassObj['name'] || parentClassObj.id), collection: 'classes' });
        }
        if (parentMadrasaObj) {
          parentHierarchy.push({ label: 'Parent Madrasa', id: extractId(parentMadrasaObj.id), name: String(parentMadrasaObj['name'] || parentMadrasaObj.id), collection: 'madrasas' });
        }

        // Resolve Enrolled Connected Students
        const mergedStudentSource = [...allStudents, ...allUsers.filter(u => {
          const r = String(u['role'] || '').toLowerCase();
          return r === 'student' || (u['classGroupId'] || u['groupId'] || u['studentId']);
        })];

        const connectedStudentsMap = new Map<string, { id: string; name: string; admissionNumber?: string }>();

        mergedStudentSource.forEach(s => {
          const sId = extractId(s.id || s.uid || s.studentId);
          const sMadrasaId = extractId(s.madrasaId);
          const sClassId = extractId(s.classId || s.assignedClassId);
          const sGroupId = extractId(s.groupId || s.classGroupId || s.assignedGroupId);

          let isMatch = false;

          if (matchCollection === 'classGroups' && (sGroupId === targetId || sGroupId === directGroupId)) isMatch = true;
          else if (matchCollection === 'classes' && sClassId === targetId) isMatch = true;
          else if (matchCollection === 'madrasas' && sMadrasaId === targetId) isMatch = true;
          else if (matchCollection === 'users' && extractId(s.parentUserId) === targetId) isMatch = true;

          if (isMatch && sId && !connectedStudentsMap.has(sId)) {
            connectedStudentsMap.set(sId, {
              id: sId,
              name: String(s['displayName'] || s['studentName'] || s['name'] || 'Student ' + sId),
              admissionNumber: s['admissionNumber'] || s['rollNumber']
            });
          }
        });

        const connectedStudents = Array.from(connectedStudentsMap.values());

        // Resolve Connected Staff / Teachers
        const mergedStaffSource = [...allStaff, ...allUsers.filter(u => {
          const r = String(u['role'] || '').toLowerCase();
          return ['teacher', 'staff', 'ustadh', 'madrasaincharge', 'coordinator'].includes(r);
        })];

        const connectedStaffMap = new Map<string, { id: string; name: string; role?: string; email?: string }>();

        mergedStaffSource.forEach(st => {
          const stId = extractId(st.id || st.uid || st.userId);
          const stIdentities = [
            stId,
            extractId(st.uid),
            extractId(st.userId),
            String(st.email || '').toLowerCase()
          ].filter(Boolean);

          let isMatch = false;

          if (matchCollection === 'classGroups') {
            const groupStaffTokens = [
              ...(Array.isArray(matchDoc!['assignedStaffIds']) ? matchDoc!['assignedStaffIds'] : []),
              ...(Array.isArray(matchDoc!['assignedStaff']) ? matchDoc!['assignedStaff'] : []),
              matchDoc!['teacherId'], matchDoc!['staffId']
            ].map(v => extractId(v).toLowerCase()).filter(Boolean);

            if (groupStaffTokens.some(tok => stIdentities.includes(tok))) isMatch = true;
          } else if (matchCollection === 'classes') {
            const classStaffTokens = [
              ...(Array.isArray(matchDoc!['assignedStaffIds']) ? matchDoc!['assignedStaffIds'] : []),
              ...(Array.isArray(matchDoc!['assignedStaff']) ? matchDoc!['assignedStaff'] : [])
            ].map(v => extractId(v).toLowerCase()).filter(Boolean);

            if (classStaffTokens.some(tok => stIdentities.includes(tok))) isMatch = true;
          } else if (matchCollection === 'madrasas') {
            const mInchargeTokens = [
              ...(Array.isArray(matchDoc!['inchargeIds']) ? matchDoc!['inchargeIds'] : []),
              ...(Array.isArray(matchDoc!['coordinatorIds']) ? matchDoc!['coordinatorIds'] : [])
            ].map(v => extractId(v).toLowerCase()).filter(Boolean);

            if (mInchargeTokens.some(tok => stIdentities.includes(tok))) isMatch = true;
          }

          if (isMatch && stId && !connectedStaffMap.has(stId)) {
            connectedStaffMap.set(stId, {
              id: stId,
              name: String(st['displayName'] || st['name'] || st.email || 'Staff ' + stId),
              role: st['role'],
              email: st['email']
            });
          }
        });

        const connectedStaff = Array.from(connectedStaffMap.values());

        // Resolve Connected Child Class Groups
        let connectedGroups: { id: string; name: string }[] = [];
        if (matchCollection === 'classes') {
          connectedGroups = allGroups
            .filter(g => extractId(g.classId) === targetId)
            .map(g => ({ id: extractId(g.id), name: String(g['name'] || g.id) }));
        }

        const totalConnectedRecordsCount = parentHierarchy.length + connectedStudents.length + connectedStaff.length + connectedGroups.length;
        const fieldsCount = Object.keys(matchDoc).length;

        this.lookupResult = {
          searchedId: targetId,
          found: true,
          collectionName: matchCollection,
          docName: String(docName),
          fields: matchDoc,
          fieldsCount,
          moduleName: modName,
          parentHierarchy,
          connectedStudents,
          connectedStaff,
          connectedGroups,
          features: featureNames,
          totalConnectedRecordsCount,
          totalStudentsCount: connectedStudents.length,
          totalStaffCount: connectedStaff.length
        };

        const chainNodes = [
          `Search Input ID: ${targetId}`,
          `Collection: ${matchCollection}`,
          `Record Name: ${docName}`
        ];

        parentHierarchy.forEach(p => chainNodes.push(`${p.label}: ${p.name}`));
        chainNodes.push(`Enrolled Students Count: ${connectedStudents.length}`);
        chainNodes.push(`Assigned Staff Count: ${connectedStaff.length}`);

        this.inspectItem({
          id: targetId,
          name: `${docName} [Collection: ${matchCollection}]`,
          type: 'entity',
          description: `Document record found in Firestore collection '${matchCollection}'. ID: ${targetId}`,
          module: modName,
          dependencies: parentHierarchy.map(p => `${p.label}: ${p.name} (${p.id})`),
          dependents: [
            ...connectedStudents.slice(0, 10).map(s => `Student: ${s.name} (${s.id})`),
            ...connectedStaff.map(st => `Staff: ${st.name} (${st.id})`)
          ],
          connectedEntities: [matchCollection, 'students', 'staff', 'classes', 'madrasas'],
          connectedServices: ['RepositoryService', 'AuthService'],
          connectedRoles: ['superAdmin', 'organizationAdmin', 'madrasaIncharge', 'teacher'],
          relationshipChain: chainNodes
        });
      } else {
        this.lookupResult = {
          searchedId: targetId,
          found: false
        };
      }
    } catch (err) {
      console.error('[ID Lookup Failed]', err);
      this.lookupResult = { searchedId: targetId, found: false };
    } finally {
      this.isSearchingId = false;
    }
  }

  private getModuleForCollection(col: string): string {
    const foundMod = this.modules.find(m => m.collections.includes(col));
    return foundMod ? foundMod.name : 'System Core';
  }

  private getFeaturesForCollection(col: string): string[] {
    return this.features
      .filter(f => f.entitiesRead.includes(col) || f.entitiesWritten.includes(col))
      .map(f => f.name);
  }

  // Open Interactive Connection Explorer Drawer
  inspectItem(item: ArchitectureItem): void {
    if (this.selectedItem) {
      this.historyStack.push(this.selectedItem);
    }
    this.selectedItem = item;
  }

  // Quick inspect by ID & type
  inspectById(id: string, type: 'module' | 'feature' | 'entity' | 'role' | 'service' | 'api' | 'workflow' | 'component'): void {
    const item = this.buildArchitectureItem(id, type);
    if (item) {
      this.inspectItem(item);
    }
  }

  // Go back in connection history stack
  goBackHistory(): void {
    if (this.historyStack.length > 0) {
      this.selectedItem = this.historyStack.pop() || null;
    } else {
      this.selectedItem = null;
    }
  }

  closeDrawer(): void {
    this.selectedItem = null;
    this.historyStack = [];
  }

  // Construct item graph dynamically
  private buildArchitectureItem(id: string, type: string): ArchitectureItem | null {
    if (type === 'module') {
      const mod = this.modules.find(m => m.id === id || m.name.toLowerCase().includes(id.toLowerCase()));
      if (!mod) return null;
      return {
        id: mod.id,
        name: mod.name,
        type: 'module',
        description: mod.purpose,
        dependencies: ['Firebase Cloud Firestore', 'AuthService'],
        dependents: mod.features,
        connectedEntities: mod.collections,
        connectedServices: mod.services,
        connectedRoles: mod.roles,
        relationshipChain: ['Super Admin', 'Permission Engine', mod.name, 'Features (' + mod.features.length + ')', 'Firestore Collections (' + mod.collections.length + ')']
      };
    }

    if (type === 'feature') {
      const feat = this.features.find(f => f.id === id || f.name.toLowerCase().includes(id.toLowerCase()));
      if (!feat) return null;
      return {
        id: feat.id,
        name: feat.name,
        type: 'feature',
        description: feat.purpose,
        module: feat.module,
        route: feat.route,
        permission: feat.permission,
        dependencies: feat.dependencies,
        dependents: feat.components,
        connectedEntities: [...feat.entitiesRead, ...feat.entitiesWritten],
        connectedServices: feat.services,
        connectedRoles: feat.rolesRequired,
        relationshipChain: ['Role Requirement (' + feat.rolesRequired[0] + ')', 'Permission: ' + feat.permission, 'Route: ' + feat.route, feat.name, 'Components: ' + feat.components.join(', ')]
      };
    }

    if (type === 'entity') {
      const ent = this.dataEntities.find(e => e.id === id || e.collectionName === id);
      if (!ent) return null;
      return {
        id: ent.id,
        name: ent.name + ' (' + ent.collectionName + ')',
        type: 'entity',
        description: ent.description,
        module: ent.module,
        dependencies: ent.relationships.map(r => r.targetEntity),
        dependents: ent.usedInFeatures,
        connectedEntities: ent.relationships.map(r => r.targetEntity),
        connectedServices: ['RepositoryService'],
        connectedRoles: ['superAdmin', 'organizationAdmin', 'madrasaIncharge'],
        relationshipChain: ['Module: ' + ent.module, 'Collection: ' + ent.collectionName, 'CRUD: ' + ent.crudLocations.read, 'Features: ' + ent.usedInFeatures.join(', ')]
      };
    }

    if (type === 'role') {
      const role = this.rolesPermissions.find(r => r.roleKey === id || r.roleName.toLowerCase().includes(id.toLowerCase()));
      if (!role) return null;
      return {
        id: role.roleKey,
        name: role.roleName,
        type: 'role',
        description: role.description,
        dependencies: ['AuthService', 'RolePermissionsService'],
        dependents: role.accessibleModules,
        connectedEntities: ['users', 'students', 'madrasas'],
        connectedServices: ['AuthService', 'RepositoryService'],
        connectedRoles: [role.roleKey],
        relationshipChain: ['Identity Auth Token', 'Role: ' + role.roleName, 'Scope Rule: ' + role.scopeRule, 'Accessible Modules (' + role.accessibleModules.length + ')']
      };
    }

    if (type === 'workflow') {
      const wf = this.workflows.find(w => w.id === id);
      if (!wf) return null;
      return {
        id: wf.id,
        name: wf.name,
        type: 'workflow',
        description: wf.description,
        dependencies: wf.entitiesInvolved,
        dependents: wf.steps.map(s => s.title),
        connectedEntities: wf.entitiesInvolved,
        connectedServices: ['RepositoryService', 'ClassPlanAttendanceService'],
        connectedRoles: wf.rolesInvolved,
        relationshipChain: ['Trigger: ' + wf.trigger, wf.name, 'Roles: ' + wf.rolesInvolved.join(', '), 'Steps Count: ' + wf.steps.length]
      };
    }

    return {
      id,
      name: id,
      type: 'component',
      description: 'System Component or Service',
      dependencies: [],
      dependents: [],
      connectedEntities: [],
      connectedServices: [],
      connectedRoles: [],
      relationshipChain: [id]
    };
  }
}
