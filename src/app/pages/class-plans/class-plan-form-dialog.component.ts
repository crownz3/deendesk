import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-class-plan-form-dialog',
  templateUrl: './class-plan-form-dialog.component.html',
  styleUrls: ['./class-plans.page.scss'], // reuse some styles if needed
  standalone: false,
})
export class ClassPlanFormDialogComponent implements OnInit {
  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    madrasaId: ['', Validators.required],
    courseId: ['', Validators.required],
    classId: ['', Validators.required],
    assignedStaffIds: [[] as string[]],
    studentIds: [[] as string[]],
    scheduleType: ['weekly', Validators.required],
    startDate: [new Date().toISOString().slice(0, 10), Validators.required],
    endDate: [''],
    weekDays: [['monday']],
    selectedDates: [[] as string[]],
    startTime: ['08:00', Validators.required],
    endTime: ['09:00', Validators.required],
    autoGenerateAttendance: [true],
    autoMarkStudentsPresent: [true],
    autoMarkStaffPresent: [true],
    notes: [''],
  });

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  staff: EntityRecord[] = [];
  students: EntityRecord[] = [];

  readonly scheduleTypes = [
    { value: 'oneTime', label: 'One Time' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'customDates', label: 'Custom Dates' },
  ];

  readonly days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  constructor(
    private readonly fb: FormBuilder,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    public readonly dialogRef: MatDialogRef<ClassPlanFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan?: ClassPlan }
  ) {}

  async ngOnInit() {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) return;

    this.madrasas = await this.repo.getAllOnce('madrasas', profile);
    this.courses = await this.repo.getAllOnce('courses', profile);
    this.classes = await this.repo.getAllOnce('classes', profile);
    this.staff = await this.repo.getAllOnce('users', profile, { roles: ['teacher', 'staff'] });
    this.students = await this.repo.getAllOnce('users', profile, { roles: ['student'] });

    if (this.data.plan) {
      this.form.patchValue({
        ...this.data.plan,
        startDate: this.data.plan.startDate.slice(0, 10),
        endDate: this.data.plan.endDate ? this.data.plan.endDate.slice(0, 10) : '',
      });
    } else {
      if (this.madrasas.length > 0) this.form.patchValue({ madrasaId: String(this.madrasas[0].id) });
    }
    
    this.form.get('classId')?.valueChanges.subscribe(classId => {
      if (classId) {
         const classStudents = this.students.filter(s => s['classId'] === classId || (s['classIds'] as string[])?.includes(classId));
         this.form.patchValue({ studentIds: classStudents.map(s => String(s.id)) });
      }
    });
  }

  get filteredCourses() {
    const mId = this.form.value.madrasaId;
    return this.courses.filter(c => !mId || c.madrasaId === mId || !c.madrasaId);
  }

  get filteredClasses() {
    const cId = this.form.value.courseId;
    return this.classes.filter(c => !cId || c['courseId'] === cId);
  }

  get filteredStaff() {
    const mId = this.form.value.madrasaId;
    return this.staff.filter(s => !mId || s.madrasaId === mId || (s['madrasaIds'] as string[])?.includes(mId));
  }

  get filteredStudents() {
    const cId = this.form.value.classId;
    return this.students.filter(s => !cId || s['classId'] === cId || (s['classIds'] as string[])?.includes(cId));
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    const profile = await firstValueFrom(this.auth.profile$);
    const val = this.form.getRawValue();
    const courseName = this.courses.find(c => c.id === val.courseId)?.['name'] || '';
    const className = this.classes.find(c => c.id === val.classId)?.['name'] || '';
    const assignedStaffNames = val.assignedStaffIds.map(id => String(this.staff.find(s => s.id === id)?.['name'] || 'Unknown'));
    const studentNames = val.studentIds.map(id => String(this.students.find(s => s.id === id)?.['name'] || 'Unknown'));

    const payload: Partial<ClassPlan> = {
      title: val.title,
      madrasaId: val.madrasaId,
      courseId: val.courseId,
      courseName: String(courseName),
      classId: val.classId,
      className: String(className),
      assignedStaffIds: val.assignedStaffIds,
      assignedStaffNames,
      studentIds: val.studentIds,
      studentNames,
      scheduleType: val.scheduleType as any,
      startDate: new Date(val.startDate).toISOString(),
      endDate: val.endDate ? new Date(val.endDate).toISOString() : null,
      selectedDates: val.selectedDates,
      weekDays: val.weekDays,
      startTime: val.startTime,
      endTime: val.endTime,
      autoGenerateAttendance: val.autoGenerateAttendance,
      autoMarkStudentsPresent: val.autoMarkStudentsPresent,
      autoMarkStaffPresent: val.autoMarkStaffPresent,
      notes: val.notes,
      organizationId: profile?.organizationId,
      createdByName: profile?.displayName,
    };

    try {
      if (this.data.plan?.id) {
        await this.repo.update('classPlans', this.data.plan.id, payload, profile);
      } else {
        payload.status = 'active';
        await this.repo.create('classPlans', payload as any, profile);
      }
      this.dialogRef.close(true);
      this.snackBar.open('Class Plan saved successfully.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Error saving Class Plan.', 'Close', { duration: 3000 });
    }
  }
}
