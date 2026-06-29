import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QuickAddField, PermissionKey, AppUser } from '../../../core/models/domain.model';
import { AuthService } from '../../../core/services/auth.service';

export interface QuickAddDialogData {
  title: string;
  fields: QuickAddField[];
  initialValue?: Record<string, unknown>;
  submitLabel?: string;
  saveFn?: (payload: Record<string, unknown>) => Promise<void>;
}

export interface QuickAddResult {
  value?: Record<string, unknown>;
  quickAddResource?: string;
}

@Component({
  selector: 'app-quick-add-dialog',
  templateUrl: './quick-add-dialog.component.html',
  styleUrls: ['./quick-add-dialog.component.scss'],
  standalone: false,
})
export class QuickAddDialogComponent implements OnInit {
  readonly form: FormGroup;
  readonly hidePasswords: Record<string, boolean> = {};

  isSaving = false;
  saveErrorMessage = '';
  currentUserProfile: AppUser | null = null;

  readonly courseStageOptions: Record<string, string[]> = {
    maktab: ['Miftah', 'Tilawatul Quran', 'Nadthira', 'Hifz'],
    hifz: ['Hifz']
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<QuickAddDialogComponent, QuickAddResult>,
    @Inject(MAT_DIALOG_DATA) public readonly data: QuickAddDialogData,
    public readonly auth: AuthService,
  ) {
    if (data.initialValue) {
      console.log('[Student Edit Raw Date Debug]', {
        studentId: data.initialValue['id'] || data.initialValue['uid'],
        rawDateOfBirth: data.initialValue['dateOfBirth'],
        rawDob: data.initialValue['dob'],
        rawAdmissionDate: data.initialValue['admissionDate'],
        dateOfBirthType: typeof data.initialValue['dateOfBirth'],
        admissionDateType: typeof data.initialValue['admissionDate'],
        dateOfBirthHasToDate: typeof (data.initialValue['dateOfBirth'] as any)?.toDate === 'function',
        admissionDateHasToDate: typeof (data.initialValue['admissionDate'] as any)?.toDate === 'function',
      });
    }

    const controls = data.fields.reduce<Record<string, unknown[]>>((group, field) => {
      if (field.type === 'password') {
        this.hidePasswords[field.key] = true;
      }
      const defaultValue = field.type === 'multiselect' ? [] : '';
      let initialVal: any = data.initialValue?.[field.key] ?? defaultValue;

      if (field.key === 'dateOfBirth' && !data.initialValue?.['dateOfBirth'] && data.initialValue?.['dob']) {
        initialVal = data.initialValue['dob'];
      }

      if (field.type === 'date') {
        initialVal = this.toDateValue(initialVal);
      }

      group[field.key] = [{ value: initialVal, disabled: field.type === 'info' }, field.required && field.type !== 'info' ? Validators.required : []];
      return group;
    }, {});
    this.form = this.fb.group(controls);

    if (data.initialValue) {
      const convertedDateOfBirth = this.toDateValue(data.initialValue['dateOfBirth'] || data.initialValue['dob']);
      const convertedAdmissionDate = this.toDateValue(data.initialValue['admissionDate']);

      console.log('[Student Edit Converted Date Debug]', {
        convertedDateOfBirth,
        convertedAdmissionDate,
        dateOfBirthValid: convertedDateOfBirth instanceof Date && !isNaN(convertedDateOfBirth.getTime()),
        admissionDateValid: convertedAdmissionDate instanceof Date && !isNaN(convertedAdmissionDate.getTime()),
      });

      console.log('[Student Edit Form Date Patch Debug]', {
        formDateOfBirth: this.form.get('dateOfBirth')?.value,
        formAdmissionDate: this.form.get('admissionDate')?.value,
      });
    }
  }

