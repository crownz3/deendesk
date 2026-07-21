import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { EventService } from '../../core/services/event.service';
import { AppUser } from '../../core/models/domain.model';

import { map, startWith, take } from 'rxjs/operators';

@Component({
  selector: 'app-event-form-dialog',
  templateUrl: './event-form-dialog.component.html',
  styleUrls: ['./event-form-dialog.component.scss'],
  standalone: false
})
export class EventFormDialogComponent implements OnInit {
  isEdit = false;
  isSaving = false;
  private initialPatchDone = false;

  searchStaff1 = '';
  searchStaff2 = '';
  
  // Data lists
  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  classGroups: EntityRecord[] = [];
  staff: EntityRecord[] = [];
  students: EntityRecord[] = [];
  organizations: EntityRecord[] = [];
  orgMap: { [id: string]: string } = {};
  profile: AppUser | null = null;
  
  filteredCourses: EntityRecord[] = [];
  filteredClasses: EntityRecord[] = [];
  filteredClassGroups: EntityRecord[] = [];
  filteredStudents: EntityRecord[] = [];

  // Forms
  step1Form!: FormGroup;
  step2Form!: FormGroup;
  step3Form!: FormGroup;
  step4Form!: FormGroup;

  eventTypes = [
    { value: 'emergency', label: 'Emergency' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'academic', label: 'Academic' },
    { value: 'religious', label: 'Religious' },
    { value: 'staffMeeting', label: 'Staff Meeting' },
    { value: 'studentProgramme', label: 'Student Programme' },
    { value: 'parentMeeting', label: 'Parent Meeting' },
    { value: 'competition', label: 'Competition' },
    { value: 'awareness', label: 'Awareness' },
    { value: 'annual', label: 'Annual' },
    { value: 'custom', label: 'Custom' }
  ];

  venueLevels = [
    { value: 'organization', label: 'Organization Level' },
    { value: 'madrasa', label: 'Madrasa Level' },
    { value: 'external', label: 'External Location' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly eventService: EventService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<EventFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      event?: any;
      madrasas: EntityRecord[];
      courses: EntityRecord[];
      classes: EntityRecord[];
      classGroups: EntityRecord[];
      staff: EntityRecord[];
      students: EntityRecord[];
      profile: AppUser | null;
    }
  ) {
    this.madrasas = data.madrasas || [];
    this.courses = data.courses || [];
    this.classes = data.classes || [];
    this.classGroups = data.classGroups || [];
    this.staff = data.staff || [];
    this.students = data.students || [];
    this.profile = data.profile;
    this.isEdit = !!data.event;
  }

  ngOnInit(): void {
    this.initForms();
    this.setupAudienceFilters();
    this.fetchOrganizations();
    if (this.isEdit) {
      this.populateForms(this.data.event);
    }
  }

  private initForms(): void {
    this.step1Form = this.fb.group({
      organizationId: [this.profile?.organizationId || '', this.profile?.organizationId ? [] : [Validators.required]],
      name: ['', Validators.required],
      description: [''],
      eventType: ['scheduled', Validators.required],
      customEventType: [''],
      venueLevel: ['madrasa', Validators.required],
      madrasaVenueId: ['', Validators.required],
      customVenueName: [''],
      venueAddress: [''],
      conductorType: ['internal', Validators.required],
      conductorStaffId: [''],
      externalConductorDetails: [''],
      specialGuestDetails: [''],
      chiefGuestDetails: ['']
    });

    this.initialPatchDone = !this.isEdit;

    this.step1Form.get('venueLevel')?.valueChanges.subscribe(val => {
      const madrasaIdCtrl = this.step1Form.get('madrasaVenueId');
      const customNameCtrl = this.step1Form.get('customVenueName');
      const addressCtrl = this.step1Form.get('venueAddress');
      
      if (val === 'madrasa') {
        madrasaIdCtrl?.setValidators([Validators.required]);
        customNameCtrl?.clearValidators();
        addressCtrl?.clearValidators();
      } else if (val === 'external') {
        customNameCtrl?.setValidators([Validators.required]);
        madrasaIdCtrl?.clearValidators();
        addressCtrl?.setValidators([Validators.required]);
      } else {
        madrasaIdCtrl?.clearValidators();
        customNameCtrl?.clearValidators();
        addressCtrl?.clearValidators();
      }

      if (val === 'organization' && this.initialPatchDone) {
        if (this.profile?.organizationId) {
          this.repo.get('organizations', this.profile.organizationId).subscribe(org => {
            if (org && org['address']) {
              addressCtrl?.setValue(org['address']);
              addressCtrl?.updateValueAndValidity();
            }
          });
        }
      }

      madrasaIdCtrl?.updateValueAndValidity();
      customNameCtrl?.updateValueAndValidity();
      addressCtrl?.updateValueAndValidity();
    });

    this.step2Form = this.fb.group({
      startDate: [new Date(), Validators.required],
      startTime: ['09:00', Validators.required],
      endDate: [new Date(), Validators.required],
      endTime: ['17:00', Validators.required],

      allDay: [false],
      instructions: ['']
    }, { validators: this.dateTimeValidator });

    this.step3Form = this.fb.group({
      entireOrganizationParticipation: [false],
      audienceGroups: this.fb.array([]),
      selectedStaffIds: [[]],
      attendanceRequired: [true]
    });

    this.step4Form = this.fb.group({
      staffInChargeId: ['', Validators.required],
      additionalResponsibleStaffIds: [[]],
      estimatedBudget: [0],
      collectedFunds: this.fb.array([]),
      notes: ['']
    });
  }

