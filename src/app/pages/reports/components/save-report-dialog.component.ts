import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-save-report-dialog',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Save Report</h2>
    <mat-dialog-content class="mat-typography">
      <form [formGroup]="form" class="mt-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Report Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Missing Genders List">
          <mat-error *ngIf="form.get('name')?.hasError('required')">Name is required</mat-error>
        </mat-form-field>
        
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Description / Purpose (Optional)</mat-label>
          <textarea matInput formControlName="description" rows="3" placeholder="What is this report used for?"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .w-full { width: 100%; }
    .mt-4 { margin-top: 16px; }
  `]
})
export class SaveReportDialogComponent {
  form: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<SaveReportDialogComponent>,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
  }

  save() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
}
