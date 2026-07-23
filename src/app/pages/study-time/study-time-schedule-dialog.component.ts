import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppUser, StudyTimeSchedule, StudyDutyType, StudySessionType } from '../../core/models/domain.model';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { StudyTimeService } from '../../core/services/study-time.service';

@Component({
  selector: 'app-study-time-schedule-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.schedule ? 'Edit Study Time Schedule' : 'Create Study Time Schedule' }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Session Title / Name</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Night Mutala'a - Hifz Division" />
            <mat-error *ngIf="form.get('title')?.hasError('required')">Title is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Session Type</mat-label>
            <mat-select formControlName="sessionType">
              <mat-option value="morning">Morning Study</mat-option>
              <mat-option value="evening">Evening Revision</mat-option>
              <mat-option value="night">Night Mutala'a</mat-option>
              <mat-option value="weekend">Weekend Session</mat-option>
              <mat-option value="exam_prep">Exam Prep Study</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Venue / Location</mat-label>
            <input matInput formControlName="venue" placeholder="e.g. Main Prayer Hall / Library B" />
            <mat-error *ngIf="form.get('venue')?.hasError('required')">Venue is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Start Time</mat-label>
            <input matInput type="time" formControlName="startTime" />
            <mat-error *ngIf="form.get('startTime')?.hasError('required')">Start time is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>End Time</mat-label>
            <input matInput type="time" formControlName="endTime" />
            <mat-error *ngIf="form.get('endTime')?.hasError('required')">End time is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Duty Mode (Staff Responsibility)</mat-label>
            <mat-select formControlName="dutyType">
              <mat-option value="single_staff">Single Person Duty (Fixed Staff)</mat-option>
              <mat-option value="turn_duty_roster">Turn Duty Roster (Staff Pool Rotation)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Assigned Staff Member(s)</mat-label>
            <mat-select formControlName="assignedStaffIds" multiple>
              <mat-option *ngFor="let s of staffList" [value]="s.id">
                {{ s.displayName || s.email }}
              </mat-option>
            </mat-select>
            <mat-hint>Select 1 for fixed duty, or multiple staff for automatic turn duty rotation</mat-hint>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes / Instructions</mat-label>
            <textarea matInput formControlName="notes" rows="2" placeholder="Specific guidelines for study time supervision"></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Schedule
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 0 8px; }
    .form-container { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .form-row { display: flex; gap: 12px; }
    .full-width { width: 100%; }
    .half-width { flex: 1; }
  `],
  standalone: false
})
export class StudyTimeScheduleDialogComponent implements OnInit {
  form!: FormGroup;
  staffList: AppUser[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StudyTimeScheduleDialogComponent>,
    private repo: RepositoryService,
    private studyTimeService: StudyTimeService,
    @Inject(MAT_DIALOG_DATA) public data: { schedule?: StudyTimeSchedule; user: AppUser }
  ) {}

  ngOnInit(): void {
    const sch = this.data.schedule;
    this.form = this.fb.group({
      title: [sch?.title || '', Validators.required],
      sessionType: [sch?.sessionType || 'night', Validators.required],
      venue: [sch?.venue || '', Validators.required],
      startTime: [sch?.startTime || '20:00', Validators.required],
      endTime: [sch?.endTime || '21:30', Validators.required],
      dutyType: [sch?.dutyType || 'single_staff', Validators.required],
      assignedStaffIds: [sch?.assignedStaffIds || []],
      status: [sch?.status || 'active'],
      notes: [sch?.notes || ''],
    });

    // Fetch staff list for selection
    this.repo.list<AppUser>('users', this.data.user).subscribe((users: AppUser[]) => {
      this.staffList = users.filter(u => u.role === 'teacher' || u.role === 'madrasaIncharge' || u.role === 'coordinator' || u.role === 'organizationAdmin');
    });
  }

  save(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    
    // Auto generate roster if turn duty
    if (val.dutyType === 'turn_duty_roster' && val.assignedStaffIds && val.assignedStaffIds.length > 0) {
      const selectedStaffObjects = this.staffList
        .filter(s => val.assignedStaffIds.includes(s.id))
        .map(s => ({ id: s.id || '', name: s.displayName || s.email || '' }));
      val.dutyRoster = this.studyTimeService.generateTurnDutyRoster(selectedStaffObjects, 30);
    }
    
    this.dialogRef.close(val);
  }
}
