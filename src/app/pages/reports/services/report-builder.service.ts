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
      
      let data = await firstValueFrom(this.repo.list<EntityRecord>(definition.collection, profile, [], queryOptions)).catch(() => []);

      // If querying student report and data is sparse, merge with users collection (role: student)
      if (definition.collection === 'students' || definition.category === 'student') {
        const studentUsers = await firstValueFrom(this.repo.list<EntityRecord>('users', profile, [], { roles: ['student'] })).catch(() => []);
        if (studentUsers && studentUsers.length > 0) {
          data = [...data, ...studentUsers];
        }
      }

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

    // 3. Built-in Report Aggregation & Special Reports
    const definition = this.state.value.baseDefinition;
    if (definition?.id === 'monthly-student-movement-strength-report') {
      processed = this.applyMonthlyStudentMovement(processed, this.state.value.filters);
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

      // Comprehensive resolution of assigned teacher / staff names across ALL references
      const teacherTokens = new Set<string>([
        ...extractTokens(row.assignedStaffIds), ...extractTokens(row.assignedStaff), ...extractTokens(row.assignedStaffNames),
        ...extractTokens(row.teacherId), ...extractTokens(row.teacherIds), ...extractTokens(row.teacherName), ...extractTokens(row.teacherNames),
        ...extractTokens(user.assignedStaffIds), ...extractTokens(user.assignedStaff), ...extractTokens(user.assignedStaffNames),
        ...extractTokens(user.teacherId), ...extractTokens(user.teacherIds), ...extractTokens(user.teacherName), ...extractTokens(user.teacherNames),
        ...extractTokens(matchingStaffDoc.assignedStaffIds), ...extractTokens(matchingStaffDoc.assignedStaff),
        ...extractTokens(cls['assignedStaffIds']), ...extractTokens(cls['assignedStaff']), ...extractTokens(cls['staffIds']), ...extractTokens(cls['teacherIds']),
        ...extractTokens(cls['assignedStaffNames']), ...extractTokens(cls['teacherName'])
      ]);

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
      }

      // Fallback search by specific studentClassId ONLY if matchedGroupDocs is empty
      const studentClassId = String(classId || '').trim().toLowerCase();
      if (matchedGroupDocs.length === 0 && studentClassId && allClassGroups.length > 0) {
        allClassGroups.forEach((g: any) => {
          const gClassId = String(g.classId || g.class || '').trim().toLowerCase();
          if (gClassId === studentClassId) {
            extractTokens(g.assignedStaffIds).forEach(t => teacherTokens.add(t));
            extractTokens(g.assignedStaff).forEach(t => teacherTokens.add(t));
            extractTokens(g.staffIds).forEach(t => teacherTokens.add(t));
            extractTokens(g.teacherIds).forEach(t => teacherTokens.add(t));
            extractTokens(g.assignedStaffNames).forEach(t => teacherTokens.add(t));
            extractTokens(g.teacherNames).forEach(t => teacherTokens.add(t));
          }
        });
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
        const uObj = refs.users?.get(tok) || refs.users?.get(cleanTok);
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
      for (const sort of sorting) {
        const valA = a[sort.key];
        const valB = b[sort.key];
        
        if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private applyMonthlyStudentMovement(data: any[], filters: any[]): any[] {
    // 1. Determine Target Month & Year from filters or current date
    const monthFilter = filters?.find(f => f.fieldKey === 'month' || f.fieldKey === 'admissionDateRange' || f.fieldKey === 'dateRange');
    let targetYear = new Date().getFullYear();
    let targetMonth = new Date().getMonth(); // 0-indexed (0 = Jan, 7 = Aug)

    if (monthFilter && monthFilter.value1) {
      const valStr = String(monthFilter.value1).trim();
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

  private updateState(partial: Partial<ReportState>): void {
    this.state.next({ ...this.state.value, ...partial });
  }
}
