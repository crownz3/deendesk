import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan, ClassPlanException } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-class-plan-exception-dialog',
  templateUrl: './class-plan-exception-dialog.component.html',
  standalone: false,
})
export class ClassPlanExceptionDialogComponent {
  form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    type: ['holiday', Validators.required],
    reason: [''],
    rescheduledDate: [''],
    rescheduledStartTime: ['08:00'],
    rescheduledEndTime: ['09:00'],
    affectsAttendance: [true],
  });

  readonly types = [
    { value: 'holiday', label: 'Holiday' },
    { value: 'suddenLeave', label: 'Sudden Leave' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rescheduled', label: 'Rescheduled' },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    public readonly dialogRef: MatDialogRef<ClassPlanExceptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: ClassPlan }
  ) {}

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    const profile = await firstValueFrom(this.auth.profile$);
    const val = this.form.getRawValue();

    const payload: Partial<ClassPlanException> = {
      organizationId: this.data.plan.organizationId,
      madrasaId: this.data.plan.madrasaId,
      classPlanId: this.data.plan.id!,
      classId: this.data.plan.classId,
      className: this.data.plan.className,
      date: val.date,
      type: val.type as any,
      reason: val.reason,
      originalStartTime: this.data.plan.startTime,
      originalEndTime: this.data.plan.endTime,
      rescheduledDate: val.type === 'rescheduled' ? val.rescheduledDate : null,
      ...(val.type === 'rescheduled' ? {
        rescheduledStartTime: val.rescheduledStartTime,
        rescheduledEndTime: val.rescheduledEndTime,
      } : {}),
      affectsAttendance: val.affectsAttendance,
      createdByName: profile?.displayName,
    };

    try {
      await this.repo.create('classPlanExceptions', payload as any, profile);
      this.dialogRef.close(true);
      this.snackBar.open('Exception added successfully.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Error saving exception.', 'Close', { duration: 3000 });
    }
  }
}
