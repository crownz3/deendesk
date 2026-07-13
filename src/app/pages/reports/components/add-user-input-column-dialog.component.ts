import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-add-user-input-column-dialog',
  template: `
    <h2 mat-dialog-title>Add Custom Column</h2>
    <mat-dialog-content>
      <p class="text-muted mb-3" style="font-size: 14px; margin-bottom: 16px;">
        Add a custom column to your report. You will be able to manually enter values for each row in this column.
      </p>
      <form [formGroup]="columnForm" class="d-flex flex-column pt-2">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Column Header Name</mat-label>
          <input matInput formControlName="label" placeholder="e.g. Notes, Remarks" required autofocus>
          <mat-hint>The header displayed in the report.</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="columnForm.invalid" (click)="onSave()">Add Column</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .w-100 { width: 100%; }
    .text-muted { color: #6c757d; }
    .mb-3 { margin-bottom: 1rem; }
    .pt-2 { padding-top: 0.5rem; }
    .d-flex { display: flex; }
    .flex-column { flex-direction: column; }
  `],
  standalone: false
})
export class AddUserInputColumnDialogComponent {
  public columnForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddUserInputColumnDialogComponent>
  ) {
    this.columnForm = this.fb.group({
      label: ['', Validators.required]
    });
  }

  onSave() {
    if (this.columnForm.valid) {
      this.dialogRef.close(this.columnForm.value.label.trim());
    }
  }
}
