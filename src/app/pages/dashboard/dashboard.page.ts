import { Component } from '@angular/core';
import { combineLatest, map, of, switchMap, catchError, Observable, BehaviorSubject, filter, distinctUntilChanged, from, timer } from 'rxjs';
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
import { ConfigureCardsDialogComponent, ConfigureCardsDialogData } from './configure-cards-dialog.component';
import { ClassGroupAttendanceDetailsDialogComponent, ClassGroupAttendanceDetailsDialogData, StudentAttendanceDetailRecord } from './class-group-attendance-details-dialog.component';

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

export interface ClassGroupAttendanceStatus {
  groupId: string;
  groupName: string;
  classId?: string;
  className: string;
  madrasaId: string;
  madrasaName: string;
  isTaken: boolean;
  takenByName?: string;
  takenAtText?: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  totalStudents: number;
  assignedStaffName?: string;
}

export interface TodayAttendanceOverview {
  dateStr: string;
  formattedDate: string;
  totalGroups: number;
  takenGroupsCount: number;
  pendingGroupsCount: number;
  completionRate: number;
  presentTotal: number;
  absentTotal: number;
  lateTotal: number;
  leaveTotal: number;
  totalStudentsRecorded: number;
  overallPresentPercentage: number;
  groupStatuses: ClassGroupAttendanceStatus[];
  madrasaBreakdown?: {
    madrasaId: string;
    madrasaName: string;
    totalGroups: number;
    takenGroups: number;
    pendingGroups: number;
  }[];
}

export interface GroupedMadrasaAttendance {
  madrasaId: string;
  madrasaName: string;
  totalGroups: number;
  takenGroups: number;
  pendingGroups: number;
  groupStatuses: ClassGroupAttendanceStatus[];
}

export interface EnhancedCourseSlice {
  courseId: string;
  courseName: string;
  studentCount: number;
  staffCount: number;
  classGroupCount: number;
  studentPercent: number;
  studentTeacherRatio: string;
  todayAttendanceRate?: number;
}

export interface WeeklyAttendanceTrendPoint {
  dayName: string;
  shortDay: string;
  dateStr: string;
  presentCount: number;
  totalCount: number;
  rate: number;
}

export interface AttendanceRiskStudent {
  studentId: string;
  name: string;
  madrasaName: string;
  className: string;
  groupName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  rate: number;
  riskLevel: 'high' | 'critical';
}

export interface MadrasaCapacitySlice {
  madrasaId: string;
  madrasaName: string;
  enrolledStudents: number;
  capacity: number;
  percentFull: number;
  status: 'available' | 'near-full' | 'at-capacity';
}

export interface TeacherWorkloadSlice {
  teacherId: string;
  teacherName: string;
  email?: string;
  assignedGroupCount: number;
  assignedStudentCount: number;
  assignedClassNames: string[];
  workloadLevel: 'Light' | 'Optimal' | 'High Load';
}

export interface DashboardMadrasaRoleBreakdown {
  madrasaId: string;
  madrasaName: string;
  role: string;
  roleLabel: string;
}

interface DashboardVm {
  displayName: string;
  formattedRole: string;
  roleTitle: string;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isMadrasaIncharge: boolean;
  isCoordinator: boolean;
  isStaff: boolean;
  organizationId?: string;
  madrasaIds?: string[];
  inchargeMadrasaNames?: string[];
  inchargeMadrasasText?: string;
  madrasaRolesBreakdown?: DashboardMadrasaRoleBreakdown[];
  assignedAssignments?: AssignedAssignmentDetail[];
  stats: DashboardStat[];
  courseDistribution: ChartSlice[];
  enhancedCourseDistribution: EnhancedCourseSlice[];
  weeklyAttendanceTrend?: WeeklyAttendanceTrendPoint[];
  attendanceRiskStudents?: AttendanceRiskStudent[];
  madrasaCapacityOverview?: MadrasaCapacitySlice[];
  teacherWorkloadMatrix?: TeacherWorkloadSlice[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    total: number;
    rate: number;
    isToday?: boolean;
  };
  todayAttendance: TodayAttendanceOverview;
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
  visibleCardLabels: string[] | null = null;
  isAttendanceOverviewLoaded = false;
  isAttendanceLoading = false;

  loadAttendanceOverview(): void {
    this.isAttendanceLoading = true;
    this.isAttendanceOverviewLoaded = true;
    this.refresh$.next();
  }

  readonly loadingTimer$: Observable<string> = timer(0, 100).pipe(
    map((t) => (t * 0.1).toFixed(1) + 's')
  );

