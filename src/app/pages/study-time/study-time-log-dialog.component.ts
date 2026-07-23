import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppUser, StudyTimeLog, StudyTimeSchedule } from '../../core/models/domain.model';
import { RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-study-time-log-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Record Study Time Supervision Log</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Date</mat-label>
            <input matInput type="date" formControlName="date" />
            <mat-error *ngIf="form.get('date')?.hasError('required')">Date is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Supervision Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="conducted">Conducted Smoothly</mat-option>
              <mat-option value="substituted">Substitute Staff Attended</mat-option>
              <mat-option value="cancelled">Session Cancelled</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>On-Duty Staff Name</mat-label>
            <input matInput formControlName="onDutyStaffName" placeholder="e.g. Ustadh Khalid" />
            <mat-error *ngIf="form.get('onDutyStaffName')?.hasError('required')">Staff name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Substitute Staff Name (If any)</mat-label>
            <input matInput formControlName="substituteStaffName" placeholder="e.g. Ustadh Tariq" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Supervision Notes & Observations</mat-label>
            <textarea matInput formControlName="supervisionNotes" rows="3" placeholder="e.g. Students maintained silence, all 24 students attended night revision"></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Supervision Log
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
export class StudyTimeLogDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StudyTimeLogDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { schedule: StudyTimeSchedule; user: AppUser; defaultStaffName?: string }
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      studyTimeScheduleId: [this.data.schedule.id],
      scheduleTitle: [this.data.schedule.title],
      date: [today, Validators.required],
      onDutyStaffId: [this.data.user.id || ''],
      onDutyStaffName: [this.data.defaultStaffName || this.data.user.displayName || this.data.user.email || '', Validators.required],
      substituteStaffName: [''],
      status: ['conducted', Validators.required],
      presentStudentIds: [[]],
      absentStudentIds: [[]],
      supervisionNotes: [''],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
