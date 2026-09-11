import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { AppUser, AttendanceStatus, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { getDeenDeskFirestore } from '../../core/services/firebase-app';
import { ALL_QURAN_SURAHS } from '../../core/constants/defaults';
import { SetTargetDialogComponent } from './set-target-dialog.component';

export interface StudentSuiteRosterItem {
  student: EntityRecord;
  status: AttendanceStatus;
  note: string;
  // Target Fields & Metadata
  targetPeriod?: 'weekly' | 'monthly' | 'custom';
  targetStartDate?: string;
  targetEndDate?: string;
  targetSabaqSurah?: string;
  targetSabaqFromAyah?: number | null;
  targetSabaqToAyah?: number | null;
  targetSabqiJuzRange?: string;
  targetManzilJuzRange?: string;
  targetMaktabSubject?: string;
  targetMaktabPage?: number | null;
  targetMaktabLineNo?: number | null;
  targetDawrRounds?: number | null;
  targetDawrDailyJuz?: string;
  targetIncompleteReason?: string;
  targetIncompleteNotes?: string;
  // Hifz Progress Fields
  sabaqSurah: string;
  sabaqFromAyah: number | null;
  sabaqToAyah: number | null;
  sabaqMistakes: number | null;
  sabqiJuz: number | null;
  sabqiMistakes: number | null;
  manzilJuz: number | null;
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
  maktabSubject: string;
  maktabPage: number | null;
  maktabLineNo: number | null;
  maktabMistakes: number | null;
  maktabRemarks: string;
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

  // Header Selectors Data
  madrasas: EntityRecord[] = [];
  stages: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  classGroups: EntityRecord[] = [];
  availableClassGroupsForUser: EntityRecord[] = [];

  selectedMadrasaId = '';
  selectedStageId = '';
  selectedClassId = '';
  selectedGroupId = '';
  selectedDateStr = this.getTodayDateString();
  selectedDateObj = new Date();

  // Attendance Mode & Slots
  attendanceMode: 'FULL_DAY' | 'PER_PERIOD' = 'FULL_DAY';
  periodSlots: PeriodSlotChip[] = [];
  selectedPeriodId: string = 'FULL_DAY';
  selectedPeriodTitle: string = 'Full Day Attendance';

  // Audit Status
  isAttendanceRecorded = false;
  recordedByName = '';
  recordedAtText = '';

  // Tab State & Auto-Detected Progress Mode
  activeTab: 'attendance' | 'progress' | 'timetable' | 'reports' = 'attendance';
  studentTypeMode: 'hifz' | 'maktab' | 'dawr' = 'hifz';

  // Target Editing State
  editingTargetItem: StudentSuiteRosterItem | null = null;
  tempTargetSurah = '';
  tempTargetFromAyah: number | null = null;
  tempTargetToAyah: number | null = null;
  tempTargetPage: number | null = null;
  tempTargetLine: number | null = null;
  tempTargetDawrRounds: number | null = null;
  tempTargetDawrJuz = '';

  // Roster Data
  roster: StudentSuiteRosterItem[] = [];
  searchQuery = '';

  // Summary Metrics
  totalEnrolled = 0;
  presentCount = 0;
  absentCount = 0;
  lateCount = 0;
  leaveCount = 0;
  presentRate = 0;

  // Report Metrics Data
  reportStudentSummaries: { studentName: string; presentPct: number; presentDays: number; totalDays: number; hifzAvgSabaq: string }[] = [];

  readonly refresh$ = new BehaviorSubject<void>(undefined);

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly loader: LoaderService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.refresh$.pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.auth.profile$),
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
        });
      })
    ).subscribe((data) => {
      if (!data) return;
      this.madrasas = data.madrasas || [];
      this.stages = data.stages || [];
      this.courses = data.courses || [];
      this.classes = data.classes || [];
      this.classGroups = data.classGroups || [];

      this.setupDefaultSelections();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private evaluateUserRoles(profile: AppUser): void {
    const role = profile.role;
    this.isSuperAdmin = role === 'superAdmin';
    this.isOrgAdmin = role === 'organizationAdmin';
    this.isStageHead = role === 'stageHead';
    this.isMadrasaIncharge = role === 'madrasaIncharge';
    this.isStaff = role === 'teacher';

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
  }

  private setupDefaultSelections(): void {
    if (!this.currentUser) return;

    // 1. Madrasa Selection
    if (this.madrasas.length > 0) {
      if (!this.isSuperAdmin && !this.isOrgAdmin && this.currentUser.madrasaId) {
        this.selectedMadrasaId = this.currentUser.madrasaId;
      } else {
        this.selectedMadrasaId = this.madrasas[0]?.id || '';
      }
    }

    // 2. Class Group Selection Scoping
    this.filterGroupsForActiveScope();
  }

  filterGroupsForActiveScope(): void {
    if (!this.currentUser) return;

    let available = [...this.classGroups];

    // Filter by Madrasa if not global superAdmin
    if (this.selectedMadrasaId) {
      available = available.filter(g => (g['madrasaId'] === this.selectedMadrasaId || (g['madrasaIds'] && g['madrasaIds'].includes(this.selectedMadrasaId))));
    }

    // Filter by Stage if Stage Head
    if (this.isStageHead && (this.currentUser as any).stageId) {
      const targetStageId = (this.currentUser as any).stageId;
      available = available.filter(g => g['stageId'] === targetStageId || g['stage'] === targetStageId);
    }

    // Filter by Assigned Groups if Teacher/Staff
    if (this.isStaff && !this.isSuperAdmin && !this.isOrgAdmin && !this.isMadrasaIncharge && !this.isStageHead) {
      const assignedGroupIds: string[] = (this.currentUser as any).groupIds || (this.currentUser as any).assignedGroupIds || [];
      if (assignedGroupIds.length > 0) {
        available = available.filter(g => g.id && assignedGroupIds.includes(g.id));
      }
    }

    this.availableClassGroupsForUser = available;

    if (this.availableClassGroupsForUser.length > 0) {
      if (!this.availableClassGroupsForUser.some(g => g.id === this.selectedGroupId)) {
        this.selectedGroupId = this.availableClassGroupsForUser[0]?.id || '';
        this.onGroupChanged();
      }
    } else {
      this.selectedGroupId = '';
      this.roster = [];
    }
  }

  onMadrasaChanged(): void {
    this.filterGroupsForActiveScope();
  }

  onGroupChanged(): void {
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
      } else if (courseTypeStr.includes('hifz') || courseTypeStr.includes('memoriz')) {
        this.studentTypeMode = 'hifz';
      } else {
        this.studentTypeMode = 'maktab';
      }
    }

    this.loadTimetablePeriods();
    this.loadRosterAndAttendance();
  }

  onDateChanged(dateVal: Date): void {
    if (!dateVal) return;
    this.selectedDateObj = dateVal;
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    this.selectedDateStr = `${y}-${m}-${d}`;
    this.loadTimetablePeriods();
    this.loadRosterAndAttendance();
  }

  shiftDate(days: number): void {
    const newDate = new Date(this.selectedDateObj);
    newDate.setDate(newDate.getDate() + days);
    this.onDateChanged(newDate);
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
    this.loadRosterAndAttendance();
  }

  selectPeriodSlot(slot: PeriodSlotChip): void {
    this.selectedPeriodId = slot.id;
    this.selectedPeriodTitle = slot.periodTitle;
    this.loadRosterAndAttendance();
  }

  private loadTimetablePeriods(): void {
    if (!this.selectedGroupId) {
      this.periodSlots = [];
      return;
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysOfWeek[this.selectedDateObj.getDay()];

    // Query timetable entries for group
    if (this.currentUser) {
      this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', this.currentUser).subscribe((entries) => {
        const groupEntries = entries.filter(e => 
          (e.groupId === this.selectedGroupId || (e as any).groupIds?.includes(this.selectedGroupId)) &&
          (!e.dayOfWeek || e.dayOfWeek === currentDayName)
        );

        this.periodSlots = groupEntries.map((e, idx) => ({
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

  private async loadRosterAndAttendance(): Promise<void> {
    if (!this.selectedGroupId || !this.currentUser) {
      this.roster = [];
      return;
    }

    try {
      this.loader.show();
      const firestore = getDeenDeskFirestore();

      // 1. Fetch Students in Class Group
      const studentsList = await this.repo.getAllOnce<EntityRecord>('students', this.currentUser);
      const groupStudents = studentsList.filter(s => 
        (s['groupId'] === this.selectedGroupId || (s['groupIds'] && s['groupIds'].includes(this.selectedGroupId)))
      );

      // 2. Fetch Attendance Record Document for current Group + Date + Period
      const docId = `${this.selectedMadrasaId || 'default'}_${this.selectedGroupId}_${this.selectedDateStr}_${this.selectedPeriodId}`;
      const attendanceDocRef = doc(firestore, 'attendance', docId);
      const snap = await getDoc(attendanceDocRef);

      let savedAttendanceMap: Record<string, { status: AttendanceStatus; note?: string }> = {};

      if (snap.exists()) {
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

      // 3. Fetch Daily Progress Records & Student Target Records
      const progressMap = new Map<string, any>();
      for (const st of groupStudents) {
        if (st.id) {
          const pDocRef = doc(firestore, 'studentDailyProgress', `${st.id}_${this.selectedDateStr}`);
          const pSnap = await getDoc(pDocRef);
          if (pSnap.exists()) {
            progressMap.set(st.id, pSnap.data());
          }
        }
      }

      // 4. Build Roster Items
      this.roster = groupStudents.map(student => {
        const stId = student.id || '';
        const saved = stId ? savedAttendanceMap[stId] : undefined;
        const prog = stId ? progressMap.get(stId) : undefined;
        const hifz = prog?.hifzProgress || {};
        const dawr = prog?.dawrProgress || {};
        const maktab = prog?.maktabProgress || {};
        const targets = prog?.targetGoals || student['targetGoals'] || {};

        return {
          student,
          status: saved ? saved.status : 'present',
          note: saved?.note || '',
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
          targetDawrRounds: targets.dawrRounds || student['targetDawrRounds'] || 3,
          targetDawrDailyJuz: targets.dawrDailyJuz || '',
          targetIncompleteReason: targets.incompleteReason || '',
          targetIncompleteNotes: targets.incompleteNotes || '',
          sabaqSurah: hifz.sabaqSurahName || targets.sabaqSurah || '',
          sabaqFromAyah: hifz.sabaqFromAyah || targets.sabaqFromAyah || null,
          sabaqToAyah: hifz.sabaqToAyah || targets.sabaqToAyah || null,
          sabaqMistakes: hifz.sabaqMistakes || 0,
          sabqiJuz: hifz.sabqiJuzNo || null,
          sabqiMistakes: hifz.sabqiMistakes || 0,
          manzilJuz: hifz.manzilJuzNo || null,
          manzilMistakes: hifz.manzilMistakes || 0,
          hifzRating: hifz.rating || 5,
          dawrRoundNo: dawr.roundNo || 1,
          dawrPortionJuz: dawr.portionJuz || 'Juz 1',
          dawrFromAyah: dawr.fromAyah || null,
          dawrToAyah: dawr.toAyah || null,
          dawrMistakes: dawr.dawrMistakes || 0,
          dawrManzilMistakes: dawr.manzilMistakes || 0,
          dawrRating: dawr.rating || 5,
          maktabSubject: maktab.subjectName || '',
          maktabPage: maktab.pageNo || targets.maktabPage || null,
          maktabLineNo: maktab.lineNo || targets.maktabLineNo || null,
          maktabMistakes: maktab.mistakesCount || 0,
          maktabRemarks: maktab.remarks || ''
        };
      });

      this.recalculateSummary();
      if (this.canManageReports) {
        this.calculateReportMetrics();
      }
    } catch (err) {
      console.error('Error loading classroom suite data:', err);
      this.snackBar.open('Error loading roster and attendance data', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }

  // Target MatDialog Launcher
  openSetTargetModal(item: StudentSuiteRosterItem): void {
    const dialogRef = this.dialog.open(SetTargetDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'custom-target-dialog-panel',
      data: {
        student: item.student,
        studentTypeMode: this.studentTypeMode,
        currentTarget: {
          targetPeriod: item.targetPeriod || 'weekly',
          startDate: item.targetStartDate || this.selectedDateStr,
          endDate: item.targetEndDate || '',
          sabaqSurah: item.targetSabaqSurah || item.sabaqSurah || '',
          sabaqFromAyah: item.targetSabaqFromAyah || item.sabaqFromAyah || 1,
          sabaqToAyah: item.targetSabaqToAyah || item.sabaqToAyah || 25,
          sabqiJuzRange: item.targetSabqiJuzRange || 'Juz 1 to 5',
          manzilJuzRange: item.targetManzilJuzRange || 'Juz 1 to 15',
          targetDawrRounds: item.targetDawrRounds || 3,
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
      for (const item of this.roster) {
        if (item.student.id) {
          const prevDocRef = doc(firestore, 'studentDailyProgress', `${item.student.id}_${yStr}`);
          const pSnap = await getDoc(prevDocRef);
          if (pSnap.exists()) {
            const prevData = pSnap.data();
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
      }

      this.snackBar.open(`Auto-filled previous progress targets for ${updatedCount} students`, 'OK', { duration: 3000 });
    } catch (err) {
      console.error('Error copying previous targets:', err);
    } finally {
      this.loader.hide();
    }
  }

  async saveSuiteData(): Promise<void> {
    if (!this.canManageAttendance || !this.currentUser || !this.selectedGroupId) return;

    try {
      this.loader.show();
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
        madrasaId: this.selectedMadrasaId,
        classId: this.selectedClassId,
        groupId: this.selectedGroupId,
        date: this.selectedDateStr,
        attendanceMode: this.attendanceMode,
        timetableEntryId: this.selectedPeriodId,
        periodTitle: this.selectedPeriodTitle,
        takenByUid: this.currentUser.uid,
        takenByName: this.currentUser.displayName || this.currentUser.email,
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

      // Save Student Daily Progress Documents & Targets
      for (const item of this.roster) {
        if (item.student.id) {
          const pDocRef = doc(firestore, 'studentDailyProgress', `${item.student.id}_${this.selectedDateStr}`);
          const progressPayload = {
            id: `${item.student.id}_${this.selectedDateStr}`,
            studentId: item.student.id,
            madrasaId: this.selectedMadrasaId,
            classId: this.selectedClassId,
            groupId: this.selectedGroupId,
            date: this.selectedDateStr,
            studentType: this.studentTypeMode,
            recordedByUid: this.currentUser.uid,
            recordedByName: this.currentUser.displayName || this.currentUser.email,
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
            hifzProgress: {
              sabaqSurahName: item.sabaqSurah,
              sabaqFromAyah: item.sabaqFromAyah,
              sabaqToAyah: item.sabaqToAyah,
              sabaqMistakes: item.sabaqMistakes,
              sabqiJuzNo: item.sabqiJuz,
              sabqiMistakes: item.sabqiMistakes,
              manzilJuzNo: item.manzilJuz,
              manzilMistakes: item.manzilMistakes,
              rating: item.hifzRating,
            },
            dawrProgress: {
              roundNo: item.dawrRoundNo,
              portionJuz: item.dawrPortionJuz,
              fromAyah: item.dawrFromAyah,
              toAyah: item.dawrToAyah,
              dawrMistakes: item.dawrMistakes,
              manzilMistakes: item.dawrManzilMistakes,
              rating: item.dawrRating,
            },
            maktabProgress: {
              subjectName: item.maktabSubject,
              pageNo: item.maktabPage,
              lineNo: item.maktabLineNo,
              mistakesCount: item.maktabMistakes,
              remarks: item.maktabRemarks,
            }
          };

          await setDoc(pDocRef, progressPayload, { merge: true });
        }
      }

      // Invalidate Repository Cache (Rule 5 compliance)
      this.repo.clearCache();

      this.isAttendanceRecorded = true;
      this.recordedByName = this.currentUser.displayName || this.currentUser.email;
      this.recordedAtText = 'Just Now';

      this.snackBar.open('Attendance & Daily Progress saved successfully!', 'Dismiss', { duration: 3500 });
    } catch (err) {
      console.error('Error saving attendance and progress:', err);
      this.snackBar.open('Failed to save classroom suite data', 'Close', { duration: 4000 });
    } finally {
      this.loader.hide();
    }
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
}
