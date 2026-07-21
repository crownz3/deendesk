import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LifecycleService } from '../../core/services/lifecycle.service';

export interface DialogData {
  user: {
    id?: string;
    displayName?: string;
    entityType?: string;
    status?: string;
    role?: string;
    madrasaId?: string;
    courseId?: string;
    classId?: string;
  };
  madrasas?: any[];
  [key: string]: any;
}

@Component({
  selector: 'app-submit-rejoin-dialog',
  templateUrl: './submit-rejoin-dialog.component.html',
  styleUrls: ['./submit-rejoin-dialog.component.scss'],
  standalone: false
})
export class SubmitRejoinDialogComponent implements OnInit {
  form: FormGroup;
  loading = false;
  madrasas: any[] = [];

  constructor(
    private fb: FormBuilder,
    private lifecycleService: LifecycleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<SubmitRejoinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.madrasas = data.madrasas || [];
    this.form = this.fb.group({
      requestedMadrasaId: ['', Validators.required],
      reasonForReturn: ['', Validators.required],
      requestedStartDate: [new Date(), Validators.required],
      requestedCourseId: [''],
      requestedClassId: [''],
      requestedRole: ['']
    });
  }

  ngOnInit(): void {}

  async submit() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      await this.lifecycleService.submitRejoinRequest({
        userId: this.data.user.id,
        ...this.form.value
      });
      this.snackBar.open('Rejoin request submitted successfully', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to submit request', 'Close', { duration: 4000 });
    } finally {
      this.loading = false;
    }
  }
}
