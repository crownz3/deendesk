import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouteReuseStrategy } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { CdkMenuModule } from '@angular/cdk/menu';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
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
import { AcademicTreeStudentsDialogComponent } from './pages/tree-view/academic-tree-students-dialog.component';
import { AcademicTreeStaffDialogComponent } from './pages/tree-view/academic-tree-staff-dialog.component';
import { AcademicTreeAssignStudentsDialogComponent } from './pages/tree-view/academic-tree-assign-students-dialog.component';
import { AcademicTreeAssignStaffDialogComponent } from './pages/tree-view/academic-tree-assign-staff-dialog.component';
import { PasswordRequestsPage } from './pages/password-requests/password-requests.page';
import { SetTemporaryPasswordDialogComponent } from './pages/password-requests/set-temporary-password-dialog.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from './shared/components/data-table/data-table.component';
import { EmptyStateComponent } from './shared/components/empty-state/empty-state.component';
import { NameWithCopyComponent } from './shared/components/name-with-copy/name-with-copy.component';
import { QuickAddDialogComponent } from './shared/components/quick-add-dialog/quick-add-dialog.component';
import { RoleBadgeComponent } from './shared/components/role-badge/role-badge.component';
import { StatsCardComponent } from './shared/components/stats-card/stats-card.component';
import { StatusBadgeComponent } from './shared/components/status-badge/status-badge.component';
import { GlobalLoaderComponent } from './shared/components/global-loader/global-loader.component';
import { AppSettingsDialogComponent } from './shared/components/app-settings-dialog/app-settings-dialog.component';
import { UserDetailsDialogComponent } from './shared/components/user-details-dialog/user-details-dialog.component';
import { SetupMapComponent } from './shared/components/setup-map/setup-map.component';

@NgModule({
  declarations: [
    AppComponent,
    AttendancePage,
    ContinueAccountPage,
    CsvImportsPage,
    DashboardPage,
    LoginPage,
    ChangePasswordPage,
    ManagementPage,
    NotificationsPage,
    PermissionsPage,
    ProfilePage,
    ReportsPage,
    SettingsPage,
    TreeViewPage,
    AcademicTreeStudentsDialogComponent,
    AcademicTreeStaffDialogComponent,
    AcademicTreeAssignStudentsDialogComponent,
    AcademicTreeAssignStaffDialogComponent,
    PasswordRequestsPage,
    SetTemporaryPasswordDialogComponent,
    ConfirmDialogComponent,
    DataTableComponent,
    EmptyStateComponent,
    QuickAddDialogComponent,
    NameWithCopyComponent,
    RoleBadgeComponent,
    StatsCardComponent,
    StatusBadgeComponent,
    GlobalLoaderComponent,
    AppSettingsDialogComponent,
    UserDetailsDialogComponent,
    SetupMapComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    DragDropModule,
    ClipboardModule,
    CdkMenuModule,
    MatListModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatTooltipModule,
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
