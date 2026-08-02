import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QuickAddField, PermissionKey, AppUser, UserRole } from '../../../core/models/domain.model';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../../core/constants/defaults';
import { AuthService } from '../../../core/services/auth.service';
import { RepositoryService } from '../../../core/services/repository.service';
import { RolePermissionsService } from '../../../core/services/role-permissions.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

export interface QuickAddDialogData {
  title: string;
  subtitle?: string;
  fields: QuickAddField[];
  initialValue?: Record<string, unknown>;
  submitLabel?: string;
  saveFn?: (payload: Record<string, unknown>) => Promise<void>;
  isEdit?: boolean;
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
export class QuickAddDialogComponent implements OnInit, OnDestroy {
  readonly form: FormGroup;
  readonly hidePasswords: Record<string, boolean> = {};
  readonly searchQueries: Record<string, string> = {};
  private readonly subscriptions: Subscription[] = [];

  isSaving = false;
  saveErrorMessage = '';
  currentUserProfile: AppUser | null = null;

  readonly courseStageOptions: Record<string, string[]> = {
    maktab: ['Miftah', 'Tilawatul Quran', 'Hifz'],
    hifz: ['Sabaq', 'Sabaqi', 'Manzil']
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<QuickAddDialogComponent, QuickAddResult>,
    @Inject(MAT_DIALOG_DATA) public readonly data: QuickAddDialogData,
    public readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly rolePermissionsService: RolePermissionsService,
    private readonly dialog: MatDialog,
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

    const isEditMode = data.isEdit ?? !!(data.initialValue && (data.initialValue['id'] || data.initialValue['uid'] || data.initialValue['userId'] || data.initialValue['entityId']));
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

      const validators = field.required && field.type !== 'info' ? [Validators.required] : [];
      if (field.type === 'mobileNumber') {
        validators.push(Validators.pattern(/^[0-9]*$/));
        validators.push(Validators.minLength(10));
        validators.push(Validators.maxLength(10));
      }

      const isDisabled = field.type === 'info' || (isEditMode && field.key === 'email');

      group[field.key] = [{ value: initialVal, disabled: isDisabled }, validators];
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
      
      const orgControl = this.form.get('organizationId');
      if (orgControl && profile && profile.role !== 'superAdmin' && profile.organizationId) {
        orgControl.setValue(profile.organizationId);
        orgControl.disable();
      }
    });

    const roleControl = this.form.get('role');
    const permissionsControl = this.form.get('permissions');

    if (roleControl && permissionsControl) {
      // Load templates and initialize default permissions for the selected role
      this.rolePermissionsService.loadTemplates().then(() => {
        const currentRole = roleControl.value as UserRole;
        const currentPermissions = permissionsControl.value;
        if (currentRole && (!this.data.isEdit || !currentPermissions || currentPermissions.length === 0)) {
          permissionsControl.setValue(this.rolePermissionsService.getPermissionsForRole(currentRole), { emitEvent: false });
        }
      });

      let previousRole = roleControl.value as UserRole;

      this.subscriptions.push(
        roleControl.valueChanges.subscribe(async (newRole: UserRole) => {
          if (!newRole) return;
          await this.rolePermissionsService.loadTemplates();
          const defaultPerms = this.rolePermissionsService.getPermissionsForRole(newRole);
          const existingPerms = permissionsControl.value || [];

          if (!this.data.isEdit || existingPerms.length === 0) {
            permissionsControl.setValue(defaultPerms);
          } else {
            const previousDefaults = previousRole ? this.rolePermissionsService.getPermissionsForRole(previousRole) : [];
            const isUnmodified = existingPerms.length === previousDefaults.length && 
                                 existingPerms.every((p: PermissionKey) => previousDefaults.includes(p));

            if (isUnmodified) {
              // Silently replace since they haven't customized them
              permissionsControl.setValue(defaultPerms);
            } else {
              const confirmRef = this.dialog.open(ConfirmDialogComponent, {
                width: '420px',
                data: {
                  title: 'Role Permissions Changed',
                  message: `The role has changed to ${this.getRoleLabel(newRole)}. Do you want to load the default permissions for this role? This will overwrite your current selections.`,
                  confirmLabel: 'Load Defaults',
                  confirmColor: 'primary',
                },
              });

              confirmRef.afterClosed().subscribe((confirmed: boolean) => {
                if (confirmed) {
                  permissionsControl.setValue(defaultPerms);
                }
              });
            }
          }
          previousRole = newRole;
        })
      );
    }

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

