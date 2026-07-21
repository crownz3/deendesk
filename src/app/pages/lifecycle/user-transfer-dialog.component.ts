import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LifecycleService } from '../../core/services/lifecycle.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface DialogData {
  user: {
    id?: string;
    uid?: string;
    displayName?: string;
    entityType?: string;
    status?: string;
    role?: string;
    madrasaId?: string;
    courseId?: string;
    classId?: string;
  };
  [key: string]: any;
}

@Component({
  selector: 'app-user-transfer-dialog',
  templateUrl: './user-transfer-dialog.component.html',
  standalone: false
})
export class UserTransferDialogComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  madrasas: any[] = [];
  courses: any[] = [];
  classes: any[] = [];
  reasons: any[] = [];

  constructor(
    private fb: FormBuilder,
    private lifecycleService: LifecycleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<UserTransferDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    if (!this.data) this.data = { user: {} } as DialogData;
    if (!this.data.user) this.data.user = {};
    
    this.form = this.fb.group({
      reason: ['', Validators.required],
      requestedMadrasaId: [''],
      requestedCourseId: [''],
      requestedClassId: [''],
      requestedRole: [''],
      effectiveDate: [new Date(), Validators.required],
      returnDate: [null],
      notes: ['']
    });
  }

  ngOnInit(): void {}

  async submit() {
    this.loading = true;
    setTimeout(() => {
      this.loading = false;
      this.dialogRef.close(true);
    }, 1000);
  }
}
