import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { NotificationDispatcherService } from '../../core/services/notification-dispatcher.service';
import { ClassPlanAttendanceService } from '../../core/services/class-plan-attendance.service';

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
    classId: [''],
    classIds: [[] as string[]],
    groupId: [''],
    groupIds: [[] as string[]],
    academicPlanId: [''],
    subjectId: [''],
    subjectIds: [[] as string[]],
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
    private readonly notifier: NotificationDispatcherService,
    private readonly attendanceService: ClassPlanAttendanceService,
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
    this.updateFilteredOptions();
    this.form.valueChanges.subscribe(() => this.updateFilteredOptions());
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
      const initialClassIds = Array.isArray(this._plan.classIds) && this._plan.classIds.length > 0
        ? this._plan.classIds
        : (this._plan.classId ? [this._plan.classId] : []);
      const initialGroupIds = Array.isArray(this._plan.groupIds) && this._plan.groupIds.length > 0
        ? this._plan.groupIds
        : (this._plan.groupId ? [this._plan.groupId] : []);
      const initialSubjectIds = Array.isArray(this._plan.subjectIds) && this._plan.subjectIds.length > 0
        ? this._plan.subjectIds
        : (this._plan.subjectId ? [this._plan.subjectId] : []);

      this.form.patchValue({
        ...this._plan,
        classIds: initialClassIds,
        groupIds: initialGroupIds,
        subjectIds: initialSubjectIds,
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

  filteredCourses: (EntityRecord & { displayName: string })[] = [];
  filteredClasses: EntityRecord[] = [];
  filteredGroups: EntityRecord[] = [];
  filteredSubjects: EntityRecord[] = [];

  updateFilteredOptions(): void {
    const mId = this.form.value.madrasaId;
    const list = this.courses.filter(c => !mId || c.madrasaId === mId || !c.madrasaId);

    const uniqueMap = new Map<string, EntityRecord>();
    for (const c of list) {
      const idKey = String(c.id || c['uid'] || c['docId']);
      if (idKey && !uniqueMap.has(idKey)) {
        uniqueMap.set(idKey, c);
      }
    }
    const uniqueList = Array.from(uniqueMap.values());

    const nameCounts = new Map<string, number>();
    for (const c of uniqueList) {
      const name = String(c['name'] || c['title'] || '').trim();
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }

    this.filteredCourses = uniqueList.map(c => {
      const name = String(c['name'] || c['title'] || '').trim();
      const isDuplicateName = (nameCounts.get(name) || 0) > 1;
      let displayName = name;
      if (isDuplicateName) {
        const extra = c['code'] || c['madrasaName'] || c['type'] || c.id;
        displayName = `${name} (${extra})`;
      }
      return {
        ...c,
        displayName
      } as EntityRecord & { displayName: string };
    });

    const cId = this.form.value.courseId;
    this.filteredClasses = this.classes.filter(c => !cId || c['courseId'] === cId);

    const selectedClassIds: string[] = Array.isArray(this.form.value.classIds) && this.form.value.classIds.length > 0
      ? this.form.value.classIds
      : (this.form.value.classId ? [this.form.value.classId] : []);

    const targetGroups = this.groups.filter(g => {
      if (selectedClassIds.length === 0) return true;
      return selectedClassIds.includes(g['classId']);
    });

    const isMultiClass = selectedClassIds.length > 1;

    this.filteredGroups = targetGroups.map(g => {
      const cls = this.classes.find(c => c.id === g['classId']);
      const clsName = cls ? (cls['name'] as string) : '';
      const groupName = String(g['name'] || '').trim();
      const displayName = isMultiClass && clsName ? `${groupName} (${clsName})` : groupName;
      return {
        ...g,
        displayName
      } as EntityRecord & { displayName: string };
    });

    this.filteredSubjects = this.subjects.filter(s => !cId || s['courseId'] === cId);
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

    const val = this.form.getRawValue();
    const selectedSubjectIds: string[] = Array.isArray(val.subjectIds) && val.subjectIds.length > 0
      ? val.subjectIds.map(String).filter(Boolean)
      : (val.subjectId ? [String(val.subjectId)] : []);
    const selectedSubjectNames = selectedSubjectIds
      .map(id => this.subjects.find(s => s.id === id)?.['name'])
      .filter(Boolean)
      .map(String);

    const primarySubjId = selectedSubjectIds.length > 0 ? selectedSubjectIds[0] : (val.subjectId || '');
    const primarySubjName = selectedSubjectNames.length > 0 ? selectedSubjectNames.join(', ') : '';

    if (this.isSubjectRequired && selectedSubjectIds.length === 0) {
      this.snackBar.open('This Course has subjects enabled. Please select at least one Subject.', 'Close', { duration: 3000 });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    const profile = await firstValueFrom(this.auth.profile$);
    const courseName = this.courses.find(c => c.id === val.courseId)?.['name'] || '';

    const selectedClassIds: string[] = Array.isArray(val.classIds) && val.classIds.length > 0
      ? val.classIds.map(String).filter(Boolean)
      : (val.classId ? [String(val.classId)] : []);
    const selectedClassNames = selectedClassIds
      .map(id => this.classes.find(c => c.id === id)?.['name'])
      .filter(Boolean)
      .map(String);

    const primaryClassId = selectedClassIds.length > 0 ? selectedClassIds[0] : (val.classId || '');
    const primaryClassName = selectedClassNames.length > 0 ? selectedClassNames.join(', ') : (this.classes.find(c => c.id === val.classId)?.['name'] || '');

    if (selectedClassIds.length === 0) {
      this.snackBar.open('Please select at least one Class.', 'Close', { duration: 3000 });
      return;
    }

    const selectedGroupIds: string[] = Array.isArray(val.groupIds) ? val.groupIds.map(String).filter(Boolean) : (val.groupId ? [String(val.groupId)] : []);
    const selectedGroupNames = selectedGroupIds
      .map(id => this.groups.find(g => g.id === id)?.['name'])
      .filter(Boolean)
      .map(String);

    const primaryGroupId = selectedGroupIds.length > 0 ? selectedGroupIds[0] : (val.groupId || '');
    const primaryGroupName = selectedGroupNames.length > 0 ? selectedGroupNames.join(', ') : '';

    const academicPlanName = this.academicPlans.find(p => p.id === val.academicPlanId)?.['name'] || '';

    const startDateIso = this.safeIsoDate(val.startDate) || new Date().toISOString();
    const endDateIso = this.safeIsoDate(val.endDate);

    const rawPayload: Record<string, any> = {
      title: val.title,
      madrasaId: val.madrasaId,
      courseId: val.courseId,
      courseName: String(courseName),
      courseType: val.courseType,
      classId: primaryClassId,
      className: String(primaryClassName),
      classIds: selectedClassIds,
      classNames: selectedClassNames,
      groupId: primaryGroupId,
      groupName: primaryGroupName,
      groupIds: selectedGroupIds,
      groupNames: selectedGroupNames,
      subjectId: primarySubjId,
      subjectName: primarySubjName,
      subjectIds: selectedSubjectIds,
      subjectNames: selectedSubjectNames,
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
        rawPayload['attendanceGenerated'] = false;
        await this.repo.update('classPlans', this._plan.id, rawPayload, profile);
        savedPlan = { ...this._plan, ...rawPayload } as ClassPlan;
      } else {
        rawPayload['status'] = 'active';
        rawPayload['attendanceGenerated'] = false;
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

      // Generate attendance docs for all scheduled days (background — non-blocking)
      if (savedPlan.id && profile) {
        this.attendanceService
          .generateAttendanceForAllDays(savedPlan as ClassPlan & { id: string }, profile as AppUser)
          .then(() => console.log('[ClassPlan] Attendance docs generated for all days.'))
          .catch(err => console.error('[ClassPlan] Attendance generation error:', err));
      }
    } catch (e: any) {
      console.error('[ClassPlan Save Error]', e);
      this.snackBar.open(`Error saving Class Plan: ${e?.message || e}`, 'Close', { duration: 5000 });
    }
  }
}
