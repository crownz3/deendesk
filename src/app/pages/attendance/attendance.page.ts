import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, firstValueFrom, of, Subject } from 'rxjs';
import { catchError, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { where } from 'firebase/firestore';
import { AppUser, AttendanceStatus, ClassPlan, ClassPlanException, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { MatDialog } from '@angular/material/dialog';
import { AttendanceHistoryDialogComponent } from '../../shared/components/attendance-history-dialog/attendance-history-dialog.component';
import { QuickAddDialogComponent } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface AttendanceVm {
  profile: AppUser;
  students: EntityRecord[];
  staff: EntityRecord[];
  classPlans: (EntityRecord & ClassPlan)[];
  classPlanExceptions: (EntityRecord & ClassPlanException)[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  timetableEntries: (EntityRecord & TimetableEntry)[];
}

export interface ScheduledDay {
  date: string;
  isException: boolean;
  exceptionType?: string;
  exceptionReason?: string;
  staffNames: string[];
  studentNames: string[];
  currentSession?: EntityRecord & TimetableEntry;
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
  pageIndex = 0;
  pageSize = 10;
  readonly form = this.fb.nonNullable.group({
    madrasaId: [''],
    classPlanId: ['', Validators.required],
    date: [new Date(), Validators.required],
    notes: [''],
  });

  isAttendanceLoaded = false;
  minDate: Date | null = null;
  maxDate: Date | null = null;
  showSchedule = false;

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

  readonly vm$ = this.auth.profile$.pipe(
    switchMap((profile) => {
      if (!profile) return of({ loading: false } as PageState<AttendanceVm>);
      
      return combineLatest({
        profile: of(profile),
        students: this.repo.list<EntityRecord>('users', profile, [], { roles: ['student'] }),
        staff: this.repo.list<EntityRecord>('users', profile, [], { roles: ['teacher', 'staff', 'madrasaIncharge', 'coordinator'] }),
      classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile),
      classPlanExceptions: this.repo.list<EntityRecord & ClassPlanException>('classPlanExceptions', profile),
      madrasas: this.repo.list<EntityRecord>('madrasas', profile),
      courses: this.repo.list<EntityRecord>('courses', profile),
      classes: this.repo.list<EntityRecord>('classes', profile),
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
  ) {}

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
      if (this.isAttendanceLoaded) {
         this.loadExistingAttendance();
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
    const madrasaId = this.form.get('madrasaId')?.value;
    if (this.showMadrasaDropdown(vm.profile.role)) {
      if (!madrasaId) return [];
      return vm.classPlans.filter(p => String(p.madrasaId) === String(madrasaId));
    }
    if (madrasaId) {
       return vm.classPlans.filter(p => String(p.madrasaId) === String(madrasaId));
    }
    return vm.classPlans;
  }

  async onGetAttendance(vm: AttendanceVm) {
    if (!this.form.get('classPlanId')?.value) {
      this.snackBar.open('Please select a class plan first.', 'Close', { duration: 3000 });
      return;
    }
    
    const selectedPlan = vm.classPlans.find(p => p.id === this.form.get('classPlanId')?.value);
    if (selectedPlan) {
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

      const currentDate = this.form.get('date')?.value;
      if (this.minDate && currentDate && currentDate < this.minDate) {
        this.form.patchValue({ date: this.minDate }, { emitEvent: false });
      } else if (this.maxDate && currentDate && currentDate > this.maxDate) {
        this.form.patchValue({ date: this.maxDate }, { emitEvent: false });
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
      const existing = await this.repo.getAllOnce<EntityRecord & any>('attendance', profile, undefined, [
        where('classPlanId', '==', filter.classPlanId),
        where('date', '==', dateStr)
      ]);

      const newSelections: Record<string, AttendanceStatus> = {};
      const newDetails: Record<string, any> = {};

      for (const record of existing) {
        if (record.type === 'class' && record.students) {
          for (const s of record.students) {
            if (s.studentId) {
              newSelections[s.studentId] = s.status;
              newDetails[s.studentId] = s;
            }
          }
          if (record.staff) {
            for (const st of record.staff) {
              if (st.staffId) {
                newSelections[st.staffId] = st.status;
                newDetails[st.staffId] = st;
              }
            }
          }
        } else if (record.studentId) {
          newSelections[record.studentId] = record.status;
          newDetails[record.studentId] = record;
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

    return vm.students.filter((student) => 
      selectedPlan.studentIds?.includes(String(student.id)) ||
      (!selectedPlan.studentIds?.length && student['classId'] === selectedPlan.classId)
    );
  }

  searchedStudents(vm: AttendanceVm): EntityRecord[] {
    const students = this.filteredStudents(vm);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      return students.filter(s => String(s['name'] || '').toLowerCase().includes(q));
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

  filteredStaff(vm: AttendanceVm): EntityRecord[] {
    const filter = this.form.getRawValue();
    if (!filter.classPlanId) return [];

    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    if (!selectedPlan) return [];

    const classData = vm.classes.find(c => String(c.id) === selectedPlan.classId);

    const staffIds = new Set<string>();
    if (selectedPlan.assignedStaffIds) {
      selectedPlan.assignedStaffIds.forEach(id => staffIds.add(id));
    }
    if (classData && Array.isArray(classData['teacherIds'])) {
      classData['teacherIds'].forEach(id => staffIds.add(String(id)));
    }
    
    if (vm.profile.role === 'teacher' || vm.profile.role === 'coordinator' || vm.profile.role === 'madrasaIncharge') {
       staffIds.add(vm.profile.uid);
    }

    const staff = vm.staff.filter((s) => staffIds.has(String(s.id)));
    return staff;
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

    const [sYear, sMonth, sDay] = plan.startDate.split('T')[0].split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay);
    
    let end: Date;
    if (plan.endDate) {
      const [eYear, eMonth, eDay] = plan.endDate.split('T')[0].split('-').map(Number);
      end = new Date(eYear, eMonth - 1, eDay);
    } else {
      if (plan.scheduleType === 'oneTime') {
        end = new Date(start);
      } else {
        end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
      }
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    let curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 365) {
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
    
    return {
      date: dateStr,
      isException: !!ex,
      exceptionType: ex?.type,
      exceptionReason: ex?.reason,
      staffNames: plan.assignedStaffNames || [],
      studentNames: plan.studentNames || [],
      currentSession
    };
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

  viewHistory(student: EntityRecord): void {
    this.dialog.open(AttendanceHistoryDialogComponent, {
      width: '500px',
      data: {
        title: `Attendance History for ${student['name']}`,
        studentId: String(student.id)
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
    const allParticipants = [...staff, ...students];

    if (allParticipants.length === 0) {
      this.snackBar.open('No participants found for the selected filter.', 'Close', { duration: 3000 });
      return;
    }

    const selectedPlan = vm.classPlans.find(p => p.id === filter.classPlanId);
    const dateStr = this.getFormattedDate();

    try {
      await this.loader.withLoader('Saving attendance...', async () => {
        await this.repo.batchCreate('attendance', allParticipants.map((participant) => {
          const details = this.attendanceDetails[String(participant.id)] || {};
          return {
            date: dateStr,
            organizationId: participant.organizationId || selectedPlan?.organizationId,
            madrasaId: String(participant.madrasaId || selectedPlan?.madrasaId || ''),
            courseId: String(participant['courseId'] || selectedPlan?.courseId || ''),
            classId: String(participant['classId'] || selectedPlan?.classId || ''),
            classPlanId: filter.classPlanId,
            studentId: String(participant.id),
            teacherId: profile?.uid,
            status: this.selections[String(participant.id)] || 'present',
            notes: filter.notes,
            ...details
          };
        }), profile ?? null);
      });

      this.snackBar.open('Attendance saved.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Unable to save attendance. Please try again.', 'Close', { duration: 4000 });
    }
  }

  nameOf(rows: EntityRecord[], id: string): string {
    return String(rows.find((row) => row.id === id)?.['name'] ?? id);
  }
}
