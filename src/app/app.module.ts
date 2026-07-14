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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
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
import { ReportExportOptionsDialogComponent } from './pages/reports/report-export-options-dialog.component';
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
import { MadrasaDetailsDialogComponent } from './shared/components/madrasa-details-dialog/madrasa-details-dialog.component';
import { HelpGuideDialogComponent } from './shared/components/help-guide-dialog/help-guide-dialog.component';
import { SetupMapComponent } from './shared/components/setup-map/setup-map.component';
import { CourseDetailsDialogComponent } from './pages/management/course-details-dialog/course-details-dialog.component';
import { ClassDetailsDialogComponent } from './pages/management/class-details-dialog/class-details-dialog.component';
import { CsvReferenceIdsDialogComponent } from './pages/csv-imports/csv-reference-ids-dialog/csv-reference-ids-dialog.component';
import { ClassPlansPage } from './pages/class-plans/class-plans.page';
import { ClassPlanFormComponent } from './pages/class-plans/class-plan-form.component';
import { ClassPlanExceptionDialogComponent } from './pages/class-plans/class-plan-exception-dialog.component';
import { AttendanceHistoryDialogComponent } from './shared/components/attendance-history-dialog/attendance-history-dialog.component';
import { ClassPlanTimetableComponent } from './pages/class-plans/class-plan-timetable.component';
import { ClassPlanTimetableCopyDialogComponent } from './pages/class-plans/class-plan-timetable-copy-dialog.component';
import { TimetableEntryFormDialogComponent } from './pages/class-plans/timetable-entry-form-dialog.component';
import { BulkDeleteConfirmDialogComponent } from './shared/components/bulk-delete-confirm-dialog/bulk-delete-confirm-dialog.component';
import { BulkDeleteProgressDialogComponent } from './shared/components/bulk-delete-progress-dialog/bulk-delete-progress-dialog.component';
import { ClassDeactivationDialogComponent } from './pages/management/class-deactivation-dialog/class-deactivation-dialog.component';
import { ClassTransferWizardDialogComponent } from './pages/management/class-transfer-wizard-dialog/class-transfer-wizard-dialog.component';
import { StudentTransferDialogComponent } from './pages/management/student-transfer-dialog/student-transfer-dialog.component';
import { PromoteDemoteDialogComponent } from './pages/management/promote-demote-dialog/promote-demote-dialog.component';
import { ReportFilterBuilderComponent } from './pages/reports/components/report-filter-builder.component';
import { ReportExportWizardComponent } from './pages/reports/components/report-export-wizard.component';
import { ReportChartViewComponent } from './pages/reports/components/report-chart-view.component';
import { AddCustomColumnDialogComponent } from './pages/reports/components/add-custom-column-dialog.component';
import { AddUserInputColumnDialogComponent } from './pages/reports/components/add-user-input-column-dialog.component';
import { SaveReportDialogComponent } from './pages/reports/components/save-report-dialog.component';
import { ResolveNamePipe } from './shared/pipes/resolve-name.pipe';
import { FeesPage } from './pages/fees/fees.page';
import { FeePlanFormDialogComponent } from './pages/fees/fee-plan-form-dialog.component';
import { FeePaymentDialogComponent } from './pages/fees/fee-payment-dialog.component';
import { FeeAssignStudentsDialogComponent } from './pages/fees/fee-assign-students-dialog.component';
import { FeePaymentHistoryDialogComponent } from './pages/fees/fee-payment-history-dialog.component';
import { UserSwapDialogComponent } from './pages/management/user-swap-dialog/user-swap-dialog.component';

@NgModule({
  declarations: [
    AppComponent,
    ActivityLogsPage,
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
    ReportExportOptionsDialogComponent,
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
    MadrasaDetailsDialogComponent,
    HelpGuideDialogComponent,
    SetupMapComponent,
    CourseDetailsDialogComponent,
    ClassDetailsDialogComponent,
    CsvReferenceIdsDialogComponent,
    ClassPlansPage,
    ClassPlanFormComponent,
    ClassPlanExceptionDialogComponent,
    AttendanceHistoryDialogComponent,
    ClassPlanTimetableComponent,
    ClassPlanTimetableCopyDialogComponent,
    TimetableEntryFormDialogComponent,
    BulkDeleteConfirmDialogComponent,
    BulkDeleteProgressDialogComponent,
    ClassDeactivationDialogComponent,
    ClassTransferWizardDialogComponent,
    StudentTransferDialogComponent,
    PromoteDemoteDialogComponent,
    ReportFilterBuilderComponent,
    ReportExportWizardComponent,
    ReportChartViewComponent,
    AddCustomColumnDialogComponent,
    AddUserInputColumnDialogComponent,
    SaveReportDialogComponent,
    ResolveNamePipe,
    FeesPage,
    FeePlanFormDialogComponent,
    FeePaymentDialogComponent,
    FeeAssignStudentsDialogComponent,
    FeePaymentHistoryDialogComponent,
    UserSwapDialogComponent,
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatCardModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTabsModule,
    MatChipsModule,
    MatIconModule
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
