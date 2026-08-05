import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../../core/constants/defaults';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface CourseStagesDialogData {
  courseId?: string;
  course?: EntityRecord;
  mode?: 'course' | 'courseType' | 'namingRules';
}

export interface StageHierarchyItem {
  name: string;
  subStages: string[];
  description?: string;
  subStageDescriptions?: Record<string, string>;
  expanded?: boolean;
  subStageInput?: string;
}

@Component({
  selector: 'app-course-stages-dialog',
  templateUrl: './course-stages-dialog.component.html',
  styleUrls: ['./course-stages-dialog.component.scss'],
  standalone: false,
})
export class CourseStagesDialogComponent implements OnInit {
  loading = true;
  saving = false;

  activeTab: 'stages' | 'namingRules' = 'stages';
  mode: 'course' | 'courseType' | 'namingRules' = 'course';

  courses: EntityRecord[] = [];
  courseTypes: EntityRecord[] = [];

  selectedCourseId = '';
  selectedCourseTypeId = '';

  selectedCourse: EntityRecord | null = null;
  selectedCourseType: EntityRecord | null = null;

  stagesList: string[] = [];
  hierarchicalStages: StageHierarchyItem[] = [];
  bulkInputText = '';

  // Organization Naming Rules
  standardShifts: string[] = ['Morning', 'Evening', 'After Maghrib', 'After Isha'];
  newShiftInput = '';
  classNamePattern = '{madrasaCode} - {shift}';
  groupNamePattern = '{shift} - {courseType} - {groupName}';
  organizationId = '';

  readonly builtInCourseTypes: EntityRecord[] = [
    { id: 'maktab', name: 'Maktab', code: 'MAKTAB', defaultStages: ['Miftah', 'Tilawatul Quran', 'Hifz'] },
    { id: 'aalim', name: 'Aalim', code: 'AALIM', defaultStages: ['Aalim 1', 'Aalim 2', 'Aalim 3', 'Aalim 4', 'Aalim 5', 'Aalim 6', 'Aalim 7'] },
    { id: 'hifz', name: 'Hifz', code: 'HIFZ', defaultStages: ['Sabaq', 'Sabaqi', 'Manzil'] },
    { id: 'muballigh', name: 'Muballigh', code: 'MUBALLIGH', defaultStages: ['Muballigh 1', 'Muballigh 2', 'Muballigh 3'] },
    { id: 'custom', name: 'Custom', code: 'CUSTOM', defaultStages: [] },
  ];

  readonly presets: Record<string, string[]> = {
    maktab: ['Miftah', 'Tilawatul Quran', 'Hifz'],
    hifz: ['Sabaq', 'Sabaqi', 'Manzil'],
    aalim: ['Aalim 1', 'Aalim 2', 'Aalim 3', 'Aalim 4', 'Aalim 5', 'Aalim 6', 'Aalim 7'],
    numbered: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5']
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CourseStagesDialogData,
    private dialogRef: MatDialogRef<CourseStagesDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.data?.mode) {
      this.mode = this.data.mode;
    }
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const orgId = profile?.organizationId || '';
      const isSuperAdmin = profile?.role === 'superAdmin';

      const allCourses = await this.repo.getAllOnce<EntityRecord>('courses', profile);
      const fetchedTypes = await this.repo.getAllOnce<EntityRecord>('courseTypes', profile);

      this.courses = isSuperAdmin ? allCourses : allCourses.filter(c => !c['organizationId'] || c['organizationId'] === orgId);

      const orgFetchedTypes = isSuperAdmin 
        ? fetchedTypes 
        : fetchedTypes.filter(t => !t['organizationId'] || t['organizationId'] === orgId);

      // Merge fetched types with builtIn if not already present
      const typeMap = new Map<string, EntityRecord>();
      this.builtInCourseTypes.forEach(t => typeMap.set(String(t.id).toLowerCase(), { ...t }));
      orgFetchedTypes.forEach(t => {
        const rawTypeId = String(t['originalTypeId'] || t['code'] || t.id).toLowerCase();
        const key = String(t['code'] || t['name'] || t.id).toLowerCase();
        if (t['status'] === 'disabled' || t['isDeleted'] === true || t['status'] === 'inactive') {
          typeMap.delete(rawTypeId);
          typeMap.delete(key);
        } else {
          typeMap.set(key, { ...t, name: t['name'] || t.id });
        }
      });
      this.courseTypes = Array.from(typeMap.values());