  private toDateValue(value: any): Date | null {
    if (!value) return null;

    // Firestore Timestamp
    if (value?.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }

    // Firestore-like timestamp object
    if (value?.seconds) {
      return new Date(value.seconds * 1000);
    }

    // Already Date
    if (value instanceof Date) {
      return value;
    }

    // String or number
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  ngOnInit(): void {
    this.auth.profile$.subscribe(profile => {
      this.currentUserProfile = profile;
    });

    const typeControl = this.form.get('type');
    const stagesControl = this.form.get('stages');

    if (typeControl && stagesControl) {
      typeControl.valueChanges.subscribe(courseType => {
        if (courseType === 'hifz') {
          const currentStages = stagesControl.value || [];
          if (Array.isArray(currentStages) && !currentStages.includes('Hifz')) {
            stagesControl.setValue([...currentStages, 'Hifz']);
          }
        }
      });
    }

    const courseIdControl = this.form.get('courseId') || this.form.get('newCourseId');
    const classIdControl = this.form.get('classId') || this.form.get('classIds');
    const madrasaIdControl = this.form.get('madrasaId') || this.form.get('madrasaIds');

    if (courseIdControl) {
      courseIdControl.valueChanges.subscribe((courseId) => {
        setTimeout(() => this.resetInvalidStage());
        
        if (classIdControl) {
          const currentClassValue = classIdControl.value;
          if (currentClassValue) {
            const classField = this.data.fields.find(f => f.key === 'classId' || f.key === 'classIds');
            if (classField) {
              const validOptions = this.getFilteredOptions(classField);
              const validIds = validOptions.map((o: any) => o.value);
              
              if (Array.isArray(currentClassValue)) {
                const newValues = currentClassValue.filter(id => validIds.includes(id));
                if (newValues.length !== currentClassValue.length) {
                  classIdControl.patchValue(newValues, { emitEvent: false });
                }
              } else {
                if (!validIds.includes(currentClassValue)) {
                  classIdControl.patchValue('', { emitEvent: false });
                }
              }
            }
          }
        }
      });
    }

    if (madrasaIdControl) {
      madrasaIdControl.valueChanges.subscribe(() => {
        if (courseIdControl) courseIdControl.patchValue(Array.isArray(courseIdControl.value) ? [] : '', { emitEvent: false });
        if (classIdControl) classIdControl.patchValue(Array.isArray(classIdControl.value) ? [] : '', { emitEvent: false });
      });
    }

    const courseTypeControl = this.form.get('courseType') || this.form.get('type');
    if (courseTypeControl) {
      courseTypeControl.valueChanges.subscribe(() => {
        setTimeout(() => this.resetInvalidStage());
      });
    }
  }

  getFilteredOptions(field: any): any[] {
    if (!field.options) return [];

    const organizationId = this.form.get('organizationId')?.value;
    const madrasaId = this.form.get('madrasaId')?.value || (Array.isArray(this.form.get('madrasaIds')?.value) && this.form.get('madrasaIds')?.value[0]);

    if (field.key === 'classId' || field.key === 'classIds') {
      const courseId = this.form.get('courseId')?.value || this.form.get('newCourseId')?.value;

      return field.options.filter((opt: any) => {
        const data = opt.data;
        if (!data) return true;

        const sameCourse = courseId ? (data.courseId === courseId || (Array.isArray(data.courseIds) && data.courseIds.includes(courseId))) : true;
        const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
        const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;

        // If a course is selected, strict enforce the course check. Otherwise, show nothing.
        if (courseId && !sameCourse) return false;
        if (!courseId) return false;

        return sameCourse && sameOrg && sameMadrasa;
      });
    }

    if (field.key === 'courseId' || field.key === 'newCourseId' || field.key === 'courseIds') {
      if (!organizationId && !madrasaId) return field.options;

      return field.options.filter((opt: any) => {
        const data = opt.data;
        if (!data) return true;

        const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
        const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;

        return sameOrg && sameMadrasa;
      });
    }

    if (field.key === 'subjectId' || field.key === 'subjectIds') {
      const courseId = this.form.get('courseId')?.value || this.form.get('newCourseId')?.value;
      const classId = this.form.get('classId')?.value;

      return field.options.filter((opt: any) => {
        const data = opt.data;
        if (!data) return true;

        const sameCourse = courseId && data.courseId ? data.courseId === courseId : true;
        const sameClass = classId && data.classId ? data.classId === classId : true;
        const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
        const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;

        return sameCourse && sameClass && sameOrg && sameMadrasa;
      });
    }

    return field.options;
  }

  isStageField(key: string): boolean {
    return ['stage', 'stageLevel', 'stageOrLevel'].includes(key);
  }

  getSelectedCourse(): any {
    const courseId = this.form?.get('courseId')?.value || this.form?.get('newCourseId')?.value;
    if (!courseId) return null;
    const courseField = this.data.fields.find(f => f.key === 'courseId' || f.key === 'newCourseId');
    if (!courseField || !courseField.options) return null;
    return courseField.options.find(o => o.value === courseId)?.data;
  }

  getSelectedCourseType(): string {
    const selectedCourse = this.getSelectedCourse();
    return String(
      this.form?.get('courseType')?.value ||
      this.form?.get('type')?.value ||
      selectedCourse?.['courseType'] ||
      selectedCourse?.['typeDisplay'] ||
      selectedCourse?.['type'] ||
      ''
    ).trim().toLowerCase();
  }

  getStageOptions(): string[] {
    const selectedCourse = this.getSelectedCourse();
    const courseStages = selectedCourse?.['stages'];

    if (Array.isArray(courseStages) && courseStages.length) {
      return courseStages;
    }

    if (typeof courseStages === 'string' && courseStages.trim()) {
      return courseStages.split(',').map((item: string) => item.trim()).filter(Boolean);
    }

    const courseType = this.getSelectedCourseType();
    return this.courseStageOptions[courseType] || [];
  }

  shouldShowStageSelect(): boolean {
    return this.getStageOptions().length > 0;
  }

  resetInvalidStage() {
    const options = this.getStageOptions();
    if (!options.length) return;

    for (const key of ['stage', 'stageLevel', 'stageOrLevel']) {
      const control = this.form.get(key);
      if (control) {
        const current = control.value;
        if (current && !options.includes(current)) {
          control.patchValue('');
        }
      }
    }
  }

  canQuickAdd(resource?: string): boolean {
    if (!resource) return false;
    const resourcePermissionMap: Record<string, PermissionKey> = {
      organizations: 'manageOrganizations',
      madrasas: 'manageMadrasas',
      courses: 'manageCourses',
      classes: 'manageClasses',
      subjects: 'manageSubjects',
      coordinators: 'manageCoordinators',
      incharges: 'manageIncharges',
      students: 'manageStudents',
      parents: 'manageParents',
      staff: 'manageStaff',
      users: 'manageUsers'
    };
    const permission = resourcePermissionMap[resource];
    if (!permission) return false;
    return this.auth.hasPermission(this.currentUserProfile, permission);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.data.saveFn) {
      this.isSaving = true;
      this.saveErrorMessage = '';
      try {
        await this.data.saveFn(this.form.getRawValue() as Record<string, unknown>);
        this.dialogRef.close({ value: this.form.getRawValue() as Record<string, unknown> });
      } catch (error: any) {
        const friendlyMessage = this.getUserCreationErrorMessage(error);
        this.saveErrorMessage = friendlyMessage;

        console.error('[QuickAdd Save Failed]', {
          friendlyMessage,
          rawError: error,
          errorMessage: error?.error?.message || error?.message,
          errorStatus: error?.error?.status || error?.status,
          errorCode: error?.code,
          formValue: this.form.value
        });

        if (friendlyMessage.toLowerCase().includes('email')) {
          this.form.get('email')?.setErrors({
            ...(this.form.get('email')?.errors || {}),
            serverError: friendlyMessage
          });
          this.form.get('email')?.markAsTouched();
        }
      } finally {
        this.isSaving = false;
      }
    } else {
      this.dialogRef.close({ value: this.form.getRawValue() as Record<string, unknown> });
    }
  }

