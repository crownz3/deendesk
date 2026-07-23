import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AlumniRecord, GraduationStatus, StaffLeavingReason, AppUser } from '../../core/models/domain.model';

@Component({
  selector: 'app-alumni-form-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.record ? 'Edit Alumni Record' : 'Add Alumni / Former Staff Record' }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Record Type</mat-label>
            <mat-select formControlName="personType">
              <mat-option value="student">Past Student / Graduate</mat-option>
              <mat-option value="staff">Former Staff / Relieved Teacher</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Hafiz Muhammad Ali" />
            <mat-error *ngIf="form.get('name')?.hasError('required')">Name is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Gender</mat-label>
            <mat-select formControlName="gender">
              <mat-option value="male">Male</mat-option>
              <mat-option value="female">Female</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Roll No / Employee ID</mat-label>
            <input matInput formControlName="rollNumberOrEmpId" placeholder="e.g. H-2021-04 or EMP-12" />
          </mat-form-field>
        </div>

        <!-- Student Specific Fields -->
        <div *ngIf="form.get('personType')?.value === 'student'">
          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Passed Out / Graduation Year</mat-label>
              <input matInput formControlName="passedOutYear" placeholder="e.g. 2024" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Graduation Status</mat-label>
              <mat-select formControlName="graduationStatus">
                <mat-option value="hifz_completed">Hifz Completed (Hafiz)</mat-option>
                <mat-option value="aalim_graduated">Aalim Course Graduated</mat-option>
                <mat-option value="passed_out">Passed Out</mat-option>
                <mat-option value="discontinued">Discontinued</mat-option>
                <mat-option value="transferred">Transferred</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Last Course Completed</mat-label>
              <input matInput formControlName="lastCourse" placeholder="e.g. Hifz-ul-Quran" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Last Class / Section</mat-label>
              <input matInput formControlName="lastClass" placeholder="e.g. Final Year Hifz" />
            </mat-form-field>
          </div>
        </div>

        <!-- Staff Specific Fields -->
        <div *ngIf="form.get('personType')?.value === 'staff'">
          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Designation / Role Taught</mat-label>
              <input matInput formControlName="designation" placeholder="e.g. Senior Tajweed Ustadh" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Leaving Reason</mat-label>
              <mat-select formControlName="leavingReason">
                <mat-option value="tenure_completed">Tenure Completed</mat-option>
                <mat-option value="resigned">Resigned</mat-option>
                <mat-option value="retired">Retired</mat-option>
                <mat-option value="transferred">Transferred</mat-option>
                <mat-option value="other">Other</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Work Start Date</mat-label>
              <input matInput type="date" formControlName="workStartDate" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Work End Date (Relieved Date)</mat-label>
              <input matInput type="date" formControlName="workEndDate" />
            </mat-form-field>
          </div>
        </div>

        <!-- Current Contact & Location Details -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Current Occupation / Status</mat-label>
            <input matInput formControlName="currentOccupation" placeholder="e.g. Imam at UK Mosque / Higher Studies Madinah" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Contact Phone / Mobile</mat-label>
            <input matInput formControlName="contactNumber" placeholder="e.g. +91 98765 43210" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Current City & Country</mat-label>
            <input matInput formControlName="currentCity" placeholder="e.g. London, UK" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Email Address</mat-label>
            <input matInput formControlName="email" placeholder="e.g. alumni@gmail.com" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Current Full Address</mat-label>
            <textarea matInput formControlName="currentAddress" rows="2" placeholder="Full residential or work address"></textarea>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Achievements & Notes</mat-label>
            <textarea matInput formControlName="notes" rows="2" placeholder="Sanad details, awards, or alumni notes"></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Alumni Record
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
export class AlumniFormDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AlumniFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { record?: AlumniRecord; user: AppUser }
  ) {}

  ngOnInit(): void {
    const r = this.data.record;
    this.form = this.fb.group({
      personType: [r?.personType || 'student', Validators.required],
      name: [r?.name || '', Validators.required],
      gender: [r?.gender || 'male', Validators.required],
      rollNumberOrEmpId: [r?.rollNumberOrEmpId || ''],
      contactNumber: [r?.contactNumber || ''],
      email: [r?.email || ''],
      passedOutYear: [r?.passedOutYear || new Date().getFullYear().toString()],
      graduationStatus: [r?.graduationStatus || 'hifz_completed'],
      lastCourse: [r?.lastCourse || ''],
      lastClass: [r?.lastClass || ''],
      designation: [r?.designation || ''],
      workStartDate: [r?.workStartDate || ''],
      workEndDate: [r?.workEndDate || ''],
      leavingReason: [r?.leavingReason || 'tenure_completed'],
      currentOccupation: [r?.currentOccupation || ''],
      currentAddress: [r?.currentAddress || ''],
      currentCity: [r?.currentCity || ''],
      notes: [r?.notes || ''],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
