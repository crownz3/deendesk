import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
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

const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'change-password', component: ChangePasswordPage, canActivate: [authGuard] },
  { path: 'continue', component: ContinueAccountPage },
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard, permissionGuard], data: { permission: 'viewDashboard' } },
  { path: 'organizations', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'organizations', permission: 'manageOrganizations', roleRequired: 'superAdmin' } },
  { path: 'madrasas', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'madrasas', permission: 'manageMadrasas' } },
  { path: 'users', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'users', permission: 'manageUsers' } },
  { path: 'roles-permissions', component: PermissionsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'managePermissions' } },
  { path: 'coordinators', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'coordinators', permission: 'manageCoordinators' } },
  { path: 'madrasa-incharges', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'incharges', permission: 'manageIncharges' } },
  { path: 'staff', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'staff', permissionsAny: ['manageStaff', 'viewDashboard'] } },
  { path: 'students', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'students', permissionsAny: ['manageStudents', 'viewDashboard'] } },
  { path: 'parents', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'parents', permission: 'manageParents' } },
  { path: 'courses', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'courses', permission: 'manageCourses' } },
  { path: 'classes', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'classes', permission: 'manageClasses' } },
  { path: 'subjects', component: ManagementPage, canActivate: [authGuard, permissionGuard], data: { resource: 'subjects', permission: 'manageSubjects' } },
  { path: 'attendance', component: AttendancePage, canActivate: [authGuard, permissionGuard], data: { permission: ['takeAttendance', 'viewAttendance'] } },
  { path: 'reports', component: ReportsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'generateReports' } },
  { path: 'csv-imports', component: CsvImportsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'importCsv' } },
  { path: 'academic-tree', component: TreeViewPage, canActivate: [authGuard, permissionGuard], data: { tree: 'academic', permissionsAny: ['manageAcademicPlans', 'viewDashboard'] } },
  { path: 'people-tree', component: TreeViewPage, canActivate: [authGuard, permissionGuard], data: { tree: 'people', permissionsAny: ['manageStaff', 'manageStudents', 'manageParents', 'viewDashboard'] } },
  { path: 'notifications', component: NotificationsPage, canActivate: [authGuard] },
  { path: 'profile', component: ProfilePage, canActivate: [authGuard, permissionGuard], data: { permission: 'editProfile' } },
  { path: 'settings', component: SettingsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'manageSettings' } },
  { path: 'password-requests', component: PasswordRequestsPage, canActivate: [authGuard, permissionGuard], data: { permission: 'managePasswordRequests' } },
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
