import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-class-plan-form',
  templateUrl: './class-plan-form.component.html',
  styleUrls: ['./class-plans.page.scss'],
  standalone: false,
})
export class ClassPlanFormComponent implements OnInit {
  @Input() set plan(value: ClassPlan | undefined) {
    this._plan = value;
    if (this.form) {
      this.initForm();
    }
  }
  get plan(): ClassPlan | undefined {
    return this._plan;
  }
  private _plan?: ClassPlan;

  @Output() saveCompleted = new EventEmitter<ClassPlan>();
  @Output() cancel = new EventEmitter<void>();

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    madrasaId: ['', Validators.required],
    courseId: ['', Validators.required],
    classId: ['', Validators.required],
    scheduleType: ['weekly', Validators.required],
    weekDays: [['monday']],
    selectedDates: [[] as string[]],
    startDate: [new Date().toISOString().slice(0, 10) as string | null, Validators.required],
    endDate: [null as string | null, Validators.required],
    autoGenerateAttendance: [true],
    autoMarkStudentsPresent: [true],
    autoMarkStaffPresent: [true],
    notes: [''],
  });

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  
  public _madrasaSearch = '';
  public filteredMadrasas: EntityRecord[] = [];

  get madrasaSearch(): string {
    return this._madrasaSearch;
  }
  
  set madrasaSearch(value: string) {
    this._madrasaSearch = value;
    this.updateFilteredMadrasas();
  }

  private updateFilteredMadrasas() {
    if (!this._madrasaSearch) {
      this.filteredMadrasas = this.madrasas;
      return;
    }
    const q = this._madrasaSearch.toLowerCase();
    this.filteredMadrasas = this.madrasas.filter(m => String(m['name'] || '').toLowerCase().includes(q));
  }
  
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
    private readonly snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) return;

    this.madrasas = await this.repo.getAllOnce('madrasas', profile);
    this.filteredMadrasas = this.madrasas;
    this.courses = await this.repo.getAllOnce('courses', profile);
    this.classes = await this.repo.getAllOnce('classes', profile);

    this.initForm();
  }

  initForm() {
    if (this._plan) {
      this.form.patchValue({
        ...this._plan,
        startDate: this._plan.startDate.slice(0, 10),
        endDate: this._plan.endDate ? this._plan.endDate.slice(0, 10) : '',
      });
      if (this.madrasas.length === 1 && !this.form.value.madrasaId) {
        this.form.patchValue({ madrasaId: String(this.madrasas[0].id) });
      }
    } else {
      this.form.reset({
        scheduleType: 'weekly',
        startDate: new Date().toISOString().slice(0, 10),
        weekDays: ['monday'],
        autoGenerateAttendance: true,
        autoMarkStudentsPresent: true,
        autoMarkStaffPresent: true
      });
      if (this.madrasas.length === 1) {
        this.form.patchValue({ madrasaId: String(this.madrasas[0].id) });
      } else if (this.madrasas.length > 0) {
        this.form.patchValue({ madrasaId: String(this.madrasas[0].id) });
      }
    }

    if (this.madrasas.length === 1) {
      this.form.get('madrasaId')?.disable();
    } else {
      this.form.get('madrasaId')?.enable();
    }
  }

  get filteredCourses() {
    const mId = this.form.value.madrasaId;
    return this.courses.filter(c => !mId || c.madrasaId === mId || !c.madrasaId);
  }

  get filteredClasses() {
    const cId = this.form.value.courseId;
    return this.classes.filter(c => !cId || c['courseId'] === cId);
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

    const payload: Partial<ClassPlan> = {
      title: val.title,
      madrasaId: val.madrasaId,
      courseId: val.courseId,
      courseName: String(courseName),
      classId: val.classId,
      className: String(className),
      scheduleType: val.scheduleType as any,
      startDate: new Date(val.startDate!).toISOString(),
      endDate: val.endDate ? new Date(val.endDate).toISOString() : null,
      selectedDates: val.selectedDates,
      weekDays: val.weekDays,
      autoGenerateAttendance: val.autoGenerateAttendance,
      autoMarkStudentsPresent: val.autoMarkStudentsPresent,
      autoMarkStaffPresent: val.autoMarkStaffPresent,
      notes: val.notes,
      organizationId: profile?.organizationId,
      createdByName: profile?.displayName,
    };

    try {
      let savedPlan: ClassPlan;
      if (this._plan?.id) {
        await this.repo.update('classPlans', this._plan.id, payload, profile);
        savedPlan = { ...this._plan, ...payload } as ClassPlan;
      } else {
        payload.status = 'active';
        const docRef = await this.repo.create('classPlans', payload as any, profile);
        savedPlan = { id: docRef, ...payload } as ClassPlan;
      }
      this.snackBar.open('Class Plan saved successfully.', 'Close', { duration: 3000 });
      this.saveCompleted.emit(savedPlan);
    } catch (e) {
      this.snackBar.open('Error saving Class Plan.', 'Close', { duration: 3000 });
    }
  }
}
