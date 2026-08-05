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
    classGroups?: any[];
    staffDocs?: any[];
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
      users: new Map(),
      classGroups: []
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
      const [organizations, madrasas, courses, classes, users, classGroups, staffDocs] = await Promise.all([
        this.repo.getAllOnce<any>('organizations', profile).catch(() => []),
        this.repo.getAllOnce<any>('madrasas', profile).catch(() => []),
        this.repo.getAllOnce<any>('courses', profile).catch(() => []),
        this.repo.getAllOnce<any>('classes', profile).catch(() => []),
        this.repo.getAllOnce<any>('users', profile).catch(() => []),
        this.repo.getAllOnce<any>('classGroups', profile).catch(() => []),
        this.repo.getAllOnce<any>('staff', profile).catch(() => [])
      ]);

      const refs = {
        organizations: new Map(organizations.map(o => [o.id, o])),
        madrasas: new Map(madrasas.map(m => [m.id, m])),
        courses: new Map(courses.map(c => [c.id, c])),
        classes: new Map(classes.map(c => [c.id, c])),
        users: new Map(users.map(u => [u.id, u])),
        classGroups: classGroups,
        staffDocs: staffDocs
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
    let processed = this.resolveReferences(rawData);

    // Deduplicate records by unique entity identifier & display signature to prevent duplicate rows in ALL reports
    const seenEntityKeys = new Set<string>();
    const seenDisplaySignatures = new Set<string>();

    processed = processed.filter(item => {
      // 1. Check primary ID / entity ID
      const entityId = item.id || item.uid || item.studentId || item.userId || item.assignmentId || item.transactionId;
      if (entityId) {
        const idKey = `id_${entityId}`;
        if (seenEntityKeys.has(idKey)) return false;
        seenEntityKeys.add(idKey);
      }

      // 2. Check display signature (name + madrasa + class/course + admissionDate/amount + status)
      const name = item.studentNameDisplay || item.name || item.studentName || item.title || '';
      const madrasa = item.madrasaNameDisplay || item.madrasaId || '';
      const cls = item.classNameDisplay || item.classId || item.courseNameDisplay || item.courseId || '';
      const dateVal = item.admissionDate || item.actionDate || item.startDate || item.createdAt || item.amount || '';
      const status = item.status || item.paymentStatus || '';

      if (name) {
        const signature = `${name}___${madrasa}___${cls}___${dateVal}___${status}`.toLowerCase().trim();
        if (seenDisplaySignatures.has(signature)) return false;
        seenDisplaySignatures.add(signature);
      }

      return true;
    });

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
    const allStaffDocs = refs.staffDocs || [];
    const allClassGroups = refs.classGroups || [];

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

      const merged = {
        ...organization,
        ...madrasa,
        ...course,
        ...cls,
        ...user,
        ...row,
        name: resolvedPersonName,
        staffNameDisplay: resolvedPersonName,
        displayName: resolvedPersonName,
        admissionDate: formattedAdmission,
        organizationNameDisplay: row.organizationName || organization?.name || organization?.displayName || '-',
        studentNameDisplay: row.studentName || row.name || user.name || user.displayName || '-',
        fatherNameDisplay: row.fatherName || user.fatherName || '-',
        parentNameDisplay: row.parentName || parent?.name || parent?.displayName || '-',
        studentEmailDisplay: row.email || user.email || '-',
        madrasaNameDisplay: resolvedMadrasaNameDisplay,
        courseNameDisplay: row.courseName || course?.name || '-',
        classNameDisplay: row.className || cls?.name || '-',
        stageDisplay: row.stageLevel || row.stage || user.stageLevel || user.stage || '-',
        assignedStaffNamesDisplay: row.assignedStaffNames || '-',
        assignedClassGroupDisplay: resolvedClassGroupDisplay
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
