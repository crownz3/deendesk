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
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AttendancePage } from './pages/attendance/attendance.page';
import { ContinueAccountPage } from './pages/continue-account/continue-account.page';
import { CsvImportsPage } from './pages/csv-imports/csv-imports.page';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { LoginPage } from './pages/login/login.page';
import { ManagementPage } from './pages/management/management.page';
import { NotificationsPage } from './pages/notifications/notifications.page';
import { PermissionsPage } from './pages/permissions/permissions.page';
import { ProfilePage } from './pages/profile/profile.page';
import { ReportsPage } from './pages/reports/reports.page';
import { SettingsPage } from './pages/settings/settings.page';
import { TreeViewPage } from './pages/tree-view/tree-view.page';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from './shared/components/data-table/data-table.component';
import { EmptyStateComponent } from './shared/components/empty-state/empty-state.component';
import { QuickAddDialogComponent } from './shared/components/quick-add-dialog/quick-add-dialog.component';
import { RoleBadgeComponent } from './shared/components/role-badge/role-badge.component';
import { StatsCardComponent } from './shared/components/stats-card/stats-card.component';
import { StatusBadgeComponent } from './shared/components/status-badge/status-badge.component';

@NgModule({
  declarations: [
    AppComponent,
    AttendancePage,
    ContinueAccountPage,
    CsvImportsPage,
    DashboardPage,
    LoginPage,
    ManagementPage,
    NotificationsPage,
    PermissionsPage,
    ProfilePage,
    ReportsPage,
    SettingsPage,
    TreeViewPage,
    ConfirmDialogComponent,
    DataTableComponent,
    EmptyStateComponent,
    QuickAddDialogComponent,
    RoleBadgeComponent,
    StatsCardComponent,
    StatusBadgeComponent,
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
    MatListModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatProgressSpinnerModule,
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
