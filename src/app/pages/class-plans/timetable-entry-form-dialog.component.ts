import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { ClassPlan, TimetableEntry } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { ClassPlanTimetableCopyDialogComponent } from './class-plan-timetable-copy-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-timetable-entry-form-dialog',
  templateUrl: './timetable-entry-form-dialog.component.html',
  styleUrls: ['./timetable-entry-form-dialog.component.scss'],
  standalone: false,
})
export class TimetableEntryFormDialogComponent implements OnInit {
  form = this.fb.nonNullable.group({
    activityName: ['', Validators.required],
    hifzSessionType: ['sabak' as 'sabak' | 'sabki' | 'manzil' | 'custom'],
    dayOfWeek: ['Monday', Validators.required],
    startTime: ['09:00'],
    endTime: ['10:00'],
    teacherId: [''],
    subjectId: [''],
    roomId: [''],
    description: [''],
    bookName: [''],
    lessonName: [''],
    startPage: [null as number | null],
    endPage: [null as number | null],
    dailyTargetPages: [null as number | null],
    unitType: ['pages' as 'pages' | 'hadith' | 'lessons' | 'paras' | 'chapters'],
    status: ['active']
  });

  isHifzCourse = false;

  daysOfWeek: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  get activitySuggestions(): { icon: string; name: string }[] {
    if (this.isHifzCourse) {
      return [
        { icon: 'menu_book', name: 'Sabak (New Lesson)' },
        { icon: 'history_edu', name: 'Sabki (Recent Revision)' },
        { icon: 'auto_stories', name: 'Manzil (Old Revision)' },
        { icon: 'record_voice_over', name: 'Tajweed & Qira\'at' },
        { icon: 'local_library', name: 'Tafseer' },
        { icon: 'groups', name: 'Tarbiyah & Etiquette' },
        { icon: 'cleaning_services', name: 'Cleaning & Hygiene' },
        { icon: 'restaurant', name: 'Lunch & Break' },
        { icon: 'mosque', name: 'Prayer / Namaz' },
        { icon: 'campaign', name: 'Assembly' }
      ];
    }
    return [
      { icon: 'menu_book', name: 'Quran Recitation' },
      { icon: 'local_library', name: 'Tafseer' },
      { icon: 'gavel', name: 'Fiqh & Islamic Law' },
      { icon: 'book', name: 'Hadith' },
      { icon: 'language', name: 'Arabic Language' },
      { icon: 'history', name: 'Seerah & Islamic History' },
      { icon: 'groups', name: 'Tarbiyah & Character' },
      { icon: 'cleaning_services', name: 'Cleaning & Hygiene' },
      { icon: 'restaurant', name: 'Lunch & Break' },
      { icon: 'mosque', name: 'Prayer / Namaz' },
      { icon: 'campaign', name: 'Assembly' }
    ];
  }



  staff: EntityRecord[] = [];
  subjects: EntityRecord[] = [];
  existingEntries: TimetableEntry[] = [];
  pendingEntries: Partial<TimetableEntry>[] = [];
  entriesToDelete: string[] = [];
  
  editingPendingIndex: number | null = null;
  overlapWarning: string | null = null;
  
  preview$: Observable<Partial<TimetableEntry> & { teacherName?: string, subjectName?: string }>;

