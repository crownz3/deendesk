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
  dayModes: Record<string, 'period' | 'fullDay'> = {
    'Monday': 'period',
    'Tuesday': 'period',
    'Wednesday': 'period',
    'Thursday': 'period',
    'Friday': 'period',
    'Saturday': 'period',
    'Sunday': 'period'
  };
  
  constructor(
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly dialog: MatDialog,
    public readonly resolver: NameResolverService
  ) {}

  async ngOnInit() {
    this.profile = await firstValueFrom(this.auth.profile$);
    if (this.plan?.id) {
      await this.loadEntries();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['plan'] && !changes['plan'].firstChange && this.plan?.id) {
      this.loadEntries();
    }
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
      
      if (this.plan.scheduleType === 'weekly' && this.plan.weekDays && this.plan.weekDays.length > 0) {
        this.daysOfWeek = this.ALL_DAYS.filter(day => this.plan.weekDays!.includes(day.toLowerCase()));
      } else if (this.plan.scheduleType === 'oneTime' && this.plan.startDate) {
        const date = new Date(this.plan.startDate);
        const dayName = this.ALL_DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Date.getDay() gives 0 for Sunday
        // Actually to be safe let's just use a map
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        this.daysOfWeek = [dayNames[date.getDay()]];
      } else {
        this.daysOfWeek = [...this.ALL_DAYS];
      }
      
      this.daysOfWeek.forEach(day => {
        const dayEntries = this.entries.filter(e => e.dayOfWeek === day);
        if (dayEntries.some(e => e.scheduleType === 'fullDay')) {
          this.dayModes[day] = 'fullDay';
        } else {
          this.dayModes[day] = 'period';
        }
      });

      this.sortEntries();
    } catch (e) {
      this.snackBar.open('Error loading timetable.', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  getEntriesForDay(day: string): (EntityRecord & TimetableEntry)[] {
    return this.entries.filter(e => e.dayOfWeek === day);
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
    
    if (confirm('Are you sure you want to delete this activity?')) {
      await this.loader.withLoader('Deleting...', async () => {
        await this.repo.remove('timetableEntries', entry.id!);
        await this.loadEntries();
        this.snackBar.open('Activity deleted.', 'Close', { duration: 3000 });
      });
    }
  }
}
