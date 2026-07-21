const fs = require('fs');
const path = require('path');

const files = [
  { file: 'staff-relieving-dialog.component.ts', cls: 'StaffRelievingDialogComponent', selector: 'app-staff-relieving-dialog' },
  { file: 'student-course-completion-dialog.component.ts', cls: 'StudentCourseCompletionDialogComponent', selector: 'app-student-course-completion-dialog' },
  { file: 'student-dismissal-dialog.component.ts', cls: 'StudentDismissalDialogComponent', selector: 'app-student-dismissal-dialog' },
  { file: 'student-graduation-dialog.component.ts', cls: 'StudentGraduationDialogComponent', selector: 'app-student-graduation-dialog' },
  { file: 'student-withdrawal-dialog.component.ts', cls: 'StudentWithdrawalDialogComponent', selector: 'app-student-withdrawal-dialog' },
  { file: 'user-archive-dialog.component.ts', cls: 'UserArchiveDialogComponent', selector: 'app-user-archive-dialog' },
  { file: 'user-reactivation-dialog.component.ts', cls: 'UserReactivationDialogComponent', selector: 'app-user-reactivation-dialog' },
  { file: 'user-suspension-dialog.component.ts', cls: 'UserSuspensionDialogComponent', selector: 'app-user-suspension-dialog' },
  { file: 'user-transfer-dialog.component.ts', cls: 'UserTransferDialogComponent', selector: 'app-user-transfer-dialog' }
];

files.forEach(({ file, cls, selector }) => {
  const template = `import { Component, Inject, OnInit } from '@angular/core';
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
  selector: '${selector}',
  templateUrl: './${file.replace('.ts', '.html')}',
  standalone: false
})
export class ${cls} implements OnInit {
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
    public dialogRef: MatDialogRef<${cls}>,
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
`;
  fs.writeFileSync(path.join(__dirname, file), template);
  console.log('Wrote', file);
});
