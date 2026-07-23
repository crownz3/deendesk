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
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() cancel = new EventEmitter<void>();

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    madrasaId: ['', Validators.required],
    courseId: ['', Validators.required],
    classId: ['', Validators.required],
    groupId: [''],
    academicPlanId: [''],
    subjectId: [''],
    courseType: ['aalim'],
    scheduleType: ['weekly', Validators.required],
    weekDays: [['monday']],
    selectedDates: [[] as string[]],
    startDate: [new Date().toISOString().slice(0, 10) as string | null, Validators.required],
    endDate: [null as string | null],
    autoGenerateAttendance: [true],
    autoMarkStudentsPresent: [true],
    autoMarkStaffPresent: [true],
    notes: [''],
  });

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  groups: EntityRecord[] = [];
  subjects: EntityRecord[] = [];
  academicPlans: EntityRecord[] = [];
  
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
    { value: 'dateRange', label: 'Date Range' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'oneTime', label: 'One Time' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'customDates', label: 'Custom Dates' },
  ];

  readonly courseTypes = [
    { value: 'aalim', label: 'Aalim / Scholar Course' },
    { value: 'hifz', label: 'Hifz / Quran Memorization' },
    { value: 'maktab', label: 'Maktab / Elementary' },
    { value: 'muallim', label: 'Muallim / Teacher Training' },
    { value: 'muballigh', label: 'Muballigh / Da\'wah' },
    { value: 'custom', label: 'Custom / Other' },
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
    this.groups = await this.repo.getAllOnce('classGroups', profile);
    this.subjects = await this.repo.getAllOnce('subjects', profile);
    this.academicPlans = await this.repo.getAllOnce('academicPlans', profile);

    this.initForm();
  }

  private formatDateForInput(d: any): string {
    if (!d) return '';
    try {
      if (typeof d === 'string') return d.slice(0, 10);
      if (d.toDate && typeof d.toDate === 'function') return d.toDate().toISOString().slice(0, 10);
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }

  initForm() {
    if (this._plan) {
      const selectedCourse = this.courses.find(c => c.id === this._plan?.courseId);
      this.form.patchValue({
        ...this._plan,
        courseType: (this._plan.courseType || selectedCourse?.['type'] || 'aalim') as any,
        startDate: this.formatDateForInput(this._plan.startDate),
        endDate: this.formatDateForInput(this._plan.endDate),
      });
      if (this.madrasas.length === 1 && !this.form.value.madrasaId) {
        this.form.patchValue({ madrasaId: String(this.madrasas[0].id) });
      }
    } else {
      this.form.reset({
        scheduleType: 'weekly',
        courseType: 'aalim',
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

  get selectedCourseRecord(): EntityRecord | undefined {
    const cId = this.form.value.courseId;
    return this.courses.find(c => c.id === cId);
  }

  get isSubjectRequired(): boolean {
    const course = this.selectedCourseRecord;
    return !!course && !!course['hasSubjects'];
  }

  get filteredCourses() {
    const mId = this.form.value.madrasaId;
    return this.courses.filter(c => !mId || c.madrasaId === mId || !c.madrasaId);
  }

  get filteredClasses() {
    const cId = this.form.value.courseId;
    return this.classes.filter(c => !cId || c['courseId'] === cId);
  }

  get filteredGroups() {
    const classId = this.form.value.classId;
    return this.groups.filter(g => !classId || g['classId'] === classId);
  }

  get filteredSubjects() {
    const cId = this.form.value.courseId;
    return this.subjects.filter(s => !cId || s['courseId'] === cId);
  }

  onCourseSelectionChange(courseId: string): void {
    const c = this.courses.find(c => c.id === courseId);
    if (c) {
      this.form.patchValue({ courseType: (c['type'] || 'aalim') as any });
    }
  }

  onAcademicPlanChange(planId: string): void {
    const plan = this.academicPlans.find(p => p.id === planId);
    if (plan) {
      const sDate = this.formatDateForInput(plan['startDate']);
      const eDate = this.formatDateForInput(plan['endDate']);
      if (sDate) this.form.patchValue({ startDate: sDate });
      if (eDate) this.form.patchValue({ endDate: eDate });
    }
  }

  async save() {
    if (this.form.value.scheduleType === 'dateRange' && !this.form.value.endDate) {
      this.snackBar.open('End Date is required for Date Range schedule type.', 'Close', { duration: 3000 });
      return;
    }

    if (this.isSubjectRequired && !this.form.value.subjectId) {
      this.snackBar.open('This Course has subjects enabled. Please select a Subject.', 'Close', { duration: 3000 });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    const profile = await firstValueFrom(this.auth.profile$);
    const val = this.form.getRawValue();
    const courseName = this.courses.find(c => c.id === val.courseId)?.['name'] || '';
    const className = this.classes.find(c => c.id === val.classId)?.['name'] || '';
    const groupName = this.groups.find(g => g.id === val.groupId)?.['name'] || '';
    const subjectName = this.subjects.find(s => s.id === val.subjectId)?.['name'] || '';
    const academicPlanName = this.academicPlans.find(p => p.id === val.academicPlanId)?.['name'] || '';

    const payload: Partial<ClassPlan> = {
      title: val.title,
      madrasaId: val.madrasaId,
      courseId: val.courseId,
      courseName: String(courseName),
      courseType: val.courseType as any,
      classId: val.classId,
      className: String(className),
      groupId: val.groupId || undefined,
      groupName: val.groupId ? String(groupName) : undefined,
      subjectId: val.subjectId || undefined,
      subjectName: val.subjectId ? String(subjectName) : undefined,
      academicPlanId: val.academicPlanId || undefined,
      academicPlanName: val.academicPlanId ? String(academicPlanName) : undefined,
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