      const targetCourseId = this.data?.courseId || this.data?.course?.id;
      if (targetCourseId) {
        this.selectedCourseId = targetCourseId;
        this.mode = 'course';
      } else if (this.courses.length > 0) {
        this.selectedCourseId = String(this.courses[0].id);
      }

      if (this.courseTypes.length > 0) {
        this.selectedCourseTypeId = String(this.courseTypes[0].id);
      }

      this.onSelectionChange();
    } catch (e) {
      console.error('Failed to load stages data', e);
      this.snackBar.open('Failed to load courses list', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  onModeChange() {
    this.onSelectionChange();
  }

  onSelectionChange() {
    if (this.mode === 'course') {
      this.loadStagesForSelectedCourse();
    } else {
      this.loadStagesForSelectedCourseType();
    }
  }

  private buildHierarchyFromStagesList() {
    this.hierarchicalStages = [];
    const parentMap = new Map<string, StageHierarchyItem>();
    const existingDesc = (this.selectedCourse?.['stageDescriptions'] as Record<string, string>) || {};

    for (const raw of this.stagesList) {
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
        let item = parentMap.get(key);
        if (!item) {
          item = { name: parentName, subStages: [], description: existingDesc[parentName] || '', subStageDescriptions: {}, expanded: true };
          parentMap.set(key, item);
          this.hierarchicalStages.push(item);
        }
        if (!Array.isArray(item.subStages)) item.subStages = [];
        item.subStages.push(subName);

        const fullKey = `${parentName} - ${subName}`;
        if (!item.subStageDescriptions) item.subStageDescriptions = {};
        item.subStageDescriptions[subName] = existingDesc[fullKey] || existingDesc[subName] || '';
      } else {
        const key = name.toLowerCase();
        if (!parentMap.has(key)) {
          const item: StageHierarchyItem = { name, subStages: [], description: existingDesc[name] || '', subStageDescriptions: {}, expanded: true };
          parentMap.set(key, item);
          this.hierarchicalStages.push(item);
        }
      }
    }
  }

  getSubStageDescription(item: StageHierarchyItem, sub: string): string {
    return item.subStageDescriptions?.[sub] || '';
  }

  setSubStageDescription(item: StageHierarchyItem, sub: string, desc: string): void {
    if (!item.subStageDescriptions) item.subStageDescriptions = {};
    item.subStageDescriptions[sub] = desc;
  }

  syncStagesListFromHierarchy() {
    const list: string[] = [];
    for (const item of this.hierarchicalStages) {
      const parentName = item.name.trim();
      if (!parentName) continue;

      if (item.subStages && item.subStages.length > 0) {
        for (const subRaw of item.subStages) {
          const sub = subRaw.trim();
          if (!sub) continue;

          if (sub.toLowerCase().startsWith(parentName.toLowerCase())) {
            list.push(sub);
          } else {
            list.push(`${parentName} - ${sub}`);
          }
        }
      } else {
        list.push(parentName);
      }
    }
    this.stagesList = list;
  }

  addSubStage(parentIndex: number) {
    const item = this.hierarchicalStages[parentIndex];
    if (!item) return;
    const subText = (item.subStageInput || '').trim();
    const count = item.subStages.length + 1;

    let baseName = item.name.trim();
    if (/stage$/i.test(baseName)) {
      baseName = baseName.replace(/stage$/i, '').trim();
    }

    const subName = subText || (baseName ? `${baseName} Stage ${count}` : `Stage ${count}`);

    item.subStages.push(subName);
    item.subStageInput = '';
    item.expanded = true;
    this.syncStagesListFromHierarchy();
    this.snackBar.open(`Added sub-stage "${subName}" under ${item.name}`, 'Close', { duration: 2000 });
  }

  removeSubStage(parentIndex: number, subIndex: number) {
    const item = this.hierarchicalStages[parentIndex];
    if (item && item.subStages) {
      item.subStages.splice(subIndex, 1);
      this.syncStagesListFromHierarchy();
    }
  }

  addShift() {
    const shift = this.newShiftInput.trim();
    if (!shift) return;
    if (!this.standardShifts.map(s => s.toLowerCase()).includes(shift.toLowerCase())) {
      this.standardShifts.push(shift);
      this.newShiftInput = '';
      this.snackBar.open(`Added shift preset "${shift}"`, 'Close', { duration: 2000 });
    }
  }

  addMainStage() {
    const count = this.hierarchicalStages.length + 1;
    const item: StageHierarchyItem = {
      name: `Stage ${count}`,
      subStages: [],
      expanded: true
    };
    this.hierarchicalStages.push(item);
    this.syncStagesListFromHierarchy();
    this.snackBar.open(`Added Main Stage (${item.name})`, 'Close', { duration: 2000 });
  }

  removeShift(index: number) {
    this.standardShifts.splice(index, 1);
  }

  private loadStagesForSelectedCourse() {
    if (!this.selectedCourseId) {
      this.selectedCourse = null;
      this.stagesList = [];
      this.hierarchicalStages = [];
      return;
    }

    const course = this.courses.find(c => String(c.id) === this.selectedCourseId);
    this.selectedCourse = course || null;

    if (course) {
      const rawStages = course['stages'];
      if (Array.isArray(rawStages) && rawStages.length > 0) {
        this.stagesList = rawStages.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof rawStages === 'string' && rawStages.trim()) {
        this.stagesList = rawStages.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        const type = String(course['type'] || course['courseType'] || '').toLowerCase();
        const fallback = DEFAULT_STAGES_BY_COURSE_TYPE[type] || [];
        this.stagesList = [...fallback];
      }
    } else {
      this.stagesList = [];
    }
    this.buildHierarchyFromStagesList();
  }

  private loadStagesForSelectedCourseType() {
    if (!this.selectedCourseTypeId) {
      this.selectedCourseType = null;
      this.stagesList = [];
      this.hierarchicalStages = [];
      return;
    }

    const courseType = this.courseTypes.find(t => String(t.id).toLowerCase() === this.selectedCourseTypeId.toLowerCase());
    this.selectedCourseType = courseType || null;

    if (courseType) {
      const rawStages = courseType['defaultStages'] || courseType['stages'];
      if (Array.isArray(rawStages) && rawStages.length > 0) {
        this.stagesList = rawStages.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof rawStages === 'string' && rawStages.trim()) {
        this.stagesList = rawStages.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        const key = String(courseType['code'] || courseType['name'] || '').toLowerCase();
        const fallback = DEFAULT_STAGES_BY_COURSE_TYPE[key] || [];
        this.stagesList = [...fallback];
      }
    } else {
      this.stagesList = [];
    }
    this.buildHierarchyFromStagesList();
  }

  addBulkStages() {
    if (!this.bulkInputText.trim()) return;

    const newItems = this.bulkInputText
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    let addedCount = 0;
    for (const item of newItems) {
      if (!this.stagesList.map(s => s.toLowerCase()).includes(item.toLowerCase())) {
        this.stagesList.push(item);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.snackBar.open(`Added ${addedCount} stage(s)`, 'Close', { duration: 2500 });
      this.bulkInputText = '';
    } else {
      this.snackBar.open('No new stages added (already exist)', 'Close', { duration: 2500 });
    }
  }

  loadPreset(key: string) {
    const items = this.presets[key];
    if (!items) return;

    let addedCount = 0;
    for (const item of items) {
      if (!this.stagesList.map(s => s.toLowerCase()).includes(item.toLowerCase())) {
        this.stagesList.push(item);
        addedCount++;
      }
    }

    this.snackBar.open(`Loaded preset stage(s)`, 'Close', { duration: 2500 });
  }

  moveUp(index: number) {
    if (index <= 0) return;
    const temp = this.stagesList[index];
    this.stagesList[index] = this.stagesList[index - 1];
    this.stagesList[index - 1] = temp;
  }

  moveDown(index: number) {
    if (index >= this.stagesList.length - 1) return;
    const temp = this.stagesList[index];
    this.stagesList[index] = this.stagesList[index + 1];
    this.stagesList[index + 1] = temp;
  }

  removeStage(index: number) {
    this.stagesList.splice(index, 1);
  }

  clearAllStages() {
    if (confirm('Are you sure you want to clear all stages?')) {
      this.stagesList = [];
    }
  }

  trackByIndex(index: number, item?: any): number {
    return index;
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      this.syncStagesListFromHierarchy();
      const cleanStages = this.stagesList.map(s => s.trim()).filter(Boolean);

      if (profile?.organizationId) {
        await this.repo.update('organizations', profile.organizationId, {
          standardShifts: this.standardShifts,
          classNamePattern: this.classNamePattern,
          groupNamePattern: this.groupNamePattern
        }, profile).catch(err => console.warn('Could not update org naming rules', err));
      }

      const stageDescriptions: Record<string, string> = {};
      for (const item of this.hierarchicalStages) {
        const pName = (item.name || '').trim();
        if (!pName) continue;
        if (item.description?.trim()) {
          stageDescriptions[pName] = item.description.trim();
        }
        if (item.subStages && item.subStages.length > 0 && item.subStageDescriptions) {
          for (const sub of item.subStages) {
            const subName = (sub || '').trim();
            if (!subName) continue;
            const fullKey = `${pName} - ${subName}`;
            const desc = item.subStageDescriptions[subName];
            if (desc?.trim()) {
              stageDescriptions[fullKey] = desc.trim();
              stageDescriptions[subName] = desc.trim();
            }
          }
        }
      }

      if (this.mode === 'course') {
        if (!this.selectedCourseId || !this.selectedCourse) {
          this.snackBar.open('Please select a course first', 'Close', { duration: 3000 });
          return;
        }

        await this.repo.update('courses', this.selectedCourseId, {
          stages: cleanStages,
          stageDescriptions: stageDescriptions
        }, profile);

        this.selectedCourse['stages'] = cleanStages;
        this.selectedCourse['stageDescriptions'] = stageDescriptions;
        this.snackBar.open(`Stages & descriptions updated for course "${this.selectedCourse['name']}"`, 'Close', { duration: 3000 });
        this.dialogRef.close({ success: true, mode: 'course', id: this.selectedCourseId, stages: cleanStages, stageDescriptions });
      } else {
        // Save for Course Type
        if (!this.selectedCourseTypeId) {
          this.snackBar.open('Please select a course type first', 'Close', { duration: 3000 });
          return;
        }

        const typeRecord = this.courseTypes.find(t => String(t.id).toLowerCase() === this.selectedCourseTypeId.toLowerCase());
        const typeName = typeRecord ? (typeRecord['name'] || typeRecord.id) : this.selectedCourseTypeId;

        // If it's a persistent document in Firestore, update it
        if (typeRecord && typeRecord.id && !this.builtInCourseTypes.some(b => b.id === typeRecord.id)) {
          await this.repo.update('courseTypes', String(typeRecord.id), {
            defaultStages: cleanStages
          }, profile);
        } else {
          // If built-in type or new type, save/upsert in courseTypes collection
          await this.repo.create('courseTypes', {
            name: typeName,
            code: String(typeRecord?.['code'] || this.selectedCourseTypeId).toUpperCase(),
            defaultStages: cleanStages,
            status: 'active',
            organizationId: profile?.organizationId || ''
          }, profile);
        }

        // Update default stages fallback map in memory for current turn
        DEFAULT_STAGES_BY_COURSE_TYPE[this.selectedCourseTypeId.toLowerCase()] = cleanStages;

        this.snackBar.open(`Default stages updated for Course Type "${typeName}"`, 'Close', { duration: 3000 });
        this.dialogRef.close({ success: true, mode: 'courseType', type: this.selectedCourseTypeId, stages: cleanStages });
      }
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to save stages', 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }
}
