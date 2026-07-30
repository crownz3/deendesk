import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { RepositoryService, EntityRecord } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
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
  references: {
    organizations: Map<string, any>;
    madrasas: Map<string, any>;
    courses: Map<string, any>;
    classes: Map<string, any>;
    users: Map<string, any>;
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
    references: {
      organizations: new Map(),
      madrasas: new Map(),
      courses: new Map(),
      classes: new Map(),
      users: new Map()
    }
  });

  public state$ = this.state.asObservable();

  constructor(
    private repo: RepositoryService,
    private auth: AuthService
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
    this.updateState({ filters });
    const currentDef = this.state.value.baseDefinition;
    if (currentDef) {
      // Re-fetch or re-filter data
      this.fetchData(currentDef, filters);
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
      const [organizations, madrasas, courses, classes, users] = await Promise.all([
        this.repo.getAllOnce<any>('organizations', profile).catch(() => []),
        this.repo.getAllOnce<any>('madrasas', profile).catch(() => []),
        this.repo.getAllOnce<any>('courses', profile).catch(() => []),
        this.repo.getAllOnce<any>('classes', profile).catch(() => []),
        this.repo.getAllOnce<any>('users', profile).catch(() => [])
      ]);

      const refs = {
        organizations: new Map(organizations.map(o => [o.id, o])),
        madrasas: new Map(madrasas.map(m => [m.id, m])),
        courses: new Map(courses.map(c => [c.id, c])),
        classes: new Map(classes.map(c => [c.id, c])),
        users: new Map(users.map(u => [u.id, u]))
      };
      
      this.updateState({ references: refs });

      const queryOptions: any = {};
      if (definition.roles) {
        queryOptions.roles = definition.roles;
      }
      
      const data = await firstValueFrom(this.repo.list<EntityRecord>(definition.collection, profile, [], queryOptions));
      this.processData(data);
    } catch (e) {
      console.error(e);
      this.updateState({ error: 'Failed to fetch report data', loading: false });
    }
  }

  private processData(rawData: any[]): void {
    // 0. Normalize Data and Resolve References
    let processed = this.resolveReferences(rawData);

    // 1. Client-Side Filtering
    processed = this.applyClientFilters(processed, this.state.value.filters);
    
    // 2. Computed Columns evaluation
    processed = this.evaluateComputedColumns(processed, this.state.value.columns);

    // 3. Built-in Report Aggregation
    const definition = this.state.value.baseDefinition;
    if (definition?.aggregationLogic === 'count-by-field' && definition.groupByField) {
      processed = this.applyCountAggregation(processed, definition.groupByField);
    } else if (definition?.aggregationLogic === 'sum-by-field' && definition.groupByField) {
      processed = this.applySumAggregation(processed, definition.groupByField);
    } else {
      // 4. Dynamic Grouping and Aggregations (from UI)
      if (this.state.value.grouping.length > 0) {
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
      return filters.every(f => {
        if (!f.fieldKey) return true;
        
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

  private resolveReferences(data: any[]): any[] {
    const refs = this.state.value.references;
    return data.map(row => {
      const studentId = row.studentId || row.userId || row.id;
      const user = refs.users?.get(studentId) || row;
      const organizationId = row.organizationId || user.organizationId;
      const madrasaId = row.madrasaId || user.madrasaId;
      const courseId = row.courseId || user.courseId;
      const classId = row.classId || user.classId;
      const parentId = row.parentId || user.parentId;
      
      const organization = refs.organizations?.get(organizationId) || {};
      const madrasa = refs.madrasas?.get(madrasaId) || {};
      const course = refs.courses?.get(courseId) || {};
      const cls = refs.classes?.get(classId) || {};
      const parent = refs.users?.get(parentId) || {};

      const merged = {
        ...organization,
        ...madrasa,
        ...course,
        ...cls,
        ...user,
        ...row,
        organizationNameDisplay: row.organizationName || organization?.name || organization?.displayName || '-',
        studentNameDisplay: row.studentName || row.name || user.name || user.displayName || '-',
        fatherNameDisplay: row.fatherName || user.fatherName || '-',
        parentNameDisplay: row.parentName || parent?.name || parent?.displayName || '-',
        studentEmailDisplay: row.email || user.email || '-',
        madrasaNameDisplay: row.madrasaName || madrasa?.name || '-',
        courseNameDisplay: row.courseName || course?.name || '-',
        classNameDisplay: row.className || cls?.name || '-',
        stageDisplay: row.stageLevel || row.stage || user.stageLevel || user.stage || '-',
        assignedStaffNamesDisplay: row.assignedStaffNames || '-'
      };

      // Automatically resolve any other *Id fields into *NameDisplay
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
    // A safe expression evaluator for functions like CONCAT, SUM, IF, etc.
    // For now, returning empty, will be implemented with a robust parser.
    return '';
  }

  private applyCountAggregation(data: any[], groupByField: string): any[] {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    const firstRows = new Map<string, any>();

    for (const row of data) {
       const key = row[groupByField] || 'Unknown';
       counts.set(key, (counts.get(key) || 0) + 1);
       
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
    // TODO: Implement grouping logic and compute aggregates per group
    return data;
  }

  private applySorting(data: any[], sorting: { key: string, direction: 'asc' | 'desc' }[]): any[] {
    if (sorting.length === 0) return data;

    return data.sort((a, b) => {
      for (const sort of sorting) {
        const valA = a[sort.key];
        const valB = b[sort.key];
        
        if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private updateState(partial: Partial<ReportState>): void {
    this.state.next({ ...this.state.value, ...partial });
  }
}
