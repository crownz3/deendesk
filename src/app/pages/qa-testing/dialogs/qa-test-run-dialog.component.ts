import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QaTestRun } from '../../../core/models/domain.model';

export interface QaTestRunDialogData {
  testRun?: QaTestRun;
}

@Component({
  selector: 'app-qa-test-run-dialog',
  templateUrl: './qa-test-run-dialog.component.html',
  styleUrls: ['./qa-test-run-dialog.component.scss'],
  standalone: false,
})
export class QaTestRunDialogComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<QaTestRunDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QaTestRunDialogData
  ) {}

  ngOnInit(): void {
    this.isEdit = !!this.data?.testRun;
    const tr = this.data?.testRun;

    this.form = this.fb.group({
      title: [tr?.title || 'Release v1.4.0 Test Run', [Validators.required]],
      description: [tr?.description || 'Full regression and new feature sign-off test cycle'],
      targetReleaseDate: [
        tr?.targetReleaseDate || new Date().toISOString().substring(0, 10),
        [Validators.required],
      ],
      status: [tr?.status || 'Active'],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
