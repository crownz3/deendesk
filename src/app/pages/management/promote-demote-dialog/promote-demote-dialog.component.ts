import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
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
        if (course) this.courseName = String(course['name'] || courseId);
      }

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

  close() {
    this.dialogRef.close();
  }

  async submit() {
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

      await this.repo.create('promotionHistory', {
        studentId: studentId,
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
      }, profile);

      await this.repo.update('students', studentId, {
        stage: this.newStage,
      }, profile);
      
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
