import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../../core/constants/defaults';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface PromoteDemoteData {
  student: EntityRecord;
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
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      const [courses, classes, groups] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('courses', profile),
        this.repo.getAllOnce<EntityRecord>('classes', profile),
        this.repo.getAllOnce<EntityRecord>('classGroups', profile),
      ]);

      const courseId = this.data.student['courseId'];
      if (courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          this.currentCourseRecord = course;
          this.courseName = String(course['name'] || courseId);
          this.extractStages(course);
        }
      }
      if (this.availableStages.length === 0) {
        this.availableStages = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5'];
      }
      this.autoSelectStage();

      const classId = this.data.student['classId'];
      if (classId) {
        const cls = classes.find(c => c.id === classId);
        if (cls) this.className = String(cls['name'] || classId);
      }

      const groupId = this.data.student['groupId'];
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
    if (Array.isArray(rawStages) && rawStages.length) {
      stages = rawStages.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof rawStages === 'string' && rawStages.trim()) {
      stages = rawStages.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      const type = String(course['type'] || course['courseType'] || '').toLowerCase();
      stages = [...(DEFAULT_STAGES_BY_COURSE_TYPE[type] || DEFAULT_STAGES_BY_COURSE_TYPE['custom'])];
    }
    this.availableStages = stages;
  }

  onActionChange() {
    this.autoSelectStage();
  }

  autoSelectStage() {
    const current = String(this.data.student['stage'] || '').trim().toLowerCase();
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
    const current = String(this.data?.student?.['stage'] || '').trim().toLowerCase();
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
    if (this.newStage === this.data.student['stage']) {
      this.snackBar.open('Cannot promote or demote to the current stage', 'Close', { duration: 3000 });
      return;
    }
    if (!this.reason) {
      this.snackBar.open('Reason is required', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const studentId = this.data.student.id!;

      const studentName = String(this.data.student['name'] || this.data.student['displayName'] || 'Student');

      await this.repo.create('promotionHistory', {
        studentId: studentId,
        studentName: studentName,
        organizationId: this.data.student['organizationId'],
        madrasaId: this.data.student['madrasaId'],
        previousCourseId: String(this.data.student['courseId'] ?? ''),
        previousStage: String(this.data.student['stage'] ?? ''),
        newCourseId: String(this.data.student['courseId'] ?? ''),
        newStage: this.newStage,
        reason: this.reason,
        action: this.action,
        actionDate: new Date().toISOString().slice(0, 10),
        status: 'active',
        createdBy: profile?.displayName || profile?.email || 'System',
      }, profile);

      await this.repo.create('userLifecycleHistory', {
        userId: studentId,
        userName: studentName,
        personType: 'student',
        lifecycleAction: this.action === 'promote' ? 'Promoted' : 'Demoted',
        actionType: this.action === 'promote' ? 'Promotion' : 'Demotion',
        reason: `${this.action === 'promote' ? 'Promoted' : 'Demoted'} from ${this.data.student['stage'] || 'Initial'} to ${this.newStage}. Reason: ${this.reason}`,
        fromStage: String(this.data.student['stage'] ?? ''),
        toStage: this.newStage,
        effectiveDate: new Date().toISOString(),
        effectiveDateMs: Date.now(),
        performedBy: profile?.displayName || profile?.email || 'System',
        organizationId: this.data.student['organizationId'],
        madrasaId: this.data.student['madrasaId'],
        status: 'active',
      }, profile);

      await this.repo.update('students', studentId, {
        stage: this.newStage,
      }, profile);
      
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

      const userUid = String(this.data.student['userId'] || this.data.student['uid'] || '');
      if (userUid) {
        await this.repo.update('users', userUid, {
          stage: this.newStage,
        }, profile).catch(e => console.warn('Failed to update users collection', e));
      }

      this.dialogRef.close({ success: true });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to update student', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }
}
