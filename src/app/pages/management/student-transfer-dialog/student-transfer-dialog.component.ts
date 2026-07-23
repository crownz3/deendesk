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
      const studentUpdates = {
        madrasaId: this.newMadrasaId,
        courseId: this.newCourseId,
        classId: this.newClassId,
        groupId: this.newGroupId,
      };

      for (const std of this.targetStudents) {
        const studentId = String(std.id || std['uid']);

        const transferHistory = {
          studentId: studentId,
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
          organizationId: std['organizationId'] || undefined,
          madrasaId: std['madrasaId'] || undefined,
        };

        await this.repo.create('studentTransfers', transferHistory, profile);
        await this.repo.update('students', studentId, studentUpdates, profile);

        const userUid = String(std['userId'] || std['uid'] || '');
        if (userUid) {
          await this.repo.update('users', userUid, {
            ...studentUpdates,
            madrasaIds: [this.newMadrasaId]
          }, profile).catch(e => console.warn('Failed to update users collection', e));
        }
      }

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