    const orgIdControl = this.form.get('organizationId');
    const courseIdControl = this.form.get('courseId') || this.form.get('newCourseId');
    const classIdControl = this.form.get('classId') || this.form.get('classIds');
    const madrasaIdControl = this.form.get('madrasaId') || this.form.get('madrasaIds');

    if (orgIdControl) {
      this.subscriptions.push(
        orgIdControl.valueChanges.subscribe(() => {
          if (madrasaIdControl) {
            const currentMadrasaValue = madrasaIdControl.value;
            if (currentMadrasaValue) {
              const madrasaField = this.data.fields.find(f => f.key === 'madrasaId' || f.key === 'madrasaIds');
              if (madrasaField) {
                const validOptions = this.getFilteredOptions(madrasaField);
                const validIds = validOptions.map((o: any) => o.value);
                if (Array.isArray(currentMadrasaValue)) {
                  const newValues = currentMadrasaValue.filter(id => validIds.includes(id));
                  if (newValues.length !== currentMadrasaValue.length) {
                    madrasaIdControl.patchValue(newValues, { emitEvent: false });
                  }
                } else {
                  if (!validIds.includes(currentMadrasaValue)) {
                    madrasaIdControl.patchValue('', { emitEvent: false });
                  }
                }
              }
            }
          }
        })
      );
    }

    if (courseIdControl) {
      this.subscriptions.push(
        courseIdControl.valueChanges.subscribe((courseId) => {
          setTimeout(() => {
            this.resetInvalidStage();
            const courseTypeControl = this.form.get('courseTypeDisplay');
            if (courseTypeControl) {
              const selectedCourse = this.getSelectedCourse();
              const rawType = selectedCourse?.['courseType'] || selectedCourse?.['typeDisplay'] || selectedCourse?.['type'];
              courseTypeControl.setValue(this.formatCourseType(rawType));
            }
          });
          
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
      })
    );
  }

    const groupIdControl = this.form.get('groupId') || this.form.get('groupIds');
    if (classIdControl && groupIdControl) {
      this.subscriptions.push(
        classIdControl.valueChanges.subscribe(() => {
          setTimeout(() => {
            const groupField = this.data.fields.find(f => f.key === 'groupId' || f.key === 'groupIds');
            if (groupField) {
              const validOptions = this.getFilteredOptions(groupField);
              const validIds = validOptions.map((o: any) => o.value);
              const currentGroupValue = groupIdControl.value;

              if (validOptions.length === 1) {
                // Auto-select if only 1 option available and clear required validator
                const valToSet = Array.isArray(currentGroupValue) ? [validIds[0]] : validIds[0];
                if (JSON.stringify(currentGroupValue) !== JSON.stringify(valToSet)) {
                  groupIdControl.patchValue(valToSet);
                }
                groupIdControl.clearValidators();
                groupIdControl.updateValueAndValidity({ emitEvent: false });
              } else if (validOptions.length > 1) {
                // Clear invalid selections and enforce required validation
                groupIdControl.setValidators(Validators.required);
                groupIdControl.updateValueAndValidity({ emitEvent: false });
                if (Array.isArray(currentGroupValue)) {
                  const newValues = currentGroupValue.filter(id => validIds.includes(id));
                  if (newValues.length !== currentGroupValue.length) {
                    groupIdControl.patchValue(newValues);
                  }
                } else {
                  if (!validIds.includes(currentGroupValue)) {
                    groupIdControl.patchValue('');
                  }
                }
              } else {
                 groupIdControl.clearValidators();
                 groupIdControl.updateValueAndValidity({ emitEvent: false });
              }
            }
          });
        })
      );
    }

    if (madrasaIdControl) {
      madrasaIdControl.valueChanges.subscribe(() => {
        if (courseIdControl) courseIdControl.patchValue(Array.isArray(courseIdControl.value) ? [] : '', { emitEvent: false });
        if (classIdControl) classIdControl.patchValue(Array.isArray(classIdControl.value) ? [] : '', { emitEvent: false });
      });
    }

    const courseTypeControl = this.form.get('courseType') || this.form.get('type');
    if (courseTypeControl) {
      this.subscriptions.push(
        courseTypeControl.valueChanges.subscribe(() => {
          setTimeout(() => this.resetInvalidStage());
        })
      );
    }

