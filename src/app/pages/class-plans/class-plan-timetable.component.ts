import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { TimetableEntryFormDialogComponent } from './timetable-entry-form-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { NameResolverService } from '../../core/services/name-resolver.service';

import { ClassPlanAttendanceService } from '../../core/services/class-plan-attendance.service';

export interface CalendarDay {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isInPlanRange: boolean;
  isUnselectedWeekday: boolean;
  dayOfWeek: string;
  entries: (EntityRecord & TimetableEntry)[];
}

@Component({
  selector: 'app-class-plan-timetable',
  templateUrl: './class-plan-timetable.component.html',
  styleUrls: ['./class-plan-timetable-dialog.component.scss'],
  standalone: false,
})
export class ClassPlanTimetableComponent implements OnInit, OnChanges {
  @Input() plan!: ClassPlan;
  @Input() canManage = false;

  loading = true;
  profile: AppUser | null = null;
  entries: (EntityRecord & TimetableEntry)[] = [];
  
  daysOfWeek: string[] = [];
  readonly ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
  readonly CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  viewMode: 'calendar' | 'grid' = 'calendar';
  globalMode: 'period' | 'fullDay' = 'period';

  currentCalendarDate = new Date();
  calendarDays: CalendarDay[] = [];

  dayModes: Record<string, 'period' | 'fullDay'> = {
    'Monday': 'period',
    'Tuesday': 'period',
    'Wednesday': 'period',
    'Thursday': 'period',
    'Friday': 'period',
    'Saturday': 'period',
    'Sunday': 'period'
  };

  setGlobalMode(mode: 'period' | 'fullDay') {
    this.globalMode = mode;
    this.daysOfWeek.forEach(day => {
      this.setDayMode(day, mode);
    });
  }

  isWeekdaySelected(dayOfWeek: string): boolean {
    if (!this.plan?.weekDays || this.plan.weekDays.length === 0) return true;
    const target = String(dayOfWeek).toLowerCase().trim();
    return this.plan.weekDays.some(w => String(w).toLowerCase().trim() === target);
  }

  constructor(
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly dialog: MatDialog,
    public readonly resolver: NameResolverService,
    private readonly attendanceService: ClassPlanAttendanceService,
  ) {}

  async ngOnInit() {
    this.profile = await firstValueFrom(this.auth.profile$);
    if (this.plan?.id) {
      this.initCalendarDate();
      await this.loadEntries();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['plan'] && !changes['plan'].firstChange && this.plan?.id) {
      this.initCalendarDate();
      this.loadEntries();
    }
  }

