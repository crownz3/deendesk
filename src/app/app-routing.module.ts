import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { ActivityLogsPage } from './pages/activity-logs/activity-logs.page';
import { AttendancePage } from './pages/attendance/attendance.page';
import { ContinueAccountPage } from './pages/continue-account/continue-account.page';
import { CsvImportsPage } from './pages/csv-imports/csv-imports.page';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { LoginPage } from './pages/login/login.page';
import { ChangePasswordPage } from './pages/change-password/change-password.page';
import { ManagementPage } from './pages/management/management.page';
import { NotificationsPage } from './pages/notifications/notifications.page';
import { PermissionsPage } from './pages/permissions/permissions.page';
import { ProfilePage } from './pages/profile/profile.page';
import { ReportsPage } from './pages/reports/reports.page';
import { SettingsPage } from './pages/settings/settings.page';
import { TreeViewPage } from './pages/tree-view/tree-view.page';
import { PasswordRequestsPage } from './pages/password-requests/password-requests.page';
import { ClassPlansPage } from './pages/class-plans/class-plans.page';
import { FeesPage } from './pages/fees/fees.page';
import { MyAssignmentsPage } from './pages/my-assignments/my-assignments.page';
import { EventsPage } from './pages/events/events.page';
import { IssuesPage } from './pages/issues/issues.page';
import { PropertiesPage } from './pages/properties/properties.page';
import { LifecyclePage } from './pages/lifecycle/lifecycle.page';
import { FirebaseUsagePage } from './pages/firebase-usage/firebase-usage.page';

import { StageHeadsPage } from './pages/stage-heads/stage-heads.page';
import { QuranPage } from './pages/quran/quran.page';

const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'change-password', component: ChangePasswordPage, canActivate: [authGuard] },
  { path: 'continue', component: ContinueAccountPage },
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard, permissionGuard], data: { permission: 'viewDashboard' } },
  { path: 'quran', component: QuranPage, canActivate: [authGuard] },
  { path: 'my-assignments', component: MyAssignmentsPage, canActivate: [authGuard] },
  { path: 'organizations', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'organizations', permission: 'manageOrganizations', roleRequired: 'superAdmin' } },
  { path: 'madrasas', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'madrasas', permission: 'manageMadrasas' } },
  { path: 'users', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'users', permission: 'manageUsers' } },
  { path: 'roles-permissions', component: PermissionsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'managePermissions' } },
  { path: 'coordinators', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'coordinators', permission: 'manageCoordinators' } },
  { path: 'madrasa-incharges', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'incharges', permission: 'manageIncharges' } },
  { path: 'stage-heads', component: StageHeadsPage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['manageStageHeads', 'manageStaff', 'manageCourses', 'viewDashboard'] } },
  { path: 'staff', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'staff', permissionsAny: ['manageStaff', 'viewDashboard'] } },
  { path: 'students', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'students', permissionsAny: ['manageStudents', 'viewDashboard'] } },
  { path: 'parents', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'parents', permission: 'manageParents' } },
  { path: 'courses', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'courses', permission: 'manageCourses' } },
  { path: 'course-types', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'courseTypes', permission: 'manageCourses' } },
  { path: 'stages', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'stages', permission: 'manageCourses' } },
  { path: 'classes', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'classes', permission: 'manageClasses' } },
  { path: 'classGroups', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'classGroups', permission: 'manageClasses' } },
  { path: 'subjects', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'subjects', permission: 'manageSubjects' } },
  { path: 'class-plans', component: ClassPlansPage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['manageClassPlans', 'takeAttendance', 'viewAttendance'] } },
  { path: 'attendance', component: AttendancePage, canActivate: [authGuard, permissionGuard], data: { permission: ['takeAttendance', 'viewAttendance'] } },
  { path: 'reports', component: ReportsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'generateReports' } },
  { path: 'activity-logs', component: ActivityLogsPage, canActivate: [authGuard] },
  { path: 'csv-imports', component: CsvImportsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'importCsv' } },
  { path: 'academic-tree', component: TreeViewPage, canActivate: [authGuard, permissionGuard], data: { tree: 'academic', permissionsAny: ['manageAcademicPlans', 'viewDashboard'] } },
  { path: 'people-tree', component: TreeViewPage, canActivate: [authGuard, permissionGuard], data: { tree: 'people', permissionsAny: ['manageStaff', 'manageStudents', 'manageParents', 'viewDashboard'] } },
  { path: 'notifications', component: NotificationsPage, canActivate: [authGuard] },
  { path: 'profile', component: ProfilePage, canActivate: [authGuard, permissionGuard], data: { permission: 'editProfile' } },
  { path: 'settings', component: SettingsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'manageSettings' } },
  { path: 'password-requests', component: PasswordRequestsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'managePasswordRequests' } },
  { path: 'fees', component: FeesPage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['manageFees', 'viewFees'] } },
  { path: 'events', component: EventsPage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['viewEvents', 'manageEvents'] } },
  { path: 'issues', component: IssuesPage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['viewIssues', 'reportIssues', 'manageIssues'] } },
  { path: 'properties', component: PropertiesPage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['viewProperties', 'manageProperties'] } },
  { path: 'property-categories', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'propertyCategories', permission: 'manageProperties' } },
  { path: 'lifecycle', component: LifecyclePage, canActivate: [authGuard, permissionGuard], data: { permissionsAny: ['viewLifecycleHistory', 'manageUserLifecycle'] } },
  { path: 'firebase-usage', component: FirebaseUsagePage, canActivate: [authGuard, permissionGuard], data: { permission: 'viewFirebaseUsage', roleRequired: 'superAdmin' } },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
