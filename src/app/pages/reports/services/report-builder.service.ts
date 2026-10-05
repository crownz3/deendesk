import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { RepositoryService, EntityRecord } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { AttendanceFirestoreService } from '../../../core/services/attendance-firestore.service';
import { IssueService } from '../../../core/services/issue.service';
import { ReportDefinition, ReportFieldMetadata, SavedReportTemplate } from '../../../core/models/report.model';
import { REPORT_DEFINITIONS } from '../report-definitions';

export interface ReportState {
  activeReportId: string | null;
  baseDefinition: ReportDefinition | null;
  columns: ReportFieldMetadata[];
  filters: any;
  sorting: { key: string, direction: 'asc' | 'desc' }[];
  grouping: string[];
  aggregations: any;
  data: any[];
  savedReports: SavedReportTemplate[];
  loading: boolean;
  error: string | null;
  unassignedCount?: number;
  references: {
    organizations: Map<string, any>;
    madrasas: Map<string, any>;
    courses: Map<string, any>;
    classes: Map<string, any>;
    users: Map<string, any>;
    studentsDocs?: any[];
    classGroups?: any[];
    staffDocs?: any[];
    // Attendance aggregation: studentId → { lateCount, leaveCount, absentCount, presentCount, totalDays }
    attendanceSummary?: Map<string, { lateCount: number; leaveCount: number; absentCount: number; presentCount: number; totalDays: number }>;
    // Issue categories: categoryId → category object
    issueCategories?: Map<string, any>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ReportBuilderService {
  private state = new BehaviorSubject<ReportState>({
    activeReportId: null,
    baseDefinition: null,
    columns: [],
    filters: {},
    sorting: [],
    grouping: [],
    aggregations: {},
    data: [],
    savedReports: [],
    loading: false,
    error: null,
    unassignedCount: 0,
    references: {
      organizations: new Map(),
      madrasas: new Map(),
      courses: new Map(),
      classes: new Map(),
      users: new Map(),
      studentsDocs: [],
      classGroups: [],
      staffDocs: [],
      attendanceSummary: new Map(),
      issueCategories: new Map()
    }
  });
  private cachedRawData: any[] | null = null;

  public state$ = this.state.asObservable();

  constructor(
    private repo: RepositoryService,
    private auth: AuthService,
    private attendanceFs: AttendanceFirestoreService,
    private issueService: IssueService
  ) {}

  public loadReportDefinition(reportId: string): void {
    const definition = REPORT_DEFINITIONS.find((r: ReportDefinition) => r.id === reportId);
    if (!definition) {
      this.updateState({ error: 'Report not found' });
      return;
    }

    this.updateState({
      activeReportId: reportId,
      baseDefinition: definition,
      columns: [...definition.columns],
      filters: definition.defaultFilters || {},
      sorting: definition.defaultSort || [],
      grouping: definition.defaultGroup || [],
      error: null
    });

    this.fetchData(definition);
  }

  public async loadSavedTemplate(templateId: string): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const templates = await this.repo.getAllOnce<SavedReportTemplate & EntityRecord>('savedReports', profile);
      const template = templates.find(t => t.id === templateId);
      
      if (template) {
        const baseDef = REPORT_DEFINITIONS.find((r: ReportDefinition) => r.id === template.baseReportId);
        if (baseDef) {
          this.updateState({
            activeReportId: template.baseReportId,
            baseDefinition: baseDef,
            columns: template.columns,
            filters: template.filters,
            sorting: template.sorting,
            grouping: template.grouping,
            aggregations: template.aggregations
          });
          this.fetchData(baseDef, template.filters);
        }
      }
    } catch (e) {
      console.error('Error loading saved template', e);
      this.updateState({ error: 'Failed to load saved report template' });
    }
  }

  public async saveTemplate(template: Partial<SavedReportTemplate>): Promise<string | null> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      if (!profile) return null;

