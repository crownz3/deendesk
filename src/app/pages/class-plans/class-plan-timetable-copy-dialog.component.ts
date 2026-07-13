import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-class-plan-timetable-copy-dialog',
  templateUrl: './class-plan-timetable-copy-dialog.component.html',
  styleUrls: ['./class-plan-timetable-copy-dialog.component.scss'],
  standalone: false,
})
export class ClassPlanTimetableCopyDialogComponent implements OnInit {
  sourceDay: string = '';
  readonly daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  availableEntries: (EntityRecord & TimetableEntry)[] = [];
  selectedEntryIds: Set<string> = new Set();
  
  conflictStrategy: 'replace' | 'merge' | 'skip' = 'replace';
  
  hasTargetConflicts = false;
  targetDayEntries: (EntityRecord & TimetableEntry)[] = [];
  
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<ClassPlanTimetableCopyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      plan: ClassPlan;
      targetDay: string;
      existingEntries: (EntityRecord & TimetableEntry)[];
    },
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar
  ) {
    this.targetDayEntries = this.data.existingEntries.filter(e => e.dayOfWeek === this.data.targetDay);
    this.hasTargetConflicts = this.targetDayEntries.length > 0;
  }

  ngOnInit() {
    // Select the first day that has activities and is not the target day
    const daysWithActivities = this.daysOfWeek.filter(d => 
      d !== this.data.targetDay && this.data.existingEntries.some(e => e.dayOfWeek === d)
    );
    if (daysWithActivities.length > 0) {
      this.sourceDay = daysWithActivities[0];
      this.onSourceDayChange();
    }
  }

  onSourceDayChange() {
    this.availableEntries = this.data.existingEntries
      .filter(e => e.dayOfWeek === this.sourceDay)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      
    this.selectAll();
  }

  toggleSelection(entryId: string) {
    if (this.selectedEntryIds.has(entryId)) {
      this.selectedEntryIds.delete(entryId);
    } else {
      this.selectedEntryIds.add(entryId);
    }
  }

  selectAll() {
    this.selectedEntryIds = new Set(this.availableEntries.map(e => e.id as string));
  }
  
  deselectAll() {
    this.selectedEntryIds.clear();
  }

  async copy() {
    if (this.selectedEntryIds.size === 0) {
      this.snackBar.open('Please select at least one activity to copy.', 'Close', { duration: 3000 });
      return;
    }

    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) return;

    this.saving = true;

    try {
      const selectedEntries = this.availableEntries.filter(e => e.id && this.selectedEntryIds.has(e.id));
      
      const toDelete: string[] = [];
      const toCreate: Partial<TimetableEntry>[] = [];

      // Determine deletes
      if (this.hasTargetConflicts) {
        if (this.conflictStrategy === 'replace') {
          toDelete.push(...this.targetDayEntries.map(e => e.id as string));
        } else if (this.conflictStrategy === 'merge') {
          // Merge: Delete target entries that overlap with ANY selected entry
          for (const existing of this.targetDayEntries) {
            const overlaps = selectedEntries.some(copied => this.isOverlapping(existing, copied));
            if (overlaps && existing.id) {
              toDelete.push(existing.id);
            }
          }
        }
      }

      // Determine creates
      for (const entry of selectedEntries) {
        if (this.hasTargetConflicts && this.conflictStrategy === 'skip') {
          const overlaps = this.targetDayEntries.some(existing => this.isOverlapping(existing, entry));
          if (overlaps) continue; // Skip this one
        }

        // Copy everything except audit/IDs
        const newEntry: Partial<TimetableEntry> & { [key: string]: any } = { ...entry };
        delete newEntry.id;
        delete newEntry.createdAt;
        delete newEntry.updatedAt;
        delete newEntry.createdBy;
        delete newEntry.updatedBy;
        delete newEntry['teacherName'];
        delete newEntry['subjectName'];
        
        newEntry.dayOfWeek = this.data.targetDay as any;
        
        // Clean undefined
        Object.keys(newEntry).forEach(key => {
          if (newEntry[key] === undefined) delete newEntry[key];
        });

        toCreate.push(newEntry as Partial<TimetableEntry>);
      }

      if (toCreate.length === 0 && toDelete.length === 0) {
        this.snackBar.open('No activities were copied (all skipped due to overlaps).', 'Close', { duration: 3000 });
        this.saving = false;
        return;
      }

      // Return the payload back to the entry form dialog so they are added to pending
      this.dialogRef.close({ toCreate, toDelete });

    } catch (err: any) {
      console.error('Copy failed', err);
      this.snackBar.open('Error copying activities: ' + (err.message || 'Unknown error'), 'Close', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }
  
  private isOverlapping(a: TimetableEntry, b: TimetableEntry): boolean {
    if (a.scheduleType === 'fullDay' || b.scheduleType === 'fullDay') return true;
    if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
    
    // a starts before b ends, and a ends after b starts
    return a.startTime < b.endTime && a.endTime > b.startTime;
  }
}