  initCalendarDate() {
    if (this.plan?.startDate) {
      const parts = this.plan.startDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        this.currentCalendarDate = new Date(y, m, d);
        return;
      }
    }
    this.currentCalendarDate = new Date();
  }

  async loadEntries() {
    if (!this.profile || !this.plan?.id) return;
    this.loading = true;
    try {
      const allEntries = await this.repo.getAllOnce<EntityRecord & TimetableEntry>('timetableEntries', this.profile);
      const staff = await this.repo.getAllOnce('staff', this.profile);
      const subjects = await this.repo.getAllOnce('subjects', this.profile);
      
      this.entries = allEntries.filter(e => e.classPlanId === this.plan.id).map(e => ({
        ...e,
        teacherName: e.teacherId ? staff.find(s => s['userId'] === e.teacherId || s.id === e.teacherId)?.['displayName'] as string || staff.find(s => s['userId'] === e.teacherId || s.id === e.teacherId)?.['name'] as string : undefined,
        subjectName: e.subjectId ? subjects.find(s => s.id === e.subjectId)?.['name'] as string : undefined
      }));
      
      this.daysOfWeek = [...this.ALL_DAYS];
      
      this.daysOfWeek.forEach(day => {
        const dayEntries = this.getEntriesForDay(day);
        if (dayEntries.some(e => e.scheduleType === 'fullDay')) {
          this.dayModes[day] = 'fullDay';
        } else {
          this.dayModes[day] = 'period';
        }
      });

      this.sortEntries();
      this.buildCalendarDays();
    } catch (e) {
      this.snackBar.open('Error loading timetable.', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  formatYmd(val?: string | null): string | null {
    if (!val) return null;
    const s = String(val).trim();
    if (s.includes('T')) return s.split('T')[0];
    if (s.length >= 10) return s.substring(0, 10);
    return s;
  }

  get formattedPlanRangeLabel(): string {
    if (!this.plan?.startDate) return '';
    const startYmd = this.formatYmd(this.plan.startDate);
    const endYmd = this.formatYmd(this.plan.endDate);
    if (!startYmd) return '';
    const startDateObj = new Date(startYmd + 'T00:00:00');
    const startFormatted = isNaN(startDateObj.getTime()) ? startYmd : startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!endYmd) return `Plan Start: ${startFormatted}`;
    const endDateObj = new Date(endYmd + 'T00:00:00');
    const endFormatted = isNaN(endDateObj.getTime()) ? endYmd : endDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `Plan Range: ${startFormatted} &ndash; ${endFormatted}`;
  }

  buildCalendarDays() {
    if (!this.plan) return;
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const todayStr = new Date().toISOString().split('T')[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const planStartStr = this.formatYmd(this.plan.startDate);
    const planEndStr = this.formatYmd(this.plan.endDate);

    const days: CalendarDay[] = [];

    // 1. Prev Month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(this.createCalendarDayObj(d, false, planStartStr, planEndStr, todayStr, dayNames));
    }

    // 2. Current Month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push(this.createCalendarDayObj(d, true, planStartStr, planEndStr, todayStr, dayNames));
    }

    // 3. Next Month padding
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.createCalendarDayObj(d, false, planStartStr, planEndStr, todayStr, dayNames));
    }

    this.calendarDays = days;
  }

  private createCalendarDayObj(
    date: Date,
    isCurrentMonth: boolean,
    planStartStr: string | null,
    planEndStr: string | null,
    todayStr: string,
    dayNames: string[]
  ): CalendarDay {
    const year = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dateNumStr = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dateNumStr}`;
    const dayOfWeek = dayNames[date.getDay()];

    const isInPlanRange = (!planStartStr || dateStr >= planStartStr) && (!planEndStr || dateStr <= planEndStr);
    const targetDay = dayOfWeek.toLowerCase().trim();
    const isWeekdayActive = this.isWeekdaySelected(dayOfWeek);
    const isUnselectedWeekday = this.plan?.scheduleType === 'weekly' && !isWeekdayActive;

    const entries = this.entries.filter(e => {
      if (e['date'] && e['date'] === dateStr) return true;
      const entryDay = String(e.dayOfWeek || '').toLowerCase().trim();
      if (entryDay && entryDay === targetDay && isInPlanRange && isWeekdayActive) {
        return true;
      }
      return false;
    });

    return {
      date,
      dateStr,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: dateStr === todayStr,
      isInPlanRange,
      isUnselectedWeekday,
      dayOfWeek,
      entries
    };
  }

  get currentMonthYearLabel(): string {
    return this.currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  prevMonth() {
    this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() - 1, 1);
    this.buildCalendarDays();
  }

  nextMonth() {
    this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 1);
    this.buildCalendarDays();
  }

  goToToday() {
    this.currentCalendarDate = new Date();
    this.buildCalendarDays();
  }

  goToPlanStart() {
    this.initCalendarDate();
    this.buildCalendarDays();
  }

  getEntriesForDay(day: string): (EntityRecord & TimetableEntry)[] {
    if (!day) return [];
    const targetDay = String(day).toLowerCase().trim();
    return this.entries.filter(e => String(e.dayOfWeek || '').toLowerCase().trim() === targetDay);
  }

  sortEntries() {
    this.entries.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  async setDayMode(day: string, mode: 'period' | 'fullDay') {
    if (this.dayModes[day] === mode) return;
    const originalMode = this.dayModes[day];
    
    const existingEntries = this.getEntriesForDay(day);
    if (existingEntries.length > 0) {
      const confirmMessage = mode === 'fullDay' 
        ? `This will delete ${existingEntries.length} period(s) on ${day}. Proceed?`
        : `This will delete the full-day activity on ${day}. Proceed?`;
        
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Confirm Deletion',
          message: confirmMessage,
          confirmLabel: 'Delete'
        }
      });
      
      const confirmed = await firstValueFrom(dialogRef.afterClosed());

      if (!confirmed) {
        this.dayModes[day] = mode; 
        setTimeout(() => {
          this.dayModes = { ...this.dayModes, [day]: originalMode };
        }, 10);
        return;
      }
      
      this.loading = true;
      try {
        for (const entry of existingEntries) {
          if (entry.id) await this.repo.remove('timetableEntries', entry.id);
        }
        await this.loadEntries(); 
        
        this.dayModes[day] = mode;
      } catch (err) {
        this.snackBar.open('Error clearing day activities.', 'Close', { duration: 3000 });
        this.loading = false;
        return;
      }
    } else {
      this.dayModes[day] = mode;
    }
  }

  openEntryForm(entry?: TimetableEntry, dayOfWeek?: string, scheduleType?: 'period' | 'fullDay') {
    const dialogRef = this.dialog.open(TimetableEntryFormDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '1200px',
      data: { 
        plan: this.plan, 
        entry, 
        dayOfWeek, 
        existingEntries: this.entries,
        scheduleType: scheduleType || (entry?.scheduleType) || (dayOfWeek ? this.dayModes[dayOfWeek] : 'period')
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadEntries();
        if (this.plan?.id && this.profile) {
          this.attendanceService.resetPlanAttendanceStatus(this.plan.id, this.profile);
        }
      }
    });
  }

  async duplicateEntry(entry: TimetableEntry) {
    if (!this.profile) return;
    
    const newEntry = { ...entry };
    delete newEntry.id;
    
    this.openEntryForm(newEntry);
  }

  async deleteEntry(entry: TimetableEntry) {
    if (!this.profile || !entry.id) return;
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Activity / Period?',
        message: `Are you sure you want to delete "${entry.activityName}" from ${entry.dayOfWeek}? This action cannot be undone.`,
        confirmLabel: 'Delete Period',
        confirmColor: 'warn'
      }
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed) {
      await this.loader.withLoader('Deleting...', async () => {
        await this.repo.remove('timetableEntries', entry.id!);
        await this.loadEntries();
        if (this.plan?.id && this.profile) {
          await this.attendanceService.resetPlanAttendanceStatus(this.plan.id, this.profile);
        }
        this.snackBar.open('Activity deleted successfully.', 'Close', { duration: 3000 });
      });
    }
  }
}
