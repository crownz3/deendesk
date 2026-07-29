import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../../core/constants/defaults';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

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
    private snackBar: MatSnackBar
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
  }

  onActionChange() {
    this.autoSelectStage();
  }

  autoSelectStage() {
    const current = String(this.firstStudent?.['stage'] || '').trim().toLowerCase();
    const idx = this.availableStages.findIndex(s => s.toLowerCase() === current);

    if (this.action === 'promotion') {
      if (idx >= 0 && idx < this.availableStages.length - 1) {
        this.newStage = this.availableStages[idx + 1];
      } else if (idx === -1 && this.availableStages.length > 0) {
        this.newStage = this.availableStages[0];
      } else if (this.availableStages.length > 0) {
        this.newStage = this.availableStages[this.availableStages.length - 1];
      }
    } else {
      // Demotion
      if (idx > 0) {
        this.newStage = this.availableStages[idx - 1];
      } else if (this.availableStages.length > 0) {
        this.newStage = this.availableStages[0];
      }
    }

    this.selectedStageOption = this.newStage;
    this.isCustomStage = false;
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

      for (const std of this.targetStudents) {
        const studentId = std.id || String(std['uid']);
        const studentName = String(std['name'] || std['displayName'] || 'Student');

        await this.repo.create('promotionHistory', {
          studentId: studentId,
          studentName: studentName,
          organizationId: std['organizationId'],
          madrasaId: std['madrasaId'],
          previousCourseId: String(std['courseId'] ?? ''),
          previousStage: String(std['stage'] ?? ''),
          newCourseId: String(std['courseId'] ?? ''),
          newStage: this.newStage,
          reason: this.reason,
          action: this.action,
          actionDate: actionDate,
          status: 'active',
          createdBy: createdBy,
        }, profile);

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
          organizationId: std['organizationId'],
          madrasaId: std['madrasaId'],
          status: 'active',
        }, profile);

        await this.repo.update('students', studentId, {
          stage: this.newStage,
        }, profile);

        const userUid = String(std['userId'] || std['uid'] || '');
        if (userUid) {
          await this.repo.update('users', userUid, {
            stage: this.newStage,
          }, profile).catch(e => console.warn('Failed to update users collection', e));
        }
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
