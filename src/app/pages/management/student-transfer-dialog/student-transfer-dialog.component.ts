import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface StudentTransferData {
  student?: EntityRecord;
  students?: EntityRecord[];
}

@Component({
  selector: 'app-student-transfer-dialog',
  templateUrl: './student-transfer-dialog.component.html',
  styleUrls: ['./student-transfer-dialog.component.scss'],
  standalone: false,
})
export class StudentTransferDialogComponent implements OnInit {
  loading = true;
  saving = false;

  targetStudents: EntityRecord[] = [];
  firstStudent: EntityRecord | null = null;

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  groups: EntityRecord[] = [];

  newMadrasaId = '';
  newCourseId = '';
  newClassId = '';
  newGroupId = '';
  reason = '';
  actionDate = new Date().toISOString().substring(0, 10);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentTransferData,
    private dialogRef: MatDialogRef<StudentTransferDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.targetStudents = data.students?.length ? data.students : (data.student ? [data.student] : []);
    this.firstStudent = this.targetStudents[0] || null;

    if (this.firstStudent) {
      this.newMadrasaId = String(this.firstStudent['madrasaId'] || '');
      this.newCourseId = String(this.firstStudent['courseId'] || '');
      this.newClassId = String(this.firstStudent['classId'] || '');
      this.newGroupId = String(this.firstStudent['groupId'] || '');
    }
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const [madrasas, courses, classes, groups] = await Promise.all([
        this.repo.getAllOnce('madrasas', profile),
        this.repo.getAllOnce('courses', profile),
        this.repo.getAllOnce('classes', profile),
        this.repo.getAllOnce('classGroups', profile),
      ]);
      this.madrasas = madrasas.filter((m: any) => m['status'] === 'active');
      this.courses = courses.filter((c: any) => c['status'] === 'active');
      this.classes = classes.filter((c: any) => c['status'] === 'active');
      this.groups = groups.filter((g: any) => g['status'] === 'active');
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to load data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  get availableCourses() {
    if (!this.newMadrasaId) return this.courses;
    return this.courses.filter(c => !c['madrasaId'] || c['madrasaId'] === this.newMadrasaId);
  }

  get availableClasses() {
    return this.classes.filter(c => c['courseId'] === this.newCourseId);
  }

  get availableGroups() {
    return this.groups.filter(g => g['classId'] === this.newClassId);
  }

  onMadrasaChange() {
    this.newCourseId = '';
    this.newClassId = '';
    this.newGroupId = '';
  }

  onCourseChange() {
    this.newClassId = '';
    this.newGroupId = '';
  }

  onClassChange() {
    this.newGroupId = '';
  }

  close() {
    this.dialogRef.close();
  }

  async submit() {
    if (!this.reason) {
      this.snackBar.open('Please provide a reason for transfer', 'Close', { duration: 3000 });
      return;
    }

    if (!this.newMadrasaId || !this.newCourseId || !this.newClassId || !this.newGroupId) {
      this.snackBar.open('Please select all new academic assignments', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const targetMadrasaName = this.madrasas.find(m => m.id === this.newMadrasaId)?.['name'] || '';
      const targetCourseName = this.courses.find(c => c.id === this.newCourseId)?.['name'] || this.courses.find(c => c.id === this.newCourseId)?.['title'] || '';
      const targetClassName = this.classes.find(c => c.id === this.newClassId)?.['name'] || this.classes.find(c => c.id === this.newClassId)?.['title'] || '';
      const targetGroupName = this.groups.find(g => g.id === this.newGroupId)?.['name'] || this.groups.find(g => g.id === this.newGroupId)?.['title'] || '';

      const studentUpdates = {
        madrasaId: this.newMadrasaId,
        madrasaName: targetMadrasaName,
        courseId: this.newCourseId,
        courseName: targetCourseName,
        classId: this.newClassId,
        className: targetClassName,
        groupId: this.newGroupId,
        groupName: targetGroupName,
      };

      for (const std of this.targetStudents) {
        const studentId = String(std.id || std['uid'] || std['docId']);
        const sName = String(std['name'] || std['studentName'] || std['displayName'] || 'Student');

        const transferHistory = {
          studentId: studentId,
          studentName: sName,
          previousMadrasaId: std['madrasaId'] || undefined,
          previousCourseId: std['courseId'] || undefined,
          previousClassId: std['classId'] || undefined,
          previousGroupId: std['groupId'] || undefined,
          newMadrasaId: this.newMadrasaId,
          newCourseId: this.newCourseId,
          newClassId: this.newClassId,
          newGroupId: this.newGroupId,
          reason: this.reason,
          actionDate: this.actionDate,
          organizationId: std['organizationId'] || profile?.organizationId || undefined,
          madrasaId: this.newMadrasaId,
        };

        await this.repo.create('studentTransfers', transferHistory, profile);

        await this.repo.create('userLifecycleHistory', {
          userId: studentId,
          userName: sName,
          personType: 'student',
          lifecycleAction: 'Transferred',
          actionType: 'Transfer',
          reason: `Transferred to ${targetClassName || 'Class'} (${targetGroupName || 'Group'}) in ${targetMadrasaName || 'Madrasa'}. Reason: ${this.reason}`,
          previousMadrasaId: std['madrasaId'] || '',
          newMadrasaId: this.newMadrasaId,
          previousCourseId: std['courseId'] || '',
          newCourseId: this.newCourseId,
          previousClassId: std['classId'] || '',
          newClassId: this.newClassId,
          previousGroupId: std['groupId'] || '',
          newGroupId: this.newGroupId,
          effectiveDate: new Date().toISOString(),
          effectiveDateMs: Date.now(),
          performedBy: profile?.displayName || profile?.email || 'System',
          actionPerformedByName: profile?.displayName || profile?.email || 'System',
          organizationId: profile?.organizationId || std['organizationId'] || '',
          madrasaId: this.newMadrasaId,
          status: 'active'
        }, profile).catch(e => console.warn('Failed to log userLifecycleHistory for transfer:', e));

        const candidateIds = [std.id, std['uid'], std['docId'], std['userId'], std['entityId']]
          .map(v => String(v || '').trim())
          .filter(Boolean);

        for (const sId of candidateIds) {
          await this.repo.update('students', sId, studentUpdates, profile).catch(() => {});
          await this.repo.update('users', sId, {
            ...studentUpdates,
            madrasaIds: [this.newMadrasaId]
          }, profile).catch(() => {});
        }
      }

      this.repo.clearCache('students');
      this.repo.clearCache('users');
      this.repo.clearCache('userLifecycleHistory');

      this.snackBar.open(`${this.targetStudents.length} student(s) transferred successfully.`, 'Close', { duration: 4000 });
      this.dialogRef.close({ success: true });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to transfer student(s)', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  getMadrasaName(id: any) { return this.madrasas.find(m => m.id === id)?.['name'] || id || 'None'; }
  getCourseName(id: any) { return this.courses.find(c => c.id === id)?.['name'] || id || 'None'; }
  getClassName(id: any) { return this.classes.find(c => c.id === id)?.['name'] || id || 'None'; }
  getGroupName(id: any) { return this.groups.find(g => g.id === id)?.['name'] || id || 'None'; }
}
