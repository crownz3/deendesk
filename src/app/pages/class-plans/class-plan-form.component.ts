import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { NotificationDispatcherService } from '../../core/services/notification-dispatcher.service';

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
    groupIds: [[] as string[]],
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
    { value: 'yearly', label: 'Yearly Academic Plan' },
    { value: 'monthly', label: 'Monthly Schedule' },
    { value: 'weekly', label: 'Weekly Schedule' },
    { value: 'term', label: 'Term / Semester Plan' },
    { value: 'dateRange', label: 'Date Range' },
    { value: 'oneTime', label: 'One-Time Event' },
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
    private readonly snackBar: MatSnackBar,
    private readonly notifier: NotificationDispatcherService
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
      const initialGroupIds = Array.isArray(this._plan.groupIds) && this._plan.groupIds.length > 0
        ? this._plan.groupIds
        : (this._plan.groupId ? [this._plan.groupId] : []);

      this.form.patchValue({
        ...this._plan,
        groupIds: initialGroupIds,
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
        groupIds: [],
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
    if (!course) return false;
    return course['hasSubjects'] === true || course['hasSubjects'] === 'true' || course['hasSubjects'] === 1;
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

  private safeIsoDate(d: any): string | null {
    if (!d) return null;
    if (d instanceof Date) {
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

    const selectedGroupIds: string[] = Array.isArray(val.groupIds) ? val.groupIds.map(String).filter(Boolean) : (val.groupId ? [String(val.groupId)] : []);
    const selectedGroupNames = selectedGroupIds
      .map(id => this.groups.find(g => g.id === id)?.['name'])
      .filter(Boolean)
      .map(String);

    const primaryGroupId = selectedGroupIds.length > 0 ? selectedGroupIds[0] : (val.groupId || '');
    const primaryGroupName = selectedGroupNames.length > 0 ? selectedGroupNames.join(', ') : '';

    const subjectName = this.subjects.find(s => s.id === val.subjectId)?.['name'] || '';
    const academicPlanName = this.academicPlans.find(p => p.id === val.academicPlanId)?.['name'] || '';

    const startDateIso = this.safeIsoDate(val.startDate) || new Date().toISOString();
    const endDateIso = this.safeIsoDate(val.endDate);

    const rawPayload: Record<string, any> = {
      title: val.title,
      madrasaId: val.madrasaId,
      courseId: val.courseId,
      courseName: String(courseName),
      courseType: val.courseType,
      classId: val.classId,
      className: String(className),
      groupId: primaryGroupId,
      groupName: primaryGroupName,
      groupIds: selectedGroupIds,
      groupNames: selectedGroupNames,
      subjectId: val.subjectId || '',
      subjectName: val.subjectId ? String(subjectName) : '',
      academicPlanId: val.academicPlanId || '',
      academicPlanName: val.academicPlanId ? String(academicPlanName) : '',
      scheduleType: val.scheduleType,
      startDate: startDateIso,
      endDate: endDateIso,
      selectedDates: val.selectedDates || [],
      weekDays: val.weekDays || [],
      autoGenerateAttendance: !!val.autoGenerateAttendance,
      autoMarkStudentsPresent: !!val.autoMarkStudentsPresent,
      autoMarkStaffPresent: !!val.autoMarkStaffPresent,
      notes: val.notes || '',
      organizationId: profile?.organizationId || '',
      createdByName: profile?.displayName || '',
    };

    // Remove any undefined keys to avoid Firestore rejection
    Object.keys(rawPayload).forEach(key => {
      if (rawPayload[key] === undefined) delete rawPayload[key];
    });

    try {
      let savedPlan: ClassPlan;
      if (this._plan?.id) {
        await this.repo.update('classPlans', this._plan.id, rawPayload, profile);
        savedPlan = { ...this._plan, ...rawPayload } as ClassPlan;
      } else {
        rawPayload['status'] = 'active';
        const docRef = await this.repo.create('classPlans', rawPayload, profile);
        savedPlan = { id: docRef, ...rawPayload } as ClassPlan;
      }

      // Collect recipient staff/student user IDs from assigned groups and class
      const recipients = new Set<string>();
      this.groups
        .filter(g => selectedGroupIds.includes(String(g.id)))
        .forEach(g => {
          (g['assignedStaffIds'] || []).forEach((id: any) => recipients.add(String(id)));
        });

      if (profile?.uid) recipients.delete(profile.uid);

      await this.notifier.notifyClassPlanSaved(savedPlan, Array.from(recipients), profile);

      this.snackBar.open('Class Plan saved successfully.', 'Close', { duration: 3000 });
      this.saveCompleted.emit(savedPlan);
    } catch (e: any) {
      console.error('[ClassPlan Save Error]', e);
      this.snackBar.open(`Error saving Class Plan: ${e?.message || e}`, 'Close', { duration: 5000 });
    }
  }
}