    const cIdControl = this.form.get('courseId');
    if (cIdControl) {
      this.subscriptions.push(
        cIdControl.valueChanges.subscribe(() => {
          this.resetInvalidStage();
        })
      );
    }

    const newCourseIdControl = this.form.get('newCourseId');
    if (newCourseIdControl) {
      this.subscriptions.push(
        newCourseIdControl.valueChanges.subscribe(() => {
          this.resetInvalidStage();
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  async loadRoleDefaultPermissions(): Promise<void> {
    const roleControl = this.form.get('role');
    const permissionsControl = this.form.get('permissions');
    const role = (roleControl?.value || this.data.initialValue?.['role']) as string;

    if (!role || !permissionsControl) return;

    await this.rolePermissionsService.loadTemplates();
    const defaultPerms = this.rolePermissionsService.getPermissionsForRole(role);
    permissionsControl.setValue(defaultPerms);
    permissionsControl.markAsDirty();
  }

  getFilteredOptions(field: any): any[] {
    if (!field.options) return [];

    let options = field.options;

    const organizationId = this.form.get('organizationId')?.value;
    const madrasaId = this.form.get('madrasaId')?.value || (Array.isArray(this.form.get('madrasaIds')?.value) && this.form.get('madrasaIds')?.value[0]);

    if (field.key === 'madrasaId' || field.key === 'madrasaIds') {
      if (organizationId) {
        options = options.filter((opt: any) => {
          const data = opt.data;
          if (!data) return true;
          return data.organizationId ? data.organizationId === organizationId : true;
        });
      }
    } else if (field.key === 'classId' || field.key === 'classIds') {
      const courseId = this.form.get('courseId')?.value || this.form.get('newCourseId')?.value;

      options = options.filter((opt: any) => {
        const data = opt.data;
        if (!data) return true;

        const sameCourse = courseId ? (data.courseId === courseId || (Array.isArray(data.courseIds) && data.courseIds.includes(courseId))) : true;
        const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
        const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;

        const hasCourseControl = this.form.contains('courseId') || this.form.contains('newCourseId');
        
        // If the form has a course control, strict enforce the course check. Otherwise, skip it.
        if (hasCourseControl) {
          if (!courseId) return false;
          if (!sameCourse) return false;
        }

        return sameOrg && sameMadrasa;
      });
    } else if (field.key === 'courseId' || field.key === 'newCourseId' || field.key === 'courseIds') {
      if (organizationId || madrasaId) {
        options = options.filter((opt: any) => {
          const data = opt.data;
          if (!data) return true;

          const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
          const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;

          return sameOrg && sameMadrasa;
        });
      }

      const seenLabels = new Set<string>();
      options = options.filter((opt: any) => {
        const label = String(opt.label || opt.value || '').trim().toLowerCase();
        if (seenLabels.has(label)) {
          return false;
        }
        seenLabels.add(label);
        return true;
      });
    } else if (field.key === 'subjectId' || field.key === 'subjectIds') {
      const courseId = this.form.get('courseId')?.value || this.form.get('newCourseId')?.value;
      const classId = this.form.get('classId')?.value;

      options = options.filter((opt: any) => {
        const data = opt.data;
        if (!data) return true;

        const hasCourseControl = this.form.contains('courseId') || this.form.contains('newCourseId');
        const hasClassControl = this.form.contains('classId');

        const sameCourse = courseId && data.courseId ? data.courseId === courseId : true;
        const sameClass = classId && data.classId ? data.classId === classId : true;
        const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
        const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;

        if (hasCourseControl) {
          if (!courseId) return false;
          if (!sameCourse) return false;
        }

        if (hasClassControl) {
          if (!classId) return false;
          if (!sameClass) return false;
        }

        return sameOrg && sameMadrasa;
      });
    } else if (field.key === 'groupId' || field.key === 'groupIds') {
      const classId = this.form.get('classId')?.value || this.form.get('classIds')?.value;

      options = options.filter((opt: any) => {
        const data = opt.data;
        if (!data) return true;

        const sameOrg = organizationId && data.organizationId ? data.organizationId === organizationId : true;
        const sameMadrasa = madrasaId && data.madrasaId ? data.madrasaId === madrasaId : true;
        
        const hasClassControl = this.form.contains('classId') || this.form.contains('classIds');

        if (hasClassControl) {
          if (!classId || (Array.isArray(classId) && classId.length === 0)) return false; // Must select a class first

          let sameClass = true;
          if (Array.isArray(classId)) {
            sameClass = classId.includes(data.classId);
          } else {
            sameClass = data.classId === classId;
          }
          if (!sameClass) return false;
        }

        return sameOrg && sameMadrasa;
      });
    }

    const searchQuery = (this.searchQueries[field.key] || '').toLowerCase();
    if (searchQuery) {
      const currentValue = this.form.get(field.key)?.value;
      const selectedValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
      
      options = options.filter((opt: any) => {
        const matchesSearch = opt.label?.toLowerCase().includes(searchQuery);
        const isSelected = selectedValues.includes(opt.value);
        return matchesSearch || isSelected;
      });
    }

    return options;
  }

  isStageField(key: string): boolean {
    return ['stage', 'newStage', 'stages'].includes(key);
  }

  getOriginalStage(): string | null {
    if (!this.data.initialValue) return null;
    return (this.data.initialValue['stage'] as string) || (this.data.initialValue['level'] as string) || null;
  }

  getSelectedCourse(): any {
    const courseId = this.form?.get('courseId')?.value || this.form?.get('newCourseId')?.value;
    if (!courseId) return null;
    const courseField = this.data.fields.find(f => f.key === 'courseId' || f.key === 'newCourseId');
    if (!courseField || !courseField.options) return null;
    return courseField.options.find(o => o.value === courseId)?.data;
  }

  formatCourseType(val: any): string {
    if (!val) return 'Maktab';
    const s = String(val).trim();
    if (s === 'maktab') return 'Maktab';
    if (s === 'aalim') return 'Aalim';
    if (s === 'hifz') return 'Hifz';
    if (s === 'muballigh') return 'Muballigh';
    if (s === 'custom') return 'Custom';
    return s.charAt(0).toUpperCase() + s.slice(1);
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

  private stageHierarchyCache: { [fieldKey: string]: { main: string; subStages: string[] }[] } = {};
  private stageOptionsCache: { [fieldKey: string]: string[] } = {};

  clearStageCaches() {
    this.stageHierarchyCache = {};
    this.stageOptionsCache = {};
  }

  getStageOptions(fieldKey: string = 'stage'): string[] {
    const cacheKey = fieldKey || 'stage';
    if (this.stageOptionsCache[cacheKey]) {
      return this.stageOptionsCache[cacheKey];
    }

    const selectedCourse = this.getSelectedCourse();
    const courseStages = selectedCourse?.['stages'];

    let options: string[] = [];
    if (Array.isArray(courseStages) && courseStages.length) {
      options = [...courseStages];
    } else if (typeof courseStages === 'string' && courseStages.trim()) {
      options = courseStages.split(',').map((item: string) => item.trim()).filter(Boolean);
    } else {
      const courseType = this.getSelectedCourseType();
      options = [...(DEFAULT_STAGES_BY_COURSE_TYPE[courseType] || [])];
    }

    if (fieldKey === 'newStage') {
      const original = this.getOriginalStage();
      if (original) {
        options = options.filter(s => s.toLowerCase() !== original.toLowerCase());
      }
    }

    this.stageOptionsCache[cacheKey] = options;
    return options;
  }

  shouldShowStageSelect(): boolean {
    return this.getStageOptions().length > 0;
  }

  isFieldVisible(field: QuickAddField): boolean {
    if (field.type === 'hidden') return false;
    if (field.key === 'requiredDaurCount') {
      return this.form.get('promotionRule')?.value === 'daur_count_required';
    }
    if (field.key === 'courseDurationYears') {
      const val = this.form.get('hasFixedDuration')?.value;
      return val === true || val === 'true';
    }
    if (field.key === 'stages') {
      return this.shouldShowStageSelect();
    }
    if (field.key === 'levels') {
      return !this.shouldShowStageSelect();
    }
    if (field.key === 'groupId' || field.key === 'groupIds') {
      return this.getFilteredOptions(field).length > 0;
    }
    return true;
  }

  selectedMainStage: { [fieldKey: string]: string } = {};
  selectedSubStage: { [fieldKey: string]: string } = {};

  getStageHierarchy(fieldKey: string = 'stage'): { main: string; subStages: string[] }[] {
    const cacheKey = fieldKey || 'stage';
    if (this.stageHierarchyCache[cacheKey]) {
      return this.stageHierarchyCache[cacheKey];
    }

    const rawOptions = this.getStageOptions(fieldKey);
    if (!rawOptions || !rawOptions.length) {
      this.stageHierarchyCache[cacheKey] = [];
      return [];
    }

    const result: { main: string; subStages: string[] }[] = [];
    const map = new Map<string, { main: string; subStages: string[] }>();

    for (const raw of rawOptions) {
      const name = String(raw).trim();
      if (!name) continue;

      let parentName = '';
      let subName = '';

      if (name.includes(' - ')) {
        const parts = name.split(' - ');
        parentName = parts[0].trim();
        subName = parts.slice(1).join(' - ').trim();
      } else {
        const match = name.match(/^(.*?)\s+Stage\s+(\d+.*)$/i) ||
                      name.match(/^(.*?)\s+Level\s+(\d+.*)$/i);
        if (match) {
          parentName = match[1].trim();
          subName = name.substring(parentName.length).replace(/^[\s-]+/, '').trim();
        }
      }

      if (parentName && subName) {
        const key = parentName.toLowerCase();
        let entry = map.get(key);
        if (!entry) {
          entry = { main: parentName, subStages: [] };
          map.set(key, entry);
          result.push(entry);
        }
        if (!entry.subStages.includes(subName)) {
          entry.subStages.push(subName);
        }
      } else {
        const key = name.toLowerCase();
        if (!map.has(key)) {
          const entry = { main: name, subStages: [] };
          map.set(key, entry);
          result.push(entry);
        }
      }
    }

    this.stageHierarchyCache[cacheKey] = result;
    return result;
  }

  initStageState(fieldKey: string = 'stage') {
    const control = this.form.get(fieldKey);
    if (!control) return;
    const currentVal = String(control.value || '').trim();
    if (!currentVal) {
      this.selectedMainStage[fieldKey] = '';
      this.selectedSubStage[fieldKey] = '';
      return;
    }

    const hierarchy = this.getStageHierarchy(fieldKey);
    for (const group of hierarchy) {
      if (group.subStages.length > 0) {
        for (const sub of group.subStages) {
          const fullPattern1 = `${group.main} - ${sub}`;
          const fullPattern2 = `${group.main} ${sub}`;
          if (currentVal.toLowerCase() === fullPattern1.toLowerCase() ||
              currentVal.toLowerCase() === fullPattern2.toLowerCase() ||
              currentVal.toLowerCase() === sub.toLowerCase()) {
            this.selectedMainStage[fieldKey] = group.main;
            this.selectedSubStage[fieldKey] = sub;
            return;
          }
        }
      }
      if (currentVal.toLowerCase() === group.main.toLowerCase()) {
        this.selectedMainStage[fieldKey] = group.main;
        this.selectedSubStage[fieldKey] = '';
        return;
      }
    }

    this.selectedMainStage[fieldKey] = currentVal;
    this.selectedSubStage[fieldKey] = '';
  }

  formatStageWithHyphen(mainName: string, subName: string): string {
    const main = (mainName || '').trim();
    let sub = (subName || '').trim();
    if (!main) return sub;
    if (!sub) return main;

    if (sub.includes(' - ') || sub.includes(':-') || sub.includes(': ')) {
      return sub;
    }

    if (sub.toLowerCase().startsWith(main.toLowerCase())) {
      const remainder = sub.slice(main.length).trim();
      if (remainder) {
        return `${main} - ${remainder}`;
      }
      return main;
    }

    return `${main} - ${sub}`;
  }

  onMainStageChange(fieldKey: string, mainStage: string) {
    this.selectedMainStage[fieldKey] = mainStage;
    const hierarchy = this.getStageHierarchy(fieldKey);
    const group = hierarchy.find(g => g.main.toLowerCase() === (mainStage || '').toLowerCase());

    const control = this.form.get(fieldKey);
    if (group && group.subStages && group.subStages.length > 0) {
      const firstSub = group.subStages[0];
      this.selectedSubStage[fieldKey] = firstSub;
      const fullVal = this.formatStageWithHyphen(group.main, firstSub);
      const rawOptions = this.getStageOptions(fieldKey);
      const exactMatch = rawOptions.find(o => o.toLowerCase() === fullVal.toLowerCase()) || fullVal;
      control?.patchValue(exactMatch, { emitEvent: false });
    } else {
      this.selectedSubStage[fieldKey] = '';
      control?.patchValue(mainStage, { emitEvent: false });
    }
  }

  onSubStageChange(fieldKey: string, subStage: string) {
    this.selectedSubStage[fieldKey] = subStage;
    const main = this.selectedMainStage[fieldKey] || '';
    const fullVal = this.formatStageWithHyphen(main, subStage);
    const rawOptions = this.getStageOptions(fieldKey);
    const exactMatch = rawOptions.find(o => o.toLowerCase() === fullVal.toLowerCase()) || fullVal;
    const control = this.form.get(fieldKey);
    control?.patchValue(exactMatch, { emitEvent: false });
  }

  hasSubStages(fieldKey: string): boolean {
    return this.getSubStagesForSelectedMainStage(fieldKey).length > 0;
  }

  getSubStagesForSelectedMainStage(fieldKey: string): string[] {
    const main = this.selectedMainStage[fieldKey];
    if (!main) return [];
    const group = this.getStageHierarchy(fieldKey).find(g => g.main.toLowerCase() === main.toLowerCase());
    return group ? group.subStages : [];
  }

  resetInvalidStage() {
    this.clearStageCaches();
    for (const key of ['stage', 'newStage']) {
      const options = this.getStageOptions(key);
      if (!options.length) continue;

      const control = this.form.get(key);
      if (control) {
        const current = control.value;
        if (current && !options.includes(current)) {
          control.patchValue('', { emitEvent: false });
        }
      }
      this.initStageState(key);
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

  isUserField(field: QuickAddField): boolean {
    return field.quickAddResource === 'staff' || field.quickAddResource === 'users' || 
           field.key?.toLowerCase().includes('user') || field.key?.toLowerCase().includes('staff') || 
           field.key?.toLowerCase().includes('teacher') || field.key?.toLowerCase().includes('coordinator') || 
           field.key?.toLowerCase().includes('incharge');
  }

  getRoleLabel(role: string): string {
    const ROLE_LABELS: Record<string, string> = {
      systemAdmin: 'System Admin',
      organizationAdmin: 'Org Admin',
      coordinator: 'Coordinator',
      incharge: 'Incharge',
      teacher: 'Teacher',
      student: 'Student',
      parent: 'Parent',
    };
    return ROLE_LABELS[role] || role;
  }

  getSelectedLabel(field: QuickAddField): string {
    const val = this.form.get(field.key)?.value;
    return field.options?.find(o => o.value === val)?.label || '';
  }

  getSelectedLabels(field: QuickAddField): string {
    const vals = this.form.get(field.key)?.value || [];
    return field.options?.filter(o => vals.includes(o.value)).map(o => o.label).join(', ') || '';
  }

  async showUserInfo(user: any) {
    if (!user || !user.id) return;
    
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const groups = await this.repo.getAllOnce<any>('classGroups', profile);
      const userIds = [user.id, user.uid, user.userId, user.entityId].map(id => String(id || '')).filter(Boolean);
      const assignedGroups = groups.filter(group =>
        Array.isArray(group.assignedStaffIds) &&
        userIds.some(id => group.assignedStaffIds.map(String).includes(id))
      );
      
      const madrasas = await this.repo.getAllOnce<any>('madrasas', profile);
      const assignedMadrasas = madrasas.filter(m => 
        (Array.isArray(m.coordinatorIds) && m.coordinatorIds.includes(user.id)) ||
        (Array.isArray(m.inchargeIds) && m.inchargeIds.includes(user.id))
      );
      
      const parts = [];
      if (assignedGroups.length > 0) {
        parts.push(`Assigned Class Groups:\n${assignedGroups.map(group => `- ${group.name}`).join('\n')}`);
      }
      if (assignedMadrasas.length > 0) {
        parts.push(`Assigned Madrasas:\n${assignedMadrasas.map(m => `- ${m.name}`).join('\n')}`);
      }
      
      const message = parts.length > 0 ? parts.join('\n\n') : 'No assignments found for this user.';
      
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: `Assignments for ${user.name || user.displayName || 'User'}`,
          message,
          confirmLabel: 'OK'
        }
      });
    } catch (e) {
      console.error('Failed to fetch user assignments', e);
    }
  }

  requestQuickAdd(resource: string | undefined): void {
    if (resource) {
      this.dialogRef.close({ quickAddResource: resource });
    }
  }
}
