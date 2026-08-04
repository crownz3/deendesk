import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, combineLatest, firstValueFrom, of, Subject } from 'rxjs';
import { catchError, map, startWith, switchMap, takeUntil, filter, take } from 'rxjs/operators';
import { where } from 'firebase/firestore';
import { AppUser, AttendanceStatus, ClassPlan, ClassPlanException, TimetableEntry, StudentDailyProgress } from '../../core/models/domain.model';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { MatDialog } from '@angular/material/dialog';
import { AttendanceFirestoreService } from '../../core/services/attendance-firestore.service';
import { AttendanceHistoryDialogComponent } from '../../shared/components/attendance-history-dialog/attendance-history-dialog.component';
import { StudentEvaluationDialogComponent } from './student-evaluation-dialog.component';
import { QuickAddDialogComponent } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface AttendanceVm {
  profile: AppUser;
  students: EntityRecord[];
  staffUsers: EntityRecord[];
  staffDocs: EntityRecord[];
  classPlans: (EntityRecord & ClassPlan)[];
  classPlanExceptions: (EntityRecord & ClassPlanException)[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  classGroups: EntityRecord[];
  timetableEntries: (EntityRecord & TimetableEntry)[];
}

export interface ScheduledDay {
  date: string;
  isException: boolean;
  exceptionType?: string;
  exceptionReason?: string;
  exception?: EntityRecord & ClassPlanException;
  staffNames: string[];
  studentNames: string[];
  currentSession?: EntityRecord & TimetableEntry;
  activities?: (EntityRecord & TimetableEntry)[];
}

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.page.html',
  styleUrls: ['./attendance.page.scss'],
  standalone: false,
})
export class AttendancePage implements OnInit, OnDestroy {
  readonly statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];
  selections: Record<string, AttendanceStatus> = {};
  attendanceDetails: Record<string, any> = {};

  searchQuery = '';
  madrasaSearch = '';
  pageIndex = 0;
  pageSize = 10;
  isSidebarCollapsed = false;
  readonly form = this.fb.nonNullable.group({
    madrasaId: [''],
    classPlanId: ['', Validators.required],
    date: [new Date(), Validators.required],
    timetableEntryId: ['ALL'], // 'ALL' = whole day, otherwise specific activity ID
    notes: [''],
    timelineStartDate: [null as Date | null],
    timelineEndDate: [null as Date | null]
  });

  activitiesForDate: (EntityRecord & TimetableEntry)[] = [];

  isAttendanceLoaded = false;
  minDate: Date | null = null;
  maxDate: Date | null = null;
  showSchedule = false;
  currentPlan: ClassPlan | null = null;

  dateFilter = (d: Date | null): boolean => {
    if (!d || !this.currentPlan) return true;
    const plan = this.currentPlan;
    
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    
    if (plan.scheduleType === 'customDates' && plan.selectedDates?.length) {
      return plan.selectedDates.includes(dateStr);
    }
    
    if (plan.scheduleType === 'weekly' && plan.weekDays?.length) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[d.getDay()];
      return plan.weekDays.includes(dayName);
    }
    
    return true;
  }

  get isCurrentDateValid(): boolean {
    const d = this.form.get('date')?.value;
    if (!d) return false;
    return this.dateFilter(new Date(d));
  }

  isToday(date: Date | string | null | undefined): boolean {
    if (!date) return false;
    const d = new Date(date);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  }

  private getFormattedDate(): string {
    const rawDate = this.form.get('date')?.value;
    if (!rawDate) return '';
    
    try {
      const d = new Date(rawDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly vm$ = this.refresh$.pipe(
    switchMap(() => this.auth.profile$),
    switchMap((profile) => {
      if (!profile) return of({ loading: false } as PageState<AttendanceVm>);

      return combineLatest({
        profile: of(profile),
        students: this.repo.list<EntityRecord>('students', profile),
        staffUsers: this.repo.list<EntityRecord>('users', profile, [], { roles: ['teacher', 'staff', 'madrasaIncharge', 'coordinator', 'organizationAdmin', 'superAdmin'] }).pipe(catchError(() => of([]))),
        staffDocs: this.repo.list<EntityRecord>('staff', profile),
        classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile),
        classPlanExceptions: this.repo.list<EntityRecord & ClassPlanException>('classPlanExceptions', profile),
        madrasas: this.repo.list<EntityRecord>('madrasas', profile),
        courses: this.repo.list<EntityRecord>('courses', profile),
        classes: this.repo.list<EntityRecord>('classes', profile),
        classGroups: this.repo.list<EntityRecord>('classGroups', profile),
        timetableEntries: this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', profile),
      }).pipe(
        map((data): PageState<AttendanceVm> => ({
          data,
          loading: false,
        })),
        startWith({ loading: true } as PageState<AttendanceVm>),
        catchError((err) => {
          console.error(err);
          return of({
            loading: false,
            error: 'Something went wrong while loading this page. Please try again.',
          } as PageState<AttendanceVm>);
        })
      );
    }),
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly dialog: MatDialog,
    private readonly route: ActivatedRoute,
    private readonly attendanceFs: AttendanceFirestoreService
  ) {}

  refreshData(): void {
    this.repo.clearCache();
    this.refresh$.next();
  }

  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.auth.profile$.pipe(takeUntil(this.destroy$)).subscribe(profile => {
      if (profile && !this.showMadrasaDropdown(profile.role) && profile.madrasaId) {
        this.form.patchValue({ madrasaId: profile.madrasaId }, { emitEvent: false });
      }
    });

    this.form.get('madrasaId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.form.patchValue({ classPlanId: '' }, { emitEvent: false });
      this.isAttendanceLoaded = false;
    });

    this.form.get('classPlanId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.isAttendanceLoaded = false;
      this.selections = {};
      this.attendanceDetails = {};
    });

    this.form.get('date')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.selections = {};
      this.attendanceDetails = {};
      // Reset activity selection when date changes
      this.form.patchValue({ timetableEntryId: 'ALL' }, { emitEvent: false });
      if (this.isAttendanceLoaded) {
         this.loadExistingAttendance();
      }
    });

    this.form.get('timetableEntryId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.selections = {};
      this.attendanceDetails = {};
      if (this.isAttendanceLoaded) {
         this.loadExistingAttendance();
      }
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['classPlanId']) {
        if (this.vm$) {
          this.vm$.pipe(
            takeUntil(this.destroy$),
            // Wait until data is loaded
            filter(state => !state.loading && !!state.data),
            take(1)
          ).subscribe(state => {
            const plan = state.data!.classPlans.find(p => p.id === params['classPlanId']);
            if (plan) {
              // If the user has a madrasa dropdown, select the madrasa first
              if (plan.madrasaId && this.form.get('madrasaId')?.value !== plan.madrasaId) {
                this.form.patchValue({ madrasaId: plan.madrasaId });
              }
              
              // Then select the plan
              setTimeout(() => {
                this.form.patchValue({ classPlanId: plan.id });
                this.onGetAttendance(state.data!);
              }, 100);
            }
          });
        }
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  showMadrasaDropdown(role: string): boolean {
    return ['coordinator', 'admin', 'organizationAdmin', 'superAdmin'].includes(role);
  }

  getFilteredClassPlans(vm: AttendanceVm) {
    let plans = vm.classPlans || [];
    const madrasaId = this.form.get('madrasaId')?.value;
    if (this.showMadrasaDropdown(vm.profile.role)) {
      if (!madrasaId) return [];
      plans = plans.filter(p => String(p.madrasaId) === String(madrasaId));
    } else if (madrasaId) {
      plans = plans.filter(p => String(p.madrasaId) === String(madrasaId));
    }

    if (vm.profile.role === 'teacher' || (vm.profile.role as string) === 'staff') {
      const profAny = vm.profile as Record<string, any>;
      const staffTokens = new Set<string>([
        ...this.extractAllStrings(profAny['id']),
        ...this.extractAllStrings(profAny['uid']),
        ...this.extractAllStrings(profAny['entityId']),
        ...this.extractAllStrings(profAny['email'])
      ]);

      const assignedGroups = (vm.classGroups || []).filter((g: any) => {
        const gStaffTokens = this.extractAllStrings([g['assignedStaffIds'], g['assignedStaff'], g['staffIds'], g['teacherIds'], g['groupStaff']]);
        return gStaffTokens.some(tok => staffTokens.has(tok));
      });
      const assignedGroupIds = new Set<string>([
        ...assignedGroups.map((g: any) => String(g.id)),
        ...this.extractAllStrings([profAny['groupId'], profAny['groupIds'], profAny['classGroupId'], profAny['classGroupIds'], profAny['assignedGroupId']])
      ]);

      const assignedClassIds = new Set<string>([
        ...assignedGroups.map((g: any) => String(g['classId'] || '')).filter(Boolean),
        ...(vm.classes || []).filter((c: any) => {
          const cStaffTokens = this.extractAllStrings([c['assignedStaffIds'], c['assignedStaff'], c['staffIds'], c['teacherIds']]);
          return cStaffTokens.some(tok => staffTokens.has(tok));
        }).map((c: any) => String(c.id)),
        ...this.extractAllStrings([profAny['classId'], profAny['classIds'], profAny['assignedClassId'], profAny['assignedClassIds']])
      ]);

      const assignedCourseIds = new Set<string>([
        ...(vm.classes || []).filter((c: any) => assignedClassIds.has(String(c.id))).map((c: any) => String(c['courseId'] || '')).filter(Boolean),
        ...this.extractAllStrings([profAny['courseId'], profAny['courseIds'], profAny['assignedCourseId'], profAny['assignedCourseIds']])
      ]);

      plans = plans.filter((p: any) => {
        const pTeacherTokens = this.extractAllStrings([p['teacherId'], p['assignedStaffId'], p['teacherUid'], p['createdBy'], p['updatedBy']]);
        if (pTeacherTokens.some(tok => staffTokens.has(tok))) return true;

        const pGroupTokens = this.extractAllStrings([p['groupId'], p['classGroupId'], p['groupIds'], p['classGroupIds']]);
        if (pGroupTokens.some(gId => assignedGroupIds.has(gId))) return true;

        const pClassTokens = this.extractAllStrings([p['classId'], p['assignedClassId'], p['classIds'], p['assignedClassIds']]);
        if (pClassTokens.some(cId => assignedClassIds.has(cId))) return true;

        const pCourseTokens = this.extractAllStrings([p['courseId'], p['assignedCourseId'], p['courseIds'], p['assignedCourseIds']]);
        if (pCourseTokens.some(crsId => assignedCourseIds.has(crsId))) return true;

        return false;
      });
    }

    return plans;
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

  async onGetAttendance(vm: AttendanceVm) {
    if (!this.form.get('classPlanId')?.value) {
      this.snackBar.open('Please select a class plan first.', 'Close', { duration: 3000 });
      return;
    }
    
    const selectedPlan = vm.classPlans.find(p => p.id === this.form.get('classPlanId')?.value);
    if (selectedPlan) {
      this.currentPlan = selectedPlan;
      if (selectedPlan.startDate) {
        this.minDate = new Date(selectedPlan.startDate);
      } else {
        this.minDate = null;
      }
      
      if (selectedPlan.endDate) {
        this.maxDate = new Date(selectedPlan.endDate);
      } else {
        this.maxDate = null;
      }

      let currentDate = this.form.get('date')?.value;
      
      // Auto-adjust date if it's outside bounds
      if (this.minDate && currentDate && currentDate < this.minDate) {
        currentDate = this.minDate;
        this.form.patchValue({ date: currentDate }, { emitEvent: false });
      } else if (this.maxDate && currentDate && currentDate > this.maxDate) {
        currentDate = this.maxDate;
        this.form.patchValue({ date: currentDate }, { emitEvent: false });
      }
    }

    this.isAttendanceLoaded = true;
    await this.loadExistingAttendance();
  }

  async loadExistingAttendance() {
    const filter = this.form.getRawValue();
    const dateStr = this.getFormattedDate();
    if (!filter.classPlanId || !dateStr) {
      this.snackBar.open('Please select a date and class plan first.', 'Close', { duration: 3000 });
      return;
    }

    this.selections = {};
    this.attendanceDetails = {};

    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) return;

    try {
      // 1. Load timetable entries for this date's day-of-week
      const parts = dateStr.split('-').map(Number);
      const dateObj = (parts.length === 3 && !isNaN(parts[0]))
        ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dateStr);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDayName = days[dateObj.getDay()];
      const allEntries = await this.repo.getAllOnce<EntityRecord & TimetableEntry>('timetableEntries', profile, undefined, [
        where('classPlanId', '==', filter.classPlanId)
      ]);
      this.activitiesForDate = allEntries
        .filter(e => String(e.dayOfWeek || '').trim().toLowerCase() === todayDayName.toLowerCase())
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

      const timetableEntryId = filter.timetableEntryId !== 'ALL' ? filter.timetableEntryId : null;
      const newSelections: Record<string, AttendanceStatus> = {};
      const newDetails: Record<string, any> = {};

      // 2. Load from new subcollection: attendance/{classPlanId}/days/{date}
      const subcollDoc = await this.attendanceFs.getDay(filter.classPlanId, dateStr, timetableEntryId);

      if (subcollDoc) {
        if (Array.isArray(subcollDoc.students)) {
          for (const s of subcollDoc.students) {
            if (s.studentId) {
              newSelections[s.studentId] = s.status;
              newDetails[s.studentId] = s;
            }
          }
        }
        if (Array.isArray(subcollDoc.staff)) {
          for (const st of subcollDoc.staff) {
            if (st.staffId) {
              newSelections[st.staffId] = st.status;
              newDetails[st.staffId] = st;
            }
          }
        }
      } else {
        // Fallback: check legacy top-level 'attendance' collection
        const existing = await this.repo.getAllOnce<EntityRecord & any>('attendance', profile, undefined, [
          where('classPlanId', '==', filter.classPlanId),
          where('date', '==', dateStr)
        ]);
        const matchingDoc = existing.find((doc: any) => {
          if (timetableEntryId) return doc.timetableEntryId === timetableEntryId;
          return !doc.timetableEntryId;
        });

        if (matchingDoc) {
          if (Array.isArray(matchingDoc.students)) {
            for (const s of matchingDoc.students) {
              if (s.studentId) {
                newSelections[s.studentId] = s.status;
                newDetails[s.studentId] = s;
              }
            }
          }
          if (Array.isArray(matchingDoc.staff)) {
            for (const st of matchingDoc.staff) {
              if (st.staffId) {
                newSelections[st.staffId] = st.status;
                newDetails[st.staffId] = st;
              }
            }
          }
        } else {
          // Backward compat: old flat per-student records
          const flatDocs = existing.filter((doc: any) => doc.studentId && !Array.isArray(doc.students));
          for (const doc of flatDocs) {
            const matches = timetableEntryId
              ? doc.timetableEntryId === timetableEntryId
              : !doc.timetableEntryId;
            if (matches) {
              newSelections[doc.studentId] = doc.status;
              newDetails[doc.studentId] = doc;
            }
          }
        }
      }

      this.selections = newSelections;
      this.attendanceDetails = newDetails;
    } catch (e) {
      console.error('Failed to load existing attendance', e);
    }
  }

  filteredStudents(vm: AttendanceVm): EntityRecord[] {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId) return [];

    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    if (!selectedPlan) return [];

    const targetClassId = String(selectedPlan.classId || '').trim();
    const targetGroupIds = Array.from(new Set([
      ...(Array.isArray(selectedPlan.groupIds) ? selectedPlan.groupIds.map(String) : []),
      selectedPlan.groupId || ''
    ].filter(Boolean).map(s => s.trim())));

    return vm.students.filter((student) => {
      const sClassId = String(student['classId'] || '').trim();
      const sClassIds = Array.isArray(student['classIds']) ? student['classIds'].map(String) : [];
      const matchesClass = sClassId === targetClassId || sClassIds.includes(targetClassId);
      if (!matchesClass) return false;

      if (targetGroupIds.length > 0) {
        const sGroupId = String(student['groupId'] || '').trim();
        const sGroupIds = Array.isArray(student['groupIds']) ? student['groupIds'].map(String) : [];
        const matchesGroup = targetGroupIds.includes(sGroupId) || sGroupIds.some(id => targetGroupIds.includes(id));
        return matchesGroup;
      }

      return true;
    });
  }

  getExceptionForSelectedDate(vm: AttendanceVm): (EntityRecord & ClassPlanException) | undefined {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId || !filter.date) return undefined;
    const dateStr = this.getFormattedDate();
    return vm.classPlanExceptions.find(
      e => e.classPlanId === filter.classPlanId && e.date === dateStr
    );
  }

  isExceptionAttendanceDisabled(ex?: (EntityRecord & ClassPlanException) | null): boolean {
    if (!ex) return false;
    if (ex.enableAttendance !== undefined) return !ex.enableAttendance;
    if (['holiday', 'cancelled', 'suddenLeave'].includes(ex.type)) return true;
    return ex.affectsAttendance !== false;
  }

  async removeException(exception: EntityRecord & ClassPlanException): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Remove Exception',
        message: `Are you sure you want to remove the "${exception.type}" exception for ${exception.date}? Attendance will become available for this day again.`,
        confirmText: 'Remove Exception',
        confirmColor: 'warn',
      }
    }).afterClosed());

    if (confirmed) {
      try {
        await this.loader.withLoader('Removing exception...', () =>
          this.repo.remove('classPlanExceptions', exception.id!)
        );
        this.snackBar.open('Exception removed. Attendance is now available.', 'Close', { duration: 3000 });
      } catch (e) {
        this.snackBar.open('Error removing exception. Please try again.', 'Close', { duration: 3000 });
      }
    }
  }

  markAllStudents(vm: AttendanceVm, status: AttendanceStatus): void {
    const students = this.filteredStudents(vm);
    const newSelections = { ...this.selections };
    students.forEach(s => {
      if (s.id) newSelections[String(s.id)] = status;
    });
    this.selections = newSelections;
    this.snackBar.open(`Marked ${students.length} student(s) as ${status}.`, 'Close', { duration: 2000 });
  }

  searchedStudents(vm: AttendanceVm): EntityRecord[] {
    const students = this.filteredStudents(vm);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      return students.filter(s => String(s['displayName'] || s['name'] || '').toLowerCase().includes(q));
    }
    return students;
  }

  paginatedStudents(vm: AttendanceVm): EntityRecord[] {
    const students = this.searchedStudents(vm);
    const start = this.pageIndex * this.pageSize;
    return students.slice(start, start + this.pageSize);
  }

  onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  onSearchChange() {
    this.pageIndex = 0;
  }

  private identityValues(row: EntityRecord): string[] {
    return [row.id, row['uid'], row['userId'], row['entityId'], row['email']]
      .map(value => String(value || '').trim())
      .filter(Boolean);
  }

  private groupStaffIds(vm: AttendanceVm, classId: string, groupId?: string | null): string[] {
    const groups = vm.classGroups.filter(group => {
      if (String(group['classId'] || '') !== String(classId)) return false;
      return groupId ? String(group.id) === String(groupId) : true;
    });

    return Array.from(new Set(
      groups.flatMap(group => Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'].map(String) : [])
    ));
  }

  private staffUserIdsFromAssignmentIds(vm: AttendanceVm, staffIds: string[]): string[] {
    const userIds = new Set<string>();
    staffIds.forEach(id => userIds.add(id));

    vm.staffDocs.forEach(doc => {
      const matches = this.identityValues(doc).some(id => staffIds.includes(id));
      if (matches && doc['userId']) {
        userIds.add(String(doc['userId']));
      }
    });

    return Array.from(userIds);
  }

  filteredStaff(vm: AttendanceVm): EntityRecord[] {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId) return [];

    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    if (!selectedPlan) return [];

    const targetClassId = String(selectedPlan.classId || '').trim();
    const targetGroupIds = Array.from(new Set([
      ...(Array.isArray(selectedPlan.groupIds) ? selectedPlan.groupIds.map(String) : []),
      selectedPlan.groupId || ''
    ].filter(Boolean).map(s => s.trim())));

    const assignedStaffIds = new Set<string>();

    // 1. Extract assigned staff from target Class Groups
    const matchingClassGroups = (vm.classGroups || []).filter(g => {
      const gClassId = String(g['classId'] || '').trim();
      const gId = String(g.id || '').trim();
      if (targetClassId && gClassId && gClassId !== targetClassId) return false;
      if (targetGroupIds.length > 0) return targetGroupIds.includes(gId);
      return true;
    });

    matchingClassGroups.forEach(g => {
      const ids = Array.isArray(g['assignedStaffIds']) ? g['assignedStaffIds'] : [];
      ids.forEach((id: any) => {
        if (id) assignedStaffIds.add(String(id).trim());
      });
    });

    // 2. Extract assigned staff from timetable activities for this date
    if (filter.timetableEntryId && filter.timetableEntryId !== 'ALL') {
      const selectedActivity = this.activitiesForDate.find(a => String(a.id) === String(filter.timetableEntryId));
      if (selectedActivity && selectedActivity.teacherId) {
        assignedStaffIds.add(String(selectedActivity.teacherId).trim());
      }
    } else {
      this.activitiesForDate.forEach(a => {
        if (a.teacherId) assignedStaffIds.add(String(a.teacherId).trim());
      });
    }

    // 3. Combine staffDocs and staffUsers into a unified pool of staff records
    const allStaffRecords = [...(vm.staffDocs || []), ...(vm.staffUsers || [])];

    // Exclude students and parents
    const validStaffRecords = allStaffRecords.filter(s => {
      const role = String(s['role'] || '').toLowerCase();
      const roles: string[] = Array.isArray(s['roles']) ? s['roles'].map(r => String(r).toLowerCase()) : (role ? [role] : []);
      return !roles.includes('student') && !roles.includes('parent') && role !== 'student' && role !== 'parent';
    });

    // Check staff profiles with explicit matching groupId or classId
    validStaffRecords.forEach(s => {
      const sGroupIds = [
        String(s['groupId'] || ''),
        String(s['assignedGroupId'] || ''),
        ...(Array.isArray(s['groupIds']) ? s['groupIds'].map(String) : []),
        ...(Array.isArray(s['assignedGroupIds']) ? s['assignedGroupIds'].map(String) : []),
        ...(Array.isArray(s['teachingGroupIds']) ? s['teachingGroupIds'].map(String) : [])
      ].filter(Boolean).map(v => v.trim());

      const sClassIds = [
        String(s['classId'] || ''),
        String(s['assignedClassId'] || ''),
        ...(Array.isArray(s['classIds']) ? s['classIds'].map(String) : []),
        ...(Array.isArray(s['assignedClassIds']) ? s['assignedClassIds'].map(String) : []),
        ...(Array.isArray(s['teachingClassIds']) ? s['teachingClassIds'].map(String) : [])
      ].filter(Boolean).map(v => v.trim());

      const matchesGroup = targetGroupIds.length > 0 && targetGroupIds.some(gId => sGroupIds.includes(gId));
      const matchesClass = targetClassId && sClassIds.includes(targetClassId);

      if (matchesGroup || matchesClass) {
        this.identityValues(s).forEach(id => assignedStaffIds.add(id));
      }
    });

    if (assignedStaffIds.size === 0) {
      return [];
    }

    // Match staff from validStaffRecords (BOTH staffDocs and staffUsers!)
    const matchedStaffMap = new Map<string, EntityRecord>();
    validStaffRecords.forEach(s => {
      const sIdentities = this.identityValues(s);
      if (sIdentities.some(id => assignedStaffIds.has(id))) {
        const personKey = String(s['displayName'] || s['name'] || s['email'] || s.id).toLowerCase().trim();
        if (!matchedStaffMap.has(personKey)) {
          matchedStaffMap.set(personKey, s);
        }
      }
    });

    const finalStaffList = Array.from(matchedStaffMap.values());

    console.log('[Attendance Page Staff Debug]', {
      planTitle: selectedPlan.title,
      targetClassId,
      targetGroupIds,
      assignedStaffIds: Array.from(assignedStaffIds),
      matchedStaffNames: finalStaffList.map(s => s['displayName'] || s['name'] || s['email'])
    });

    return finalStaffList;
  }

  private _lastMadrasas: EntityRecord[] | null = null;
  private _lastQuery = '';
  private _cachedFilteredMadrasas: EntityRecord[] = [];

  filterMadrasas(madrasas: EntityRecord[]): EntityRecord[] {
    if (!madrasas) return [];
    if (this._lastMadrasas === madrasas && this._lastQuery === this.madrasaSearch) {
      return this._cachedFilteredMadrasas;
    }
    this._lastMadrasas = madrasas;
    this._lastQuery = this.madrasaSearch;
    
    if (!this.madrasaSearch) {
      this._cachedFilteredMadrasas = madrasas;
    } else {
      const q = this.madrasaSearch.toLowerCase();
      this._cachedFilteredMadrasas = madrasas.filter(m => String(m['name'] || '').toLowerCase().includes(q));
    }
    return this._cachedFilteredMadrasas;
  }

  isGeneralStaff(vm: AttendanceVm, staffId: string | undefined): boolean {
    if (!staffId) return false;
    const filter = this.form.getRawValue();
    if (!filter.classPlanId) return false;

    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    if (!selectedPlan) return false;

    return this.staffUserIdsFromAssignmentIds(
      vm,
      this.groupStaffIds(vm, selectedPlan.classId, selectedPlan.groupId)
    ).includes(staffId);
  }

  getActivityNameForStaff(staffId: string | undefined): string | null {
    if (!staffId) return null;
    const filter = this.form.getRawValue();

    if (filter.timetableEntryId && filter.timetableEntryId !== 'ALL') {
      const selectedActivity = this.activitiesForDate.find(a => String(a.id) === String(filter.timetableEntryId));
      if (selectedActivity && String(selectedActivity.teacherId) === staffId) {
        return selectedActivity.activityName;
      }
    } else {
      const assignedActivities = this.activitiesForDate.filter(a => String(a.teacherId) === staffId);
      if (assignedActivities.length > 0) {
        return assignedActivities.map(a => a.activityName).join(' & ');
      }
    }

    return null;
  }

  getDebugInfo(vm: AttendanceVm): any {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId) return null;
    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    const groupStaffIds = selectedPlan ? this.groupStaffIds(vm, selectedPlan.classId, selectedPlan.groupId) : [];
    const staffUserIds = this.staffUserIdsFromAssignmentIds(vm, groupStaffIds);

    return {
      planId: filter.classPlanId,
      hasPlan: !!selectedPlan,
      classId: selectedPlan?.classId,
      groupId: selectedPlan?.groupId,
      groupStaffIds,
      totalStaffLoaded: vm.staffUsers.length,
      matchingStaffLoaded: vm.staffUsers.filter(s => {
        return staffUserIds.includes(String(s.id));
      }).map(s => s['name'] || s['displayName'] || s.id)
    };
  }

  getSchedule(vm: AttendanceVm): ScheduledDay[] {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId) return [];

    const plan = vm.classPlans.find(p => p.id === filter.classPlanId);
    if (!plan) return [];

    const planExceptions = vm.classPlanExceptions.filter(e => e.classPlanId === plan.id);
    const schedule: ScheduledDay[] = [];
    
    if (!plan.startDate) return [];
    
    if (plan.scheduleType === 'customDates' && plan.selectedDates?.length) {
      for (const d of plan.selectedDates) {
        schedule.push(this.buildScheduledDay(d, plan, planExceptions, vm));
      }
      return schedule;
    }

    const filterStartDate = filter.timelineStartDate ? new Date(filter.timelineStartDate) : null;
    const filterEndDate = filter.timelineEndDate ? new Date(filter.timelineEndDate) : null;
    
    // Normalize filter dates to start/end of day
    if (filterStartDate) filterStartDate.setHours(0,0,0,0);
    if (filterEndDate) filterEndDate.setHours(23,59,59,999);

    const [sYear, sMonth, sDay] = plan.startDate.split('T')[0].split('-').map(Number);
    const planStart = new Date(sYear, sMonth - 1, sDay);
    
    let planEnd: Date;
    if (plan.endDate) {
      const [eYear, eMonth, eDay] = plan.endDate.split('T')[0].split('-').map(Number);
      planEnd = new Date(eYear, eMonth - 1, eDay);
    } else {
      if (plan.scheduleType === 'oneTime') {
        planEnd = new Date(planStart);
      } else {
        planEnd = new Date(planStart.getTime() + 90 * 24 * 60 * 60 * 1000);
      }
    }
    
    // The actual loop start and end bounds
    const loopStart = filterStartDate && filterStartDate > planStart ? filterStartDate : planStart;
    const loopEnd = filterEndDate && filterEndDate < planEnd ? filterEndDate : planEnd;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    let curr = new Date(loopStart);
    let count = 0;
    while (curr <= loopEnd && count < 365) {
      const dayName = dayNames[curr.getDay()];
      
      let includeDay = true;
      if (plan.scheduleType === 'weekly' && plan.weekDays?.length) {
        includeDay = plan.weekDays.includes(dayName);
      }
      
      if (includeDay) {
         const y = curr.getFullYear();
         const m = String(curr.getMonth() + 1).padStart(2, '0');
         const d = String(curr.getDate()).padStart(2, '0');
         schedule.push(this.buildScheduledDay(`${y}-${m}-${d}`, plan, planExceptions, vm));
      }
      
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    
    return schedule;
  }

  private buildScheduledDay(dateStr: string, plan: ClassPlan, exceptions: (EntityRecord & ClassPlanException)[], vm?: AttendanceVm): ScheduledDay {
    const ex = exceptions.find(e => e.date === dateStr);
    
    // Compute current session if date is today
    let currentSession: (EntityRecord & TimetableEntry) | undefined;
    if (vm && this.isToday(dateStr)) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDayName = days[new Date().getDay()];
      
      const entriesForPlan = vm.timetableEntries.filter(e => e.classPlanId === plan.id && e.dayOfWeek === todayDayName);
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      currentSession = entriesForPlan.find(entry => {
        if (!entry.startTime || !entry.endTime) return true;
        const [sH, sM] = entry.startTime.split(':').map(Number);
        const [eH, eM] = entry.endTime.split(':').map(Number);
        const startMins = sH * 60 + sM;
        const endMins = eH * 60 + eM;
        return currentMinutes >= startMins && currentMinutes <= endMins;
      });
      
      if (!currentSession && entriesForPlan.length > 0) {
        // If outside of all sessions, maybe pick the next upcoming one, or just leave it blank.
        currentSession = entriesForPlan.find(entry => {
            if (!entry.startTime) return true;
            const [sH, sM] = entry.startTime.split(':').map(Number);
            return (sH * 60 + sM) > currentMinutes;
        }) || entriesForPlan[entriesForPlan.length - 1]; // or the last one
      }
    }
    
    let staffNames: string[] = [];
    let studentNames: string[] = [];
    let activities: (EntityRecord & TimetableEntry)[] = [];
    
    if (vm) {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(Number(y), Number(m)-1, Number(d));
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[dateObj.getDay()];
      
      const entriesForDay = vm.timetableEntries.filter(e => e.classPlanId === plan.id && e.dayOfWeek === dayName);
      
      // Populate activities, sorting by start time
      activities = [...entriesForDay].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      
      const teacherIds = new Set<string>();
      
      entriesForDay.forEach(e => {
        if (e.teacherId) teacherIds.add(e.teacherId);
        
        // Also populate teacherName inside the activity for display in UI
        if (e.teacherId) {
          const tId = String(e.teacherId).trim();
          const matched = [...(vm.staffUsers || []), ...(vm.staffDocs || [])]
            .find(s => this.identityValues(s).includes(tId));
          e['teacherName'] = matched ? String(matched['displayName'] || matched['name'] || matched['email'] || '').trim() : '';
        }
      });
      
      this.staffUserIdsFromAssignmentIds(
        vm,
        this.groupStaffIds(vm, plan.classId, plan.groupId)
      ).forEach(id => teacherIds.add(id));
      
      staffNames = Array.from(new Set(
        Array.from(teacherIds)
          .map(id => {
            let user = vm.staffUsers.find(s => this.identityValues(s).includes(id));
            if (user) return String(user['displayName'] || user['name'] || '').trim();
            let doc = vm.staffDocs.find(s => this.identityValues(s).includes(id));
            if (doc) return String(doc['displayName'] || doc['name'] || '').trim();
            return null;
          })
          .filter(Boolean) as string[]
      ));
        
      const studentsInClass = vm.students.filter(s => s['classId'] === plan.classId);
      studentNames = Array.from(new Set(studentsInClass.map(s => String(s['displayName'] || s['name'] || 'Unknown Student'))));
    }
    
    return {
      date: dateStr,
      isException: !!ex,
      exceptionType: ex?.customTypeName || ex?.type,
      exceptionReason: ex?.reason,
      exception: ex,
      staffNames,
      studentNames,
      currentSession,
      activities
    };
  }

  getActivityLabel(activity: (EntityRecord & TimetableEntry) | undefined | null): string {
    if (!activity) return '';
    if (activity.hifzSessionType) {
      const labels: Record<string, string> = {
        sabak: 'Sabak (New Lesson)',
        sabki: 'Sabki (Recent Revision)',
        manzil: 'Manzil (Old Revision)',
        custom: activity.activityName || 'Custom Session'
      };
      if (labels[activity.hifzSessionType]) return labels[activity.hifzSessionType];
    }
    return activity.activityName || activity.subjectName || 'Period Activity';
  }

  getCurrentSession(vm: AttendanceVm): (EntityRecord & TimetableEntry) | undefined {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId || !filter.date) return undefined;
    
    const dateStr = this.getFormattedDate();
    if (!this.isToday(dateStr)) return undefined; // only show current activity for today
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = days[new Date().getDay()];
    
    const entriesForPlan = vm.timetableEntries.filter(e => e.classPlanId === filter.classPlanId && e.dayOfWeek === todayDayName);
    if (!entriesForPlan.length) return undefined;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let current = entriesForPlan.find(entry => {
      if (!entry.startTime || !entry.endTime) return true;
      const [sH, sM] = entry.startTime.split(':').map(Number);
      const [eH, eM] = entry.endTime.split(':').map(Number);
      return currentMinutes >= (sH * 60 + sM) && currentMinutes <= (eH * 60 + eM);
    });
    
    if (!current) {
      current = entriesForPlan.find(entry => {
        if (!entry.startTime) return true;
        const [sH, sM] = entry.startTime.split(':').map(Number);
        return (sH * 60 + sM) > currentMinutes;
      }) || entriesForPlan[entriesForPlan.length - 1];
    }
    
    return current;
  }

  async setStatus(studentId: string | undefined, status: AttendanceStatus, toggleGroup?: any): Promise<void> {
    if (!studentId) return;

    const previousValue = this.selections[studentId];

    if (status === 'absent' || status === 'leave') {
      const result = await firstValueFrom(this.dialog.open(QuickAddDialogComponent, {
        width: '500px',
        data: {
          title: status === 'absent' ? 'Absent Details' : 'Leave Details',
          fields: [
            { 
              key: 'informed', 
              label: 'Informed?', 
              type: 'button-toggle', 
              required: true,
              options: [{label: 'Yes', value: 'Yes'}, {label: 'No', value: 'No'}] 
            },
            { key: 'reason', label: 'Reason', type: 'textarea' }
          ],
          submitLabel: 'Save'
        }
      }).afterClosed());

      if (result?.value) {
        this.selections[studentId] = status;
        this.attendanceDetails[studentId] = result.value;
      } else {
        if (toggleGroup) toggleGroup.value = previousValue || null;
        this.selections = { ...this.selections };
      }
    } else if (status === 'late') {
      const result = await firstValueFrom(this.dialog.open(QuickAddDialogComponent, {
        width: '500px',
        data: {
          title: 'Late Details',
          fields: [
            { key: 'lateTime', label: 'How much time late? (e.g. 15 mins)', type: 'text', required: true }
          ],
          submitLabel: 'Save'
        }
      }).afterClosed());

      if (result?.value) {
        this.selections[studentId] = status;
        this.attendanceDetails[studentId] = result.value;
      } else {
        if (toggleGroup) toggleGroup.value = previousValue || null;
        this.selections = { ...this.selections };
      }
    } else {
      this.selections[studentId] = status;
      delete this.attendanceDetails[studentId];
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'present': return 'checkmark-circle-outline';
      case 'absent': return 'close-circle-outline';
      case 'late': return 'time-outline';
      case 'leave': return 'calendar-outline';
      default: return 'ellipse-outline';
    }
  }

  studentProgressMap: { [studentId: string]: StudentDailyProgress } = {};

  viewHistory(student: EntityRecord): void {
    this.dialog.open(AttendanceHistoryDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: {
        title: `Attendance History for ${student['displayName'] || student['name'] || 'Student'}`,
        studentId: String(student.id)
      }
    });
  }

  async openEvaluationDialog(student: EntityRecord, vm: AttendanceVm): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile || !student.id) return;

    const dateStr = this.getFormattedDate();

    // Determine course type for this student / selected course
    const courseId = String(student['courseId'] || student['course'] || '');
    const courseObj = vm.courses.find(c => String(c.id) === courseId || c['code'] === courseId);
    const courseType = String(courseObj?.['type'] || courseObj?.['courseType'] || 'hifz').toLowerCase();
    const courseName = String(courseObj?.['name'] || 'Course');

    // Fetch any existing progress record for today
    let existingRecord: any = undefined;
    try {
      const records = await firstValueFrom(
        this.repo.list<StudentDailyProgress>('studentDailyProgress', profile, [
          where('date', '==', dateStr),
          where('studentId', '==', String(student.id))
        ])
      );
      if (records && records.length > 0) {
        existingRecord = records[0];
      }
    } catch (err) {
      console.warn('[AttendancePage] Could not fetch existing progress record:', err);
    }

    const dialogRef = this.dialog.open(StudentEvaluationDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'responsive-evaluation-dialog',
      data: {
        studentId: String(student.id),
        studentName: String(student['displayName'] || student['name'] || 'Student'),
        date: dateStr,
        courseId,
        courseName,
        courseType,
        classId: String(student['classId'] || ''),
        groupId: String(student['groupId'] || ''),
        profile,
        existingRecord
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res?.success && res.record && student.id) {
        this.studentProgressMap[String(student.id)] = res.record;
      }
    });
  }

  getInitials(name: any): string {
    return typeof name === 'string' && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  }

  async save(vm: AttendanceVm): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const profile = await firstValueFrom(this.auth.profile$);
    const filter = this.form.getRawValue();
    const students = this.filteredStudents(vm);
    const staff = this.filteredStaff(vm);

    if (students.length === 0 && staff.length === 0) {
      this.snackBar.open('No participants found for the selected filter.', 'Close', { duration: 3000 });
      return;
    }

    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    if (!selectedPlan) {
      this.snackBar.open('Class plan not found.', 'Close', { duration: 3000 });
      return;
    }

    const dateStr = this.getFormattedDate();

    let timetableEntryId: string | undefined = undefined;
    let activityName: string | undefined = undefined;
    if (filter.timetableEntryId && filter.timetableEntryId !== 'ALL') {
      timetableEntryId = filter.timetableEntryId;
      const activity = this.activitiesForDate.find(a => a.id === timetableEntryId);
      if (activity) activityName = activity.activityName;
    }

    try {
      await this.loader.withLoader('Saving attendance...', async () => {
        // Build students[] array — one entry per student with their status
        const studentsArray = students.map(student => {
          const pid = String(student.id);
          const details = this.attendanceDetails[pid] || {};
          // Remove doc-level fields that shouldn't be in the student entry
          const { date, classPlanId, classId, courseId, madrasaId, organizationId, teacherId, notes, autoGenerated, timetableEntryId: _te, activityName: _an, ...cleanDetails } = details as any;
          return {
            studentId: pid,
            studentName: String(student['displayName'] || student['name'] || 'Unknown'),
            status: this.selections[pid] || 'present',
            markedBy: profile?.uid ?? 'system',
            markedAt: new Date().toISOString(),
            ...cleanDetails
          };
        });

        // Build staff[] array
        const staffArray = staff.map(s => {
          const pid = String(s.id);
          const details = this.attendanceDetails[pid] || {};
          const { date: _d, classPlanId: _cp, ...cleanDetails } = details as any;
          return {
            staffId: pid,
            staffName: String(s['displayName'] || s['name'] || 'Unknown'),
            role: String(s['role'] || 'teacher'),
            status: this.selections[pid] || 'present',
            markedBy: profile?.uid ?? 'system',
            markedAt: new Date().toISOString(),
            ...cleanDetails
          };
        });

        // Write day record to subcollection: attendance/{classPlanId}/days/{date}
        const exception = this.getExceptionForSelectedDate(vm);
        const dayRecord: any = {
          date: dateStr,
          classPlanId: filter.classPlanId,
          classId: String(selectedPlan.classId || ''),
          courseId: String(selectedPlan.courseId || ''),
          madrasaId: String(selectedPlan.madrasaId || ''),
          organizationId: String(selectedPlan.organizationId || ''),
          timetableEntryId: timetableEntryId || null,
          activityName: activityName || null,
          status: 'confirmed',
          autoGenerated: false,
          students: studentsArray,
          staff: staffArray,
          notes: filter.notes || null,
          teacherId: profile?.uid || null,
          exception: exception ? {
            type: exception.type,
            reason: exception.reason || null,
            customTypeName: exception.customTypeName || null,
          } : null,
        };

        // 1. Save to subcollection
        await this.attendanceFs.setDay(filter.classPlanId, dayRecord);

        // 2. Also save to top-level collection for legacy/backward compat if matching doc exists
        const constraints: any[] = [
          where('classPlanId', '==', filter.classPlanId),
          where('date', '==', dateStr),
        ];
        if (timetableEntryId) constraints.push(where('timetableEntryId', '==', timetableEntryId));
        const existingDocs = await this.repo.getAllOnce<EntityRecord & any>('attendance', profile, undefined, constraints);
        const matchingDoc = existingDocs.find((doc: any) => {
          if (timetableEntryId) return doc.timetableEntryId === timetableEntryId;
          return !doc.timetableEntryId;
        });

        const legacyPayload = {
          ...dayRecord,
          dateKey: dateStr,
          type: 'class',
          attendanceStatus: 'confirmed',
          studentIds: studentsArray.map(s => s.studentId),
          staffIds: staffArray.map(s => s.staffId),
        };
        if (matchingDoc?.id) {
          await this.repo.update('attendance', String(matchingDoc.id), legacyPayload, profile);
        } else {
          await this.repo.create('attendance', legacyPayload, profile);
        }
      });

      this.snackBar.open('Attendance saved.', 'Close', { duration: 3000 });
    } catch (e: any) {
      console.error('[AttendancePage] Save failed:', e?.message || e);
      this.snackBar.open('Unable to save attendance. Please try again.', 'Close', { duration: 4000 });
    }
  }

  nameOf(rows: EntityRecord[], id: string): string {
    return String(rows.find((row) => row.id === id)?.['name'] ?? id);
  }
}
