import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-timetable-entry-form-dialog',
  templateUrl: './timetable-entry-form-dialog.component.html',
  styleUrls: ['./timetable-entry-form-dialog.component.scss'],
  standalone: false,
})
export class TimetableEntryFormDialogComponent implements OnInit {
  form = this.fb.nonNullable.group({
    activityName: ['', Validators.required],
    dayOfWeek: ['Monday', Validators.required],
    startTime: ['09:00'],
    endTime: ['10:00'],
    teacherId: [''],
    subjectId: [''],
    roomId: [''],
    description: [''],
    status: ['active']
  });

  readonly daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  readonly activitySuggestions = [
    { icon: '🕌', name: 'Quran' },
    { icon: '📖', name: 'Tafseer' },
    { icon: '📚', name: 'Arabic' },
    { icon: '🧒', name: 'Tarbiyah' },
    { icon: '🧹', name: 'Cleaning' },
    { icon: '🍽', name: 'Lunch' },
    { icon: '🕌', name: 'Prayer' },
    { icon: '📢', name: 'Assembly' },
    { icon: '🚌', name: 'Field Trip' }
  ];

  staff: EntityRecord[] = [];
  subjects: EntityRecord[] = [];
  existingEntries: TimetableEntry[] = [];
  
  overlapWarning: string | null = null;
  
  preview$: Observable<Partial<TimetableEntry> & { teacherName?: string, subjectName?: string }>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    public readonly dialogRef: MatDialogRef<TimetableEntryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: ClassPlan; entry?: TimetableEntry; dayOfWeek?: string; existingEntries?: TimetableEntry[]; scheduleType?: 'period' | 'fullDay' }
  ) {
    this.existingEntries = data.existingEntries || [];
    
    if (this.data.scheduleType !== 'fullDay') {
      this.form.controls.startTime.setValidators([Validators.required]);
      this.form.controls.endTime.setValidators([Validators.required]);
    } else {
      this.form.controls.startTime.setValue('');
      this.form.controls.endTime.setValue('');
    }
    
    this.preview$ = this.form.valueChanges.pipe(
      startWith(this.form.value),
      map(val => {
        const teacher = this.staff.find(s => s.id === val.teacherId);
        const subject = this.subjects.find(s => s.id === val.subjectId);
        
        return {
          ...val,
          dayOfWeek: val.dayOfWeek as any,
          status: val.status as any,
          scheduleType: this.data.scheduleType || 'period',
          teacherName: teacher ? (teacher['name'] as string) : undefined,
          subjectName: subject ? (subject['name'] as string) : undefined
        };
      })
    );
  }

  async ngOnInit() {
    const profile = await firstValueFrom(this.auth.profile$);
    if (profile) {
      this.staff = await this.repo.getAllOnce('users', profile, { roles: ['teacher', 'staff'] });
      if (this.data.plan.madrasaId) {
        this.staff = this.staff.filter(s => s.madrasaId === this.data.plan.madrasaId || (s['madrasaIds'] as string[])?.includes(this.data.plan.madrasaId!));
      }
      
      this.subjects = await this.repo.getAllOnce('subjects', profile);
      if (this.data.plan.courseId) {
         this.subjects = this.subjects.filter(s => s['courseId'] === this.data.plan.courseId);
      }
    }

    if (this.data.entry) {
      this.form.patchValue(this.data.entry);
    } else if (this.data.dayOfWeek) {
      this.form.patchValue({ dayOfWeek: this.data.dayOfWeek });
    }

    // Subscribe to time changes to check for overlaps
    this.form.valueChanges.subscribe(() => {
      this.checkOverlap();
    });
    this.checkOverlap();
  }

  setActivityName(name: string) {
    this.form.patchValue({ activityName: name });
    this.form.get('activityName')?.markAsTouched();
  }

  getInitials(name: unknown): string {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  
  getRoleLabel(role: unknown): string {
    if (!role || typeof role !== 'string') return 'Staff';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }

  getSubjectColor(subjectId: string | unknown): string {
    if (!subjectId || typeof subjectId !== 'string') return '#e0e0e0';
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50'];
    let hash = 0;
    for (let i = 0; i < subjectId.length; i++) {
      hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getStaffById(id: string): any {
    return this.staff.find(s => s.id === id);
  }

  getSubjectById(id: string): any {
    return this.subjects.find(s => s.id === id);
  }

  checkOverlap() {
    const val = this.form.getRawValue();
    if (!val.dayOfWeek || !val.startTime || !val.endTime || this.data.scheduleType === 'fullDay') {
      this.overlapWarning = null;
      return;
    }

    if (val.startTime >= val.endTime) {
      this.overlapWarning = null; 
      return;
    }

    const overlapping = this.existingEntries.find(e => {
      if (this.data.entry && e.id === this.data.entry.id) return false;
      if (e.dayOfWeek === val.dayOfWeek) {
        if (!e.startTime || !e.endTime) return false;
        return (val.startTime < e.endTime && val.endTime > e.startTime);
      }
      return false;
    });

    if (overlapping) {
      this.overlapWarning = `Time overlaps with: ${overlapping.activityName} (${overlapping.startTime} - ${overlapping.endTime})`;
    } else {
      this.overlapWarning = null;
    }
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    const val = this.form.getRawValue();
    const profile = await firstValueFrom(this.auth.profile$);
    
    if (this.data.scheduleType !== 'fullDay' && val.endTime <= val.startTime) {
      this.snackBar.open('End time must be after start time.', 'Close', { duration: 3000 });
      return;
    }

    const payload: Partial<TimetableEntry> = {
      ...val,
      classPlanId: this.data.plan.id!,
      organizationId: this.data.plan.organizationId,
      madrasaId: this.data.plan.madrasaId,
      dayOfWeek: val.dayOfWeek as any,
      status: val.status as any,
      scheduleType: this.data.scheduleType || 'period'
    };

    try {
      if (this.data.entry?.id) {
        await this.repo.update('timetableEntries', this.data.entry.id, payload, profile);
      } else {
        await this.repo.create('timetableEntries', payload as any, profile);
      }
      this.dialogRef.close(true);
      this.snackBar.open('Activity saved successfully.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Error saving Activity.', 'Close', { duration: 3000 });
    }
  }
}