      if (template.id) {
        await this.repo.update('savedReports', template.id, template as any, profile);
        this.updateState({ savedReports: this.state.value.savedReports.map((t: SavedReportTemplate) => t.id === template.id ? (template as SavedReportTemplate) : t) });
        return template.id;
      } else {
        const result = await this.repo.create('savedReports', {
          ...template,
          organizationId: profile.organizationId,
          createdBy: profile.uid,
          isPublic: false
        } as any, profile);
        return result;
      }
    } catch (e) {
      console.error('Error saving template', e);
      return null;
    }
  }

  public updateColumns(columns: ReportFieldMetadata[]): void {
    this.updateState({ columns });
  }

  public updateFilters(filters: any): void {
    this.updateState({ filters, loading: true });
    // Re-process from cached raw data — no Firestore refetch needed
    if (this.cachedRawData !== null) {
      // Use setTimeout to allow the loading indicator to render before heavy computation
      setTimeout(() => this.processData(this.cachedRawData!), 0);
    } else {
      const currentDef = this.state.value.baseDefinition;
      if (currentDef) {
        this.fetchData(currentDef, filters);
      }
    }
  }

  public updateSorting(sorting: { key: string, direction: 'asc' | 'desc' }[]): void {
    this.updateState({ sorting });
  }

  public updateGrouping(grouping: string[]): void {
    this.updateState({ grouping });
  }

  private async fetchData(definition: ReportDefinition, filters: any = {}): Promise<void> {
    this.updateState({ loading: true });
    
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      if (!profile) return;
      
      // Fetch references for display names
      const [organizations, madrasas, courses, classes, users, studentsDocs, classGroups, staffDocs] = await Promise.all([
        this.repo.getAllOnce<any>('organizations', profile).catch(() => []),
        this.repo.getAllOnce<any>('madrasas', profile).catch(() => []),
        this.repo.getAllOnce<any>('courses', profile).catch(() => []),
        this.repo.getAllOnce<any>('classes', profile).catch(() => []),
        this.repo.getAllOnce<any>('users', profile).catch(() => []),
        this.repo.getAllOnce<any>('students', profile).catch(() => []),
        this.repo.getAllOnce<any>('classGroups', profile).catch(() => []),
        this.repo.getAllOnce<any>('staff', profile).catch(() => [])
      ]);

      // --- Attendance Aggregation for Reports 9 & 10 ---
      let attendanceSummary = new Map<string, { lateCount: number; leaveCount: number; absentCount: number; presentCount: number; totalDays: number }>();
      const isAttendanceReport = (
        definition.id === 'habitual-latecomers-monthly-report' ||
        definition.id === 'attendance-risk-alert-report'
      );
      if (isAttendanceReport) {
        attendanceSummary = await this.fetchAttendanceMonthData(filters);
      }

      // --- Issue Categories for Report 12 ---
      let issueCategories = new Map<string, any>();
      if (definition.id === 'student-issues-grievance-register-report') {
        const cats = await firstValueFrom(this.issueService.listCategories(profile)).catch(() => []);
        issueCategories = new Map(cats.map((c: any) => [c.id, c]));
      }

      const refs = {
        organizations: new Map(organizations.map(o => [o.id, o])),
        madrasas: new Map(madrasas.map(m => [m.id, m])),
        courses: new Map(courses.map(c => [c.id, c])),
        classes: new Map(classes.map(c => [c.id, c])),
        users: new Map(users.map(u => [u.id, u])),
        studentsDocs: studentsDocs || [],
        classGroups: classGroups,
        staffDocs: staffDocs,
        attendanceSummary,
        issueCategories
      };
      
      this.updateState({ references: refs });

      const queryOptions: any = {};
      if (definition.roles) {
        queryOptions.roles = definition.roles;
      }
      
      let data = await firstValueFrom(this.repo.list<EntityRecord>(definition.collection, profile, [], queryOptions)).catch(() => []);

      // If querying student report, merge with users collection (role: student) to ensure all student records are included
      if (definition.collection === 'students' || definition.category === 'student') {
        const studentUsers = await firstValueFrom(this.repo.list<EntityRecord>('users', profile, [], { roles: ['student'] })).catch(() => []);
        if (studentUsers && studentUsers.length > 0) {
          data = [...data, ...studentUsers];
        }
      }

      this.cachedRawData = data;
      this.processData(data);
    } catch (e) {
      console.error(e);
      this.updateState({ error: 'Failed to fetch report data', loading: false });
    }
  }

  /**
   * Fetches all attendance day records for the selected month and aggregates
   * per-student: lateCount, leaveCount, absentCount, presentCount, totalDays.
   * Firestore path: attendance/{classPlanId}/days/{YYYY-MM-DD}
   */
  private async fetchAttendanceMonthData(
    filters: any
  ): Promise<Map<string, { lateCount: number; leaveCount: number; absentCount: number; presentCount: number; totalDays: number }>> {
    const summary = new Map<string, { lateCount: number; leaveCount: number; absentCount: number; presentCount: number; totalDays: number }>();

    try {
      // 1. Determine target year/month from filters
      let targetYear = new Date().getFullYear();
      let targetMonth = new Date().getMonth(); // 0-indexed

      const monthFilter = Array.isArray(filters)
        ? filters.find((f: any) => f && (f.fieldKey === 'month' || f.fieldKey === 'dateRange'))
        : null;
      const monthValue = monthFilter?.value1 || monthFilter?.value ||
        (typeof filters === 'object' ? (filters?.month || filters?.dateRange) : null);

      if (monthValue) {
        const valStr = String(monthValue).trim();
        const parsed = new Date(valStr);
        if (!isNaN(parsed.getTime())) {
          targetYear = parsed.getFullYear();
          targetMonth = parsed.getMonth();
        } else if (valStr.match(/^\d{4}-\d{2}$/)) {
          const [y, m] = valStr.split('-').map(Number);
          targetYear = y;
          targetMonth = m - 1;
        }
      }

      // 2. Build date range for the month
      const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
      const firstDay = `${monthStr}-01`;
      const lastDayNum = new Date(targetYear, targetMonth + 1, 0).getDate();
      const lastDay = `${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

      // 3. Fetch the parent attendance collection (one doc per classPlan)
      const profile = await firstValueFrom(this.auth.profile$);
      if (!profile) return summary;
      const parentDocs = await this.repo.getAllOnce<any>('attendance', profile).catch(() => []);

      // 4. For each class plan, fetch all days in the month in parallel (batched)
      const batchSize = 20; // Process class plans in batches of 20 to avoid overloading
      for (let i = 0; i < parentDocs.length; i += batchSize) {
        const batch = parentDocs.slice(i, i + batchSize);
        await Promise.all(batch.map(async (parent: any) => {
          const classPlanId = parent.classPlanId || parent.id;
          if (!classPlanId) return;

          try {
            const allDays = await this.attendanceFs.getAllDays(classPlanId);
            // Filter to only days in the target month
            const monthDays = allDays.filter(d => d.date >= firstDay && d.date <= lastDay && d.status === 'confirmed');

            for (const day of monthDays) {
              if (!Array.isArray(day.students)) continue;
              for (const entry of day.students) {
                const sid = entry.studentId;
                if (!sid) continue;

                let rec = summary.get(sid);
                if (!rec) {
                  rec = { lateCount: 0, leaveCount: 0, absentCount: 0, presentCount: 0, totalDays: 0 };
                  summary.set(sid, rec);
                }

                rec.totalDays++;
                switch (entry.status) {
                  case 'late':    rec.lateCount++;    break;
                  case 'leave':   rec.leaveCount++;   break;
                  case 'absent':  rec.absentCount++;  break;
                  case 'present': rec.presentCount++; break;
                }
              }
            }
          } catch (err) {
            // Silently skip class plans that fail
            console.warn('[ReportBuilder] Failed to fetch attendance days for plan:', classPlanId, err);
          }
        }));
      }
    } catch (err) {
      console.error('[ReportBuilder] fetchAttendanceMonthData error:', err);
    }

    return summary;
  }

  private processData(rawData: any[]): void {
    let processed = this.resolveReferences(rawData);

    // Deduplicate records by unique entity identifier & display signature to prevent duplicate rows in ALL reports
    const seenEntityKeys = new Set<string>();
    const seenDisplaySignatures = new Set<string>();

    processed = processed.filter(item => {
      if (item._isUnassignedRow) return true;
      // 1. Check primary ID / entity ID
      const entityId = item.id || item.uid || item.studentId || item.userId || item.assignmentId || item.transactionId;
      if (entityId) {
        const idKey = `id_${entityId}`;
        if (seenEntityKeys.has(idKey)) return false;
        seenEntityKeys.add(idKey);
        return true;
      }

      // 2. Check display signature as fallback for un-identified items
      const name = item.studentNameDisplay || item.name || item.studentName || item.title || '';
      const father = item.parentName || item.fatherName || item.guardianName || '';
      const madrasa = item.madrasaNameDisplay || item.madrasaId || '';
      const cls = item.classNameDisplay || item.classId || item.courseNameDisplay || item.courseId || '';
      const dateVal = item.admissionDate || item.actionDate || item.startDate || item.createdAt || item.amount || '';
      const status = item.status || item.paymentStatus || '';

      if (name) {
        const signature = `${name}___${father}___${madrasa}___${cls}___${dateVal}___${status}`.toLowerCase().trim();
        if (seenDisplaySignatures.has(signature)) return false;
        seenDisplaySignatures.add(signature);
      }

      return true;
    });

    // 1. Client-Side Filtering
    processed = this.applyClientFilters(processed, this.state.value.filters);
    
    // 2. Computed Columns evaluation
    processed = this.evaluateComputedColumns(processed, this.state.value.columns);

    // 3. Built-in Report Aggregation & Special Reports
    const definition = this.state.value.baseDefinition;
    if (definition?.id === 'monthly-student-movement-strength-report') {
      processed = this.applyMonthlyStudentMovement(processed, this.state.value.filters);
    } else if (definition?.id === 'madrasa-usthadh-list-report') {
      processed = this.applyUsthadhStudentAllocation(processed);
    } else if (definition?.id === 'staff-movement-audit-report') {
      processed = this.applyStaffMovementAudit(processed);
    } else if (definition?.id === 'maktab-to-hifz-promotions-report') {
      processed = this.applyMaktabToHifzPromotions(processed);
    } else if (definition?.id === 'hifz-completion-dawr-graduations-report') {
      processed = this.applyHifzCompletionReport(processed);
    } else if (definition?.id === 'hifz-substage-progress-report') {
      processed = this.applyHifzSubstageProgress(processed);
    } else if (definition?.id === 'dawr-cycles-certification-readiness-report') {
      processed = this.applyDawrCertificationReadiness(processed);
    } else if (definition?.id === 'habitual-latecomers-monthly-report') {
      processed = this.applyHabitualLatecomers(processed);
    } else if (definition?.id === 'attendance-risk-alert-report') {
      processed = this.applyAttendanceRiskAlert(processed);
    } else if (definition?.id === 'student-issues-grievance-register-report') {
      processed = this.applyStudentIssuesGrievanceRegister(processed);
    } else if (definition?.id === 'madrasa-course-type-strength-report') {
      processed = this.applyMadrasaCourseTypeStrength(processed);
    } else if (definition?.id === 'student-movement-audit-report') {
      processed = this.applyStudentMovementAudit(processed);
    } else if (definition?.id === 'events-competitions-roster-report') {
      processed = this.applyEventsCompetitionsRoster(processed);
    } else if (definition?.id === 'student-master-progress-snapshot-report') {
      processed = this.applyStudentMasterProgressSnapshot(processed);
    }

    if (definition?.aggregationLogic === 'count-by-field' && definition.groupByField) {
      processed = this.applyCountAggregation(processed, definition.groupByField);
    } else if (definition?.aggregationLogic === 'sum-by-field' && definition.groupByField) {
      processed = this.applySumAggregation(processed, definition.groupByField);
    } else {
      // 4. Dynamic Grouping and Aggregations (from UI)
      if (this.state.value.grouping.length > 0) {
        const gField = this.state.value.grouping[0];
        processed = [...processed].sort((a, b) => {
          const valA = String(a[gField] || '').toLowerCase();
          const valB = String(b[gField] || '').toLowerCase();
          return valA.localeCompare(valB);
        });
        processed = this.applyGroupingAndAggregation(processed, this.state.value.grouping, this.state.value.aggregations);
      }
    }

    // 5. Multi-level Sorting
    processed = this.applySorting(processed, this.state.value.sorting);

    this.updateState({ data: processed, loading: false });
  }

  private applyClientFilters(data: any[], filters: any): any[] {
    if (!filters || !Array.isArray(filters) || filters.length === 0) return data;

    return data.filter(row => {
      if (row._isUnassignedRow) return true;
      return filters.every(f => {
        if (!f.fieldKey || f.fieldKey === 'month') return true;
        
        let rowValue = row[f.fieldKey];
        const val1 = f.value1;
        const val2 = f.value2;

        // Smart reference resolution: If filtering on an ID or reference column, include display names in string comparison
        if (f.fieldKey === 'organizationId' || f.fieldKey === 'organization' || f.fieldKey === 'ORG') {
          const orgName = row['organizationNameDisplay'] || row['organizationName'] || row['orgName'] || row['organization'] || row['name'];
          rowValue = [rowValue, orgName].filter(Boolean).join(' ');
        } else if (typeof f.fieldKey === 'string' && f.fieldKey.endsWith('Id') && f.fieldKey.length > 2) {
          const prefix = f.fieldKey.slice(0, -2);
          const displayKey = `${prefix}NameDisplay`;
          if (row[displayKey]) {
            rowValue = `${rowValue} ${row[displayKey]}`;
          }
        }

        const isEmpty = rowValue === undefined || rowValue === null || String(rowValue).trim() === '';

        if (f.operator === 'isEmpty') return isEmpty;
        if (f.operator === 'isNotEmpty') return !isEmpty;

        if (isEmpty) {
          return false;
        }

        switch (f.operator) {
          case 'equals':
            return String(rowValue).toLowerCase() === String(val1).toLowerCase();
          case 'contains':
            return String(rowValue).toLowerCase().includes(String(val1).toLowerCase());
          case 'greaterThan':
            return Number(rowValue) > Number(val1);
          case 'lessThan':
            return Number(rowValue) < Number(val1);
          case 'between':
            return Number(rowValue) >= Number(val1) && Number(rowValue) <= Number(val2);
          default:
            return true;
        }
      });
    });
  }

  private resolveReferences(inputData: any[]): any[] {
    let data = inputData;
    const refs = this.state.value.references;
    const allStaffDocs = refs.staffDocs || [];
    const allClassGroups = refs.classGroups || [];

    // 1. Merge studentsDocs and users (role: student) into unified active student list
    const extractCleanId = (v: any): string => {
      if (!v) return '';
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'object' && (v.id || v.docId || v.uid)) return String(v.id || v.docId || v.uid).trim();
      return String(v).trim();
    };

    const allStudentsMap = new Map<string, any>();
    const studentsList = refs.studentsDocs || [];
    studentsList.forEach((s: any) => {
      const k = extractCleanId(s.id || s.uid || s.userId || s.studentId);
      if (k) allStudentsMap.set(k, s);
    });

    if (refs.users) {
      refs.users.forEach((u: any) => {
        const role = String(u.role || u.userType || '').toLowerCase();
        if (role === 'student' || role === '' || u.studentId || u.classId) {
          const ids = [extractCleanId(u.id), extractCleanId(u.uid), extractCleanId(u.userId), extractCleanId(u.studentId)].filter(Boolean);
          const existingKey = ids.find(id => allStudentsMap.has(id));
          if (existingKey) {
            const existing = allStudentsMap.get(existingKey)!;
            const merged = { ...u, ...existing };
            ids.forEach(id => allStudentsMap.set(id, merged));
          } else if (ids[0]) {
            allStudentsMap.set(ids[0], u);
          }
        }
      });
    }

    const uniqueActiveStudents = Array.from(new Set(allStudentsMap.values())).filter((s: any) => {
      const st = String(s.status || s.state || '').toLowerCase();
      return !['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(st);
    });

    console.log('[ReportBuilder DEBUG] Raw studentsDocs count:', refs.studentsDocs?.length);
    console.log('[ReportBuilder DEBUG] Raw users map size:', refs.users?.size);
    console.log('[ReportBuilder DEBUG] Unique activeStudents count:', uniqueActiveStudents.length);

    const activeStudents = uniqueActiveStudents;

    // 2. Pre-calculate exact active student counts for each classGroup (matching Management Page scope logic)
    const classGroupStudentCounts = new Map<string, number>();
    const allMatchedStudentIdentities = new Set<string>(); // Collected during first loop

    const extractId = extractCleanId;

    allClassGroups.forEach((group: any) => {
      const gIdStr = extractCleanId(group.id || group.docId);
      if (!gIdStr) return;

      const gIdTokens = new Set<string>([
        extractId(group.id),
        extractId(group.docId),
        extractId(group.groupId),
        extractId(group.classGroupId),
        String(group.id || '').trim(),
        String(group.docId || '').trim(),
        String(group.groupId || '').trim(),
        ...extractTokens(group.id),
        ...extractTokens(group.docId),
        ...extractTokens(group.groupId),
        ...extractTokens(group.classGroupId),
        ...extractTokens(group.code)
      ].filter(Boolean).map(v => String(v).toLowerCase().trim()));

      const groupStudentRoster = new Set<string>([
        ...extractTokens(group.assignedStudentIds),
        ...extractTokens(group.assignedStudents),
        ...extractTokens(group.studentIds),
        ...extractTokens(group.students),
        ...extractTokens(group.assignedStudentId),
        ...extractTokens(group.studentId)
      ].map(s => String(s).toLowerCase().trim()));

      const matchingStudents = activeStudents.filter((s: any) => {
        const sGroupTokens = new Set<string>([
          ...extractTokens(s.groupId),
          ...extractTokens(s.classGroupId),
          ...extractTokens(s.assignedGroupId),
          ...extractTokens(s.group),
          ...extractTokens(s.classGroup),
          ...extractTokens(s.assignedClassGroup),
          ...extractTokens(s.sectionId),
          ...extractTokens(s.section),
          ...extractTokens(s.batchId),
          ...extractTokens(s.batch),
          ...extractTokens(s.groupIds),
          ...extractTokens(s.classGroupIds),
          ...extractTokens(s.assignedGroupIds),
          ...extractTokens(s.groups),
          ...extractTokens(s.sections),
          ...extractTokens(s.batches)
        ].filter(Boolean).map(v => String(v).toLowerCase().trim()));

        let matchToken = false;
        for (const tok of sGroupTokens) {
          if (gIdTokens.has(tok)) {
            matchToken = true;
            break;
          }
        }

        const sIdentities = [
          s.id, s.uid, s.userId, s.entityId, s.docId, s.studentId, s.email
        ].filter(Boolean).map(v => String(v).toLowerCase().trim());
        const matchRoster = sIdentities.some(id => groupStudentRoster.has(id));

        return matchToken || matchRoster;
      });

      const studentIdentitySet = new Set<string>();
      matchingStudents.forEach((st: any) => {
        [st.id, st.uid, st.userId, st.entityId, st.docId, st.studentId, st.email]
          .filter(Boolean).forEach(v => {
            const k = String(v).toLowerCase().trim();
            studentIdentitySet.add(k);
            allMatchedStudentIdentities.add(k); // Collect in single pass
          });
      });

      const totalCount = matchingStudents.length;

      classGroupStudentCounts.set(gIdStr, totalCount);
    });

    let totalGroupStudentsSum = 0;
    classGroupStudentCounts.forEach((c) => { totalGroupStudentsSum += c; });
    console.log('[ReportBuilder DEBUG] Total Class Groups count:', allClassGroups.length);
    console.log('[ReportBuilder DEBUG] Total studentCount sum across all Class Groups:', totalGroupStudentsSum);

    // 3. Find unassigned students — built from identities collected during the first pass (no second O(n×m) loop)
    const unassignedStudents = activeStudents.filter((s: any) => {
      const ids = [s.id, s.uid, s.userId, s.entityId, s.docId, s.studentId, s.email]
        .filter(Boolean).map(v => String(v).toLowerCase().trim());
      return !ids.some(id => allMatchedStudentIdentities.has(id));
    });

    const unassignedCount = unassignedStudents.length;
    console.log('[ReportBuilder DEBUG] Unassigned students (no Class Group):', unassignedCount);
    console.log('[ReportBuilder DEBUG] Unassigned student details list:', unassignedStudents.map((s: any) => ({ name: s.displayName || s.name || s.studentName || 'N/A', id: s.id || s.docId || s.uid, email: s.email || 'N/A', madrasaId: s.madrasaId || 'N/A' })));
    this.updateState({ unassignedCount });

    // Inject a synthetic "Unassigned Students" row for Class Group reports if there are unassigned students
    const baseDef = this.state.value.baseDefinition;
    const isClassGroupReport = !baseDef || baseDef.collection === 'classGroups' || baseDef.id === 'class-group-list';

    if (isClassGroupReport && unassignedCount > 0) {
      const unassignedRow: any = {
        id: '__unassigned_students__',
        docId: '__unassigned_students__',
        name: 'Unassigned Students',
        groupName: 'Unassigned Students',
        title: 'Unassigned Students',
        assignedClassGroupDisplay: 'Unassigned / No Group',
        studentCount: unassignedCount,
        capacity: '-',
        maxCapacity: '-',
        assignedStaffNamesDisplay: '-',
        madrasaNameDisplay: 'All Madrasas',
        courseNameDisplay: '-',
        classNameDisplay: '-',
        status: 'Active',
        _isUnassignedRow: true
      };
      data = [...data, unassignedRow];
    }

    function localExtractTokens(val: any): string[] {
      if (!val) return [];
      if (typeof val === 'string') {
        if (val.includes(',')) return val.split(',').map((v: string) => v.trim()).filter(Boolean);
        return [val.trim()];
      }
      if (typeof val === 'number') return [String(val)];
      if (typeof val === 'object') {
        if (Array.isArray(val)) return val.flatMap(localExtractTokens);
        const keys = ['id', 'uid', 'userId', 'docId'];
        const found: string[] = [];
        for (const k of keys) { if (val[k]) found.push(...localExtractTokens(val[k])); }
        return found;
      }
      return [String(val).trim()];
    }

    function extractTokens(val: any): string[] {
      if (!val) return [];
      if (typeof val === 'string') {
        if (val.includes(',')) return val.split(',').flatMap(extractTokens);
        return [val.trim()];
      }
      if (typeof val === 'number') return [String(val)];
      if (typeof val === 'object') {
        if (Array.isArray(val)) return val.flatMap(extractTokens);
        const keys = ['id', 'uid', 'userId', 'staffId', 'docId', '_id', 'email', 'name', 'displayName', 'title', 'groupName', 'className'];
        const found: string[] = [];
        for (const k of keys) {
          if (val[k]) found.push(...extractTokens(val[k]));
        }
        return found;
      }
      return [String(val).trim()];
    }

    return data.map(row => {
      // Short-circuit: return synthetic rows (e.g. Unassigned Students) as-is
      if (row._isUnassignedRow) return row;

      const studentId = row.studentId || row.userId || row.id || row.uid;
      const user = refs.users?.get(studentId) || row;
      const targetCleanId = String(studentId || '').trim();

      const matchingStaffDoc = allStaffDocs.find((s: any) =>
        String(s.id || s.docId || s.userId || s.uid || '').trim().toLowerCase() === targetCleanId.toLowerCase() ||
        (s.email && user.email && String(s.email).trim().toLowerCase() === String(user.email).trim().toLowerCase())
      ) || {};

      const organizationId = row.organizationId || user.organizationId || matchingStaffDoc.organizationId;
      const madrasaId = row.madrasaId || user.madrasaId || matchingStaffDoc.madrasaId;
      const courseId = row.courseId || user.courseId || matchingStaffDoc.courseId;
      const classId = row.classId || user.classId || matchingStaffDoc.classId;
      const parentId = row.parentId || user.parentId;
      
      const organization = refs.organizations?.get(organizationId) || {};
      const madrasa = refs.madrasas?.get(madrasaId) || {};
      const course = refs.courses?.get(courseId) || {};
      const cls = refs.classes?.get(classId) || {};
      const parent = refs.users?.get(parentId) || {};

      const rawAdmission = row.admissionDate || user.admissionDate || row.createdAt || user.createdAt || row.joinedAt || user.joinedAt;
      const formattedAdmission = rawAdmission ? (this.formatDateTime(rawAdmission) || rawAdmission) : '-';

      // 1. Gather all user identifiers
      const userTokens = new Set<string>([
        ...extractTokens(row.id), ...extractTokens(row.uid), ...extractTokens(row.userId), ...extractTokens(row.docId),
        ...extractTokens(user.id), ...extractTokens(user.uid), ...extractTokens(user.userId), ...extractTokens(user.docId),
        ...extractTokens(matchingStaffDoc.id), ...extractTokens(matchingStaffDoc.uid), ...extractTokens(matchingStaffDoc.userId),
        ...extractTokens(row.email), ...extractTokens(user.email), ...extractTokens(matchingStaffDoc.email),
        ...extractTokens(row.displayName), ...extractTokens(row.name), ...extractTokens(user.displayName), ...extractTokens(user.name), ...extractTokens(matchingStaffDoc.name)
      ].map(s => s.toLowerCase()));

      const groupNamesList: string[] = [];

      // 2. Gather direct group names from row, user, and staff doc
      const directFields = [
        row.assignedClassGroup, row.assignedClassGroups, row.assignedGroup, row.assignedGroups,
        row.groupName, row.groupNames, row.group, row.groups, row.section, row.sections,
        row.assignedClassGroupNames, row.assignedGroupNames, row.classGroupName, row.classGroupNames,
        user.assignedClassGroup, user.assignedClassGroups, user.assignedGroup, user.assignedGroups,
        user.groupName, user.groupNames, user.group, user.groups, user.section, user.sections,
        user.assignedClassGroupNames, user.assignedGroupNames, user.classGroupName, user.classGroupNames,
        matchingStaffDoc.assignedClassGroup, matchingStaffDoc.assignedClassGroups, matchingStaffDoc.assignedGroup, matchingStaffDoc.assignedGroups,
        matchingStaffDoc.groupName, matchingStaffDoc.groupNames, matchingStaffDoc.group, matchingStaffDoc.groups
      ].filter(Boolean);

      directFields.forEach(gVal => {
        const tokens = extractTokens(gVal);
        tokens.forEach(tok => {
          if (tok && tok !== '-' && tok !== 'null' && tok !== 'undefined') {
            groupNamesList.push(tok);
          }
        });
      });

      // 3. Gather group IDs from row/user/staff and resolve their names from classGroups
      const directGroupIds = new Set<string>([
        ...extractTokens(row.groupId), ...extractTokens(row.groupIds), ...extractTokens(row.classGroupId), ...extractTokens(row.classGroupIds),
        ...extractTokens(user.groupId), ...extractTokens(user.groupIds), ...extractTokens(user.classGroupId), ...extractTokens(user.classGroupIds),
        ...extractTokens(matchingStaffDoc.groupId), ...extractTokens(matchingStaffDoc.groupIds), ...extractTokens(matchingStaffDoc.classGroupId), ...extractTokens(matchingStaffDoc.classGroupIds)
      ].map(s => s.toLowerCase()));

      const matchedGroupDocs: any[] = [];

      // 4. Search classGroups collection for assignments
      if (allClassGroups.length > 0) {
        allClassGroups.forEach((g: any) => {
          const gId = String(g.id || g.docId || '').trim().toLowerCase();
          const gName = String(g.name || g.groupName || g.title || '').trim();
          if (!gName) return;

          if (gId && directGroupIds.has(gId)) {
            groupNamesList.push(gName);
            matchedGroupDocs.push(g);
            return;
          }

          const gStaffTokens = new Set<string>([
            ...extractTokens(g.assignedStaffIds), ...extractTokens(g.assignedStaff), ...extractTokens(g.staffIds),
            ...extractTokens(g.teacherIds), ...extractTokens(g.teachers), ...extractTokens(g.staff), ...extractTokens(g.groupStaff),
            ...extractTokens(g.assignedStaffNames), ...extractTokens(g.staffNames), ...extractTokens(g.teacherNames),
            ...extractTokens(g.incharge), ...extractTokens(g.inchargeId), ...extractTokens(g.inchargeEmail),
            ...extractTokens(g.teacher), ...extractTokens(g.teacherId), ...extractTokens(g.teacherEmail)
          ].map(s => s.toLowerCase()));

          const gStudentTokens = new Set<string>([
            ...extractTokens(g.assignedStudentIds), ...extractTokens(g.assignedStudents), ...extractTokens(g.studentIds),
            ...extractTokens(g.students), ...extractTokens(g.assignedStudentNames)
          ].map(s => s.toLowerCase()));

          let isMatch = false;
          for (const uTok of userTokens) {
            if (!uTok) continue;
            if (gStaffTokens.has(uTok) || gStudentTokens.has(uTok)) {
              isMatch = true;
              break;
            }
          }

          if (isMatch) {
            groupNamesList.push(gName);
            matchedGroupDocs.push(g);
          }
        });
      }

      // Format clean resolved group names display string
      const uniqueGroupNames = Array.from(new Set(groupNamesList.filter(Boolean)));
      const resolvedClassGroupDisplay = uniqueGroupNames.length > 0 ? uniqueGroupNames.join(', ') : '-';

      // 5. Gather all assigned Madrasa names across row, user, staffDoc, and matched classGroups
      const madrasaNamesList: string[] = [];

      const directMadrasaIds = [
        ...extractTokens(row.madrasaId), ...extractTokens(row.madrasaIds),
        ...extractTokens(user.madrasaId), ...extractTokens(user.madrasaIds),
        ...extractTokens(matchingStaffDoc.madrasaId), ...extractTokens(matchingStaffDoc.madrasaIds)
      ].filter(Boolean);

      directMadrasaIds.forEach(mId => {
        const mObj = refs.madrasas?.get(mId);
        if (mObj) {
          madrasaNamesList.push(mObj.name || mObj.title || mObj.displayName || mId);
        }
      });

      const directMadrasaFields = [
        row.madrasaNames, row.madrasaName, row.assignedMadrasaNames, row.assignedMadrasas,
        user.madrasaNames, user.madrasaName, user.assignedMadrasaNames, user.assignedMadrasas,
        matchingStaffDoc.madrasaNames, matchingStaffDoc.madrasaName, matchingStaffDoc.assignedMadrasaNames, matchingStaffDoc.assignedMadrasas
      ].filter(Boolean);

      directMadrasaFields.forEach(mVal => {
        const tokens = extractTokens(mVal);
        tokens.forEach(tok => {
          if (tok && tok !== '-' && tok !== 'null' && tok !== 'undefined') {
            const mObj = refs.madrasas?.get(tok);
            if (mObj) {
              madrasaNamesList.push(mObj.name || mObj.title || mObj.displayName || tok);
            } else if (tok.length > 2 && !tok.match(/^[a-zA-Z0-9_-]{15,30}$/)) {
              madrasaNamesList.push(tok);
            }
          }
        });
      });

      if (matchedGroupDocs.length > 0) {
        matchedGroupDocs.forEach((g: any) => {
          const gMadrasaName = String(g.madrasaName || '').trim();
          const gMadrasaId = String(g.madrasaId || g.madrasa || '').trim();
          if (gMadrasaName && gMadrasaName !== '-') {
            madrasaNamesList.push(gMadrasaName);
          } else if (gMadrasaId && gMadrasaId !== '-') {
            const mObj = refs.madrasas?.get(gMadrasaId);
            if (mObj) {
              madrasaNamesList.push(mObj.name || mObj.title || mObj.displayName || gMadrasaId);
            }
          }
        });
      }

      const uniqueMadrasaNames = Array.from(new Set(madrasaNamesList.filter(Boolean)));
      const resolvedMadrasaNameDisplay = uniqueMadrasaNames.length > 0 ? uniqueMadrasaNames.join(', ') : (row.madrasaName || madrasa?.name || '-');

      const resolvedPersonName = row.displayName || row.name || user.displayName || user.name || matchingStaffDoc.name || matchingStaffDoc.displayName || row.email || user.email || '-';

      const inchargeUserNames: string[] = [];
      if (refs.users) {
        const targetMadrasaIdStr = String(madrasaId || '').trim().toLowerCase();
        refs.users.forEach((u: any) => {
          const uRole = String(u.role || u.roles || '').toLowerCase();
          if (uRole.includes('incharge') || uRole.includes('madrasaincharge')) {
            const uMadrasas = [
              ...extractTokens(u.madrasaId), ...extractTokens(u.madrasaIds), ...extractTokens(u.assignedMadrasas)
            ].map(s => s.toLowerCase());
            if (targetMadrasaIdStr && uMadrasas.includes(targetMadrasaIdStr)) {
              const uName = u.displayName || u.name || u.email;
              if (uName) inchargeUserNames.push(uName);
            }
          }
        });
      }
      if (madrasa?.inchargeName) inchargeUserNames.push(madrasa.inchargeName);
      if (madrasa?.inchargeDisplay) inchargeUserNames.push(madrasa.inchargeDisplay);
      if (madrasa?.incharge && typeof madrasa.incharge === 'string') inchargeUserNames.push(madrasa.incharge);

      const uniqueInchargeNames = Array.from(new Set(inchargeUserNames.filter(Boolean)));
      const resolvedMadrasaInchargeDisplay = uniqueInchargeNames.length > 0 ? uniqueInchargeNames.join(', ') : '-';

      const resolvedPhone = row.mobileNumber || row.phone || row.mobile || row.phoneNumber || row.contactNumber ||
                             user.mobileNumber || user.phone || user.mobile || user.phoneNumber || user.contactNumber ||
                             matchingStaffDoc.mobileNumber || matchingStaffDoc.phone || matchingStaffDoc.mobile || matchingStaffDoc.phoneNumber || '-';

      const resolvedGender = row.gender || user.gender || matchingStaffDoc.gender || '-';
      const resolvedQualification = row.qualification || user.qualification || matchingStaffDoc.qualification || '-';
      const resolvedAddress = row.address || user.address || matchingStaffDoc.address || '-';
      const resolvedDesignation = row.designation || user.designation || matchingStaffDoc.designation || '-';

      // Comprehensive resolution of assigned teacher / staff names across references
      const rowCleanId = extractCleanId(row.id || row.docId);
      const isClassGroupEntity = (allClassGroups.length > 0 && allClassGroups.some((g: any) => extractCleanId(g.id || g.docId) === rowCleanId)) ||
                                 !!(row.groupName || row.capacity || row.maxCapacity || (row.assignedStaffIds && !row.studentId && !row.userId && !user.role));

      const teacherTokens = new Set<string>();

      if (isClassGroupEntity) {
        // For a Class Group entity row, extract teacher tokens ONLY from the class group itself
        [
          ...extractTokens(row.assignedStaffIds), ...extractTokens(row.assignedStaff), ...extractTokens(row.assignedStaffNames),
          ...extractTokens(row.teacherId), ...extractTokens(row.teacherIds), ...extractTokens(row.teacherName), ...extractTokens(row.teacherNames),
          ...extractTokens(row.staffIds), ...extractTokens(row.groupStaff), ...extractTokens(row.teacher), ...extractTokens(row.teachers), ...extractTokens(row.staff)
        ].forEach(t => teacherTokens.add(t));
      } else {
        // For Student / Staff / User rows:
        // 1. Direct teacher fields on row / user / staffDoc
        [
          ...extractTokens(row.assignedStaffIds), ...extractTokens(row.assignedStaff), ...extractTokens(row.assignedStaffNames),
          ...extractTokens(row.teacherId), ...extractTokens(row.teacherIds), ...extractTokens(row.teacherName), ...extractTokens(row.teacherNames),
          ...extractTokens(user.assignedStaffIds), ...extractTokens(user.assignedStaff), ...extractTokens(user.assignedStaffNames),
          ...extractTokens(user.teacherId), ...extractTokens(user.teacherIds), ...extractTokens(user.teacherName), ...extractTokens(user.teacherNames),
          ...extractTokens(matchingStaffDoc.assignedStaffIds), ...extractTokens(matchingStaffDoc.assignedStaff)
        ].forEach(t => teacherTokens.add(t));

        // 2. Teachers from specifically matched group(s)
        if (matchedGroupDocs.length > 0) {
          matchedGroupDocs.forEach((g: any) => {
            extractTokens(g.assignedStaffIds).forEach(t => teacherTokens.add(t));
            extractTokens(g.assignedStaff).forEach(t => teacherTokens.add(t));
            extractTokens(g.staffIds).forEach(t => teacherTokens.add(t));
            extractTokens(g.teacherIds).forEach(t => teacherTokens.add(t));
            extractTokens(g.groupStaff).forEach(t => teacherTokens.add(t));
            extractTokens(g.assignedStaffNames).forEach(t => teacherTokens.add(t));
            extractTokens(g.staffNames).forEach(t => teacherTokens.add(t));
            extractTokens(g.teacherNames).forEach(t => teacherTokens.add(t));
            extractTokens(g.teacher).forEach(t => teacherTokens.add(t));
            extractTokens(g.teachers).forEach(t => teacherTokens.add(t));
          });
        } else {
          // 3. Fallback: if student is assigned to a specific group ID, look up THAT specific group
          const targetGroupId = String(row.groupId || row.classGroupId || user.groupId || user.classGroupId || '').trim().toLowerCase();
          let groupMatched = false;
          if (targetGroupId && allClassGroups.length > 0) {
            const specificGroup = allClassGroups.find((g: any) => String(g.id || g.docId || '').trim().toLowerCase() === targetGroupId);
            if (specificGroup) {
              groupMatched = true;
              extractTokens(specificGroup.assignedStaffIds).forEach(t => teacherTokens.add(t));
              extractTokens(specificGroup.assignedStaff).forEach(t => teacherTokens.add(t));
              extractTokens(specificGroup.staffIds).forEach(t => teacherTokens.add(t));
              extractTokens(specificGroup.teacherIds).forEach(t => teacherTokens.add(t));
              extractTokens(specificGroup.assignedStaffNames).forEach(t => teacherTokens.add(t));
              extractTokens(specificGroup.teacherNames).forEach(t => teacherTokens.add(t));
            }
          }

          // 4. Fallback to Class-level teachers ONLY if no group teachers were found
          if (!groupMatched && teacherTokens.size === 0) {
            extractTokens(cls['assignedStaffIds']).forEach(t => teacherTokens.add(t));
            extractTokens(cls['assignedStaff']).forEach(t => teacherTokens.add(t));
            extractTokens(cls['staffIds']).forEach(t => teacherTokens.add(t));
            extractTokens(cls['teacherIds']).forEach(t => teacherTokens.add(t));
            extractTokens(cls['assignedStaffNames']).forEach(t => teacherTokens.add(t));
            extractTokens(cls['teacherName']).forEach(t => teacherTokens.add(t));
          }
        }
      }

      const teacherNamesList: string[] = [];
      teacherTokens.forEach(tok => {
        if (!tok || tok === '-' || tok === 'null' || tok === 'undefined') return;
        
        // Direct name string
        if (tok.length > 2 && !tok.match(/^[a-zA-Z0-9_-]{15,30}$/) && !tok.includes('@')) {
          teacherNamesList.push(tok);
          return;
        }

        const cleanTok = tok.toLowerCase();

        // Search in refs.users map
        let uObj = refs.users?.get(tok) || refs.users?.get(cleanTok);
        if (!uObj && refs.users) {
          for (const u of refs.users.values()) {
            const uId = String(u.id || u.uid || u.userId || u.docId || '').trim().toLowerCase();
            const uEmail = String(u.email || '').trim().toLowerCase();
            if ((uId && uId === cleanTok) || (uEmail && uEmail === cleanTok)) {
              uObj = u;
              break;
            }
          }
        }

        if (uObj) {
          teacherNamesList.push(uObj.displayName || uObj.name || uObj.email || tok);
          return;
        }

        // Search in allStaffDocs array
        const sObj = allStaffDocs.find((s: any) =>
          String(s.id || s.docId || s.userId || s.uid || '').trim().toLowerCase() === cleanTok ||
          (s.email && String(s.email).trim().toLowerCase() === cleanTok)
        );
        if (sObj) {
          teacherNamesList.push(sObj.displayName || sObj.name || sObj.email || tok);
          return;
        }
      });

      const uniqueTeacherNames = Array.from(new Set(teacherNamesList.filter(Boolean)));
      const resolvedAssignedStaffNamesDisplay = uniqueTeacherNames.length > 0 ? uniqueTeacherNames.join(', ') : (row.assignedStaffNames || row.teacherName || user.teacherName || '-');

      const rowIdStr = String(row.id || row.docId || '').trim();
      let resolvedStudentCount = 0;
      if (classGroupStudentCounts.has(rowIdStr)) {
        resolvedStudentCount = classGroupStudentCounts.get(rowIdStr)!;
      } else if (Array.isArray(row.students || row.studentIds)) {
        resolvedStudentCount = (row.students || row.studentIds).length;
      } else if (row.studentCount !== undefined && row.studentCount !== null && Number(row.studentCount) > 0) {
        resolvedStudentCount = Number(row.studentCount);
      } else {
        resolvedStudentCount = 0;
      }

      const merged: any = {
        ...organization,
        ...madrasa,
        ...course,
        ...cls,
        ...user,
        ...row,
        name: resolvedPersonName,
        staffNameDisplay: resolvedPersonName,
        displayName: resolvedPersonName,
        phoneDisplay: resolvedPhone,
        mobileNumber: resolvedPhone !== '-' ? resolvedPhone : '',
        phone: resolvedPhone !== '-' ? resolvedPhone : '',
        gender: resolvedGender,
        qualification: resolvedQualification,
        address: resolvedAddress,
        designation: resolvedDesignation,
        admissionDate: formattedAdmission,
        organizationNameDisplay: row.organizationName || organization?.name || organization?.displayName || '-',
        studentNameDisplay: row.studentName || row.name || user.name || user.displayName || '-',
        fatherNameDisplay: row.fatherName || user.fatherName || '-',
        parentNameDisplay: row.parentName || parent?.name || parent?.displayName || '-',
        studentEmailDisplay: row.email || user.email || '-',
        madrasaNameDisplay: resolvedMadrasaNameDisplay,
        madrasaInchargeDisplay: resolvedMadrasaInchargeDisplay,
        courseNameDisplay: row.courseName || course?.name || '-',
        classNameDisplay: row.className || cls?.name || '-',
        stageDisplay: row.stageLevel || row.stage || user.stageLevel || user.stage || '-',
        assignedStaffNamesDisplay: resolvedAssignedStaffNamesDisplay,
        assignedClassGroupDisplay: resolvedClassGroupDisplay,
        shiftDisplay: String(row.shiftName || row.shift || row.shiftId || course?.['shiftId'] || cls?.['shiftId'] || '-'),
        studentCount: resolvedStudentCount
      };

      // Automatically resolve any other *Id fields into *NameDisplay & format raw timestamps
      for (const key of Object.keys(merged)) {
        if (key.endsWith('Id') && key.length > 2 && typeof merged[key] === 'string') {
          const prefix = key.slice(0, -2);
          const displayKey = `${prefix}NameDisplay`;
          if (!merged[displayKey]) {
            const id = merged[key];
            const refObj = refs.users?.get(id) || refs.madrasas?.get(id) || refs.courses?.get(id) || refs.classes?.get(id) || refs.organizations?.get(id);
            if (refObj) {
              merged[displayKey] = refObj.name || refObj.displayName || refObj.title || '-';
            }
          }
        } else {
          const val = merged[key];
          if (val) {
            const lower = key.toLowerCase();
            if (typeof val === 'string' && val.includes('Timestamp(seconds=')) {
              const formatted = this.formatDateTime(val);
              if (formatted) merged[key] = formatted;
            } else if (lower.includes('date') || lower.includes('time') || lower.endsWith('at')) {
              const formatted = this.formatDateTime(val);
              if (formatted) merged[key] = formatted;
            }
          }
        }
      }

      return merged;
    });
  }

  private evaluateComputedColumns(data: any[], columns: ReportFieldMetadata[]): any[] {
    const computedCols = columns.filter(c => c.expression);
    if (computedCols.length === 0) return data;

    return data.map(row => {
      const newRow = { ...row };
      for (const col of computedCols) {
        newRow[col.key] = this.evaluateExpression(col.expression!, row);
      }
      return newRow;
    });
  }

  private evaluateExpression(expr: string, context: any): any {
    return '';
  }

  public formatDateTime(val: any): string | null {
    if (val === undefined || val === null || val === '') return null;
    let dt: Date | null = null;

    if (val instanceof Date) {
      dt = isNaN(val.getTime()) ? null : val;
    } else if (typeof val === 'number') {
      dt = val > 1e11 ? new Date(val) : new Date(val * 1000);
    } else if (typeof val === 'object') {
      if ('toDate' in val && typeof (val as any).toDate === 'function') {
        dt = (val as any).toDate();
      } else if ('seconds' in val && typeof (val as any).seconds === 'number') {
        dt = new Date((val as any).seconds * 1000);
      } else if ('_seconds' in val && typeof (val as any)._seconds === 'number') {
        dt = new Date((val as any)._seconds * 1000);
      } else if ('toMillis' in val && typeof (val as any).toMillis === 'function') {
        dt = new Date((val as any).toMillis());
      }
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      const tsMatch = trimmed.match(/Timestamp\(seconds=(\d+)/i);
      if (tsMatch) {
        const sec = Number(tsMatch[1]);
        if (!isNaN(sec)) dt = new Date(sec * 1000);
      } else {
        const num = Number(trimmed);
        if (!isNaN(num) && num > 1000000) {
          dt = num > 1e11 ? new Date(num) : new Date(num * 1000);
        } else {
          const parsed = Date.parse(trimmed);
          if (!isNaN(parsed)) dt = new Date(parsed);
        }
      }
    }

    if (dt && !isNaN(dt.getTime())) {
      return dt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    return null;
  }

  private formatStageDisplay(val: string): string {
    if (!val || val === 'N/A' || val === '-' || val === 'Unknown') return val;
    const str = String(val).trim();
    if (str.includes(' - ') || str.includes(':-') || str.includes(': ')) return str;

    const match = str.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(Stage\s*\d+|Sub-stage\s*\d+|Grade\s*\d+|Year\s*\d+|\d+)\b/i);
    if (match) {
      const mainPart = match[1].trim();
      const subPart = match[2].trim();
      const lower = mainPart.toLowerCase();
      if (lower !== 'stage' && lower !== 'substage' && lower !== 'sub-stage' && lower !== 'grade' && lower !== 'year') {
        return `${mainPart} - ${subPart}`;
      }
    }
    return str;
  }

  private applyCountAggregation(data: any[], groupByField: string): any[] {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    const firstRows = new Map<string, any>();

    for (const row of data) {
       let rawKey = row[groupByField];
       if (!rawKey && (groupByField === 'stageLevel' || groupByField === 'stage')) {
         rawKey = row['stage'] || row['stageLevel'] || row['level'] || row['stageDisplay'] || row['stageName'];
       }
       if (!rawKey && (groupByField === 'classId' || groupByField === 'class')) {
         rawKey = row['className'] || row['classNameDisplay'] || row['classId'];
       }

       const key = rawKey ? String(rawKey).trim() : 'Unknown';
       counts.set(key, (counts.get(key) || 0) + 1);
       
       if (!firstRows.has(key)) {
         firstRows.set(key, row);
       }

       if (!labels.has(key)) {
         if (groupByField === 'madrasaId') labels.set(key, row.madrasaNameDisplay || key);
         else if (groupByField === 'courseId') labels.set(key, row.courseNameDisplay || key);
         else if (groupByField === 'classId') labels.set(key, row.classNameDisplay || key);
         else if (groupByField === 'feePlanId') labels.set(key, row.feePlanTitle || key);
         else if (groupByField === 'stageLevel' || groupByField === 'stage') labels.set(key, this.formatStageDisplay(key));
         else labels.set(key, String(key));
       }
    }

    return Array.from(counts.entries()).map(([key, count]) => ({
      ...firstRows.get(key),
      groupLabel: labels.get(key) || key,
      count: count
    }));
  }

  private applySumAggregation(data: any[], groupByField: string): any[] {
    const sums = new Map<string, { amount: number, paidAmount: number, balanceAmount: number, count: number }>();
    const labels = new Map<string, string>();
    const firstRows = new Map<string, any>();

    for (const row of data) {
       const key = row[groupByField] || 'Unknown';
       
       if (!sums.has(key)) {
         sums.set(key, { amount: 0, paidAmount: 0, balanceAmount: 0, count: 0 });
       }
       
       const currentSum = sums.get(key)!;
       currentSum.amount += Number(row.amount || 0);
       currentSum.paidAmount += Number(row.paidAmount || 0);
       currentSum.balanceAmount += Number(row.balanceAmount || 0);
       currentSum.count += 1;
       
       if (!firstRows.has(key)) {
         firstRows.set(key, row);
       }

       if (!labels.has(key)) {
         if (groupByField === 'madrasaId') labels.set(key, row.madrasaNameDisplay || key);
         else if (groupByField === 'courseId') labels.set(key, row.courseNameDisplay || key);
         else if (groupByField === 'classId') labels.set(key, row.classNameDisplay || key);
         else if (groupByField === 'feePlanId') labels.set(key, row.feePlanTitle || key);
         else labels.set(key, String(key));
       }
    }

    return Array.from(sums.entries()).map(([key, sum]) => ({
      ...firstRows.get(key),
      groupLabel: labels.get(key) || key,
      amount: sum.amount,
      paidAmount: sum.paidAmount,
      balanceAmount: sum.balanceAmount,
      count: sum.count
    }));
  }

  private applyGroupingAndAggregation(data: any[], grouping: string[], aggregations: any): any[] {
    if (!grouping || grouping.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const groupKey of grouping) {
        const valA = String(a[groupKey] || '').toLowerCase();
        const valB = String(b[groupKey] || '').toLowerCase();
        if (valA < valB) return -1;
        if (valA > valB) return 1;
      }
      return 0;
    });
  }

  private applySorting(data: any[], sorting: { key: string, direction: 'asc' | 'desc' }[]): any[] {
    if (sorting.length === 0) return data;

    return data.sort((a, b) => {
      if (a._isUnassignedRow) return 1;
      if (b._isUnassignedRow) return -1;
      for (const sort of sorting) {
        const valA = a[sort.key];
        const valB = b[sort.key];
        
        if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private applyMonthlyStudentMovement(data: any[], filters: any): any[] {
    // 1. Determine Target Month & Year from filters or current date
    let monthValue: any = null;

    if (Array.isArray(filters)) {
      const monthFilter = filters.find((f: any) => f && (f.fieldKey === 'month' || f.fieldKey === 'admissionDateRange' || f.fieldKey === 'dateRange'));
      if (monthFilter) monthValue = monthFilter.value1 || monthFilter.value;
    } else if (filters && typeof filters === 'object') {
      monthValue = filters['month'] || filters['admissionDateRange'] || filters['dateRange'];
      if (typeof monthValue === 'object' && monthValue) {
        monthValue = monthValue.value1 || monthValue.value || monthValue.startDate || monthValue.date;
      }
    }

    let targetYear = new Date().getFullYear();
    let targetMonth = new Date().getMonth(); // 0-indexed (0 = Jan, 7 = Aug)

    if (monthValue) {
      const valStr = String(monthValue).trim();
      const parsedDate = new Date(valStr);
      if (!isNaN(parsedDate.getTime())) {
        targetYear = parsedDate.getFullYear();
        targetMonth = parsedDate.getMonth();
      } else if (valStr.includes('-')) {
        const parts = valStr.split('-');
        if (parts.length >= 2) {
          targetYear = parseInt(parts[0], 10) || targetYear;
          targetMonth = (parseInt(parts[1], 10) - 1) || targetMonth;
        }
      }
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthDisplay = `${monthNames[targetMonth]} ${targetYear}`;

    const currentMonthStart = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const currentMonthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const prevMonthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // 2. Classify each student row's movement status for the selected month
    const processedRows = data.map(row => {
      let admissionDateObj: Date | null = null;
      if (row.admissionDate) {
        if (typeof row.admissionDate === 'string') admissionDateObj = new Date(row.admissionDate);
        else if (row.admissionDate instanceof Date) admissionDateObj = row.admissionDate;
        else if (typeof row.admissionDate === 'object' && 'toDate' in row.admissionDate) admissionDateObj = row.admissionDate.toDate();
      } else if (row.createdAt) {
        if (typeof row.createdAt === 'string') admissionDateObj = new Date(row.createdAt);
        else if (row.createdAt instanceof Date) admissionDateObj = row.createdAt;
        else if (typeof row.createdAt === 'object' && 'toDate' in row.createdAt) admissionDateObj = row.createdAt.toDate();
      }

      let movementTag = 'Existing';

      const isNewAdmission = admissionDateObj && admissionDateObj >= currentMonthStart && admissionDateObj <= currentMonthEnd;
      const isInactive = (row.status === 'inactive' || row.status === 'dropped' || row.status === 'archived');
      const isPromoted = String(row.action || row.movementType || '').toLowerCase().includes('promote');
      const isDemoted = String(row.action || row.movementType || '').toLowerCase().includes('demote');
      const isTransferred = String(row.action || row.movementType || '').toLowerCase().includes('transfer');

      if (isNewAdmission) movementTag = 'New Admission';
      else if (isInactive) movementTag = 'Inactive';
      else if (isPromoted) movementTag = 'Promoted';
      else if (isDemoted) movementTag = 'Demoted';
      else if (isTransferred) movementTag = 'Transferred';

      return {
        ...row,
        selectedMonthDisplay: monthDisplay,
        movementStatusDisplay: movementTag,
        _admissionDateObj: admissionDateObj
      };
    });

    // 3. Compute group-level strength metrics by Madrasa & Class Group
    const groupMetricsMap = new Map<string, {
      prevCount: number;
      currentCount: number;
      newAdmissions: number;
      inactives: number;
      promoteDemotes: number;
      transfers: number;
    }>();

    processedRows.forEach(row => {
      const gKey = `${row.madrasaNameDisplay || 'Madrasa'}___${row.assignedClassGroupDisplay || row.classNameDisplay || 'Group'}`;
      let metrics = groupMetricsMap.get(gKey);
      if (!metrics) {
        metrics = { prevCount: 0, currentCount: 0, newAdmissions: 0, inactives: 0, promoteDemotes: 0, transfers: 0 };
        groupMetricsMap.set(gKey, metrics);
      }

      const admDate = row._admissionDateObj;
      const isActive = row.status !== 'inactive' && row.status !== 'dropped' && row.status !== 'archived';

      // Current Month Count
      if (isActive) metrics.currentCount++;

      // Previous Month Count: Enrolled on or before prevMonthEnd and not inactive prior to current month
      if (admDate && admDate <= prevMonthEnd && isActive) {
        metrics.prevCount++;
      } else if (!admDate && isActive) {
        metrics.prevCount++;
      }

      // Movement Metrics
      if (row.movementStatusDisplay === 'New Admission') metrics.newAdmissions++;
      if (row.movementStatusDisplay === 'Inactive') metrics.inactives++;
      if (row.movementStatusDisplay === 'Promoted' || row.movementStatusDisplay === 'Demoted') metrics.promoteDemotes++;
      if (row.movementStatusDisplay === 'Transferred') metrics.transfers++;
    });

    // 4. Attach computed strength counts to each student row
    return processedRows.map(row => {
      const gKey = `${row.madrasaNameDisplay || 'Madrasa'}___${row.assignedClassGroupDisplay || row.classNameDisplay || 'Group'}`;
      const metrics = groupMetricsMap.get(gKey) || { prevCount: 0, currentCount: 0, newAdmissions: 0, inactives: 0, promoteDemotes: 0, transfers: 0 };

      return {
        ...row,
        prevMonthStudentCount: metrics.prevCount,
        currentMonthStudentCount: metrics.currentCount,
        newAdmissionCount: metrics.newAdmissions,
        inactiveCount: metrics.inactives,
        promoteDemoteCount: metrics.promoteDemotes,
        transferCount: metrics.transfers
      };
    });
  }

  private applyUsthadhStudentAllocation(data: any[]): any[] {
    const refs = this.state.value.references;
    const studentsDocs = refs.studentsDocs || [];

    return data.map((staff, idx) => {
      const staffId = staff.id || staff.uid;
      const groupNames = Array.isArray(staff.assignedClassGroupDisplay) 
        ? staff.assignedClassGroupDisplay.join(', ') 
        : (staff.assignedClassGroupDisplay || staff.groupsDisplay || 'None');

      // Count students assigned to this staff member
      const assignedCount = studentsDocs.filter((s: any) => {
        const sStaffIds = Array.isArray(s.assignedStaffIds) ? s.assignedStaffIds : [s.staffId, s.teacherId].filter(Boolean);
        return sStaffIds.map((id: any) => String(id).trim()).includes(String(staffId).trim());
      }).length;

      return {
        ...staff,
        sNo: idx + 1,
        usthadhName: staff.displayName || staff.name || staff.staffNameDisplay || 'Usthadh',
        madrasaName: staff.madrasaNameDisplay || staff.madrasaName || 'Madrasa',
        phone: staff.phoneDisplay || staff.mobileNumber || staff.phone || 'N/A',
        groupsDisplay: groupNames,
        assignedStudentsCount: assignedCount
      };
    });
  }

  private applyStaffMovementAudit(data: any[]): any[] {
    return data.map(item => ({
      ...item,
      effectiveDate: item.effectiveDate || item.actionDate || item.createdAt || '-',
      userName: item.userName || item.staffName || item.name || 'Staff Member',
      madrasaName: item.madrasaName || item.madrasaNameDisplay || 'Madrasa',
      lifecycleAction: item.lifecycleAction || item.action || item.actionType || 'Transfer / Action',
      reason: item.reason || item.remarks || '-',
      performedBy: item.performedBy || item.createdBy || 'System'
    }));
  }

  private applyMaktabToHifzPromotions(data: any[]): any[] {
    return data.filter(item => item.isCrossCourseSwitch || String(item.newCourseId || '').toLowerCase().includes('hifz'))
      .map(item => ({
        ...item,
        actionDate: item.actionDate || item.createdAt || '-',
        studentName: item.studentName || item.name || 'Student',
        madrasaName: item.madrasaName || item.madrasaNameDisplay || 'Madrasa',
        previousStage: item.previousStage || 'Maktab Final Stage',
        newStage: item.newStage || 'Upto 10 Juz',
        reason: item.reason || 'Completed Maktab Course',
        performedBy: item.performedBy || item.createdBy || 'System'
      }));
  }

  private applyHifzCompletionReport(data: any[]): any[] {
    return data.filter(s => String(s.stage || s.stageDisplay || '').toLowerCase().includes('dawr') || s.hifzCompletionDate)
      .map(s => ({
        ...s,
        stageDisplay: s.stage || 'Dawr',
        dawrRoundNo: s.dawrRoundNo || 1,
        hifzCompletionDate: s.hifzCompletionDate || s.updatedAt || s.lastCourseSwitchDate || 'Completed'
      }));
  }

  private applyHifzSubstageProgress(data: any[]): any[] {
    return data.filter(s => {
      const st = String(s.stage || s.stageDisplay || '').toLowerCase();
      return st.includes('20') || st.includes('30') || st.includes('hifz');
    }).map(s => ({
      ...s,
      currentSurah: s.sabaqSurah ? `${s.sabaqSurah} (Ayah ${s.sabaqFromAyah || 1}-${s.sabaqToAyah || 1})` : (s.currentSurah || 'In Progress'),
      juzCompletedThisMonth: s.juzCompletedThisMonth || (s.sabaqJuz ? `Juz ${s.sabaqJuz}` : '1 Juz'),
      progressPace: s.progressPace || '1 Juz / Month'
    }));
  }

  private applyDawrCertificationReadiness(data: any[]): any[] {
    return data.filter(s => String(s.stage || s.stageDisplay || '').toLowerCase().includes('dawr') || s.dawrRoundNo)
      .map(s => {
        const currentRound = s.dawrRoundNo || 1;
        const targetRounds = s.targetDawrRounds || 3;
        const isReady = currentRound >= targetRounds;

        return {
          ...s,
          dawrRoundNo: currentRound,
          targetDawrRounds: `${currentRound} / ${targetRounds} Rounds`,
          dawrDailyJuz: s.dawrDailyJuz || '-',
          certificationStatus: isReady ? 'Certified / Ready for Sanad' : 'In Progress'
        };
      });
  }

  private applyHabitualLatecomers(data: any[]): any[] {
    const summary = this.state.value.references.attendanceSummary;
    const LATE_THRESHOLD = 3;

    // Join student rows with real attendance aggregation
    const enriched = data.map(student => {
      const sid = student.id || student.uid || student.studentId || student.userId;
      const attRec = summary?.get(String(sid || '').trim()) || { lateCount: 0, leaveCount: 0, absentCount: 0, presentCount: 0, totalDays: 0 };

      const attendancePct = attRec.totalDays > 0
        ? `${Math.round((attRec.presentCount / attRec.totalDays) * 100)}%`
        : '-';

      return {
        ...student,
        lateCount: attRec.lateCount,
        leaveCount: attRec.leaveCount,
        absentCount: attRec.absentCount,
        presentCount: attRec.presentCount,
        totalDays: attRec.totalDays,
        attendancePercent: attendancePct,
        phoneDisplay: student.parentPhone || student.guardianPhone ||
          student.phoneDisplay || student.mobileNumber || 'N/A',
        _latentLate: attRec.lateCount
      };
    });

    // Filter to only students with 3+ lates, sort descending by late count
    return enriched
      .filter(s => s.lateCount >= LATE_THRESHOLD)
      .sort((a, b) => b.lateCount - a.lateCount);
  }

  private applyAttendanceRiskAlert(data: any[]): any[] {
    const summary = this.state.value.references.attendanceSummary;
    const LATE_THRESHOLD = 3;
    const LEAVE_THRESHOLD = 3;

    const enriched = data.map(student => {
      const sid = student.id || student.uid || student.studentId || student.userId;
      const attRec = summary?.get(String(sid || '').trim()) || { lateCount: 0, leaveCount: 0, absentCount: 0, presentCount: 0, totalDays: 0 };

      const totalAbsences = attRec.absentCount + attRec.leaveCount;
      const attendancePct = attRec.totalDays > 0
        ? `${Math.round((attRec.presentCount / attRec.totalDays) * 100)}%`
        : '-';

      // Determine risk level
      let riskLevel = 'Low Risk';
      let riskClass = 'low';
      if (attRec.lateCount >= LATE_THRESHOLD && attRec.leaveCount >= LEAVE_THRESHOLD) {
        riskLevel = 'Critical Risk';
        riskClass = 'critical';
      } else if (attRec.lateCount >= LATE_THRESHOLD || totalAbsences >= 5) {
        riskLevel = 'High Risk';
        riskClass = 'high';
      } else if (attRec.lateCount >= 2 || attRec.leaveCount >= 2) {
        riskLevel = 'Medium Risk';
        riskClass = 'medium';
      }

      return {
        ...student,
        lateCount: attRec.lateCount,
        leaveCount: attRec.leaveCount,
        absentCount: attRec.absentCount,
        presentCount: attRec.presentCount,
        totalDays: attRec.totalDays,
        totalAbsences,
        attendancePercent: attendancePct,
        riskLevel,
        riskClass,
        phoneDisplay: student.parentPhone || student.guardianPhone ||
          student.phoneDisplay || student.mobileNumber || 'N/A'
      };
    });

    // Only return students who meet the dual threshold (3+ lates AND 3+ leave)
    return enriched
      .filter(s => s.lateCount >= LATE_THRESHOLD && s.leaveCount >= LEAVE_THRESHOLD)
      .sort((a, b) => {
        // Sort by risk: critical → high → medium → low, then by lateCount desc
        const order: any = { 'Critical Risk': 0, 'High Risk': 1, 'Medium Risk': 2, 'Low Risk': 3 };
        const diff = (order[a.riskLevel] ?? 3) - (order[b.riskLevel] ?? 3);
        return diff !== 0 ? diff : b.lateCount - a.lateCount;
      });
  }

  private applyStudentIssuesGrievanceRegister(data: any[]): any[] {
    const refs = this.state.value.references;
    const issueCategories = refs.issueCategories || new Map();
    const users = refs.users;
    const madrasas = refs.madrasas;

    return data
      .filter(issue => !issue.isDeleted)
      .map(issue => {
        // Resolve category name
        const cat = issueCategories.get(issue.categoryId);
        const categoryName = cat?.name || issue.categoryName || issue.categoryId || 'General';
        const subcategoryName = issue.subcategoryName || '';
        const categoryDisplay = subcategoryName ? `${categoryName} › ${subcategoryName}` : categoryName;

        // Resolve madrasa name
        const madrasaObj = madrasas?.get(issue.madrasaId);
        const madrasaName = madrasaObj?.name || issue.madrasaName || issue.madrasaNameDisplay || '-';

        // Resolve reporter name
        const reporterUser = users?.get(issue.reportedBy);
        const reporterName = issue.reporterNameSnapshot ||
          reporterUser?.displayName || reporterUser?.name || reporterUser?.email || issue.reporterName || '-';

        // Resolve assigned staff/coordinator name
        const assignedId = issue.assignedStaffId || issue.assignedCoordinatorId || issue.assignedMadrasaInchargeId;
        const assignedUser = assignedId ? users?.get(assignedId) : null;
        const assignedToName = assignedUser?.displayName || assignedUser?.name || assignedUser?.email ||
          issue.assignedStaffName || issue.assignedTo || '-';

        // Format dates
        const reportedDate = this.formatDateTime(issue.reportedAt) || this.formatDateTime(issue.createdAt) || '-';
        const closedDate = issue.closedAt ? (this.formatDateTime(issue.closedAt) || '-') : '-';
        const dueDate = issue.dueAt ? (this.formatDateTime(issue.dueAt) || '-') : '-';

        // Map status to readable label
        const statusLabelMap: Record<string, string> = {
          reported: 'Reported',
          acknowledged: 'Acknowledged',
          assigned: 'Assigned',
          underInvestigation: 'Under Investigation',
          actionRequired: 'Action Required',
          inProgress: 'In Progress',
          resolved: 'Resolved',
          closed: 'Closed',
          reopened: 'Reopened',
          rejected: 'Rejected',
          duplicate: 'Duplicate'
        };
        const statusLabel = statusLabelMap[issue.status] || issue.status || '-';

        // Priority readable label
        const priorityLabelMap: Record<string, string> = {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
          critical: 'Critical'
        };
        const priorityLabel = priorityLabelMap[issue.priority] || issue.priority || '-';

        // Open issues flag
        const isOpen = ['reported', 'acknowledged', 'assigned', 'underInvestigation', 'actionRequired', 'inProgress', 'reopened'].includes(issue.status);

        return {
          ...issue,
          createdAt: reportedDate,
          title: issue.title || '-',
          category: categoryDisplay,
          userName: reporterName,
          madrasaName,
          madrasaNameDisplay: madrasaName,
          priority: priorityLabel,
          status: statusLabel,
          assignedTo: assignedToName,
          closedDate,
          dueDate,
          isOpen,
          confidentialDisplay: issue.confidential ? 'Confidential' : 'Not Confidential',
          emergencyDisplay: issue.emergency ? '🚨 Emergency' : '-'
        };
      })
      .sort((a, b) => {
        // Sort: open issues first, then by priority (critical > high > medium > low), then by date
        if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
        const pOrder: any = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        const pd = (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
        return pd !== 0 ? pd : String(b.createdAt).localeCompare(String(a.createdAt));
      });
  }

  private applyMadrasaCourseTypeStrength(data: any[]): any[] {
    const refs = this.state.value.references;
    const allStaffDocs = refs.staffDocs || [];

    return data.map(madrasa => {
      const madrasaId = madrasa.id || madrasa.docId;
      const madrasaName = madrasa.name || madrasa.displayName || madrasa.madrasaName || '-';

      // Count staff belonging to this madrasa
      const madrasaStaff = allStaffDocs.filter((s: any) => {
        const staffMadrasaIds = [
          s.madrasaId, s.madrasa,
          ...(Array.isArray(s.madrasaIds) ? s.madrasaIds : [])
        ].filter(Boolean).map((id: any) => String(id).trim());
        return staffMadrasaIds.includes(String(madrasaId).trim());
      });

      const totalStaff = madrasaStaff.length;
      const maleStaff = madrasaStaff.filter((s: any) => String(s.gender || '').toLowerCase() === 'male').length;
      const femaleStaff = madrasaStaff.filter((s: any) => String(s.gender || '').toLowerCase() === 'female').length;

      // Find incharges for this madrasa
      const inchargeNames: string[] = [];
      if (refs.users) {
        refs.users.forEach((u: any) => {
          const uRole = String(u.role || '').toLowerCase();
          if (uRole.includes('incharge') || uRole.includes('madrasaincharge')) {
            const uMadrasas = [
              u.madrasaId,
              ...(Array.isArray(u.madrasaIds) ? u.madrasaIds : [])
            ].filter(Boolean).map((id: any) => String(id).trim());
            if (uMadrasas.includes(String(madrasaId).trim())) {
              const uName = u.displayName || u.name || u.email;
              if (uName) inchargeNames.push(uName);
            }
          }
        });
      }
      if (madrasa.inchargeName) inchargeNames.push(madrasa.inchargeName);

      // Determine course type
      const hasMaktab = !!(madrasa.hasMaktab || madrasa.maktab || String(madrasa.courseType || '').toLowerCase().includes('maktab'));
      const hasHifz = !!(madrasa.hasHifz || madrasa.hifz || String(madrasa.courseType || '').toLowerCase().includes('hifz'));
      let courseTypeDisplay = madrasa.courseType || madrasa.type || '-';
      if (hasMaktab && hasHifz) courseTypeDisplay = 'Maktab & Hifz (Both)';
      else if (hasHifz) courseTypeDisplay = 'Hifz';
      else if (hasMaktab) courseTypeDisplay = 'Maktab';

      return {
        ...madrasa,
        madrasaNameDisplay: madrasaName,
        courseTypeDisplay,
        totalStaffCount: totalStaff,
        maleStaffCount: maleStaff,
        femaleStaffCount: femaleStaff,
        activeInchargeDisplay: Array.from(new Set(inchargeNames)).join(', ') || '-'
      };
    });
  }

  private applyStudentMovementAudit(data: any[]): any[] {
    return data.map(item => {
      const action = item.action || item.actionType || item.lifecycleAction || item.movementType || '';
      let movementEventType = action;

      // Normalize event type labels
      const actionLower = String(action).toLowerCase();
      if (actionLower.includes('join') || actionLower.includes('admit') || actionLower.includes('enrol')) {
        movementEventType = 'Newly Joined';
      } else if (actionLower.includes('transfer')) {
        movementEventType = 'Transferred';
      } else if (actionLower.includes('promot')) {
        movementEventType = item.isCrossCourseSwitch ? 'Cross-Course Promotion (Maktab → Hifz)' : 'Promoted';
      } else if (actionLower.includes('demot')) {
        movementEventType = 'Demoted';
      } else if (actionLower.includes('reliev') || actionLower.includes('withdraw') || actionLower.includes('left') || actionLower.includes('drop')) {
        movementEventType = 'Relieved / Withdrew';
      } else if (!movementEventType) {
        movementEventType = action || '-';
      }

      const courseName = item.courseType || item.courseName || item.courseNameDisplay || item.newCourseId || '-';

      return {
        ...item,
        actionDate: item.actionDate || item.effectiveDate || item.createdAt || '-',
        studentNameDisplay: item.studentName || item.name || item.displayName || item.userName || '-',
        admissionNo: item.admissionNo || item.studentId || item.userId || '-',
        madrasaNameDisplay: item.madrasaName || item.madrasaNameDisplay || '-',
        courseTypeDisplay: courseName,
        movementEventType,
        previousStage: item.previousStage || item.previousClassGroup || item.fromStage || item.oldStage || '-',
        newStage: item.newStage || item.newClassGroup || item.toStage || item.targetStage || '-',
        reason: item.reason || item.remarks || '-',
        performedBy: item.performedBy || item.createdBy || '-'
      };
    });
  }

  private applyEventsCompetitionsRoster(data: any[]): any[] {
    return data.map(event => {
      const eventDate = event.eventDate || event.date || event.startDate || event.createdAt;
      const formattedDate = eventDate ? (this.formatDateTime(eventDate) || String(eventDate)) : '-';

      // Determine course type display
      const courseType = event.courseType || event.course || '';
      const courseTypeLower = String(courseType).toLowerCase();
      let courseTypeDisplay = courseType || '-';
      if (courseTypeLower.includes('hifz')) courseTypeDisplay = 'Hifz';
      else if (courseTypeLower.includes('maktab')) courseTypeDisplay = 'Maktab';
      else if (!courseType) courseTypeDisplay = '-';

      // Determine category
      const category = event.category || event.eventType || event.type || '-';
      const categoryLower = String(category).toLowerCase();
      let categoryDisplay = category;
      if (categoryLower.includes('compet')) categoryDisplay = 'Competition';
      else if (categoryLower.includes('seminar')) categoryDisplay = 'Seminar';
      else if (categoryLower.includes('graduat')) categoryDisplay = 'Graduation Ceremony';
      else if (categoryLower.includes('workshop')) categoryDisplay = 'Workshop';

      // Count participants
      const participants = event.participants || event.attendees || event.studentIds || [];
      const totalParticipants = Array.isArray(participants) ? participants.length : (event.totalParticipants || event.participantCount || 0);

      // Resolve winner
      const winnerName = event.winnerName || event.winner || event.rank1Student || event.firstPlaceStudent || '-';
      const winnerUsthadh = event.winnerUsthadh || event.winnerTeacher || event.rank1Usthadh || '-';

      return {
        ...event,
        eventDateDisplay: formattedDate,
        title: event.title || event.name || event.eventName || '-',
        categoryDisplay,
        courseTypeDisplay,
        totalParticipants,
        winnerStudentDisplay: winnerName,
        winnerUsthadhDisplay: winnerUsthadh,
        status: event.status || '-'
      };
    });
  }

  private applyStudentMasterProgressSnapshot(data: any[]): any[] {
    return data.map(student => {
      // Compute total Juz memorized from progress data
      const juzFromSabaq = student.sabaqJuz ? Number(student.sabaqJuz) : 0;
      const juzFromProgress = student.totalJuzMemorized ? Number(student.totalJuzMemorized) : 0;
      const juzFromStage = (() => {
        const stage = String(student.stage || student.stageDisplay || '').toLowerCase();
        if (stage.includes('dawr') || stage.includes('30')) return 30;
        if (stage.includes('upto 30') || stage.includes('up to 30')) return 28;
        if (stage.includes('upto 20') || stage.includes('up to 20')) return 18;
        if (stage.includes('upto 10') || stage.includes('up to 10')) return 8;
        return 0;
      })();

      const totalJuz = juzFromProgress || juzFromSabaq || juzFromStage || 0;

      // Current position
      const currentSurah = student.sabaqSurah
        ? `${student.sabaqSurah} (Ayah ${student.sabaqFromAyah || 1}-${student.sabaqToAyah || 1})`
        : (student.currentSurah || student.currentPosition || '-');

      // Attendance percentage
      const presentDays = Number(student.presentDays || student.daysPresent || 0);
      const totalDays = Number(student.totalDays || student.workingDays || 0);
      const attendancePct = totalDays > 0 ? `${Math.round((presentDays / totalDays) * 100)}%` : (student.attendancePercent || student.attendancePct || '-');

      return {
        ...student,
        admissionNo: student.admissionNo || student.registrationNo || student.studentId || student.id || '-',
        currentSurah,
        totalJuzMemorized: totalJuz > 0 ? totalJuz : '-',
        attendancePercent: attendancePct
      };
    });
  }

  private updateState(partial: Partial<ReportState>): void {
    this.state.next({ ...this.state.value, ...partial });
  }
}
