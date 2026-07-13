import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface StudentTransferData {
  student: EntityRecord;
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
    this.newMadrasaId = String(data.student['madrasaId'] || '');
    this.newCourseId = String(data.student['courseId'] || '');
    this.newClassId = String(data.student['classId'] || '');
    this.newGroupId = String(data.student['groupId'] || '');
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
      const studentId = String(this.data.student.id || this.data.student['uid']);

      const transferHistory = {
        studentId: studentId,
        previousMadrasaId: this.data.student['madrasaId'] || undefined,
        previousCourseId: this.data.student['courseId'] || undefined,
        previousClassId: this.data.student['classId'] || undefined,
        previousGroupId: this.data.student['groupId'] || undefined,
        newMadrasaId: this.newMadrasaId,
        newCourseId: this.newCourseId,
        newClassId: this.newClassId,
        newGroupId: this.newGroupId,
        reason: this.reason,
        actionDate: this.actionDate,
        organizationId: this.data.student['organizationId'] || undefined,
        madrasaId: this.data.student['madrasaId'] || undefined, // scope to the old madrasa so incharge can write it
      };

      await this.repo.create('studentTransfers', transferHistory, profile);

      const studentUpdates = {
        madrasaId: this.newMadrasaId,
        courseId: this.newCourseId,
        classId: this.newClassId,
        groupId: this.newGroupId,
      };
      await this.repo.update('students', studentId, studentUpdates, profile);
      
      const userUid = String(this.data.student['userId'] || this.data.student['uid'] || '');
      if (userUid) {
        await this.repo.update('users', userUid, {
          ...studentUpdates,
          madrasaIds: [this.newMadrasaId]
        }, profile).catch(e => console.warn('Failed to update users collection', e));
      }

      this.dialogRef.close({ success: true });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to transfer student', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  getMadrasaName(id: any) { return this.madrasas.find(m => m.id === id)?.['name'] || id || 'None'; }
  getCourseName(id: any) { return this.courses.find(c => c.id === id)?.['name'] || id || 'None'; }
  getClassName(id: any) { return this.classes.find(c => c.id === id)?.['name'] || id || 'None'; }
  getGroupName(id: any) { return this.groups.find(g => g.id === id)?.['name'] || id || 'None'; }
}
