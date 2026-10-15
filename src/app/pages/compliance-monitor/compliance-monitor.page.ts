import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest, Subject, from, of, Subscription } from 'rxjs';
import { catchError, map, takeUntil, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { where } from 'firebase/firestore';
import { formatDate } from '@angular/common';
import { AppUser, ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export type ComplianceStatus = 'entered' | 'not-entered';

export interface TimetableSlotInfo {
  title: string;
  time?: string;
  teacherName?: string;
  subjectName?: string;
}

export interface ClassGroupComplianceRow {
  groupId: string;
  groupName: string;
  classId?: string;
  className: string;
  madrasaId: string;
  madrasaName: string;
  assignedStaffName: string;
  hasTimetable: boolean;
  timetableCount: number;
  timetableSlots: TimetableSlotInfo[];
  attendanceStatus: ComplianceStatus;
  attendanceTakenBy?: string;
  attendanceTakenAt?: string;
  presentCount: number;
  absentCount: number;
  totalStudents: number;
  evaluationStatus: ComplianceStatus;
  evaluationCount: number;
  evaluationEnteredBy?: string;
}

export interface MadrasaComplianceGroup {
  madrasaId: string;
  madrasaName: string;
  rows: ClassGroupComplianceRow[];
  totalGroups: number;
  attendanceEnteredCount: number;
  evaluationEnteredCount: number;
  timetableConfiguredCount: number;
}

@Component({
  selector: 'app-compliance-monitor',
  templateUrl: './compliance-monitor.page.html',
  styleUrls: ['./compliance-monitor.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ComplianceMonitorPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private loadSubscription?: Subscription;
  readonly searchSubject$ = new Subject<string>();

  profile: AppUser | null = null;
  isLoading = false;
  hasLoaded = false;
  error: string | null = null;

  readonly today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999);
  readonly todayStr = this.toDateStr(new Date());
  readonly yesterdayStr = this.toDateStr(new Date(Date.now() - 86400000));

  selectedDate: Date = new Date();
  selectedDateStr: string = this.toDateStr(new Date());
  formattedDate: string = this.formatDateDisplay(new Date());
  selectedDayName: string = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  selectedDayFullName: string = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  isToday = true;

  searchInput = '';
  debouncedSearchQuery = '';
  statusFilter: 'all' | 'attendance-missing' | 'evaluation-missing' | 'timetable-missing' | 'both-missing' | 'all-ok' = 'all';
  madrasaFilter = '';
  viewMode: 'flat' | 'grouped' = 'grouped';
  expandedRowId: string | null = null;

  // Raw source collections
  allRows: ClassGroupComplianceRow[] = [];
  madrasaGroups: MadrasaComplianceGroup[] = [];

  // Pre-computed filtered lists (stored as properties to guarantee stable object references and prevent NG0103)
  filteredRows: ClassGroupComplianceRow[] = [];
  filteredMadrasaGroups: MadrasaComplianceGroup[] = [];
  allMadrasas: { id: string; name: string }[] = [];

  // Summary counts (stored as properties rather than getters for max performance)
  totalGroups = 0;
  attendanceEnteredCount = 0;
  attendanceMissingCount = 0;
  evaluationEnteredCount = 0;
  evaluationMissingCount = 0;
  timetableConfiguredCount = 0;
  timetableMissingCount = 0;
  bothMissingCount = 0;
  allCompliantCount = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Debounce search input by 400ms to adhere to high-traffic debouncing guidelines
    this.searchSubject$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.debouncedSearchQuery = query;
      this.applyFilters();
      this.cdr.markForCheck();
    });

    this.auth.profile$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged((a, b) => a?.uid === b?.uid)
    ).subscribe(profile => {
      this.profile = profile;
      if (profile) this.loadData();
    });
  }

  ngOnDestroy(): void {
    if (this.loadSubscription) {
      this.loadSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(val: string): void {
    this.searchInput = val;
    this.searchSubject$.next(val);
  }

  clearSearch(): void {
    this.searchInput = '';
    this.debouncedSearchQuery = '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  clearAllFilters(): void {
    this.statusFilter = 'all';
    this.searchInput = '';
    this.debouncedSearchQuery = '';
    this.madrasaFilter = '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onDateChange(date: Date | null): void {
    if (!date) return;
    const normalized = this.normalizeDate(date);
    const newStr = this.toDateStr(normalized);
    if (this.selectedDateStr === newStr) return;
    this.updateSelectedDate(normalized);
    this.loadData();
  }

  previousDay(): void {
    const prev = new Date(this.selectedDate);
    prev.setDate(prev.getDate() - 1);
    this.updateSelectedDate(this.normalizeDate(prev));
    this.loadData();
  }

  nextDay(): void {
    const next = new Date(this.selectedDate);
    next.setDate(next.getDate() + 1);
    if (this.toDateStr(next) > this.todayStr) return;
    this.updateSelectedDate(this.normalizeDate(next));
    this.loadData();
  }

  goToToday(): void {
    if (this.isToday) return;
    this.updateSelectedDate(this.normalizeDate(new Date()));
    this.loadData();
  }

  goToYesterday(): void {
    const yest = new Date(Date.now() - 86400000);
    const yestStr = this.toDateStr(yest);
    if (this.selectedDateStr === yestStr) return;
    this.updateSelectedDate(this.normalizeDate(yest));
    this.loadData();
  }

  private updateSelectedDate(date: Date): void {
    // Lock to noon local time so timezone/DST shifts never shift the day
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    this.selectedDate = d;
    this.selectedDateStr = this.toDateStr(d);
    this.formattedDate = this.formatDateDisplay(d);
    this.selectedDayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    this.selectedDayFullName = d.toLocaleDateString('en-US', { weekday: 'long' });
    this.isToday = this.selectedDateStr === this.todayStr;
  }

  private normalizeDate(val: any): Date {
    if (!val) return new Date();
    if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
    if (typeof val?.toDate === 'function') return val.toDate();
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') {
      const parts = val.trim().split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d, 12, 0, 0, 0);
      }
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }

  private extractDateStr(item: any): string | null {
    if (!item) return null;
    const direct = item['date'] || item['dateStr'] || item['selectedDate'] || item['dateKey'];
    if (typeof direct === 'string' && direct.trim()) {
      const match = direct.trim().match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }
    const timestamp = item['takenAt'] || item['createdAt'] || item['dateTimestamp'] || item['timestamp'] || item['updatedAt'];
    if (timestamp) {
      try {
        let d: Date | null = null;
        if (typeof timestamp.toDate === 'function') d = timestamp.toDate();
        else if (timestamp.seconds !== undefined) d = new Date(timestamp.seconds * 1000);
        else if (typeof timestamp === 'string' || typeof timestamp === 'number') d = new Date(timestamp);
        if (d && !isNaN(d.getTime())) {
          return this.toDateStr(d);
        }
      } catch {}
    }
    return null;
  }

  setStatusFilter(f: typeof this.statusFilter): void {
    if (this.statusFilter === f) return;
    this.statusFilter = f;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  setViewMode(m: 'flat' | 'grouped'): void {
    if (this.viewMode === m) return;
    this.viewMode = m;
    this.cdr.markForCheck();
  }

  setMadrasaFilter(id: string): void {
    const newVal = id || '';
    if (this.madrasaFilter === newVal) return;
    this.madrasaFilter = newVal;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onMadrasaChange(val: string): void {
    const newVal = val || '';
    if (this.madrasaFilter === newVal) return;
    this.madrasaFilter = newVal;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  toggleExpandRow(groupId: string): void {
    this.expandedRowId = this.expandedRowId === groupId ? null : groupId;
    this.cdr.markForCheck();
  }

  openClassroomSuite(row: ClassGroupComplianceRow): void {
    this.router.navigate(['/classroom-suite'], {
      queryParams: {
        madrasaId: row.madrasaId,
        classId: row.classId,
        groupId: row.groupId,
        date: this.selectedDateStr
      }
    });
  }

  refresh(): void {
    this.repo.clearCache();
    this.loadData();
  }

  loadData(): void {
    if (!this.profile) return;
    if (this.loadSubscription) {
      this.loadSubscription.unsubscribe();
    }
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    const profile = this.profile;
    const dateStr = this.selectedDateStr;
    const dayOfWeek = this.selectedDayFullName;

    this.loadSubscription = combineLatest({
      classGroups: from(this.repo.getAllOnce<EntityRecord>('classGroups', profile)).pipe(catchError(() => of([]))),
      classes: from(this.repo.getAllOnce<EntityRecord>('classes', profile)).pipe(catchError(() => of([]))),
      madrasas: from(this.repo.getAllOnce<EntityRecord>('madrasas', profile)).pipe(catchError(() => of([]))),
      users: from(this.repo.getAllOnce<EntityRecord>('users', profile)).pipe(catchError(() => of([]))),
      staff: from(this.repo.getAllOnce<EntityRecord>('staff', profile)).pipe(catchError(() => of([]))),
      students: from(this.repo.getAllOnce<EntityRecord>('students', profile)).pipe(catchError(() => of([]))),
      classPlans: from(this.repo.getAllOnce<EntityRecord & ClassPlan>('classPlans', profile)).pipe(catchError(() => of([]))),
      timetableEntries: from(this.repo.getAllOnce<EntityRecord & TimetableEntry>('timetableEntries', profile)).pipe(catchError(() => of([]))),
      attendance: from(
        (async () => {
          try {
            const dateFiltered = await this.repo.getAllOnce<EntityRecord>(
              'attendance',
              profile,
              { forceRefresh: true },
              [where('date', '==', dateStr)]
            );
            if (dateFiltered && dateFiltered.length > 0) {
              return dateFiltered;
            }
          } catch (e) {
            console.warn('[ComplianceMonitor] where(date) attendance query failed, falling back:', e);
          }
          return this.repo.getAllOnce<EntityRecord>('attendance', profile, { forceRefresh: true });
        })()
      ).pipe(catchError(() => of([]))),
      studentProgress: from(
        (async () => {
          try {
            const dateFiltered = await this.repo.getAllOnce<EntityRecord>(
              'studentDailyProgress',
              profile,
              { forceRefresh: true },
              [where('date', '==', dateStr)]
            );
            if (dateFiltered && dateFiltered.length > 0) {
              return dateFiltered;
            }
          } catch (e) {
            console.warn('[ComplianceMonitor] where(date) progress query failed, falling back:', e);
          }
          return this.repo.getAllOnce<EntityRecord>('studentDailyProgress', profile, { forceRefresh: true });
        })()
      ).pipe(catchError(() => of([]))),
    }).pipe(
      takeUntil(this.destroy$),
      map(data => this.buildComplianceRows(data, profile, dateStr, dayOfWeek))
    ).subscribe({
      next: ({ rows, groups }) => {
        this.allRows = rows;
        this.madrasaGroups = groups;
        this.computeStats();
        this.applyFilters();
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[ComplianceMonitor] Load error', err);
        this.error = 'Failed to load compliance data. Please try again.';
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.markForCheck();
      }
    });
  }

  private computeStats(): void {
    const rows = this.allRows;
    this.totalGroups = rows.length;
    this.attendanceEnteredCount = rows.filter(r => r.attendanceStatus === 'entered').length;
    this.attendanceMissingCount = rows.filter(r => r.attendanceStatus === 'not-entered').length;
    this.evaluationEnteredCount = rows.filter(r => r.evaluationStatus === 'entered').length;
    this.evaluationMissingCount = rows.filter(r => r.evaluationStatus === 'not-entered').length;
    this.timetableConfiguredCount = rows.filter(r => r.hasTimetable).length;
    this.timetableMissingCount = rows.filter(r => !r.hasTimetable).length;
    this.bothMissingCount = rows.filter(r => r.attendanceStatus === 'not-entered' && r.evaluationStatus === 'not-entered').length;
    this.allCompliantCount = rows.filter(r => r.attendanceStatus === 'entered' && r.evaluationStatus === 'entered' && r.hasTimetable).length;

    const seen = new Set<string>();
    this.allMadrasas = rows
      .filter(r => { if (seen.has(r.madrasaId)) return false; seen.add(r.madrasaId); return true; })
      .map(r => ({ id: r.madrasaId, name: r.madrasaName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  applyFilters(): void {
    let list = this.allRows;

    if (this.madrasaFilter) {
      list = list.filter(r => r.madrasaId === this.madrasaFilter);
    }

    if (this.statusFilter === 'attendance-missing') {
      list = list.filter(r => r.attendanceStatus === 'not-entered');
    } else if (this.statusFilter === 'evaluation-missing') {
      list = list.filter(r => r.evaluationStatus === 'not-entered');
    } else if (this.statusFilter === 'timetable-missing') {
      list = list.filter(r => !r.hasTimetable);
    } else if (this.statusFilter === 'both-missing') {
      list = list.filter(r => r.attendanceStatus === 'not-entered' && r.evaluationStatus === 'not-entered');
    } else if (this.statusFilter === 'all-ok') {
      list = list.filter(r => r.attendanceStatus === 'entered' && r.evaluationStatus === 'entered');
    }

    if (this.debouncedSearchQuery.trim()) {
      const q = this.debouncedSearchQuery.trim().toLowerCase();
      list = list.filter(r =>
        r.groupName.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        r.madrasaName.toLowerCase().includes(q) ||
        r.assignedStaffName.toLowerCase().includes(q)
      );
    }

    this.filteredRows = list;

    const filteredRowIds = new Set(list.map(r => r.groupId));
    this.filteredMadrasaGroups = this.madrasaGroups
      .map(mg => {
        const matchingRows = mg.rows.filter(r => filteredRowIds.has(r.groupId));
        return {
          ...mg,
          rows: matchingRows,
          attendanceEnteredCount: matchingRows.filter(r => r.attendanceStatus === 'entered').length,
          evaluationEnteredCount: matchingRows.filter(r => r.evaluationStatus === 'entered').length,
          timetableConfiguredCount: matchingRows.filter(r => r.hasTimetable).length,
        };
      })
      .filter(mg => mg.rows.length > 0);
  }

  private buildComplianceRows(
    data: Record<string, EntityRecord[]>,
    profile: AppUser,
    dateStr: string,
    dayOfWeek: string
  ): { rows: ClassGroupComplianceRow[]; groups: MadrasaComplianceGroup[] } {

    const classGroups = data['classGroups'] || [];
    const classes = data['classes'] || [];
    const madrasas = data['madrasas'] || [];
    const users = [...(data['users'] || []), ...(data['staff'] || [])];
    const students = data['students'] || [];
    const classPlans = (data['classPlans'] || []) as (EntityRecord & ClassPlan)[];
    const timetableEntries = (data['timetableEntries'] || []) as (EntityRecord & TimetableEntry)[];
    const attendanceRecords = data['attendance'] || [];
    const progressRecords = data['studentProgress'] || [];

    const activeGroups = classGroups.filter(g => {
      const status = String(g['status'] || '').toLowerCase();
      return !['inactive', 'deleted', 'archived', 'disabled'].includes(status);
    });

    const rows: ClassGroupComplianceRow[] = activeGroups.map(grp => {
      const cls = classes.find(c => c.id === grp['classId']);
      const grpMadrasaId = String(cls?.['madrasaId'] || grp['madrasaId'] || '');
      const madrasaObj = madrasas.find(m => String(m.id) === grpMadrasaId);
      const madrasaName = madrasaObj
        ? String(madrasaObj['name'] || madrasaObj['title'] || grpMadrasaId)
        : (grp['madrasaName'] ? String(grp['madrasaName']) : 'Unknown Madrasa');

      // Timetable check for selected day of week
      const groupPlans = classPlans.filter(p =>
        String(p['groupId'] || '') === String(grp.id) ||
        String(p['classGroupId'] || '') === String(grp.id) ||
        String(p['classId'] || '') === String(grp['classId'] || '')
      );
      const planIds = new Set(groupPlans.map(p => String(p.id)));

      const groupTimetableEntries = timetableEntries.filter(e => {
        const matchesGroup =
          String(e['groupId'] || '') === String(grp.id) ||
          planIds.has(String(e['classPlanId'] || ''));
        if (!matchesGroup) return false;
        if ((e as any).status === 'deleted') return false;

        const eDay = String(e['dayOfWeek'] || e['day'] || '').trim().toLowerCase();
        const fullDay = dayOfWeek.toLowerCase();
        const shortDay = fullDay.slice(0, 3);

        const matchesDay =
          !eDay ||
          eDay === fullDay ||
          eDay === shortDay ||
          (Array.isArray(e['daysOfWeek']) && e['daysOfWeek'].some((d: any) => {
            const dStr = String(d || '').trim().toLowerCase();
            return dStr === fullDay || dStr === shortDay;
          })) ||
          (Array.isArray(e['days']) && e['days'].some((d: any) => {
            const dStr = String(d || '').trim().toLowerCase();
            return dStr === fullDay || dStr === shortDay;
          }));

        return matchesDay;
      });

      const hasTimetable = groupTimetableEntries.length > 0;
      const timetableCount = groupTimetableEntries.length;
      const timetableSlots: TimetableSlotInfo[] = groupTimetableEntries.map(e => {
        const time = e.startTime && e.endTime ? `${e.startTime} - ${e.endTime}` : (e.startTime || '');
        let teacherName = '';
        if (e.teacherId) {
          const foundTeacher = users.find(u => String(u.id) === String(e.teacherId) || String(u['uid']) === String(e.teacherId));
          teacherName = String(foundTeacher?.['displayName'] || foundTeacher?.['name'] || foundTeacher?.['email'] || '');
        }
        return {
          title: String(e.activityName || e.subjectName || 'Scheduled Period'),
          time,
          teacherName,
          subjectName: e.subjectName ? String(e.subjectName) : undefined
        };
      });

      // Staff resolution (with fallback to timetable teachers and duplicate name cleanup)
      const assignedStaffName = this.resolveStaffName(grp, users, groupTimetableEntries);

      // Attendance check (strictly matching the selected date)
      const groupAttRecords = attendanceRecords.filter(a => {
        const matchGroup =
          a['groupId'] === grp.id ||
          a['classGroupId'] === grp.id ||
          planIds.has(String(a['classPlanId'] || '')) ||
          Array.from(planIds).some(pid => String(a.id).includes(pid)) ||
          String(a.id).includes(String(grp.id));
        if (!matchGroup) return false;

        const recDate = this.extractDateStr(a);
        if (recDate === dateStr) return true;
        if (String(a.id).includes(dateStr)) return true;
        return false;
      });

      let attendanceStatus: ComplianceStatus = 'not-entered';
      let attendanceTakenBy: string | undefined;
      let attendanceTakenAt: string | undefined;
      let presentCount = 0;
      let absentCount = 0;

      if (groupAttRecords.length > 0) {
        const completedRecord = groupAttRecords.find(a => {
          const recs = a['records'] || a['students'] || a['attendanceMap'];
          const hasRecs = recs && typeof recs === 'object' && Object.keys(recs).length > 0;
          return hasRecs || a['takenByName'] || a['status'] === 'completed' || a['attendanceStatus'] === 'confirmed';
        });

        const activeRec = completedRecord || groupAttRecords[0];
        const records = activeRec['records'] || activeRec['students'] || activeRec['attendanceMap'];
        const hasRecords = records && typeof records === 'object' && Object.keys(records).length > 0;

        if (completedRecord || hasRecords || activeRec['takenByName'] || activeRec['status'] === 'completed' || activeRec['attendanceStatus'] === 'confirmed') {
          attendanceStatus = 'entered';
          attendanceTakenBy = activeRec['takenByName'] || activeRec['recordedByName'] || activeRec['takenBy'] || 'Teacher';

          const t: any = activeRec['takenAt'] || activeRec['updatedAt'] || activeRec['createdAt'];
          if (t) {
            const d = new Date(typeof t?.toDate === 'function' ? t.toDate() : (t.seconds ? t.seconds * 1000 : t));
            if (!isNaN(d.getTime())) {
              attendanceTakenAt = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }

          if (records && typeof records === 'object') {
            if (Array.isArray(records)) {
              records.forEach((r: any) => {
                const st = String(r?.status || r?.attendanceStatus || '').toLowerCase();
                if (st === 'present' || st === 'p') presentCount++;
                else if (st === 'absent' || st === 'a') absentCount++;
              });
            } else {
              Object.values(records).forEach((r: any) => {
                const st = String(r?.status || r?.attendanceStatus || r || '').toLowerCase();
                if (st === 'present' || st === 'p') presentCount++;
                else if (st === 'absent' || st === 'a') absentCount++;
              });
            }
          }
          if (presentCount === 0 && absentCount === 0 && activeRec['summary']) {
            presentCount = Number(activeRec['summary']['present'] || 0);
            absentCount = Number(activeRec['summary']['absent'] || 0);
          }
        }
      }

      // Student count
      const groupStudents = students.filter(st => {
        const gIds = [
          st['groupId'], st['classGroupId'], st['assignedGroupId'],
          ...(Array.isArray(st['groupIds']) ? st['groupIds'] : []),
          ...(Array.isArray(st['classGroupIds']) ? st['classGroupIds'] : []),
        ].filter(Boolean).map(String);
        if (gIds.includes(String(grp.id))) return true;
        if (Array.isArray(grp['studentIds']) && grp['studentIds'].map(String).includes(String(st.id))) return true;
        return false;
      });
      const totalStudents = groupStudents.length || Number(grp['studentCount'] || grp['totalStudents'] || 0);

      // Evaluation / Progress check (strictly filtered to selected date)
      const groupStudentIds = new Set(groupStudents.map(s => String(s.id)));
      const groupProgressRecords = progressRecords.filter(p => {
        const pDate = this.extractDateStr(p);
        const matchesDate = pDate === dateStr || String(p.id).includes(dateStr);
        if (!matchesDate) return false;

        if (String(p['groupId'] || '') === String(grp.id) || String(p['classGroupId'] || '') === String(grp.id)) return true;
        return groupStudentIds.has(String(p['studentId'] || ''));
      });

      let evaluationStatus: ComplianceStatus = 'not-entered';
      let evaluationEnteredBy: string | undefined;
      const evaluationCount = groupProgressRecords.length;

      if (evaluationCount > 0) {
        evaluationStatus = 'entered';
        const first = groupProgressRecords[0];
        evaluationEnteredBy = String(first['teacherName'] || first['enteredBy'] || first['staffName'] || first['recordedByName'] || '');
        if (!evaluationEnteredBy) {
          const tid = String(first['teacherId'] || first['staffId'] || first['recordedByUid'] || '');
          if (tid) {
            const found = users.find(u => String(u.id) === tid || String(u['uid']) === tid);
            evaluationEnteredBy = found
              ? String(found['displayName'] || found['name'] || found['email'] || '')
              : undefined;
          }
        }
      }

      return {
        groupId: String(grp.id),
        groupName: String(grp['name'] || grp['title'] || 'Class Group'),
        classId: grp['classId'],
        className: String(cls?.['name'] || grp['className'] || 'Class'),
        madrasaId: grpMadrasaId,
        madrasaName,
        assignedStaffName,
        hasTimetable,
        timetableCount,
        timetableSlots,
        attendanceStatus,
        attendanceTakenBy,
        attendanceTakenAt,
        presentCount,
        absentCount,
        totalStudents,
        evaluationStatus,
        evaluationCount,
        evaluationEnteredBy,
      };
    });

    // Group by madrasa
    const madrasaMap = new Map<string, MadrasaComplianceGroup>();
    rows.forEach(row => {
      const mId = row.madrasaId || 'unknown';
      if (!madrasaMap.has(mId)) {
        madrasaMap.set(mId, {
          madrasaId: mId,
          madrasaName: row.madrasaName,
          rows: [],
          totalGroups: 0,
          attendanceEnteredCount: 0,
          evaluationEnteredCount: 0,
          timetableConfiguredCount: 0,
        });
      }
      const mg = madrasaMap.get(mId)!;
      mg.rows.push(row);
      mg.totalGroups++;
      if (row.attendanceStatus === 'entered') mg.attendanceEnteredCount++;
      if (row.evaluationStatus === 'entered') mg.evaluationEnteredCount++;
      if (row.hasTimetable) mg.timetableConfiguredCount++;
    });

    return {
      rows,
      groups: Array.from(madrasaMap.values()).sort((a, b) => a.madrasaName.localeCompare(b.madrasaName))
    };
  }

  private resolveStaffName(
    grp: EntityRecord,
    users: EntityRecord[],
    groupTimetableEntries: (EntityRecord & TimetableEntry)[] = []
  ): string {
    const direct = grp['assignedStaffName'] || grp['teacherName'] || grp['staffName'] || grp['assignedTeacherName'];
    if (typeof direct === 'string' && direct.trim()) return this.cleanStaffNames(direct.trim());
    if (Array.isArray(grp['assignedStaffNames']) && grp['assignedStaffNames'].length > 0) {
      return this.cleanStaffNames(grp['assignedStaffNames'].join(', '));
    }

    const tokens: string[] = [
      ...(Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'] : []),
      ...(Array.isArray(grp['teacherUids']) ? grp['teacherUids'] : []),
      ...(Array.isArray(grp['staffIds']) ? grp['staffIds'] : []),
      ...(grp['teacherUid'] ? [grp['teacherUid']] : []),
      ...(grp['assignedStaffId'] ? [grp['assignedStaffId']] : []),
    ].map(v => String(v || '').trim()).filter(Boolean);

    // If still no staff assigned on group, fallback to teacher in timetable entries for today
    if (tokens.length === 0 && groupTimetableEntries.length > 0) {
      groupTimetableEntries.forEach(e => {
        if (e.teacherId) tokens.push(String(e.teacherId));
        if (Array.isArray(e.teacherIds)) e.teacherIds.forEach(t => tokens.push(String(t)));
      });
    }

    if (tokens.length === 0) return 'Unassigned';

    const names: string[] = [];
    tokens.forEach(tok => {
      const found = users.find(u => String(u.id) === tok || String(u['uid']) === tok || String(u['email']) === tok);
      if (found) {
        const n = String(found['displayName'] || found['name'] || found['fullName'] || found['email'] || '');
        if (n && !names.includes(n)) names.push(n);
      }
    });
    return names.length > 0 ? this.cleanStaffNames(names.join(', ')) : 'Unassigned';
  }

  private cleanStaffNames(raw: string): string {
    if (!raw || !raw.trim()) return 'Unassigned';
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(p);
      }
    }
    return unique.length > 0 ? unique.join(', ') : 'Unassigned';
  }

  private toDateStr(date: Date): string {
    return formatDate(date, 'yyyy-MM-dd', 'en-US');
  }

  private formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  exportReport(type: 'all' | 'attendance' | 'evaluation' | 'timetable' | 'non-compliant'): void {
    let rows: ClassGroupComplianceRow[] = this.filteredRows;
    let label = 'all';

    if (type === 'attendance') {
      rows = this.filteredRows.filter(r => r.attendanceStatus === 'not-entered');
      label = 'missing-attendance';
    } else if (type === 'evaluation') {
      rows = this.filteredRows.filter(r => r.evaluationStatus === 'not-entered');
      label = 'missing-evaluation';
    } else if (type === 'timetable') {
      rows = this.filteredRows.filter(r => !r.hasTimetable);
      label = 'missing-timetable';
    } else if (type === 'non-compliant') {
      rows = this.filteredRows.filter(r => r.attendanceStatus === 'not-entered' || r.evaluationStatus === 'not-entered' || !r.hasTimetable);
      label = 'non-compliant';
    }

    if (rows.length === 0) {
      this.snackBar.open('No data to export for the selected filter.', 'OK', { duration: 3000 });
      return;
    }

    const dayLabel = this.isToday ? 'Today' : this.selectedDayFullName;
    const header = [
      'Class Group',
      'Class',
      'Madrasa',
      'Assigned Staff',
      `Timetable (${dayLabel})`,
      'Attendance Status',
      'Attendance Details',
      'Progress Evaluation Status',
      'Evaluation Details',
      'Date'
    ];

    const csvRows = rows.map(r => [
      r.groupName,
      r.className,
      r.madrasaName,
      r.assignedStaffName || 'Unassigned',
      r.hasTimetable ? `${r.timetableCount} period(s) configured` : `NOT CONFIGURED FOR ${dayLabel.toUpperCase()}`,
      r.attendanceStatus === 'entered' ? 'ENTERED' : 'NOT ENTERED',
      r.attendanceStatus === 'entered'
        ? `By: ${r.attendanceTakenBy || 'Teacher'}${r.attendanceTakenAt ? ' at ' + r.attendanceTakenAt : ''} (${r.presentCount}P / ${r.absentCount}A)`
        : 'Missing',
      r.evaluationStatus === 'entered' ? 'ENTERED' : 'NOT ENTERED',
      r.evaluationStatus === 'entered'
        ? `Recorded for ${r.evaluationCount} student(s)${r.evaluationEnteredBy ? ' by ' + r.evaluationEnteredBy : ''}`
        : 'Missing',
      this.selectedDateStr,
    ]);

    const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-${label}-${this.selectedDateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${rows.length} row(s) to CSV`, 'OK', { duration: 3000 });
  }

  trackByGroup(_: number, row: ClassGroupComplianceRow): string { return row.groupId; }
  trackByMadrasa(_: number, mg: MadrasaComplianceGroup): string { return mg.madrasaId; }
  trackByMadrasaOption(_: number, item: { id: string; name: string }): string { return item.id; }
  trackBySlot(index: number, s: TimetableSlotInfo): string { return s.title + '_' + index; }
}
