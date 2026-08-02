import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../core/constants/defaults';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { QuickAddDialogComponent } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CourseMadrasasDialogComponent } from '../management/course-madrasas-dialog/course-madrasas-dialog.component';

export interface StageHierarchyItem {
  name: string;
  subStages: string[];
  expanded?: boolean;
  subStageInput?: string;
}

@Component({
  selector: 'app-course-catalog-page',
  templateUrl: './course-catalog.page.html',
  styleUrls: ['./course-catalog.page.scss'],
  standalone: false,
})
export class CourseCatalogPage implements OnInit {
  loading = true;
  saving = false;

  activeTab: 'catalog' | 'stages' | 'naming' = 'catalog';

  courses: EntityRecord[] = [];
  masterCourses: EntityRecord[] = [];
  madrasaCourses: EntityRecord[] = [];
  allMadrasas: EntityRecord[] = [];
  courseTypes: EntityRecord[] = [];
  isOrgAdminOrCoordinator = false;

  selectedCourseId = '';
  selectedCourseTypeId = '';
  selectedCourse: EntityRecord | null = null;
  selectedCourseType: EntityRecord | null = null;
  mode: 'course' | 'courseType' = 'courseType';

  stagesList: string[] = [];
  hierarchicalStages: StageHierarchyItem[] = [];
  bulkInputText = '';

  // Organization Naming Rules
  standardShifts: string[] = ['Morning', 'Evening', 'After Maghrib', 'After Isha'];
  newShiftInput = '';
  classNamePattern = '{madrasaCode} - {shift}';
  groupNamePattern = '{shift} - {courseType} - {groupName}';

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
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  trackByIndex(index: number, item?: any): number {
    return index;
  }

  ngOnInit(): void {
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
      this.allMadrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => []);

      const role = profile?.role;
      this.isOrgAdminOrCoordinator = role === 'organizationAdmin' || role === 'superAdmin' || role === 'coordinator';

      const scopedCourses = isSuperAdmin ? allCourses : allCourses.filter(c => !c['organizationId'] || c['organizationId'] === orgId);
      this.courses = scopedCourses;
      this.masterCourses = scopedCourses.filter(c => !c['madrasaId']);
      this.madrasaCourses = scopedCourses.filter(c => !!c['madrasaId']);

      if (!this.isOrgAdminOrCoordinator) {
        const myMadrasaId = (profile as any)?.madrasaId || (profile as any)?.primaryMadrasaId || '';
        if (myMadrasaId) {
          this.madrasaCourses = this.madrasaCourses.filter(c => c['madrasaId'] === myMadrasaId);
          this.allMadrasas = this.allMadrasas.filter(m => String(m.id) === myMadrasaId);
        }
      }

      const orgFetchedTypes = isSuperAdmin 
        ? fetchedTypes 
        : fetchedTypes.filter(t => !t['organizationId'] || t['organizationId'] === orgId);

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

      if (this.courseTypes.length > 0) {
        this.selectedCourseTypeId = String(this.courseTypes[0].id);
      }
      if (this.courses.length > 0) {
        this.selectedCourseId = String(this.courses[0].id);
      }

      // Fetch org naming rules if available
      if (profile?.organizationId) {
        const orgs = await this.repo.getAllOnce<EntityRecord>('organizations', profile);
        const myOrg = orgs.find(o => o.id === profile.organizationId);
        if (myOrg) {
          if (Array.isArray(myOrg['standardShifts']) && myOrg['standardShifts'].length) {
            this.standardShifts = myOrg['standardShifts'].map(String);
          }
          if (myOrg['classNamePattern']) this.classNamePattern = String(myOrg['classNamePattern']);
          if (myOrg['groupNamePattern']) this.groupNamePattern = String(myOrg['groupNamePattern']);
        }
      }

