import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReportExportOptionsDialogComponent } from './report-export-options-dialog.component';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { TableColumn } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { REPORT_DEFINITIONS } from './report-definitions';
import { ReportDefinition, FilterType, ReportCategory } from '../../core/models/report.model';
import * as xlsx from 'xlsx';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface ReportsVm {
  reports: Record<string, EntityRecord[]>;
  organization?: any;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage implements OnInit {
  readonly reportConfigs: ReportDefinition[] = REPORT_DEFINITIONS;

  readonly reportGroups = [
    { name: 'Student Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'student') },
    { name: 'Staff Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'staff') },
    { name: 'Madrasa Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'madrasa') },
    { name: 'Academic Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'academic') },
    { name: 'Attendance Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'attendance') },
    { name: 'Generic Count Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'count') },
    { name: 'Activity Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'activity') }
  ].filter(group => group.configs.length > 0);

  readonly customStudentFields = [
    { key: 'name', label: 'Student Name' },
    { key: 'fatherName', label: 'Father Name' },
    { key: 'parentName', label: 'Parent Name' },
    { key: 'email', label: 'Email' },
    { key: 'courseName', label: 'Course' },
    { key: 'className', label: 'Class' },
    { key: 'stageLevel', label: 'Stage / Level' },
    { key: 'admissionDate', label: 'Admission Date', type: 'date' },
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { key: 'status', label: 'Status' },
    { key: 'gender', label: 'Gender' },
    { key: 'madrasaId', label: 'Madrasa ID' },
    { key: 'courseId', label: 'Course ID' },
    { key: 'classId', label: 'Class ID' },
  ];

  readonly reportForm = this.fb.nonNullable.group({
    reportType: ['students'],
    periodMode: ['all'],
    month: [null as Date | null],
    dateFrom: [null as Date | null],
    dateTo: [null as Date | null],
    admissionDateFrom: [null as Date | null],
    admissionDateTo: [null as Date | null],
    madrasaIds: [[] as string[]],
    courseIds: [[] as string[]],
    classIds: [[] as string[]],
    stageLevels: [[] as string[]],
    status: [''],
    gender: [''],
    searchText: [''],
    customField: [''],
    customOperator: ['contains'],
    customValue: ['']
  });

  students: any[] = [];
  reportRows: any[] = [];
  madrasas: any[] = [];
  courses: any[] = [];
  classes: any[] = [];
  staffUsers: any[] = [];
  readonly defaultStageLevels = [
    'Miftah',
    'Tilawatul Quran',
    'Nadthira',
    'Hifz'
  ];
  readonly defaultStagesByCourseType: Record<string, string[]> = {
    maktab: ['Miftah', 'Tilawatul Quran', 'Nadthira', 'Hifz'],
    hifz: ['Hifz']
  };

  readonly customOperators = [
    { value: 'equals', label: 'equals' },
    { value: 'contains', label: 'contains' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
    { value: 'dateBefore', label: 'date before' },
    { value: 'dateAfter', label: 'date after' },
  ];

  private studentMap = new Map<string, any>();
  private staffMap = new Map<string, any>();
  private parentMap = new Map<string, any>();
  private userMap = new Map<string, any>();
  private courseMap = new Map<string, any>();
  private classMap = new Map<string, any>();
  private madrasaMap = new Map<string, string>();

  readonly vm$ = this.auth.profile$.pipe(
    switchMap((profile) => {
      const reports$ = combineLatest(
        this.reportConfigs.map((config) => this.repo.list<EntityRecord>(config.collection, profile, [], config.roles ? { roles: config.roles } : undefined).pipe(
          map((rows) => ({ id: config.id, rows })),
        ))
      );

      const students$ = this.repo.list<EntityRecord>('users', profile, [], { roles: ['student'] }).pipe(catchError(() => of([])));
      const staff$ = this.repo.list<EntityRecord>('users', profile, [], { roles: ['teacher', 'staff'] }).pipe(catchError(() => of([])));
      const parents$ = this.repo.list<EntityRecord>('users', profile, [], { roles: ['parent'] }).pipe(catchError(() => of([])));
      const courses$ = this.repo.list<EntityRecord>('courses', profile).pipe(catchError(() => of([])));
      const classes$ = this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([])));
      const madrasas$ = this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([])));
      const organization$ = profile?.organizationId ? this.repo.list<any>('organizations', profile).pipe(
        map(orgs => orgs.find((o: any) => o.id === profile.organizationId) || null),
        catchError(() => of(null))
      ) : of(null);

      return combineLatest({
        reportParts: reports$,
        students: students$,
        staff: staff$,
        parents: parents$,
        courses: courses$,
        classes: classes$,
        madrasas: madrasas$,
        organization: organization$
      });
    }),
    map(({reportParts, students, staff, parents, courses, classes, madrasas, organization}) => {
      
      this.studentMap = this.buildUserMap(students || []);
      this.staffMap = this.buildUserMap(staff || []);
      this.parentMap = this.buildUserMap(parents || []);
      this.userMap = this.buildUserMap([...(students || []), ...(staff || []), ...(parents || [])]);
      this.courseMap = new Map((courses || []).map((c: any) => [c.id as string, c['name'] || c['title'] || c['courseName'] || c.id]));
      this.classMap = new Map((classes || []).map((c: any) => [c.id as string, c['name'] || c['title'] || c['className'] || c.id]));
      this.students = students || [];
      this.courses = courses || [];
      this.classes = classes || [];
      this.madrasas = madrasas || [];
      this.staffUsers = staff || [];
      this.buildMadrasaMap();

      console.log('[Reports Madrasa Map Debug]', {
        madrasasCount: this.madrasas?.length || 0,
        madrasaMap: Array.from(this.madrasaMap.entries()),
      });

      console.log('[Reports Class Staff Source Debug]', {
        staffCount: this.staffUsers?.length || 0,
        staffUsers: (this.staffUsers || []).map((user: any) => ({
          id: user.id || user.uid,
          name: user.name || user.displayName,
          role: user.role,
          teachingClassIds: user.teachingClassIds,
          classIds: user.classIds,
          classId: user.classId,
          assignedClassIds: user.assignedClassIds,
          assignedClassId: user.assignedClassId,
        })),
      });

      const enrichedReports = reportParts.reduce((acc: Record<string, EntityRecord[]>, part: any) => {
        let rows = part.rows;
        const config = this.reportConfigs.find(c => c.id === part.id);
        if (config && config.roles && config.roles.length > 0) {
           rows = rows.filter((r: any) => config.roles!.includes(r.role));
        }

        acc[part.id] = rows.map((row: any) => this.mapStudentReportRow(row));
        return acc;
      }, {});

      setTimeout(() => {
        this.applyFilters();
      });

      return { reports: enrichedReports, organization };
    }),
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
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.reportForm.get('madrasaIds')?.valueChanges.subscribe(() => {
      this.cleanInvalidCourseAndClassSelections();
    });

    this.reportForm.get('courseIds')?.valueChanges.subscribe(() => {
      this.cleanInvalidStageSelections();
      this.cleanInvalidClassSelections();
    });
  }

  getSelectedNames(ids: string[], items: any[], fallback = 'All'): string {
    if (!Array.isArray(ids) || !ids.length) return fallback;

    const names = ids
      .map(id => {
        const item = (items || []).find(entry => entry.id === id);
        return item?.name || item?.title || item?.displayName || item?.courseName || item?.className || id;
      })
      .filter(Boolean);

    if (!names.length) return fallback;
    if (names.length <= 2) return names.join(', ');
    return `${names.length} selected`;
  }

  getFilteredCourses(): any[] {
    const selectedMadrasaIds = this.reportForm.get('madrasaIds')?.value || [];

    if (!selectedMadrasaIds.length) {
      return this.courses || [];
    }

    return (this.courses || []).filter((course: any) =>
      selectedMadrasaIds.includes(course.madrasaId)
    );
  }

  getFilteredClasses(): any[] {
    const selectedMadrasaIds = this.reportForm.get('madrasaIds')?.value || [];
    const selectedCourseIds = this.reportForm.get('courseIds')?.value || [];

    return (this.classes || []).filter((classItem: any) => {
      const matchesMadrasa = selectedMadrasaIds.length
        ? selectedMadrasaIds.includes(classItem.madrasaId)
        : true;

      const matchesCourse = selectedCourseIds.length
        ? selectedCourseIds.includes(classItem.courseId)
        : true;

      return matchesMadrasa && matchesCourse;
    });
  }

  private cleanInvalidCourseAndClassSelections(): void {
    const validCourseIds = new Set(this.getFilteredCourses().map((course: any) => course.id));
    const selectedCourseIds = this.reportForm.get('courseIds')?.value || [];

    const cleanedCourseIds = selectedCourseIds.filter((id: string) => validCourseIds.has(id));

    if (cleanedCourseIds.length !== selectedCourseIds.length) {
      this.reportForm.patchValue({ courseIds: cleanedCourseIds }, { emitEvent: false });
    }

    this.cleanInvalidClassSelections();
  }

  private cleanInvalidClassSelections(): void {
    const validClassIds = new Set(this.getFilteredClasses().map((classItem: any) => classItem.id));
    const selectedClassIds = this.reportForm.get('classIds')?.value || [];

    const cleanedClassIds = selectedClassIds.filter((id: string) => validClassIds.has(id));

    if (cleanedClassIds.length !== selectedClassIds.length) {
      this.reportForm.patchValue({ classIds: cleanedClassIds }, { emitEvent: false });
    }
  }

  private normalizeListValue(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  private normalizeCourseType(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private getCourseStageOptions(course: any): string[] {
    const savedStages = this.normalizeListValue(course?.stages);

    if (savedStages.length) {
      return savedStages;
    }

    const courseType = this.normalizeCourseType(course?.courseType || course?.type);

    return this.defaultStagesByCourseType[courseType] || [];
  }

  getStageLevelOptions(): string[] {
    const selectedCourseIds = this.reportForm.get('courseIds')?.value || [];

    if (selectedCourseIds.length) {
      const selectedCourses = (this.courses || []).filter((course: any) =>
        selectedCourseIds.includes(course.id)
      );

      const selectedCourseStages = selectedCourses
        .map((course: any) => this.getCourseStageOptions(course))
        .reduce((acc: string[], val: string[]) => acc.concat(val), []);

      return Array.from(new Set<string>(selectedCourseStages)).filter(Boolean);
    }

    const allCourseStages = (this.courses || [])
      .map((course: any) => this.getCourseStageOptions(course))
      .reduce((acc: string[], val: string[]) => acc.concat(val), []);

    const studentStages = (this.students || [])
      .map((student: any) => this.getStudentStageLevel(student))
      .filter((value: string) => value && value !== '-');

    return Array.from(new Set<string>([
      ...allCourseStages,
      ...studentStages
    ])).filter(Boolean);
  }

  private cleanInvalidStageSelections(): void {
    const validStages = new Set(
      this.getStageLevelOptions().map(stage => this.normalizeText(stage))
    );

    const selectedStages = this.reportForm.get('stageLevels')?.value || [];

    const cleanedStages = selectedStages.filter((stage: string) =>
      validStages.has(this.normalizeText(stage))
    );

    if (cleanedStages.length !== selectedStages.length) {
      this.reportForm.patchValue(
        { stageLevels: cleanedStages },
        { emitEvent: false }
      );
    }

    console.log('[Report Stage Options By Course Debug]', {
      selectedCourseIds: this.reportForm.get('courseIds')?.value || [],
      availableStages: this.getStageLevelOptions(),
      previousSelectedStages: selectedStages,
      cleanedStages
    });
  }

  getSelectedStageLevelNames(): string {
    const selected = this.reportForm.get('stageLevels')?.value || [];

    if (!selected.length) {
      return 'All Stages / Levels';
    }

    if (selected.length <= 2) {
      return selected.join(', ');
    }

    return `${selected.length} selected`;
  }

  activeConfig(): ReportDefinition {
    return this.reportConfigs.find((config) => config.id === this.reportForm.controls.reportType.value) ?? this.reportConfigs[0];
  }

  mapStudentReportRow(row: any) {
    const madrasaNames = Array.isArray(row.madrasaIds) && row.madrasaIds.length
      ? row.madrasaIds.map((id: string) => this.getMadrasaName(id)).join(', ')
      : this.getMadrasaName(row.madrasaId);

    console.log('[Student Report Row Mapping Debug]', {
      studentId: row.id || row.uid,
      studentName: row.name || row.displayName,
      rawMadrasaId: row.madrasaId,
      rawMadrasaIds: row.madrasaIds,
      displayedMadrasa: madrasaNames,
      classId: row.classId,
      className: row.className,
      classStaff: this.getClassStaffNamesByClassId(row.classId),
    });

    return {
      ...row,
      studentNameDisplay: this.getStudentName(row),
      fatherNameDisplay: this.getFatherName(row),
      parentNameDisplay: this.getParentName(row),
      madrasaNameDisplay: madrasaNames || '-',
      courseNameDisplay: this.getCourseName(row),
      classNameDisplay: this.getClassName(row),
      stageLevelDisplay: this.getStageLevel(row),
      classStaffDisplay: this.getClassStaffNamesByClassId(row.classId),
      staffNameDisplay: this.getStaffName(row),
      studentEmailDisplay: this.getStudentEmail(row),
      studentNamesDisplay: this.getLinkedStudentNames(row),
    };
  }

  rows(vm: ReportsVm): EntityRecord[] {
    const config = this.activeConfig();
    
    // For standard lists (e.g. students), apply the rich filtering.
    let currentRows: any[] = [];
    if (config.category === 'student') {
      currentRows = this.reportRows;
    } else {
      const value = this.reportForm.getRawValue();
      let fromStr = '';
      let toStr = '';

      const format = (d: any) => {
        if (!d) return '';
        if (d instanceof Date) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return String(d);
      };

      if (value.periodMode === 'monthly' && value.month) {
        const range = this.getMonthlyRange(value.month);
        if (range) {
          fromStr = format(range.start);
          toStr = format(range.end);
        }
      } else if (value.periodMode === 'custom') {
        fromStr = format(value.dateFrom);
        toStr = format(value.dateTo);
      }

      currentRows = (vm.reports[config.id] ?? []).filter((row) => {
        const rowDate = String(row['date'] || row['actionDate'] || '');
        return (!fromStr || !rowDate || rowDate >= fromStr) && (!toStr || !rowDate || rowDate <= toStr);
      });
    }

    if (config.aggregationLogic === 'count-by-field' && config.groupByField) {
      const groupCounts: Record<string, number> = {};
      currentRows.forEach(row => {
        let val = row[config.groupByField!] || 'Unknown';
        
        // Handle mapping raw IDs to human-readable names if necessary
        if (config.groupByField === 'madrasaId') val = this.getMadrasaName(val);
        else if (config.groupByField === 'courseId') val = this.getCourseName({ courseId: val });
        else if (config.groupByField === 'classId') val = this.getClassName({ classId: val });
        else if (config.groupByField === 'role') val = String(val).charAt(0).toUpperCase() + String(val).slice(1);
        
        groupCounts[val] = (groupCounts[val] || 0) + 1;
      });

      return Object.keys(groupCounts).map(group => ({
        groupLabel: group,
        count: groupCounts[group]
      }));
    }

    return currentRows;
  }

  applyFilters(): void {
    const filters = this.reportForm.value;

    console.log('[Reports Filter Debug]', {
      reportType: filters.reportType,
      periodMode: filters.periodMode,
      month: filters.month,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      admissionDateFrom: filters.admissionDateFrom,
      admissionDateTo: filters.admissionDateTo,
      madrasaIds: filters.madrasaIds,
      courseIds: filters.courseIds,
      classIds: filters.classIds,
      stageLevels: filters.stageLevels,
      status: filters.status,
      gender: filters.gender,
      searchText: filters.searchText,
      customField: filters.customField,
      customOperator: filters.customOperator,
      customValue: filters.customValue,
    });

    console.log('[Report Name Filter Selection Debug]', {
      selectedMadrasaIds: this.reportForm.value.madrasaIds,
      selectedMadrasaNames: this.getSelectedNames(this.reportForm.value.madrasaIds || [], this.madrasas),
      selectedCourseIds: this.reportForm.value.courseIds,
      selectedCourseNames: this.getSelectedNames(this.reportForm.value.courseIds || [], this.courses),
      selectedClassIds: this.reportForm.value.classIds,
      selectedClassNames: this.getSelectedNames(this.reportForm.value.classIds || [], this.classes),
    });

    let rows = [...(this.students || [])];

    let globalAdmissionFrom = filters.admissionDateFrom ?? null;
    let globalAdmissionTo = filters.admissionDateTo ?? null;

    if (filters.periodMode === 'monthly' && filters.month && !globalAdmissionFrom && !globalAdmissionTo) {
      const range = this.getMonthlyRange(filters.month);
      if (range) {
        globalAdmissionFrom = range.start;
        globalAdmissionTo = range.end;
      }
    } else if (filters.periodMode === 'custom' && (filters.dateFrom || filters.dateTo) && !globalAdmissionFrom && !globalAdmissionTo) {
      globalAdmissionFrom = filters.dateFrom ?? null;
      globalAdmissionTo = filters.dateTo ?? null;
    }

    rows = rows.filter(student => {
      const selectedMadrasaIds = filters.madrasaIds || [];
      const selectedCourseIds = filters.courseIds || [];
      const selectedClassIds = filters.classIds || [];

      const matchesMadrasa = selectedMadrasaIds.length
        ? selectedMadrasaIds.includes(student.madrasaId) ||
          (student.madrasaIds || []).some((id: string) => selectedMadrasaIds.includes(id))
        : true;

      const matchesCourse = selectedCourseIds.length
        ? selectedCourseIds.includes(student.courseId) ||
          (student.courseIds || []).some((id: string) => selectedCourseIds.includes(id)) ||
          selectedCourseIds.includes(student.courseName)
        : true;

      const matchesClass = selectedClassIds.length
        ? selectedClassIds.includes(student.classId) ||
          (student.classIds || []).some((id: string) => selectedClassIds.includes(id)) ||
          selectedClassIds.includes(student.className)
        : true;

      const selectedStageLevels = filters.stageLevels || [];

      const matchesStage = selectedStageLevels.length
        ? selectedStageLevels
            .map((value: string) => this.normalizeText(value))
            .includes(this.normalizeText(this.getStudentStageLevel(student)))
        : true;

      const matchesStatus = filters.status
        ? this.normalizeText(student.status) === this.normalizeText(filters.status)
        : true;

      const matchesGender = filters.gender
        ? this.normalizeText(student.gender) === this.normalizeText(filters.gender)
        : true;

      const matchesAdmissionDate = this.isDateInRange(
        student.admissionDate,
        globalAdmissionFrom,
        globalAdmissionTo
      );

      const matchesSearch = this.matchesStudentSearch(student, filters.searchText || '');
      const matchesCustom = this.applyCustomFilter(student);

      return matchesMadrasa &&
        matchesCourse &&
        matchesClass &&
        matchesStage &&
        matchesStatus &&
        matchesGender &&
        matchesAdmissionDate &&
        matchesSearch &&
        matchesCustom;
    });

    this.reportRows = rows.map(student => this.mapStudentReportRow(student));

    console.log('[Student Report Filter Result Debug]', {
      totalStudents: this.students.length,
      filteredCount: this.reportRows.length,
      filters,
    });

    console.log('[Report Stage Level Filter Debug]', {
      selectedStageLevels: this.reportForm.value.stageLevels,
      availableStageLevels: this.getStageLevelOptions(),
      filteredCount: this.reportRows?.length || 0,
    });
  }

  resetFilters(): void {
    this.reportForm.patchValue({
      periodMode: 'all',
      month: null,
      dateFrom: null,
      dateTo: null,
      admissionDateFrom: null,
      admissionDateTo: null,
      madrasaIds: [],
      courseIds: [],
      classIds: [],
      stageLevels: [],
      status: '',
      gender: '',
      searchText: '',
      customField: '',
      customOperator: 'contains',
      customValue: ''
    });

    this.applyFilters();
  }

  openExportOptions(vm: ReportsVm): void {
    if (!this.reportRows?.length) {
      this.snackBar.open('No records available to export.', 'Close', {
        duration: 3000
      });
      return;
    }

    const dialogRef = this.dialog.open(ReportExportOptionsDialogComponent, {
      width: '420px',
      maxWidth: '90vw',
      data: {
        reportType: this.reportForm.value.reportType,
        totalRows: this.reportRows.length
      }
    });

    dialogRef.afterClosed().subscribe((format: 'pdf' | 'csv' | 'excel' | null) => {
      if (!format) return;
      this.exportReport(format, vm);
    });
  }

  exportReport(format: 'pdf' | 'csv' | 'excel', vm: ReportsVm): void {
    console.log('[Report Export Format Debug]', {
      format,
      reportType: this.reportForm.value.reportType,
      totalRows: this.reportRows.length,
    });

    if (format === 'pdf') {
      this.exportPdf(vm);
      return;
    }

    if (format === 'csv') {
      this.exportCsv(vm);
      return;
    }

    if (format === 'excel') {
      this.exportExcel(vm);
      return;
    }
  }

  async getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      return null;
    }
  }

  async exportPdf(vm: ReportsVm): Promise<void> {
    const config = this.activeConfig();
    const currentRows = this.rows(vm);

    if (!currentRows || currentRows.length === 0) {
      this.snackBar.open('No records available to export.', 'Close', { duration: 3000 });
      return;
    }

    const headers = config.columns.map(c => c.label);
    const keys = config.columns.map(c => c.key);

    const data = currentRows.map(row => {
      return keys.map(key => {
        let val = row[key];
        
        if (val && typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
          val = (val as any).toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        
        if (val === null || val === undefined) {
          val = '';
        }

        return String(val);
      });
    });

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF('landscape');
      
      const orgName = vm.organization?.name || 'DeenDesk';
      const reportTitle = `${config.name} - ${new Date().toISOString().split('T')[0]}`;
      
      let startY = 25;
      
      if (vm.organization?.logoUrl || vm.organization?.logo) {
        const logoUrl = vm.organization.logoUrl || vm.organization.logo;
        const base64 = await this.getBase64ImageFromUrl(logoUrl);
        if (base64) {
          doc.addImage(base64, 'PNG', 14, 10, 15, 15);
          doc.setFontSize(18);
          doc.text(orgName, 32, 17);
          doc.setFontSize(12);
          doc.text(reportTitle, 32, 23);
          startY = 35;
        } else {
          doc.setFontSize(18);
          doc.text(orgName, 14, 15);
          doc.setFontSize(14);
          doc.text(reportTitle, 14, 22);
        }
      } else {
        doc.setFontSize(18);
        doc.text(orgName, 14, 15);
        doc.setFontSize(14);
        doc.text(reportTitle, 14, 22);
      }

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [63, 81, 181] },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      });

      doc.save(`${config.id}_report_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      this.snackBar.open('Error generating PDF. See console.', 'Close', { duration: 3000 });
    }
  }

  exportExcel(vm: ReportsVm): void {
    const config = this.activeConfig();
    const currentRows = this.rows(vm);

    if (!currentRows || currentRows.length === 0) {
      return;
    }

    const headers = config.columns.map(c => c.label);
    const keys = config.columns.map(c => c.key);

    const data = currentRows.map(row => {
      return keys.map(key => {
        let val = row[key];
        
        if (val && typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
          val = (val as any).toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        
        return val === null || val === undefined ? '' : String(val);
      });
    });

    const wsData = [
      [vm.organization?.name || 'DeenDesk'],
      [`${config.name} - ${new Date().toISOString().split('T')[0]}`],
      [], // blank row
      headers,
      ...data
    ];

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Report');
    
    xlsx.writeFile(wb, `${config.id}_report_${new Date().getTime()}.xlsx`);
  }

  exportCsv(vm: ReportsVm): void {
    const config = this.activeConfig();
    const currentRows = this.rows(vm);

    if (!currentRows || currentRows.length === 0) {
      return;
    }

    const headers = config.columns.map(c => c.label);
    const keys = config.columns.map(c => c.key);

    let csv = headers.join(',') + '\n';
    
    currentRows.forEach(row => {
      const rowData = keys.map(key => {
        let val = row[key];
        
        // Handle dates
        if (val && typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
          val = (val as any).toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        
        // Handle null/undefined
        if (val === null || val === undefined) {
          val = '';
        }
        
        // Escape quotes
        let strVal = String(val).replace(/"/g, '""');
        // Wrap in quotes if contains comma
        if (strVal.includes(',')) {
          strVal = `"${strVal}"`;
        }
        return strVal;
      });
      csv += rowData.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${config.name.replace(/\s+/g, '_').toLowerCase()}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private getMonthlyRange(monthValue: any): { start: Date; end: Date } | null {
    if (!monthValue) return null;

    const date = monthValue instanceof Date ? monthValue : new Date(monthValue);
    if (isNaN(date.getTime())) return null;

    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end };
  }

  private toDateValue(value: any): Date | null {
    if (!value) return null;

    if (value?.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }

    if (value?.seconds) {
      return new Date(value.seconds * 1000);
    }

    if (value instanceof Date) {
      return value;
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private isDateInRange(value: any, from: Date | null, to: Date | null): boolean {
    const date = this.toDateValue(value);

    if (!date) {
      return !from && !to;
    }

    if (from && date < this.startOfDay(from)) return false;
    if (to && date > this.endOfDay(to)) return false;

    return true;
  }

  private normalizeText(value: any): string {
    return String(value || '').toLowerCase().trim();
  }

  private getStudentStageLevel(student: any): string {
    return student?.stageLevel ||
      student?.stage ||
      student?.level ||
      student?.stageName ||
      student?.levelName ||
      student?.currentStage ||
      student?.currentLevel ||
      '';
  }

  private getStudentFieldValue(student: any, fieldKey: string): any {
    switch (fieldKey) {
      case 'name':
        return student.name || student.displayName || '';
      case 'fatherName':
        return student.fatherName || '';
      case 'parentName':
        return student.parentDisplayName || student.parentName || '';
      case 'email':
        return student.email || '';
      case 'courseName':
        return student.courseName || this.courseMap.get(student.courseId) || '';
      case 'className':
        return student.className || this.classMap.get(student.classId) || '';
      case 'stageLevel':
        return this.getStudentStageLevel(student);
      case 'admissionDate':
        return student.admissionDate;
      case 'dateOfBirth':
        return student.dateOfBirth || student.dob;
      case 'status':
        return student.status || '';
      case 'gender':
        return student.gender || '';
      case 'madrasaId':
        return student.madrasaId || '';
      case 'courseId':
        return student.courseId || '';
      case 'classId':
        return student.classId || '';
      default:
        return student?.[fieldKey] || '';
    }
  }

  private matchesStudentSearch(student: any, searchText: string): boolean {
    const search = this.normalizeText(searchText);
    if (!search) return true;

    const searchableText = [
      student.name,
      student.displayName,
      student.fatherName,
      student.parentDisplayName,
      student.parentName,
      student.email,
      student.courseName,
      student.className,
      this.getStudentStageLevel(student)
    ].map(value => this.normalizeText(value)).join(' ');

    return searchableText.includes(search);
  }

  private applyCustomFilter(student: any): boolean {
    const fieldKey = this.reportForm.value.customField;
    const operator = this.reportForm.value.customOperator;
    const value = this.reportForm.value.customValue;

    if (!fieldKey || !operator) return true;

    const rawFieldValue = this.getStudentFieldValue(student, fieldKey);

    if (operator === 'isEmpty') {
      return rawFieldValue === null || rawFieldValue === undefined || String(rawFieldValue).trim() === '';
    }

    if (operator === 'isNotEmpty') {
      return rawFieldValue !== null && rawFieldValue !== undefined && String(rawFieldValue).trim() !== '';
    }

    if (operator.startsWith('date')) {
      const fieldDate = this.toDateValue(rawFieldValue);
      const compareDate = this.toDateValue(value);

      if (!fieldDate || !compareDate) return false;

      if (operator === 'dateBefore') return fieldDate < compareDate;
      if (operator === 'dateAfter') return fieldDate > compareDate;
    }

    const fieldText = String(rawFieldValue || '').toLowerCase().trim();
    const compareText = String(value || '').toLowerCase().trim();

    if (!compareText && !['isEmpty', 'isNotEmpty'].includes(operator)) return true;

    switch (operator) {
      case 'equals':
        return fieldText === compareText;
      case 'contains':
        return fieldText.includes(compareText);
      case 'startsWith':
        return fieldText.startsWith(compareText);
      case 'endsWith':
        return fieldText.endsWith(compareText);
      default:
        return true;
    }
  }

  private buildUserMap(users: any[]): Map<string, any> {
    const map = new Map<string, any>();
    for (const user of users || []) {
      const ids = [user?.id, user?.uid, user?.userId, user?.authUid].filter(Boolean);
      for (const id of ids) {
        if (!map.has(id)) {
          map.set(id, user);
        }
      }
    }
    return map;
  }

  private buildMadrasaMap(): void {
    this.madrasaMap = new Map(
      (this.madrasas || []).map((madrasa: any) => [
        madrasa.id,
        madrasa.name || madrasa.title || madrasa.displayName || madrasa.id
      ])
    );
  }

  getMadrasaName(value: any): string {
    if (!value) return '-';

    if (typeof value === 'string') {
      return this.madrasaMap.get(value) || value || '-';
    }

    return value?.name || value?.title || value?.displayName || '-';
  }

  private normalizeRole(role: any): string {
    return String(role || '').trim().toLowerCase();
  }

  private isStaffUser(user: any): boolean {
    const role = this.normalizeRole(user?.role);
    return role === 'teacher' || role === 'staff';
  }

  private getUserDisplayName(user: any): string {
    return user?.name ||
      user?.displayName ||
      user?.fullName ||
      user?.email ||
      '-';
  }

  private userHasClassAssignment(user: any, classId: string): boolean {
    if (!user || !classId) return false;

    const singleClassIds = [
      user.classId,
      user.assignedClassId,
      user.currentClassId
    ].filter(Boolean);

    const arrayClassIds = [
      ...(Array.isArray(user.teachingClassIds) ? user.teachingClassIds : []),
      ...(Array.isArray(user.classIds) ? user.classIds : []),
      ...(Array.isArray(user.assignedClassIds) ? user.assignedClassIds : []),
      ...(Array.isArray(user.currentClassIds) ? user.currentClassIds : [])
    ];

    return singleClassIds.includes(classId) || arrayClassIds.includes(classId);
  }

  getClassStaffNamesByClassId(classId: string): string {
    if (!classId) return '-';

    const assignedStaff = (this.staffUsers || [])
      .filter((user: any) => this.isStaffUser(user))
      .filter((user: any) => this.userHasClassAssignment(user, classId));

    const names = assignedStaff
      .map((user: any) => this.getUserDisplayName(user))
      .filter(Boolean);

    return names.length ? Array.from(new Set(names)).join(', ') : '-';
  }

  private getStudentIdFromRecord(record: any): string {
    return record?.studentId || record?.studentUid || record?.studentUserId || record?.uid || record?.userId || record?.childId || record?.linkedStudentId || '';
  }

  private getStudentName(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const user = this.studentMap.get(studentId);
    return record?.studentName || record?.name || record?.displayName || user?.name || user?.displayName || user?.fullName || '-';
  }

  private getFatherName(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const user = this.studentMap.get(studentId);
    return record?.fatherName || user?.fatherName || user?.parentName || '-';
  }

  private getParentName(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const student = this.studentMap.get(studentId);
    const parentId = record?.parentId || record?.parentUid || student?.parentId || student?.parentUid;
    const parent = this.parentMap.get(parentId);
    return record?.parentName || student?.parentDisplayName || student?.parentName || parent?.name || parent?.displayName || '-';
  }

  private getCourseName(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const user = this.studentMap.get(studentId);
    return record?.courseName || user?.courseName || this.courseMap.get(record?.courseId || user?.courseId) || '-';
  }

  private getClassName(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const user = this.studentMap.get(studentId);
    return record?.className || user?.className || this.classMap.get(record?.classId || user?.classId) || '-';
  }

  private getStageLevel(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const user = this.studentMap.get(studentId);
    return record?.stageLevel || record?.stage || record?.level || user?.stageLevel || user?.stage || user?.level || user?.stageName || user?.levelName || '-';
  }

  private getStaffName(record: any): string {
    const staffId = record?.teacherId || record?.staffId || record?.createdBy || record?.updatedBy || record?.takenByUid || record?.markedByUid;
    const user = this.staffMap.get(staffId) || this.userMap.get(staffId);
    return record?.teacherName || record?.staffName || record?.createdByName || user?.name || user?.displayName || '-';
  }

  private getStudentEmail(record: any): string {
    const studentId = this.getStudentIdFromRecord(record);
    const user = this.studentMap.get(studentId);
    return record?.email || record?.studentEmail || user?.email || '-';
  }

  private getLinkedStudentNames(record: any): string {
    const ids = Array.isArray(record?.linkedStudentIds) ? record.linkedStudentIds : [];
    if (!ids.length) return '-';
    return ids.map((id: string) => this.getStudentName({ studentId: id })).join(', ');
  }
}