  private loadVisibleCardLabels(userId: string): string[] | null {
    try {
      const saved = localStorage.getItem(`deendesk_dashboard_visible_cards_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse visible cards preference', e);
    }
    return null;
  }

  private saveVisibleCardLabels(userId: string, labels: string[]): void {
    try {
      localStorage.setItem(`deendesk_dashboard_visible_cards_${userId}`, JSON.stringify(labels));
    } catch (e) {
      console.warn('Failed to save visible cards preference', e);
    }
  }

  selectedMadrasaFilter = '';
  madrasaFilterSearchText = '';
  attendanceStatusTab: 'all' | 'taken' | 'pending' = 'all';
  attendanceSearchQuery = '';
  workloadFilter: 'active' | 'high' | 'optimal' | 'all' = 'active';
  workloadSearchQuery = '';

  setWorkloadFilter(filter: 'active' | 'high' | 'optimal' | 'all'): void {
    this.workloadFilter = filter;
  }

  getFilteredWorkloadMatrix(vm: DashboardVm | null): TeacherWorkloadSlice[] {
    if (!vm || !vm.teacherWorkloadMatrix) return [];
    let list = vm.teacherWorkloadMatrix;

    if (this.workloadFilter === 'high') {
      list = list.filter(t => t.workloadLevel === 'High Load');
    } else if (this.workloadFilter === 'optimal') {
      list = list.filter(t => t.workloadLevel === 'Optimal');
    } else {
      // Only show teachers with active class groups or assigned students
      list = list.filter(t => t.assignedGroupCount > 0 || t.assignedStudentCount > 0);
    }

    if (this.workloadSearchQuery && this.workloadSearchQuery.trim()) {
      const q = this.workloadSearchQuery.trim().toLowerCase();
      list = list.filter(t =>
        (t.teacherName || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.assignedClassNames || []).some(c => (c || '').toLowerCase().includes(q))
      );
    }

    // Return top 5 assigned teachers
    return list.slice(0, 5);
  }

  setSelectedMadrasaFilter(madrasaId: string): void {
    this.selectedMadrasaFilter = madrasaId;
  }

  setAttendanceStatusTab(tab: 'all' | 'taken' | 'pending'): void {
    this.attendanceStatusTab = tab;
  }

  getFilteredMadrasaOptions(vm: DashboardVm | null): TodayAttendanceOverview['madrasaBreakdown'] {
    if (!vm || !vm.todayAttendance || !vm.todayAttendance.madrasaBreakdown) return [];
    const list = vm.todayAttendance.madrasaBreakdown;
    if (!this.madrasaFilterSearchText || !this.madrasaFilterSearchText.trim()) return list;

    const q = this.madrasaFilterSearchText.trim().toLowerCase();
    return list.filter(m => (m.madrasaName || '').toLowerCase().includes(q));
  }

  onMadrasaOptionSelected(selectedVal: string, vm: DashboardVm | null): void {
    const breakdown = vm?.todayAttendance?.madrasaBreakdown || [];
    const match = breakdown.find(m =>
      m.madrasaName === selectedVal || String(m.madrasaId) === String(selectedVal)
    );
    if (match) {
      this.selectedMadrasaFilter = match.madrasaId;
      this.madrasaFilterSearchText = match.madrasaName;
    } else {
      this.selectedMadrasaFilter = selectedVal;
    }
  }

  getFilteredGroupStatuses(vm: DashboardVm | null): ClassGroupAttendanceStatus[] {
    if (!vm || !vm.todayAttendance || !vm.todayAttendance.groupStatuses) return [];

    let list = vm.todayAttendance.groupStatuses;

    // Filter by Madrasa if a specific madrasa filter is active (and not 'all' or empty)
    if (this.selectedMadrasaFilter && this.selectedMadrasaFilter !== 'all' && this.selectedMadrasaFilter.trim()) {
      const targetFilter = this.selectedMadrasaFilter.trim().toLowerCase();
      const targetSearchText = (this.madrasaFilterSearchText || '').trim().toLowerCase();

      list = list.filter(item => {
        const itemMId = String(item.madrasaId || '').trim().toLowerCase();
        const itemMName = String(item.madrasaName || '').trim().toLowerCase();

        return itemMId === targetFilter ||
               itemMName === targetFilter ||
               (targetSearchText && itemMName.includes(targetSearchText));
      });
    } else if (this.madrasaFilterSearchText && this.madrasaFilterSearchText.trim()) {
      const targetSearchText = this.madrasaFilterSearchText.trim().toLowerCase();
      list = list.filter(item => {
        const itemMName = String(item.madrasaName || '').trim().toLowerCase();
        return itemMName.includes(targetSearchText);
      });
    }

    if (this.attendanceStatusTab === 'taken') {
      list = list.filter(item => item.isTaken);
    } else if (this.attendanceStatusTab === 'pending') {
      list = list.filter(item => !item.isTaken);
    }

    if (this.attendanceSearchQuery && this.attendanceSearchQuery.trim()) {
      const q = this.attendanceSearchQuery.trim().toLowerCase();
      list = list.filter(item => 
        (item.groupName || '').toLowerCase().includes(q) ||
        (item.className || '').toLowerCase().includes(q) ||
        (item.madrasaName || '').toLowerCase().includes(q) ||
        (item.takenByName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }

  getGroupedMadrasaStatuses(vm: DashboardVm | null): GroupedMadrasaAttendance[] {
    const filtered = this.getFilteredGroupStatuses(vm);
    if (!filtered.length) return [];

    const map = new Map<string, GroupedMadrasaAttendance>();

    filtered.forEach(item => {
      const mId = item.madrasaId || 'default';
      if (!map.has(mId)) {
        map.set(mId, {
          madrasaId: mId,
          madrasaName: item.madrasaName || 'Madrasa',
          totalGroups: 0,
          takenGroups: 0,
          pendingGroups: 0,
          groupStatuses: []
        });
      }
      const grp = map.get(mId)!;
      grp.groupStatuses.push(item);
      grp.totalGroups++;
      if (item.isTaken) grp.takenGroups++;
      else grp.pendingGroups++;
    });

    return Array.from(map.values());
  }

  openAttendanceDetailsModal(item: ClassGroupAttendanceStatus, vm: DashboardVm | null): void {
    if (!vm || !item) return;

    const rawData = vm._rawData || {};
    const allStudents = (Array.isArray(rawData['students']) ? rawData['students'] : []) as EntityRecord[];
    const allAttendance = (Array.isArray(rawData['attendance']) ? rawData['attendance'] : []) as EntityRecord[];
    const dateStr = vm.todayAttendance?.dateStr || new Date().toISOString().split('T')[0];

    // Filter students belonging to this class group
    const groupStudents = allStudents.filter(st => {
      if (!this.isEntityActive(st)) return false;
      const gIds = [
        st['groupId'], st['classGroupId'], st['assignedGroupId'], st['group'], st['sectionId'],
        ...(Array.isArray(st['groupIds']) ? st['groupIds'] : []),
        ...(Array.isArray(st['classGroupIds']) ? st['classGroupIds'] : [])
      ].filter(Boolean).map(String);

      if (gIds.includes(String(item.groupId))) return true;
      if (Array.isArray(st['studentIds']) && st['studentIds'].map(String).includes(String(item.groupId))) return true;
      return false;
    });

    // Find attendance record for this group and date
    const attRecord = allAttendance.find(a => {
      const matchGroup = a['groupId'] === item.groupId || a['classGroupId'] === item.groupId || a['classPlanId'] === item.groupId || String(a.id).includes(String(item.groupId));
      if (!matchGroup) return false;
      const recDate = String(a['date'] || a['dateStr'] || a['selectedDate'] || '');
      if (recDate === dateStr || String(a.id).includes(dateStr)) return true;
      return false;
    });

    const recordsMap = (attRecord?.['records'] || attRecord?.['students'] || attRecord?.['attendanceMap'] || {}) as Record<string, any>;

    const studentRecords: StudentAttendanceDetailRecord[] = groupStudents.map(st => {
      const stId = String(st.id || st['uid'] || '');
      const rec = recordsMap[stId] || recordsMap[st['name'] || ''];
      const rawStatus = String(rec?.status || rec || 'unmarked').toLowerCase();
      let status: 'present' | 'absent' | 'late' | 'leave' | 'unmarked' = 'unmarked';
      if (['present', 'p'].includes(rawStatus)) status = 'present';
      else if (['absent', 'a'].includes(rawStatus)) status = 'absent';
      else if (['late', 'l'].includes(rawStatus)) status = 'late';
      else if (['leave', 'excused'].includes(rawStatus)) status = 'leave';

      return {
        studentId: stId,
        studentName: String(st['name'] || st['fullName'] || st['displayName'] || 'Student'),
        rollNumber: String(st['rollNumber'] || st['registerNo'] || st['rollNo'] || ''),
        status,
        note: typeof rec === 'object' && rec?.note ? String(rec.note) : '',
        parentPhone: String(st['phone'] || st['parentPhone'] || st['mobileNumber'] || '')
      };
    });

    const dialogData: ClassGroupAttendanceDetailsDialogData = {
      groupId: item.groupId,
      groupName: item.groupName,
      madrasaName: item.madrasaName,
      className: item.className,
      dateStr,
      takenByName: item.takenByName,
      takenAtText: item.takenAtText,
      presentCount: item.presentCount,
      absentCount: item.absentCount,
      lateCount: item.lateCount,
      leaveCount: item.leaveCount,
      totalStudents: item.totalStudents,
      studentRecords,
      madrasaId: item.madrasaId,
      classId: item.classId
    };

    this.dialog.open(ClassGroupAttendanceDetailsDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'custom-attendance-details-panel',
      data: dialogData
    });
  }

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

    if (this.visibleCardLabels === null && vm.profile?.id) {
      this.visibleCardLabels = this.loadVisibleCardLabels(vm.profile.id);
    }

    let statsList: DashboardStat[] = [];
    if (this.statusFilter === 'all') {
      statsList = vm.stats;
    } else {
      const rawData = vm._rawData || {};
      const filteredData: Record<string, EntityRecord[]> = {};

      Object.keys(rawData).forEach(key => {
        const items = Array.isArray(rawData[key]) ? rawData[key] : [];
        filteredData[key] = items.filter(item => {
          const isActive = this.isEntityActive(item);
          return this.statusFilter === 'active' ? isActive : !isActive;
        });
      });

      statsList = this.statsForRole(vm.profile.role, filteredData, vm.profile);
    }

    if (this.visibleCardLabels !== null) {
      // If stored visibleCardLabels is missing any stat label defined for this role (e.g. stale localStorage from a previous role),
      // reset visibleCardLabels so all cards for the user's current role are displayed.
      const hasMissingRoleCard = statsList.some(s => !this.visibleCardLabels!.includes(s.label));
      if (hasMissingRoleCard) {
        this.visibleCardLabels = statsList.map(s => s.label);
        if (vm.profile?.id) {
          this.saveVisibleCardLabels(vm.profile.id, this.visibleCardLabels);
        }
      }
      return statsList.filter(s => this.visibleCardLabels!.includes(s.label));
    }

    return statsList;
  }

  openConfigureCardsDialog(vm: DashboardVm | null): void {
    if (!vm) return;
    const roleStats = this.statsForRole(vm.profile.role, vm._rawData || {}, vm.profile);
    const allCards = roleStats.map(s => ({ label: s.label, icon: s.icon, tone: s.tone }));

    const currentVisible = this.visibleCardLabels !== null 
      ? this.visibleCardLabels 
      : allCards.map(c => c.label);

    const dialogRef = this.dialog.open(ConfigureCardsDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      panelClass: 'configure-cards-dialog-panel',
      data: {
        allCards,
        visibleLabels: currentVisible,
      } as ConfigureCardsDialogData
    });

    dialogRef.afterClosed().subscribe((selectedLabels: string[] | undefined) => {
      if (selectedLabels) {
        this.visibleCardLabels = selectedLabels;
        if (vm.profile?.id) {
          this.saveVisibleCardLabels(vm.profile.id, selectedLabels);
        }
      }
    });
  }

  getCounts(filter: 'all' | 'active' | 'inactive', vm: DashboardVm | null): number {
    if (!vm) return 0;
    const rawData = vm._rawData || {};
    const role = vm.profile?.role || '';
    const isScopedRole = ['teacher', 'staff', 'madrasaIncharge', 'coordinator', 'stageHead', 'student'].includes(role) || (role as string) === 'staff';

    // Primary collection for dashboard status overview (students -> users -> madrasas)
    let primaryItems: EntityRecord[] = [];
    if (isScopedRole && Array.isArray(rawData['students']) && rawData['students'].length > 0) {
      primaryItems = rawData['students'];
    } else if (Array.isArray(rawData['users']) && rawData['users'].length > 1) {
      primaryItems = rawData['users'];
    } else if (Array.isArray(rawData['students']) && rawData['students'].length > 0) {
      primaryItems = rawData['students'];
    } else if (Array.isArray(rawData['users']) && rawData['users'].length > 0) {
      primaryItems = rawData['users'];
    } else if (Array.isArray(rawData['madrasas']) && rawData['madrasas'].length > 0) {
      primaryItems = rawData['madrasas'];
    }

    if (filter === 'all') return primaryItems.length;
    if (filter === 'active') return primaryItems.filter(r => this.isEntityActive(r)).length;
    return primaryItems.filter(r => !this.isEntityActive(r)).length;
  }

  toggleMadrasaDetails(): void {
    this.showMadrasaDetails = !this.showMadrasaDetails;
  }

  readonly vm$ = combineLatest([
    this.refresh$,
    this.auth.profile$.pipe(
      filter((p): p is AppUser => !!p),
      distinctUntilChanged((prev, curr) => prev?.uid === curr?.uid && prev?.updatedAt === curr?.updatedAt)
    )
  ]).pipe(
    switchMap(([_, profile]) => {
      if (!profile) {
        return of(null);
      }

      if (['teacher', 'staff', 'ustadh', 'teacher_assistant'].includes(String(profile.role || '').toLowerCase())) {
        return this.loadTeacherData(profile).pipe(
          map(data => this.buildDashboardVm(profile, data))
        );
      }

      return combineLatest({
        organizations: from(this.repo.getAllOnce<EntityRecord>('organizations', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        madrasas: from(this.repo.getAllOnce<EntityRecord>('madrasas', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        users: from(this.repo.getAllOnce<EntityRecord>('users', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        staff: from(this.repo.getAllOnce<EntityRecord>('staff', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        students: from(this.repo.getAllOnce<EntityRecord>('students', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        courses: from(this.repo.getAllOnce<EntityRecord>('courses', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        classes: from(this.repo.getAllOnce<EntityRecord>('classes', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        classGroups: from(this.repo.getAllOnce<EntityRecord>('classGroups', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        subjects: from(this.repo.getAllOnce<EntityRecord>('subjects', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        attendance: this.isAttendanceOverviewLoaded
          ? from(this.repo.getAllOnce<AttendanceRecord & EntityRecord>('attendance', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); }))
          : of([]),
        notifications: from(this.repo.getAllOnce<NotificationItem & EntityRecord>('notifications', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        classPlans: from(this.repo.getAllOnce<EntityRecord & ClassPlan>('classPlans', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
        timetableEntries: from(this.repo.getAllOnce<EntityRecord & TimetableEntry>('timetableEntries', profile)).pipe(catchError(error => { console.warn('[Dashboard] Skipped:', error); return of([]); })),
      }).pipe(
        map((rawData) => this.buildDashboardVm(profile, rawData))
      );
    }),
  );

  private loadTeacherData(profile: AppUser): Observable<Record<string, any[]>> {
    // 1. Fetch assigned classes & timetable entries
    const classes$ = from(this.repo.getAllOnce<EntityRecord>('classes', profile)).pipe(catchError(() => of([])));
    const classGroups$ = from(this.repo.getAllOnce<EntityRecord>('classGroups', profile)).pipe(catchError(() => of([])));
    const timetable$ = from(this.repo.getAllOnce<EntityRecord & TimetableEntry>('timetableEntries', profile)).pipe(catchError(() => of([])));
    const subjects$ = from(this.repo.getAllOnce<EntityRecord>('subjects', profile)).pipe(catchError(() => of([])));
    const notifications$ = from(this.repo.getAllOnce<NotificationItem & EntityRecord>('notifications', profile)).pipe(catchError(() => of([])));
    const attendance$ = this.isAttendanceOverviewLoaded
      ? from(this.repo.getAllOnce<AttendanceRecord & EntityRecord>('attendance', profile)).pipe(catchError(() => of([])))
      : of([]);
    const users$ = from(this.repo.getAllOnce<EntityRecord>('users', profile)).pipe(catchError(() => of([])));
    const staff$ = from(this.repo.getAllOnce<EntityRecord>('staff', profile)).pipe(catchError(() => of([])));
    
    return combineLatest({
      classes: classes$,
      classGroups: classGroups$,
      timetableEntries: timetable$,
      subjects: subjects$,
      notifications: notifications$,
      attendance: attendance$,
      users: users$,
      staff: staff$
    }).pipe(
      switchMap((initialData) => {
        // Extract classPlanIds from timetable entries
        const classPlanIds = [...new Set(initialData.timetableEntries.map((e: any) => e.classPlanId).filter(Boolean))];
        
        // Chunk requests for classPlans
        const planChunks = classPlanIds.length > 0 ? this.chunkArray(classPlanIds, 10) : [];
        const planObs = planChunks.length > 0 ? planChunks.map(chunk => 
          from(this.repo.getAllOnce<EntityRecord & ClassPlan>('classPlans', profile, {}, [where(documentId(), 'in', chunk)])).pipe(catchError(() => of([])))
        ) : [of([])];
        
        return combineLatest(planObs).pipe(
          map(results => results.flat()),
          switchMap((classPlans: any[]) => {
            const courseIds = [...new Set([...classPlans.map((p: any) => p.courseId), ...initialData.classes.map((c: any) => c['courseId'])])].filter(Boolean);
            const madrasaIds = [...new Set([...(profile.madrasaIds || []), ...classPlans.map((p: any) => p.madrasaId), ...initialData.classes.map((c: any) => c['madrasaId'])])].filter(Boolean);
            const classIds = [...new Set([...classPlans.map((p: any) => p.classId), ...initialData.classes.map((c: any) => c.id)])].filter(Boolean);
            const groupIds = [...new Set(classPlans.map((p: any) => p.groupId))].filter(Boolean);
            
            const reqs: any = { classPlans: of(classPlans) };
            
            if (courseIds.length > 0) {
              const chunks = this.chunkArray(courseIds, 10);
              reqs.courses = combineLatest(chunks.map(chunk => from(this.repo.getAllOnce<EntityRecord>('courses', profile, {}, [where(documentId(), 'in', chunk)])).pipe(catchError(() => of([]))))).pipe(map(r => r.flat()));
            } else reqs.courses = of([]);
            
            if (madrasaIds.length > 0) {
              const chunks = this.chunkArray(madrasaIds, 10);
              reqs.madrasas = combineLatest(chunks.map(chunk => from(this.repo.getAllOnce<EntityRecord>('madrasas', profile, {}, [where(documentId(), 'in', chunk)])).pipe(catchError(() => of([]))))).pipe(map(r => r.flat()));
            } else reqs.madrasas = of([]);
            
            reqs.allStudents = from(this.repo.getAllOnce<EntityRecord>('students', profile)).pipe(catchError(() => of([])));
            
            return combineLatest(reqs).pipe(
              map((fetched: any) => {
                const allStudents = fetched.allStudents || [];
                const uniqueStudents = Array.from(new Map(allStudents.map((s: any) => [s.id, s])).values());

                const profAny = profile as Record<string, any>;
                const normalizedRole = String(profile.role || '').toLowerCase();

                const staffTokens = new Set<string>([
                  ...this.extractAllStrings(profAny['id']),
                  ...this.extractAllStrings(profAny['uid']),
                  ...this.extractAllStrings(profAny['entityId']),
                  ...this.extractAllStrings(profAny['email'])
                ]);

                const assignedMadrasas = (fetched.madrasas || []).filter((m: any) => {
                  const inchargeTokens = this.extractAllStrings([m['inchargeIds'], m['incharges'], m['coordinatorIds'], m['coordinators']]);
                  return inchargeTokens.some(tok => staffTokens.has(tok));
                });

                const userMadrasaIds = new Set<string>([
                  ...assignedMadrasas.map((m: any) => String(m.id)),
                  ...this.extractAllStrings([profAny['madrasaId'], profAny['madrasaIds'], profAny['assignedMadrasaId'], profAny['assignedMadrasaIds']])
                ]);

                const assignedGroups = (initialData.classGroups || []).filter((g: any) => {
                  const gStaffTokens = this.extractAllStrings([
                    g['assignedStaffIds'], g['assignedStaff'], g['staffIds'], g['teacherIds'], g['groupStaff'], g['teacherId'], g['staffId']
                  ]);
                  return gStaffTokens.some(tok => staffTokens.has(tok));
                });
                const assignedGroupIds = new Set<string>([
                  ...assignedGroups.map((g: any) => String(g.id)),
                  ...this.extractAllStrings([profAny['groupId'], profAny['groupIds'], profAny['classGroupId'], profAny['classGroupIds'], profAny['assignedGroupId'], profAny['assignedGroupIds']])
                ]);

                const assignedClassIds = new Set<string>([
                  ...assignedGroups.map((g: any) => String(g['classId'] || '')).filter(Boolean),
                  ...(initialData.classes || []).filter((c: any) => {
                    const cStaffTokens = this.extractAllStrings([c['assignedStaffIds'], c['assignedStaff'], c['staffIds'], c['teacherIds'], c['teacherId']]);
                    return cStaffTokens.some(tok => staffTokens.has(tok));
                  }).map((c: any) => String(c.id)),
                  ...this.extractAllStrings([profAny['classId'], profAny['classIds'], profAny['assignedClassId'], profAny['assignedClassIds']])
                ]);

                let finalStudents: any[] = [];

                if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin' || normalizedRole === 'organizationadmin' || normalizedRole === 'organization_admin') {
                  finalStudents = uniqueStudents;
                } else if (normalizedRole === 'madrasaincharge' || normalizedRole === 'coordinator') {
                  if (userMadrasaIds.size > 0) {
                    finalStudents = uniqueStudents.filter((s: any) => {
                      const sMadrasaId = String(s['madrasaId'] || s['assignedMadrasaId'] || '');
                      return sMadrasaId && userMadrasaIds.has(sMadrasaId);
                    });
                  } else {
                    finalStudents = uniqueStudents;
                  }
                } else if (normalizedRole === 'teacher' || normalizedRole === 'staff') {
                  finalStudents = uniqueStudents.filter((s: any) => {
                    const sTeacherTokens = this.extractAllStrings([s['teacherId'], s['assignedStaffId'], s['staffId'], s['teacherUid'], s['assignedTeacherId']]);
                    if (sTeacherTokens.some(tok => staffTokens.has(tok))) return true;

                    const sGroupTokens = this.extractAllStrings([s['groupId'], s['classGroupId'], s['assignedGroupId'], s['groupIds'], s['classGroupIds']]);
                    if (sGroupTokens.some(gId => assignedGroupIds.has(gId))) return true;

                    if (assignedGroupIds.size > 0) return false;

                    const sClassTokens = this.extractAllStrings([s['classId'], s['assignedClassId'], s['classIds'], s['assignedClassIds']]);
                    if (sClassTokens.some(cId => assignedClassIds.has(cId))) return true;

                    return false;
                  });
                } else {
                  finalStudents = uniqueStudents;
                }

                const scopedClasses = initialData.classes.filter((c: any) => assignedClassIds.has(String(c.id)));

                return {
                  ...initialData,
                  classPlans: fetched.classPlans,
                  courses: fetched.courses,
                  madrasas: fetched.madrasas,
                  classes: scopedClasses,
                  students: finalStudents,
                  organizations: [] // Teachers don't need full org data for stats
                };
              })
            );
          })
        );
      })
    );
  }

  private extractAllStrings(val: any): string[] {
    if (!val) return [];
    if (typeof val === 'string') return [val.trim()];
    if (typeof val === 'number') return [String(val)];
    if (Array.isArray(val)) {
      return val.flatMap(item => this.extractAllStrings(item));
    }
    if (typeof val === 'object') {
      const ids: string[] = [];
      if (val.id) ids.push(String(val.id).trim());
      if (val.uid) ids.push(String(val.uid).trim());
      if (val.userId) ids.push(String(val.userId).trim());
      if (val.entityId) ids.push(String(val.entityId).trim());
      if (val.docId) ids.push(String(val.docId).trim());
      if (val.email) ids.push(String(val.email).trim());
      return ids;
    }
    return [];
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

    const data: Record<string, any[]> = {
      ...rawData,
      users: nonStudentUsers,
      coordinators: allUsers.filter(u => u['role'] === 'coordinator'),
      incharges: allUsers.filter(u => u['role'] === 'madrasaIncharge'),
      staff: allUsers.filter(u => u['role'] === 'teacher' || u['role'] === 'staff'),
      students: studentCollection,
      parents: allUsers.filter(u => u['role'] === 'parent'),
    };
    const stats = this.statsForRole(profile.role, data, profile);
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
        const madrasaObj = madrasasList.find((m) => String(m.id) === String(madrasaId) || String(m['code']) === String(madrasaId));

        return {
          groupId: group.id,
          groupName: group['name'] || group['title'] || 'Class Group',
          classId: group.classId,
          className: classObj?.['name'] || 'Class',
          courseId,
          courseName: courseObj?.['name'] || 'Course',
          madrasaId: String(madrasaId || ''),
          madrasaName: madrasaObj?.['name'] || 'Madrasa',
        };
      });
    }

    const userTokens = [
      profile.uid,
      profile.id,
      profile.entityId,
      profile.email
    ].map(v => String(v || '').trim()).filter(Boolean);

    const madrasaRoleMap = (profile as any).madrasaRoleMap || {};
    const inchargeMadrasaIdsProfile = Array.isArray((profile as any).inchargeMadrasaIds) ? (profile as any).inchargeMadrasaIds.map(String) : [];
    const coordinatorMadrasaIdsProfile = Array.isArray((profile as any).coordinatorMadrasaIds) ? (profile as any).coordinatorMadrasaIds.map(String) : [];

    const inchargeMadrasaEntities = madrasasList.filter(m => {
      const mId = String(m.id);
      const mCode = String(m['code'] || '');

      const mIncharges = [
        ...(Array.isArray(m['inchargeIds']) ? m['inchargeIds'] : []),
        ...(m['inchargeId'] ? [m['inchargeId']] : []),
        ...(m['incharge'] ? [m['incharge']] : []),
      ].map(v => String(v || '').trim()).filter(Boolean);

      if (mIncharges.some(id => userTokens.includes(id))) return true;
      if (inchargeMadrasaIdsProfile.includes(mId) || (mCode && inchargeMadrasaIdsProfile.includes(mCode))) return true;
      if (madrasaRoleMap[mId] === 'madrasaIncharge' || madrasaRoleMap[mCode] === 'madrasaIncharge') return true;

      return false;
    });

    const coordinatorMadrasaEntities = madrasasList.filter(m => {
      const mId = String(m.id);
      const mCode = String(m['code'] || '');

      const mCoords = [
        ...(Array.isArray(m['coordinatorIds']) ? m['coordinatorIds'] : []),
        ...(m['coordinatorId'] ? [m['coordinatorId']] : []),
        ...(m['coordinator'] ? [m['coordinator']] : []),
      ].map(v => String(v || '').trim()).filter(Boolean);

      if (mCoords.some(id => userTokens.includes(id))) return true;
      if (coordinatorMadrasaIdsProfile.includes(mId) || (mCode && coordinatorMadrasaIdsProfile.includes(mCode))) return true;
      if (madrasaRoleMap[mId] === 'coordinator' || madrasaRoleMap[mCode] === 'coordinator') return true;

      return false;
    });

    // Fallback: Only if user has a single main madrasaId and no explicit map matched
    if (inchargeMadrasaEntities.length === 0 && profile.role === 'madrasaIncharge') {
      const primaryMId = profile.madrasaId || (Array.isArray(profile.madrasaIds) && profile.madrasaIds.length === 1 ? profile.madrasaIds[0] : null);
      if (primaryMId) {
        const mObj = madrasasList.find(m => String(m.id) === String(primaryMId) || String(m['code']) === String(primaryMId));
        if (mObj) inchargeMadrasaEntities.push(mObj);
      }
    }

    if (coordinatorMadrasaEntities.length === 0 && profile.role === 'coordinator') {
      const primaryMId = profile.madrasaId || (Array.isArray(profile.madrasaIds) && profile.madrasaIds.length === 1 ? profile.madrasaIds[0] : null);
      if (primaryMId) {
        const mObj = madrasasList.find(m => String(m.id) === String(primaryMId) || String(m['code']) === String(primaryMId));
        if (mObj) coordinatorMadrasaEntities.push(mObj);
      }
    }

    const inchargeMadrasaNames = inchargeMadrasaEntities.map(m => String(m['name'] || m['title'] || m['code'] || m.id));
    const inchargeMadrasasText = inchargeMadrasaNames.length > 0 ? inchargeMadrasaNames.join(' & ') : '';

    const userAssignedMadrasaIds = Array.from(new Set([
      ...(Array.isArray(profile.madrasaIds) ? profile.madrasaIds : []),
      ...(profile.madrasaId ? [profile.madrasaId] : []),
      ...inchargeMadrasaEntities.map(m => String(m.id)),
      ...coordinatorMadrasaEntities.map(m => String(m.id)),
    ].map(String).filter(Boolean)));

    const madrasaRolesBreakdown: DashboardMadrasaRoleBreakdown[] = [];

    userAssignedMadrasaIds.forEach(mId => {
      const mObj = madrasasList.find(m => String(m.id) === mId || String(m['code']) === mId);
      const mName = String(mObj?.['name'] || mObj?.['title'] || mId);

      const isIncharge = inchargeMadrasaEntities.some(im => String(im.id) === mId || String(im['code']) === mId);
      const isCoord = coordinatorMadrasaEntities.some(cm => String(cm.id) === mId || String(cm['code']) === mId);

      let rKey = 'staff';
      let rLabel = 'Staff / Teacher';

      if (isIncharge) {
        rKey = 'madrasaIncharge';
        rLabel = 'Madrasa Incharge';
      } else if (isCoord) {
        rKey = 'coordinator';
        rLabel = 'Coordinator';
      } else if (profile.role === 'madrasaIncharge' && userAssignedMadrasaIds.length === 1) {
        rKey = 'madrasaIncharge';
        rLabel = 'Madrasa Incharge';
      } else if (profile.role === 'coordinator' && userAssignedMadrasaIds.length === 1) {
        rKey = 'coordinator';
        rLabel = 'Coordinator';
      }

      madrasaRolesBreakdown.push({
        madrasaId: mId,
        madrasaName: mName,
        role: rKey,
        roleLabel: rLabel
      });
    });

    // Only add "General Assignment" fallback for staff/teacher roles that have a madrasa
    // but no specific class group assignment yet. Skip it for incharge/coordinator madrasas
    // since those are already shown clearly in the madrasaRolesBreakdown section.
    const isStaffLikeRole = ['staff', 'teacher', 'ustadh', 'teacher_assistant'].includes(String(profile.role || '').toLowerCase());
    if (isStaffLikeRole) {
      const coveredMadrasaIds = new Set(assignedAssignments.map(a => String(a.madrasaId || '')).filter(Boolean));

      userAssignedMadrasaIds.forEach((mId) => {
        const madrasaObj = madrasasList.find((m) => String(m.id) === mId || String(m['code']) === mId);
        const actualMadrasaId = madrasaObj ? String(madrasaObj.id) : mId;

        if (!coveredMadrasaIds.has(mId) && !coveredMadrasaIds.has(actualMadrasaId)) {
          assignedAssignments.push({
            groupName: 'General Assignment',
            className: 'All Classes',
            courseName: 'All Courses',
            madrasaId: actualMadrasaId,
            madrasaName: madrasaObj?.['name'] || 'Madrasa',
          });
          coveredMadrasaIds.add(mId);
          coveredMadrasaIds.add(actualMadrasaId);
        }
      });
    }

    const inchargeMadrasaIds = inchargeMadrasaEntities.map(m => String(m.id));
    const todayAttendance = this.buildTodayAttendanceOverview(profile, data, inchargeMadrasaIds);
    const attendance = this.attendanceSummary(data['attendance'] || [], todayAttendance);
    const enhancedCourseDistribution = this.buildEnhancedCourseDistribution(data);
    const weeklyAttendanceTrend = this.buildWeeklyAttendanceTrend(data['attendance'] || []);
    const attendanceRiskStudents = this.buildAttendanceRiskStudents(data['students'] || [], data['attendance'] || [], data['madrasas'] || [], data['classes'] || []);
    const madrasaCapacityOverview = this.buildMadrasaCapacityOverview(data['madrasas'] || [], data['students'] || data['allStudents'] || [], data['classGroups'] || []);
    const teacherWorkloadMatrix = this.buildTeacherWorkloadMatrix(data['staff'] || [], data['classGroups'] || [], data['students'] || data['allStudents'] || [], data['classes'] || [], data['users'] || []);

    const roleLowerNorm = String(profile.role || '').toLowerCase().replace(/_/g, '');
    return {
      displayName: this.getDisplayName(profile),
      formattedRole: this.formatRole(profile.role, profile),
      roleTitle: ROLE_LABELS[profile.role],
      isSuperAdmin: roleLowerNorm === 'superadmin',
      isOrgAdmin: roleLowerNorm === 'organizationadmin',
      isMadrasaIncharge: roleLowerNorm === 'madrasaincharge',
      isCoordinator: roleLowerNorm === 'coordinator',
      isStaff: ['staff', 'teacher', 'ustadh', 'teacher_assistant'].includes(roleLowerNorm),
      organizationId: profile.organizationId,
      madrasaIds: Array.isArray(profile.madrasaIds) && profile.madrasaIds.length > 0 ? profile.madrasaIds : (profile.madrasaId ? [profile.madrasaId] : []),
      inchargeMadrasaNames,
      inchargeMadrasasText,
      madrasaRolesBreakdown,
      assignedAssignments,
      stats,
      attendance,
      todayAttendance,
      courseDistribution,
      enhancedCourseDistribution,
      weeklyAttendanceTrend,
      attendanceRiskStudents,
      madrasaCapacityOverview,
      teacherWorkloadMatrix,
      usersByRole,
      notifications: (data['notifications'] || []).slice(0, 5),
      setupSteps,
      accessOverview,
      todaySchedule: finalSchedule,
      profile,
      _rawData: data
    };
  }

  private safeToIsoDateStr(val: any): string | null {
    if (!val) return null;
    try {
      let d: Date | null = null;
      if (typeof val === 'string') {
        d = new Date(val);
      } else if (typeof val === 'number') {
        d = new Date(val);
      } else if (typeof val === 'object') {
        if (typeof val.toDate === 'function') {
          d = val.toDate();
        } else if (val.seconds !== undefined) {
          d = new Date(val.seconds * 1000);
        } else if (val._seconds !== undefined) {
          d = new Date(val._seconds * 1000);
        }
      }
      if (d && !isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      // Safe fallback for unparseable dates
    }
    return null;
  }

  private buildWeeklyAttendanceTrend(attendanceRecords: EntityRecord[]): WeeklyAttendanceTrendPoint[] {
    // Only show trend if there is real attendance data
    if (!attendanceRecords || attendanceRecords.length === 0) return [];

    const days: WeeklyAttendanceTrendPoint[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayRecords = (attendanceRecords || []).filter(r => {
        if (r['dateStr'] === dateStr || r['date'] === dateStr) return true;
        const parsedStr = this.safeToIsoDateStr(r['createdAt'] || r['dateTimestamp'] || r['timestamp']);
        return parsedStr === dateStr;
      });

      const totalCount = dayRecords.length;
      const presentCount = dayRecords.filter(r => (r['status'] || '').toLowerCase() === 'present').length;
      // Use 0 when no real data — no fake placeholders
      const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

      days.push({
        dayName,
        shortDay,
        dateStr,
        presentCount,
        totalCount,
        rate
      });
    }

    return days;
  }

  private buildAttendanceRiskStudents(students: EntityRecord[], attendanceRecords: EntityRecord[], madrasas: EntityRecord[], classes: EntityRecord[]): AttendanceRiskStudent[] {
    const riskList: AttendanceRiskStudent[] = [];
    if (!students || students.length === 0) return [];

    students.forEach(s => {
      const sId = String(s.id || s['uid'] || '');
      const sName = (s['name'] as string) || (s['fullName'] as string) || 'Student';
      const mId = s['madrasaId'];
      const madrasaObj = madrasas.find(m => String(m.id) === String(mId));
      const mName = madrasaObj ? (madrasaObj['name'] as string) : 'Madrasa';
      const cId = s['classId'];
      const classObj = classes.find(c => String(c.id) === String(cId));
      const cName = classObj ? (classObj['name'] as string) : 'Class';

      const sRecords = (attendanceRecords || []).filter(r => String(r['studentId'] || r['uid']) === sId);
      const totalDays = sRecords.length;
      const presentDays = sRecords.filter(r => (r['status'] || '').toLowerCase() === 'present').length;
      const absentDays = sRecords.filter(r => (r['status'] || '').toLowerCase() === 'absent').length;

      let rate = 100;
      if (totalDays > 0) {
        rate = Math.round((presentDays / totalDays) * 100);
      } else if (s['attendanceRate'] !== undefined) {
        rate = Number(s['attendanceRate']);
      } else if (absentDays > 0) {
        rate = Math.max(0, 100 - absentDays * 15);
      }

      if (rate < 75 && totalDays > 0) {
        riskList.push({
          studentId: sId,
          name: sName,
          madrasaName: mName,
          className: cName,
          groupName: (s['groupName'] as string) || 'Group',
          totalDays: totalDays || 10,
          presentDays,
          absentDays,
          rate,
          riskLevel: rate < 60 ? 'critical' : 'high'
        });
      }
    });

    // Do NOT generate fake risk data — only show real students with real low attendance
    return riskList.sort((a, b) => a.rate - b.rate);
  }

  private buildMadrasaCapacityOverview(madrasas: EntityRecord[], students: EntityRecord[], classGroups: EntityRecord[] = []): MadrasaCapacitySlice[] {
    if (!madrasas || madrasas.length === 0) return [];

    return madrasas.map(m => {
      const mId = String(m.id || m['docId'] || '');
      const mName = (m['name'] as string) || (m['title'] as string) || 'Madrasa';
      
      const enrolled = (students || []).filter(s => {
        const sMadrasaTokens = this.extractAllStrings([
          s['madrasaId'], s['assignedMadrasaId'], s['madrasaIds'], s['madrasa'], s['centerId']
        ]);
        return sMadrasaTokens.includes(mId) || (mName && sMadrasaTokens.includes(mName));
      }).length;

      // 1. Direct capacity configured on madrasa record in Firestore
      const explicitCap = Number(m['capacity'] || m['studentCapacity'] || m['maxCapacity'] || m['maxStudents'] || m['targetCapacity'] || m['totalCapacity']);

      // 2. Sum of class group capacities assigned to this madrasa
      const mClassGroups = (classGroups || []).filter(cg => {
        const cgMadrasaTokens = this.extractAllStrings([cg['madrasaId'], cg['assignedMadrasaId'], cg['madrasaIds'], cg['madrasa']]);
        return cgMadrasaTokens.includes(mId) || (mName && cgMadrasaTokens.includes(mName));
      });

      let sumGroupCapacity = 0;
      mClassGroups.forEach(cg => {
        const cgCap = Number(cg['capacity'] || cg['maxStudents'] || cg['studentCapacity'] || cg['limit']);
        if (!isNaN(cgCap) && cgCap > 0) {
          sumGroupCapacity += cgCap;
        }
      });

      let capacity = 0;
      if (!isNaN(explicitCap) && explicitCap > 0) {
        capacity = explicitCap;
      } else if (sumGroupCapacity > 0) {
        capacity = sumGroupCapacity;
      } else {
        capacity = enrolled;
      }

      const percentFull = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;

      let status: 'available' | 'near-full' | 'at-capacity' = 'available';
      if (percentFull >= 90) status = 'at-capacity';
      else if (percentFull >= 75) status = 'near-full';

      return {
        madrasaId: mId,
        madrasaName: mName,
        enrolledStudents: enrolled,
        capacity,
        percentFull,
        status
      };
    }).sort((a, b) => b.enrolledStudents - a.enrolledStudents);
  }

  private buildTeacherWorkloadMatrix(staff: EntityRecord[], classGroups: EntityRecord[], students: EntityRecord[], classes: EntityRecord[], users: EntityRecord[] = []): TeacherWorkloadSlice[] {
    const rawStaffList = [...(staff || []), ...(users || [])];
    const teacherMap = new Map<string, EntityRecord>();

    rawStaffList.forEach(u => {
      if (!u) return;
      const role = String(u['role'] || '').toLowerCase();
      const jobTitle = String(u['jobTitle'] || u['title'] || u['designation'] || '').toLowerCase();
      const isTeacher = role === 'teacher' || role === 'staff' || role === 'madrasaincharge' || role === 'ustadh' || jobTitle.includes('teacher') || jobTitle.includes('usthad') || jobTitle.includes('staff');
      if (isTeacher) {
        const idKey = String(u.id || u['uid'] || u['docId'] || u['email'] || '');
        if (idKey) {
          if (!teacherMap.has(idKey) || u['classGroupIds'] || u['groupIds'] || u['assignedGroupIds']) {
            teacherMap.set(idKey, u);
          }
        }
      }
    });

    const teachers = Array.from(teacherMap.values());
    if (!teachers || teachers.length === 0) return [];

    return teachers.map(t => {
      const tId = String(t.id || t['uid'] || t['docId'] || '');
      const teacherTokens = new Set(this.extractAllStrings([t['id'], t['uid'], t['userId'], t['email'], t['docId'], t['entityId']]));

      const tName = (t['name'] as string) ||
                    (t['fullName'] as string) ||
                    (t['displayName'] as string) ||
                    (t['username'] as string) ||
                    (t['email'] ? (t['email'] as string).split('@')[0] : 'Teacher');

      const teacherGroupIds = new Set(this.extractAllStrings([
        t['classGroupIds'], t['groupIds'], t['assignedGroupIds'], t['assignedClassGroupIds'], t['classGroup'], t['groupId'], t['assignedGroups'], t['groups']
      ]));

      const teacherClassIds = new Set(this.extractAllStrings([
        t['classId'], t['classIds'], t['assignedClassId'], t['assignedClassIds'], t['class'], t['assignedClasses']
      ]));

      // Find assigned class groups
      const assignedGroups = (classGroups || []).filter(g => {
        const gId = String(g.id || g['docId'] || '');
        if (teacherGroupIds.has(gId)) return true;

        const staffTokens = this.extractAllStrings([
          g['staffId'], g['teacherId'], g['assignedStaffId'], g['teacherUid'], g['staffIds'], g['teacherIds'], g['inchargeId'], g['staff'], g['teacher'], g['assignedStaff']
        ]);
        return staffTokens.some(tok => teacherTokens.has(tok));
      });

      // Find assigned classes
      const assignedClasses = (classes || []).filter(c => {
        const cId = String(c.id || c['docId'] || '');
        if (teacherClassIds.has(cId)) return true;

        const staffTokens = this.extractAllStrings([
          c['teacherId'], c['staffId'], c['assignedStaffId'], c['inchargeId'], c['teacherUid'], c['staffIds'], c['teacherIds'], c['teacher']
        ]);
        return staffTokens.some(tok => teacherTokens.has(tok));
      });

      const rawGroupIdsCount = teacherGroupIds.size;
      const groupCount = Math.max(assignedGroups.length, assignedClasses.length, rawGroupIdsCount);
      const assignedGroupIds = new Set([
        ...assignedGroups.map(g => String(g.id)),
        ...Array.from(teacherGroupIds)
      ]);
      const assignedClassIds = new Set([
        ...assignedClasses.map(c => String(c.id)),
        ...Array.from(teacherClassIds)
      ]);

      // Find assigned students directly or via class groups / classes
      const assignedStudents = (students || []).filter(s => {
        const sTeacherTokens = this.extractAllStrings([
          s['teacherId'], s['assignedStaffId'], s['staffId'], s['teacherUid'], s['assignedTeacherId'], s['staff']
        ]);
        if (sTeacherTokens.some(tok => teacherTokens.has(tok))) return true;

        const sGroupTokens = this.extractAllStrings([
          s['groupId'], s['classGroupId'], s['assignedGroupId'], s['groupIds'], s['classGroupIds']
        ]);
        if (sGroupTokens.some(gId => assignedGroupIds.has(gId))) return true;

        const sClassTokens = this.extractAllStrings([
          s['classId'], s['assignedClassId'], s['classIds']
        ]);
        return sClassTokens.some(cId => assignedClassIds.has(cId));
      });

      let groupStudentSum = 0;
      assignedGroups.forEach(g => {
        if (Array.isArray(g['studentIds'])) groupStudentSum += g['studentIds'].length;
        else if (g['studentCount'] !== undefined) groupStudentSum += Number(g['studentCount']);
        else if (g['studentsCount'] !== undefined) groupStudentSum += Number(g['studentsCount']);
      });

      const assignedStudentCount = Math.max(assignedStudents.length, groupStudentSum);

      const classNames = Array.from(new Set([
        ...assignedGroups.map(g => (g['name'] as string) || (g['title'] as string) || 'Class Group'),
        ...assignedClasses.map(c => (c['name'] as string) || (c['title'] as string) || 'Class')
      ].filter(Boolean)));

      let workloadLevel: 'Light' | 'Optimal' | 'High Load' = 'Light';
      if (groupCount >= 3 || assignedStudentCount >= 40) {
        workloadLevel = 'High Load';
      } else if (groupCount >= 1 || assignedStudentCount >= 1) {
        workloadLevel = 'Optimal';
      }

      return {
        teacherId: tId,
        teacherName: tName,
        email: (t['email'] as string) || '',
        assignedGroupCount: groupCount,
        assignedStudentCount,
        assignedClassNames: classNames,
        workloadLevel
      };
    }).sort((a, b) => {
      const order = { 'High Load': 3, 'Optimal': 2, 'Light': 1 };
      const diff = order[b.workloadLevel] - order[a.workloadLevel];
      if (diff !== 0) return diff;
      return (b.assignedGroupCount * 10 + b.assignedStudentCount) - (a.assignedGroupCount * 10 + a.assignedStudentCount);
    });
  }

  private buildEnhancedCourseDistribution(data: Record<string, EntityRecord[]>): EnhancedCourseSlice[] {
    const courses = data['courses'] || [];
    const students = data['students'] || [];
    const classGroups = data['classGroups'] || [];
    const staff = data['staff'] || [];
    const todayAttendanceRecords = data['attendance'] || [];

    const totalStudentsCount = students.length || 1;

    const courseMap = new Map<string, { id: string; name: string }>();
    courses.forEach(c => {
      const cId = String(c.id);
      const cName = String(c['name'] || c['title'] || cId);
      courseMap.set(cId, { id: cId, name: cName });
    });

    students.forEach(s => {
      const cId = String(s['courseId'] || '');
      const cName = String(s['courseName'] || '');
      if (cId && !courseMap.has(cId)) {
        courseMap.set(cId, { id: cId, name: cName || ('Course ' + cId) });
      }
    });

    const results: EnhancedCourseSlice[] = [];
    const courseKeys = Array.from(courseMap.keys());

    if (courseKeys.length === 0) {
      const studentCountsByName = new Map<string, number>();
      students.forEach(s => {
        const cName = String(s['courseName'] || 'Unassigned');
        studentCountsByName.set(cName, (studentCountsByName.get(cName) || 0) + 1);
      });

      studentCountsByName.forEach((count, name) => {
        results.push({
          courseId: name,
          courseName: name,
          studentCount: count,
          staffCount: 0,
          classGroupCount: 0,
          studentPercent: Math.round((count / totalStudentsCount) * 100),
          studentTeacherRatio: 'N/A'
        });
      });
      return results.sort((a, b) => b.studentCount - a.studentCount);
    }

    courseKeys.forEach(cId => {
      const courseInfo = courseMap.get(cId)!;
      const cName = courseInfo.name;

      const courseStudents = students.filter(s =>
        String(s['courseId'] || '') === cId || String(s['courseName'] || '').toLowerCase() === cName.toLowerCase()
      );
      const studentCount = courseStudents.length;

      const courseGroups = classGroups.filter(g =>
        String(g['courseId'] || '') === cId || String(g['courseName'] || '').toLowerCase() === cName.toLowerCase()
      );
      const classGroupCount = courseGroups.length;

      const staffSet = new Set<string>();
      courseGroups.forEach(g => {
        const gStaffTokens = this.extractAllStrings([
          g['assignedStaffIds'], g['assignedStaff'], g['staffIds'], g['teacherIds'], g['groupStaff'], g['teacherId'], g['staffId'], g['teacherUids']
        ]);
        gStaffTokens.forEach(tok => staffSet.add(tok));
      });

      staff.forEach(st => {
        const stCourseIds = this.extractAllStrings([st['courseId'], st['courseIds'], st['assignedCourseId'], st['assignedCourseIds']]);
        if (stCourseIds.includes(cId) || stCourseIds.includes(cName)) {
          staffSet.add(String(st.id || st['uid'] || st['email']));
        }
      });

      const staffCount = staffSet.size;

      let ratioText = 'N/A';
      if (staffCount > 0) {
        const ratioNum = Math.round(studentCount / staffCount);
        ratioText = `${ratioNum}:1`;
      } else if (studentCount > 0) {
        ratioText = `${studentCount}:0`;
      }

      let todayAttendanceRate: number | undefined;
      const studentIds = new Set(courseStudents.map(s => String(s.id || s['uid'] || s['userId'])).filter(Boolean));
      if (studentIds.size > 0 && todayAttendanceRecords.length > 0) {
        const courseAtt = todayAttendanceRecords.filter(r => studentIds.has(String(r['studentId'] || r['studentUid'])));
        if (courseAtt.length > 0) {
          const presentCount = courseAtt.filter(r => r['status'] === 'present' || r['status'] === 'late').length;
          todayAttendanceRate = Math.round((presentCount / courseAtt.length) * 100);
        }
      }

      results.push({
        courseId: cId,
        courseName: cName,
        studentCount,
        staffCount,
        classGroupCount,
        studentPercent: Math.round((studentCount / totalStudentsCount) * 100),
        studentTeacherRatio: ratioText,
        todayAttendanceRate
      });
    });

    const unassignedStudents = students.filter(s => {
      const cId = String(s['courseId'] || '');
      const cName = String(s['courseName'] || '');
      return !cId && !cName;
    });

    if (unassignedStudents.length > 0) {
      results.push({
        courseId: 'unassigned',
        courseName: 'Unassigned',
        studentCount: unassignedStudents.length,
        staffCount: 0,
        classGroupCount: 0,
        studentPercent: Math.round((unassignedStudents.length / totalStudentsCount) * 100),
        studentTeacherRatio: 'N/A'
      });
    }

    return results.sort((a, b) => b.studentCount - a.studentCount);
  }

  private buildTodayAttendanceOverview(
    profile: AppUser,
    data: Record<string, any[]>,
    inchargeMadrasaIds: string[]
  ): TodayAttendanceOverview {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const formattedDate = `${day}/${month}/${year}`;

    if (!this.isAttendanceOverviewLoaded) {
      return {
        dateStr,
        formattedDate,
        totalGroups: 0,
        takenGroupsCount: 0,
        pendingGroupsCount: 0,
        completionRate: 0,
        presentTotal: 0,
        absentTotal: 0,
        lateTotal: 0,
        leaveTotal: 0,
        totalStudentsRecorded: 0,
        overallPresentPercentage: 0,
        groupStatuses: [],
        madrasaBreakdown: []
      };
    }

    const allClassGroups = (data['classGroups'] || []) as EntityRecord[];
    const allClasses = (data['classes'] || []) as EntityRecord[];
    const allCourses = (data['courses'] || []) as EntityRecord[];
    const allMadrasas = (data['madrasas'] || []) as EntityRecord[];
    const allAttendance = (data['attendance'] || []) as EntityRecord[];
    const allStudents = (data['students'] || []) as EntityRecord[];

    const roleLowerAtt = String(profile.role || '').toLowerCase().replace(/_/g, '');
    const isSuperAdmin = roleLowerAtt === 'superadmin';
    const isOrgAdmin = roleLowerAtt === 'organizationadmin';

    const allowedMadrasaIds = new Set<string>();
    if (isSuperAdmin || isOrgAdmin) {
      allMadrasas.forEach(m => {
        if (m.id) allowedMadrasaIds.add(String(m.id));
        if (m['code']) allowedMadrasaIds.add(String(m['code']));
      });
    } else {
      const targetIncharges = (inchargeMadrasaIds && inchargeMadrasaIds.length > 0)
        ? inchargeMadrasaIds
        : (Array.isArray(profile.inchargeMadrasaIds) && profile.inchargeMadrasaIds.length > 0
          ? profile.inchargeMadrasaIds
          : []);
      if (targetIncharges.length > 0) {
        targetIncharges.forEach(id => allowedMadrasaIds.add(String(id)));
      } else {
        if (profile.madrasaId) allowedMadrasaIds.add(String(profile.madrasaId));
        if (Array.isArray(profile.madrasaIds)) profile.madrasaIds.forEach(id => allowedMadrasaIds.add(String(id)));
      }
    }

    const userTokens = [
      profile.uid,
      profile.id,
      profile.entityId,
      profile.email
    ].map(v => String(v || '').trim()).filter(Boolean);

    const assignedGroupEntities = allClassGroups.filter(group => {
      if (!this.isEntityActive(group)) return false;
      const staffIds = Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'].map(String) : [];
      const teacherUids = Array.isArray(group['teacherUids']) ? group['teacherUids'].map(String) : [];
      const inchargeIds = Array.isArray(group['inchargeIds']) ? group['inchargeIds'].map(String) : [];
      const coordIds = Array.isArray(group['coordinatorIds']) ? group['coordinatorIds'].map(String) : [];
      return userTokens.some(id =>
        staffIds.includes(id) ||
        teacherUids.includes(id) ||
        inchargeIds.includes(id) ||
        coordIds.includes(id) ||
        String(group['teacherUid']) === id ||
        String(group['assignedStaffId']) === id
      );
    });

    let scopedClassGroups: EntityRecord[] = [];

    const isStaffLike = ['staff', 'teacher', 'ustadh', 'teacher_assistant'].includes(String(profile.role || '').toLowerCase());

    if (isSuperAdmin || isOrgAdmin) {
      scopedClassGroups = allClassGroups.filter(grp => this.isEntityActive(grp));
    } else if (isStaffLike) {
      // Staff/Teacher: ONLY show their specifically assigned class groups
      scopedClassGroups = assignedGroupEntities;
    } else {
      // Incharge / Coordinator: show all groups from their managed madrasas
      const inchargeGroups = allClassGroups.filter(grp => {
        if (!this.isEntityActive(grp)) return false;
        const cls = allClasses.find(c => c.id === grp['classId']);
        const crs = allCourses.find(c => c.id === (grp['courseId'] || cls?.['courseId']));
        const grpMadrasaId = String(cls?.['madrasaId'] || crs?.['madrasaId'] || grp['madrasaId'] || profile.madrasaId || '');
        return allowedMadrasaIds.size > 0 && allowedMadrasaIds.has(grpMadrasaId);
      });

      const groupMap = new Map<string, EntityRecord>();
      inchargeGroups.forEach(g => groupMap.set(String(g.id), g));
      assignedGroupEntities.forEach(g => groupMap.set(String(g.id), g));

      scopedClassGroups = Array.from(groupMap.values());
    }

    let presentTotal = 0;
    let absentTotal = 0;
    let lateTotal = 0;
    let leaveTotal = 0;
    let takenGroupsCount = 0;
    let pendingGroupsCount = 0;

    const madrasaMap = new Map<string, { total: number; taken: number; pending: number; name: string }>();

    const groupStatuses: ClassGroupAttendanceStatus[] = scopedClassGroups.map(grp => {
      const cls = allClasses.find(c => c.id === grp['classId']);
      const crs = allCourses.find(c => c.id === (grp['courseId'] || cls?.['courseId']));
      const grpMadrasaId = String(cls?.['madrasaId'] || crs?.['madrasaId'] || grp['madrasaId'] || profile.madrasaId || '');
      const madrasaObj = allMadrasas.find(m =>
        String(m.id) === grpMadrasaId ||
        String(m['docId']) === grpMadrasaId ||
        String(m['code']) === grpMadrasaId
      );
      const rawMName = madrasaObj?.['name'] || madrasaObj?.['title'] || madrasaObj?.['madrasaName'] || grp['madrasaName'] || cls?.['madrasaName'] || '';
      const madrasaName = (rawMName && rawMName !== grpMadrasaId) ? rawMName : 'Madrasa';

      const groupStudents = allStudents.filter(st => {
        if (!this.isEntityActive(st)) return false;
        const gIds = [
          st['groupId'], st['classGroupId'], st['assignedGroupId'], st['group'], st['sectionId'],
          ...(Array.isArray(st['groupIds']) ? st['groupIds'] : []),
          ...(Array.isArray(st['classGroupIds']) ? st['classGroupIds'] : [])
        ].filter(Boolean).map(String);

        if (gIds.includes(String(grp.id))) return true;
        if (Array.isArray(grp['studentIds']) && grp['studentIds'].map(String).includes(String(st.id))) return true;
        return false;
      });

      const calcTotalStudents = groupStudents.length || Number(grp['studentCount'] || grp['totalStudents'] || grp['totalStudentCount'] || 0);

      let assignedStaffName = '';
      const directStaff = grp['assignedStaffName'] || grp['teacherName'] || grp['staffName'] || grp['assignedTeacherName'] || grp['inchargeName'];
      if (typeof directStaff === 'string' && directStaff.trim()) {
        assignedStaffName = directStaff.trim();
      } else if (Array.isArray(grp['assignedStaffNames']) && grp['assignedStaffNames'].length > 0) {
        assignedStaffName = grp['assignedStaffNames'].join(', ');
      } else if (Array.isArray(grp['teacherNames']) && grp['teacherNames'].length > 0) {
        assignedStaffName = grp['teacherNames'].join(', ');
      } else {
        const allUserEntities = [
          ...(Array.isArray(data['users']) ? data['users'] : []),
          ...(Array.isArray(data['teachers']) ? data['teachers'] : []),
          ...(Array.isArray(data['staff']) ? data['staff'] : []),
          ...(Array.isArray(data['profiles']) ? data['profiles'] : [])
        ] as EntityRecord[];

        const staffTokens = [
          ...(Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'] : []),
          ...(Array.isArray(grp['teacherUids']) ? grp['teacherUids'] : []),
          ...(Array.isArray(grp['staffIds']) ? grp['staffIds'] : []),
          ...(Array.isArray(grp['inchargeIds']) ? grp['inchargeIds'] : []),
          ...(grp['teacherUid'] ? [grp['teacherUid']] : []),
          ...(grp['assignedStaffId'] ? [grp['assignedStaffId']] : [])
        ].map(v => String(v || '').trim()).filter(Boolean);

        if (staffTokens.length > 0) {
          const names: string[] = [];
          staffTokens.forEach(stToken => {
            const foundUser = allUserEntities.find(u =>
              String(u.id) === stToken ||
              String(u['uid']) === stToken ||
              String(u['email']) === stToken
            );
            if (foundUser) {
              const uName = foundUser['displayName'] || foundUser['name'] || foundUser['fullName'] || foundUser['email'];
              if (uName && !names.includes(String(uName))) {
                names.push(String(uName));
              }
            }
          });
          if (names.length > 0) {
            assignedStaffName = names.join(', ');
          }
        }
      }

      const attRecord = allAttendance.find(a => {
        const matchGroup = a['groupId'] === grp.id || a['classGroupId'] === grp.id || a['classPlanId'] === grp.id || String(a.id).includes(String(grp.id));
        if (!matchGroup) return false;

        const recDate = String(a['date'] || a['dateStr'] || a['selectedDate'] || '');
        if (recDate === dateStr) return true;
        if (String(a.id).includes(dateStr)) return true;
        if (a['createdAt']) {
          const rawCreated: any = a['createdAt'];
          const cDate = new Date(typeof rawCreated?.toDate === 'function' ? rawCreated.toDate() : rawCreated);
          const cStr = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, '0')}-${String(cDate.getDate()).padStart(2, '0')}`;
          if (cStr === dateStr) return true;
        }
        return false;
      });

