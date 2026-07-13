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
    date: [new Date() as any, Validators.required],
    type: ['holiday', Validators.required],
    reason: [''],
    rescheduledDate: [null as Date | null],
    rescheduledStartTime: ['08:00'],
    rescheduledEndTime: ['09:00'],
    affectsAttendance: [true],
  });

  minDate: Date | null = null;
  maxDate: Date | null = null;

  dateFilter = (d: Date | null): boolean => {
    if (!d) return true;
    const plan = this.data.plan;
    
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    
    if (plan.scheduleType === 'customDates' && plan.selectedDates?.length) {
      return plan.selectedDates.includes(dateStr);
    }
    
    if (plan.scheduleType === 'weekly' && plan.weekDays?.length) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[d.getDay()];
      return plan.weekDays.includes(dayName);
    }
    
    return true;
  }

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
  ) {
    if (this.data.plan.startDate) {
      this.minDate = new Date(this.data.plan.startDate);
    }
    if (this.data.plan.endDate) {
      this.maxDate = new Date(this.data.plan.endDate);
    }
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    const profile = await firstValueFrom(this.auth.profile$);
    const val = this.form.getRawValue();

    let dateStr: string = '';
    if (val.date instanceof Date) {
      const d = val.date as Date;
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (typeof val.date === 'string') {
      dateStr = val.date;
    }

    let rescheduledDateStr: string | null = null;
    if (val.rescheduledDate instanceof Date) {
      const d = val.rescheduledDate as Date;
      rescheduledDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (typeof val.rescheduledDate === 'string') {
      rescheduledDateStr = val.rescheduledDate;
    }

    const payload: Partial<ClassPlanException> = {
      organizationId: this.data.plan.organizationId,
      madrasaId: this.data.plan.madrasaId,
      classPlanId: this.data.plan.id!,
      classId: this.data.plan.classId,
      className: this.data.plan.className,
      date: dateStr,
      type: val.type as any,
      reason: val.reason,
      originalStartTime: '00:00',
      originalEndTime: '00:00',
      rescheduledDate: val.type === 'rescheduled' ? rescheduledDateStr : null,
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
