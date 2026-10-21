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
  shiftName: string;
  shiftId?: string;
  assignedStaffName: string;
  assignedStaffPhone?: string;
  assignedStaffEmail?: string;
  assignedStaffUid?: string;
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
  evaluationEnteredAt?: string;
  periodSummaryText?: string;
  latestAttendanceDate?: string;
  latestEvaluationDate?: string;
  evaluationCadence?: 'weekly' | 'daily';
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

  // Audit Scope Mode: 'day' | 'week' | 'range'
  scopeMode: 'day' | 'week' | 'range' = 'week';

  // Day Scope State
  selectedDate: Date = new Date();
  selectedDateStr: string = this.toDateStr(new Date());
  formattedDate: string = this.formatDateDisplay(new Date());
  selectedDayName: string = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  selectedDayFullName: string = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  isToday = true;

  // Week Scope State
  selectedWeekYear: number = new Date().getFullYear();
  selectedWeekNumber: number = 1;
  selectedWeekStart: Date = new Date();
  selectedWeekEnd: Date = new Date();
  selectedWeekStartStr: string = '';
  selectedWeekEndStr: string = '';
  selectedWeekDisplayText: string = '';
  isCurrentWeek = true;

  // Range Scope State
  rangeStartDate: Date = new Date(Date.now() - 6 * 86400000);
  rangeEndDate: Date = new Date();
  rangeStartStr: string = this.toDateStr(new Date(Date.now() - 6 * 86400000));
  rangeEndStr: string = this.toDateStr(new Date());
  rangeDisplayText: string = '';

  searchInput = '';
  debouncedSearchQuery = '';
  statusFilter:
    | 'all'
    | 'attendance-entered'
    | 'attendance-missing'
    | 'evaluation-entered'
    | 'evaluation-missing'
    | 'timetable-missing'
    | 'both-missing'
    | 'all-ok' = 'all';
  madrasaFilter = '';
  shiftFilter = '';
  viewMode: 'flat' | 'grouped' = 'grouped';
  expandedRowId: string | null = null;

  // Raw source collections
  allRows: ClassGroupComplianceRow[] = [];
  madrasaGroups: MadrasaComplianceGroup[] = [];

  // Pre-computed filtered lists (stored as properties to guarantee stable object references and prevent NG0103)
  filteredRows: ClassGroupComplianceRow[] = [];
  filteredMadrasaGroups: MadrasaComplianceGroup[] = [];
  allMadrasas: { id: string; name: string }[] = [];
  allShifts: string[] = [];
  madrasaSearchText = '';
  filteredMadrasas: { id: string; name: string }[] = [];

  // Summary counts (stored as properties rather than getters for max performance)
  totalGroups = 0;
  attendanceEnteredCount = 0;
  attendanceMissingCount = 0;
  evaluationEnteredCount = 0;
  evaluationMissingCount = 0;
  timetableConfiguredCount = 0;
  timetableMissingCount = 0;
  bothMissingCount = 0;
  bothEnteredCount = 0;
  allCompliantCount = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initialize Week & Range scopes
    this.initWeekState(new Date());
    this.updateRangeDisplayText();

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
    this.shiftFilter = '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  setScopeMode(mode: 'day' | 'week' | 'range'): void {
    if (this.scopeMode === mode) return;
    this.scopeMode = mode;
    this.loadData();
  }

  initWeekState(refDate: Date = new Date()): void {
    const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);
    const day = d.getDay();
    // Monday is start of madrasa week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(12, 0, 0, 0);

    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(12, 0, 0, 0);

    this.selectedWeekStart = monday;
    this.selectedWeekEnd = saturday;
    this.selectedWeekYear = monday.getFullYear();
    this.selectedWeekNumber = this.getISOWeekNumber(monday);
    this.selectedWeekStartStr = this.toDateStr(monday);
    this.selectedWeekEndStr = this.toDateStr(saturday);

    const startText = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endText = saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    this.selectedWeekDisplayText = `Week ${this.selectedWeekNumber}: ${startText} – ${endText}`;

    const now = new Date();
    const nowStr = this.toDateStr(now);
    this.isCurrentWeek = nowStr >= this.selectedWeekStartStr && nowStr <= this.selectedWeekEndStr;
  }

  getISOWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  previousWeek(): void {
    const prev = new Date(this.selectedWeekStart);
    prev.setDate(prev.getDate() - 7);
    this.initWeekState(prev);
    this.loadData();
  }

  nextWeek(): void {
    const next = new Date(this.selectedWeekStart);
    next.setDate(next.getDate() + 7);
    this.initWeekState(next);
    this.loadData();
  }

  goToCurrentWeek(): void {
    this.initWeekState(new Date());
    this.loadData();
  }

  goToLastWeek(): void {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    this.initWeekState(lastWeek);
    this.loadData();
  }

  onWeekDateChange(date: Date | null): void {
    if (!date) return;
    this.initWeekState(date);
    this.loadData();
  }

  onRangeStartChange(date: Date | null): void {
    if (!date) return;
    const norm = this.normalizeDate(date);
    this.rangeStartDate = norm;
    this.rangeStartStr = this.toDateStr(norm);
    if (this.rangeStartStr > this.rangeEndStr) {
      this.rangeEndDate = norm;
      this.rangeEndStr = this.rangeStartStr;
    }
    this.updateRangeDisplayText();
    this.loadData();
  }

  onRangeEndChange(date: Date | null): void {
    if (!date) return;
    const norm = this.normalizeDate(date);
    this.rangeEndDate = norm;
    this.rangeEndStr = this.toDateStr(norm);
    if (this.rangeEndStr < this.rangeStartStr) {
      this.rangeStartDate = norm;
      this.rangeStartStr = this.rangeEndStr;
    }
    this.updateRangeDisplayText();
    this.loadData();
  }

  setQuickRange(mode: 'last7' | 'last14' | 'thisMonth'): void {
    const now = new Date();
    if (mode === 'last7') {
      this.rangeEndDate = this.normalizeDate(now);
      this.rangeStartDate = this.normalizeDate(new Date(Date.now() - 6 * 86400000));
    } else if (mode === 'last14') {
      this.rangeEndDate = this.normalizeDate(now);
      this.rangeStartDate = this.normalizeDate(new Date(Date.now() - 13 * 86400000));
    } else if (mode === 'thisMonth') {
      this.rangeEndDate = this.normalizeDate(now);
      this.rangeStartDate = this.normalizeDate(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    this.rangeStartStr = this.toDateStr(this.rangeStartDate);
    this.rangeEndStr = this.toDateStr(this.rangeEndDate);
    this.updateRangeDisplayText();
    this.loadData();
  }

  private updateRangeDisplayText(): void {
    const s = this.rangeStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = this.rangeEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    this.rangeDisplayText = `${s} – ${e}`;
  }

  copyPhone(phone?: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!phone) return;
    navigator.clipboard?.writeText(phone).then(() => {
      this.snackBar.open(`Copied ${phone} to clipboard`, 'OK', { duration: 2500 });
    }).catch(() => {
      this.snackBar.open(`Phone: ${phone}`, 'OK', { duration: 4000 });
    });
  }

  getWhatsAppUrl(row: ClassGroupComplianceRow): string {
    if (!row.assignedStaffPhone) return '';
    let cleanPhone = row.assignedStaffPhone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    } else if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const missingItems: string[] = [];
    if (row.attendanceStatus === 'not-entered') missingItems.push('Attendance');
    if (row.evaluationStatus === 'not-entered') missingItems.push('Student Progress Evaluation');
    const missingDesc = missingItems.length === 2 ? 'Attendance and Progress Evaluation' : (missingItems[0] || 'Records');

    let periodDesc = '';
    if (this.scopeMode === 'week') {
      periodDesc = `for ${this.selectedWeekDisplayText || 'this week'}`;
    } else if (this.scopeMode === 'range') {
      periodDesc = `for ${this.rangeDisplayText || (this.rangeStartStr + ' to ' + this.rangeEndStr)}`;
    } else {
      periodDesc = `for ${this.selectedDateStr}`;
    }

    const staffGreeting = row.assignedStaffName && row.assignedStaffName !== 'Unassigned'
      ? `Ustadh ${row.assignedStaffName}`
      : 'Teacher';

    const message = `Assalamu Alaikum ${staffGreeting},\n\nThis is a compliance reminder from DeenDesk Administration (${row.madrasaName}).\n\n⚠️ The ${missingDesc} for your assigned class group "${row.groupName}" (${row.className}) has not been submitted yet ${periodDesc}.\n\nPlease update the records in DeenDesk at your earliest convenience.\n\nJazakAllah Khair!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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

  private isRecordActuallyEvaluated(p: any): boolean {
    if (!p) return false;
    // Explicit negative flags
    if (p['isEvaluated'] === false || p['evaluationStatus'] === 'pending' || p['status'] === 'pending') {
      return false;
    }
    // 1. Direct completion flags
    if (p['status'] === 'completed' || p['status'] === 'evaluated' || p['evaluationStatus'] === 'completed' || p['isEvaluated'] === true) {
      return true;
    }
    // 2. Star rating, Grade, or Score explicitly assigned
    if ((p['starRating'] !== undefined && p['starRating'] !== null && p['starRating'] > 0) ||
        (typeof p['grade'] === 'string' && p['grade'].trim().length > 0) ||
        (typeof p['score'] === 'number' && p['score'] > 0)) {
      return true;
    }
    // 3. Hifz content
    const h = p['hifzProgress'] || p['hifz'] || {};
    if (h.sabaqSurahName || h.sabaqStartSurah || h.sabaqEndSurah || h.sabaqStartJuz || p['sabaqSurah'] || p['sabaqJuz'] || p['sabaqAyahFrom'] || p['sabaqAyahTo']) {
      return true;
    }
    // 4. Dawr content
    const d = p['dawrProgress'] || p['dawr'] || {};
    if ((d.roundNo && d.portionJuz) || d.weeklyJuzCount || p['daurRoundNumber'] || p['dawrRoundNumber'] || p['dawrPortionJuz'] || p['daurJuzFrom']) {
      return true;
    }
    // 5. Maktab / Tilawat content
    const m = p['maktabProgress'] || p['maktab'] || {};
    const qr = p['quranReading'] || m['quranReading'] || {};
    if (qr.surahName || qr.juzNo || qr.fromAyah || qr.fromPage || p['tilawatSurah'] || p['tilawatJuz']) {
      return true;
    }
    if ((m.subjectName && m.subjectName.trim()) || (m.subject && m.subject.trim()) || (p['maktabSubject'] && p['maktabSubject'].trim()) || (p['subjectName'] && p['subjectName'].trim())) {
      return true;
    }
    if (m.pageNo !== undefined && m.pageNo !== null && m.pageNo > 0) return true;
    if (p['maktabPageNo'] !== undefined && p['maktabPageNo'] !== null && p['maktabPageNo'] > 0) return true;
    if (Array.isArray(p['maktabSubjectsList']) && p['maktabSubjectsList'].length > 0) return true;

    // 6. Remarks explicitly entered by teacher
    if (typeof p['remarks'] === 'string' && p['remarks'].trim().length > 0 && p['remarks'].trim().toLowerCase() !== 'saved') {
      return true;
    }

    return false;
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
    const match = this.allMadrasas.find(m => m.id === newVal);
    this.madrasaSearchText = match ? match.name : '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onMadrasaChange(val: string): void {
    const newVal = val || '';
    if (this.madrasaFilter === newVal) return;
    this.madrasaFilter = newVal;
    const match = this.allMadrasas.find(m => m.id === newVal);
    this.madrasaSearchText = match ? match.name : '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  filterMadrasasSearch(): void {
    const q = (this.madrasaSearchText || '').toLowerCase().trim();
    const allItem = { id: '', name: `All Madrasas (${this.allMadrasas.length})` };
    if (!q) {
      this.filteredMadrasas = [allItem, ...this.allMadrasas];
    } else {
      this.filteredMadrasas = [
        allItem,
        ...this.allMadrasas.filter(m => m.name.toLowerCase().includes(q))
      ];
    }
  }

  displayMadrasaFn = (m: any): string => {
    if (!m) return '';
    return typeof m === 'string' ? m : (m.name || '');
  };

  onMadrasaOptionSelected(m: { id: string; name: string }): void {
    if (!m) return;
    this.madrasaFilter = m.id;
    this.madrasaSearchText = m.id ? m.name : '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  clearMadrasaFilter(): void {
    this.madrasaFilter = '';
    this.madrasaSearchText = '';
    this.filterMadrasasSearch();
    this.applyFilters();
    this.cdr.markForCheck();
  }

  setShiftFilter(val: string): void {
    const newVal = val || '';
    if (this.shiftFilter === newVal) return;
    this.shiftFilter = newVal;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onShiftChange(val: string): void {
    const newVal = val || '';
    if (this.shiftFilter === newVal) return;
    this.shiftFilter = newVal;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  toggleExpandRow(groupId: string): void {
    this.expandedRowId = this.expandedRowId === groupId ? null : groupId;
    this.cdr.markForCheck();
  }

  openClassroomSuite(row: ClassGroupComplianceRow): void {
    const qParams: Record<string, any> = {
      madrasaId: row.madrasaId,
      classId: row.classId,
      groupId: row.groupId
    };

    // Determine target date:
    // If evaluation was entered, prioritize the exact date it was entered on so evaluations are immediately visible!
    const targetDate = (row.evaluationStatus === 'entered' && row.latestEvaluationDate)
      ? row.latestEvaluationDate
      : (row.latestAttendanceDate || (this.scopeMode === 'week' ? this.selectedWeekStartStr : (this.scopeMode === 'range' ? this.rangeStartStr : this.selectedDateStr)));

    // Choose preferred cadence: if evaluations were recorded in daily mode, open in daily cadence so teacher/admin sees them immediately!
    const preferredCadence = row.evaluationCadence || (this.scopeMode === 'week' ? 'weekly' : 'daily');

    if (this.scopeMode === 'week') {
      qParams['mode'] = preferredCadence;
      qParams['cadence'] = preferredCadence;
      qParams['weekStart'] = this.selectedWeekStartStr;
      qParams['weekEnd'] = this.selectedWeekEndStr;
      qParams['weekNumber'] = this.selectedWeekNumber;
      qParams['weekYear'] = this.selectedWeekYear;
      qParams['date'] = targetDate;
    } else if (this.scopeMode === 'range') {
      qParams['mode'] = preferredCadence;
      qParams['cadence'] = preferredCadence;
      qParams['date'] = targetDate;
      qParams['weekStart'] = targetDate;
    } else {
      qParams['mode'] = 'daily';
      qParams['cadence'] = 'daily';
      qParams['date'] = this.selectedDateStr;
      qParams['weekStart'] = this.selectedDateStr;
    }

    // Direct to the tab that requires attention:
    if (row.evaluationStatus === 'entered' || (row.attendanceStatus === 'entered' && row.evaluationStatus === 'not-entered')) {
      qParams['tab'] = 'progress';
    } else {
      qParams['tab'] = 'attendance';
    }

    this.router.navigate(['/classroom-suite'], { queryParams: qParams });
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
      shifts: from(this.repo.getAllOnce<EntityRecord>('shifts', profile)).pipe(catchError(() => of([]))),
      attendance: from(
        (async () => {
          try {
            if (this.scopeMode === 'day') {
              const dateFiltered = await this.repo.getAllOnce<EntityRecord>(
                'attendance',
                profile,
                { forceRefresh: true },
                [where('date', '==', dateStr)]
              );
              if (dateFiltered && dateFiltered.length > 0) {
                return dateFiltered;
              }
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
            if (this.scopeMode === 'day') {
              const dateFiltered = await this.repo.getAllOnce<EntityRecord>(
                'studentDailyProgress',
                profile,
                { forceRefresh: true },
                [where('date', '==', dateStr)]
              );
              if (dateFiltered && dateFiltered.length > 0) {
                return dateFiltered;
              }
            }
          } catch (e) {
            console.warn('[ComplianceMonitor] where(date) progress query failed, falling back:', e);
          }
          return this.repo.getAllOnce<EntityRecord>('studentDailyProgress', profile, { forceRefresh: true });
        })()
      ).pipe(catchError(() => of([]))),
      studentWeeklyProgress: from(
        this.repo.getAllOnce<EntityRecord>('studentWeeklyProgress', profile, { forceRefresh: true })
      ).pipe(catchError(() => of([]))),
      exceptions: from(
        this.repo.getAllOnce<EntityRecord>('classPlanExceptions', profile, { forceRefresh: true })
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
    this.bothEnteredCount = rows.filter(r => r.attendanceStatus === 'entered' && r.evaluationStatus === 'entered').length;
    this.allCompliantCount = rows.filter(r => r.attendanceStatus === 'entered' && r.evaluationStatus === 'entered' && r.hasTimetable).length;

    const seen = new Set<string>();
    this.allMadrasas = rows
      .filter(r => { if (seen.has(r.madrasaId)) return false; seen.add(r.madrasaId); return true; })
      .map(r => ({ id: r.madrasaId, name: r.madrasaName }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (this.madrasaFilter) {
      const match = this.allMadrasas.find(m => m.id === this.madrasaFilter);
      this.madrasaSearchText = match ? match.name : '';
    }
    this.filterMadrasasSearch();

    const seenShifts = new Set<string>();
    this.allShifts = [];
    rows.forEach(r => {
      const s = r.shiftName || 'Unassigned Shift';
      if (!seenShifts.has(s)) {
        seenShifts.add(s);
        this.allShifts.push(s);
      }
    });
    this.allShifts.sort((a, b) => a.localeCompare(b));
  }

  applyFilters(): void {
    let list = this.allRows;

    if (this.madrasaFilter) {
      list = list.filter(r => r.madrasaId === this.madrasaFilter);
    }

    if (this.shiftFilter) {
      if (this.shiftFilter === '__assigned__') {
        list = list.filter(r => r.shiftName && r.shiftName !== 'Unassigned Shift' && r.shiftName !== '-');
      } else if (this.shiftFilter === '__unassigned__') {
        list = list.filter(r => !r.shiftName || r.shiftName === 'Unassigned Shift' || r.shiftName === '-');
      } else {
        list = list.filter(r => r.shiftName === this.shiftFilter);
      }
    }

    if (this.statusFilter === 'attendance-entered') {
      list = list.filter(r => r.attendanceStatus === 'entered');
    } else if (this.statusFilter === 'attendance-missing') {
      list = list.filter(r => r.attendanceStatus === 'not-entered');
    } else if (this.statusFilter === 'evaluation-entered') {
      list = list.filter(r => r.evaluationStatus === 'entered');
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
        r.shiftName.toLowerCase().includes(q) ||
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
    const dailyProgressRecords = data['studentProgress'] || [];
    const weeklyProgressRecords = data['studentWeeklyProgress'] || [];
    const exceptions = data['exceptions'] || [];

    const scope = this.scopeMode;
    const weekYear = this.selectedWeekYear;
    const weekNo = this.selectedWeekNumber;
    const weekStartStr = this.selectedWeekStartStr;
    const weekEndStr = this.selectedWeekEndStr;
    const rangeStart = this.rangeStartStr;
    const rangeEnd = this.rangeEndStr;

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

      // Shift resolution
      const rawShiftId = String(grp['shiftId'] || cls?.['shiftId'] || '').trim();
      const rawShiftName = String(
        grp['shiftName'] || grp['shift'] || grp['timing'] || grp['schedule'] ||
        cls?.['shiftName'] || cls?.['shift'] || cls?.['timing'] || cls?.['schedule'] || ''
      ).trim();

      let shiftName = '';
      if (rawShiftId) {
        const foundShift = (data['shifts'] || []).find(s =>
          String(s.id) === rawShiftId ||
          String(s['code'] || '').toLowerCase() === rawShiftId.toLowerCase()
        );
        if (foundShift) {
          shiftName = String(foundShift['name'] || foundShift['title'] || foundShift['code'] || '');
        }
      }
      if (!shiftName && rawShiftName) {
        const foundShift = (data['shifts'] || []).find(s =>
          String(s.id).toLowerCase() === rawShiftName.toLowerCase() ||
          String(s['name'] || '').toLowerCase() === rawShiftName.toLowerCase()
        );
        shiftName = foundShift ? String(foundShift['name'] || foundShift['title'] || '') : rawShiftName;
      }
      if (!shiftName) {
        const combined = (String(grp['name'] || '') + ' ' + String(cls?.['name'] || '')).toLowerCase();
        if (combined.includes('morning')) shiftName = 'Morning Shift';
        else if (combined.includes('evening')) shiftName = 'Evening Shift';
        else if (combined.includes('maghrib')) shiftName = 'After Maghrib Shift';
        else if (combined.includes('night')) shiftName = 'Night Shift';
        else if (combined.includes('afternoon')) shiftName = 'Afternoon Shift';
        else shiftName = 'Unassigned Shift';
      }

      // Timetable check
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

        if (scope === 'day') {
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
        }

        // In week or range mode, having configured timetable slots indicates active schedule
        return true;
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

      // Staff details resolution (Name, Mobile Phone, Email, UID)
      const staffDetails = this.resolveStaffDetails(grp, users, groupTimetableEntries);
      const assignedStaffName = staffDetails.name;
      const assignedStaffPhone = staffDetails.phone;
      const assignedStaffEmail = staffDetails.email;
      const assignedStaffUid = staffDetails.uid;

      // Attendance check (Scoped by day, week, or custom date range)
      const groupAttRecords = attendanceRecords.filter(a => {
        const matchGroup =
          a['groupId'] === grp.id ||
          a['classGroupId'] === grp.id ||
          planIds.has(String(a['classPlanId'] || '')) ||
          Array.from(planIds).some(pid => String(a.id).includes(pid)) ||
          String(a.id).includes(String(grp.id));
        if (!matchGroup) return false;

        const recDate = this.extractDateStr(a);
        if (scope === 'day') {
          return recDate === dateStr || String(a.id).includes(dateStr);
        } else if (scope === 'week') {
          return (recDate && recDate >= weekStartStr && recDate <= weekEndStr) ||
                 (Array.isArray(a['weekDates']) && a['weekDates'].some((d: string) => d >= weekStartStr && d <= weekEndStr)) ||
                 String(a.id).includes(`week_${weekYear}_${weekNo}`);
        } else {
          return !!recDate && recDate >= rangeStart && recDate <= rangeEnd;
        }
      });

      let attendanceStatus: ComplianceStatus = 'not-entered';
      let attendanceTakenBy: string | undefined;
      let attendanceTakenAt: string | undefined;
      let presentCount = 0;
      let absentCount = 0;
      let periodSummaryText: string | undefined;
      let latestAttendanceDate: string | undefined;

      if (groupAttRecords.length > 0) {
        const attDates = groupAttRecords.map(a => this.extractDateStr(a)).filter(Boolean) as string[];
        attDates.sort();
        latestAttendanceDate = attDates[attDates.length - 1];
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

          if (scope !== 'day') {
            const uniqueDates = new Set(groupAttRecords.map(a => this.extractDateStr(a)).filter(Boolean));
            periodSummaryText = `${uniqueDates.size || groupAttRecords.length} day(s) recorded`;
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

      // Evaluation / Progress check (Scoped across daily & weekly records)
      const groupStudentIds = new Set(groupStudents.map(s => String(s.id)));

      // 1. Daily Progress matching current audit scope
      const groupDailyRecords = dailyProgressRecords.filter(p => {
        const matchesGroup = (String(p['groupId'] || '') === String(grp.id) || String(p['classGroupId'] || '') === String(grp.id)) ||
                             groupStudentIds.has(String(p['studentId'] || ''));
        if (!matchesGroup) return false;

        const pDate = this.extractDateStr(p);
        if (scope === 'day') {
          return pDate === dateStr || String(p.id).includes(dateStr);
        } else if (scope === 'week') {
          return !!pDate && pDate >= weekStartStr && pDate <= weekEndStr;
        } else {
          return !!pDate && pDate >= rangeStart && pDate <= rangeEnd;
        }
      });

      // 2. Weekly Progress matching current audit scope
      const groupWeeklyRecords = weeklyProgressRecords.filter(wp => {
        const matchesGroup = (String(wp['groupId'] || '') === String(grp.id) || String(wp['classGroupId'] || '') === String(grp.id)) ||
                             groupStudentIds.has(String(wp['studentId'] || ''));
        if (!matchesGroup) return false;

        if (scope === 'week') {
          const matchWeekNum = (Number(wp['year']) === weekYear && Number(wp['weekNumber']) === weekNo) ||
                               String(wp.id).includes(`_week_${weekYear}_${weekNo}`);
          const matchWeekDates = wp['weekStartDate'] === weekStartStr;
          const wpDate = this.extractDateStr(wp);
          const matchDate = !!wpDate && wpDate >= weekStartStr && wpDate <= weekEndStr;
          return matchWeekNum || matchWeekDates || matchDate;
        } else if (scope === 'day') {
          const wpDate = this.extractDateStr(wp);
          return wpDate === dateStr;
        } else {
          const wpDate = this.extractDateStr(wp) || wp['weekStartDate'];
          return !!wpDate && wpDate >= rangeStart && wpDate <= rangeEnd;
        }
      });

      const allProgressRecords = [...groupDailyRecords, ...groupWeeklyRecords];
      const evaluatedProgressRecords = allProgressRecords.filter(p => this.isRecordActuallyEvaluated(p));

      let evaluationStatus: ComplianceStatus = 'not-entered';
      let evaluationEnteredBy: string | undefined;
      let evaluationEnteredAt: string | undefined;
      let latestEvaluationDate: string | undefined;
      let evaluationCadence: 'weekly' | 'daily' | undefined;

      const evaluatedStudentIds = new Set<string>();
      evaluatedProgressRecords.forEach(p => {
        if (p['studentId']) evaluatedStudentIds.add(String(p['studentId']));
      });
      const evaluationCount = evaluatedStudentIds.size || evaluatedProgressRecords.length;

      if (evaluationCount > 0) {
        evaluationStatus = 'entered';

        const evalWeekly = evaluatedProgressRecords.filter(p => weeklyProgressRecords.includes(p));
        const evalDaily = evaluatedProgressRecords.filter(p => dailyProgressRecords.includes(p));

        if (evalWeekly.length > 0) {
          evaluationCadence = 'weekly';
        } else if (evalDaily.length > 0) {
          evaluationCadence = 'daily';
          const evalDates = evalDaily.map(p => this.extractDateStr(p)).filter(Boolean) as string[];
          evalDates.sort();
          latestEvaluationDate = evalDates[evalDates.length - 1];
        }

        // Extract evaluator name or uid
        for (const p of evaluatedProgressRecords) {
          const directName =
            p['evaluatedByName'] ||
            p['recordedByName'] ||
            p['teacherName'] ||
            p['staffName'] ||
            p['enteredByName'] ||
            p['enteredBy'] ||
            p['createdByName'] ||
            p['takenByName'] ||
            p['authorName'] ||
            p['userName'] ||
            p['updatedByName'];

          if (directName && typeof directName === 'string' && directName.trim()) {
            evaluationEnteredBy = directName.trim();
            break;
          }

          const uid =
            p['evaluatedByUid'] ||
            p['recordedByUid'] ||
            p['teacherId'] ||
            p['staffId'] ||
            p['userId'] ||
            p['createdBy'] ||
            p['takenBy'];

          if (uid) {
            const uidStr = String(uid).trim();
            const found = users.find(u => String(u.id) === uidStr || String(u['uid']) === uidStr);
            const resolved = found ? String(found['displayName'] || found['name'] || found['email'] || '').trim() : '';
            if (resolved) {
              evaluationEnteredBy = resolved;
              break;
            }
          }
        }

        // Extract recorded timestamp
        for (const p of allProgressRecords) {
          const t: any = p['recordedAt'] || p['evaluatedAt'] || p['createdAt'] || p['updatedAt'] || p['takenAt'];
          if (t) {
            const d = new Date(typeof t?.toDate === 'function' ? t.toDate() : (t.seconds ? t.seconds * 1000 : t));
            if (!isNaN(d.getTime())) {
              evaluationEnteredAt = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              break;
            }
          }
        }

        // Fallback: If evaluation entered but no evaluator name is logged
        if (!evaluationEnteredBy && attendanceTakenBy && attendanceTakenBy !== 'Teacher') {
          evaluationEnteredBy = attendanceTakenBy;
        } else if (!evaluationEnteredBy && assignedStaffName && assignedStaffName !== 'Unassigned') {
          evaluationEnteredBy = assignedStaffName;
        }
      }

      // Check if this date / class group has a declared Class Exception (Holiday, Annual Day, Event)
      const matchingEx = exceptions.find(e => {
        const matchesGroup =
          String(e['groupId'] || '') === String(grp.id) ||
          String(e['classPlanId'] || '') === String(grp.id) ||
          planIds.has(String(e['classPlanId'] || '')) ||
          (e['madrasaId'] && String(e['madrasaId']) === String(grpMadrasaId));
        if (!matchesGroup) return false;

        const exDate = this.extractDateStr(e);
        if (scope === 'day') {
          return exDate === dateStr || String(e.id).includes(dateStr);
        } else if (scope === 'week') {
          return !!exDate && exDate >= weekStartStr && exDate <= weekEndStr;
        } else {
          return !!exDate && exDate >= rangeStart && exDate <= rangeEnd;
        }
      });

      if (matchingEx) {
        const exReason = matchingEx['reason'] || (matchingEx['type'] === 'specialActivity' ? 'Annual Day / Event' : 'Holiday / No Class');
        if (attendanceStatus === 'not-entered') {
          attendanceStatus = 'entered';
          attendanceTakenBy = `Exempted: ${exReason}`;
        }
        if (evaluationStatus === 'not-entered') {
          evaluationStatus = 'entered';
          evaluationEnteredBy = `Exempted: ${exReason}`;
        }
      }

      return {
        groupId: String(grp.id),
        groupName: String(grp['name'] || grp['title'] || 'Class Group'),
        classId: grp['classId'],
        className: String(cls?.['name'] || grp['className'] || 'Class'),
        madrasaId: grpMadrasaId,
        madrasaName,
        shiftName,
        shiftId: rawShiftId || undefined,
        assignedStaffName,
        assignedStaffPhone,
        assignedStaffEmail,
        assignedStaffUid,
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
        evaluationEnteredAt,
        periodSummaryText,
        latestAttendanceDate,
        latestEvaluationDate,
        evaluationCadence,
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

  private resolveStaffDetails(
    grp: EntityRecord,
    users: EntityRecord[],
    groupTimetableEntries: (EntityRecord & TimetableEntry)[] = []
  ): { name: string; phone?: string; email?: string; uid?: string } {
    const directName = grp['assignedStaffName'] || grp['teacherName'] || grp['staffName'] || grp['assignedTeacherName'];
    const directPhone = grp['staffPhone'] || grp['teacherPhone'] || grp['mobileNumber'] || grp['phone'] || grp['mobile'] || grp['contactNumber'];
    const directEmail = grp['staffEmail'] || grp['teacherEmail'] || grp['email'];

    const tokens: string[] = [
      ...(Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'] : []),
      ...(Array.isArray(grp['teacherUids']) ? grp['teacherUids'] : []),
      ...(Array.isArray(grp['staffIds']) ? grp['staffIds'] : []),
      ...(grp['teacherUid'] ? [grp['teacherUid']] : []),
      ...(grp['assignedStaffId'] ? [grp['assignedStaffId']] : []),
      ...(grp['teacherId'] ? [grp['teacherId']] : []),
      ...(grp['staffId'] ? [grp['staffId']] : []),
    ].map(v => String(v || '').trim()).filter(Boolean);

    // If still no staff assigned on group, fallback to teacher in timetable entries
    if (tokens.length === 0 && groupTimetableEntries.length > 0) {
      groupTimetableEntries.forEach(e => {
        if (e.teacherId) tokens.push(String(e.teacherId));
        if (Array.isArray(e.teacherIds)) e.teacherIds.forEach(t => tokens.push(String(t)));
      });
    }

    const matchedUsers: EntityRecord[] = [];
    tokens.forEach(tok => {
      const found = users.find(u => String(u.id) === tok || String(u['uid']) === tok || String(u['email']) === tok);
      if (found && !matchedUsers.some(m => m.id === found.id)) {
        matchedUsers.push(found);
      }
    });

    if (matchedUsers.length === 0 && directName) {
      const nameLower = String(directName).trim().toLowerCase();
      const found = users.find(u => {
        const uName = String(u['displayName'] || u['name'] || u['fullName'] || '').trim().toLowerCase();
        return uName && (uName === nameLower || nameLower.includes(uName));
      });
      if (found) matchedUsers.push(found);
    }

    const names: string[] = [];
    let phone: string | undefined = directPhone ? String(directPhone).trim() : undefined;
    let email: string | undefined = directEmail ? String(directEmail).trim() : undefined;
    let uid: string | undefined = undefined;

    matchedUsers.forEach(u => {
      const n = String(u['displayName'] || u['name'] || u['fullName'] || u['email'] || '').trim();
      if (n && !names.includes(n)) names.push(n);

      if (!phone) {
        const p = u['mobileNumber'] || u['phone'] || u['mobile'] || u['contactNumber'] || u['phoneNumber'] || u['telephone'];
        if (p) phone = String(p).trim();
      }
      if (!email) {
        const em = u['email'] || u['mail'];
        if (em) email = String(em).trim();
      }
      if (!uid) {
        uid = String(u.id || u['uid'] || '');
      }
    });

    let finalName = names.length > 0
      ? this.cleanStaffNames(names.join(', '))
      : (directName ? this.cleanStaffNames(String(directName)) : 'Unassigned');

    return {
      name: finalName,
      phone: phone || undefined,
      email: email || undefined,
      uid: uid || undefined
    };
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
    const auditPeriodText = this.scopeMode === 'week'
      ? this.selectedWeekDisplayText
      : (this.scopeMode === 'range' ? `${this.rangeStartStr} to ${this.rangeEndStr}` : this.selectedDateStr);

    const header = [
      'Class Group',
      'Class',
      'Shift',
      'Madrasa',
      'Assigned Staff',
      'Staff Mobile Number',
      'Staff Email',
      'Audit Scope',
      'Audit Period',
      `Timetable (${this.scopeMode === 'day' ? dayLabel : 'Configured'})`,
      'Attendance Status',
      'Attendance Details',
      'Progress Evaluation Status',
      'Evaluation Details',
      'Students Summary'
    ];

    const csvRows = rows.map(r => [
      r.groupName,
      r.className,
      r.shiftName || 'Unassigned Shift',
      r.madrasaName,
      r.assignedStaffName || 'Unassigned',
      r.assignedStaffPhone || 'N/A',
      r.assignedStaffEmail || 'N/A',
      this.scopeMode.toUpperCase(),
      auditPeriodText,
      r.hasTimetable ? `${r.timetableCount} period(s) configured` : `NOT CONFIGURED`,
      r.attendanceStatus === 'entered' ? 'ENTERED' : 'NOT ENTERED',
      r.attendanceStatus === 'entered'
        ? `By: ${r.attendanceTakenBy || 'Teacher'}${r.attendanceTakenAt ? ' at ' + r.attendanceTakenAt : ''} (${r.presentCount}P / ${r.absentCount}A)${r.periodSummaryText ? ' [' + r.periodSummaryText + ']' : ''}`
        : 'Missing',
      r.evaluationStatus === 'entered' ? 'ENTERED' : 'NOT ENTERED',
      r.evaluationStatus === 'entered'
        ? `Recorded for ${r.evaluationCount} student(s)${r.evaluationEnteredBy ? ' by ' + r.evaluationEnteredBy : ''}`
        : 'Missing',
      `${r.presentCount}P / ${r.absentCount}A / ${r.totalStudents} Total`
    ]);

    const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-${label}-${this.scopeMode}-${this.scopeMode === 'week' ? 'week' + this.selectedWeekNumber : this.selectedDateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${rows.length} row(s) to CSV with staff contact details`, 'OK', { duration: 3000 });
  }

  trackByGroup(_: number, row: ClassGroupComplianceRow): string { return row.groupId; }
  trackByMadrasa(_: number, mg: MadrasaComplianceGroup): string { return mg.madrasaId; }
  trackByMadrasaOption(_: number, item: { id: string; name: string }): string { return item.id; }
  trackByShiftOption(_: number, item: string): string { return item; }
  trackBySlot(index: number, s: TimetableSlotInfo): string { return s.title + '_' + index; }
}