      let isTaken = false;
      let takenByName = '';
      let takenAtText = '';
      let groupPresent = 0;
      let groupAbsent = 0;
      let groupLate = 0;
      let groupLeave = 0;

      if (attRecord) {
        const records = attRecord['records'] || attRecord['students'] || attRecord['attendanceMap'];
        const hasRecords = records && (typeof records === 'object') && Object.keys(records).length > 0;
        if (hasRecords || attRecord['takenByName'] || attRecord['recordedByName'] || attRecord['status'] === 'completed') {
          isTaken = true;
          takenByName = attRecord['takenByName'] || attRecord['recordedByName'] || attRecord['takenBy'] || 'Teacher';

          if (attRecord['takenAt'] || attRecord['updatedAt']) {
            const t: any = attRecord['takenAt'] || attRecord['updatedAt'];
            const d = new Date(typeof t?.toDate === 'function' ? t.toDate() : t);
            takenAtText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            takenAtText = 'Today';
          }

          if (records && typeof records === 'object') {
            Object.values(records).forEach((r: any) => {
              const st = String(r?.status || r || '').toLowerCase();
              if (st === 'present' || st === 'p') groupPresent++;
              else if (st === 'absent' || st === 'a') groupAbsent++;
              else if (st === 'late' || st === 'l') groupLate++;
              else if (st === 'leave' || st === 'excused') groupLeave++;
            });
          }
        }
      }

