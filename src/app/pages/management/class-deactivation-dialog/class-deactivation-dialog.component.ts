import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord } from '../../../core/services/repository.service';
import { Router } from '@angular/router';

export interface ClassDeactivationData {
  classRecord: EntityRecord;
  counts: {
    students: number;
    staff: number;
    timetables: number;
    attendance: number;
  };
}

export type ClassDeactivationAction = 'view-students' | 'view-staff' | 'transfer-students' | 'transfer-staff' | 'cancel';

@Component({
  selector: 'app-class-deactivation-dialog',
  templateUrl: './class-deactivation-dialog.component.html',
  styleUrls: ['./class-deactivation-dialog.component.scss'],
  standalone: false,
})
export class ClassDeactivationDialogComponent {
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ClassDeactivationData,
    private dialogRef: MatDialogRef<ClassDeactivationDialogComponent, ClassDeactivationAction>,
    private router: Router
  ) {}

  viewStudents() {
    this.dialogRef.close('view-students');
    this.router.navigate(['/students'], {
      queryParams: { classFilter: this.data.classRecord.id }
    });
  }

  viewStaff() {
    this.dialogRef.close('view-staff');
    this.router.navigate(['/staff'], {
      queryParams: { classFilter: this.data.classRecord.id }
    });
  }

  transferStudents() {
    this.dialogRef.close('transfer-students');
  }

  transferStaff() {
    this.dialogRef.close('transfer-staff');
  }

  cancel() {
    this.dialogRef.close('cancel');
  }
}
