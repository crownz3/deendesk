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
  mode?: 'course' | 'courseType';
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

  mode: 'course' | 'courseType' = 'course';

  courses: EntityRecord[] = [];
  courseTypes: EntityRecord[] = [];

  selectedCourseId = '';
  selectedCourseTypeId = '';

  selectedCourse: EntityRecord | null = null;
  selectedCourseType: EntityRecord | null = null;

  stagesList: string[] = [];
  bulkInputText = '';

  readonly builtInCourseTypes: EntityRecord[] = [
    { id: 'maktab', name: 'Maktab', code: 'MAKTAB', defaultStages: ['Miftah', 'Tilawatul Quran', 'Hifz'] },
    { id: 'aalim', name: 'Aalim', code: 'AALIM', defaultStages: ['Aalim 1', 'Aalim 2', 'Aalim 3', 'Aalim 4', 'Aalim 5', 'Aalim 6', 'Aalim 7'] },
    { id: 'hifz', name: 'Hifz', code: 'HIFZ', defaultStages: ['Sabaq', 'Sabaqi', 'Manzil'] },
    { id: 'muballigh', name: 'Muballigh', code: 'MUBALLIGH', defaultStages: ['Muballigh 1', 'Muballigh 2', 'Muballigh 3'] },
    { id: 'custom', name: 'Custom', code: 'CUSTOM', defaultStages: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5'] },
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
      this.courses = await this.repo.getAllOnce<EntityRecord>('courses', profile);
      const fetchedTypes = await this.repo.getAllOnce<EntityRecord>('courseTypes', profile);

      // Merge fetched types with builtIn if not already present
      const typeMap = new Map<string, EntityRecord>();
      this.builtInCourseTypes.forEach(t => typeMap.set(String(t.id).toLowerCase(), t));
      fetchedTypes.forEach(t => {
        const key = String(t['code'] || t['name'] || t.id).toLowerCase();
        typeMap.set(key, { ...t, name: t['name'] || t.id });
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

  private loadStagesForSelectedCourse() {
    if (!this.selectedCourseId) {
      this.selectedCourse = null;
      this.stagesList = [];
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
        const fallback = DEFAULT_STAGES_BY_COURSE_TYPE[type] || DEFAULT_STAGES_BY_COURSE_TYPE['custom'];
        this.stagesList = [...fallback];
      }
    } else {
      this.stagesList = [];
    }
  }

  private loadStagesForSelectedCourseType() {
    if (!this.selectedCourseTypeId) {
      this.selectedCourseType = null;
      this.stagesList = [];
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
        const fallback = DEFAULT_STAGES_BY_COURSE_TYPE[key] || DEFAULT_STAGES_BY_COURSE_TYPE['custom'];
        this.stagesList = [...fallback];
      }
    } else {
      this.stagesList = [];
    }
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

  trackByIndex(index: number, item: string) {
    return index;
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const cleanStages = this.stagesList.map(s => s.trim()).filter(Boolean);

      if (this.mode === 'course') {
        if (!this.selectedCourseId || !this.selectedCourse) {
          this.snackBar.open('Please select a course first', 'Close', { duration: 3000 });
          return;
        }

        await this.repo.update('courses', this.selectedCourseId, {
          stages: cleanStages
        }, profile);

        this.selectedCourse['stages'] = cleanStages;
        this.snackBar.open(`Stages updated for course "${this.selectedCourse['name']}"`, 'Close', { duration: 3000 });
        this.dialogRef.close({ success: true, mode: 'course', id: this.selectedCourseId, stages: cleanStages });
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
