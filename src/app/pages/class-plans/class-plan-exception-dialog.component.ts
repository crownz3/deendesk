import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan, ClassPlanException } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { NotificationDispatcherService } from '../../core/services/notification-dispatcher.service';

@Component({
  selector: 'app-class-plan-exception-dialog',
  templateUrl: './class-plan-exception-dialog.component.html',
  standalone: false,
})
export class ClassPlanExceptionDialogComponent {
  form = this.fb.nonNullable.group({
    date: [new Date() as any, Validators.required],
    type: ['specialActivity', Validators.required],
    customTypeName: [''],
    reason: [''],
    rescheduledDate: [null as Date | null],
    rescheduledStartTime: ['08:00'],
    rescheduledEndTime: ['09:00'],
    enableAttendance: [true],
    affectsAttendance: [false],
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
    { value: 'specialActivity', label: 'Special Activity / Event' },
    { value: 'exam', label: 'Exam / Evaluation Day' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'suddenLeave', label: 'Sudden Leave' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rescheduled', label: 'Rescheduled' },
    { value: 'extraClass', label: 'Extra Class' },
    { value: 'custom', label: '+ Add Custom Exception Type...' },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly notifier: NotificationDispatcherService,
    public readonly dialogRef: MatDialogRef<ClassPlanExceptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: ClassPlan; exception?: ClassPlanException }
  ) {
    if (this.data.plan.startDate) {
      this.minDate = new Date(this.data.plan.startDate);
    }
    if (this.data.plan.endDate) {
      this.maxDate = new Date(this.data.plan.endDate);
    }

    if (this.data.exception) {
      const ex = this.data.exception;
      const exceptionDate = ex.date ? new Date(ex.date + 'T00:00:00') : new Date();
      const rescheduledDate = ex.rescheduledDate ? new Date(ex.rescheduledDate + 'T00:00:00') : null;
      const isAttendanceEnabled = ex.enableAttendance !== undefined 
        ? !!ex.enableAttendance 
        : !['holiday', 'cancelled', 'suddenLeave'].includes(ex.type);

      this.form.patchValue({
        date: exceptionDate,
        type: ex.type || 'specialActivity',
        customTypeName: ex.customTypeName || '',
        reason: ex.reason || '',
        rescheduledDate,
        rescheduledStartTime: ex.rescheduledStartTime || '08:00',
        rescheduledEndTime: ex.rescheduledEndTime || '09:00',
        enableAttendance: isAttendanceEnabled,
        affectsAttendance: !isAttendanceEnabled
      });
    }

    // Auto-update enableAttendance when type changes
    this.form.get('type')?.valueChanges.subscribe(typeVal => {
      if (['holiday', 'cancelled', 'suddenLeave'].includes(typeVal)) {
        this.form.patchValue({ enableAttendance: false, affectsAttendance: true });
      } else {
        this.form.patchValue({ enableAttendance: true, affectsAttendance: false });
      }
    });
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();

    if (val.type === 'custom' && !val.customTypeName.trim()) {
      this.snackBar.open('Please enter a custom type name.', 'Close', { duration: 3000 });
      return;
    }
    
    const profile = await firstValueFrom(this.auth.profile$);

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

    const isEnableAttendance = !!val.enableAttendance;

    const payload: Partial<ClassPlanException> = {
      organizationId: this.data.plan.organizationId,
      madrasaId: this.data.plan.madrasaId,
      classPlanId: this.data.plan.id!,
      classId: this.data.plan.classId,
      className: this.data.plan.className,
      date: dateStr,
      type: val.type as any,
      customTypeName: val.type === 'custom' ? val.customTypeName.trim() : undefined,
      reason: val.reason,
      originalStartTime: '00:00',
      originalEndTime: '00:00',
      rescheduledDate: val.type === 'rescheduled' ? rescheduledDateStr : null,
      ...(val.type === 'rescheduled' ? {
        rescheduledStartTime: val.rescheduledStartTime,
        rescheduledEndTime: val.rescheduledEndTime,
      } : {}),
      enableAttendance: isEnableAttendance,
      affectsAttendance: !isEnableAttendance,
      createdByName: profile?.displayName,
    };

    try {
      if (this.data.exception?.id) {
        await this.repo.update('classPlanExceptions', this.data.exception.id, payload as any, profile);
        this.snackBar.open('Exception updated successfully.', 'Close', { duration: 3000 });
      } else {
        await this.repo.create('classPlanExceptions', payload as any, profile);
        this.snackBar.open('Exception added successfully.', 'Close', { duration: 3000 });
      }

      // Notify assigned staff & students for this plan
      const targetGroupIds = Array.isArray(this.data.plan.groupIds) ? this.data.plan.groupIds : (this.data.plan.groupId ? [this.data.plan.groupId] : []);
      const groups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile);
      const recipientSet = new Set<string>();
      groups
        .filter(g => targetGroupIds.includes(String(g.id)))
        .forEach(g => {
          (g['assignedStaffIds'] || []).forEach((id: any) => recipientSet.add(String(id)));
        });

      if (profile?.uid) recipientSet.delete(profile.uid);

      await this.notifier.notifyExceptionSaved(this.data.plan, payload as ClassPlanException, Array.from(recipientSet), profile);

      this.dialogRef.close(true);
    } catch (e) {
      this.snackBar.open('Error saving exception.', 'Close', { duration: 3000 });
    }
  }
}
