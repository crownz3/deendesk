import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../../core/constants/defaults';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StageInfoDialogComponent } from '../../../shared/components/stage-info-dialog/stage-info-dialog.component';

export interface PromoteDemoteData {
  student?: EntityRecord;
  students?: EntityRecord[];
}

@Component({
  selector: 'app-promote-demote-dialog',
  templateUrl: './promote-demote-dialog.component.html',
  styleUrls: ['./promote-demote-dialog.component.scss'],
  standalone: false,
})
export class PromoteDemoteDialogComponent implements OnInit {
  loading = true;
  saving = false;

  targetStudents: EntityRecord[] = [];
  firstStudent: EntityRecord | null = null;

  action = 'promotion';
  newStage = '';
  reason = '';
  
  availableStages: string[] = [];
  stageHierarchy: { name: string; subStages: string[] }[] = [];
  selectedMainStage = '';
  selectedSubStage = '';
  hasSubStagesForCourse = false;

  selectedStageOption = '';
  customNewStage = '';
  isCustomStage = false;
  currentCourseRecord: EntityRecord | null = null;

  courseName = 'None';
  className = 'None';
  groupName = 'None';
  staffNames = 'None';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PromoteDemoteData,
    private dialogRef: MatDialogRef<PromoteDemoteDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.targetStudents = data.students?.length ? data.students : (data.student ? [data.student] : []);
    this.firstStudent = this.targetStudents[0] || null;
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      if (!this.firstStudent) return;
      const profile = await firstValueFrom(this.auth.profile$);
      
