import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { TimetableEntryFormDialogComponent } from './timetable-entry-form-dialog.component';

@Component({
  selector: 'app-class-plan-timetable-dialog',
  templateUrl: './class-plan-timetable-dialog.component.html',
  styleUrls: ['./class-plan-timetable-dialog.component.scss'],
  standalone: false,
})
export class ClassPlanTimetableDialogComponent implements OnInit {
  loading = true;
  profile: AppUser | null = null;
  entries: (EntityRecord & TimetableEntry)[] = [];
  
  readonly daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
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
    public readonly dialogRef: MatDialogRef<ClassPlanTimetableDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: ClassPlan; canManage: boolean }
  ) {}

  async ngOnInit() {
    this.profile = await firstValueFrom(this.auth.profile$);
    await this.loadEntries();
  }

  async loadEntries() {
    if (!this.profile) return;
    this.loading = true;
    try {
      const allEntries = await this.repo.getAllOnce<EntityRecord & TimetableEntry>('timetableEntries', this.profile);
      this.entries = allEntries.filter(e => e.classPlanId === this.data.plan.id);
      
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
    
    const existingEntries = this.getEntriesForDay(day);
    if (existingEntries.length > 0) {
      const confirmMessage = mode === 'fullDay' 
        ? `This will delete ${existingEntries.length} period(s) on ${day}. Proceed?`
        : `This will delete the full-day activity on ${day}. Proceed?`;
        
      if (!confirm(confirmMessage)) {
        // Revert UI if cancelled (hacky way, Angular bindings will catch up)
        setTimeout(() => this.dayModes[day] = this.dayModes[day] === 'period' ? 'fullDay' : 'period', 0);
        return;
      }
      
      // Delete existing entries
      this.loading = true;
      try {
        for (const entry of existingEntries) {
          if (entry.id) await this.repo.remove('timetableEntries', entry.id);
        }
        await this.loadEntries(); // Reloads entries and resets UI mode correctly
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
      maxWidth: '1200px', // Optional: to prevent it from getting too large on ultrawide screens
      data: { 
        plan: this.data.plan, 
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
    
    // Open the form but without an ID so it creates a new one, maybe prefill values
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