      if (isTaken) {
        takenGroupsCount++;
        presentTotal += groupPresent;
        absentTotal += groupAbsent;
        lateTotal += groupLate;
        leaveTotal += groupLeave;
      } else {
        pendingGroupsCount++;
      }

      const mKey = grpMadrasaId || 'default';
      if (!madrasaMap.has(mKey)) {
        madrasaMap.set(mKey, { total: 0, taken: 0, pending: 0, name: madrasaName });
      }
      const mStats = madrasaMap.get(mKey)!;
      mStats.total++;
      if (isTaken) mStats.taken++;
      else mStats.pending++;

      return {
        groupId: String(grp.id),
        groupName: String(grp['name'] || grp['title'] || 'Class Group'),
        classId: grp['classId'],
        className: cls?.['name'] || 'Class',
        madrasaId: grpMadrasaId,
        madrasaName,
        isTaken,
        takenByName: takenByName || undefined,
        takenAtText: takenAtText || undefined,
        presentCount: groupPresent,
        absentCount: groupAbsent,
        lateCount: groupLate,
        leaveCount: groupLeave,
        totalStudents: calcTotalStudents,
        assignedStaffName: assignedStaffName || undefined
      };
    });

    const totalGroups = scopedClassGroups.length;
    const completionRate = totalGroups > 0 ? Math.round((takenGroupsCount / totalGroups) * 100) : 0;
    const totalStudentsRecorded = presentTotal + absentTotal + lateTotal + leaveTotal;
    const overallPresentPercentage = totalStudentsRecorded > 0 ? Math.round((presentTotal / totalStudentsRecorded) * 100) : 0;

    const madrasaBreakdown = Array.from(madrasaMap.entries()).map(([mId, stats]) => ({
      madrasaId: mId,
      madrasaName: stats.name,
      totalGroups: stats.total,
      takenGroups: stats.taken,
      pendingGroups: stats.pending
    }));

    this.isAttendanceLoading = false;

    return {
      dateStr,
      formattedDate,
      totalGroups,
      takenGroupsCount,
      pendingGroupsCount,
      completionRate,
      presentTotal,
      absentTotal,
      lateTotal,
      leaveTotal,
      totalStudentsRecorded,
      overallPresentPercentage,
      groupStatuses,
      madrasaBreakdown
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

  private statsForRole(role: string, data: Record<string, EntityRecord[]>, profile?: AppUser): DashboardStat[] {
    // Normalize role to handle casing variants (e.g. 'superAdmin', 'superadmin', 'super_admin')
    const normalizedRole = (role || '').toLowerCase().replace(/_/g, '');
    const isSuperAdmin = normalizedRole === 'superadmin';
    const isOrgAdmin = normalizedRole === 'organizationadmin';
    const isMadrasaIncharge = normalizedRole === 'madrasaincharge';
    const isTeacherOrStaff = ['teacher', 'staff', 'ustadh', 'teacherassistant'].includes(normalizedRole);

    let classGroupCount = data['classGroups']?.length ?? 0;
    let studentCount = data['students']?.length ?? 0;
    let staffCount = data['staff']?.length ?? 0;
    let classCount = data['classes']?.length ?? 0;
    let madrasaCount = data['madrasas']?.length ?? 0;

    if (isMadrasaIncharge && profile) {
      // Use STRICTLY inchargeMadrasaIds if populated so Madrasas where the user is ONLY a staff/teacher are EXCLUDED!
      const rawInchargeIds: string[] = (Array.isArray((profile as any)?.inchargeMadrasaIds) && (profile as any).inchargeMadrasaIds.length > 0)
        ? (profile as any).inchargeMadrasaIds
        : (Array.isArray((profile as any)?.madrasaIds) ? (profile as any).madrasaIds : [(profile as any)?.madrasaId].filter(Boolean));

      const inchargeMadrasaIds = new Set<string>(rawInchargeIds.map(String));

      if (inchargeMadrasaIds.size > 0) {
        if (Array.isArray(data['classGroups'])) {
          classGroupCount = data['classGroups'].filter(cg => {
            const cgMadrasaId = String(cg['madrasaId'] || cg['assignedMadrasaId'] || '');
            return cgMadrasaId && inchargeMadrasaIds.has(cgMadrasaId);
          }).length;
        }

        if (Array.isArray(data['students'])) {
          studentCount = data['students'].filter(st => {
            const stMadrasaId = String(st['madrasaId'] || st['assignedMadrasaId'] || '');
            return stMadrasaId && inchargeMadrasaIds.has(stMadrasaId);
          }).length;
        }

        if (Array.isArray(data['staff'])) {
          staffCount = data['staff'].filter(st => {
            const stMadrasaId = String(st['madrasaId'] || st['assignedMadrasaId'] || '');
            return stMadrasaId && inchargeMadrasaIds.has(stMadrasaId);
          }).length;
        }

        if (Array.isArray(data['classes'])) {
          classCount = data['classes'].filter(cls => {
            const clsMadrasaId = String(cls['madrasaId'] || cls['assignedMadrasaId'] || '');
            return clsMadrasaId && inchargeMadrasaIds.has(clsMadrasaId);
          }).length;
        }

        if (Array.isArray(data['madrasas'])) {
          madrasaCount = data['madrasas'].filter(m => inchargeMadrasaIds.has(String(m.id))).length;
        }
      }
    }

    const allStats: DashboardStat[] = [
      { label: 'Organizations', value: data['organizations']?.length ?? 0, icon: 'business-outline', tone: 'success' },
      { label: 'Madrasas', value: madrasaCount, icon: 'school-outline', tone: 'primary' },
      { label: 'Users', value: data['users']?.length ?? 0, icon: 'people-outline', tone: 'warning' },
      { label: 'Coordinators', value: data['coordinators']?.length ?? 0, icon: 'star-outline', tone: 'primary' },
      { label: 'Madrasa Incharges', value: data['incharges']?.length ?? 0, icon: 'shield-checkmark-outline', tone: 'success' },
      { label: 'Students', value: studentCount, icon: 'person-outline', tone: 'success' },
      { label: 'Parents', value: data['parents']?.length ?? 0, icon: 'people-circle-outline', tone: 'primary' },
      { label: 'Staff', value: staffCount, icon: 'briefcase-outline', tone: 'warning' },
      { label: 'Courses', value: data['courses']?.length ?? 0, icon: 'library-outline', tone: 'success' },
      { label: 'Classes', value: classCount, icon: 'easel-outline', tone: 'primary' },
      { label: 'Class Groups', value: classGroupCount, icon: 'people-outline', tone: 'purple' },
      { label: 'Subjects', value: data['subjects']?.length ?? 0, icon: 'book-outline', tone: 'warning' },
    ];

    if (isSuperAdmin) return allStats;

    if (isOrgAdmin) {
      // Organization Admin sees overall madrasa data across the organization (all stats except Organizations total)
      return allStats.filter(s => s.label !== 'Organizations');
    }

    if (isMadrasaIncharge) {
      // Madrasa Incharge sees statistics relevant to their madrasas only
      const inchargeLabels = ['Madrasas', 'Students', 'Staff', 'Classes', 'Class Groups', 'Subjects', 'Courses'];
      return allStats.filter(s => inchargeLabels.includes(s.label));
    }

    if (isTeacherOrStaff) {
      // Teachers & staff see stats scoped to their assigned classes/courses/students/subjects (Class Groups card removed)
      const teacherLabels = ['Students', 'Classes', 'Courses', 'Subjects'];
      return allStats.filter(s => teacherLabels.includes(s.label));
    }

    return [];
  }

  private attendanceSummary(records: AttendanceRecord[], todayAtt?: TodayAttendanceOverview): DashboardVm['attendance'] {
    let present = records.filter((record) => record.status === 'present').length;
    let absent = records.filter((record) => record.status === 'absent').length;
    let late = records.filter((record) => record.status === 'late').length;
    let leave = records.filter((record) => record.status === 'leave').length;
    let total = records.length;
    let isToday = false;

    if (total === 0 && todayAtt && todayAtt.totalStudentsRecorded > 0) {
      present = todayAtt.presentTotal;
      absent = todayAtt.absentTotal;
      late = todayAtt.lateTotal;
      leave = todayAtt.leaveTotal;
      total = todayAtt.totalStudentsRecorded;
      isToday = true;
    }

    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return {
      present,
      absent,
      late,
      leave,
      total,
      rate,
      isToday
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

  private formatRole(role: string | null | undefined, profile?: AppUser): string {
    const roles: string[] = Array.isArray((profile as any)?.roles) && (profile as any).roles.length > 0
      ? (profile as any).roles
      : (role ? [role] : []);

    if (roles.length === 0) return 'User';

    const formattedList = roles.map(r => {
      const label = (ROLE_LABELS as Record<string, string>)[r];
      if (label) return label;
      const normalized = r.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
      return normalized
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });

    return Array.from(new Set(formattedList)).join(' • ');
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