  private getUserCreationErrorMessage(error: any): string {
    const backendMessage =
      error?.error?.message ||
      error?.message ||
      error?.details?.message ||
      '';

    const code =
      error?.error?.status ||
      error?.status ||
      error?.code ||
      '';

    if (backendMessage.includes('Email already exists') ||
        backendMessage.includes('email already exists') ||
        backendMessage.includes('already in use') ||
        code === 'auth/email-already-exists' ||
        code === 'auth/email-already-in-use' ||
        code === 'already-exists' ||
        code === 'functions/already-exists') {
      return 'This email is already registered. Please use another email.';
    }

    if (backendMessage.includes('Error checking email uniqueness') ||
        backendMessage.includes('Unable to verify whether this email is already used')) {
      return 'Unable to verify whether this email is already used. Please check your connection and try again.';
    }

    if (backendMessage.includes('Missing or insufficient permissions') ||
        code === 'permission-denied' ||
        code === 'functions/permission-denied') {
      return 'You do not have permission to perform this action. Please contact an administrator.';
    }

    if (backendMessage.includes('invalid email') ||
        code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }

    if (backendMessage.includes('weak password') ||
        code === 'auth/weak-password') {
      return 'The password is too weak. Please use a stronger password.';
    }

    if (backendMessage.includes('organization') || backendMessage.includes('madrasa')) {
      return 'Organization or madrasa information is missing. Please select the required fields and try again.';
    }

    return backendMessage || 'Unable to save. Please try again.';
  }

  requestQuickAdd(resource: string | undefined): void {
    if (resource) {
      this.dialogRef.close({ quickAddResource: resource });
    }
  }
}
