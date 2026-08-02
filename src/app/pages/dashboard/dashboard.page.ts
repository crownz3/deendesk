import { Component } from '@angular/core';
import { combineLatest, map, of, switchMap, catchError, Observable, BehaviorSubject } from 'rxjs';
import { where, documentId } from 'firebase/firestore';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ROLE_LABELS } from '../../core/constants/defaults';
import { AppUser, AttendanceRecord, NotificationItem, ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { SetupMapService, SetupMapStep } from '../../core/services/setup-map.service';
import { DataManagementService, ALL_COLLECTION_OPTIONS, QUICK_ACTIONS, CollectionOption } from '../../core/services/data-management.service';
import { NameResolverService, ResolvableType } from '../../core/services/name-resolver.service';
import { BulkDeleteConfirmDialogComponent } from '../../shared/components/bulk-delete-confirm-dialog/bulk-delete-confirm-dialog.component';
import { BulkDeleteProgressDialogComponent } from '../../shared/components/bulk-delete-progress-dialog/bulk-delete-progress-dialog.component';
import { HelpGuideDialogComponent } from '../../shared/components/help-guide-dialog/help-guide-dialog.component';

interface DashboardStat {
  label: string;
  value: number | string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
}

interface ChartSlice {
  label: string;
  value: number;
  percent: number;
}

interface AccessAction {
  label: string;
  link: string;
  icon: string;
}

interface AccessCard {
  title: string;
  titleId?: string;
  titleType?: ResolvableType;
  subtitle?: string;
  subtitleId?: string;
  subtitleType?: ResolvableType;
  icon?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
  items: { label: string; value: string | number }[];
  actions: AccessAction[];
}

interface AccessOverview {
  title: string;
  emptyState?: { icon: string; title: string; message: string };
  cards: AccessCard[];
}

export interface AssignedAssignmentDetail {
  groupId?: string;
  groupName: string;
  classId?: string;
  className: string;
  courseId?: string;
  courseName: string;
  madrasaId?: string;
  madrasaName: string;
}

interface DashboardVm {
  displayName: string;
  formattedRole: string;
  roleTitle: string;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  organizationId?: string;
  madrasaIds?: string[];
  assignedAssignments?: AssignedAssignmentDetail[];
  stats: DashboardStat[];
  courseDistribution: ChartSlice[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    total: number;
    rate: number;
  };
  notifications: NotificationItem[];
  usersByRole: ChartSlice[];
  setupSteps: SetupMapStep[];
  accessOverview?: AccessOverview;
  todaySchedule: (EntityRecord & TimetableEntry & { classId?: string | null })[];
  profile: AppUser;
  _rawData?: Record<string, any[]>;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  showMadrasaDetails = false;
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  setStatusFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.statusFilter = filter;
  }

  isEntityActive(record: any): boolean {
    if (!record) return true;
    const status = String(record['status'] || record['state'] || '').toLowerCase();
    if (['inactive', 'disabled', 'suspended', 'archived', 'closed', 'deleted'].includes(status)) return false;
    if (record['isActive'] === false || record['enabled'] === false || record['isDeleted'] === true) return false;
    return true;
  }

  getFilteredStats(vm: DashboardVm | null): DashboardStat[] {
    if (!vm || !vm.stats) return [];
    if (this.statusFilter === 'all') return vm.stats;

    const rawData = vm._rawData || {};
    const filteredData: Record<string, EntityRecord[]> = {};

    Object.keys(rawData).forEach(key => {
      const items = Array.isArray(rawData[key]) ? rawData[key] : [];
      filteredData[key] = items.filter(item => {
        const isActive = this.isEntityActive(item);
        return this.statusFilter === 'active' ? isActive : !isActive;
      });
    });

    return this.statsForRole(vm.profile.role, filteredData);
  }

  getCounts(filter: 'all' | 'active' | 'inactive', vm: DashboardVm | null): number {
    if (!vm) return 0;
    const rawData = vm._rawData || {};
    const students = Array.isArray(rawData['students']) ? rawData['students'] : [];

    if (filter === 'all') return students.length;
    if (filter === 'active') return students.filter(r => this.isEntityActive(r)).length;
    return students.filter(r => !this.isEntityActive(r)).length;
  }

  toggleMadrasaDetails(): void {
    this.showMadrasaDetails = !this.showMadrasaDetails;
  }

  readonly vm$ = combineLatest([this.refresh$, this.auth.profile$]).pipe(
    switchMap(([_, profile]) => {
      if (!profile) {
        return of(null);
      }

      if (profile.role === 'teacher') {
        return this.loadTeacherData(profile).pipe(
          map(data => this.buildDashboardVm(profile, data))
        );
      }

      return combineLatest({
        organizations: this.repo.list<EntityRecord>('organizations', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        madrasas: this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        users: this.repo.list<EntityRecord>('users', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        students: this.repo.list<EntityRecord>('students', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        courses: this.repo.list<EntityRecord>('courses', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        classes: this.repo.list<EntityRecord>('classes', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        classGroups: this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        subjects: this.repo.list<EntityRecord>('subjects', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        attendance: this.repo.list<AttendanceRecord & EntityRecord>('attendance', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        notifications: this.repo.list<NotificationItem & EntityRecord>('notifications', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        timetableEntries: this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', profile).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
      }).pipe(
        map((rawData) => this.buildDashboardVm(profile, rawData))
      );
    }),
  );

  private loadTeacherData(profile: AppUser): Observable<Record<string, any[]>> {
    // 1. Fetch assigned classes & timetable entries
    const classes$ = this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([])));
    const classGroups$ = this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(() => of([])));
    const timetable$ = this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', profile).pipe(catchError(() => of([])));
    const subjects$ = this.repo.list<EntityRecord>('subjects', profile).pipe(catchError(() => of([])));
    const notifications$ = this.repo.list<NotificationItem & EntityRecord>('notifications', profile).pipe(catchError(() => of([])));
    const attendance$ = this.repo.list<AttendanceRecord & EntityRecord>('attendance', profile).pipe(catchError(() => of([])));
    const users$ = this.repo.list<EntityRecord>('users', profile).pipe(catchError(() => of([])));
    
    return combineLatest({
      classes: classes$,
      classGroups: classGroups$,
      timetableEntries: timetable$,
      subjects: subjects$,
      notifications: notifications$,
      attendance: attendance$,
      users: users$
    }).pipe(
      switchMap((initialData) => {
        // Extract classPlanIds from timetable entries
        const classPlanIds = [...new Set(initialData.timetableEntries.map(e => e.classPlanId).filter(Boolean))];
        
        // Chunk requests for classPlans
        const planChunks = classPlanIds.length > 0 ? this.chunkArray(classPlanIds, 10) : [];
        const planObs = planChunks.length > 0 ? planChunks.map(chunk => 
          this.repo.list<EntityRecord & ClassPlan>('classPlans', profile, [where(documentId(), 'in', chunk)]).pipe(catchError(() => of([])))
        ) : [of([])];
        
        return combineLatest(planObs).pipe(
          map(results => results.flat()),
          switchMap(classPlans => {
            const courseIds = [...new Set([...classPlans.map(p => p.courseId), ...initialData.classes.map(c => c['courseId'])])].filter(Boolean);
            const madrasaIds = [...new Set([...(profile.madrasaIds || []), ...classPlans.map(p => p.madrasaId), ...initialData.classes.map(c => c['madrasaId'])])].filter(Boolean);
            const classIds = [...new Set([...classPlans.map(p => p.classId), ...initialData.classes.map(c => c.id)])].filter(Boolean);
            const groupIds = [...new Set(classPlans.map(p => p.groupId))].filter(Boolean);
            
            const reqs: any = { classPlans: of(classPlans) };
            
            if (courseIds.length > 0) {
              const chunks = this.chunkArray(courseIds, 10);
              reqs.courses = combineLatest(chunks.map(chunk => this.repo.list<EntityRecord>('courses', profile, [where(documentId(), 'in', chunk)]).pipe(catchError(() => of([]))))).pipe(map(r => r.flat()));
            } else reqs.courses = of([]);
            
            if (madrasaIds.length > 0) {
              const chunks = this.chunkArray(madrasaIds, 10);
              reqs.madrasas = combineLatest(chunks.map(chunk => this.repo.list<EntityRecord>('madrasas', profile, [where(documentId(), 'in', chunk)]).pipe(catchError(() => of([]))))).pipe(map(r => r.flat()));
            } else reqs.madrasas = of([]);
            
            if (classIds.length > 0) {
              const chunks = this.chunkArray(classIds, 10);
              reqs.studentsByClass = combineLatest(chunks.map(chunk => this.repo.list<EntityRecord>('students', profile, [where('classId', 'in', chunk)]).pipe(catchError(() => of([]))))).pipe(map(r => r.flat()));
            } else reqs.studentsByClass = of([]);
            
            if (groupIds.length > 0) {
              const chunks = this.chunkArray(groupIds, 10);
              reqs.studentsByGroup = combineLatest(chunks.map(chunk => this.repo.list<EntityRecord>('students', profile, [where('groupId', 'in', chunk)]).pipe(catchError(() => of([]))))).pipe(map(r => r.flat()));
            } else reqs.studentsByGroup = of([]);
            
            return combineLatest(reqs).pipe(
              map((fetched: any) => {
                const allStudents = [...fetched.studentsByClass, ...fetched.studentsByGroup];
                const uniqueStudents = Array.from(new Map(allStudents.map((s: any) => [s.id, s])).values());
                return {
                  ...initialData,
                  classPlans: fetched.classPlans,
                  courses: fetched.courses,
                  madrasas: fetched.madrasas,
                  students: uniqueStudents,
                  organizations: [] // Teachers don't need full org data for stats
                };
              })
            );
          })
        );
      })
    );
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private buildDashboardVm(profile: AppUser, rawData: Record<string, any[]>): DashboardVm {
    const allUsers = rawData['users'] || [];
    const studentCollection = rawData['students'] || [];

    // System/staff users (exclude student login accounts so students are not double-counted under Users)
    const nonStudentUsers = allUsers.filter(u => u['role'] !== 'student');

    console.log('[Dashboard Counts Debug Console]', {
      userRole: profile.role,
      userOrgId: profile.organizationId,
      studentsCount: studentCollection.length,
      rawUsersCount: allUsers.length,
      usersCount_non_students: nonStudentUsers.length,
    });

    const data: Record<string, any[]> = {
      ...rawData,
      users: nonStudentUsers,
      coordinators: allUsers.filter(u => u['role'] === 'coordinator'),
      incharges: allUsers.filter(u => u['role'] === 'madrasaIncharge'),
      staff: allUsers.filter(u => u['role'] === 'teacher' || u['role'] === 'staff'),
      students: studentCollection,
      parents: allUsers.filter(u => u['role'] === 'parent'),
    };
    const stats = this.statsForRole(profile.role, data);
    const attendance = this.attendanceSummary(data['attendance'] || []);
    const courseDistribution = this.distribution(data['students'], 'courseName', data['courses'], 'courseId');
    const usersByRole = this.distribution(data['users'], 'role');
    
    const rawCounts: Record<string, number> = {
      organizations: (data['organizations'] || []).length,
      madrasas: (data['madrasas'] || []).length,
      users: (data['users'] || []).length,
      students: (data['students'] || []).length,
      parents: (data['parents'] || []).length,
      staff: (data['staff'] || []).length,
      courses: (data['courses'] || []).length,
      classes: (data['classes'] || []).length,
      subjects: (data['subjects'] || []).length,
      attendance: (data['attendance'] || []).length,
    };
    
    const setupSteps = this.setupMap.getStepsForUser(profile, rawCounts);
    const accessOverview = this.buildAccessOverview(profile, data);
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = days[new Date().getDay()];
    const classPlans = data['classPlans'] || [];
    const myClassPlanIds = classPlans.map((p: any) => p.id);
    const allTimetableEntries = (data['timetableEntries'] || []) as (EntityRecord & TimetableEntry)[];
    
    let todaySchedule = allTimetableEntries
      .filter(e => e.dayOfWeek === todayDayName && myClassPlanIds.includes(e.classPlanId));

    if (profile.role === 'teacher') {
      const profileIds = [profile.uid, profile.id, profile.entityId, profile.email].map(id => String(id || '')).filter(Boolean);
      const myClasses = (data['classGroups'] || [])
        .filter((group: any) => {
          const staffIds = Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'].map(String) : [];
          const teacherUids = Array.isArray(group['teacherUids']) ? group['teacherUids'].map(String) : [];
          return profileIds.some(id => staffIds.includes(id) || teacherUids.includes(id));
        })
        .map((group: any) => group['classId'])
        .filter(Boolean);

      todaySchedule = todaySchedule.filter(e => {
        const isActivityTeacher = e.teacherId === profile.uid || (Array.isArray(e.teacherIds) && e.teacherIds.includes(profile.uid));
        if (isActivityTeacher) return true;

        const plan = classPlans.find((p: any) => p.id === e.classPlanId);
        if (plan && myClasses.includes(plan.classId) && !e.teacherId && (!e.teacherIds || e.teacherIds.length === 0)) {
          return true;
        }
        return false;
      });
    }

    const finalSchedule = todaySchedule.map(e => {
        const plan = classPlans.find((p: any) => p.id === e.classPlanId);
        return { ...e, classId: plan ? plan.classId : null };
      });
    finalSchedule.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    const profileIds = [profile.uid, profile.id, profile.entityId, profile.email].map(id => String(id || '')).filter(Boolean);
    const classGroupsList = (data['classGroups'] || []) as EntityRecord[];
    const classesList = (data['classes'] || []) as EntityRecord[];
    const coursesList = (data['courses'] || []) as EntityRecord[];
    const madrasasList = (data['madrasas'] || []) as EntityRecord[];

    const assignedGroupEntities = classGroupsList.filter((group: any) => {
      const staffIds = Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'].map(String) : [];
      const teacherUids = Array.isArray(group['teacherUids']) ? group['teacherUids'].map(String) : [];
      return profileIds.some(id => staffIds.includes(id) || teacherUids.includes(id));
    });

    let assignedAssignments: AssignedAssignmentDetail[] = [];

    if (assignedGroupEntities.length > 0) {
      assignedAssignments = assignedGroupEntities.map((group: any) => {
        const classObj = classesList.find((c) => c.id === group.classId);
        const courseId = group.courseId || classObj?.['courseId'];
        const courseObj = coursesList.find((c) => c.id === courseId);
        const madrasaId = classObj?.['madrasaId'] || courseObj?.['madrasaId'] || group['madrasaId'] || profile.madrasaId;
        const madrasaObj = madrasasList.find((m) => m.id === madrasaId);

        return {
          groupId: group.id,
          groupName: group['name'] || group['title'] || 'Class Group',
          classId: group.classId,
          className: classObj?.['name'] || 'Class',
          courseId,
          courseName: courseObj?.['name'] || 'Course',
          madrasaId,
          madrasaName: madrasaObj?.['name'] || 'Madrasa',
        };
      });
    } else {
      const madrasaIds = Array.isArray(profile.madrasaIds) && profile.madrasaIds.length > 0
        ? profile.madrasaIds
        : (profile.madrasaId ? [profile.madrasaId] : []);

      assignedAssignments = madrasaIds.map((mId) => {
        const madrasaObj = madrasasList.find((m) => m.id === mId);
        return {
          groupName: 'General Assignment',
          className: 'All Classes',
          courseName: 'All Courses',
          madrasaId: mId,
          madrasaName: madrasaObj?.['name'] || 'Madrasa',
        };
      });
    }

    return {
      displayName: this.getDisplayName(profile),
      formattedRole: this.formatRole(profile.role),
      roleTitle: ROLE_LABELS[profile.role],
      isSuperAdmin: profile.role === 'superAdmin',
      isOrgAdmin: profile.role === 'organizationAdmin',
      organizationId: profile.organizationId,
      madrasaIds: Array.isArray(profile.madrasaIds) && profile.madrasaIds.length > 0 ? profile.madrasaIds : (profile.madrasaId ? [profile.madrasaId] : []),
      assignedAssignments,
      stats,
      attendance,
      courseDistribution,
      usersByRole,
      notifications: (data['notifications'] || []).slice(0, 5),
      setupSteps,
      accessOverview,
      todaySchedule: finalSchedule,
      profile,
      _rawData: data
    };
  }

  currentCardIndex = 0;

  // ── Data Management State ──────────────────────────────────────────────────
  readonly allCollectionOptions: CollectionOption[] = ALL_COLLECTION_OPTIONS;
  readonly quickActions = QUICK_ACTIONS;
  readonly selectedCollections = new Set<string>();

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly setupMap: SetupMapService,
    private readonly dataMgmt: DataManagementService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    public readonly resolver: NameResolverService
  ) {}

  openHelpGuide(): void {
    this.dialog.open(HelpGuideDialogComponent, {
      width: '95vw',
      maxWidth: '850px',
      maxHeight: '92vh',
      panelClass: 'help-guide-dialog-panel'
    });
  }

  // ── Data Management Methods ────────────────────────────────────────────────

  isCollectionSelected(key: string): boolean {
    return this.selectedCollections.has(key);
  }

  toggleCollection(key: string): void {
    if (this.selectedCollections.has(key)) {
      this.selectedCollections.delete(key);
    } else {
      this.selectedCollections.add(key);
    }
  }

  selectAllCollections(): void {
    this.allCollectionOptions.forEach(o => this.selectedCollections.add(o.key));
  }

  clearAllCollections(): void {
    this.selectedCollections.clear();
  }

  get selectedCount(): number {
    return this.selectedCollections.size;
  }

  get hasSelections(): boolean {
    return this.selectedCollections.size > 0;
  }

  applyQuickAction(keys: string[]): void {
    this.selectedCollections.clear();
    keys.forEach(k => this.selectedCollections.add(k));
    this.openDeleteConfirm();
  }

  openDeleteConfirm(): void {
    if (!this.hasSelections) return;

    const selectedOptions = this.allCollectionOptions.filter(o =>
      this.selectedCollections.has(o.key)
    );

    const confirmRef = this.dialog.open(BulkDeleteConfirmDialogComponent, {
      data: { selectedOptions },
      panelClass: 'bulk-delete-confirm-panel',
      disableClose: true,
    });

    confirmRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.executeDelete(selectedOptions);
      }
    });
  }

  private executeDelete(selectedOptions: CollectionOption[]): void {
    const progressRef = this.dialog.open(BulkDeleteProgressDialogComponent, {
      data: { selectedOptions },
      panelClass: 'bulk-delete-progress-panel',
      disableClose: true,
      width: '640px',
    });

    progressRef.afterClosed().subscribe((summary) => {
      this.selectedCollections.clear();
      if (summary) {
        const failed = Object.values(summary.results || {}).filter((r: any) => r.failed > 0).length;
        if (failed === 0) {
          this.snackBar.open(`✅ Deletion complete — ${summary.totalDocs} documents removed`, 'Dismiss', { duration: 5000 });
        } else {
          this.snackBar.open(`⚠️ Completed with ${failed} failure(s). Check the summary.`, 'Dismiss', { duration: 7000 });
        }
      }
    });
  }

  nextCard(totalCards: number) {
    if (this.currentCardIndex < totalCards - 1) {
      this.currentCardIndex++;
    }
  }

  prevCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
    }
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  trackByNotification(_: number, item: NotificationItem): string {
    return String(item.id ?? item.title);
  }

  private statsForRole(role: string, data: Record<string, EntityRecord[]>): DashboardStat[] {
    const allStats: DashboardStat[] = [
      { label: 'Organizations', value: data['organizations']?.length ?? 0, icon: 'business-outline', tone: 'success' },
      { label: 'Madrasas', value: data['madrasas']?.length ?? 0, icon: 'school-outline', tone: 'primary' },
      { label: 'Users', value: data['users']?.length ?? 0, icon: 'people-outline', tone: 'warning' },
      { label: 'Coordinators', value: data['coordinators']?.length ?? 0, icon: 'star-outline', tone: 'primary' },
      { label: 'Madrasa Incharges', value: data['incharges']?.length ?? 0, icon: 'shield-checkmark-outline', tone: 'success' },
      { label: 'Students', value: data['students']?.length ?? 0, icon: 'person-outline', tone: 'success' },
      { label: 'Parents', value: data['parents']?.length ?? 0, icon: 'people-circle-outline', tone: 'primary' },
      { label: 'Staff', value: data['staff']?.length ?? 0, icon: 'briefcase-outline', tone: 'warning' },
      { label: 'Courses', value: data['courses']?.length ?? 0, icon: 'library-outline', tone: 'success' },
      { label: 'Classes', value: data['classes']?.length ?? 0, icon: 'easel-outline', tone: 'primary' },
      { label: 'Subjects', value: data['subjects']?.length ?? 0, icon: 'book-outline', tone: 'warning' },
      { label: 'Notifications', value: data['notifications']?.length ?? 0, icon: 'notifications-outline', tone: 'danger' },
    ];

    if (role === 'superAdmin') {
      return allStats;
    }

    if (role === 'organizationAdmin') {
      return allStats.filter(s => s.label !== 'Organizations');
    }

    if (role === 'coordinator') {
      return allStats.filter(s => ['Madrasa Incharges', 'Students', 'Parents', 'Staff', 'Courses', 'Classes', 'Subjects', 'Notifications'].includes(s.label));
    }

    if (role === 'madrasaIncharge') {
      return allStats.filter(s => ['Students', 'Parents', 'Staff', 'Courses', 'Classes', 'Subjects', 'Notifications'].includes(s.label));
    }

    if (role === 'teacher' || role === 'staff') {
      return allStats.filter(s => ['Students', 'Classes', 'Subjects', 'Notifications'].includes(s.label));
    }

    if (role === 'student' || role === 'parent') {
      return allStats.filter(s => ['Students', 'Courses', 'Classes', 'Notifications'].includes(s.label));
    }

    return [];
  }

  private attendanceSummary(records: AttendanceRecord[]): DashboardVm['attendance'] {
    const present = records.filter((record) => record.status === 'present').length;
    const absent = records.filter((record) => record.status === 'absent').length;
    const late = records.filter((record) => record.status === 'late').length;
    const leave = records.filter((record) => record.status === 'leave').length;
    const total = records.length;
    return {
      present,
      absent,
      late,
      leave,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  private distribution(rows: EntityRecord[], fallbackKey: string, lookupRows: EntityRecord[] = [], lookupField = ''): ChartSlice[] {
    const lookup = new Map(lookupRows.map((row) => [String(row.id), String(row['name'] ?? row.id)]));
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      const raw = lookupField ? row[lookupField] : row[fallbackKey];
      const label = lookup.get(String(raw)) || String(raw || 'Unassigned');
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, percent: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }

  private getDisplayName(user: AppUser | null): string {
    if (!user) return 'User';

    if (user.displayName?.trim()) {
      return user.displayName.trim();
    }

    if (user.email?.includes('@')) {
      return user.email.split('@')[0];
    }

    return 'User';
  }

  private formatRole(role: string | null | undefined): string {
    if (!role) return 'User';

    const normalized = role.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    
    return normalized
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private buildAccessOverview(profile: AppUser, data: Record<string, EntityRecord[]>): AccessOverview | undefined {
    if (profile.role === 'superAdmin') {
      return undefined;
    }

    if (profile.role === 'organizationAdmin') {
      const orgId = profile.organizationId;
      const org = data['organizations'].find((o) => o.id === orgId);
      
      if (!org) {
        return {
          title: 'My Organization Overview',
          emptyState: { icon: 'business-outline', title: 'No organization mapped', message: 'Please contact support to link your account to an organization.' },
          cards: []
        };
      }

      return {
        title: 'My Organization Overview',
        cards: [
          {
            title: (org['name'] as string) || 'Unknown Organization',
            subtitle: (org['address'] as string) || 'Address not provided',
            icon: 'business-outline',
            tone: 'success',
            items: [
              { label: 'Madrasas', value: data['madrasas'].length },
              { label: 'Staff', value: data['staff'].length },
              { label: 'Students', value: data['students'].length },
              { label: 'Classes', value: data['classes'].length },
            ],
            actions: [
              { label: 'View Madrasas', link: '/madrasas', icon: 'school-outline' },
              { label: 'View Staff', link: '/staff', icon: 'briefcase-outline' },
              { label: 'View Students', link: '/students', icon: 'person-outline' },
            ]
          }
        ]
      };
    }

    if (profile.role === 'coordinator') {
      const assignedIds = profile.madrasaIds || [];
      const assignedMadrasas = data['madrasas'].filter(m => assignedIds.includes(m.id!));

      if (assignedMadrasas.length === 0) {
        return {
          title: 'My Assigned Madrasas',
          emptyState: { icon: 'school-outline', title: 'No madrasas assigned yet', message: 'Please contact your organization admin to assign madrasas to your coordinator account.' },
          cards: []
        };
      }

      const cards = assignedMadrasas.map(m => {
        let inchargeName = 'Not mapped';
        const inchargeIds = (m['inchargeIds'] as string[]) || [];
        if (inchargeIds.length > 0) {
          const incharges = data['users'].filter(u => inchargeIds.includes(u.id!) && u['role'] === 'madrasaIncharge');
          if (incharges.length > 0) {
            inchargeName = incharges.map(u => u['displayName'] || (u['email'] as string)?.split('@')[0] || 'Unknown').join(', ');
          }
        }

        const mId = m.id!;
        const staffCount = data['staff'].filter(s => Array.isArray(s['madrasaIds']) && s['madrasaIds'].includes(mId)).length;
        const studentCount = data['students'].filter(s => s['madrasaId'] === mId).length;
        const classCount = data['classes'].filter(c => c['madrasaId'] === mId).length;
        const subjectCount = data['subjects'].filter(s => s['madrasaId'] === mId).length;

        return {
          title: (m['name'] as string) || 'Unknown Madrasa',
          subtitle: (m['address'] as string) || 'Address not provided',
          icon: 'school-outline',
          tone: 'primary',
          items: [
            { label: 'Incharge', value: inchargeName },
            { label: 'Staff', value: staffCount },
            { label: 'Students', value: studentCount },
            { label: 'Classes', value: classCount },
            { label: 'Subjects', value: subjectCount },
            { label: 'Status', value: m.status === 'active' ? 'Active' : 'Inactive' },
          ],
          actions: [
            { label: 'View Madrasa', link: '/madrasas', icon: 'school-outline' },
            { label: 'View Students', link: '/students', icon: 'person-outline' },
            { label: 'View Staff', link: '/staff', icon: 'briefcase-outline' },
            { label: 'View Classes', link: '/classes', icon: 'easel-outline' },
            { label: 'View Subjects', link: '/subjects', icon: 'book-outline' },
            { label: 'Take Attendance', link: '/attendance', icon: 'checkmark-circle-outline' },
          ]
        } as AccessCard;
      });

      return { title: 'My Assigned Madrasas', cards };
    }

    if (profile.role === 'madrasaIncharge') {
      const assignedIds = profile.madrasaIds || [];
      const assignedMadrasas = data['madrasas'].filter(m => assignedIds.includes(m.id!));

      if (assignedMadrasas.length === 0) {
        return {
          title: 'My Madrasa Overview',
          emptyState: { icon: 'school-outline', title: 'No madrasas assigned yet', message: 'Please contact your organization admin to assign madrasas to your account.' },
          cards: []
        };
      }

      const cards = assignedMadrasas.map(m => {
        const mId = m.id!;
        const staffCount = data['staff'].filter(s => Array.isArray(s['madrasaIds']) && s['madrasaIds'].includes(mId)).length;
        const studentCount = data['students'].filter(s => s['madrasaId'] === mId).length;
        const classCount = data['classes'].filter(c => c['madrasaId'] === mId).length;
        const subjectCount = data['subjects'].filter(s => s['madrasaId'] === mId).length;

        return {
          title: (m['name'] as string) || 'Unknown Madrasa',
          subtitle: (m['address'] as string) || 'Address not provided',
          icon: 'school-outline',
          tone: 'primary',
          items: [
            { label: 'Staff', value: staffCount },
            { label: 'Students', value: studentCount },
            { label: 'Classes', value: classCount },
            { label: 'Subjects', value: subjectCount },
          ],
          actions: [
            { label: 'View Students', link: '/students', icon: 'person-outline' },
            { label: 'View Staff', link: '/staff', icon: 'briefcase-outline' },
            { label: 'View Classes', link: '/classes', icon: 'easel-outline' },
            { label: 'Take Attendance', link: '/attendance', icon: 'checkmark-circle-outline' },
          ]
        } as AccessCard;
      });

      return { title: 'My Madrasa Overview', cards };
    }

    if (profile.role === 'teacher') {
      return undefined;
    }

    if (profile.role === 'student') {
      const me = data['students'].find(s => s['userId'] === profile.uid) || data['students'][0];
      if (!me) {
        return {
          title: 'My Learning Overview',
          emptyState: { icon: 'book-outline', title: 'No student record found', message: 'Your student profile is missing or incomplete.' },
          cards: []
        };
      }
      const classId = me['classId'];
      const myClass = classId ? data['classes'].find(c => c.id === classId) : null;
      const madrasaId = me['madrasaId'] || myClass?.['madrasaId'];
      const myMadrasa = madrasaId ? data['madrasas'].find(m => m.id === madrasaId) : null;
      const courseId = me['courseId'] || myClass?.['courseId'];
      const myCourse = courseId ? data['courses'].find(c => c.id === courseId) : null;

      return {
        title: 'My Learning Overview',
        cards: [
          {
            title: (me['name'] as string) || profile.displayName || 'Student Profile',
            subtitleId: madrasaId,
            subtitleType: 'madrasa',
            icon: 'book-outline',
            tone: 'success',
            items: [
              { label: 'Class', value: (myClass?.['name'] as string) || 'Not mapped' },
              { label: 'Course', value: (myCourse?.['name'] as string) || 'Not mapped' },
            ],
            actions: [
              { label: 'View Attendance', link: '/attendance', icon: 'calendar-outline' }
            ]
          }
        ]
      };
    }

    if (profile.role === 'parent') {
      const children = data['students'];

      if (children.length === 0) {
        return {
          title: 'My Children Overview',
          emptyState: { icon: 'people-circle-outline', title: 'No linked children', message: 'No student accounts are currently linked to your profile.' },
          cards: []
        };
      }

      const cards = children.map(s => {
        const cId = s['classId'];
        const myClass = cId ? data['classes'].find(c => c.id === cId) : null;
        const mId = s['madrasaId'] || myClass?.['madrasaId'];
        const myMadrasa = mId ? data['madrasas'].find(m => m.id === mId) : null;
        
        return {
          title: (s['name'] as string) || 'Unknown Student',
          subtitleId: mId,
          subtitleType: 'madrasa',
          icon: 'person-outline',
          tone: 'primary',
          items: [
            { label: 'Class', value: (myClass?.['name'] as string) || 'Not mapped' },
          ],
          actions: [
            { label: 'View Attendance', link: '/attendance', icon: 'calendar-outline' }
          ]
        } as AccessCard;
      });

      return { title: 'My Children Overview', cards };
    }

    return undefined;
  }

  refreshData(): void {
    this.repo.clearCache();
    this.refresh$.next();
  }
}