  get audienceGroups(): import('@angular/forms').FormArray {
    return this.step3Form.get('audienceGroups') as import('@angular/forms').FormArray;
  }

  get collectedFunds(): import('@angular/forms').FormArray {
    return this.step4Form.get('collectedFunds') as import('@angular/forms').FormArray;
  }

  getIsoTime(timeStr: string): string {
    if (!timeStr) {
      const now = new Date();
      return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}T${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:00`;
    }
    const d = new Date();
    const [h, m] = timeStr.split(':');
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}T${h.padStart(2,'0')}:${m.padStart(2,'0')}:00`;
  }

  onTimeChange(field: 'startTime' | 'endTime', event: any): void {
    const value = event.detail.value;
    if (value) {
      const d = new Date(value);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      this.step2Form.patchValue({ [field]: timeStr });
    }
  }

  addAudienceGroup(group?: any): void {
    const g = this.fb.group({
      entireMadrasaParticipation: [group?.entireMadrasaParticipation || false],
      targetMadrasaIds: [group?.targetMadrasaIds?.length ? group.targetMadrasaIds[0] : null],
      targetCourseIds: [group?.targetCourseIds || []],
      targetClassIds: [group?.targetClassIds || []],
      targetClassGroupIds: [group?.targetClassGroupIds || []],
      selectedStudentIds: [group?.selectedStudentIds || []]
    });
    this.audienceGroups.push(g);
  }

  removeAudienceGroup(index: number): void {
    this.audienceGroups.removeAt(index);
  }

  addCollectedFund(fund?: any): void {
    const f = this.fb.group({
      amount: [fund?.amount || null, [Validators.required, Validators.min(1)]],
      contributor: [fund?.contributor || '', Validators.required]
    });
    this.collectedFunds.push(f);
  }

  removeCollectedFund(index: number): void {
    this.collectedFunds.removeAt(index);
  }

  get currentOrgId(): string {
    return this.step1Form?.get('organizationId')?.value || this.profile?.organizationId || '';
  }

  get orgMadrasas(): EntityRecord[] {
    const orgId = this.currentOrgId;
    return orgId ? this.madrasas.filter(m => m['organizationId'] === orgId) : this.madrasas;
  }

  get orgCourses(): EntityRecord[] {
    const orgId = this.currentOrgId;
    return orgId ? this.courses.filter(m => m['organizationId'] === orgId) : this.courses;
  }

  get orgClasses(): EntityRecord[] {
    const orgId = this.currentOrgId;
    return orgId ? this.classes.filter(m => m['organizationId'] === orgId) : this.classes;
  }

  get orgClassGroups(): EntityRecord[] {
    const orgId = this.currentOrgId;
    return orgId ? this.classGroups.filter(m => m['organizationId'] === orgId) : this.classGroups;
  }

  get orgStudents(): EntityRecord[] {
    const orgId = this.currentOrgId;
    return orgId ? this.students.filter(m => m['organizationId'] === orgId) : this.students;
  }

  get orgStaff(): EntityRecord[] {
    const orgId = this.currentOrgId;
    return orgId ? this.staff.filter(m => m['organizationId'] === orgId || (m['organizations'] && Array.isArray(m['organizations']) && m['organizations'].includes(orgId))) : this.staff;
  }

  private fetchOrganizations(): void {
    this.repo.list('organizations', this.profile).pipe(take(1)).subscribe((orgs: any[]) => {
      this.organizations = orgs;
      this.orgMap = orgs.reduce((acc, org) => {
        acc[org.id] = org['name'];
        return acc;
      }, {} as { [id: string]: string });
    });
  }

  getOrgName(orgId?: string): string {
    if (!orgId || !this.orgMap[orgId]) return '';
    return ` (${this.orgMap[orgId]})`;
  }

  private populateForms(event: any): void {
    const start = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const end = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const startTimeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const endTimeStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

    this.step1Form.patchValue({
      organizationId: event.organizationId || '',
      name: event.name,
      description: event.description,
      eventType: event.eventType,
      customEventType: event.customEventType,
      venueLevel: event.venueLevel,
      madrasaVenueId: event.madrasaVenueId,
      customVenueName: event.customVenueName,
      venueAddress: event.venueAddress,
      conductorType: event.conductorType,
      conductorStaffId: event.conductorStaffId,
      externalConductorDetails: event.externalConductorDetails,
      specialGuestDetails: event.specialGuestDetails,
      chiefGuestDetails: event.chiefGuestDetails
    });
    
    // Set flag so future venueLevel changes trigger auto-population
    this.initialPatchDone = true;

    this.step2Form.patchValue({
      startDate: start,
      startTime: startTimeStr,
      endDate: end,
      endTime: endTimeStr,
      allDay: event.allDay,
      instructions: event.instructions
    });

    this.step3Form.patchValue({
      entireOrganizationParticipation: event.entireOrganizationParticipation || false,
      selectedStaffIds: event.selectedStaffIds || [],
      attendanceRequired: event.attendanceRequired
    });
    if (event.audienceGroups && Array.isArray(event.audienceGroups)) {
      event.audienceGroups.forEach((g: any) => this.addAudienceGroup(g));
    }

    this.step4Form.patchValue({
      staffInChargeId: event.staffInChargeId,
      additionalResponsibleStaffIds: event.additionalResponsibleStaffIds || [],
      estimatedBudget: event.estimatedBudget || 0,
      notes: event.notes
    });
    if (event.collectedFunds && Array.isArray(event.collectedFunds)) {
      event.collectedFunds.forEach((f: any) => this.addCollectedFund(f));
    }
  }

  private dateTimeValidator(group: FormGroup): any {
    const startDate = group.get('startDate')?.value;
    const startTime = group.get('startTime')?.value;
    const endDate = group.get('endDate')?.value;
    const endTime = group.get('endTime')?.value;

    if (!startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (startTime) {
      const [sh, sm] = startTime.split(':');
      start.setHours(+sh, +sm);
    }
    if (endTime) {
      const [eh, em] = endTime.split(':');
      end.setHours(+eh, +em);
    }

    return end.getTime() >= start.getTime() ? null : { invalidRange: true };
  }

  private combineDateAndTime(dateVal: any, timeVal: string): Date {
    const d = new Date(dateVal);
    const [h, m] = timeVal.split(':');
    d.setHours(+h, +m, 0, 0);
    return d;
  }

  get summaryData(): any {
    return {
      ...this.step1Form.value,
      ...this.step2Form.value,
      ...this.step3Form.value,
      ...this.step4Form.value
    };
  }

  async save(): Promise<void> {
    if (this.step1Form.invalid || this.step2Form.invalid || this.step4Form.invalid) {
      this.snackBar.open('Please fill out all required fields properly.', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    try {
      const startDateTime = this.combineDateAndTime(this.step2Form.value.startDate, this.step2Form.value.startTime);
      const endDateTime = this.combineDateAndTime(this.step2Form.value.endDate, this.step2Form.value.endTime);

      const eventPayload: any = {
        organizationId: this.step1Form.value.organizationId || this.profile?.organizationId || (this.madrasas?.length > 0 ? this.madrasas[0]['organizationId'] : ''),
        madrasaIds: this.step1Form.value.venueLevel === 'madrasa' && this.step1Form.value.madrasaVenueId
          ? [this.step1Form.value.madrasaVenueId]
          : this.madrasas.map(m => m.id),
        name: this.step1Form.value.name,
        description: this.step1Form.value.description,
        eventType: this.step1Form.value.eventType,
        customEventType: this.step1Form.value.customEventType,
        venueLevel: this.step1Form.value.venueLevel,
        madrasaVenueId: this.step1Form.value.madrasaVenueId || null,
        customVenueName: this.step1Form.value.customVenueName || null,
        venueAddress: this.step1Form.value.venueAddress || '',
        conductorType: this.step1Form.value.conductorType,
        conductorStaffId: this.step1Form.value.conductorStaffId || null,
        externalConductorDetails: this.step1Form.value.externalConductorDetails || '',
        specialGuestDetails: this.step1Form.value.specialGuestDetails || '',
        chiefGuestDetails: this.step1Form.value.chiefGuestDetails || '',
        startDate: startDateTime.getTime(),
        endDate: endDateTime.getTime(),
        allDay: this.step2Form.value.allDay,
        instructions: this.step2Form.value.instructions || '',
        entireOrganizationParticipation: this.step3Form.value.entireOrganizationParticipation,
        audienceGroups: (this.step3Form.value.audienceGroups || []).map((g: any) => ({
          ...g,
          targetMadrasaIds: g.targetMadrasaIds ? (Array.isArray(g.targetMadrasaIds) ? g.targetMadrasaIds : [g.targetMadrasaIds]) : []
        })),
        selectedStaffIds: this.step3Form.value.selectedStaffIds || [],
        attendanceRequired: this.step3Form.value.attendanceRequired,
        staffInChargeId: this.step4Form.value.staffInChargeId,
        additionalResponsibleStaffIds: this.step4Form.value.additionalResponsibleStaffIds || [],
        estimatedBudget: this.step4Form.value.estimatedBudget || 0,
        collectedFunds: this.step4Form.value.collectedFunds || [],
        notes: this.step4Form.value.notes || ''
      };

      if (this.isEdit) {
        await this.eventService.updateEvent(this.data.event.id, eventPayload);
        this.snackBar.open('Event updated successfully.', 'Close', { duration: 3000 });
      } else {
        await this.eventService.createEvent(eventPayload);
        this.snackBar.open('Event created successfully with participants.', 'Close', { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (error: any) {
      this.snackBar.open(error.message || 'Failed to save event.', 'Close', { duration: 4000 });
      console.error(error);
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private setupAudienceFilters(): void {
    // Legacy single-form flat setup logic removed
  }

  // Dynamic filter methods for the view
  getFilteredCourses(groupIndex: number, search: string = ''): any[] {
    const group = this.audienceGroups.at(groupIndex);
    const mIdsVal = group.get('targetMadrasaIds')?.value;
    const mIds = mIdsVal ? (Array.isArray(mIdsVal) ? mIdsVal : [mIdsVal]) : [];
    let list = this.orgCourses;
    if (mIds.length > 0) {
      list = list.filter(c => mIds.includes(c['madrasaId']));
    }
    return search ? list.filter(c => String(c['name'] || '').toLowerCase().includes(search.toLowerCase())) : list;
  }

  getFilteredClasses(groupIndex: number, search: string = ''): any[] {
    const group = this.audienceGroups.at(groupIndex);
    const cIds = group.get('targetCourseIds')?.value;
    const mIdsVal = group.get('targetMadrasaIds')?.value;
    const mIds = mIdsVal ? (Array.isArray(mIdsVal) ? mIdsVal : [mIdsVal]) : [];
    let list = this.orgClasses;
    if (cIds && cIds.length > 0) {
      list = list.filter(cls => cIds.includes(cls['courseId']));
    } else if (mIds.length > 0) {
      list = list.filter(cls => mIds.includes(cls['madrasaId']));
    }
    return search ? list.filter(cls => String(cls['name'] || '').toLowerCase().includes(search.toLowerCase())) : list;
  }

  getFilteredClassGroups(groupIndex: number, search: string = ''): any[] {
    const group = this.audienceGroups.at(groupIndex);
    const clsIds = group.get('targetClassIds')?.value;
    const cIds = group.get('targetCourseIds')?.value;
    const mIdsVal = group.get('targetMadrasaIds')?.value;
    const mIds = mIdsVal ? (Array.isArray(mIdsVal) ? mIdsVal : [mIdsVal]) : [];
    let list = this.orgClassGroups;
    if (clsIds && clsIds.length > 0) {
      list = list.filter(g => clsIds.includes(g['classId']));
    } else if (cIds && cIds.length > 0) {
      list = list.filter(g => cIds.includes(g['courseId']));
    } else if (mIds.length > 0) {
      list = list.filter(g => mIds.includes(g['madrasaId']));
    }
    return search ? list.filter(g => String(g['name'] || '').toLowerCase().includes(search.toLowerCase())) : list;
  }

  getFilteredStudents(groupIndex: number, search: string = ''): any[] {
    const group = this.audienceGroups.at(groupIndex);
    const cgIds = group.get('targetClassGroupIds')?.value || [];
    const clsIds = group.get('targetClassIds')?.value || [];
    const cIds = group.get('targetCourseIds')?.value || [];
    const mIdsVal = group.get('targetMadrasaIds')?.value;
    const mIds = mIdsVal ? (Array.isArray(mIdsVal) ? mIdsVal : [mIdsVal]) : [];
    let list = this.orgStudents;
    if (cgIds.length > 0) {
      list = list.filter(s => cgIds.includes(s['groupId']));
    } else if (clsIds.length > 0) {
      list = list.filter(s => clsIds.includes(s['classId']));
    } else if (cIds.length > 0) {
      list = list.filter(s => cIds.includes(s['courseId']));
    } else if (mIds.length > 0) {
      list = list.filter(s => mIds.includes(s['madrasaId']));
    }
    return search ? list.filter(s => String(s['name'] || s['displayName'] || '').toLowerCase().includes(search.toLowerCase())) : list;
  }

  filterOptions(list: any[], search: string = ''): any[] {
    if (!search) return list;
    return list.filter(item => String(item['name'] || item['displayName'] || '').toLowerCase().includes(search.toLowerCase()));
  }
}
