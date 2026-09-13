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
import { ALL_QURAN_SURAHS, getSurahAyahCount } from '../../core/constants/defaults';
import { SetTargetDialogComponent } from './set-target-dialog.component';
import { SimpleTimetableSlotDialogComponent } from './simple-timetable-slot-dialog.component';
import { StudentAttendanceHistoryDialogComponent, StudentAttendanceHistoryRecord } from './student-attendance-history-dialog.component';

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

  // Audit Status
  isAttendanceRecorded = false;
  recordedByName = '';
  recordedAtText = '';

  // Tab State & Auto-Detected Progress Mode
  activeTab: 'attendance' | 'progress' | 'timetable' | 'reports' = 'attendance';
  studentTypeMode: 'hifz' | 'maktab' | 'dawr' = 'hifz';
  isHifzCourse = false;

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

      this.setupDefaultSelections();
      this.resolveAssignedStaffForCurrentGroup();
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
    if (matchingStaffDoc?.['madrasaId']) assignedMIds.add(String(matchingStaffDoc['madrasaId']));
    if (Array.isArray(matchingStaffDoc?.['madrasaIds'])) matchingStaffDoc['madrasaIds'].forEach((id: any) => assignedMIds.add(String(id)));

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

    // Strict Filter by Assigned Groups if Teacher/Staff (and not SuperAdmin / OrgAdmin / MadrasaIncharge)
    if (!this.isSuperAdmin && !this.isOrgAdmin && !this.isMadrasaIncharge && !this.isStageHead) {
      if (this.userAssignedGroupIds.size > 0) {
        available = available.filter(g => g.id && this.userAssignedGroupIds.has(g.id));
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
    this.loadRosterAndAttendance();
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
    this.selectedGroupId = g.id || '';
    this.groupSearchText = g['name'] || g['title'] || '';
    this.onGroupChanged();
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
    this.selectedDateStr = `${y}-${m}-${d}`;
    this.loadTimetablePeriods();
    this.loadRosterAndAttendance();
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
          activityName: 'Quran Class',
          hifzSessionType: 'sabak',
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
        slot: slot,
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

  private async loadRosterAndAttendance(): Promise<void> {
    if (!this.selectedGroupId || !this.currentUser) {
      this.roster = [];
      return;
    }

    try {
      this.loader.show();
      const firestore = getDeenDeskFirestore();

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

      // 3. Fetch Daily Progress Records & Student Target Records
      const progressMap = new Map<string, any>();
      for (const st of groupStudents) {
        if (st.id) {
          try {
            const pDocRef = doc(firestore, 'studentDailyProgress', `${st.id}_${this.selectedDateStr}`);
            const pSnap = await getDoc(pDocRef);
            if (pSnap && pSnap.exists()) {
              progressMap.set(st.id, pSnap.data());
            }
          } catch (pErr) {
            console.warn(`Could not fetch daily progress for student ${st.id}:`, pErr);
          }
        }
      }

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

      // 4. Build Roster Items
      this.roster = groupStudents.map(student => {
        const stId = student.id || '';
        const saved = stId ? savedAttendanceMap[stId] : undefined;
        const prog = stId ? progressMap.get(stId) : undefined;
        const hifz = prog?.hifzProgress || {};
        const dawr = prog?.dawrProgress || {};
        const maktab = prog?.maktabProgress || {};
        const targets = prog?.targetGoals || student['targetGoals'] || {};

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

        const attendancePct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 100;
        const attendanceHistoryText = totalMarked > 0 ? `${attendancePct}% Present (${presentCount}/${totalMarked} Days)` : '100% Present';

        return {
          student,
          status: saved ? saved.status : 'present',
          note: saved?.note || '',
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

  onSabaqSurahChange(item: StudentSuiteRosterItem): void {
    if (!item.sabaqSurah) return;
    const ayahCount = getSurahAyahCount(item.sabaqSurah);
    if (ayahCount) {
      if (!item.sabaqFromAyah) item.sabaqFromAyah = 1;
      item.sabaqToAyah = ayahCount;
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
        organizationId: this.currentUser?.organizationId || '',
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
            organizationId: this.currentUser?.organizationId || '',
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