      this.onSelectionChange();
    } catch (e) {
      console.error('Failed to load course catalog data', e);
      this.snackBar.open('Failed to load course catalog', 'Close', { duration: 3000 });
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
          item = { name: parentName, subStages: [], expanded: true };
          parentMap.set(key, item);
          this.hierarchicalStages.push(item);
        }
        if (!Array.isArray(item.subStages)) item.subStages = [];
        item.subStages.push(subName);
      } else {
        const key = name.toLowerCase();
        if (!parentMap.has(key)) {
          const item: StageHierarchyItem = { name, subStages: [], expanded: true };
          parentMap.set(key, item);
          this.hierarchicalStages.push(item);
        }
      }
    }
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

  parseStageHierarchy(stages: any[]): { main: string; subStages: string[] }[] {
    if (!Array.isArray(stages) || !stages.length) return [];
    const result: { main: string; subStages: string[] }[] = [];
    const map = new Map<string, { main: string; subStages: string[] }>();

    for (const raw of stages) {
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
        if (!Array.isArray(entry.subStages)) entry.subStages = [];
        entry.subStages.push(subName);
      } else {
        const key = name.toLowerCase();
        if (!map.has(key)) {
          const entry = { main: name, subStages: [] };
          map.set(key, entry);
          result.push(entry);
        }
      }
    }
    return result;
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
      this.buildHierarchyFromStagesList();
      this.snackBar.open(`Added ${addedCount} stage(s)`, 'Close', { duration: 2500 });
      this.bulkInputText = '';
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
    this.buildHierarchyFromStagesList();
    this.snackBar.open(`Loaded preset stage(s)`, 'Close', { duration: 2500 });
  }

  moveUp(index: number) {
    if (index <= 0) return;
    const temp = this.hierarchicalStages[index];
    this.hierarchicalStages[index] = this.hierarchicalStages[index - 1];
    this.hierarchicalStages[index - 1] = temp;
    this.syncStagesListFromHierarchy();
  }

  moveDown(index: number) {
    if (index >= this.hierarchicalStages.length - 1) return;
    const temp = this.hierarchicalStages[index];
    this.hierarchicalStages[index] = this.hierarchicalStages[index + 1];
    this.hierarchicalStages[index + 1] = temp;
    this.syncStagesListFromHierarchy();
  }

  removeStage(index: number) {
    this.hierarchicalStages.splice(index, 1);
    this.syncStagesListFromHierarchy();
  }

  clearAllStages() {
    if (confirm('Are you sure you want to clear all stages?')) {
      this.hierarchicalStages = [];
      this.stagesList = [];
    }
  }

  getCoursesForType(type: EntityRecord): EntityRecord[] {
    const typeCode = String(type['code'] || type.id).toLowerCase();
    const typeName = String(type['name'] || type.id).toLowerCase();

    // Prefer master courses (created at org level without madrasaId)
    let list = this.masterCourses.filter(c => {
      const ct = String(c['type'] || c['courseType'] || '').toLowerCase();
      return ct === typeCode || ct === typeName || ct === String(type.id).toLowerCase();
    });

    // Fallback: If no master course exists yet, show deduplicated madrasa courses by name/code
    if (!list.length) {
      const mList = this.madrasaCourses.filter(c => {
        const ct = String(c['type'] || c['courseType'] || '').toLowerCase();
        return ct === typeCode || ct === typeName || ct === String(type.id).toLowerCase();
      });
      const seen = new Set<string>();
      list = mList.filter(c => {
        const key = String(c['code'] || c['name'] || c.id).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return list;
  }

  getMadrasaUsageForCourse(course: EntityRecord): { count: number; madrasaNames: string[] } {
    const code = String(course['code'] || '').toLowerCase().trim();
    const name = String(course['name'] || '').toLowerCase().trim();
    const masterId = String(course.id || '').toLowerCase().trim();

    const matching = this.madrasaCourses.filter(c => {
      const cCode = String(c['code'] || '').toLowerCase().trim();
      const cName = String(c['name'] || '').toLowerCase().trim();
      const cBaseId = String(c['baseCourseId'] || c['masterCourseId'] || '').toLowerCase().trim();

      return (masterId && cBaseId === masterId) ||
             (code && cCode === code) ||
             (name && cName === name);
    });

    const madrasaIds = Array.from(new Set(matching.map(c => String(c['madrasaId'] || '')).filter(Boolean)));
    const madrasaNames = madrasaIds.map(mId => {
      const m = this.allMadrasas.find(mDoc => String(mDoc.id) === mId || String(mDoc['code'] || '').toLowerCase() === mId.toLowerCase());
      return m ? String(m['name'] || m['title'] || mId) : (mId.length > 15 ? 'Madrasa' : mId);
    });

    return {
      count: madrasaNames.length,
      madrasaNames
    };
  }

  getMadrasaUsageForType(type: EntityRecord): { count: number; madrasaNames: string[] } {
    const typeCode = String(type['code'] || type.id).toLowerCase().trim();
    const typeName = String(type['name'] || type.id).toLowerCase().trim();

    const matching = this.madrasaCourses.filter(c => {
      const ct = String(c['type'] || c['courseType'] || '').toLowerCase().trim();
      return ct === typeCode || ct === typeName || ct === String(type.id).toLowerCase().trim();
    });

    const madrasaIds = Array.from(new Set(matching.map(c => String(c['madrasaId'] || '')).filter(Boolean)));
    const madrasaNames = madrasaIds.map(mId => {
      const m = this.allMadrasas.find(mDoc => String(mDoc.id) === mId || String(mDoc['code'] || '').toLowerCase() === mId.toLowerCase());
      return m ? String(m['name'] || m['title'] || mId) : (mId.length > 15 ? 'Madrasa' : mId);
    });

    return {
      count: madrasaNames.length,
      madrasaNames
    };
  }

  @ViewChild('madrasasListDialog') madrasasListDialog!: TemplateRef<unknown>;
  activeMadrasasDialogTitle = '';
  activeMadrasaNames: string[] = [];
  madrasaSearchQuery = '';

  openMadrasasDialog(title: string, madrasaNames: string[], course?: EntityRecord) {
    if (!this.isOrgAdminOrCoordinator) return;

    this.dialog.open(CourseMadrasasDialogComponent, {
      data: {
        courseId: course ? String(course.id) : undefined,
        courseName: title,
        courseCode: course ? String(course['code'] || '') : undefined,
        madrasaNames: madrasaNames || []
      },
      width: '560px'
    });
  }

  getFilteredMadrasaNames(): string[] {
    const q = (this.madrasaSearchQuery || '').trim().toLowerCase();
    if (!q) return this.activeMadrasaNames;
    return this.activeMadrasaNames.filter(name => name.toLowerCase().includes(q));
  }

  openAddCourse() {
    // Filter course types that do not have a course yet
    const availableTypes = this.courseTypes.filter(t => this.getCoursesForType(t).length === 0);
    if (availableTypes.length === 0) {
      this.snackBar.open('All course types already have a course created.', 'Close', { duration: 3000 });
      return;
    }

    const typeOptions = availableTypes.map(t => ({ label: String(t['name'] || t.id), value: String(t['code'] || t.id).toLowerCase() }));

    this.dialog.open(QuickAddDialogComponent, {
      data: {
        title: 'Step 1: Select Course Type',
        fields: [
          { key: 'type', label: 'Course Type', type: 'select', required: true, options: typeOptions },
        ],
        submitLabel: 'Next: Configure Course'
      },
      width: '440px'
    }).afterClosed().subscribe(step1 => {
      if (!step1?.value?.type) return;
      const selectedType = this.courseTypes.find(t =>
        String(t['code'] || t.id).toLowerCase() === step1.value.type ||
        String(t.id).toLowerCase() === step1.value.type
      );
      if (!selectedType) return;
      this.openCourseForm(selectedType);
    });
  }

  openAddCourseForType(type: EntityRecord) {
    this.openCourseForm(type);
  }

  private async openCourseForm(type: EntityRecord) {
    const typeName = String(type['name'] || type.id);
    const typeCode = String(type['code'] || type.id).toLowerCase();
    const profile = await firstValueFrom(this.auth.profile$);

    this.dialog.open(QuickAddDialogComponent, {
      data: {
        title: `Add Course — ${typeName}`,
        subtitle: `Configure a new course under the ${typeName} course type.`,
        fields: [
          {
            key: 'name',
            label: 'Course Name',
            type: 'text',
            required: true,
            placeholder: `e.g. ${typeName} Course`
          },
          {
            key: 'code',
            label: 'Course Code',
            type: 'text',
            required: true,
            placeholder: `e.g. ${typeCode.toUpperCase()}-01`
          },
          {
            key: 'hasFixedDuration',
            label: 'Does this course have a fixed duration?',
            type: 'select',
            options: [
              { label: 'Yes — Fixed Duration in Years', value: true as any },
              { label: 'No — Flexible / Ongoing', value: false as any }
            ]
          },
          {
            key: 'courseDurationYears',
            label: 'Course Duration (Years)',
            type: 'select',
            options: [1,2,3,4,5,6,7,8,9,10].map(n => ({ label: `${n} Year${n > 1 ? 's' : ''}`, value: n }))
          },
          {
            key: 'promotionRule',
            label: 'Promotion Exam Rule',
            type: 'select',
            options: [
              { label: 'Mandatory Exam Pass', value: 'exam_mandatory' },
              { label: 'Optional Exam / Manual Teacher Override', value: 'exam_optional_manual' },
              { label: 'Daur Count Completion', value: 'daur_count_required' },
            ]
          },
          {
            key: 'requiredDaurCount',
            label: 'Required Daur Count',
            type: 'text',
            placeholder: 'Enter required Daur count (e.g. 1, 2, 3, 5...)'
          },
          {
            key: 'evaluationMode',
            label: 'Daily Evaluation Mode',
            type: 'select',
            options: [
              { label: 'Portion-Based (Sabaq / Sabqi / Manzil / Daur)', value: 'portion_based' },
              { label: 'Subject-Based (Kitabs / Books)', value: 'subject_based' },
              { label: 'Hybrid (Both Portion & Subject Evaluation)', value: 'hybrid' },
            ]
          },
          {
            key: 'hasSubjects',
            label: 'Subject Scoping',
            type: 'select',
            options: [
              { label: 'Yes — Has Multiple Subjects', value: true },
              { label: 'No — Single Subject / General Course', value: false }
            ]
          },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea'
          },
        ],
        saveFn: async (formValue: Record<string, unknown>) => {
          const stages = (type['defaultStages'] as string[] || type['stages'] as string[] || []);
          const isFixed = formValue['hasFixedDuration'] === true || formValue['hasFixedDuration'] === 'true';

          await this.repo.create('courses', {
            name: formValue['name'],
            code: formValue['code'],
            type: typeCode,
            hasFixedDuration: isFixed,
            courseDurationYears: isFixed && formValue['courseDurationYears'] ? Number(formValue['courseDurationYears']) : null,
            promotionRule: formValue['promotionRule'] || null,
            requiredDaurCount: formValue['promotionRule'] === 'daur_count_required' && formValue['requiredDaurCount'] ? Number(formValue['requiredDaurCount']) : null,
            evaluationMode: formValue['evaluationMode'] || null,
            hasSubjects: (formValue['hasSubjects'] !== undefined && formValue['hasSubjects'] !== null && formValue['hasSubjects'] !== '') ? Boolean(formValue['hasSubjects']) : null,
            stages,
            description: formValue['description'] || '',
            organizationId: profile?.organizationId || '',
            status: 'active',
          }, profile);
        }
      },
      width: '580px'
    }).afterClosed().subscribe(res => {
      if (res?.value) this.loadData();
    });
  }

  async openEditCourse(course: EntityRecord) {
    const courseName = String(course['name'] || course.id);
    const profile = await firstValueFrom(this.auth.profile$);
    const hasFixedDur = course['hasFixedDuration'] ?? (course['courseDurationYears'] ? true : false);

    this.dialog.open(QuickAddDialogComponent, {
      data: {
        title: `Edit Course — ${courseName}`,
        initialValue: {
          name: course['name'],
          code: course['code'],
          hasFixedDuration: hasFixedDur,
          courseDurationYears: course['courseDurationYears'] ?? null,
          promotionRule: course['promotionRule'] ?? null,
          requiredDaurCount: course['requiredDaurCount'] ?? null,
          evaluationMode: course['evaluationMode'] ?? null,
          hasSubjects: course['hasSubjects'] ?? null,
          description: course['description'] ?? '',
        },
        fields: [
          {
            key: 'name',
            label: 'Course Name',
            type: 'text',
            required: true,
          },
          {
            key: 'code',
            label: 'Course Code',
            type: 'text',
            required: true,
          },
          {
            key: 'hasFixedDuration',
            label: 'Does this course have a fixed duration?',
            type: 'select',
            options: [
              { label: 'Yes — Fixed Duration in Years', value: true as any },
              { label: 'No — Flexible / Ongoing', value: false as any }
            ]
          },
          {
            key: 'courseDurationYears',
            label: 'Course Duration (Years)',
            type: 'select',
            options: [1,2,3,4,5,6,7,8,9,10].map(n => ({ label: `${n} Year${n > 1 ? 's' : ''}`, value: n }))
          },
          {
            key: 'promotionRule',
            label: 'Promotion Exam Rule',
            type: 'select',
            options: [
              { label: 'Mandatory Exam Pass', value: 'exam_mandatory' },
              { label: 'Optional Exam / Manual Teacher Override', value: 'exam_optional_manual' },
              { label: 'Daur Count Completion', value: 'daur_count_required' },
            ]
          },
          {
            key: 'requiredDaurCount',
            label: 'Required Daur Count',
            type: 'text',
            placeholder: 'Enter required Daur count (e.g. 1, 2, 3, 5...)'
          },
          {
            key: 'evaluationMode',
            label: 'Daily Evaluation Mode',
            type: 'select',
            options: [
              { label: 'Portion-Based (Sabaq / Sabqi / Manzil / Daur)', value: 'portion_based' },
              { label: 'Subject-Based (Kitabs / Books)', value: 'subject_based' },
              { label: 'Hybrid (Both Portion & Subject Evaluation)', value: 'hybrid' },
            ]
          },
          {
            key: 'hasSubjects',
            label: 'Subject Scoping',
            type: 'select',
            options: [
              { label: 'Yes — Has Multiple Subjects', value: true },
              { label: 'No — Single Subject / General Course', value: false }
            ]
          },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea'
          },
        ],
        saveFn: async (formValue: Record<string, unknown>) => {
          const isFixed = formValue['hasFixedDuration'] === true || formValue['hasFixedDuration'] === 'true';

          await this.repo.update('courses', String(course.id), {
            name: formValue['name'],
            code: formValue['code'],
            hasFixedDuration: isFixed,
            courseDurationYears: isFixed && formValue['courseDurationYears'] ? Number(formValue['courseDurationYears']) : null,
            promotionRule: formValue['promotionRule'] || null,
            requiredDaurCount: formValue['promotionRule'] === 'daur_count_required' && formValue['requiredDaurCount'] ? Number(formValue['requiredDaurCount']) : null,
            evaluationMode: formValue['evaluationMode'] || null,
            hasSubjects: (formValue['hasSubjects'] !== undefined && formValue['hasSubjects'] !== null && formValue['hasSubjects'] !== '') ? Boolean(formValue['hasSubjects']) : null,
            description: formValue['description'] || '',
          }, profile);
        }
      },
      width: '580px'
    }).afterClosed().subscribe(res => {
      if (res?.value) this.loadData();
    });
  }


  async deleteCourseType(type: EntityRecord) {
    const typeName = type['name'] || type.id;
    const typeId = String(type.id || '').toLowerCase();
    const typeCode = String(type['code'] || type.id).toUpperCase();

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Delete Course Type',
          message: `Are you sure you want to delete course type "${typeName}"?`,
          confirmText: 'Delete',
          cancelText: 'Cancel'
        }
      }).afterClosed()
    );

    if (!confirmed) return;

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const orgId = profile?.organizationId || '';

      if (type.id && !this.builtInCourseTypes.some(b => b.id === type.id)) {
        await this.repo.remove('courseTypes', String(type.id)).catch(() => {});
      }

      const disabledDocId = orgId ? `${orgId}_${typeId}` : typeId;

      await this.repo.create('courseTypes', {
        id: disabledDocId,
        originalTypeId: typeId,
        code: typeCode,
        name: typeName,
        status: 'disabled',
        isDeleted: true,
        organizationId: orgId
      }, profile).catch(async () => {
        await this.repo.update('courseTypes', disabledDocId, {
          status: 'disabled',
          isDeleted: true
        }, profile).catch(() => {});
      });

      this.snackBar.open(`Course Type "${typeName}" deleted successfully`, 'Close', { duration: 3000 });
      await this.loadData();
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to delete course type', 'Close', { duration: 4000 });
    }
  }

  async deleteCourse(course: EntityRecord) {
    const courseName = course['name'] || course.id;
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Delete Course',
          message: `Are you sure you want to delete course "${courseName}"?`,
          confirmText: 'Delete',
          cancelText: 'Cancel'
        }
      }).afterClosed()
    );

    if (!confirmed) return;

    try {
      if (course.id) {
        await this.repo.remove('courses', String(course.id));
      }
      this.snackBar.open(`Course "${courseName}" deleted successfully`, 'Close', { duration: 3000 });
      this.loadData();
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to delete course', 'Close', { duration: 4000 });
    }
  }

  async saveAll() {
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

      if (this.mode === 'course' && this.selectedCourseId) {
        await this.repo.update('courses', this.selectedCourseId, { stages: cleanStages }, profile);
      } else if (this.selectedCourseTypeId) {
        const typeRecord = this.courseTypes.find(t => String(t.id).toLowerCase() === this.selectedCourseTypeId.toLowerCase());
        const typeName = typeRecord ? (typeRecord['name'] || typeRecord.id) : this.selectedCourseTypeId;
        if (typeRecord && typeRecord.id && !this.builtInCourseTypes.some(b => b.id === typeRecord.id)) {
          await this.repo.update('courseTypes', String(typeRecord.id), { defaultStages: cleanStages }, profile);
        } else {
          await this.repo.create('courseTypes', {
            name: typeName,
            code: String(typeRecord?.['code'] || this.selectedCourseTypeId).toUpperCase(),
            defaultStages: cleanStages,
            status: 'active',
            organizationId: profile?.organizationId || ''
          }, profile);
        }
      }

      this.snackBar.open('Course Catalog & Naming Rules updated successfully!', 'Close', { duration: 3500 });
      this.loadData();
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to save settings', 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }
}
