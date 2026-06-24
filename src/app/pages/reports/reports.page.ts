import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { TableColumn } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface ReportConfig {
  key: string;
  label: string;
  collection: string;
  roles?: string[];
  emptyText: string;
  columns: TableColumn[];
}

interface ReportsVm {
  reports: Record<string, EntityRecord[]>;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage {
  readonly reportConfigs: ReportConfig[] = [
    { key: 'students', label: 'Student report', collection: 'users', roles: ['student'], emptyText: 'No students found for the selected filter.', columns: [
      { key: 'name', label: 'Student' }, { key: 'fatherName', label: 'Father' }, { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' }, { key: 'classId', label: 'Class', type: 'idRef', referenceType: 'class' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'attendance', label: 'Attendance report', collection: 'attendance', emptyText: 'No attendance records found for the selected filter.', columns: [
      { key: 'date', label: 'Date' }, { key: 'studentId', label: 'Student', type: 'idRef', referenceType: 'student' }, { key: 'classId', label: 'Class', type: 'idRef', referenceType: 'class' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'notes', label: 'Notes' },
    ] },
    { key: 'courses', label: 'Course report', collection: 'courses', emptyText: 'No courses found for the selected filter.', columns: [
      { key: 'name', label: 'Course' }, { key: 'code', label: 'Code' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'classes', label: 'Class report', collection: 'classes', emptyText: 'No classes found for the selected filter.', columns: [
      { key: 'name', label: 'Class' }, { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' }, { key: 'stageOrLevel', label: 'Stage / Level' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'subjects', label: 'Subject report', collection: 'subjects', emptyText: 'No subjects found for the selected filter.', columns: [
      { key: 'name', label: 'Subject' }, { key: 'code', label: 'Code' }, { key: 'courseId', label: 'Course', type: 'idRef', referenceType: 'course' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'staff', label: 'Staff report', collection: 'users', roles: ['teacher', 'staff'], emptyText: 'No staff found for the selected filter.', columns: [
      { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role', type: 'role' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'madrasas', label: 'Madrasa report', collection: 'madrasas', emptyText: 'No madrasas found for the selected filter.', columns: [
      { key: 'name', label: 'Madrasa' }, { key: 'code', label: 'Code' }, { key: 'organizationId', label: 'Organization', type: 'idRef', referenceType: 'organization' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'parents', label: 'Parent report', collection: 'users', roles: ['parent'], emptyText: 'No parents found for the selected filter.', columns: [
      { key: 'name', label: 'Parent' }, { key: 'email', label: 'Email' }, { key: 'linkedStudentIds', label: 'Students', type: 'idRef', referenceType: 'student' }, { key: 'status', label: 'Status', type: 'status' },
    ] },
    { key: 'promotionHistory', label: 'Promotion / demotion report', collection: 'promotionHistory', emptyText: 'No promotion or demotion records found.', columns: [
      { key: 'actionDate', label: 'Date' }, { key: 'studentId', label: 'Student', type: 'idRef', referenceType: 'student' }, { key: 'action', label: 'Action' }, { key: 'reason', label: 'Reason' },
    ] },
    { key: 'academicPlans', label: 'Hifz progress report', collection: 'academicPlans', emptyText: 'No Hifz progress plans found.', columns: [
      { key: 'studentId', label: 'Student', type: 'idRef', referenceType: 'student' }, { key: 'planType', label: 'Plan type' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'targetDate', label: 'Target date' },
    ] },
    { key: 'csvImports', label: 'CSV import result report', collection: 'csvImports', emptyText: 'No CSV import logs found.', columns: [
      { key: 'module', label: 'Module' }, { key: 'totalRows', label: 'Total' }, { key: 'validRows', label: 'Valid' }, { key: 'failedRows', label: 'Failed' },
    ] },
  ];

  readonly form = this.fb.nonNullable.group({
    report: ['students'],
    from: [''],
    to: [''],
  });

  readonly vm$ = this.auth.profile$.pipe(
    switchMap((profile) => combineLatest(
      this.reportConfigs.map((config) => this.repo.list<EntityRecord>(config.collection, profile, [], config.roles ? { roles: config.roles } : undefined).pipe(
        map((rows) => ({ key: config.key, rows })),
      )),
    )),
    map((parts): ReportsVm => ({
      reports: parts.reduce<Record<string, EntityRecord[]>>((acc, part) => {
        acc[part.key] = part.rows;
        return acc;
      }, {}),
    })),
    map((data): PageState<ReportsVm> => ({
      data,
      loading: false,
    })),
    startWith({ loading: true } as PageState<ReportsVm>),
    catchError((err) => {
      console.error(err);
      return of({
        loading: false,
        error: 'Something went wrong while loading this page. Please try again.',
      } as PageState<ReportsVm>);
    })
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
  ) {}

  activeConfig(): ReportConfig {
    return this.reportConfigs.find((config) => config.key === this.form.controls.report.value) ?? this.reportConfigs[0];
  }

  rows(vm: ReportsVm): EntityRecord[] {
    const config = this.activeConfig();
    const value = this.form.getRawValue();
    return (vm.reports[config.key] ?? []).filter((row) => {
      const rowDate = String(row['date'] || row['actionDate'] || '');
      return (!value.from || !rowDate || rowDate >= value.from) && (!value.to || !rowDate || rowDate <= value.to);
    });
  }
}