      const [courses, classes, groups] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('courses', profile),
        this.repo.getAllOnce<EntityRecord>('classes', profile),
        this.repo.getAllOnce<EntityRecord>('classGroups', profile),
      ]);

      const courseId = this.firstStudent['courseId'];
      if (courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          this.currentCourseRecord = course;
          this.courseName = String(course['name'] || courseId);
          this.extractStages(course);
        }
      }
      this.autoSelectStage();

      const classId = this.firstStudent['classId'];
      if (classId) {
        const cls = classes.find(c => c.id === classId);
        if (cls) this.className = String(cls['name'] || classId);
      }

      const groupId = this.firstStudent['groupId'];
      if (groupId) {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          this.groupName = String(group['name'] || groupId);
          const staffIds = Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'] : [];
          if (staffIds.length > 0) {
            const staffList = await this.repo.getAllOnce<EntityRecord>('staff', profile);
            const assignedStaff = staffList.filter(s => staffIds.includes(String(s.id)));
            if (assignedStaff.length > 0) {
              this.staffNames = assignedStaff.map(s => s['displayName'] || s['name'] || s['email']).join(', ');
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load staff details', e);
    } finally {
      this.loading = false;
    }
  }

  private extractStages(course: EntityRecord) {
    let stages: string[] = [];
    const rawStages = course['stages'];
    const rawHierarchy = course['stageHierarchy'];
    const duration = Number(course['courseDurationYears'] || 0);

    if (Array.isArray(rawStages) && rawStages.length) {
      stages = rawStages.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof rawStages === 'string' && rawStages.trim()) {
      stages = rawStages.split(',').map(s => s.trim()).filter(Boolean);
    } else if (duration > 0) {
      for (let i = 1; i <= duration; i++) {
        stages.push(`Year ${i}`);
      }
    } else {
      const type = String(course['type'] || course['courseType'] || '').toLowerCase();
      stages = [...(DEFAULT_STAGES_BY_COURSE_TYPE[type] || [])];
    }

    this.availableStages = Array.from(new Set(stages));

    // Build stageHierarchy
    const hierarchyMap = new Map<string, string[]>();

    if (Array.isArray(rawHierarchy) && rawHierarchy.length > 0) {
      rawHierarchy.forEach((item: any) => {
        const name = String(item.name || item.title || '').trim();
        const subs = Array.isArray(item.subStages) ? item.subStages.map((s: any) => String(s).trim()).filter(Boolean) : [];
        if (name) {
          hierarchyMap.set(name, subs);
        }
      });
    }

    if (hierarchyMap.size === 0) {
      // Parse hierarchy from availableStages (e.g. "Miftah 1", "Miftah 2" or "Miftah - Stage 1")
      for (const st of this.availableStages) {
        let parentName = '';
        let subName = '';

        const dashMatch = st.match(/^(.+?)\s*[-:]\s*(.+)$/);
        if (dashMatch) {
          parentName = dashMatch[1].trim();
          subName = dashMatch[2].trim();
        } else {
          const spaceNumMatch = st.match(/^([A-Za-z\s]+?)\s+(\d+|[A-Z]|Year\s*\d+|Stage\s*\d+)$/i);
          if (spaceNumMatch) {
            parentName = spaceNumMatch[1].trim();
            subName = st.trim();
          }
        }

        if (parentName && subName) {
          if (!hierarchyMap.has(parentName)) {
            hierarchyMap.set(parentName, []);
          }
          hierarchyMap.get(parentName)!.push(subName);
        } else {
          if (!hierarchyMap.has(st)) {
            hierarchyMap.set(st, []);
          }
        }
      }
    }

    this.stageHierarchy = Array.from(hierarchyMap.entries()).map(([name, subStages]) => ({
      name,
      subStages: Array.from(new Set(subStages))
    }));

    this.hasSubStagesForCourse = this.stageHierarchy.some(h => h.subStages.length > 0);
  }

  getOrderedFullStages(): { main: string; sub: string; full: string }[] {
    const list: { main: string; sub: string; full: string }[] = [];
    if (this.stageHierarchy && this.stageHierarchy.length > 0) {
      for (const h of this.stageHierarchy) {
        if (h.subStages && h.subStages.length > 0) {
          for (const sub of h.subStages) {
            const full = this.formatStageWithHyphen(h.name, sub);
            list.push({ main: h.name, sub, full });
          }
        } else {
          list.push({ main: h.name, sub: '', full: h.name });
        }
      }
    } else {
      for (const st of this.availableStages) {
        list.push({ main: st, sub: '', full: st });
      }
    }
    return list;
  }

  onActionChange() {
    this.autoSelectStage();
  }

  autoSelectStage() {
    const currentRaw = String(this.firstStudent?.['stage'] || '').trim();
    const current = currentRaw.toLowerCase();
    const ordered = this.getOrderedFullStages();

    if (ordered.length === 0) return;

    let idx = -1;
    if (current) {
      idx = ordered.findIndex(item => {
        const fullLower = item.full.toLowerCase();
        const subLower = item.sub.toLowerCase();
        const mainLower = item.main.toLowerCase();

        return fullLower === current ||
               subLower === current ||
               fullLower.startsWith(current + ' ') ||
               fullLower.startsWith(current + ' -') ||
               current.startsWith(fullLower);
      });
    }

    let targetItem: { main: string; sub: string; full: string };

    if (this.action === 'promotion') {
      if (idx >= 0 && idx < ordered.length - 1) {
        targetItem = ordered[idx + 1];
      } else if (idx === -1) {
        targetItem = ordered[0];
      } else {
        targetItem = ordered[ordered.length - 1];
      }
    } else {
      // Demotion
      if (idx > 0) {
        targetItem = ordered[idx - 1];
      } else {
        targetItem = ordered[0];
      }
    }

    this.selectedMainStage = targetItem.main;
    this.selectedSubStage = targetItem.sub;
    this.newStage = targetItem.full;
    this.selectedStageOption = targetItem.full;
    this.isCustomStage = false;
  }

  getCurrentStageIndex(): number {
    const currentRaw = String(this.firstStudent?.['stage'] || '').trim();
    if (!currentRaw) return -1;
    const current = currentRaw.toLowerCase();
    const ordered = this.getOrderedFullStages();

    return ordered.findIndex(item => {
      const fullLower = item.full.toLowerCase();
      const subLower = item.sub.toLowerCase();
      return fullLower === current ||
             subLower === current ||
             fullLower.startsWith(current + ' ') ||
             fullLower.startsWith(current + ' -') ||
             current.startsWith(fullLower);
    });
  }

  isStageItemDisabled(mainName: string, subName?: string): boolean {
    if (this.targetStudents.length > 1) return false;
    const currentIdx = this.getCurrentStageIndex();
    if (currentIdx === -1) return false;

    const ordered = this.getOrderedFullStages();
    let targetIdx = -1;

    if (subName) {
      const fullTarget = this.formatStageWithHyphen(mainName, subName).toLowerCase();
      targetIdx = ordered.findIndex(item =>
        item.full.toLowerCase() === fullTarget ||
        (item.main.toLowerCase() === mainName.toLowerCase() && item.sub.toLowerCase() === subName.toLowerCase())
      );
    } else {
      const mainLower = mainName.toLowerCase();
      targetIdx = ordered.findIndex(item => item.main.toLowerCase() === mainLower || item.full.toLowerCase() === mainLower);
    }

    if (targetIdx === -1) return false;

    if (this.action === 'promotion') {
      return targetIdx <= currentIdx;
    } else {
      return targetIdx >= currentIdx;
    }
  }

  isMainStageDisabled(mainName: string): boolean {
    if (this.targetStudents.length > 1) return false;
    const item = this.stageHierarchy.find(h => h.name === mainName);
    if (!item) return false;

    if (item.subStages && item.subStages.length > 0) {
      return item.subStages.every(sub => this.isStageItemDisabled(mainName, sub));
    }

    return this.isStageItemDisabled(mainName);
  }

  onMainStageChange(mainName: string) {
    this.selectedMainStage = mainName;
    const item = this.stageHierarchy.find(h => h.name === mainName);
    if (item && item.subStages.length > 0) {
      const allowedSubs = item.subStages.filter(sub => !this.isStageItemDisabled(mainName, sub));
      if (allowedSubs.length > 0) {
        this.selectedSubStage = this.action === 'demotion' ? allowedSubs[allowedSubs.length - 1] : allowedSubs[0];
      } else {
        this.selectedSubStage = item.subStages[0];
      }
      this.newStage = this.formatStageWithHyphen(mainName, this.selectedSubStage);
    } else {
      this.selectedSubStage = '';
      this.newStage = mainName;
    }
    this.selectedStageOption = this.newStage;
  }

  syncMainAndSubStageFromNewStage(stageVal: string) {
    if (!stageVal) return;
    const lower = stageVal.trim().toLowerCase();
    const ordered = this.getOrderedFullStages();

    const match = ordered.find(item =>
      item.full.toLowerCase() === lower ||
      item.sub.toLowerCase() === lower ||
      item.main.toLowerCase() === lower
    );

    if (match) {
      this.selectedMainStage = match.main;
      this.selectedSubStage = match.sub;
      this.newStage = match.full;
    } else if (this.stageHierarchy.length > 0) {
      this.selectedMainStage = this.stageHierarchy[0].name;
      const subs = this.stageHierarchy[0].subStages;
      this.selectedSubStage = subs.length > 0 ? subs[0] : '';
      this.newStage = stageVal;
    }
  }

  showStageInfo(): void {
    const course = this.currentCourseRecord;
    const courseName = course ? String(course['name'] || course.id) : this.courseName;
    const mainStage = this.selectedMainStage || this.selectedStageOption || '';
    const subStage = this.selectedSubStage || '';
    const stageDescriptions = (course?.['stageDescriptions'] as Record<string, string>) || {};

    const fullStageKey = subStage ? `${mainStage} - ${subStage}` : mainStage;
    const description = stageDescriptions[fullStageKey] || stageDescriptions[mainStage] || stageDescriptions[subStage] || (course?.['description'] as string) || '';

    const subStagesList = this.getSubStagesForMainStage(mainStage).map(sub => ({
      name: sub,
      description: stageDescriptions[`${mainStage} - ${sub}`] || stageDescriptions[sub] || ''
    }));

    this.dialog.open(StageInfoDialogComponent, {
      data: {
        title: 'Target Stage Syllabus & Information',
        courseName,
        stageName: mainStage || 'Course Overview',
        subStageName: subStage,
        description,
        subStages: subStagesList
      },
      width: '480px'
    });
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

  formatStageDisplay(val: any): string {
    if (!val || val === 'None' || val === '-') return val || 'None';
    const str = String(val).trim();
    if (str.includes(' - ') || str.includes(':-') || str.includes(': ')) return str;

    const match = str.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(Stage\s*\d+|Sub-stage\s*\d+|Grade\s*\d+|Year\s*\d+|\d+)\b/i);
    if (match) {
      const mainPart = match[1].trim();
      const subPart = match[2].trim();
      const lower = mainPart.toLowerCase();
      if (lower !== 'stage' && lower !== 'substage' && lower !== 'sub-stage' && lower !== 'grade' && lower !== 'year') {
        return `${mainPart} - ${subPart}`;
      }
    }
    return str;
  }

  onSubStageChange(subName: string) {
    this.selectedSubStage = subName;
    this.newStage = this.formatStageWithHyphen(this.selectedMainStage, subName);
    this.selectedStageOption = this.newStage;
  }

  getSubStagesForMainStage(mainName: string): string[] {
    const item = this.stageHierarchy.find(h => h.name === mainName);
    return item ? item.subStages : [];
  }

  onStageOptionChange(val: string) {
    if (val === '__ADD_NEW__') {
      this.isCustomStage = true;
      this.newStage = this.customNewStage.trim();
    } else {
      this.isCustomStage = false;
      this.newStage = val;
    }
  }

  onCustomStageInput(val: string) {
    this.customNewStage = val;
    this.newStage = val.trim();
  }

  isCurrentStage(stage: string): boolean {
    const current = String(this.firstStudent?.['stage'] || '').trim().toLowerCase();
    return String(stage || '').trim().toLowerCase() === current;
  }

  close() {
    this.dialogRef.close();
  }

  async submit() {
    if (this.isCustomStage) {
      this.newStage = this.customNewStage.trim();
    }

    if (!this.newStage) {
      this.snackBar.open('New stage is required', 'Close', { duration: 3000 });
      return;
    }
    if (!this.reason) {
      this.snackBar.open('Reason is required', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const actionDate = new Date().toISOString().slice(0, 10);
      const createdBy = profile?.displayName || profile?.email || 'System';

      const madrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => []);

      for (const std of this.targetStudents) {
        const studentId = std.id || String(std['uid']);
        const studentName = String(std['name'] || std['displayName'] || 'Student');
        const orgId = std['organizationId'] || profile?.organizationId || '';
        const mdrId = std['madrasaId'] || (Array.isArray(std['madrasaIds']) ? std['madrasaIds'][0] : profile?.madrasaId || '');
        const madrasaRecord = madrasas.find(m => String(m.id) === String(mdrId));
        const madrasaName = madrasaRecord ? String(madrasaRecord['name'] || madrasaRecord.id) : '';

        await this.repo.update('students', studentId, {
          stage: this.newStage,
        }, profile);

        const userUid = String(std['userId'] || std['uid'] || '');
        if (userUid) {
          await this.repo.update('users', userUid, {
            stage: this.newStage,
          }, profile).catch(e => console.warn('Failed to update users collection:', e));
        }

        // Secondary Audit Logs (Catch gracefully)
        await this.repo.create('promotionHistory', {
          studentId: studentId,
          studentName: studentName,
          organizationId: orgId,
          madrasaId: mdrId,
          madrasaName: madrasaName,
          previousCourseId: String(std['courseId'] ?? ''),
          previousStage: String(std['stage'] ?? ''),
          newCourseId: String(std['courseId'] ?? ''),
          newStage: this.newStage,
          reason: this.reason,
          action: this.action,
          actionDate: actionDate,
          status: 'active',
          createdBy: createdBy,
          performedBy: createdBy,
          performedByEmail: profile?.email || '',
          createdAt: new Date().toISOString(),
          createdAtMs: Date.now()
        }, profile).catch(e => console.warn('[Promotion History Log Warning]:', e));

        await this.repo.create('userLifecycleHistory', {
          userId: studentId,
          userName: studentName,
          personType: 'student',
          lifecycleAction: this.action === 'promotion' ? 'Promoted' : 'Demoted',
          actionType: this.action === 'promotion' ? 'Promotion' : 'Demotion',
          reason: `${this.action === 'promotion' ? 'Promoted' : 'Demoted'} from ${std['stage'] || 'Initial'} to ${this.newStage}. Reason: ${this.reason}`,
          fromStage: String(std['stage'] ?? ''),
          toStage: this.newStage,
          effectiveDate: new Date().toISOString(),
          effectiveDateMs: Date.now(),
          performedBy: createdBy,
          performedByEmail: profile?.email || '',
          organizationId: orgId,
          madrasaId: mdrId,
          madrasaName: madrasaName,
          status: 'active',
          createdVia: 'promoteDialog'
        }, profile).catch(e => console.warn('[Lifecycle History Log Warning]:', e));
      }

      // If custom new stage, append to course stages
      if (this.isCustomStage && this.currentCourseRecord && this.newStage) {
        const existingStages = Array.isArray(this.currentCourseRecord['stages'])
          ? [...this.currentCourseRecord['stages']]
          : this.availableStages;
        if (!existingStages.map(s => String(s).toLowerCase()).includes(this.newStage.toLowerCase())) {
          existingStages.push(this.newStage);
          await this.repo.update('courses', this.currentCourseRecord.id!, {
            stages: existingStages
          }, profile).catch(e => console.warn('Failed to update course stages', e));
        }
      }

      this.snackBar.open(`${this.targetStudents.length} student(s) updated successfully.`, 'Close', { duration: 3000 });
      this.dialogRef.close({ success: true });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to update student(s)', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }
}
