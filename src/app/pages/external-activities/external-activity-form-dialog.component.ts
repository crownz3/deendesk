import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ExternalActivity, ExternalActivityType, AppUser } from '../../core/models/domain.model';
import { RepositoryService } from '../../core/services/repository.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-external-activity-form-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.activity ? 'Edit External Activity' : 'Add External Activity' }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" (ngSubmit)="save()" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Person Type</mat-label>
            <mat-select formControlName="personType">
              <mat-option value="student">Student</mat-option>
              <mat-option value="staff">Staff / Teacher</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Person Name</mat-label>
            <input matInput formControlName="personName" placeholder="e.g. Abdullah Ahmad" />
            <mat-error *ngIf="form.get('personName')?.hasError('required')">Name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Roll No / Employee ID</mat-label>
            <input matInput formControlName="personRollOrEmpId" placeholder="e.g. STU-102 or EMP-44" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Activity Type</mat-label>
            <mat-select formControlName="activityType">
              <mat-option value="imam">Imam at Mosque</mat-option>
              <mat-option value="outside_ustadh">Outside Ustadh / Teaching</mat-option>
              <mat-option value="inside_madrasa_service">Inside Madrasa Extra Service</mat-option>
              <mat-option value="part_time_work">Part-time Work</mat-option>
              <mat-option value="community_service">Community / Dawah Service</mat-option>
              <mat-option value="other">Other</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Title / Role Name</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Juma Khateeb & Lead Imam" />
            <mat-error *ngIf="form.get('title')?.hasError('required')">Title is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Organization / Mosque Name</mat-label>
            <input matInput formControlName="organizationName" placeholder="e.g. Masjid Al-Noor" />
            <mat-error *ngIf="form.get('organizationName')?.hasError('required')">Organization/Mosque name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Location / Address</mat-label>
            <input matInput formControlName="location" placeholder="e.g. Main Market, City" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Timing & Duty Details</mat-label>
            <input matInput formControlName="timingDetails" placeholder="e.g. Fridays 12:00 PM - 2:30 PM & Maghrib/Isha daily" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Start Date</mat-label>
            <input matInput type="date" formControlName="startDate" />
            <mat-error *ngIf="form.get('startDate')?.hasError('required')">Start date is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>End Date (Optional)</mat-label>
            <input matInput type="date" formControlName="endDate" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Activity Status</mat-label>
            <mat-select formControlName="activityStatus">
              <mat-option value="active">Active</mat-option>
              <mat-option value="completed">Completed</mat-option>
              <mat-option value="on_hold">On Hold</mat-option>
              <mat-option value="cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Stipend / Allowance Details</mat-label>
            <input matInput formControlName="stipendOrAllowance" placeholder="e.g. Voluntary / Stipend per month" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Supervisor Name</mat-label>
            <input matInput formControlName="supervisorName" placeholder="e.g. Masjid Committee President" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Supervisor Phone</mat-label>
            <input matInput formControlName="supervisorPhone" placeholder="e.g. +91 98765 43210" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes / Remarks</mat-label>
            <textarea matInput formControlName="notes" rows="2" placeholder="Additional details or permissions granted"></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving...' : 'Save Activity' }}
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
export class ExternalActivityFormDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ExternalActivityFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { activity?: ExternalActivity; user: AppUser }
  ) {}

  ngOnInit(): void {
    const act = this.data.activity;
    this.form = this.fb.group({
      personType: [act?.personType || 'student', Validators.required],
      personName: [act?.personName || '', Validators.required],
      personRollOrEmpId: [act?.personRollOrEmpId || ''],
      activityType: [act?.activityType || 'imam', Validators.required],
      title: [act?.title || '', Validators.required],
      organizationName: [act?.organizationName || '', Validators.required],
      location: [act?.location || ''],
      timingDetails: [act?.timingDetails || ''],
      startDate: [act?.startDate || new Date().toISOString().split('T')[0], Validators.required],
      endDate: [act?.endDate || ''],
      activityStatus: [act?.activityStatus || 'active', Validators.required],
      stipendOrAllowance: [act?.stipendOrAllowance || ''],
      supervisorName: [act?.supervisorName || ''],
      supervisorPhone: [act?.supervisorPhone || ''],
      notes: [act?.notes || ''],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
