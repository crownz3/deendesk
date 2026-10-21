import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, combineLatest, of, Subject, firstValueFrom } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { AppUser, AttendanceStatus, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { getDeenDeskFirestore } from '../../core/services/firebase-app';
import { ALL_QURAN_SURAHS, ALL_QURAN_JUZ, QuranJuzItem, getSurahAyahCount } from '../../core/constants/defaults';
import { SetTargetDialogComponent } from './set-target-dialog.component';
import { StudentProgressEntryDialogComponent } from '../../shared/components/student-progress-entry-dialog/student-progress-entry-dialog.component';
import { SimpleTimetableSlotDialogComponent } from './simple-timetable-slot-dialog.component';
import { QuickAddDialogComponent } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { StudentAttendanceHistoryDialogComponent, StudentAttendanceHistoryRecord } from './student-attendance-history-dialog.component';
import { ClassGroupAttendanceDetailsDialogComponent, ClassGroupAttendanceDetailsDialogData, StudentAttendanceDetailRecord } from '../dashboard/class-group-attendance-details-dialog.component';
import { StudentEvaluationDialogComponent } from '../attendance/student-evaluation-dialog.component';
import { StudentProgressEvaluationDialogComponent } from '../../shared/components/student-progress-evaluation-dialog/student-progress-evaluation-dialog.component';
import { ConfigureMaktabSubjectsDialogComponent } from '../../shared/components/configure-maktab-subjects-dialog/configure-maktab-subjects-dialog.component';
import { StudentProgressTrackerDialogComponent } from '../../shared/components/student-progress-tracker-dialog/student-progress-tracker-dialog.component';

export interface OverviewClassGroupStatus {
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

export interface StudentSuiteRosterItem {
  student: EntityRecord;
  status: AttendanceStatus;
  note: string;
  attendancePct?: number;
  attendanceHistoryText?: string;
  attendanceHistoryRecords?: StudentAttendanceHistoryRecord[];
  allGroupNames?: string[];
  // Target Fields & Metadata
  targetPeriod?: 'weekly' | 'monthly' | 'custom';
  targetStartDate?: string;
  targetEndDate?: string;
  targetSabaqSurah?: string;
  targetSabaqFromAyah?: number | null;
  targetSabaqToAyah?: number | null;
  targetSabaqTargetMode?: string;
  targetSabaqJuz?: number | null;
  targetSabqiJuzRange?: string;
  targetManzilJuzRange?: string;
  targetMaktabSubject?: string;
  targetMaktabPage?: number | null;
  targetMaktabLineNo?: number | null;
  targetDawrRounds?: number | null;
  targetDawrDailyJuz?: string;
  targetIncompleteReason?: string;
  targetIncompleteNotes?: string;
  targetGoal?: string;
  // Hifz Progress Fields
  evalUnitMode?: 'surah' | 'juz' | 'page';
  sabaqSurah: string;
  sabaqFromAyah: number | null;
  sabaqToAyah: number | null;
  sabaqMistakes: number | null;
  sabaqJuz?: number | null;
  sabaqJuzPortion?: string;

  sabqiSurah?: string;
  sabqiFromAyah?: number | null;
  sabqiToAyah?: number | null;
  sabqiJuz: number | null;
  sabqiJuzPortion?: string;
  sabqiMistakes: number | null;

  manzilSurah?: string;
  manzilFromAyah?: number | null;
  manzilToAyah?: number | null;
  manzilJuz: number | null;
  manzilJuzPortion?: string;
  manzilMistakes: number | null;
  hifzRating: number; // 1-5
  // Dawr (Full Quran Revision) Progress Fields
  dawrRoundNo: number | null;
  dawrPortionJuz: string;
  dawrFromAyah: number | null;
  dawrToAyah: number | null;
  dawrMistakes: number | null;
  dawrManzilMistakes: number | null;
  dawrRating: number;
  // Maktab / Academic Progress Fields
  maktabStageMode?: 'miftah' | 'tilawatul_quran';
  maktabSubject: string;
  maktabPage: number | null;
  maktabLineNo: number | null;
  maktabMistakes: number | null;
  maktabRemarks: string;
  tilawatSurah?: string;
  tilawatFromAyah?: number | null;
  tilawatToAyah?: number | null;
  tilawatJuz?: number | null;
  tilawatFromPage?: number | null;
  tilawatToPage?: number | null;
  quranReading?: any;
  // Weekly Cumulative Progress Fields (Option 1)
  // 1. New Lesson (Sabaq)
  weeklySabaqStartSurah?: string;
  weeklySabaqStartAyah?: number | null;
  weeklySabaqEndSurah?: string;
  weeklySabaqEndAyah?: number | null;
  weeklySabaqStartJuz?: number | null;
  weeklySabaqStartPortion?: string;
  weeklySabaqEndJuz?: number | null;
  weeklySabaqEndPortion?: string;
  weeklySabaqStartPage?: number | null;
  weeklySabaqEndPage?: number | null;

  // 2. Old Lesson (Sabqi)
  weeklySabqiStartSurah?: string;
  weeklySabqiStartAyah?: number | null;
  weeklySabqiEndSurah?: string;
  weeklySabqiEndAyah?: number | null;
  weeklySabqiStartJuz?: number | null;
  weeklySabqiStartPortion?: string;
  weeklySabqiEndJuz?: number | null;
  weeklySabqiEndPortion?: string;
  weeklySabqiStartPage?: number | null;
  weeklySabqiEndPage?: number | null;
  weeklySabqiRange?: string;

  // 3. Recent Lesson (Sabaq / Manzil)
  weeklyManzilStartSurah?: string;
  weeklyManzilStartAyah?: number | null;
  weeklyManzilEndSurah?: string;
  weeklyManzilEndAyah?: number | null;
  weeklyManzilStartJuz?: number | null;
  weeklyManzilStartPortion?: string;
  weeklyManzilEndJuz?: number | null;
  weeklyManzilEndPortion?: string;
  weeklyManzilRange?: string;
  weeklyMistakes?: number | null;
  weeklyRating?: number; // 1-5
  weeklyGrade?: string;
  weeklyNotes?: string;
  weeklyDawrRounds?: number | null;
  weeklyDawrJuzCount?: number | null;
  weeklyMaktabSubject?: string;
  weeklyMaktabStartPage?: number | null;
  weeklyMaktabEndPage?: number | null;
  maktabSubjectsList?: any[];
  hifzLessonsList?: any[];
  // UI-only transient state (not persisted)
  _hoverRating?: number;
}

export interface PeriodSlotChip {
  id: string;
  periodTitle: string;
  startTime: string;
  endTime: string;
  teacherName?: string;
  subjectName?: string;
}

@Component({
  selector: 'app-classroom-suite',
  templateUrl: './classroom-suite.page.html',
  styleUrls: ['./classroom-suite.page.scss'],
  standalone: false,
})
export class ClassroomSuitePage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Active User & Permissions
  currentUser: AppUser | null = null;
  isSuperAdmin = false;
  isOrgAdmin = false;
  isStageHead = false;
  isMadrasaIncharge = false;
  isStaff = false;
  canManageReports = false;
  canManageAttendance = true;
  canSelectMadrasa = false;

  // Undo & Snapshot Management
  lastProgressSaveSnapshot: {
    type: 'daily' | 'weekly' | 'single';
    dateOrWeek: string;
    savedDocRefs: string[];
    rosterBackup: any[];
  } | null = null;
  canUndoProgress = false;

  // Header Selectors Data
  madrasas: EntityRecord[] = [];
  stages: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  classGroups: EntityRecord[] = [];
  availableClassGroupsForUser: EntityRecord[] = [];
  rawStaff: EntityRecord[] = [];
  rawUsers: EntityRecord[] = [];

  // Autocomplete Search State for Madrasa & Class Group
  madrasaSearchText = '';
  filteredMadrasas: EntityRecord[] = [];
  groupSearchText = '';
  filteredClassGroups: EntityRecord[] = [];

  userAssignedGroupIds = new Set<string>();
  userAssignedMadrasaIds = new Set<string>();
  filteredMadrasasForUser: EntityRecord[] = [];

  assignedStaffList: { id?: string; name: string; role?: string; allGroupNames?: string[] }[] = [];
  assignedStaffNamesDisplay = '';

  selectedMadrasaId = '';
  selectedStageId = '';
  selectedClassId = '';
  selectedGroupId = '';
  selectedDateStr = this.getTodayDateString();
  selectedDateObj = new Date();

  // Attendance Mode & Slots
  attendanceMode: 'FULL_DAY' | 'PER_PERIOD' = 'FULL_DAY';

  // Timetable State & Weekly Schedule
  periodSlots: PeriodSlotChip[] = [];
  selectedPeriodId: string = 'FULL_DAY';
  selectedPeriodTitle: string = 'Full Day Attendance';
  weeklyDateRangeText = '';
  weekDaysList: { dayName: string; dateStr: string; formattedDate: string; isToday: boolean; isSelected: boolean }[] = [];
  weeklyTimetableMap: Record<string, PeriodSlotChip[]> = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  };
  selectedTimetableDay = '';

  // Audit Status - Attendance
  isAttendanceRecorded = false;
  recordedByName = '';
  recordedAtText = '';

  // Audit Status - Progress Evaluation
  isEvaluationRecorded = false;
  evaluatedByName = '';
  evaluatedAtText = '';
  evaluationRecordedCount = 0;

  // No-Class / Holiday / Annual Day Exception State
  @ViewChild('noClassDialog') noClassDialogRef!: TemplateRef<any>;
  todayException: EntityRecord | null = null;
  noClassType = 'specialActivity';
  noClassReason = 'Annual Day Function';
  isSavingException = false;

  get selectedDateDisplay(): string {
    if (!this.selectedDateObj) return this.selectedDateStr;
    try {
      return this.selectedDateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return this.selectedDateStr;
    }
  }

  // Tab State & Auto-Detected Progress Mode
  activeTab: 'attendance' | 'overview' | 'progress' | 'timetable' = 'attendance';
  studentTypeMode: 'hifz' | 'maktab' | 'dawr' = 'hifz';
  isHifzCourse = false;

  // Hifz, Dawr & Maktab Evaluation Mode & Unit Options
  hifzEvalMode: 'surah' | 'juz' | 'page' = 'surah';
  sabaqEvalMode: 'surah' | 'juz' = 'surah';
  sabqiEvalMode: 'surah' | 'juz' = 'surah';
  manzilEvalMode: 'surah' | 'juz' = 'surah';
  maktabEvalMode: 'subject' | 'quran' = 'subject';
  maktabQuranEvalMode: 'surah' | 'juz' = 'surah';
  allQuranSurahs = ALL_QURAN_SURAHS;
  allQuranJuzList: QuranJuzItem[] = ALL_QURAN_JUZ;
  allJuzNumbers: number[] = Array.from({ length: 30 }, (_, i) => i + 1);
  juzPortionOptions: string[] = [
    'Full Juz',
    '1st Quarter (Rub\' 1)',
    '2nd Quarter (Rub\' 2)',
    '3rd Quarter (Rub\' 3)',
    '4th Quarter (Rub\' 4)',
    '1st Half (Nisf 1)',
    '2nd Half (Nisf 2)'
  ];

  // Evaluation Cadence: 'daily' (Everyday register) vs 'weekly' (End-of-Week Batch)
  evalCadence: 'daily' | 'weekly' = 'weekly';
  weeklyEvalUnitMode: 'surah' | 'juz' = 'surah';
  selectedWeekYear: number = new Date().getFullYear();
  selectedWeekNumber: number = 1;
  selectedWeekStartStr: string = '';
  selectedWeekEndStr: string = '';
  selectedWeekDisplayText: string = '';
  isSavingWeeklyProgress = false;

  // Status Overview State for Org Admin & Madrasa Incharge
  overviewStatusTab: 'all' | 'taken' | 'pending' = 'all';
  overviewSearchQuery = '';
  overviewMadrasaFilterId = '';
  isOverviewLoading = false;
  overviewGroupStatuses: OverviewClassGroupStatus[] = [];

  // Target Editing State
  editingTargetItem: StudentSuiteRosterItem | null = null;
  tempTargetSurah = '';
  tempTargetFromAyah: number | null = null;
  tempTargetToAyah: number | null = null;
  tempTargetPage: number | null = null;
  tempTargetLine: number | null = null;
  tempTargetDawrRounds: number | null = null;
  // Timetable Staff Options
  staffOptions: { id: string; name: string; role?: string; madrasaName?: string; groupName?: string }[] = [];

  // Roster Data & Filtered Search
  roster: StudentSuiteRosterItem[] = [];
  searchQuery = '';

  isStudentInDawrStage(student: any): boolean {
    if (!student) return false;
    const stageStr = (
      student['stage'] ||
      student['stageName'] ||
      student['currentStage'] ||
      student['stageOrLevel'] ||
      student['level'] ||
      student['stageDisplay'] ||
      student['programStage'] ||
      student['dawrStage'] ||
      student['targetGoals']?.stage ||
      student['targetGoals']?.dawrStage ||
      student['hifzStage'] ||
      student['courseStage'] ||
      ''
    ).toString().toLowerCase();

    if (stageStr.includes('dawr') || stageStr.includes('daur') || stageStr.includes('revision') || stageStr.includes('repeat')) {
      return true;
    }

    if (student['isDawr'] === true || student['dawrStudent'] === true) {
      return true;
    }

    return false;
  }

  getStudentStageDisplay(student: any): string {
    if (!student) return '';
    const raw = (
      student['stage'] ||
      student['stageName'] ||
      student['currentStage'] ||
      student['stageOrLevel'] ||
      student['stageDisplay'] ||
      student['programStage'] ||
      student['dawrStage'] ||
      student['targetGoals']?.stage ||
      student['hifzStage'] ||
      student['courseStage'] ||
      student['level'] ||
      ''
    ).toString().trim();

    if (!raw || raw === '-' || raw.toLowerCase() === 'n/a') return '';

    // If raw matches a configured stage ID, display the stage's friendly name
    if (this.stages && this.stages.length) {
      const match = this.stages.find(s => s.id === raw);
      if (match) {
        return (match['name'] || match['title'] || raw).toString();
      }
    }

    const rawLower = raw.toLowerCase();

    // If raw matches the current active class group name, don't show it as a stage
    const currentGroup = (this.classGroups || []).find(g => g.id === this.selectedGroupId);
    const currentGroupName = (currentGroup?.['name'] || currentGroup?.['title'] || '').trim().toLowerCase();
    if (currentGroupName && (rawLower === currentGroupName || rawLower.includes(currentGroupName))) {
      return '';
    }

    // If raw matches any class group in this madrasa, ignore it
    if (this.classGroups && this.classGroups.some(g => (g['name'] || g['title'] || '').trim().toLowerCase() === rawLower)) {
      return '';
    }

    // Ignore if raw is clearly a class group name like "Group A" or contains " - Group "
    if (rawLower.includes(' - group ') || rawLower.includes(' – group ') || /^group\s+[a-z0-9]/i.test(rawLower)) {
      return '';
    }

    return raw;
  }

  get filteredRoster(): StudentSuiteRosterItem[] {
    let list = this.roster;
    if (this.studentTypeMode === 'dawr') {
      list = list.filter(item => this.isStudentInDawrStage(item.student));
    } else if (this.studentTypeMode === 'hifz') {
      const hasAnyDawr = this.roster.some(item => this.isStudentInDawrStage(item.student));
      if (hasAnyDawr) {
        list = list.filter(item => !this.isStudentInDawrStage(item.student));
      }
    }

    if (!this.searchQuery || !this.searchQuery.trim()) {
      return list;
    }
    const q = this.searchQuery.trim().toLowerCase();
    return list.filter(item => {
      const name = (item.student['fullName'] || item.student['name'] || '').toLowerCase();
      const phone = (item.student['parentPhone'] || item.student['phone'] || '').toLowerCase();
      const id = (item.student['admissionNo'] || item.student['id'] || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    });
  }

  // Summary Metrics
  totalEnrolled = 0;
  presentCount = 0;
  absentCount = 0;
  lateCount = 0;
  leaveCount = 0;
  presentRate = 0;

  // Save in-progress states
  isSavingAll = false;
  isSavingAttendance = false;
  isSavingProgress = false;

  // Report Metrics Data
  reportStudentSummaries: { studentName: string; presentPct: number; presentDays: number; totalDays: number; hifzAvgSabaq: string }[] = [];

  readonly refresh$ = new BehaviorSubject<void>(undefined);
  private isInitialDataLoaded = false;
  private rosterLoadedOnce = false;

  trackByStudentId(index: number, item: StudentSuiteRosterItem): string {
    return item?.student?.id || String(index);
  }

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly loader: LoaderService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initWeekState();
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      let changed = false;
      let dateOrWeekChanged = false;

      if (params['madrasaId'] && this.selectedMadrasaId !== params['madrasaId']) {
        this.selectedMadrasaId = params['madrasaId'];
        changed = true;
      }
      if (params['groupId'] && this.selectedGroupId !== params['groupId']) {
        this.selectedGroupId = params['groupId'];
        changed = true;
      }
      if (params['classId']) this.selectedClassId = params['classId'];

      if (params['tab'] && ['attendance', 'overview', 'progress', 'timetable'].includes(params['tab'])) {
        this.activeTab = params['tab'] as any;
      }

      if (params['mode'] || params['cadence']) {
        const mode = String(params['mode'] || params['cadence']).toLowerCase();
        if (mode === 'weekly' || mode === 'week') {
          if (this.evalCadence !== 'weekly') {
            this.evalCadence = 'weekly';
            changed = true;
          }
        } else if (mode === 'daily' || mode === 'day') {
          if (this.evalCadence !== 'daily') {
            this.evalCadence = 'daily';
            changed = true;
          }
        }
      }

      let weekTargetDate: Date | null = null;
      if (params['weekStart']) {
        const parts = String(params['weekStart']).split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(d.getTime())) {
            weekTargetDate = d;
          }
        }
      }

      if (params['date']) {
        const dStr = String(params['date']);
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const parsedDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(parsedDate.getTime())) {
            if (this.selectedDateStr !== dStr) {
              this.selectedDateObj = parsedDate;
              this.selectedDateStr = dStr;
              changed = true;
              dateOrWeekChanged = true;
            }
            if (!weekTargetDate) {
              weekTargetDate = parsedDate;
            }
          }
        }
      }

      if (weekTargetDate) {
        this.initWeekState(weekTargetDate);
        if (params['weekYear'] && params['weekNumber']) {
          const y = Number(params['weekYear']);
          const wn = Number(params['weekNumber']);
          if (!isNaN(y) && !isNaN(wn)) {
            this.selectedWeekYear = y;
            this.selectedWeekNumber = wn;
          }
        }
        dateOrWeekChanged = true;
      }

      if (changed && this.classGroups.length > 0) {
        const prevGroupId = this.selectedGroupId;
        this.filterGroupsForActiveScope();
        if (dateOrWeekChanged && this.selectedGroupId === prevGroupId && this.rosterLoadedOnce) {
          this.loadTimetablePeriods();
          this.loadRosterAndAttendance(true);
        }
      }
    });

    this.refresh$.pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.auth.profile$.pipe(
        filter((p): p is AppUser => !!p),
        distinctUntilChanged((prev, curr) => 
          prev?.uid === curr?.uid &&
          prev?.role === curr?.role &&
          prev?.organizationId === curr?.organizationId &&
          prev?.madrasaId === curr?.madrasaId
        )
      )),
      switchMap((profile) => {
        if (!profile) return of(null);
        this.currentUser = profile;
        this.evaluateUserRoles(profile);

        return combineLatest({
          madrasas: this.repo.list<EntityRecord>('madrasas', profile),
          stages: this.repo.list<EntityRecord>('stages', profile).pipe(catchError(() => of([]))),
          courses: this.repo.list<EntityRecord>('courses', profile).pipe(catchError(() => of([]))),
          classes: this.repo.list<EntityRecord>('classes', profile),
          classGroups: this.repo.list<EntityRecord>('classGroups', profile),
          staff: this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
          users: this.repo.list<EntityRecord>('users', profile).pipe(catchError(() => of([]))),
        });
      })
    ).subscribe((data) => {
      if (!data) return;
      this.madrasas = data.madrasas || [];
      this.stages = data.stages || [];
      this.courses = data.courses || [];
      this.classes = data.classes || [];
      this.classGroups = data.classGroups || [];
      this.rawStaff = data.staff || [];
      this.rawUsers = data.users || [];

      // Helper maps for resolving madrasa & group names
      const madrasaMap = new Map<string, string>();
      (data.madrasas || []).forEach((m: any) => {
        if (m.id) madrasaMap.set(m.id, m.name || m.title || '');
      });

      const groupMap = new Map<string, string>();
      (data.classGroups || []).forEach((g: any) => {
        if (g.id) groupMap.set(g.id, g.name || g.title || '');
      });

      const resolveMadrasaName = (item: any): string => {
        if (item.madrasaName) return item.madrasaName;
        if (item.madrasaId) return madrasaMap.get(item.madrasaId) || '';
        if (Array.isArray(item.madrasaIds) && item.madrasaIds.length > 0) {
          const names = item.madrasaIds.map((id: string) => madrasaMap.get(id)).filter(Boolean);
          if (names.length > 0) return names.join(', ');
        }
        return '';
      };

      const resolveGroupName = (item: any): string => {
        const foundNames = new Set<string>();

        if (item.groupName) foundNames.add(item.groupName);
        if (item.classGroupName) foundNames.add(item.classGroupName);
        if (item.sectionName) foundNames.add(item.sectionName);

        const idsToExtract = [
          item.classGroupId,
          item.groupId,
          item.assignedGroupId,
          item.group,
          item.sectionId,
          ...(Array.isArray(item.classGroupIds) ? item.classGroupIds : []),
          ...(Array.isArray(item.groupIds) ? item.groupIds : []),
          ...(Array.isArray(item.assignedGroupIds) ? item.assignedGroupIds : []),
          ...(Array.isArray(item.teachingGroupIds) ? item.teachingGroupIds : []),
          ...(Array.isArray(item.assignedGroups) ? item.assignedGroups : [])
        ];

        idsToExtract.forEach(id => {
          if (id && typeof id === 'string') {
            const name = groupMap.get(id);
            if (name) foundNames.add(name);
          }
        });

        const itemId = item.id || item.uid;
        if (itemId) {
          (data.classGroups || []).forEach((g: any) => {
            const gName = g.name || g.title || '';
            if (!gName) return;
            if (
              g.teacherId === itemId ||
              g.inchargeId === itemId ||
              g.staffId === itemId ||
              g.ustadhId === itemId ||
              (Array.isArray(g.teacherIds) && g.teacherIds.includes(itemId)) ||
              (Array.isArray(g.staffIds) && g.staffIds.includes(itemId))
            ) {
              foundNames.add(gName);
            }
          });
        }

        return Array.from(foundNames).join(', ');
      };

      // Extract & combine staff & teacher list for timetable dialog assignment
      const isOrgAdminUser = this.isOrgAdmin || this.isSuperAdmin;
      const TEACHING_ROLES = ['teacher', 'staff', 'madrasaincharge', 'ustadh', 'coordinator', 'instructor'];

      const staffList = (data.staff || [])
        .filter((s: any) => {
          if (!isOrgAdminUser && this.selectedMadrasaId && s.madrasaId && s.madrasaId !== this.selectedMadrasaId) return false;
          if (isOrgAdminUser) return true;
          const role = String(s.role || s.designation || '').toLowerCase();
          return !role || TEACHING_ROLES.some(r => role.includes(r));
        })
        .map((s: any) => ({
          id: s.id || s.name,
          name: s.name || s.fullName || s.displayName || 'Staff Member',
          role: s.role || s.designation || 'Ustadh',
          madrasaName: resolveMadrasaName(s),
          groupName: resolveGroupName(s)
        }));

      const userList = (data.users || [])
        .filter((u: any) => {
          if (!isOrgAdminUser && this.selectedMadrasaId && u.madrasaId && u.madrasaId !== this.selectedMadrasaId) return false;
          if (isOrgAdminUser) return true;
          const role = String(u.role || '').toLowerCase();
          return TEACHING_ROLES.includes(role);
        })
        .map((u: any) => ({
          id: u.id || u.uid,
          name: u.fullName || u.displayName || u.name || u.email || 'User',
          role: u.role === 'teacher' ? 'Ustadh / Teacher' : (u.role === 'madrasaIncharge' ? 'Madrasa Incharge' : (u.role || 'User')),
          madrasaName: resolveMadrasaName(u),
          groupName: resolveGroupName(u)
        }));

      const combined = [...staffList, ...userList];
      const seen = new Set();
      this.staffOptions = combined.filter(item => {
        const key = (item.name || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!this.isInitialDataLoaded) {
        this.isInitialDataLoaded = true;
        this.setupDefaultSelections();
        this.resolveAssignedStaffForCurrentGroup();
      } else {
        // Subsequent background snapshot update from Firestore
        this.resolveUserAssignments();
        this.syncAvailableGroupsAfterBackgroundUpdate();
        this.resolveAssignedStaffForCurrentGroup();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private evaluateUserRoles(profile: AppUser): void {
    const role = (profile.role || '').toLowerCase().replace(/[\s_-]/g, '');
    this.isSuperAdmin = role === 'superadmin';
    this.isOrgAdmin = role === 'organizationadmin' || role === 'orgadmin';
    this.isStageHead = role === 'stagehead';
    this.isMadrasaIncharge = role === 'madrasaincharge';
    this.isStaff = role === 'teacher' || role === 'staff';

    // Reports Permission Guard
    this.canManageReports = this.isSuperAdmin || 
                            this.isOrgAdmin || 
                            this.isStageHead || 
                            this.isMadrasaIncharge || 
                            (profile.permissions || []).includes('generateReports');

    // Management Rights Guard
    this.canManageAttendance = this.isSuperAdmin || 
                               this.isOrgAdmin || 
                               this.isStageHead || 
                               this.isMadrasaIncharge || 
                               this.isStaff ||
                               (profile.permissions || []).includes('takeAttendance');

    this.canSelectMadrasa = this.isSuperAdmin || 
                            this.isOrgAdmin || 
                            (this.isMadrasaIncharge && Array.isArray((profile as any).inchargeMadrasaIds) && (profile as any).inchargeMadrasaIds.length > 1) ||
                            (Array.isArray((profile as any).madrasaIds) && (profile as any).madrasaIds.length > 1);
  }

  private resolveUserAssignments(): void {
    if (!this.currentUser) return;

    if (this.isSuperAdmin || this.isOrgAdmin) {
      this.userAssignedGroupIds = new Set(this.classGroups.map(g => g.id || '').filter(Boolean));
      this.userAssignedMadrasaIds = new Set(this.madrasas.map(m => m.id || '').filter(Boolean));
      this.filteredMadrasasForUser = [...this.madrasas];
      return;
    }

    const u = this.currentUser as any;
    const profileIds = new Set<string>([
      u.uid, u.id, u.entityId, u.email,
      ...(Array.isArray(u.profileIds) ? u.profileIds : [])
    ].map(v => String(v || '').trim()).filter(Boolean));

    const userNames = new Set<string>([
      u.name, u.fullName, u.displayName
    ].map(v => String(v || '').trim().toLowerCase()).filter(Boolean));

    const matchingStaffDoc = [...this.rawStaff, ...this.rawUsers].find(docItem => {
      const docId = String(docItem.id || docItem['uid'] || '').trim();
      const docEmail = String(docItem['email'] || '').trim();
      const docName = String(docItem['name'] || docItem['fullName'] || docItem['displayName'] || '').trim().toLowerCase();

      return (docId && profileIds.has(docId)) || (docEmail && profileIds.has(docEmail)) || (docName && userNames.has(docName));
    });

    if (matchingStaffDoc) {
      if (matchingStaffDoc.id) profileIds.add(String(matchingStaffDoc.id));
      if (matchingStaffDoc['uid']) profileIds.add(String(matchingStaffDoc['uid']));
    }

    const directGroupIds = [
      u.classGroupId, u.groupId, u.assignedGroupId, u.group, u.sectionId,
      ...(Array.isArray(u.classGroupIds) ? u.classGroupIds : []),
      ...(Array.isArray(u.groupIds) ? u.groupIds : []),
      ...(Array.isArray(u.assignedGroupIds) ? u.assignedGroupIds : []),
      ...(Array.isArray(u.teachingGroupIds) ? u.teachingGroupIds : []),
      ...(Array.isArray(u.assignedGroups) ? u.assignedGroups : []),
      ...(matchingStaffDoc ? [
        matchingStaffDoc['classGroupId'], matchingStaffDoc['groupId'], matchingStaffDoc['assignedGroupId'], matchingStaffDoc['group'], matchingStaffDoc['sectionId'],
        ...(Array.isArray(matchingStaffDoc['classGroupIds']) ? matchingStaffDoc['classGroupIds'] : []),
        ...(Array.isArray(matchingStaffDoc['groupIds']) ? matchingStaffDoc['groupIds'] : []),
        ...(Array.isArray(matchingStaffDoc['assignedGroupIds']) ? matchingStaffDoc['assignedGroupIds'] : []),
        ...(Array.isArray(matchingStaffDoc['teachingGroupIds']) ? matchingStaffDoc['teachingGroupIds'] : []),
        ...(Array.isArray(matchingStaffDoc['assignedGroups']) ? matchingStaffDoc['assignedGroups'] : [])
      ] : [])
    ].filter(Boolean).map(v => String(v).trim());

    const assignedGIds = new Set<string>(directGroupIds);

    this.classGroups.forEach(g => {
      if (!g.id) return;
      const gId = String(g.id);

      const staffIds = [
        g['teacherId'], g['staffId'], g['usthadhId'], g['ustadhId'], g['inchargeId'], g['teacherUid'], g['assignedStaffId'],
        ...(Array.isArray(g['teacherIds']) ? g['teacherIds'] : []),
        ...(Array.isArray(g['assignedStaffIds']) ? g['assignedStaffIds'] : []),
        ...(Array.isArray(g['staffIds']) ? g['staffIds'] : []),
        ...(Array.isArray(g['teachers']) ? g['teachers'] : []),
        ...(Array.isArray(g['staff']) ? g['staff'] : []),
        ...(Array.isArray(g['groupStaff']) ? g['groupStaff'] : [])
      ].filter(Boolean).map(v => String(v).trim());

      const staffNames = [
        g['teacherName'], g['staffName'], g['usthadhName'], g['ustadhName'], g['inchargeName'],
        ...(Array.isArray(g['teacherNames']) ? g['teacherNames'] : []),
        ...(Array.isArray(g['staffNames']) ? g['staffNames'] : [])
      ].filter(Boolean).map((n: any) => String(n).trim().toLowerCase());

      const isIdMatch = staffIds.some(id => profileIds.has(id));
      const isNameMatch = staffNames.some(name => userNames.has(name));

      if (isIdMatch || isNameMatch) {
        assignedGIds.add(gId);
      }
    });

    this.userAssignedGroupIds = assignedGIds;

    const assignedMIds = new Set<string>();

    if (u.madrasaId) assignedMIds.add(String(u.madrasaId));
    if (Array.isArray(u.madrasaIds)) u.madrasaIds.forEach((id: any) => assignedMIds.add(String(id)));
    if (Array.isArray(u.inchargeMadrasaIds)) u.inchargeMadrasaIds.forEach((id: any) => assignedMIds.add(String(id)));
    if (matchingStaffDoc?.['madrasaId']) assignedMIds.add(String(matchingStaffDoc['madrasaId']));
    if (Array.isArray(matchingStaffDoc?.['madrasaIds'])) matchingStaffDoc['madrasaIds'].forEach((id: any) => assignedMIds.add(String(id)));
    if (Array.isArray(matchingStaffDoc?.['inchargeMadrasaIds'])) matchingStaffDoc['inchargeMadrasaIds'].forEach((id: any) => assignedMIds.add(String(id)));

    this.classGroups.forEach(g => {
      if (g.id && assignedGIds.has(g.id)) {
        if (g['madrasaId']) assignedMIds.add(String(g['madrasaId']));
        if (Array.isArray(g['madrasaIds'])) g['madrasaIds'].forEach((id: any) => assignedMIds.add(String(id)));

        const cls = this.classes.find(c => c.id === g['classId']);
        if (cls?.['madrasaId']) assignedMIds.add(String(cls['madrasaId']));
        const courseId = g['courseId'] || cls?.['courseId'];
        const crs = this.courses.find(c => c.id === courseId);
        if (crs?.['madrasaId']) assignedMIds.add(String(crs['madrasaId']));
      }
    });

    this.userAssignedMadrasaIds = assignedMIds;

    if (assignedMIds.size > 0) {
      this.filteredMadrasasForUser = this.madrasas.filter(m => m.id && assignedMIds.has(m.id));
    } else {
      this.filteredMadrasasForUser = [...this.madrasas];
    }
  }

  private syncAvailableGroupsAfterBackgroundUpdate(): void {
    if (!this.currentUser) return;
    let available = [...this.classGroups];

    if (this.selectedMadrasaId) {
      available = available.filter(g => (
        g['madrasaId'] === this.selectedMadrasaId || 
        (g['madrasaIds'] && g['madrasaIds'].includes(this.selectedMadrasaId)) ||
        !g['madrasaId']
      ));
    }

    if (this.isStageHead && (this.currentUser as any).stageId) {
      const targetStageId = (this.currentUser as any).stageId;
      available = available.filter(g => g['stageId'] === targetStageId || g['stage'] === targetStageId);
    }

    const u = this.currentUser as any;
    const allMadrasaScope = Array.isArray(u.madrasaIds) && u.madrasaIds.length > 0 
      ? u.madrasaIds 
      : (u.madrasaId ? [u.madrasaId] : []);
    const inchargeMadrasaScope = Array.isArray(u.inchargeMadrasaIds) && u.inchargeMadrasaIds.length > 0
      ? u.inchargeMadrasaIds
      : allMadrasaScope;
    const inchargeMadrasaIds = new Set<string>(inchargeMadrasaScope.filter(Boolean).map((v: any) => String(v).trim()));
    const isCoordinatorRole = (this.currentUser as any).role?.toLowerCase().replace(/[\s_-]/g, '') === 'coordinator';
    const isSelectedMadrasaInchargeScope = (this.isMadrasaIncharge || isCoordinatorRole) && this.selectedMadrasaId && inchargeMadrasaIds.has(String(this.selectedMadrasaId).trim());

    if (!this.isSuperAdmin && !this.isOrgAdmin) {
      if (this.selectedMadrasaId) {
        if (!isSelectedMadrasaInchargeScope && this.userAssignedGroupIds.size > 0) {
          available = available.filter(g => g.id && this.userAssignedGroupIds.has(g.id));
        }
      } else {
        available = available.filter(g => {
          const mId = String(g['madrasaId'] || '');
          const isGroupInchargeScope = (this.isMadrasaIncharge || isCoordinatorRole) && inchargeMadrasaIds.has(mId);
          const isExplicitlyAssigned = g.id && this.userAssignedGroupIds.has(g.id);
          return isGroupInchargeScope || isExplicitlyAssigned;
        });
      }
    }

    this.availableClassGroupsForUser = available;

    if (this.availableClassGroupsForUser.length > 0) {
      const isCurrentStillAvailable = this.availableClassGroupsForUser.some(g => g.id === this.selectedGroupId);
      if (!isCurrentStillAvailable) {
        // Only if the group was removed do we switch
        this.selectedGroupId = this.availableClassGroupsForUser[0]?.id || '';
        this.rosterLoadedOnce = true;
        this.onGroupChanged(true);
      }
      // If current group is still available, keep active selection and do NOT reload roster
    } else {
      this.selectedGroupId = '';
      this.roster = [];
    }
  }

  private setupDefaultSelections(): void {
    if (!this.currentUser) return;

    this.resolveUserAssignments();

    // 1. Madrasa Selection
    const userMadrasas = (!this.isSuperAdmin && !this.isOrgAdmin && this.filteredMadrasasForUser.length > 0)
      ? this.filteredMadrasasForUser
      : this.madrasas;

    if (userMadrasas.length > 0) {
      if (!userMadrasas.some(m => m.id === this.selectedMadrasaId)) {
        this.selectedMadrasaId = userMadrasas[0]?.id || '';
      }
    }

    // 2. Class Group Selection Scoping
    this.filterGroupsForActiveScope();
    this.syncSearchTexts();
  }

  filterGroupsForActiveScope(): void {
    if (!this.currentUser) return;

    this.resolveUserAssignments();

    let available = [...this.classGroups];

    // Filter by Madrasa
    if (this.selectedMadrasaId) {
      available = available.filter(g => (
        g['madrasaId'] === this.selectedMadrasaId || 
        (g['madrasaIds'] && g['madrasaIds'].includes(this.selectedMadrasaId)) ||
        !g['madrasaId']
      ));
    }

    // Filter by Stage if Stage Head
    if (this.isStageHead && (this.currentUser as any).stageId) {
      const targetStageId = (this.currentUser as any).stageId;
      available = available.filter(g => g['stageId'] === targetStageId || g['stage'] === targetStageId);
    }

    const u = this.currentUser as any;
    
    const allMadrasaScope = Array.isArray(u.madrasaIds) && u.madrasaIds.length > 0 
      ? u.madrasaIds 
      : (u.madrasaId ? [u.madrasaId] : []);
      
    const inchargeMadrasaScope = Array.isArray(u.inchargeMadrasaIds) && u.inchargeMadrasaIds.length > 0
      ? u.inchargeMadrasaIds
      : allMadrasaScope;

    const inchargeMadrasaIds = new Set<string>(inchargeMadrasaScope.filter(Boolean).map((v: any) => String(v).trim()));

    const isCoordinatorRole = (this.currentUser as any).role?.toLowerCase().replace(/[\s_-]/g, '') === 'coordinator';
    const isSelectedMadrasaInchargeScope = (this.isMadrasaIncharge || isCoordinatorRole) && this.selectedMadrasaId && inchargeMadrasaIds.has(String(this.selectedMadrasaId).trim());

    // Strict Filter by Assigned Groups if Teacher/Staff OR if MadrasaIncharge operating outside their incharge madrasa
    if (!this.isSuperAdmin && !this.isOrgAdmin) {
      if (this.selectedMadrasaId) {
        if (!isSelectedMadrasaInchargeScope && this.userAssignedGroupIds.size > 0) {
          available = available.filter(g => g.id && this.userAssignedGroupIds.has(g.id));
        }
      } else {
        // "All Madrasas" view
        // Show groups that are EITHER in the incharge scope OR explicitly assigned to the user
        available = available.filter(g => {
          const mId = String(g['madrasaId'] || '');
          const isGroupInchargeScope = (this.isMadrasaIncharge || isCoordinatorRole) && inchargeMadrasaIds.has(mId);
          const isExplicitlyAssigned = g.id && this.userAssignedGroupIds.has(g.id);
          return isGroupInchargeScope || isExplicitlyAssigned;
        });
      }
    }

    this.availableClassGroupsForUser = available;

    if (this.availableClassGroupsForUser.length > 0) {
      const prevGroupId = this.selectedGroupId;
      if (!this.availableClassGroupsForUser.some(g => g.id === this.selectedGroupId)) {
        this.selectedGroupId = this.availableClassGroupsForUser[0]?.id || '';
      }
      if (this.selectedGroupId !== prevGroupId || !this.rosterLoadedOnce) {
        this.rosterLoadedOnce = true;
        this.onGroupChanged(true);
      }
    } else {
      this.selectedGroupId = '';
      this.roster = [];
    }
  }

  onMadrasaChanged(): void {
    this.filterGroupsForActiveScope();
  }

  onGroupChanged(forceShowLoader = true): void {
    const grp = this.classGroups.find(g => g.id === this.selectedGroupId);
    if (grp) {
      if (grp['classId']) {
        this.selectedClassId = grp['classId'];
      }

      // Auto-detect Course/Stage Type: ClassGroup -> Class -> Course
      const cls = this.classes.find(c => c.id === this.selectedClassId || c.id === grp['classId']);
      const courseId = cls ? cls['courseId'] : (grp['courseId'] || '');
      const course = this.courses.find(c => c.id === courseId);
      const stage = this.stages.find(s => s.id === (grp['stageId'] || grp['stage']));

      const courseTypeStr = (
        (course ? (course['courseType'] || course['type'] || course['name'] || course['title']) : '') ||
        (cls ? (cls['courseType'] || cls['type'] || cls['name']) : '') ||
        (stage ? (stage['name'] || stage['title']) : '') ||
        grp['courseType'] || grp['name'] || grp['title'] || ''
      ).toString().toLowerCase();

      if (courseTypeStr.includes('dawr') || courseTypeStr.includes('daur') || courseTypeStr.includes('revision') || courseTypeStr.includes('repeat')) {
        this.studentTypeMode = 'dawr';
        this.isHifzCourse = true;
      } else if (courseTypeStr.includes('hifz') || courseTypeStr.includes('memoriz') || courseTypeStr.includes('sabq') || courseTypeStr.includes('quran')) {
        this.studentTypeMode = 'hifz';
        this.isHifzCourse = true;
      } else {
        this.studentTypeMode = 'maktab';
        this.isHifzCourse = false;
      }
    }

    this.resolveAssignedStaffForCurrentGroup();
    this.loadTimetablePeriods();
    this.loadRosterAndAttendance(forceShowLoader);
    this.syncSearchTexts();
  }

  filterMadrasas(): void {
    const selectedMad = this.madrasas.find(m => m.id === this.selectedMadrasaId);
    const selectedMadName = selectedMad ? (selectedMad['name'] || selectedMad['title'] || '').toLowerCase().trim() : '';

    const q = (this.madrasaSearchText || '').toLowerCase().trim();
    const sourceList = (!this.isSuperAdmin && !this.isOrgAdmin && this.filteredMadrasasForUser.length > 0)
      ? this.filteredMadrasasForUser
      : this.madrasas;

    if (!q || q === selectedMadName) {
      this.filteredMadrasas = [...sourceList];
    } else {
      this.filteredMadrasas = sourceList.filter(m => {
        const name = (m['name'] || m['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  onMadrasaOptionSelected(m: EntityRecord): void {
    if (!m) return;
    this.selectedMadrasaId = m.id || '';
    this.madrasaSearchText = m['name'] || m['title'] || '';
    this.onMadrasaChanged();
  }

  filterClassGroupsSearch(): void {
    const selectedGrp = this.availableClassGroupsForUser.find(g => g.id === this.selectedGroupId);
    const selectedName = selectedGrp ? (selectedGrp['name'] || selectedGrp['title'] || '').toLowerCase().trim() : '';

    const q = (this.groupSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredClassGroups = [...this.availableClassGroupsForUser];
    } else {
      this.filteredClassGroups = this.availableClassGroupsForUser.filter(g => {
        const name = (g['name'] || g['title'] || '').toLowerCase();
        const clsName = (g['className'] || '').toLowerCase();
        return name.includes(q) || clsName.includes(q);
      });
    }
  }

  onGroupOptionSelected(g: EntityRecord): void {
    if (!g) return;
    if (this.selectedGroupId !== g.id) {
      this.selectedGroupId = g.id || '';
      this.roster = [];
      this.groupSearchText = g['name'] || g['title'] || '';
      this.onGroupChanged(true);
    }
  }

  syncSearchTexts(): void {
    const m = this.madrasas.find(x => x.id === this.selectedMadrasaId);
    if (m) {
      this.madrasaSearchText = m['name'] || m['title'] || '';
    }
    const g = this.availableClassGroupsForUser.find(x => x.id === this.selectedGroupId);
    if (g) {
      this.groupSearchText = g['name'] || g['title'] || '';
    }
    this.filterMadrasas();
    this.filterClassGroupsSearch();
  }

  resolveAssignedStaffForCurrentGroup(): void {
    if (!this.selectedGroupId) {
      this.assignedStaffList = [];
      this.assignedStaffNamesDisplay = '';
      return;
    }

    const grp = this.classGroups.find(g => g.id === this.selectedGroupId);
    if (!grp) {
      this.assignedStaffList = [];
      this.assignedStaffNamesDisplay = '';
      return;
    }

    const foundNames = new Set<string>();
    const resultList: { id?: string; name: string; role?: string; allGroupNames?: string[] }[] = [];

    const addStaff = (name: string, role?: string, id?: string) => {
      if (!name) return;
      const cleanName = String(name).trim();
      if (!cleanName) return;
      const lower = cleanName.toLowerCase();
      if (!foundNames.has(lower)) {
        foundNames.add(lower);
        resultList.push({ id, name: cleanName, role: role || 'Ustadh / Teacher' });
      }
    };

    // 1. Check direct name fields on Class Group
    if (grp['teacherName']) addStaff(grp['teacherName'], 'Ustadh / Teacher');
    if (grp['staffName']) addStaff(grp['staffName'], 'Staff');
    if (grp['usthadhName'] || grp['ustadhName']) addStaff(grp['usthadhName'] || grp['ustadhName'], 'Ustadh');
    if (grp['inchargeName']) addStaff(grp['inchargeName'], 'Incharge');
    if (Array.isArray(grp['teacherNames'])) grp['teacherNames'].forEach((n: string) => addStaff(n));
    if (Array.isArray(grp['staffNames'])) grp['staffNames'].forEach((n: string) => addStaff(n));

    // 2. Check direct teacher IDs on Class Group
    const idKeys = [
      grp['teacherId'], grp['staffId'], grp['usthadhId'], grp['ustadhId'], grp['inchargeId'], grp['teacherUid'], grp['assignedStaffId'],
      ...(Array.isArray(grp['teacherIds']) ? grp['teacherIds'] : []),
      ...(Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'] : []),
      ...(Array.isArray(grp['staffIds']) ? grp['staffIds'] : []),
      ...(Array.isArray(grp['teachers']) ? grp['teachers'] : []),
      ...(Array.isArray(grp['staff']) ? grp['staff'] : []),
      ...(Array.isArray(grp['groupStaff']) ? grp['groupStaff'] : []),
    ].filter(Boolean);

    idKeys.forEach(id => {
      if (typeof id !== 'string') return;
      const matchOpt = this.staffOptions.find(s => s.id === id || s.name === id);
      if (matchOpt) {
        addStaff(matchOpt.name, matchOpt.role, matchOpt.id);
        return;
      }
      const matchStaff = this.rawStaff.find(s => (s.id || s['uid']) === id);
      if (matchStaff) {
        const name = matchStaff['name'] || matchStaff['fullName'] || matchStaff['displayName'];
        if (name) addStaff(name, matchStaff['role'] || matchStaff['designation'] || 'Ustadh', matchStaff.id);
        return;
      }
      const matchUser = this.rawUsers.find(u => (u.id || u['uid']) === id);
      if (matchUser) {
        const name = matchUser['fullName'] || matchUser['displayName'] || matchUser['name'];
        if (name) addStaff(name, matchUser['role'] === 'teacher' ? 'Ustadh / Teacher' : matchUser['role'], matchUser.id);
        return;
      }
    });

    // 3. Match staff/users whose assigned group IDs include this group ID or group name
    const grpId = grp.id;
    const grpName = (grp['name'] || grp['title'] || '').toString().toLowerCase();

    const checkUserAssigned = (u: any) => {
      const uId = u.id || u.uid;
      const uName = u.fullName || u.displayName || u.name;
      if (!uName) return;

      const userGroupIds = [
        u.classGroupId, u.groupId, u.assignedGroupId, u.group, u.sectionId,
        ...(Array.isArray(u.classGroupIds) ? u.classGroupIds : []),
        ...(Array.isArray(u.groupIds) ? u.groupIds : []),
        ...(Array.isArray(u.assignedGroupIds) ? u.assignedGroupIds : []),
        ...(Array.isArray(u.teachingGroupIds) ? u.teachingGroupIds : []),
        ...(Array.isArray(u.assignedGroups) ? u.assignedGroups : [])
      ].filter(Boolean);

      const isMatch = userGroupIds.some(gid => {
        const str = String(gid).toLowerCase();
        return str === grpId || (grpName && str === grpName);
      });

      if (isMatch) {
        addStaff(uName, u.role === 'teacher' ? 'Ustadh / Teacher' : (u.role || u.designation || 'Ustadh'), uId);
      }
    };

    this.rawStaff.forEach(s => checkUserAssigned(s));
    this.rawUsers.forEach(u => checkUserAssigned(u));

    // Enrich each assigned staff with ALL class group names they teach
    resultList.forEach(stItem => {
      const allGroupNames = new Set<string>();
      const stId = stItem.id;
      const stNameLower = stItem.name.toLowerCase();

      this.classGroups.forEach(cg => {
        const cgName = cg['name'] || cg['title'];
        if (!cgName) return;

        const ids = [
          cg['teacherId'], cg['staffId'], cg['usthadhId'], cg['ustadhId'], cg['inchargeId'], cg['teacherUid'], cg['assignedStaffId'],
          ...(Array.isArray(cg['teacherIds']) ? cg['teacherIds'] : []),
          ...(Array.isArray(cg['assignedStaffIds']) ? cg['assignedStaffIds'] : []),
          ...(Array.isArray(cg['staffIds']) ? cg['staffIds'] : []),
          ...(Array.isArray(cg['teachers']) ? cg['teachers'] : []),
          ...(Array.isArray(cg['staff']) ? cg['staff'] : []),
          ...(Array.isArray(cg['groupStaff']) ? cg['groupStaff'] : []),
        ].filter(Boolean);

        const names = [
          cg['teacherName'], cg['staffName'], cg['usthadhName'], cg['ustadhName'], cg['inchargeName'],
          ...(Array.isArray(cg['teacherNames']) ? cg['teacherNames'] : []),
          ...(Array.isArray(cg['staffNames']) ? cg['staffNames'] : [])
        ].filter(Boolean).map((n: any) => String(n).toLowerCase());

        if ((stId && ids.includes(stId)) || names.includes(stNameLower)) {
          allGroupNames.add(cgName);
        }
      });

      const rawMatch = [...this.rawStaff, ...this.rawUsers].find(u => (u.id || u['uid']) === stId || (u['name'] || u['fullName']) === stItem.name);
      if (rawMatch) {
        const uGids = [
          rawMatch['classGroupId'], rawMatch['groupId'], rawMatch['assignedGroupId'], rawMatch['group'], rawMatch['sectionId'],
          ...(Array.isArray(rawMatch['classGroupIds']) ? rawMatch['classGroupIds'] : []),
          ...(Array.isArray(rawMatch['groupIds']) ? rawMatch['groupIds'] : []),
          ...(Array.isArray(rawMatch['assignedGroupIds']) ? rawMatch['assignedGroupIds'] : []),
          ...(Array.isArray(rawMatch['teachingGroupIds']) ? rawMatch['teachingGroupIds'] : []),
          ...(Array.isArray(rawMatch['assignedGroups']) ? rawMatch['assignedGroups'] : [])
        ].filter(Boolean);

        uGids.forEach(gid => {
          const matchCg = this.classGroups.find(c => c.id === gid || c['name'] === gid || c['title'] === gid);
          if (matchCg) allGroupNames.add(matchCg['name'] || matchCg['title']);
          else if (typeof gid === 'string' && gid.length > 2 && isNaN(Number(gid))) allGroupNames.add(gid);
        });
      }

      stItem.allGroupNames = Array.from(allGroupNames);
    });

    this.assignedStaffList = resultList;
    this.assignedStaffNamesDisplay = resultList.map(s => s.name).join(', ');
  }

  onDateChanged(dateVal: Date): void {
    if (!dateVal) return;
    this.selectedDateObj = dateVal;
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${d}`;
    if (this.selectedDateStr !== newDateStr) {
      this.selectedDateStr = newDateStr;
      this.roster = [];
    }
    this.initWeekState(dateVal);
    this.loadTimetablePeriods();
    this.loadRosterAndAttendance(true);
    if (this.activeTab === 'overview') {
      this.loadOverviewStatusData();
    }
  }

  shiftDate(days: number): void {
    const newDate = new Date(this.selectedDateObj);
    newDate.setDate(newDate.getDate() + days);
    this.onDateChanged(newDate);
  }

  shiftWeek(direction: number): void {
    const newDate = new Date(this.selectedDateObj);
    newDate.setDate(newDate.getDate() + (direction * 7));
    this.onDateChanged(newDate);
  }

  jumpToCurrentWeek(): void {
    this.selectedTimetableDay = '';
    this.onDateChanged(new Date());
  }

  get hasAnyWeeklySlots(): boolean {
    return Object.values(this.weeklyTimetableMap || {}).some(slots => Array.isArray(slots) && slots.length > 0);
  }

  setAttendanceMode(mode: 'FULL_DAY' | 'PER_PERIOD'): void {
    this.attendanceMode = mode;
    if (mode === 'FULL_DAY') {
      this.selectedPeriodId = 'FULL_DAY';
      this.selectedPeriodTitle = 'Full Day Attendance';
    } else if (this.periodSlots.length > 0) {
      this.selectedPeriodId = this.periodSlots[0].id;
      this.selectedPeriodTitle = this.periodSlots[0].periodTitle;
    }
    this.loadRosterAndAttendance(true);
  }

  selectPeriodSlot(slot: PeriodSlotChip): void {
    this.selectedPeriodId = slot.id;
    this.selectedPeriodTitle = slot.periodTitle;
    this.loadRosterAndAttendance(true);
  }

  private loadTimetablePeriods(): void {
    if (!this.selectedGroupId) {
      this.periodSlots = [];
      this.weeklyTimetableMap = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
      return;
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysOfWeek[this.selectedDateObj.getDay()];

    // Calculate Week Range (Monday to Sunday) based on selectedDateObj
    const curr = new Date(this.selectedDateObj);
    const day = curr.getDay();
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr);
    monday.setDate(diffToMonday);

    const weekDaysNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayStr = this.getTodayDateString();

    this.weekDaysList = weekDaysNames.map((dName, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dateVal}`;
      const monthAbbr = d.toLocaleString('en-US', { month: 'short' });

      return {
        dayName: dName,
        dateStr: dateStr,
        formattedDate: `${monthAbbr} ${d.getDate()}`,
        isToday: dateStr === todayStr,
        isSelected: dName === (this.selectedTimetableDay || currentDayName)
      };
    });

    if (this.weekDaysList.length > 0) {
      this.weeklyDateRangeText = `${this.weekDaysList[0].formattedDate} - ${this.weekDaysList[6].formattedDate}, ${monday.getFullYear()}`;
    }

    if (!this.selectedTimetableDay) {
      this.selectedTimetableDay = currentDayName || 'Monday';
    }

    // Query timetable entries for group
    if (this.currentUser) {
      this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', this.currentUser).subscribe((entries) => {
        const groupEntries = entries.filter(e => 
          (e.groupId === this.selectedGroupId || (e as any).groupIds?.includes(this.selectedGroupId))
        );

        // Build Weekly Timetable Map for all 7 days
        const newMap: Record<string, PeriodSlotChip[]> = {
          Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
        };

        groupEntries.forEach((e, idx) => {
          const chip: PeriodSlotChip = {
            id: e.id || `period_${idx}`,
            periodTitle: e.activityName || `Period ${idx + 1}`,
            startTime: e.startTime || '',
            endTime: e.endTime || '',
            teacherName: (e as any).teacherName,
            subjectName: e.subjectName
          };

          const dayKey = e.dayOfWeek ? e.dayOfWeek : 'Monday';
          if (!newMap[dayKey]) newMap[dayKey] = [];
          newMap[dayKey].push(chip);
        });

        this.weeklyTimetableMap = newMap;

        // Filter current selected day slots for Attendance Per-Period view
        const todayGroupEntries = groupEntries.filter(e => !e.dayOfWeek || e.dayOfWeek === currentDayName);
        this.periodSlots = todayGroupEntries.map((e, idx) => ({
          id: e.id || `period_${idx}`,
          periodTitle: e.activityName || `Period ${idx + 1}`,
          startTime: e.startTime || '',
          endTime: e.endTime || '',
          teacherName: (e as any).teacherName,
          subjectName: e.subjectName
        }));

        if (this.attendanceMode === 'PER_PERIOD' && this.periodSlots.length > 0 && (!this.selectedPeriodId || this.selectedPeriodId === 'FULL_DAY')) {
          this.selectedPeriodId = this.periodSlots[0].id;
          this.selectedPeriodTitle = this.periodSlots[0].periodTitle;
        }
      });
    }
  }

  async createDefaultWeeklyQuranSchedule(): Promise<void> {
    if (!this.selectedGroupId || !this.currentUser) {
      this.snackBar.open('Please select a Class Group first', 'Dismiss', { duration: 3000 });
      return;
    }

    try {
      this.loader.show();
      const activeGroup = this.classGroups.find(g => g.id === this.selectedGroupId);
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      for (const dayOfWeek of days) {
        const payload = {
          classPlanId: this.selectedGroupId,
          groupId: this.selectedGroupId,
          classId: this.selectedClassId || activeGroup?.['classId'] || '',
          madrasaId: this.selectedMadrasaId || activeGroup?.['madrasaId'] || '',
          organizationId: this.currentUser.organizationId || '',
          activityName: dayOfWeek === 'Saturday' ? 'Tarbiyah & Etiquette' : 'Quran Class',
          hifzSessionType: dayOfWeek === 'Saturday' ? null : 'sabak',
          dayOfWeek: dayOfWeek,
          startTime: 'Anytime',
          endTime: '',
          scheduleType: 'period',
          status: 'active',
          createdAt: Timestamp.now(),
          createdBy: this.currentUser.uid
        };

        await this.repo.create('timetableEntries', payload, this.currentUser);
      }

      this.repo.clearCache();
      this.loadTimetablePeriods();
      this.snackBar.open('7-Day Quran Class Schedule created with Anytime timing!', 'Dismiss', { duration: 3500 });
    } catch (err) {
      console.error('Error creating default weekly schedule:', err);
      this.snackBar.open('Failed to create default schedule', 'Close', { duration: 3500 });
    } finally {
      this.loader.hide();
    }
  }

  openEditTimetableDialog(slot: PeriodSlotChip): void {
    if (!this.selectedGroupId) return;

    const activeGroup = this.classGroups.find(g => g.id === this.selectedGroupId);

    const dialogRef = this.dialog.open(SimpleTimetableSlotDialogComponent, {
      width: '560px',
      maxHeight: '85vh',
      panelClass: 'simple-timetable-dialog-panel',
      autoFocus: false,
      data: {
        planId: this.selectedGroupId,
        groupId: this.selectedGroupId,
        classId: this.selectedClassId || activeGroup?.['classId'] || '',
        madrasaId: this.selectedMadrasaId || activeGroup?.['madrasaId'] || '',
        organizationId: this.currentUser?.organizationId || '',
        dayOfWeek: this.selectedTimetableDay,
        entry: slot,
        assignedStaffOptions: this.staffOptions
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadTimetablePeriods();
      }
    });
  }

  openAddTimetableDialog(): void {
    if (!this.selectedGroupId) {
      this.snackBar.open('Please select a Class Group first', 'Dismiss', { duration: 3000 });
      return;
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysOfWeek[this.selectedDateObj.getDay()];
    const activeGroup = this.classGroups.find(g => g.id === this.selectedGroupId);

    const dialogRef = this.dialog.open(SimpleTimetableSlotDialogComponent, {
      width: '560px',
      maxHeight: '85vh',
      panelClass: 'simple-timetable-dialog-panel',
      autoFocus: false,
      data: {
        planId: this.selectedGroupId,
        groupId: this.selectedGroupId,
        classId: this.selectedClassId || activeGroup?.['classId'] || '',
        madrasaId: this.selectedMadrasaId || activeGroup?.['madrasaId'] || '',
        organizationId: this.currentUser?.organizationId || '',
        dayOfWeek: currentDayName,
        assignedStaffOptions: this.staffOptions
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadTimetablePeriods();
      }
    });
  }

  getParentPhone(student: any): string {
    if (!student) return '';
    return student['parentMobileNumber'] || 
           student['fatherMobileNumber'] || 
           student['fatherPhone'] || 
           student['parentPhone'] || 
           student['parentContact'] || 
           student['guardianPhone'] || 
           student['phone'] || 
           student['mobile'] || 
           student['whatsappNumber'] || '';
  }

  getSelectedGroupName(): string {
    if (!this.selectedGroupId) return '';
    const g = (this.classGroups || []).find(item => item.id === this.selectedGroupId);
    return g ? (g['name'] || g['title'] || '') : '';
  }

  openStudentAttendanceHistoryModal(item: StudentSuiteRosterItem): void {
    this.dialog.open(StudentAttendanceHistoryDialogComponent, {
      width: '780px',
      maxWidth: '95vw',
      panelClass: 'custom-attendance-history-panel',
      data: {
        studentName: item.student['fullName'] || item.student['name'] || 'Student',
        admissionNo: item.student['admissionNo'] || '',
        parentPhone: this.getParentPhone(item.student),
        groupName: this.getSelectedGroupName() || 'Class Group',
        records: item.attendanceHistoryRecords || []
      }
    });
  }

  private async loadRosterAndAttendance(forceShowLoader = false): Promise<void> {
    if (!this.selectedGroupId || !this.currentUser) {
      this.roster = [];
      return;
    }

    const shouldShowLoader = forceShowLoader || this.roster.length === 0;

    try {
      if (shouldShowLoader) {
        this.loader.show();
      }
      const firestore = getDeenDeskFirestore();

      // 0. Fetch org default Dawr rounds (bypass cache — always fresh)
      let orgDefaultDawrRounds = 3;
      if (this.currentUser?.organizationId) {
        try {
          const orgSnap = await getDoc(doc(firestore, 'organizations', this.currentUser.organizationId));
          if (orgSnap.exists()) {
            const parsed = parseInt(String(orgSnap.data()?.['academicSettings']?.['defaultDawrRounds'] ?? ''), 10);
            if (!isNaN(parsed) && parsed > 0) orgDefaultDawrRounds = parsed;
          }
        } catch { /* fallback to 3 */ }
      }

      // 1. Fetch Students in Class Group (filtering out inactive/archived/deleted students and matching group tokens)
      const studentsList = await this.repo.getAllOnce<EntityRecord>('students', this.currentUser);
      const extractId = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.id) return String(val.id);
        return String(val);
      };

      const groupStudents = studentsList.filter(s => {
        // Status filter: ignore inactive, disabled, suspended, archived, deleted, left, graduated
        const status = String(s['status'] || s['state'] || s['academicStatus'] || '').toLowerCase();
        if (['inactive', 'disabled', 'suspended', 'archived', 'deleted', 'left', 'graduated'].includes(status)) return false;
        if (s['isArchived'] === true || s['isDeleted'] === true || s['inactive'] === true) return false;

        // Group token matching
        const tokens = new Set<string>();
        const addToken = (v: any) => {
          if (Array.isArray(v)) {
            v.forEach(item => { const id = extractId(item); if (id) tokens.add(id); });
          } else {
            const id = extractId(v); if (id) tokens.add(id);
          }
        };

        addToken(s['groupId']);
        addToken(s['classGroupId']);
        addToken(s['assignedGroupId']);
        addToken(s['group']);
        addToken(s['sectionId']);
        addToken(s['section']);
        addToken(s['classPlanId']);
        addToken(s['classPlan']);
        addToken(s['planId']);
        addToken(s['groupIds']);
        addToken(s['classGroupIds']);
        addToken(s['assignedGroupIds']);
        addToken(s['groups']);
        addToken(s['sections']);

        return tokens.has(this.selectedGroupId);
      });

      // 2. Fetch Attendance Record Document for current Group + Date + Period
      const docId = `${this.selectedMadrasaId || 'default'}_${this.selectedGroupId}_${this.selectedDateStr}_${this.selectedPeriodId}`;
      const attendanceDocRef = doc(firestore, 'attendance', docId);
      let snap: any = null;
      try {
        snap = await getDoc(attendanceDocRef);
      } catch (attErr) {
        console.warn('Could not fetch attendance record:', attErr);
      }

      let savedAttendanceMap: Record<string, { status: AttendanceStatus; note?: string }> = {};

      if (snap && snap.exists()) {
        const data = snap.data();
        this.isAttendanceRecorded = true;
        this.recordedByName = data['takenByName'] || 'Authorized Teacher';
        this.recordedAtText = data['takenAt'] ? new Date(data['takenAt'].toDate ? data['takenAt'].toDate() : data['takenAt']).toLocaleString() : 'Saved';
        savedAttendanceMap = data['records'] || {};
      } else {
        this.isAttendanceRecorded = false;
        this.recordedByName = '';
        this.recordedAtText = '';
      }

      // Check if this date has a Class Exception (Holiday, Annual Day, Event)
      try {
        const allExceptions = await this.repo.getAllOnce<EntityRecord>('classPlanExceptions', this.currentUser);
        this.todayException = allExceptions.find(e => 
          (String(e['groupId']) === this.selectedGroupId || String(e['classPlanId']) === this.selectedGroupId || String(e['madrasaId']) === this.selectedMadrasaId) &&
          (e['date'] === this.selectedDateStr || e['dateStr'] === this.selectedDateStr)
        ) || null;
      } catch (exErr) {
        this.todayException = null;
      }

      // 3. Fetch Daily Progress Records & Student Target Records
      const progressMap = new Map<string, any>();
      const groupStudentIdSet = new Set(groupStudents.map(s => String(s.id)));

      try {
        const allCachedDailyProgress = await this.repo.getAllOnce<EntityRecord>('studentDailyProgress', this.currentUser);
        allCachedDailyProgress.forEach(p => {
          const stId = String(p['studentId'] || '');
          if (stId && groupStudentIdSet.has(stId)) {
            let pDate = p['date'] || p['dateStr'] || p['selectedDate'] || p['dateKey'];
            if (!pDate && p['createdAt']) {
              const c = p['createdAt'] as any;
              if (typeof c?.toDate === 'function') pDate = c.toDate().toISOString().slice(0, 10);
              else if (typeof c === 'string') pDate = c.slice(0, 10);
            }
            if (pDate === this.selectedDateStr || String(p.id).includes(this.selectedDateStr)) {
              progressMap.set(stId, p);
            }
          }
        });
      } catch (cacheErr) {
        console.warn('Could not query cached studentDailyProgress records:', cacheErr);
      }

      // For any student not found in cache, fall back to direct doc lookup
      const missingStudents = groupStudents.filter(st => st.id && !progressMap.has(st.id));
      const progressPromises = missingStudents.map(async st => {
        if (st.id) {
          try {
            const pDocRef = doc(firestore, 'studentDailyProgress', `${st.id}_${this.selectedDateStr}`);
            const pSnap = await getDoc(pDocRef);
            if (pSnap && pSnap.exists()) {
              return { id: st.id, data: pSnap.data() };
            }

            // Fallback: Check if weekly evaluation was recorded for this student for this week
            const wDocRef = doc(firestore, 'studentWeeklyProgress', `${st.id}_week_${this.selectedWeekYear}_${this.selectedWeekNumber}`);
            const wSnap = await getDoc(wDocRef);
            if (wSnap && wSnap.exists()) {
              const wData = wSnap.data();
              const h = wData['hifz'] || {};
              const d = wData['dawr'] || {};
              const m = wData['maktab'] || {};
              return {
                id: st.id,
                data: {
                  ...wData,
                  hifzProgress: {
                    sabaqSurahName: h.sabaqEndSurah || h.sabaqStartSurah || '',
                    sabaqFromAyah: h.sabaqStartAyah,
                    sabaqToAyah: h.sabaqEndAyah,
                    sabaqJuzNo: h.sabaqStartJuz,
                    sabaqMistakes: h.weeklyMistakes || 0,
                    rating: h.rating || 5,
                    evalUnitMode: h.evalUnitMode
                  },
                  dawrProgress: {
                    roundNo: d.roundNo || (d.weeklyJuzCount ? 1 : 1),
                    portionJuz: d.weeklyJuzCount ? `${d.weeklyJuzCount} Juz` : 'Revision',
                    rating: d.rating || 5
                  },
                  maktabProgress: {
                    subjectName: m.subject || '',
                    pageNo: m.startPage || null,
                    mistakesCount: m.mistakes || 0
                  }
                }
              };
            }
          } catch (pErr) {
            console.warn(`Could not fetch daily progress for student ${st.id}:`, pErr);
          }
        }
        return null;
      });

      const progressResults = await Promise.all(progressPromises);
      progressResults.forEach(res => {
        if (res) progressMap.set(res.id, res.data);
      });

      // Fetch overall attendance list to compute attendance history stats for each student
      let allAttendanceList: EntityRecord[] = [];
      try {
        allAttendanceList = await this.repo.getAllOnce<EntityRecord>('attendance', this.currentUser);
      } catch (attHistoryErr) {
        console.warn('Could not fetch overall attendance history:', attHistoryErr);
      }
      const groupAttendanceDocs = allAttendanceList.filter(a => 
        a['groupId'] === this.selectedGroupId || a['classPlanId'] === this.selectedGroupId
      );

      // Snapshot any existing in-progress input items to preserve user typing
      const existingRosterMap = new Map<string, StudentSuiteRosterItem>();
      this.roster.forEach(r => {
        if (r.student?.id) existingRosterMap.set(r.student.id, r);
      });

      // 4. Build Roster Items
      this.roster = groupStudents.map(student => {
        const stId = student.id || '';
        const saved = stId ? savedAttendanceMap[stId] : undefined;
        const prog = stId ? progressMap.get(stId) : undefined;
        const hifz = prog?.hifzProgress || {};
        const dawr = prog?.dawrProgress || {};
        const maktab = prog?.maktabProgress || {};
        const targets = prog?.targetGoals || student['targetGoals'] || {};
        const existing = stId ? existingRosterMap.get(stId) : undefined;

        // Resolve all class group names for student
        const studentGroupNames = new Set<string>();
        const stGroupIds = [
          student['groupId'], student['classGroupId'], student['assignedGroupId'], student['group'], student['sectionId'],
          ...(Array.isArray(student['groupIds']) ? student['groupIds'] : []),
          ...(Array.isArray(student['classGroupIds']) ? student['classGroupIds'] : []),
          ...(Array.isArray(student['assignedGroupIds']) ? student['assignedGroupIds'] : [])
        ].filter(Boolean);

        stGroupIds.forEach(gid => {
          const matchGrp = this.classGroups.find(g => g.id === gid || g['name'] === gid || g['title'] === gid);
          if (matchGrp) studentGroupNames.add(matchGrp['name'] || matchGrp['title']);
          else if (typeof gid === 'string' && gid.length > 2 && isNaN(Number(gid))) studentGroupNames.add(gid);
        });

        const historyRecords: StudentAttendanceHistoryRecord[] = [];
        let totalMarked = 0;
        let presentCount = 0;
        groupAttendanceDocs.forEach(attDoc => {
          const recs = attDoc['records'] || {};
          const stRec = recs[stId];
          if (stRec && stRec.status) {
            totalMarked++;
            if (stRec.status === 'present' || stRec.status === 'late') {
              presentCount++;
            }
            const createdAtVal = attDoc['createdAt'] as any;
            let dateVal = (attDoc['date'] || attDoc['selectedDate'] || attDoc['dateStr'] || '') as string;
            if (!dateVal && createdAtVal) {
              if (typeof createdAtVal?.toDate === 'function') {
                dateVal = createdAtVal.toDate().toISOString().slice(0, 10);
              } else if (typeof createdAtVal === 'string') {
                dateVal = createdAtVal.slice(0, 10);
              }
            }

            historyRecords.push({
              date: dateVal,
              status: stRec.status as any,
              note: stRec.note || stRec.remarks || '',
              periodName: attDoc['periodName'] || attDoc['periodTitle'] || attDoc['sessionName'] || '',
              recordedByName: attDoc['recordedByName'] || attDoc['createdByName'] || ''
            });
          }
        });

        historyRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const attendancePct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
        const attendanceHistoryText = totalMarked > 0 ? `${attendancePct}% Present (${presentCount}/${totalMarked} Days)` : 'No Data';

        return {
          student,
          status: (existing && existing.status !== undefined) ? existing.status : (saved ? saved.status : 'present'),
          note: (existing && existing.note !== undefined) ? existing.note : (saved?.note || ''),
          attendancePct,
          attendanceHistoryText,
          attendanceHistoryRecords: historyRecords,
          targetPeriod: targets.period || 'weekly',
          targetStartDate: targets.startDate || '',
          targetEndDate: targets.endDate || '',
          targetSabaqSurah: targets.sabaqSurah || '',
          targetSabaqFromAyah: targets.sabaqFromAyah || null,
          targetSabaqToAyah: targets.sabaqToAyah || null,
          targetSabqiJuzRange: targets.sabqiJuzRange || '',
          targetManzilJuzRange: targets.manzilJuzRange || '',
          targetMaktabSubject: targets.maktabSubject || '',
          targetMaktabPage: targets.maktabPage || null,
          targetMaktabLineNo: targets.maktabLineNo || null,
          targetDawrRounds: targets.dawrRounds || student['targetDawrRounds'] || orgDefaultDawrRounds,
          targetDawrDailyJuz: targets.dawrDailyJuz || '',
          targetIncompleteReason: targets.incompleteReason || '',
          targetIncompleteNotes: targets.incompleteNotes || '',
          sabaqSurah: (existing && existing.sabaqSurah !== undefined) ? existing.sabaqSurah : (hifz.sabaqSurahName || prog?.sabaqSurah || targets.sabaqSurah || ''),
          sabaqFromAyah: (existing && existing.sabaqFromAyah !== undefined) ? existing.sabaqFromAyah : (hifz.sabaqFromAyah || prog?.sabaqAyahFrom || targets.sabaqFromAyah || null),
          sabaqToAyah: (existing && existing.sabaqToAyah !== undefined) ? existing.sabaqToAyah : (hifz.sabaqToAyah || prog?.sabaqAyahTo || targets.sabaqToAyah || null),
          sabaqMistakes: (existing && existing.sabaqMistakes !== undefined) ? existing.sabaqMistakes : (hifz.sabaqMistakes || prog?.sabaqMistakes || 0),
          sabaqJuz: (existing && existing.sabaqJuz !== undefined) ? existing.sabaqJuz : (hifz.sabaqJuzNo || prog?.sabaqJuz || null),
          sabaqJuzPortion: (existing && existing.sabaqJuzPortion !== undefined) ? existing.sabaqJuzPortion : (hifz.sabaqJuzPortion || 'Full Juz'),
          sabqiSurah: (existing && existing.sabqiSurah !== undefined) ? existing.sabqiSurah : (hifz.sabqiSurahName || prog?.sabqiJuz || ''),
          sabqiFromAyah: (existing && existing.sabqiFromAyah !== undefined) ? existing.sabqiFromAyah : (hifz.sabqiFromAyah || null),
          sabqiToAyah: (existing && existing.sabqiToAyah !== undefined) ? existing.sabqiToAyah : (hifz.sabqiToAyah || null),
          sabqiJuz: (existing && existing.sabqiJuz !== undefined) ? existing.sabqiJuz : (hifz.sabqiJuzNo || (prog?.sabqiJuz ? Number(prog.sabqiJuz) : null) || null),
          sabqiJuzPortion: (existing && existing.sabqiJuzPortion !== undefined) ? existing.sabqiJuzPortion : (hifz.sabqiJuzPortion || 'Full Juz'),
          sabqiMistakes: (existing && existing.sabqiMistakes !== undefined) ? existing.sabqiMistakes : (hifz.sabqiMistakes || prog?.sabqiMistakes || 0),
          manzilSurah: (existing && existing.manzilSurah !== undefined) ? existing.manzilSurah : (hifz.manzilSurahName || prog?.manzilJuz || ''),
          manzilFromAyah: (existing && existing.manzilFromAyah !== undefined) ? existing.manzilFromAyah : (hifz.manzilFromAyah || null),
          manzilToAyah: (existing && existing.manzilToAyah !== undefined) ? existing.manzilToAyah : (hifz.manzilToAyah || null),
          manzilJuz: (existing && existing.manzilJuz !== undefined) ? existing.manzilJuz : (hifz.manzilJuzNo || (prog?.manzilJuz ? Number(prog.manzilJuz) : null) || null),
          manzilJuzPortion: (existing && existing.manzilJuzPortion !== undefined) ? existing.manzilJuzPortion : (hifz.manzilJuzPortion || 'Full Juz'),
          manzilMistakes: (existing && existing.manzilMistakes !== undefined) ? existing.manzilMistakes : (hifz.manzilMistakes || prog?.manzilMistakes || 0),
          hifzRating: (existing && existing.hifzRating !== undefined) ? existing.hifzRating : (hifz.rating || prog?.starRating || 5),
          dawrRoundNo: (existing && existing.dawrRoundNo !== undefined) ? existing.dawrRoundNo : (dawr.roundNo || prog?.daurRoundNumber || prog?.dawrRoundNumber || null),
          dawrPortionJuz: (existing && existing.dawrPortionJuz !== undefined) ? existing.dawrPortionJuz : (dawr.portionJuz || (prog?.daurJuzFrom ? `Juz ${prog?.daurJuzFrom}` : null)),
          dawrFromAyah: (existing && existing.dawrFromAyah !== undefined) ? existing.dawrFromAyah : (dawr.fromAyah || null),
          dawrToAyah: (existing && existing.dawrToAyah !== undefined) ? existing.dawrToAyah : (dawr.toAyah || null),
          dawrMistakes: (existing && existing.dawrMistakes !== undefined) ? existing.dawrMistakes : (dawr.dawrMistakes !== undefined ? dawr.dawrMistakes : (prog?.daurMistakes || null)),
          dawrManzilMistakes: (existing && existing.dawrManzilMistakes !== undefined) ? existing.dawrManzilMistakes : (dawr.manzilMistakes !== undefined ? dawr.manzilMistakes : null),
          dawrRating: (existing && existing.dawrRating !== undefined) ? existing.dawrRating : (dawr.rating || prog?.starRating || 5),
          maktabStageMode: (existing && existing.maktabStageMode !== undefined)
            ? existing.maktabStageMode
            : (prog?.maktabStageMode || (maktab.stage === 'Tilawatul Quran' || prog?.quranReading || (maktab.subjectName && maktab.subjectName.startsWith('Quran:')) || (prog?.maktabSubject && prog?.maktabSubject.startsWith('Quran:')) ? 'tilawatul_quran' : 'miftah')),
          maktabSubject: (existing && existing.maktabSubject !== undefined) ? existing.maktabSubject : (maktab.subjectName || prog?.maktabSubject || prog?.subjectName || ''),
          maktabPage: (existing && existing.maktabPage !== undefined) ? existing.maktabPage : (maktab.pageNo || prog?.maktabPageNo || targets.maktabPage || null),
          maktabLineNo: (existing && existing.maktabLineNo !== undefined) ? existing.maktabLineNo : (maktab.lineNo || prog?.maktabLessonNo || targets.maktabLineNo || null),
          maktabMistakes: (existing && existing.maktabMistakes !== undefined) ? existing.maktabMistakes : (maktab.mistakesCount || prog?.overallMistakes || prog?.mistakesCount || 0),
          maktabRemarks: (existing && existing.maktabRemarks !== undefined) ? existing.maktabRemarks : (maktab.remarks || prog?.remarks || ''),
          tilawatSurah: (existing && existing.tilawatSurah !== undefined) ? existing.tilawatSurah : (prog?.quranReading?.surahName || maktab.surahName || prog?.tilawatSurah || ''),
          tilawatFromAyah: (existing && existing.tilawatFromAyah !== undefined) ? existing.tilawatFromAyah : (prog?.quranReading?.fromAyah || maktab.fromAyah || prog?.tilawatFromAyah || null),
          tilawatToAyah: (existing && existing.tilawatToAyah !== undefined) ? existing.tilawatToAyah : (prog?.quranReading?.toAyah || maktab.toAyah || prog?.tilawatToAyah || null),
          tilawatJuz: (existing && existing.tilawatJuz !== undefined) ? existing.tilawatJuz : (prog?.quranReading?.juzNo || maktab.juzNo || prog?.tilawatJuz || null),
          tilawatFromPage: (existing && existing.tilawatFromPage !== undefined) ? existing.tilawatFromPage : (prog?.quranReading?.fromPage || maktab.fromPage || prog?.tilawatFromPage || null),
          tilawatToPage: (existing && existing.tilawatToPage !== undefined) ? existing.tilawatToPage : (prog?.quranReading?.toPage || maktab.toPage || prog?.tilawatToPage || null),
          quranReading: (existing && existing.quranReading !== undefined) ? existing.quranReading : (prog?.quranReading || maktab.quranReading || null),
          maktabSubjectsList: (existing && existing.maktabSubjectsList !== undefined) ? existing.maktabSubjectsList : (prog?.maktabSubjectsList || [])
        };
      });

      if (this.evalCadence === 'weekly') {
        await this.loadWeeklyProgressData();
      }

      // Update Evaluation Audit Status
      const evaluatedItems = this.roster.filter(r => this.getStudentProgressStatus(r).isEvaluated);
      this.evaluationRecordedCount = evaluatedItems.length;
      this.isEvaluationRecorded = this.evaluationRecordedCount > 0;

      if (this.isEvaluationRecorded) {
        let evalName = '';
        let evalDate: any = null;
        for (const prog of progressMap.values()) {
          if (prog) {
            const name = prog['evaluatedByName'] || prog['recordedByName'] || prog['teacherName'] || prog['enteredByName'];
            if (name && !evalName) evalName = name;
            const timeVal = prog['recordedAt'] || prog['evaluatedAt'] || prog['takenAt'] || prog['createdAt'] || prog['timestamp'];
            if (timeVal && !evalDate) evalDate = timeVal;
          }
        }
        this.evaluatedByName = evalName || this.recordedByName || '';
        if (evalDate) {
          try {
            const d = typeof evalDate?.toDate === 'function' ? evalDate.toDate() : new Date(evalDate);
            if (!isNaN(d.getTime())) {
              const dStr = d.toLocaleDateString();
              const tStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              this.evaluatedAtText = `on ${dStr} at ${tStr}`;
            } else {
              this.evaluatedAtText = this.selectedDateStr ? `on ${this.selectedDateStr}` : '';
            }
          } catch {
            this.evaluatedAtText = this.selectedDateStr ? `on ${this.selectedDateStr}` : '';
          }
        } else {
          this.evaluatedAtText = this.selectedDateStr ? `on ${this.selectedDateStr}` : '';
        }
      } else {
        this.evaluatedByName = '';
        this.evaluatedAtText = '';
      }

      this.recalculateSummary();
      if (this.canManageReports) {
        this.calculateReportMetrics();
      }
    } catch (err) {
      console.error('Error loading classroom suite data:', err);
      this.snackBar.open('Error loading roster and attendance data', 'Close', { duration: 3000 });
    } finally {
      if (shouldShowLoader) {
        this.loader.hide();
      }
    }
  }

  setOverviewTabActive(): void {
    this.activeTab = 'overview';
    this.loadOverviewStatusData();
  }

  async loadOverviewStatusData(): Promise<void> {
    if (!this.currentUser) return;

    try {
      this.isOverviewLoading = true;
      const firestore = getDeenDeskFirestore();

      const allAttendance = await this.repo.getAllOnce<EntityRecord>('attendance', this.currentUser);
      const dateStr = this.selectedDateStr;

      const dateAttendanceList = allAttendance.filter(a => {
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

      const studentsList = await this.repo.getAllOnce<EntityRecord>('students', this.currentUser);

      let targetGroups: EntityRecord[] = [];
      if (this.isSuperAdmin || this.isOrgAdmin) {
        targetGroups = [...this.classGroups];
      } else {
        targetGroups = this.classGroups.filter(g => {
          const mId = String(g['madrasaId'] || '');
          const mIds = Array.isArray(g['madrasaIds']) ? g['madrasaIds'].map(String) : [];
          return this.userAssignedMadrasaIds.has(mId) || mIds.some(id => this.userAssignedMadrasaIds.has(id));
        });

        if (targetGroups.length === 0) {
          targetGroups = [...this.availableClassGroupsForUser];
        }
      }

      const madrasaMap = new Map<string, string>();
      this.madrasas.forEach(m => {
        if (m.id) madrasaMap.set(m.id, m['name'] || m['title'] || '');
      });

      const classMap = new Map<string, string>();
      this.classes.forEach(c => {
        if (c.id) classMap.set(c.id, c['name'] || c['title'] || '');
      });

      const results: OverviewClassGroupStatus[] = targetGroups.map(grp => {
        const grpId = String(grp.id);
        const grpMadrasaId = String(grp['madrasaId'] || '');
        const madrasaName = madrasaMap.get(grpMadrasaId) || grp['madrasaName'] || 'Madrasa';
        const className = classMap.get(grp['classId']) || grp['className'] || 'Class';

        const groupStudents = studentsList.filter(s => {
          const status = String(s['status'] || s['state'] || '').toLowerCase();
          if (['inactive', 'disabled', 'archived', 'deleted', 'left'].includes(status)) return false;
          if (s['isArchived'] === true || s['isDeleted'] === true) return false;

          const gIds = [
            s['groupId'], s['classGroupId'], s['assignedGroupId'], s['group'], s['sectionId'],
            ...(Array.isArray(s['groupIds']) ? s['groupIds'] : []),
            ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'] : [])
          ].filter(Boolean).map(String);

          return gIds.includes(grpId);
        });

        const totalStudents = groupStudents.length || Number(grp['studentCount'] || grp['totalStudents'] || 0);

        const directStaff = grp['assignedStaffName'] || grp['teacherName'] || grp['staffName'] || grp['inchargeName'];
        let assignedStaffName = typeof directStaff === 'string' ? directStaff.trim() : '';

        const attRecord = dateAttendanceList.find(a =>
          a['groupId'] === grpId || a['classGroupId'] === grpId || a['classPlanId'] === grpId || String(a.id).includes(grpId)
        );

        let isTaken = false;
        let takenByName = '';
        let takenAtText = '';
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let leaveCount = 0;

        if (attRecord) {
          const records = attRecord['records'] || attRecord['students'] || attRecord['attendanceMap'];
          const hasRecords = records && typeof records === 'object' && Object.keys(records).length > 0;

          if (hasRecords || attRecord['takenByName'] || attRecord['recordedByName'] || attRecord['status'] === 'completed') {
            isTaken = true;
            takenByName = attRecord['takenByName'] || attRecord['recordedByName'] || attRecord['takenBy'] || 'Teacher';

            if (attRecord['takenAt'] || attRecord['updatedAt']) {
              const t: any = attRecord['takenAt'] || attRecord['updatedAt'];
              const d = new Date(typeof t?.toDate === 'function' ? t.toDate() : t);
              takenAtText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              takenAtText = 'Saved';
            }

            if (records && typeof records === 'object') {
              Object.values(records).forEach((r: any) => {
                const st = String(r?.status || r || '').toLowerCase();
                if (st === 'present' || st === 'p') presentCount++;
                else if (st === 'absent' || st === 'a') absentCount++;
                else if (st === 'late' || st === 'l') lateCount++;
                else if (st === 'leave' || st === 'excused') leaveCount++;
              });
            }
          }
        }

        return {
          groupId: grpId,
          groupName: String(grp['name'] || grp['title'] || 'Class Group'),
          classId: grp['classId'],
          className,
          madrasaId: grpMadrasaId,
          madrasaName,
          isTaken,
          takenByName: takenByName || undefined,
          takenAtText: takenAtText || undefined,
          presentCount,
          absentCount,
          lateCount,
          leaveCount,
          totalStudents,
          assignedStaffName: assignedStaffName || 'Not Assigned'
        };
      });

      this.overviewGroupStatuses = results;
    } catch (err) {
      console.error('Error loading overview status data:', err);
    } finally {
      this.isOverviewLoading = false;
    }
  }

  get filteredOverviewGroupStatuses(): OverviewClassGroupStatus[] {
    let list = this.overviewGroupStatuses;

    if (this.overviewMadrasaFilterId) {
      list = list.filter(item => item.madrasaId === this.overviewMadrasaFilterId || item.madrasaName.toLowerCase().includes(this.overviewMadrasaFilterId.toLowerCase()));
    }

    if (this.overviewStatusTab === 'taken') {
      list = list.filter(item => item.isTaken);
    } else if (this.overviewStatusTab === 'pending') {
      list = list.filter(item => !item.isTaken);
    }

    if (this.overviewSearchQuery && this.overviewSearchQuery.trim()) {
      const q = this.overviewSearchQuery.trim().toLowerCase();
      list = list.filter(item =>
        item.groupName.toLowerCase().includes(q) ||
        item.className.toLowerCase().includes(q) ||
        item.madrasaName.toLowerCase().includes(q) ||
        (item.assignedStaffName && item.assignedStaffName.toLowerCase().includes(q))
      );
    }

    return list;
  }

  get groupedOverviewMadrasas(): { madrasaId: string; madrasaName: string; totalGroups: number; takenGroups: number; pendingGroups: number; groupStatuses: OverviewClassGroupStatus[] }[] {
    const map = new Map<string, { madrasaId: string; madrasaName: string; totalGroups: number; takenGroups: number; pendingGroups: number; groupStatuses: OverviewClassGroupStatus[] }>();

    this.filteredOverviewGroupStatuses.forEach(item => {
      const key = item.madrasaId || item.madrasaName || 'default';
      if (!map.has(key)) {
        map.set(key, {
          madrasaId: item.madrasaId,
          madrasaName: item.madrasaName,
          totalGroups: 0,
          takenGroups: 0,
          pendingGroups: 0,
          groupStatuses: []
        });
      }
      const mData = map.get(key)!;
      mData.totalGroups++;
      if (item.isTaken) mData.takenGroups++;
      else mData.pendingGroups++;
      mData.groupStatuses.push(item);
    });

    return Array.from(map.values());
  }

  get overviewTakenCount(): number {
    return this.overviewGroupStatuses.filter(g => g.isTaken).length;
  }

  get overviewPendingCount(): number {
    return this.overviewGroupStatuses.filter(g => !g.isTaken).length;
  }

  get overviewCompletionRate(): number {
    if (this.overviewGroupStatuses.length === 0) return 0;
    return Math.round((this.overviewTakenCount / this.overviewGroupStatuses.length) * 100);
  }

  navigateToTakeOrEditAttendance(item: OverviewClassGroupStatus): void {
    if (item.madrasaId) this.selectedMadrasaId = item.madrasaId;
    if (item.groupId) this.selectedGroupId = item.groupId;
    if (item.classId) this.selectedClassId = item.classId;

    this.activeTab = 'attendance';
    this.onGroupChanged();
  }

  async openOverviewDetailsModal(item: OverviewClassGroupStatus): Promise<void> {
    try {
      this.loader.show();
      const firestore = getDeenDeskFirestore();

      const studentsList = await this.repo.getAllOnce<EntityRecord>('students', this.currentUser);
      const groupStudents = studentsList.filter(s => {
        const gIds = [
          s['groupId'], s['classGroupId'], s['assignedGroupId'], s['group'], s['sectionId'],
          ...(Array.isArray(s['groupIds']) ? s['groupIds'] : []),
          ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'] : [])
        ].filter(Boolean).map(String);
        return gIds.includes(item.groupId);
      });

      const docId = `${item.madrasaId || 'default'}_${item.groupId}_${this.selectedDateStr}_${this.selectedPeriodId}`;
      const attendanceDocRef = doc(firestore, 'attendance', docId);
      let snap: any = null;
      try {
        snap = await getDoc(attendanceDocRef);
      } catch (e) {
        console.warn('Could not fetch attendance doc:', e);
      }

      const recordsMap = (snap && snap.exists()) ? (snap.data()['records'] || {}) : {};

      const studentRecords: StudentAttendanceDetailRecord[] = groupStudents.map(st => {
        const stId = String(st.id || st['uid'] || '');
        const rec = recordsMap[stId];
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
          parentPhone: this.getParentPhone(st)
        };
      });

      const dialogData: ClassGroupAttendanceDetailsDialogData = {
        groupId: item.groupId,
        groupName: item.groupName,
        madrasaName: item.madrasaName,
        className: item.className,
        dateStr: this.selectedDateStr,
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
    } catch (err) {
      console.error('Error opening details modal:', err);
    } finally {
      this.loader.hide();
    }
  }

  exportOverviewReport(): void {
    const dataList = this.filteredOverviewGroupStatuses;
    if (dataList.length === 0) {
      this.snackBar.open('No class group status records to export', 'Dismiss', { duration: 3000 });
      return;
    }

    const headers = ['Date', 'Madrasa', 'Class Group', 'Class', 'Status', 'Assigned Staff', 'Taken By', 'Taken Time', 'Present', 'Absent', 'Late', 'Leave', 'Total Students'];
    const rows = dataList.map(item => [
      `"${this.selectedDateStr}"`,
      `"${(item.madrasaName || '').replace(/"/g, '""')}"`,
      `"${(item.groupName || '').replace(/"/g, '""')}"`,
      `"${(item.className || '').replace(/"/g, '""')}"`,
      `"${item.isTaken ? 'Taken' : 'Pending'}"`,
      `"${(item.assignedStaffName || '').replace(/"/g, '""')}"`,
      `"${(item.takenByName || '-').replace(/"/g, '""')}"`,
      `"${(item.takenAtText || '-').replace(/"/g, '""')}"`,
      item.presentCount,
      item.absentCount,
      item.lateCount,
      item.leaveCount,
      item.totalStudents
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ClassGroup_Attendance_Status_${this.selectedDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackBar.open('Attendance Status Report exported successfully!', 'Dismiss', { duration: 3500 });
  }

  // Target MatDialog Launcher
  async openSetTargetModal(item: StudentSuiteRosterItem): Promise<void> {
    let defaultDawrRounds = 3;
    if (this.currentUser?.organizationId) {
      try {
        const orgSnap = await getDoc(doc(getDeenDeskFirestore(), 'organizations', this.currentUser.organizationId));
        if (orgSnap.exists()) {
          const orgData = orgSnap.data();
          const parsed = parseInt(String(orgData?.['academicSettings']?.['defaultDawrRounds'] ?? ''), 10);
          if (!isNaN(parsed) && parsed > 0) defaultDawrRounds = parsed;
        }
      } catch (err) {
        console.error('Failed to load org settings', err);
      }
    }

    const dialogRef = this.dialog.open(SetTargetDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'custom-target-dialog-panel',
      data: {
        student: item.student,
        studentTypeMode: this.studentTypeMode,
        defaultDawrRounds,
        currentTarget: {
          targetPeriod: item.targetPeriod || 'weekly',
          startDate: item.targetStartDate || this.selectedDateStr,
          endDate: item.targetEndDate || '',
          sabaqTargetMode: item.targetSabaqTargetMode || 'surah',
          sabaqJuz: item.targetSabaqJuz || item.sabaqJuz || null,
          sabaqSurah: item.targetSabaqSurah || item.sabaqSurah || '',
          sabaqFromAyah: item.targetSabaqFromAyah || item.sabaqFromAyah || 1,
          sabaqToAyah: item.targetSabaqToAyah || item.sabaqToAyah || 25,
          sabqiJuzRange: item.targetSabqiJuzRange || 'Juz 1 to 5',
          manzilJuzRange: item.targetManzilJuzRange || 'Juz 1 to 15',
          targetDawrRounds: item.targetDawrRounds || defaultDawrRounds,
          dawrDailyJuz: item.targetDawrDailyJuz || item.dawrPortionJuz || '2 Juz / day',
          maktabSubject: item.targetMaktabSubject || item.maktabSubject || '',
          maktabPage: item.targetMaktabPage || item.maktabPage || null,
          maktabLineNo: item.targetMaktabLineNo || item.maktabLineNo || null,
          isIncomplete: item.targetEndDate ? new Date(item.targetEndDate) < new Date(this.selectedDateStr) : false,
        }
      }
    });

    dialogRef.afterClosed().subscribe((res: any) => {
      if (res) {
        item.targetPeriod = res.targetPeriod;
        item.targetStartDate = res.startDate;
        item.targetEndDate = res.endDate;
        item.targetSabaqTargetMode = res.sabaqTargetMode;
        item.targetSabaqJuz = res.sabaqJuz;
        item.targetSabaqSurah = res.sabaqSurah;
        item.targetSabaqFromAyah = res.sabaqFromAyah;
        item.targetSabaqToAyah = res.sabaqToAyah;
        item.targetSabqiJuzRange = res.sabqiJuzRange;
        item.targetManzilJuzRange = res.manzilJuzRange;
        item.targetDawrRounds = res.dawrRounds;
        item.targetDawrDailyJuz = res.dawrDailyJuz;
        item.targetMaktabSubject = res.maktabSubject;
        item.targetMaktabPage = res.maktabPage;
        item.targetMaktabLineNo = res.maktabLineNo;
        item.targetIncompleteReason = res.incompleteReason;
        item.targetIncompleteNotes = res.incompleteNotes;

        // Auto-apply target values to today's evaluation fields
        if (this.studentTypeMode === 'hifz') {
          if (res.sabaqSurah) item.sabaqSurah = res.sabaqSurah;
          if (res.sabaqFromAyah) item.sabaqFromAyah = res.sabaqFromAyah;
          if (res.sabaqToAyah) item.sabaqToAyah = res.sabaqToAyah;
        } else if (this.studentTypeMode === 'dawr') {
          if (res.dawrDailyJuz) item.dawrPortionJuz = res.dawrDailyJuz;
        } else {
          if (res.maktabSubject) item.maktabSubject = res.maktabSubject;
          if (res.maktabPage) item.maktabPage = res.maktabPage;
        }

        this.snackBar.open(`Target Goal set for ${item.student['fullName'] || item.student['name']}`, 'OK', { duration: 3000 });
      }
    });
  }

  // Update Progress Modal Launcher
  openUpdateProgressModal(item: StudentSuiteRosterItem): void {
    const dialogRef = this.dialog.open(StudentProgressEntryDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'custom-target-dialog-panel',
      data: {
        student: item.student,
        studentTypeMode: this.studentTypeMode,
        currentUser: this.currentUser
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        item.student['progress'] = res;
      }
    });
  }

  // Open Full Student History, Lifecycle, Promotions, Demotions & Evaluations
  openStudentCompleteHistoryModal(student: EntityRecord): void {
    if (!student) return;
    this.dialog.open(StudentProgressTrackerDialogComponent, {
      width: '1000px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'custom-target-dialog-panel',
      data: {
        student: student
      }
    });
  }

  getStudentProgressText(student: EntityRecord): string | null {
    const prog = student['progress'];
    if (!prog) return null;
    
    if (this.studentTypeMode === 'hifz' && prog.hifz) {
      const juzs = prog.hifz.completedJuzs?.length || 0;
      return `${juzs}/30 Juz Completed`;
    }
    
    if (this.studentTypeMode === 'dawr' && prog.dawr) {
      const rounds = prog.dawr.completedRounds || 0;
      return `Round ${rounds + 1} In-Progress`;
    }
    
    return null;
  }

  openNoClassDialog(): void {
    if (!this.noClassDialogRef) return;
    if (!this.todayException) {
      this.noClassType = 'specialActivity';
      this.noClassReason = 'Annual Day Function';
    }
    this.dialog.open(this.noClassDialogRef, { width: '440px', panelClass: 'custom-no-class-dialog' });
  }

  async saveNoClassException(): Promise<void> {
    if (!this.currentUser || !this.selectedGroupId) return;
    this.isSavingException = true;
    try {
      const payload = {
        madrasaId: this.selectedMadrasaId || '',
        classPlanId: this.selectedGroupId || '',
        groupId: this.selectedGroupId || '',
        classId: this.selectedClassId || '',
        date: this.selectedDateStr,
        type: this.noClassType,
        reason: (this.noClassReason || '').trim() || (this.noClassType === 'specialActivity' ? 'Annual Day Function' : 'Holiday'),
        affectsAttendance: true,
        enableAttendance: false,
        createdByName: this.currentUser?.displayName || this.currentUser?.email || '',
        createdAt: Timestamp.now()
      };

      const docId = `ex_${this.selectedGroupId}_${this.selectedDateStr}`;
      const firestore = getDeenDeskFirestore();
      await setDoc(doc(firestore, 'classPlanExceptions', docId), { ...payload, id: docId }, { merge: true });
      this.repo.clearCache('classPlanExceptions');

      this.todayException = { ...payload, id: docId } as any;
      this.dialog.closeAll();
      this.snackBar.open(`Marked as ${payload.reason} (No Class)!`, 'Close', { duration: 3500 });
    } catch (err: any) {
      console.error('Error saving class exception:', err);
      this.snackBar.open('Failed to save exception', 'Close', { duration: 3000 });
    } finally {
      this.isSavingException = false;
    }
  }

  async removeTodayException(): Promise<void> {
    if (!this.todayException || !this.currentUser) return;
    this.isSavingException = true;
    try {
      const firestore = getDeenDeskFirestore();
      if (this.todayException.id) {
        await deleteDoc(doc(firestore, 'classPlanExceptions', String(this.todayException.id)));
      }
      this.repo.clearCache('classPlanExceptions');
      this.todayException = null;
      this.dialog.closeAll();
      this.snackBar.open('Exception removed. Normal class resumed.', 'Close', { duration: 3000 });
    } catch (err: any) {
      console.error('Error removing class exception:', err);
      this.snackBar.open('Failed to remove exception', 'Close', { duration: 3000 });
    } finally {
      this.isSavingException = false;
    }
  }

  async openConfigureDawrRounds(): Promise<void> {
    if (!(this.isOrgAdmin || this.isSuperAdmin) || !this.currentUser?.organizationId) return;
    
    // Fetch current org directly from Firestore (bypass cache) to get existing value
    let org: any = null;
    try {
      this.loader.show();
      const snap = await getDoc(doc(getDeenDeskFirestore(), 'organizations', this.currentUser.organizationId));
      if (snap.exists()) org = { id: snap.id, ...snap.data() };
    } catch (e) {
      console.error(e);
    } finally {
      this.loader.hide();
    }
    
    if (!org) return;

    const dialogRef = this.dialog.open(QuickAddDialogComponent, {
      width: '400px',
      data: {
        title: 'Configure Dawr Revision Cycles',
        subtitle: 'Set the required number of full Quran revisions for students in your organization.',
        submitLabel: 'Save',
        initialValue: {
          defaultDawrRounds: org.academicSettings?.defaultDawrRounds || 3
        },
        fields: [
          { key: 'defaultDawrRounds', label: 'Required Dawr Revision Cycles (for Sanad)', type: 'number' }
        ],
        saveFn: async (payload: any) => {
          const currentSettings = org.academicSettings || {};
          const rounds = parseInt(String(payload.defaultDawrRounds), 10);
          if (isNaN(rounds) || rounds < 1) throw new Error('Please enter a valid number of cycles (minimum 1).');
          await this.repo.update('organizations', this.currentUser!.organizationId as string, {
            academicSettings: {
              ...currentSettings,
              defaultDawrRounds: rounds
            }
          }, this.currentUser);
        }
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.snackBar.open('Dawr revision requirement updated successfully!', 'OK', { duration: 3000 });
      }
    });
  }

  getStudentProgressStatus(item: StudentSuiteRosterItem): { isEvaluated: boolean; label: string; details: string; rating: number; mistakes?: number | null } {
    if (this.studentTypeMode === 'maktab') {
      const qr = item.quranReading || {};
      const surah = item.tilawatSurah || qr.surahName || (item.maktabSubject && item.maktabSubject.startsWith('Quran:') ? item.maktabSubject.replace('Quran: ', '') : '');
      const juz = item.tilawatJuz || qr.juzNo;
      const hasTilawatContent = !!surah || !!juz || !!(qr.surahName || qr.juzNo);

      if (hasTilawatContent) {
        const fromA = item.tilawatFromAyah || qr.fromAyah || 1;
        const toA = item.tilawatToAyah || qr.toAyah || 1;
        const text = surah ? `Surah ${surah} (Ayah ${fromA}–${toA})` : (juz ? `Juz ${juz}` : 'Quran Reading');
        return {
          isEvaluated: true,
          label: 'Tilawatul Quran',
          details: text,
          rating: item.weeklyRating || 5,
          mistakes: item.maktabMistakes
        };
      }
      if (item.maktabSubjectsList && item.maktabSubjectsList.length > 0) {
        const subNames = item.maktabSubjectsList.map(s => `${s.customSubjectName || s.subject} (Pg ${s.startPage || 1}–${s.endPage || 1})`).join(' • ');
        return {
          isEvaluated: true,
          label: `${item.maktabSubjectsList.length} Subject${item.maktabSubjectsList.length > 1 ? 's' : ''}`,
          details: subNames,
          rating: item.weeklyRating || 5,
          mistakes: item.maktabMistakes
        };
      }
      if (item.weeklyMaktabSubject || (item.maktabSubject && !item.maktabSubject.startsWith('Quran:'))) {
        const name = item.weeklyMaktabSubject || item.maktabSubject;
        const startPg = item.weeklyMaktabStartPage || 1;
        const endPg = item.weeklyMaktabEndPage || item.maktabPage || 1;
        return {
          isEvaluated: true,
          label: name,
          details: `Pg ${startPg}–${endPg}${item.maktabLineNo ? ', Line ' + item.maktabLineNo : ''}`,
          rating: item.weeklyRating || 5,
          mistakes: item.maktabMistakes
        };
      }
      if (item.maktabPage !== null && item.maktabPage !== undefined && item.maktabPage > 0) {
        return {
          isEvaluated: true,
          label: 'Maktab Lesson',
          details: `Page ${item.maktabPage}`,
          rating: item.weeklyRating || 5,
          mistakes: item.maktabMistakes
        };
      }
      if (item.maktabRemarks && item.maktabRemarks.trim() && item.maktabRemarks.trim().toLowerCase() !== 'saved') {
        return {
          isEvaluated: true,
          label: 'Evaluation Recorded',
          details: item.maktabRemarks.trim(),
          rating: item.weeklyRating || 5,
          mistakes: item.maktabMistakes
        };
      }
    } else if (this.studentTypeMode === 'dawr') {
      const isDawrDone = (this.evalCadence === 'weekly')
        ? (item.weeklyDawrRounds !== null && item.weeklyDawrRounds !== undefined)
        : (item.dawrRoundNo !== null && item.dawrRoundNo !== undefined && !!item.dawrPortionJuz);

      if (isDawrDone) {
        const round = item.weeklyDawrRounds || item.dawrRoundNo || 1;
        const count = item.weeklyDawrJuzCount ? `${item.weeklyDawrJuzCount} Juzs` : (item.dawrPortionJuz || 'Revision');
        return {
          isEvaluated: true,
          label: `Round ${round}`,
          details: count,
          rating: item.weeklyRating || item.dawrRating || 5,
          mistakes: item.dawrMistakes
        };
      }
    } else {
      // Hifz
      if (item.hifzLessonsList && item.hifzLessonsList.length > 0) {
        const summary = item.hifzLessonsList.map(l => {
          if (l.mode === 'juz') {
            return `Juz ${l.juzNumber} (Pg ${l.fromPage || 1}–${l.toPage || 1})`;
          }
          return `${l.surahName || 'Surah'} (${l.fromAyah || 1}–${l.toAyah || 1})`;
        }).join(' • ');
        return {
          isEvaluated: true,
          label: 'Hifz Portions',
          details: summary,
          rating: item.weeklyRating || item.hifzRating || 5,
          mistakes: item.weeklyMistakes || item.sabaqMistakes
        };
      }

      const sabaq = item.weeklySabaqEndSurah || item.sabaqSurah;
      const sabaqJuz = item.weeklySabaqStartJuz || item.sabaqJuz;
      if (sabaq || sabaqJuz) {
        const sabaqText = sabaq
          ? `${sabaq} (${item.weeklySabaqStartAyah || item.sabaqFromAyah || 1}–${item.weeklySabaqEndAyah || item.sabaqToAyah || 1})`
          : `Juz ${sabaqJuz} (Pg ${item.weeklySabaqStartPage || 1}–${item.weeklySabaqEndPage || 1})`;

        const sabqiText = item.weeklySabqiRange || item.sabqiSurah || (item.weeklySabqiStartJuz ? `Juz ${item.weeklySabqiStartJuz}` : '');
        const manzilText = item.weeklyManzilRange || item.manzilSurah || (item.weeklyManzilStartJuz ? `Juz ${item.weeklyManzilStartJuz}` : '');

        let details = `New Lesson: ${sabaqText}`;
        if (sabqiText) details += ` | Old Lesson: ${sabqiText}`;
        if (manzilText) details += ` | Revision: ${manzilText}`;

        return {
          isEvaluated: true,
          label: sabaqText,
          details,
          rating: item.weeklyRating || item.hifzRating || 5,
          mistakes: item.weeklyMistakes || item.sabaqMistakes
        };
      }
    }

    // Cross-mode fallback: check if progress exists under a different curriculum branch
    if (item.sabaqSurah || item.weeklySabaqEndSurah) {
      const sName = item.weeklySabaqEndSurah || item.sabaqSurah;
      return {
        isEvaluated: true,
        label: sName || 'Hifz Sabaq',
        details: `Surah ${sName}`,
        rating: item.weeklyRating || item.hifzRating || 5,
        mistakes: item.sabaqMistakes
      };
    }
    if (item.maktabSubject || item.weeklyMaktabSubject) {
      const mName = item.weeklyMaktabSubject || item.maktabSubject;
      return {
        isEvaluated: true,
        label: mName || 'Maktab Subject',
        details: mName || 'Subject evaluated',
        rating: item.weeklyRating || 5,
        mistakes: item.maktabMistakes
      };
    }

    return {
      isEvaluated: false,
      label: 'Pending Evaluation',
      details: 'No progress recorded yet for this session',
      rating: 5,
      mistakes: null
    };
  }

  getEvaluatedCount(): number {
    return this.filteredRoster.filter(r => this.getStudentProgressStatus(r).isEvaluated).length;
  }

  getTargetGoalText(item: StudentSuiteRosterItem): string | null {
    if (item.targetGoal) return item.targetGoal;
    if (item.targetSabaqSurah) {
      return `${item.targetSabaqSurah} (${item.targetSabaqFromAyah || 1}–${item.targetSabaqToAyah || ''})`;
    }
    if (item.targetSabaqJuz) {
      return `Juz ${item.targetSabaqJuz}`;
    }
    if (item.targetMaktabSubject) {
      return `${item.targetMaktabSubject} (Pg ${item.targetMaktabPage || 1})`;
    }
    if (item.targetDawrDailyJuz) {
      return item.targetDawrDailyJuz;
    }
    return item.student['targetGoal'] || null;
  }

  // Single Student Comprehensive Evaluation Dialog Launcher
  openSingleStudentEvaluationModal(item: StudentSuiteRosterItem): void {
    const prevItemBackup = JSON.parse(JSON.stringify(item));

    const dialogRef = this.dialog.open(StudentProgressEvaluationDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'custom-target-dialog-panel',
      data: {
        student: item.student,
        studentTypeMode: this.studentTypeMode,
        evalCadence: this.evalCadence,
        selectedDateStr: this.selectedDateStr,
        selectedWeekYear: this.selectedWeekYear,
        selectedWeekNumber: this.selectedWeekNumber,
        selectedWeekStartStr: this.selectedWeekStartStr,
        selectedWeekEndStr: this.selectedWeekEndStr,
        classId: this.selectedClassId,
        groupId: this.selectedGroupId,
        madrasaId: this.selectedMadrasaId,
        currentUser: this.currentUser,
        isOrgAdmin: this.isOrgAdmin,
        isSuperAdmin: this.isSuperAdmin,
        currentRosterItem: item
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res && res.saved) {
        if (res.updatedProgress) {
          item.student['progress'] = res.updatedProgress;
        }
        if (this.studentTypeMode === 'maktab') {
          item.maktabStageMode = res.maktabStageMode;
          if (res.maktabStageMode === 'tilawatul_quran') {
            item.quranReading = res.quranReading;
            item.tilawatSurah = res.tilawatSurah;
            item.tilawatFromAyah = res.tilawatFromAyah;
            item.tilawatToAyah = res.tilawatToAyah;
            item.tilawatJuz = res.tilawatJuz;
            item.tilawatFromPage = res.tilawatFromPage;
            item.tilawatToPage = res.tilawatToPage;
            item.maktabSubject = res.dailyPayload?.maktabSubject || `Quran: ${res.tilawatSurah || 'Juz ' + res.tilawatJuz}`;
            item.weeklyMaktabSubject = item.maktabSubject;
            item.maktabPage = res.tilawatToPage || null;
            item.maktabLineNo = res.tilawatToAyah || null;
            item.maktabSubjectsList = [];
          } else {
            item.maktabSubjectsList = res.maktabSubjects;
            const firstSub = res.maktabSubjects && res.maktabSubjects[0];
            if (firstSub) {
              item.weeklyMaktabSubject = firstSub.customSubjectName || firstSub.subject;
              item.maktabSubject = firstSub.customSubjectName || firstSub.subject;
              item.weeklyMaktabStartPage = firstSub.startPage;
              item.weeklyMaktabEndPage = firstSub.endPage;
              item.maktabPage = firstSub.endPage;
              item.maktabLineNo = firstSub.lineNo;
            }
          }
        } else {
          item.weeklySabaqStartSurah = res.sabaqStartSurah;
          item.weeklySabaqStartAyah = res.sabaqStartAyah;
          item.weeklySabaqEndSurah = res.sabaqEndSurah;
          item.weeklySabaqEndAyah = res.sabaqEndAyah;
          item.weeklySabaqStartJuz = res.sabaqJuz;
          item.weeklySabaqEndJuz = res.sabaqJuz;
          item.weeklySabaqStartPage = res.sabaqStartPage;
          item.weeklySabaqEndPage = res.sabaqEndPage;

          item.sabaqSurah = res.sabaqEndSurah;
          item.sabaqFromAyah = res.sabaqStartAyah;
          item.sabaqToAyah = res.sabaqEndAyah;

          item.weeklySabqiStartSurah = res.sabqiStartSurah;
          item.weeklySabqiStartAyah = res.sabqiStartAyah;
          item.weeklySabqiEndSurah = res.sabqiEndSurah;
          item.weeklySabqiEndAyah = res.sabqiEndAyah;
          item.weeklySabqiStartJuz = res.sabqiJuz;
          item.weeklySabqiEndJuz = res.sabqiJuz;
          item.weeklySabqiStartPage = res.sabqiStartPage;
          item.weeklySabqiEndPage = res.sabqiEndPage;

          item.sabqiSurah = res.sabqiEndSurah;
          item.sabqiFromAyah = res.sabqiStartAyah;
          item.sabqiToAyah = res.sabqiEndAyah;

          item.weeklyManzilStartJuz = res.manzilStartJuz;
          item.weeklyManzilStartPortion = res.manzilStartPortion;
          item.weeklyManzilEndJuz = res.manzilEndJuz;
          item.weeklyManzilEndPortion = res.manzilEndPortion;

          if (this.studentTypeMode === 'dawr') {
            item.dawrRoundNo = res.dawrRoundNo || 1;
            item.dawrPortionJuz = res.manzilStartJuz ? `Juz ${res.manzilStartJuz} (${res.manzilStartPortion || 'Full Juz'})` : (item.dawrPortionJuz || 'Juz 1');
            item.weeklyDawrRounds = res.dawrRoundNo || 1;
            item.dawrMistakes = res.overallMistakes || 0;
            item.dawrRating = res.starRating || 5;
          }

          item.hifzLessonsList = res.hifzLessonsList;
        }

        item.weeklyRating = res.starRating;
        item.hifzRating = res.starRating;
        item.weeklyMistakes = res.overallMistakes;
        item.weeklyNotes = res.remarks;
        item.maktabRemarks = res.remarks;

        // Save snapshot for Undo
        this.lastProgressSaveSnapshot = {
          type: 'single',
          dateOrWeek: this.evalCadence === 'weekly' ? `${this.selectedWeekYear}_${this.selectedWeekNumber}` : this.selectedDateStr,
          savedDocRefs: res.savedDocRefs || [],
          rosterBackup: [prevItemBackup]
        };
        this.canUndoProgress = true;

        const snack = this.snackBar.open(
          `Progress recorded for ${item.student['fullName'] || item.student['name']}`,
          'UNDO',
          { duration: 8000 }
        );
        snack.onAction().subscribe(() => {
          this.undoLastProgressSave();
        });
      }
    });
  }

  // Bulk Actions
  markAll(status: AttendanceStatus): void {
    if (!this.canManageAttendance) return;
    this.roster.forEach(r => r.status = status);
    this.recalculateSummary();
  }

  recalculateSummary(): void {
    this.totalEnrolled = this.roster.length;
    this.presentCount = this.roster.filter(r => r.status === 'present').length;
    this.absentCount = this.roster.filter(r => r.status === 'absent').length;
    this.lateCount = this.roster.filter(r => r.status === 'late').length;
    this.leaveCount = this.roster.filter(r => r.status === 'leave').length;
    this.presentRate = this.totalEnrolled > 0 ? Math.round((this.presentCount / this.totalEnrolled) * 100) : 0;
  }

  async copyPreviousTarget(): Promise<void> {
    if (!this.canManageAttendance || !this.currentUser) return;
    try {
      this.loader.show();
      const firestore = getDeenDeskFirestore();

      // Calculate Yesterday's date string
      const yesterday = new Date(this.selectedDateObj);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      let updatedCount = 0;
      const prevDocPromises = this.roster.map(async item => {
        if (item.student.id) {
          const prevDocRef = doc(firestore, 'studentDailyProgress', `${item.student.id}_${yStr}`);
          try {
            const pSnap = await getDoc(prevDocRef);
            return { item, snap: pSnap };
          } catch (e) {
            return null;
          }
        }
        return null;
      });

      const prevDocResults = await Promise.all(prevDocPromises);

      for (const res of prevDocResults) {
        if (res && res.snap && res.snap.exists()) {
          const item = res.item;
          const prevData = res.snap.data();
          const prevHifz = prevData['hifzProgress'];
          const prevDawr = prevData['dawrProgress'];
          const prevMaktab = prevData['maktabProgress'];

          if (this.studentTypeMode === 'hifz' && prevHifz) {
            item.sabaqSurah = prevHifz.sabaqSurahName || item.sabaqSurah;
            item.sabaqFromAyah = (prevHifz.sabaqToAyah || 0) + 1;
            item.sabqiJuz = prevHifz.sabqiJuzNo || item.sabqiJuz;
            item.manzilJuz = prevHifz.manzilJuzNo || item.manzilJuz;
            updatedCount++;
          } else if (this.studentTypeMode === 'dawr' && prevDawr) {
            item.dawrRoundNo = prevDawr.roundNo || item.dawrRoundNo;
            item.dawrPortionJuz = prevDawr.portionJuz || item.dawrPortionJuz;
            updatedCount++;
          } else if (this.studentTypeMode === 'maktab' && prevMaktab) {
            item.maktabSubject = prevMaktab.subjectName || item.maktabSubject;
            item.maktabPage = (prevMaktab.pageNo || 0) + 1;
            updatedCount++;
          }
        }
      }

      this.snackBar.open(`Auto-filled previous progress targets for ${updatedCount} students`, 'OK', { duration: 3000 });
    } catch (err) {
      console.error('Error copying previous targets:', err);
    } finally {
      this.loader.hide();
    }
  }

  async saveAttendanceOnly(): Promise<void> {
    if (!this.canManageAttendance || !this.currentUser || !this.selectedGroupId) return;
    if (this.isSavingAttendance || this.isSavingAll) return;

    try {
      this.isSavingAttendance = true;
      this.loader.show();
      await this.executeSaveAttendance();
      this.snackBar.open('Attendance register saved successfully!', 'Dismiss', { duration: 3500 });
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      this.snackBar.open(`Failed to save attendance: ${err?.message || 'Permissions issue'}`, 'Close', { duration: 5000 });
    } finally {
      this.isSavingAttendance = false;
      this.loader.hide();
    }
  }

  async saveProgressOnly(): Promise<void> {
    if (!this.canManageAttendance || !this.currentUser || !this.selectedGroupId) return;
    if (this.isSavingProgress || this.isSavingAll) return;

    const rosterBackup = JSON.parse(JSON.stringify(this.roster));
    const savedDocRefs: string[] = this.roster
      .filter(i => !!i.student.id)
      .map(i => `studentDailyProgress/${i.student.id}_${this.selectedDateStr}`);

    try {
      this.isSavingProgress = true;
      this.loader.show();
      await this.executeSaveProgress();
      this.isEvaluationRecorded = true;
      const now = new Date();
      this.evaluatedAtText = `on ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      this.evaluationRecordedCount = this.getEvaluatedCount();

      this.lastProgressSaveSnapshot = {
        type: 'daily',
        dateOrWeek: this.selectedDateStr,
        savedDocRefs,
        rosterBackup
      };
      this.canUndoProgress = true;

      const snack = this.snackBar.open('Daily Progress evaluations saved successfully!', 'UNDO', { duration: 9000 });
      snack.onAction().subscribe(() => {
        this.undoLastProgressSave();
      });
    } catch (err: any) {
      console.error('Error saving daily progress:', err);
      this.snackBar.open(`Failed to save daily progress: ${err?.message || 'Permissions issue'}`, 'Close', { duration: 5000 });
    } finally {
      this.isSavingProgress = false;
      this.loader.hide();
    }
  }

  async saveSuiteData(): Promise<void> {
    if (!this.canManageAttendance || !this.currentUser || !this.selectedGroupId) return;
    if (this.isSavingAll || this.isSavingAttendance || this.isSavingProgress) return;

    try {
      this.isSavingAll = true;
      this.loader.show();
      const hasAnyEvaluated = this.roster.some(r => this.getStudentProgressStatus(r).isEvaluated);
      const tasks: Promise<any>[] = [this.executeSaveAttendance()];
      if (hasAnyEvaluated) {
        tasks.push(this.executeSaveProgress());
      }
      await Promise.all(tasks);
      this.snackBar.open(hasAnyEvaluated ? 'All data (Attendance & Daily Progress) saved successfully!' : 'Attendance saved successfully!', 'Dismiss', { duration: 3500 });
    } catch (err: any) {
      console.error('Error saving attendance and progress:', err);
      this.snackBar.open(`Failed to save classroom suite data: ${err?.message || 'Permissions issue'}`, 'Close', { duration: 5000 });
    } finally {
      this.isSavingAll = false;
      this.loader.hide();
    }
  }

  private async executeSaveAttendance(): Promise<void> {
    const firestore = getDeenDeskFirestore();
    const docId = `${this.selectedMadrasaId || 'default'}_${this.selectedGroupId}_${this.selectedDateStr}_${this.selectedPeriodId}`;
    const attendanceDocRef = doc(firestore, 'attendance', docId);

    // Build attendance record map
    const recordsMap: Record<string, { status: AttendanceStatus; note?: string }> = {};
    this.roster.forEach(r => {
      if (r.student.id) {
        recordsMap[r.student.id] = {
          status: r.status,
          note: r.note || ''
        };
      }
    });

    const attendancePayload = {
      id: docId,
      organizationId: this.currentUser?.organizationId || '',
      madrasaId: this.selectedMadrasaId,
      classId: this.selectedClassId,
      groupId: this.selectedGroupId,
      date: this.selectedDateStr,
      attendanceMode: this.attendanceMode,
      timetableEntryId: this.selectedPeriodId,
      periodTitle: this.selectedPeriodTitle,
      takenByUid: this.currentUser?.uid || '',
      takenByName: this.currentUser?.displayName || this.currentUser?.email || '',
      takenAt: Timestamp.now(),
      records: recordsMap,
      summary: {
        total: this.totalEnrolled,
        present: this.presentCount,
        absent: this.absentCount,
        late: this.lateCount,
        leave: this.leaveCount,
      }
    };

    await setDoc(attendanceDocRef, attendancePayload, { merge: true });

    // Invalidate specific Repository Cache (Rule 5 compliance)
    this.repo.clearCache('attendance');

    this.isAttendanceRecorded = true;
    this.recordedByName = this.currentUser?.displayName || this.currentUser?.email || '';
    this.recordedAtText = 'Just Now';
  }

  private async executeSaveProgress(): Promise<void> {
    const firestore = getDeenDeskFirestore();
    const setDocPromises = this.roster.map(async item => {
      if (item.student.id) {
        const pDocRef = doc(firestore, 'studentDailyProgress', `${item.student.id}_${this.selectedDateStr}`);
        const evalStatus = this.getStudentProgressStatus(item);
        const progressPayload = {
          id: `${item.student.id}_${this.selectedDateStr}`,
          studentId: item.student.id,
          organizationId: this.currentUser?.organizationId || '',
          madrasaId: this.selectedMadrasaId,
          classId: this.selectedClassId,
          groupId: this.selectedGroupId,
          date: this.selectedDateStr,
          studentType: this.studentTypeMode,
          isEvaluated: evalStatus.isEvaluated,
          evaluationStatus: evalStatus.isEvaluated ? 'completed' : 'pending',
          recordedByUid: this.currentUser?.uid || '',
          recordedByName: this.currentUser?.displayName || this.currentUser?.email || '',
          recordedAt: Timestamp.now(),
          targetGoals: {
            period: item.targetPeriod || 'weekly',
            startDate: item.targetStartDate || '',
            endDate: item.targetEndDate || '',
            sabaqSurah: item.targetSabaqSurah || '',
            sabaqFromAyah: item.targetSabaqFromAyah || null,
            sabaqToAyah: item.targetSabaqToAyah || null,
            sabqiJuzRange: item.targetSabqiJuzRange || '',
            manzilJuzRange: item.targetManzilJuzRange || '',
            maktabSubject: item.targetMaktabSubject || '',
            maktabPage: item.targetMaktabPage || null,
            maktabLineNo: item.targetMaktabLineNo || null,
            dawrRounds: item.targetDawrRounds || 3,
            dawrDailyJuz: item.targetDawrDailyJuz || '',
            incompleteReason: item.targetIncompleteReason || '',
            incompleteNotes: item.targetIncompleteNotes || '',
          },
          hifzProgress: this.studentTypeMode === 'hifz' ? {
            sabaqSurahName: item.sabaqSurah || '',
            sabaqFromAyah: item.sabaqFromAyah || null,
            sabaqToAyah: item.sabaqToAyah || null,
            sabaqMistakes: item.sabaqMistakes || 0,
            sabaqJuzPortion: item.sabaqJuzPortion || 'Full Juz',
            sabqiSurahName: item.sabqiSurah || '',
            sabqiFromAyah: item.sabqiFromAyah || null,
            sabqiToAyah: item.sabqiToAyah || null,
            sabqiJuzNo: item.sabqiJuz || null,
            sabqiJuzPortion: item.sabqiJuzPortion || 'Full Juz',
            sabqiMistakes: item.sabqiMistakes || 0,
            manzilSurahName: item.manzilSurah || '',
            manzilFromAyah: item.manzilFromAyah || null,
            manzilToAyah: item.manzilToAyah || null,
            manzilJuzNo: item.manzilJuz || null,
            manzilJuzPortion: item.manzilJuzPortion || 'Full Juz',
            manzilMistakes: item.manzilMistakes || 0,
            rating: item.hifzRating || 5,
            evalUnitMode: this.hifzEvalMode
          } : null,
          dawrProgress: this.studentTypeMode === 'dawr' ? {
            roundNo: item.dawrRoundNo || 1,
            portionJuz: item.dawrPortionJuz || 'Juz 1',
            fromAyah: item.dawrFromAyah || null,
            toAyah: item.dawrToAyah || null,
            dawrMistakes: item.dawrMistakes || 0,
            manzilMistakes: item.dawrManzilMistakes || 0,
            rating: item.dawrRating || 5,
          } : null,
          maktabProgress: this.studentTypeMode === 'maktab' ? {
            stage: item.maktabStageMode === 'tilawatul_quran' ? 'Tilawatul Quran' : 'Miftah',
            subjectName: item.maktabSubject || '',
            pageNo: item.maktabPage || null,
            lineNo: item.maktabLineNo || null,
            mistakesCount: item.maktabMistakes || 0,
            remarks: item.maktabRemarks || '',
            quranReading: item.quranReading || null
          } : null,
          maktabStageMode: this.studentTypeMode === 'maktab' ? (item.maktabStageMode || 'miftah') : null,
          quranReading: this.studentTypeMode === 'maktab' && item.maktabStageMode === 'tilawatul_quran' ? (item.quranReading || null) : null
        };

        return setDoc(pDocRef, progressPayload, { merge: true });
      }
      return Promise.resolve();
    });

    await Promise.all(setDocPromises);

    // Invalidate specific Repository Cache (Rule 5 compliance)
    this.repo.clearCache('studentDailyProgress');
  }

  private calculateReportMetrics(): void {
    this.reportStudentSummaries = this.roster.map(r => ({
      studentName: r.student['fullName'] || r.student['name'] || 'Student',
      presentPct: r.status === 'present' ? 100 : 0,
      presentDays: r.status === 'present' ? 1 : 0,
      totalDays: 1,
      hifzAvgSabaq: this.studentTypeMode === 'dawr'
        ? `Dawr Round ${r.dawrRoundNo || 1} of ${r.targetDawrRounds || 3} (${r.dawrPortionJuz || 'Juz 1'})`
        : (this.studentTypeMode === 'hifz'
          ? (r.sabaqSurah ? `${r.sabaqSurah} (${r.sabaqFromAyah || 1}-${r.sabaqToAyah || 1})` : 'No Entry')
          : (r.maktabPage ? `Page ${r.maktabPage}, Line ${r.maktabLineNo || 1}` : 'No Entry'))
    }));
  }

  getTodayDateString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getSurahMaxAyah(surahInput: string | null | undefined): number {
    if (!surahInput) return 286;
    const count = getSurahAyahCount(surahInput);
    return count || 286;
  }

  onSabaqSurahChange(item: StudentSuiteRosterItem): void {
    if (!item.sabaqSurah) return;
    const maxAyah = this.getSurahMaxAyah(item.sabaqSurah);
    if (!item.sabaqFromAyah) item.sabaqFromAyah = 1;
    if (!item.sabaqToAyah || item.sabaqToAyah > maxAyah) {
      item.sabaqToAyah = maxAyah;
    }
  }

  validateAyahBounds(item: StudentSuiteRosterItem): void {
    if (!item.sabaqSurah) return;
    const maxAyah = this.getSurahMaxAyah(item.sabaqSurah);
    if (item.sabaqToAyah && item.sabaqToAyah > maxAyah) {
      item.sabaqToAyah = maxAyah;
      this.snackBar.open(`Maximum Ayah for ${item.sabaqSurah} is ${maxAyah}`, 'Dismiss', { duration: 3000 });
    }
  }

  // ==========================================
  // WEEKLY BATCH EVALUATION METHODS (OPTION 1)
  // ==========================================
  initWeekState(refDate: Date = new Date()): void {
    const d = new Date(refDate);
    const day = d.getDay();
    // Monday is start of madrasa week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    this.selectedWeekYear = monday.getFullYear();
    this.selectedWeekNumber = this.getISOWeekNumber(monday);
    this.selectedWeekStartStr = this.formatDateStr(monday);
    this.selectedWeekEndStr = this.formatDateStr(saturday);

    const startText = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endText = saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    this.selectedWeekDisplayText = `Week ${this.selectedWeekNumber}: ${startText} – ${endText}`;
  }

  formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getISOWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  prevWeek(): void {
    const d = new Date(this.selectedWeekStartStr);
    d.setDate(d.getDate() - 7);
    this.initWeekState(d);
    this.selectedDateObj = new Date(d);
    this.selectedDateStr = this.formatDateStr(d);
    this.loadWeeklyProgressData();
  }

  nextWeek(): void {
    const d = new Date(this.selectedWeekStartStr);
    d.setDate(d.getDate() + 7);
    this.initWeekState(d);
    this.selectedDateObj = new Date(d);
    this.selectedDateStr = this.formatDateStr(d);
    this.loadWeeklyProgressData();
  }

  goToCurrentWeek(): void {
    const now = new Date();
    this.initWeekState(now);
    this.selectedDateObj = now;
    this.selectedDateStr = this.formatDateStr(now);
    this.loadWeeklyProgressData();
  }

  setEvalCadence(cadence: 'daily' | 'weekly'): void {
    this.evalCadence = cadence;
    if (cadence === 'weekly') {
      if (!this.selectedWeekStartStr) {
        this.initWeekState(new Date());
      }
      this.loadWeeklyProgressData();
    }
  }

  async loadWeeklyProgressData(): Promise<void> {
    if (!this.currentUser || !this.selectedGroupId || this.roster.length === 0) return;
    try {
      const firestore = getDeenDeskFirestore();
      const promises = this.roster.map(async item => {
        if (!item.student.id) return;
        const weeklyDocId = `${item.student.id}_week_${this.selectedWeekYear}_${this.selectedWeekNumber}`;
        const weeklyDocRef = doc(firestore, 'studentWeeklyProgress', weeklyDocId);
        try {
          const snap = await getDoc(weeklyDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const h = data['hifz'] || {};
            const d = data['dawr'] || {};
            const m = data['maktab'] || {};

            if (h.evalUnitMode) {
              this.weeklyEvalUnitMode = h.evalUnitMode;
            }
            item.weeklySabaqStartSurah = h.sabaqStartSurah || '';
            item.weeklySabaqStartAyah = h.sabaqStartAyah !== undefined ? h.sabaqStartAyah : null;
            item.weeklySabaqEndSurah = h.sabaqEndSurah || '';
            item.weeklySabaqEndAyah = h.sabaqEndAyah !== undefined ? h.sabaqEndAyah : null;
            item.weeklySabaqStartJuz = h.sabaqStartJuz !== undefined ? h.sabaqStartJuz : null;
            item.weeklySabaqStartPortion = h.sabaqStartPortion || 'Full Juz';
            item.weeklySabaqEndJuz = h.sabaqEndJuz !== undefined ? h.sabaqEndJuz : null;
            item.weeklySabaqEndPortion = h.sabaqEndPortion || 'Full Juz';
            item.weeklySabaqStartPage = h.sabaqStartPage !== undefined ? h.sabaqStartPage : null;
            item.weeklySabaqEndPage = h.sabaqEndPage !== undefined ? h.sabaqEndPage : null;

            item.weeklySabqiStartSurah = h.sabqiStartSurah || '';
            item.weeklySabqiStartAyah = h.sabqiStartAyah !== undefined ? h.sabqiStartAyah : null;
            item.weeklySabqiEndSurah = h.sabqiEndSurah || '';
            item.weeklySabqiEndAyah = h.sabqiEndAyah !== undefined ? h.sabqiEndAyah : null;
            item.weeklySabqiStartJuz = h.sabqiStartJuz !== undefined ? h.sabqiStartJuz : null;
            item.weeklySabqiStartPortion = h.sabqiStartPortion || 'Full Juz';
            item.weeklySabqiEndJuz = h.sabqiEndJuz !== undefined ? h.sabqiEndJuz : null;
            item.weeklySabqiEndPortion = h.sabqiEndPortion || 'Full Juz';
            item.weeklySabqiStartPage = h.sabqiStartPage !== undefined ? h.sabqiStartPage : null;
            item.weeklySabqiEndPage = h.sabqiEndPage !== undefined ? h.sabqiEndPage : null;
            item.weeklySabqiRange = h.sabqiRange || '';

            item.weeklyManzilStartSurah = h.manzilStartSurah || '';
            item.weeklyManzilStartAyah = h.manzilStartAyah !== undefined ? h.manzilStartAyah : null;
            item.weeklyManzilEndSurah = h.manzilEndSurah || '';
            item.weeklyManzilEndAyah = h.manzilEndAyah !== undefined ? h.manzilEndAyah : null;
            item.weeklyManzilStartJuz = h.manzilStartJuz !== undefined ? h.manzilStartJuz : null;
            item.weeklyManzilStartPortion = h.manzilStartPortion || 'Full Juz';
            item.weeklyManzilEndJuz = h.manzilEndJuz !== undefined ? h.manzilEndJuz : null;
            item.weeklyManzilEndPortion = h.manzilEndPortion || 'Full Juz';
            item.weeklyManzilRange = h.manzilRange || '';

            item.weeklyMistakes = h.weeklyMistakes !== undefined ? h.weeklyMistakes : null;
            item.weeklyRating = h.rating || 5;
            item.weeklyNotes = h.notes || '';

            item.weeklyDawrRounds = (d && d.roundNo !== undefined) ? d.roundNo : (d && d.weeklyJuzCount ? 1 : null);
            item.weeklyDawrJuzCount = d.weeklyJuzCount !== undefined ? d.weeklyJuzCount : null;

            item.weeklyMaktabSubject = m.subject || '';
            item.weeklyMaktabStartPage = m.startPage !== undefined ? m.startPage : null;
            item.weeklyMaktabEndPage = m.endPage !== undefined ? m.endPage : null;
          } else {
            // Fallback: If no weekly doc, check if daily progress was loaded for this student during the session
            if (item.sabaqSurah || item.sabaqJuz || item.dawrPortionJuz || item.dawrRoundNo || item.maktabSubject || item.tilawatSurah) {
              item.weeklySabaqEndSurah = item.sabaqSurah || '';
              item.weeklySabaqStartAyah = item.sabaqFromAyah;
              item.weeklySabaqEndAyah = item.sabaqToAyah;
              item.weeklySabaqStartJuz = item.sabaqJuz;
              item.weeklySabaqEndJuz = item.sabaqJuz;
              item.weeklySabqiRange = item.sabqiSurah || (item.sabqiJuz ? `Juz ${item.sabqiJuz}` : '');
              item.weeklyManzilRange = item.manzilSurah || (item.manzilJuz ? `Juz ${item.manzilJuz}` : '');
              item.weeklyMistakes = item.sabaqMistakes || 0;
              item.weeklyRating = item.hifzRating || 5;
              item.weeklyDawrRounds = item.dawrRoundNo || (item.dawrPortionJuz ? 1 : null);
              item.weeklyDawrJuzCount = item.dawrPortionJuz ? 1 : null;
              item.weeklyMaktabSubject = item.maktabSubject || '';
              item.weeklyMaktabStartPage = item.maktabPage || null;
              item.weeklyMaktabEndPage = item.maktabPage || null;
            } else {
              item.weeklySabaqStartSurah = '';
              item.weeklySabaqStartAyah = null;
              item.weeklySabaqEndSurah = '';
              item.weeklySabaqEndAyah = null;
              item.weeklySabaqStartJuz = null;
              item.weeklySabaqStartPortion = 'Full Juz';
              item.weeklySabaqEndJuz = null;
              item.weeklySabaqEndPortion = 'Full Juz';
              item.weeklySabaqStartPage = null;
              item.weeklySabaqEndPage = null;

              item.weeklySabqiStartSurah = '';
              item.weeklySabqiStartAyah = null;
              item.weeklySabqiEndSurah = '';
              item.weeklySabqiEndAyah = null;
              item.weeklySabqiStartJuz = null;
              item.weeklySabqiStartPortion = 'Full Juz';
              item.weeklySabqiEndJuz = null;
              item.weeklySabqiEndPortion = 'Full Juz';
              item.weeklySabqiStartPage = null;
              item.weeklySabqiEndPage = null;
              item.weeklySabqiRange = '';

              item.weeklyManzilStartSurah = '';
              item.weeklyManzilStartAyah = null;
              item.weeklyManzilEndSurah = '';
              item.weeklyManzilEndAyah = null;
              item.weeklyManzilStartJuz = null;
              item.weeklyManzilStartPortion = 'Full Juz';
              item.weeklyManzilEndJuz = null;
              item.weeklyManzilEndPortion = 'Full Juz';
              item.weeklyManzilRange = '';

              item.weeklyMistakes = null;
              item.weeklyRating = 5;
              item.weeklyNotes = '';

              item.weeklyDawrRounds = null;
              item.weeklyDawrJuzCount = null;
            }

            item.weeklyMaktabSubject = '';
            item.weeklyMaktabStartPage = null;
            item.weeklyMaktabEndPage = null;
          }
        } catch (e) {
          console.error(e);
        }
      });
      await Promise.all(promises);
    } catch (e) {
      console.error('Error loading weekly progress data:', e);
    }
  }

  formatWeeklyRange(item: StudentSuiteRosterItem, type: 'sabaq' | 'sabqi' | 'manzil'): string {
    if (this.weeklyEvalUnitMode === 'surah') {
      const startSurah = type === 'sabaq' ? item.weeklySabaqStartSurah : (type === 'sabqi' ? item.weeklySabqiStartSurah : item.weeklyManzilStartSurah);
      const startAyah = type === 'sabaq' ? item.weeklySabaqStartAyah : (type === 'sabqi' ? item.weeklySabqiStartAyah : item.weeklyManzilStartAyah);
      const endSurah = type === 'sabaq' ? item.weeklySabaqEndSurah : (type === 'sabqi' ? item.weeklySabqiEndSurah : item.weeklyManzilEndSurah);
      const endAyah = type === 'sabaq' ? item.weeklySabaqEndAyah : (type === 'sabqi' ? item.weeklySabqiEndAyah : item.weeklyManzilEndAyah);

      if (!startSurah && !endSurah) return '';
      if (startSurah && !endSurah) return `${startSurah}${startAyah ? ' :' + startAyah : ''}`;
      if (startSurah === endSurah) {
        return `${startSurah}${startAyah && endAyah ? ` (${startAyah}-${endAyah})` : ''}`;
      }
      return `${startSurah}${startAyah ? ' :' + startAyah : ''} to ${endSurah}${endAyah ? ' :' + endAyah : ''}`;
    } else {
      if (type === 'sabaq') {
        const juzNum = item.weeklySabaqStartJuz;
        if (!juzNum) return '';
        const juz = this.allQuranJuzList.find(j => j.number === juzNum);
        const name = juz ? juz.displayName : `Juz ${juzNum}`;
        const p1 = item.weeklySabaqStartPage;
        const p2 = item.weeklySabaqEndPage;
        if (p1 && p2) return `${name} (Pg ${p1}-${p2})`;
        if (p1) return `${name} (Pg ${p1})`;
        return name;
      } else if (type === 'sabqi') {
        const juzNum = item.weeklySabqiStartJuz;
        if (!juzNum) return '';
        const juz = this.allQuranJuzList.find(j => j.number === juzNum);
        const name = juz ? juz.displayName : `Juz ${juzNum}`;
        const p1 = item.weeklySabqiStartPage;
        const p2 = item.weeklySabqiEndPage;
        if (p1 && p2) return `${name} (Pg ${p1}-${p2})`;
        if (p1) return `${name} (Pg ${p1})`;
        return name;
      } else {
        const startJuz = item.weeklyManzilStartJuz;
        const endJuz = item.weeklyManzilEndJuz;
        const p1 = item.weeklyManzilStartPortion;
        const p2 = item.weeklyManzilEndPortion;
        if (!startJuz && !endJuz) return '';
        if (startJuz && (!endJuz || startJuz === endJuz)) {
          return `Juz ${startJuz}${p1 ? ' - ' + p1 : ''}`;
        }
        return `Juz ${startJuz} (${p1 || 'Full'}) to Juz ${endJuz} (${p2 || 'Full'})`;
      }
    }
  }

  autoFillWeeklyFromTargets(): void {
    let count = 0;
    this.roster.forEach(item => {
      if (this.studentTypeMode === 'hifz') {
        if (this.weeklyEvalUnitMode === 'surah') {
          if (item.targetSabaqSurah) {
            item.weeklySabaqStartSurah = item.targetSabaqSurah;
            item.weeklySabaqStartAyah = item.targetSabaqFromAyah || 1;
            item.weeklySabaqEndSurah = item.targetSabaqSurah;
            item.weeklySabaqEndAyah = item.targetSabaqToAyah || null;
            count++;
          }
        } else {
          // Juz mode
          if (item.targetSabaqJuz) {
            item.weeklySabaqStartJuz = item.targetSabaqJuz;
            item.weeklySabaqStartPortion = 'Full Juz';
            item.weeklySabaqEndJuz = item.targetSabaqJuz;
            item.weeklySabaqEndPortion = 'Full Juz';
            item.weeklySabaqStartPage = 1;
            item.weeklySabaqEndPage = 5;
            count++;
          }
        }
        if (item.targetSabqiJuzRange) item.weeklySabqiRange = item.targetSabqiJuzRange;
        if (item.targetManzilJuzRange) item.weeklyManzilRange = item.targetManzilJuzRange;
      } else if (this.studentTypeMode === 'dawr') {
        if (item.targetDawrRounds) item.weeklyDawrRounds = item.targetDawrRounds;
        item.weeklyDawrJuzCount = 5;
        count++;
      } else if (this.studentTypeMode === 'maktab') {
        if (item.targetMaktabSubject) item.weeklyMaktabSubject = item.targetMaktabSubject;
        if (item.targetMaktabPage) {
          item.weeklyMaktabStartPage = 1;
          item.weeklyMaktabEndPage = item.targetMaktabPage;
          count++;
        }
      }
      item.weeklyRating = 5;
    });
    this.snackBar.open(`Auto-filled weekly progress from targets for ${count} students!`, 'OK', { duration: 3000 });
  }

  bulkSetWeeklyRating(rating: number): void {
    this.roster.forEach(item => item.weeklyRating = rating);
    this.snackBar.open(`Applied ${rating}-Star weekly rating to all students`, 'OK', { duration: 2500 });
  }

  async saveWeeklyProgress(): Promise<void> {
    if (!this.canManageAttendance || !this.currentUser || !this.selectedGroupId) return;
    if (this.isSavingWeeklyProgress) return;

    const rosterBackup = JSON.parse(JSON.stringify(this.roster));
    const savedDocRefs: string[] = [];
    this.roster.forEach(i => {
      if (i.student.id) {
        savedDocRefs.push(`studentWeeklyProgress/${i.student.id}_week_${this.selectedWeekYear}_${this.selectedWeekNumber}`);
        savedDocRefs.push(`studentDailyProgress/${i.student.id}_${this.selectedWeekEndStr}`);
      }
    });

    try {
      this.isSavingWeeklyProgress = true;
      this.loader.show();
      const firestore = getDeenDeskFirestore();

      const savePromises = this.roster.map(async item => {
        if (!item.student.id) return;
        const weeklyDocId = `${item.student.id}_week_${this.selectedWeekYear}_${this.selectedWeekNumber}`;
        const weeklyDocRef = doc(firestore, 'studentWeeklyProgress', weeklyDocId);

        const payload: any = {
          id: weeklyDocId,
          studentId: item.student.id,
          organizationId: this.currentUser?.organizationId || '',
          madrasaId: this.selectedMadrasaId,
          classId: this.selectedClassId,
          groupId: this.selectedGroupId,
          year: this.selectedWeekYear,
          weekNumber: this.selectedWeekNumber,
          weekStartDate: this.selectedWeekStartStr,
          weekEndDate: this.selectedWeekEndStr,
          studentType: this.studentTypeMode,
          recordedByUid: this.currentUser?.uid || '',
          recordedByName: this.currentUser?.displayName || this.currentUser?.email || '',
          recordedAt: Timestamp.now(),
          hifz: this.studentTypeMode === 'hifz' ? {
            evalUnitMode: this.weeklyEvalUnitMode,
            sabaqStartSurah: item.weeklySabaqStartSurah || '',
            sabaqStartAyah: item.weeklySabaqStartAyah || null,
            sabaqEndSurah: item.weeklySabaqEndSurah || '',
            sabaqEndAyah: item.weeklySabaqEndAyah || null,
            sabaqStartJuz: item.weeklySabaqStartJuz || null,
            sabaqStartPortion: item.weeklySabaqStartPortion || 'Full Juz',
            sabaqEndJuz: item.weeklySabaqEndJuz || null,
            sabaqEndPortion: item.weeklySabaqEndPortion || 'Full Juz',
            sabaqStartPage: item.weeklySabaqStartPage || null,
            sabaqEndPage: item.weeklySabaqEndPage || null,
            sabqiStartSurah: item.weeklySabqiStartSurah || '',
            sabqiStartAyah: item.weeklySabqiStartAyah || null,
            sabqiEndSurah: item.weeklySabqiEndSurah || '',
            sabqiEndAyah: item.weeklySabqiEndAyah || null,
            sabqiStartJuz: item.weeklySabqiStartJuz || null,
            sabqiStartPortion: item.weeklySabqiStartPortion || 'Full Juz',
            sabqiEndJuz: item.weeklySabqiEndJuz || null,
            sabqiEndPortion: item.weeklySabqiEndPortion || 'Full Juz',
            sabqiStartPage: item.weeklySabqiStartPage || null,
            sabqiEndPage: item.weeklySabqiEndPage || null,
            sabqiRange: item.weeklySabqiRange || this.formatWeeklyRange(item, 'sabqi'),
            manzilStartSurah: item.weeklyManzilStartSurah || '',
            manzilStartAyah: item.weeklyManzilStartAyah || null,
            manzilEndSurah: item.weeklyManzilEndSurah || '',
            manzilEndAyah: item.weeklyManzilEndAyah || null,
            manzilStartJuz: item.weeklyManzilStartJuz || null,
            manzilStartPortion: item.weeklyManzilStartPortion || 'Full Juz',
            manzilEndJuz: item.weeklyManzilEndJuz || null,
            manzilEndPortion: item.weeklyManzilEndPortion || 'Full Juz',
            manzilRange: item.weeklyManzilRange || this.formatWeeklyRange(item, 'manzil'),
            weeklyMistakes: item.weeklyMistakes || 0,
            rating: item.weeklyRating || 5,
            notes: item.weeklyNotes || ''
          } : null,
          dawr: this.studentTypeMode === 'dawr' ? {
            roundNo: item.weeklyDawrRounds || item.dawrRoundNo || 1,
            weeklyJuzCount: item.weeklyDawrJuzCount || 5,
            portionJuz: item.dawrPortionJuz || '',
            rating: item.weeklyRating || 5,
            notes: item.weeklyNotes || ''
          } : null,
          maktab: this.studentTypeMode === 'maktab' ? {
            subject: item.weeklyMaktabSubject || item.maktabSubject || '',
            startPage: item.weeklyMaktabStartPage || 1,
            endPage: item.weeklyMaktabEndPage || item.maktabPage || null,
            rating: item.weeklyRating || 5,
            notes: item.weeklyNotes || ''
          } : null
        };

        await setDoc(weeklyDocRef, payload, { merge: true });

        // Also mirror into studentDailyProgress for week-end date so existing reports remain seamless
        const dailyDocRef = doc(firestore, 'studentDailyProgress', `${item.student.id}_${this.selectedWeekEndStr}`);
        const dailyMirror = {
          id: `${item.student.id}_${this.selectedWeekEndStr}`,
          studentId: item.student.id,
          organizationId: this.currentUser?.organizationId || '',
          madrasaId: this.selectedMadrasaId,
          classId: this.selectedClassId,
          groupId: this.selectedGroupId,
          date: this.selectedWeekEndStr,
          studentType: this.studentTypeMode,
          recordedByUid: this.currentUser?.uid || '',
          recordedByName: this.currentUser?.displayName || this.currentUser?.email || '',
          recordedAt: Timestamp.now(),
          isWeeklyMilestone: true,
          hifzProgress: this.studentTypeMode === 'hifz' ? {
            evalUnitMode: this.weeklyEvalUnitMode,
            sabaqSurahName: this.weeklyEvalUnitMode === 'surah' ? (item.weeklySabaqEndSurah || '') : (item.weeklySabaqStartJuz ? `Juz ${item.weeklySabaqStartJuz}` : ''),
            sabaqFromAyah: this.weeklyEvalUnitMode === 'surah' ? (item.weeklySabaqStartAyah || null) : (item.weeklySabaqStartPage || null),
            sabaqToAyah: this.weeklyEvalUnitMode === 'surah' ? (item.weeklySabaqEndAyah || null) : (item.weeklySabaqEndPage || null),
            sabaqJuzNo: this.weeklyEvalUnitMode === 'juz' ? (item.weeklySabaqStartJuz || item.weeklySabaqEndJuz || null) : null,
            sabaqJuzPortion: this.weeklyEvalUnitMode === 'juz' ? (item.weeklySabaqStartPage ? `Pg ${item.weeklySabaqStartPage}-${item.weeklySabaqEndPage || item.weeklySabaqStartPage}` : 'Full Juz') : 'Full Juz',
            sabaqMistakes: item.weeklyMistakes || 0,
            sabqiSurahName: item.weeklySabqiRange || this.formatWeeklyRange(item, 'sabqi'),
            manzilSurahName: item.weeklyManzilRange || this.formatWeeklyRange(item, 'manzil'),
            rating: item.weeklyRating || 5
          } : null,
          dawrProgress: this.studentTypeMode === 'dawr' ? {
            roundNo: item.weeklyDawrRounds || 1,
            portionJuz: `${item.weeklyDawrJuzCount || 5} Juzs this week`,
            rating: item.weeklyRating || 5
          } : null,
          maktabProgress: this.studentTypeMode === 'maktab' ? {
            subjectName: item.weeklyMaktabSubject || item.maktabSubject || '',
            pageNo: item.weeklyMaktabEndPage || null,
            mistakesCount: item.weeklyMistakes || 0
          } : null
        };
        await setDoc(dailyDocRef, dailyMirror, { merge: true });

        // Also auto-update student baseline progress in users collection
        try {
          const currentProg = item.student['progress'] || {};
          const hifz = currentProg.hifz || { completedJuzs: [], inProgressJuzs: [], completedSurahs: [], inProgressSurahs: [] };
          const dawr = currentProg.dawr || { completedRounds: 0, currentRoundJuz: null };
          const maktab = currentProg.maktab || { miftahCompletedPages: [], miftahCurrentPage: 1, tilawatCompletedSurahs: [] };

          const compJuz = new Set<number>(Array.isArray(hifz.completedJuzs) ? hifz.completedJuzs : []);
          const inProgJuz = new Set<number>(Array.isArray(hifz.inProgressJuzs) ? hifz.inProgressJuzs : []);
          const compSurahs = new Set<string>(Array.isArray(hifz.completedSurahs) ? hifz.completedSurahs : []);
          const inProgSurahs = new Set<string>(Array.isArray(hifz.inProgressSurahs) ? hifz.inProgressSurahs : []);
          const compPages = new Set<number>(Array.isArray(maktab.miftahCompletedPages) ? maktab.miftahCompletedPages : []);
          const compTilawat = new Set<string>(Array.isArray(maktab.tilawatCompletedSurahs) ? maktab.tilawatCompletedSurahs : []);

          if (this.studentTypeMode === 'hifz') {
            const sSurah = item.weeklySabaqEndSurah || item.weeklySabaqStartSurah;
            if (sSurah) {
              if ((item.weeklyRating || 5) >= 4 && (item.weeklyMistakes || 0) <= 1) {
                compSurahs.add(sSurah);
                inProgSurahs.delete(sSurah);
              } else {
                inProgSurahs.add(sSurah);
              }
            }
            const sJuz = item.weeklySabaqEndJuz || item.weeklySabaqStartJuz;
            if (sJuz && sJuz >= 1 && sJuz <= 30) {
              inProgJuz.add(sJuz);
              for (let j = 1; j < sJuz; j++) {
                if (!inProgJuz.has(j)) compJuz.add(j);
              }
            }
          } else if (this.studentTypeMode === 'dawr') {
            if (item.weeklyDawrRounds || item.dawrRoundNo) {
              dawr.completedRounds = Math.max(dawr.completedRounds || 0, (item.weeklyDawrRounds || item.dawrRoundNo || 1) - 1);
            }
          } else if (this.studentTypeMode === 'maktab') {
            if (item.weeklyMaktabEndPage) {
              maktab.miftahCurrentPage = item.weeklyMaktabEndPage;
              for (let p = 1; p < item.weeklyMaktabEndPage; p++) {
                compPages.add(p);
              }
              if ((item.weeklyRating || 5) >= 4 && (item.weeklyMistakes || 0) <= 1) {
                compPages.add(item.weeklyMaktabEndPage);
              }
            }
          }

          const updatedProgress = {
            hifz: {
              completedJuzs: Array.from(compJuz).sort((a, b) => a - b),
              inProgressJuzs: Array.from(inProgJuz).sort((a, b) => a - b),
              completedSurahs: Array.from(compSurahs),
              inProgressSurahs: Array.from(inProgSurahs)
            },
            dawr: {
              completedRounds: dawr.completedRounds || 0,
              currentRoundJuz: dawr.currentRoundJuz || null
            },
            maktab: {
              miftahCompletedPages: Array.from(compPages).sort((a, b) => a - b),
              miftahCurrentPage: maktab.miftahCurrentPage || 1,
              tilawatCompletedSurahs: Array.from(compTilawat)
            },
            lastUpdated: new Date().toISOString()
          };

          const userDocRef = doc(firestore, 'users', item.student.id);
          await setDoc(userDocRef, { progress: updatedProgress }, { merge: true });
          item.student['progress'] = updatedProgress;
        } catch (autoErr) {
          console.warn('Auto-update baseline progress in weekly batch:', autoErr);
        }
      });

      await Promise.all(savePromises);

      this.lastProgressSaveSnapshot = {
        type: 'weekly',
        dateOrWeek: `${this.selectedWeekYear}_${this.selectedWeekNumber}`,
        savedDocRefs,
        rosterBackup
      };
      this.canUndoProgress = true;

      const snack = this.snackBar.open(`Weekly Batch Progress for ${this.roster.length} students saved successfully!`, 'UNDO', { duration: 9000 });
      snack.onAction().subscribe(() => {
        this.undoLastProgressSave();
      });
    } catch (err: any) {
      console.error('Error saving weekly progress:', err);
      this.snackBar.open(`Failed to save weekly progress: ${err?.message || 'Error'}`, 'Close', { duration: 5000 });
    } finally {
      this.isSavingWeeklyProgress = false;
      this.loader.hide();
    }
  }

  // Undo Progress Save (Reverts saved Firestore documents and restores roster)
  async undoLastProgressSave(): Promise<void> {
    if (!this.lastProgressSaveSnapshot) return;

    try {
      this.loader.show();
      const firestore = getDeenDeskFirestore();
      const { savedDocRefs, rosterBackup, type } = this.lastProgressSaveSnapshot;

      // 1. Delete written documents
      for (const path of savedDocRefs) {
        const [coll, id] = path.split('/');
        if (coll && id) {
          try {
            await deleteDoc(doc(firestore, coll, id));
          } catch (e) {
            console.warn(`Could not delete doc ${path}:`, e);
          }
        }
      }

      // 2. Restore roster items from backup
      if (Array.isArray(rosterBackup)) {
        for (const backup of rosterBackup) {
          const target = this.roster.find(r => r.student.id === backup.student?.id);
          if (target) {
            Object.assign(target, backup);
          }
        }
      }

      this.repo.clearCache('studentDailyProgress');
      this.repo.clearCache('studentWeeklyProgress');

      this.lastProgressSaveSnapshot = null;
      this.canUndoProgress = false;
      this.snackBar.open(`Progress save (${type}) was undone successfully.`, 'OK', { duration: 4000 });
    } catch (err: any) {
      console.error('Error undoing progress:', err);
      this.snackBar.open(`Undo failed: ${err?.message || 'Error'}`, 'Close', { duration: 4000 });
    } finally {
      this.loader.hide();
    }
  }

  // Admin: Reset all student progress for this group (Initial Fresh Baseline Setup)
  async resetAllStudentProgress(): Promise<void> {
    if (!this.isSuperAdmin && !this.isOrgAdmin) {
      this.snackBar.open('Only Organization Admin and Super Admin can reset student progress.', 'Dismiss', { duration: 3000 });
      return;
    }

    if (!this.selectedGroupId) {
      this.snackBar.open('Please select a class group first.', 'Dismiss', { duration: 3000 });
      return;
    }

    const confirmed = confirm(
      '⚠️ RESET ALL STUDENT PROGRESS\n\n' +
      'Are you sure you want to remove all existing progress records for all students in this group?\n\n' +
      'This will clear previously recorded progress logs so staff can enter each student’s current baseline progress fresh for Hifz, Dawr, or Maktab.\n\n' +
      'Attendance records will NOT be deleted.\n\n' +
      'Click OK to proceed with the reset.'
    );

    if (!confirmed) return;

    try {
      this.loader.show();
      const firestore = getDeenDeskFirestore();

      // 1. Query and delete studentDailyProgress for this group
      const dailyQ = query(
        collection(firestore, 'studentDailyProgress'),
        where('groupId', '==', this.selectedGroupId)
      );
      const dailySnap = await getDocs(dailyQ);
      const deleteDailyPromises = dailySnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteDailyPromises);

      // 2. Query and delete studentWeeklyProgress for this group
      const weeklyQ = query(
        collection(firestore, 'studentWeeklyProgress'),
        where('groupId', '==', this.selectedGroupId)
      );
      const weeklySnap = await getDocs(weeklyQ);
      const deleteWeeklyPromises = weeklySnap.docs.map(w => deleteDoc(w.ref));
      await Promise.all(deleteWeeklyPromises);

      // 3. Clear local roster item fields so the UI displays completely blank baseline inputs
      for (const item of this.roster) {
        item.maktabSubjectsList = [];
        item.weeklyMaktabSubject = '';
        item.weeklyMaktabStartPage = null;
        item.weeklyMaktabEndPage = null;
        item.maktabSubject = '';
        item.maktabPage = null;
        item.maktabLineNo = null;
        item.maktabMistakes = 0;
        item.maktabRemarks = '';

        item.weeklySabaqStartSurah = '';
        item.weeklySabaqStartAyah = null;
        item.weeklySabaqEndSurah = '';
        item.weeklySabaqEndAyah = null;
        item.weeklySabaqStartJuz = null;
        item.weeklySabaqEndJuz = null;
        item.weeklySabaqStartPage = null;
        item.weeklySabaqEndPage = null;
        item.weeklySabqiStartSurah = '';
        item.weeklySabqiStartAyah = null;
        item.weeklySabqiEndSurah = '';
        item.weeklySabqiEndAyah = null;
        item.weeklySabqiStartJuz = null;
        item.weeklySabqiEndJuz = null;
        item.weeklySabqiStartPage = null;
        item.weeklySabqiEndPage = null;
        item.weeklyManzilStartSurah = '';
        item.weeklyManzilStartAyah = null;
        item.weeklyManzilEndSurah = '';
        item.weeklyManzilEndAyah = null;
        item.weeklyManzilStartJuz = null;
        item.weeklyManzilEndJuz = null;
        item.weeklyMistakes = 0;
        item.weeklyRating = 5;
        item.weeklyNotes = '';

        item.sabaqSurah = '';
        item.sabaqFromAyah = null;
        item.sabaqToAyah = null;
        item.sabaqMistakes = 0;
        item.sabqiSurah = '';
        item.sabqiFromAyah = null;
        item.sabqiToAyah = null;
        item.sabqiMistakes = 0;
        item.manzilSurah = '';
        item.manzilFromAyah = null;
        item.manzilToAyah = null;
        item.manzilMistakes = 0;
      }

      this.repo.clearCache('studentDailyProgress');
      this.repo.clearCache('studentWeeklyProgress');

      this.snackBar.open(
        `All progress records removed (${dailySnap.size} daily, ${weeklySnap.size} weekly)! Staff can now enter fresh baseline progress.`,
        'OK',
        { duration: 5000 }
      );
    } catch (err: any) {
      console.error('Error clearing progress:', err);
      this.snackBar.open(`Failed to clear progress: ${err?.message || 'Error'}`, 'Close', { duration: 5000 });
    } finally {
      this.loader.hide();
    }
  }

  // Admin: Configure Maktab curriculum subjects for organization
  openConfigureMaktabSubjects(): void {
    if (!this.isSuperAdmin && !this.isOrgAdmin) {
      this.snackBar.open('Only Organization Admin and Super Admin can configure Maktab subjects.', 'Dismiss', { duration: 3000 });
      return;
    }

    if (!this.currentUser?.organizationId) return;

    this.dialog.open(ConfigureMaktabSubjectsDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      panelClass: 'custom-target-dialog-panel',
      data: {
        currentUser: this.currentUser
      }
    });
  }
}