  get currentDayExistingEntries() {
    const day = this.form.get('dayOfWeek')?.value;
    return this.existingEntries.filter(e => e.dayOfWeek === day && e.id !== this.data.entry?.id);
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    public readonly dialogRef: MatDialogRef<TimetableEntryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: ClassPlan; entry?: TimetableEntry; dayOfWeek?: string; existingEntries?: TimetableEntry[]; scheduleType?: 'period' | 'fullDay' }
  ) {
    this.existingEntries = data.existingEntries || [];
    
    if (this.data.scheduleType !== 'fullDay') {
      this.form.controls.startTime.setValidators([Validators.required]);
      this.form.controls.endTime.setValidators([Validators.required]);
    } else {
      this.form.controls.startTime.setValue('');
      this.form.controls.endTime.setValue('');
    }
    
    this.preview$ = this.form.valueChanges.pipe(
      startWith(this.form.value),
      map(val => {
        const teacher = this.staff.find(s => s['userId'] === val.teacherId || s.id === val.teacherId);
        const subject = this.subjects.find(s => s.id === val.subjectId);
        
        return {
          ...val,
          dayOfWeek: val.dayOfWeek as any,
          status: val.status as any,
          scheduleType: this.data.scheduleType || 'period',
          teacherName: teacher ? (teacher['displayName'] as string || teacher['name'] as string) : undefined,
          subjectName: subject ? (subject['name'] as string) : undefined
        };
      })
    );
  }

  hasSubjects = false;
  selectedDays: string[] = ['Monday'];

  isDaySelected(day: string): boolean {
    return this.selectedDays.includes(day);
  }

  isDayDisabled(day: string): boolean {
    const val = this.form.getRawValue();
    if (this.data.scheduleType === 'fullDay') {
      const hasExistingFullDay = this.existingEntries.some(e => e.dayOfWeek === day && e.id !== this.data.entry?.id);
      const hasPendingFullDay = this.pendingEntries.some((e, idx) => e.dayOfWeek === day && idx !== this.editingPendingIndex);
      return hasExistingFullDay || hasPendingFullDay;
    }

    const activityNameLower = String(val.activityName || '').trim().toLowerCase();
    const hifzType = val.hifzSessionType;

    // 1. Disable day if the SAME period/activity name or Hifz session type is already added on this day
    const hasSameActivityInExisting = this.existingEntries.some(e => {
      if (e.dayOfWeek !== day) return false;
      if (e.id && e.id === this.data.entry?.id) return false;
      
      const existingName = String(e.activityName || '').trim().toLowerCase();
      if (activityNameLower && existingName === activityNameLower) return true;
      if (hifzType && this.isHifzCourse && e.hifzSessionType === hifzType) return true;
      return false;
    });

    if (hasSameActivityInExisting) return true;

    const hasSameActivityInPending = this.pendingEntries.some((e, idx) => {
      if (idx === this.editingPendingIndex) return false;
      if (e.dayOfWeek !== day) return false;

      const existingName = String(e.activityName || '').trim().toLowerCase();
      if (activityNameLower && existingName === activityNameLower) return true;
      if (hifzType && this.isHifzCourse && e.hifzSessionType === hifzType) return true;
      return false;
    });

    if (hasSameActivityInPending) return true;

    // 2. Disable day if there is a strict time slot overlap
    if (val.startTime && val.endTime && val.startTime < val.endTime) {
      const isOverlappingInExisting = this.existingEntries.some(e => {
        if (e.dayOfWeek !== day) return false;
        if (e.id && e.id === this.data.entry?.id) return false;
        if (!e.startTime || !e.endTime) return false;
        return (val.startTime < e.endTime && val.endTime > e.startTime);
      });

      if (isOverlappingInExisting) return true;

      const isOverlappingInPending = this.pendingEntries.some((e, idx) => {
        if (idx === this.editingPendingIndex) return false;
        if (e.dayOfWeek !== day) return false;
        if (!e.startTime || !e.endTime) return false;
        return (val.startTime < e.endTime && val.endTime > e.startTime);
      });

      if (isOverlappingInPending) return true;
    }

    return false;
  }

  getDayDisabledReason(day: string): string {
    const val = this.form.getRawValue();
    const activityNameLower = String(val.activityName || '').trim().toLowerCase();
    const hifzType = val.hifzSessionType;

    const existingSameName = [...this.existingEntries, ...this.pendingEntries].find(e => {
      if (e.dayOfWeek !== day) return false;
      if (e.id && e.id === this.data.entry?.id) return false;
      const existingName = String(e.activityName || '').trim().toLowerCase();
      if (activityNameLower && existingName === activityNameLower) return true;
      if (hifzType && this.isHifzCourse && e.hifzSessionType === hifzType) return true;
      return false;
    });

    if (existingSameName) {
      return `${day} already has "${existingSameName.activityName}" scheduled.`;
    }

    if (val.startTime && val.endTime && val.startTime < val.endTime) {
      const overlapping = [...this.existingEntries, ...this.pendingEntries].find(e => {
        if (e.dayOfWeek !== day) return false;
        if (e.id && e.id === this.data.entry?.id) return false;
        if (!e.startTime || !e.endTime) return false;
        return (val.startTime < e.endTime && val.endTime > e.startTime);
      });

      if (overlapping) {
        return `${day} already has an activity (${overlapping.activityName}) at ${overlapping.startTime} - ${overlapping.endTime}.`;
      }
    }

    return `${day} is unavailable.`;
  }

  get disabledDaysCount(): number {
    return this.daysOfWeek.filter(d => this.isDayDisabled(d)).length;
  }

  toggleDaySelection(day: string): void {
    if (this.isDayDisabled(day)) return;
    if (this.selectedDays.includes(day)) {
      if (this.selectedDays.length > 1) {
        this.selectedDays = this.selectedDays.filter(d => d !== day);
      }
    } else {
      this.selectedDays = [...this.selectedDays, day];
    }
    if (this.selectedDays.length > 0) {
      this.form.patchValue({ dayOfWeek: this.selectedDays[0] });
    }
  }

  selectAllDays(type: 'weekdays' | 'sixDays' | 'all' | 'none'): void {
    let candidateDays: string[] = [];
    if (type === 'weekdays') {
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      candidateDays = this.daysOfWeek.filter(d => weekdays.includes(d));
    } else if (type === 'sixDays') {
      const sixDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      candidateDays = this.daysOfWeek.filter(d => sixDays.includes(d));
    } else if (type === 'all') {
      candidateDays = [...this.daysOfWeek];
    } else {
      candidateDays = this.daysOfWeek.length > 0 ? [this.daysOfWeek[0]] : ['Monday'];
    }

    this.selectedDays = candidateDays.filter(d => !this.isDayDisabled(d));

    if (this.selectedDays.length === 0) {
      const available = this.daysOfWeek.filter(d => !this.isDayDisabled(d));
      if (available.length > 0) {
        this.selectedDays = [available[0]];
      }
    }

    if (this.selectedDays.length > 0) {
      this.form.patchValue({ dayOfWeek: this.selectedDays[0] });
    }
  }

  async ngOnInit() {
    const plan = this.data.plan;
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (plan) {
      if (plan.scheduleType === 'weekly' && Array.isArray(plan.weekDays) && plan.weekDays.length > 0) {
        const activePlanDays = plan.weekDays.map(d => String(d).toLowerCase());
        this.daysOfWeek = allDays.filter(day => activePlanDays.includes(day.toLowerCase()));
      } else if (plan.scheduleType === 'oneTime' && plan.startDate) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        try {
          const date = new Date(plan.startDate);
          this.daysOfWeek = [dayNames[date.getDay()]];
        } catch {
          this.daysOfWeek = [...allDays];
        }
      } else {
        this.daysOfWeek = [...allDays];
      }
    }
    if (this.daysOfWeek.length === 0) {
      this.daysOfWeek = [...allDays];
    }

    const profile = await firstValueFrom(this.auth.profile$);
    if (profile) {
      const courses = await this.repo.getAllOnce('courses', profile);
      const planCourse = courses.find(c => c.id === this.data.plan?.courseId);
      this.hasSubjects = !!planCourse && (planCourse['hasSubjects'] === true || planCourse['hasSubjects'] === 'true' || planCourse['hasSubjects'] === 1);

      const courseType = String(this.data.plan?.courseType || planCourse?.['type'] || '').toLowerCase();
      const planTitle = String(this.data.plan?.title || '').toLowerCase();
      const courseName = String(planCourse?.['name'] || '').toLowerCase();

      this.isHifzCourse = courseType === 'hifz' || planTitle.includes('hifz') || courseName.includes('hifz');

      this.staff = await this.repo.getAllOnce('staff', profile);
      if (this.data.plan.madrasaId) {
        this.staff = this.staff.filter(s => s.madrasaId === this.data.plan.madrasaId || (s['madrasaIds'] as string[])?.includes(this.data.plan.madrasaId!));
      }
      
      this.subjects = await this.repo.getAllOnce('subjects', profile);
      const planSubjIds = Array.isArray(this.data.plan?.subjectIds) && this.data.plan.subjectIds.length > 0
        ? this.data.plan.subjectIds
        : (this.data.plan?.subjectId ? [this.data.plan.subjectId] : []);

      if (planSubjIds.length > 0) {
        this.subjects = this.subjects.filter(s => planSubjIds.includes(String(s.id)));
      } else if (this.data.plan?.courseId) {
        this.subjects = this.subjects.filter(s => s['courseId'] === this.data.plan.courseId);
      }
    }

    if (this.data.entry) {
      this.form.patchValue(this.data.entry);
      this.selectedDays = [this.data.entry.dayOfWeek || this.daysOfWeek[0] || 'Monday'];
    } else {
      const patch: any = {};
      if (this.data.dayOfWeek && this.daysOfWeek.includes(this.data.dayOfWeek)) {
        patch.dayOfWeek = this.data.dayOfWeek;
        this.selectedDays = [this.data.dayOfWeek];
      } else {
        this.selectedDays = [...this.daysOfWeek];
        if (this.selectedDays.length > 0) {
          patch.dayOfWeek = this.selectedDays[0];
        }
      }
      if (this.data.plan?.subjectId) patch.subjectId = this.data.plan.subjectId;

      if (this.isHifzCourse) {
        patch.hifzSessionType = 'sabak';
        patch.activityName = 'Sabak (New Lesson)';
      } else {
        const matchingSubj = this.subjects.find(s => s.id === this.data.plan?.subjectId);
        if (matchingSubj?.['name']) {
          patch.activityName = String(matchingSubj['name']);
        } else if (this.data.plan?.title) {
          patch.activityName = this.data.plan.title;
        }
      }
      this.form.patchValue(patch);
    }

    // Subscribe to time changes to check for overlaps
    this.form.valueChanges.subscribe(() => {
      this.checkOverlap();
    });
    this.checkOverlap();
  }

  onHifzSessionTypeChange(type: string): void {
    if (type === 'sabak') {
      this.form.patchValue({ activityName: 'Sabak (New Lesson)' });
    } else if (type === 'sabki') {
      this.form.patchValue({ activityName: 'Sabki (Recent Revision)' });
    } else if (type === 'manzil') {
      this.form.patchValue({ activityName: 'Manzil (Old Revision)' });
    } else if (type === 'custom') {
      this.form.patchValue({ activityName: '' });
    }
  }

  setActivityName(name: string) {
    this.form.patchValue({ activityName: name });
    this.form.get('activityName')?.markAsTouched();
  }

  applyDuration(minutes: number): void {
    const startTimeStr = this.form.value.startTime || '09:00';
    const [hh, mm] = startTimeStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return;

    const startTotalMin = hh * 60 + mm;
    const endTotalMin = (startTotalMin + minutes) % (24 * 60);

    const endHh = String(Math.floor(endTotalMin / 60)).padStart(2, '0');
    const endMm = String(endTotalMin % 60).padStart(2, '0');

    this.form.patchValue({
      startTime: startTimeStr,
      endTime: `${endHh}:${endMm}`
    });
  }

  setQuickStartTime(timeStr: string, defaultDurationMin = 60): void {
    this.form.patchValue({ startTime: timeStr });
    this.applyDuration(defaultDurationMin);
  }

  getInitials(name: unknown): string {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  
  getRoleLabel(role: unknown): string {
    if (!role || typeof role !== 'string') return 'Staff';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }

  getSubjectColor(subjectId: string | unknown): string {
    if (!subjectId || typeof subjectId !== 'string') return '#e0e0e0';
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50'];
    let hash = 0;
    for (let i = 0; i < subjectId.length; i++) {
      hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getStaffById(id: string): any {
    return this.staff.find(s => s['userId'] === id || s.id === id);
  }

  getSubjectById(id: string): any {
    return this.subjects.find(s => s.id === id);
  }

  getIsoTime(timeStr: string | null | undefined): string {
    if (!timeStr) return '2023-01-01T00:00:00';
    if (timeStr.includes('T')) return timeStr;
    const parts = timeStr.split(':');
    const hh = parts[0] || '00';
    const mm = parts[1] || '00';
    return `2023-01-01T${hh}:${mm}:00`;
  }

  onTimeChange(control: 'startTime' | 'endTime', event: any) {
    const val = event.detail.value;
    if (val) {
      let timePart = val;
      if (val.includes('T')) {
        timePart = val.split('T')[1];
      }
      this.form.patchValue({ [control]: timePart.substring(0, 5) });
    }
  }

  checkOverlap() {
    const val = this.form.getRawValue();
    if (!val.dayOfWeek || !val.startTime || !val.endTime || this.data.scheduleType === 'fullDay') {
      this.overlapWarning = null;
      return;
    }

    if (val.startTime >= val.endTime) {
      this.overlapWarning = null; 
      return;
    }

    let overlapping = this.existingEntries.find(e => {
      if (e.dayOfWeek !== val.dayOfWeek) return false;
      if (e.id && e.id === this.data.entry?.id) return false;
      if (!e.startTime || !e.endTime) return false;
      return (val.startTime < e.endTime && val.endTime > e.startTime);
    });

    if (overlapping) {
      this.overlapWarning = `Time overlaps with: ${overlapping.activityName} (${overlapping.startTime} - ${overlapping.endTime})`;
    } else {
      this.overlapWarning = null;
    }
  }

  addPendingEntry() {
    if (this.form.invalid || this.overlapWarning) {
      this.form.markAllAsTouched();
      return false;
    }
    
    const val = this.form.getRawValue();
    
    if (this.data.scheduleType !== 'fullDay' && val.endTime <= val.startTime) {
      this.snackBar.open('End time must be after start time.', 'Close', { duration: 3000 });
      return false;
    }

    const teacher = this.staff.find(s => s.id === val.teacherId || s['userId'] === val.teacherId);
    const subject = this.subjects.find(s => s.id === val.subjectId);

    if (this.editingPendingIndex !== null || this.data.entry?.id) {
      const payload: Partial<TimetableEntry> & { teacherName?: string, subjectName?: string } = {
        ...val,
        classPlanId: this.data.plan.id!,
        organizationId: this.data.plan.organizationId,
        madrasaId: this.data.plan.madrasaId,
        dayOfWeek: val.dayOfWeek as any,
        status: val.status as any,
        scheduleType: this.data.scheduleType || 'period',
        teacherName: teacher ? (teacher['displayName'] as string || teacher['name'] as string) : undefined,
        subjectName: subject ? (subject['name'] as string) : undefined
      };

      if (this.data.entry?.id) {
        payload.id = this.data.entry.id;
      }

      if (this.editingPendingIndex !== null) {
        this.pendingEntries[this.editingPendingIndex] = payload;
        this.editingPendingIndex = null;
      } else {
        this.pendingEntries.push(payload);
      }
    } else {
      const targetDays = this.selectedDays.length > 0 ? this.selectedDays : [val.dayOfWeek || 'Monday'];
      for (const day of targetDays) {
        const payload: Partial<TimetableEntry> & { teacherName?: string, subjectName?: string } = {
          ...val,
          classPlanId: this.data.plan.id!,
          organizationId: this.data.plan.organizationId,
          madrasaId: this.data.plan.madrasaId,
          dayOfWeek: day as any,
          status: val.status as any,
          scheduleType: this.data.scheduleType || 'period',
          teacherName: teacher ? (teacher['displayName'] as string || teacher['name'] as string) : undefined,
          subjectName: subject ? (subject['name'] as string) : undefined
        };
        this.pendingEntries.push(payload);
      }
    }
    
    // Clear form for next entry
    this.form.patchValue({
      activityName: '',
      startTime: val.endTime,
      endTime: '',
      description: ''
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    this.checkOverlap();
    return true;
  }

  deletePendingEntry(index: number) {
    const entry = this.pendingEntries[index];
    const activityName = entry?.activityName || 'this period';
    const day = entry?.dayOfWeek || '';

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Period Activity?',
        message: `Are you sure you want to delete "${activityName}"${day ? ' from ' + day : ''}?`,
        confirmLabel: 'Delete Period',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        const removed = this.pendingEntries.splice(index, 1)[0];
        if (removed?.id) {
          this.entriesToDelete.push(removed.id);
        }
        if (this.editingPendingIndex === index) {
          this.editingPendingIndex = null;
          this.form.reset({ dayOfWeek: this.form.get('dayOfWeek')?.value, status: 'active', startTime: '09:00', endTime: '10:00' });
        } else if (this.editingPendingIndex !== null && this.editingPendingIndex > index) {
          this.editingPendingIndex--;
        }
        this.checkOverlap();
        this.snackBar.open('Period removed.', 'Close', { duration: 2500 });
      }
    });
  }

  editPendingEntry(index: number) {
    const entry = this.pendingEntries[index];
    this.form.patchValue({
      activityName: entry.activityName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      description: entry.description,
      roomId: entry.roomId,
      teacherId: entry.teacherId,
      subjectId: entry.subjectId,
      status: entry.status,
      dayOfWeek: entry.dayOfWeek
    });
    this.editingPendingIndex = index;
    this.checkOverlap();
  }

  async saveAll() {
    // If form is partially filled and valid, add it as a pending entry
    const val = this.form.getRawValue();
    if (val.activityName) {
      const added = this.addPendingEntry();
      if (!added) return; // Stop if invalid or overlap
    }

    if (this.pendingEntries.length === 0 && this.entriesToDelete.length === 0) {
      this.snackBar.open('No activities to save.', 'Close', { duration: 3000 });
      return;
    }

    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) {
      this.snackBar.open('User profile not found. Cannot save.', 'Close', { duration: 3000 });
      return;
    }

    try {
      if (this.entriesToDelete.length > 0) {
        await Promise.all(this.entriesToDelete.map(id => this.repo.remove('timetableEntries', id)));
      }

      // Execute saves sequentially or in Promise.all depending on API limits
      if (this.pendingEntries.length > 0) {
        await Promise.all(this.pendingEntries.map(entry => {
        const cleanPayload = { ...entry } as any;
        delete cleanPayload.teacherName;
        delete cleanPayload.subjectName;

        // Verify required fields
        if (!cleanPayload.classPlanId) throw new Error('Missing classPlanId');
        if (!cleanPayload.organizationId) throw new Error('Missing organizationId');
        if (!cleanPayload.madrasaId) throw new Error('Missing madrasaId');
        if (!cleanPayload.dayOfWeek) throw new Error('Missing dayOfWeek');
        if (!cleanPayload.scheduleType) throw new Error('Missing scheduleType');
        if (!cleanPayload.activityName) throw new Error('Missing activityName');
        if (cleanPayload.scheduleType !== 'fullDay') {
          if (!cleanPayload.startTime || !cleanPayload.endTime) {
            throw new Error('Missing start or end time for period schedule');
          }
        }

        // Clean undefined values to prevent Firestore errors
        Object.keys(cleanPayload).forEach(key => {
          if (cleanPayload[key] === undefined) {
            delete cleanPayload[key];
          }
        });

        // Ensure teacherIds is always populated for querying
        if (cleanPayload.teacherId) {
          cleanPayload.teacherIds = [cleanPayload.teacherId];
        } else {
          cleanPayload.teacherIds = [];
        }

        console.log('Saving timetable entry:', cleanPayload);
        
        if (cleanPayload.id) {
          if (cleanPayload.id.trim() === '') throw new Error('Empty document ID for update');
          return this.repo.update('timetableEntries', cleanPayload.id, cleanPayload, profile);
        } else {
          return this.repo.create('timetableEntries', cleanPayload as any, profile);
        }
      }));
      }
      
      this.snackBar.open('Activities saved successfully.', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (error: any) {
      console.error('Failed to save timetable', error);
      this.snackBar.open(
        error?.message || 'Failed to save timetable.',
        'Close',
        { duration: 8000 }
      );
    }
  }

  openCopyDialog() {
    const dialogRef = this.dialog.open(ClassPlanTimetableCopyDialogComponent, {
      width: '90vw',
      maxWidth: '600px',
      data: {
        plan: this.data.plan,
        targetDay: this.form.get('dayOfWeek')?.value || this.data.dayOfWeek || 'Monday',
        existingEntries: this.existingEntries
      }
    });

    dialogRef.afterClosed().subscribe((result: { toCreate: any[], toDelete: string[] } | null) => {
      if (result && (result.toCreate?.length > 0 || result.toDelete?.length > 0)) {
        if (result.toCreate) {
          this.pendingEntries.push(...result.toCreate);
          this.checkOverlap();
        }
        if (result.toDelete) {
          const newDeletes = result.toDelete.filter(id => !this.entriesToDelete.includes(id));
          this.entriesToDelete.push(...newDeletes);
          // Remove from existingEntries so they don't trigger overlap warnings while pending
          this.existingEntries = this.existingEntries.filter(e => !newDeletes.includes(e.id!));
        }
        
        const msg = `${result.toCreate?.length || 0} activities added to pending list. Please click "Save All" to confirm.`;
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      }
    });
  }
}
