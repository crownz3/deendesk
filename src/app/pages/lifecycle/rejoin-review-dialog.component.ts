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
  request?: any;
  history?: any;
  madrasas?: any[];
  classes?: any[];
  courses?: any[];
  [key: string]: any;
}

@Component({
  selector: 'app-rejoin-review-dialog',
  templateUrl: './rejoin-review-dialog.component.html',
  styleUrls: ['./rejoin-review-dialog.component.scss'],
  standalone: false
})
export class RejoinReviewDialogComponent implements OnInit {
  form: FormGroup;
  loading = false;
  madrasas: any[] = [];
  classes: any[] = [];
  courses: any[] = [];

  constructor(
    private fb: FormBuilder,
    private lifecycleService: LifecycleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<RejoinReviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.madrasas = data.madrasas || [];
    this.classes = data.classes || [];
    this.courses = data.courses || [];

    this.form = this.fb.group({
      status: ['approved', Validators.required],
      reviewedMadrasaId: [data.request?.requestedMadrasaId || '', Validators.required],
      reviewedCourseId: [data.request?.requestedCourseId || ''],
      reviewedClassId: [data.request?.requestedClassId || ''],
      reviewedRole: [data.request?.requestedRole || ''],
      approvedStartDate: [data.request?.requestedStartDate || new Date(), Validators.required],
      reviewerNotes: ['']
    });
  }

  ngOnInit(): void {}

  async approve() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      await this.lifecycleService.approveRejoinRequest({
        requestId: this.data.request.id,
        reviewNotes: this.form.value.reviewerNotes
      });
      this.snackBar.open('Rejoin request approved successfully', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e.message || 'Error approving request', 'Close', { duration: 3000 });
      this.loading = false;
    }
  }

  async reject() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      await this.lifecycleService.rejectRejoinRequest({
        requestId: this.data.request.id,
        reviewNotes: this.form.value.reviewerNotes || 'Rejected'
      });
      this.snackBar.open('Rejoin request rejected successfully', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e.message || 'Error rejecting request', 'Close', { duration: 3000 });
      this.loading = false;
    }
  }
}
