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

  // Filtered lists for autocomplete
  filteredMadrasas: EntityRecord[] = [];
  filteredCourses: EntityRecord[] = [];
  filteredClasses: EntityRecord[] = [];
  filteredGroups: EntityRecord[] = [];

  // Search input texts
  madrasaSearchText = '';
  courseSearchText = '';
  classSearchText = '';
  groupSearchText = '';

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

      this.syncSearchTexts();
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to load data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  syncSearchTexts(): void {
    const m = this.madrasas.find(x => x.id === this.newMadrasaId);
    if (m) {
      this.madrasaSearchText = m['name'] || m['title'] || '';
    } else {
      this.newMadrasaId = '';
      this.madrasaSearchText = '';
    }

    const c = this.availableCourses.find(x => x.id === this.newCourseId);
    if (c) {
      this.courseSearchText = c['name'] || c['title'] || '';
    } else {
      this.newCourseId = '';
      this.courseSearchText = '';
    }

    const cl = this.availableClasses.find(x => x.id === this.newClassId);
    if (cl) {
      this.classSearchText = cl['name'] || cl['title'] || '';
    } else {
      this.newClassId = '';
      this.classSearchText = '';
    }

    const g = this.availableGroups.find(x => x.id === this.newGroupId);
    if (g) {
      this.groupSearchText = g['name'] || g['title'] || '';
    } else {
      this.newGroupId = '';
      this.groupSearchText = '';
    }

    this.filterMadrasas();
    this.filterCourses();
    this.filterClasses();
    this.filterGroups();
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

  filterMadrasas(): void {
    const selected = this.madrasas.find(m => m.id === this.newMadrasaId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.madrasaSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredMadrasas = [...this.madrasas];
    } else {
      this.filteredMadrasas = this.madrasas.filter(m => {
        const name = (m['name'] || m['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  filterCourses(): void {
    const list = this.availableCourses;
    const selected = list.find(c => c.id === this.newCourseId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.courseSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredCourses = [...list];
    } else {
      this.filteredCourses = list.filter(c => {
        const name = (c['name'] || c['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  filterClasses(): void {
    const list = this.availableClasses;
    const selected = list.find(c => c.id === this.newClassId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.classSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredClasses = [...list];
    } else {
      this.filteredClasses = list.filter(c => {
        const name = (c['name'] || c['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  filterGroups(): void {
    const list = this.availableGroups;
    const selected = list.find(g => g.id === this.newGroupId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.groupSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredGroups = [...list];
    } else {
      this.filteredGroups = list.filter(g => {
        const name = (g['name'] || g['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  onMadrasaOptionSelected(m: EntityRecord): void {
    if (!m) return;
    this.newMadrasaId = m.id || '';
    this.madrasaSearchText = m['name'] || m['title'] || '';
    this.onMadrasaChange();
  }

  onCourseOptionSelected(c: EntityRecord): void {
    if (!c) return;
    this.newCourseId = c.id || '';
    this.courseSearchText = c['name'] || c['title'] || '';
    this.onCourseChange();
  }

  onClassOptionSelected(c: EntityRecord): void {
    if (!c) return;
    this.newClassId = c.id || '';
    this.classSearchText = c['name'] || c['title'] || '';
    this.onClassChange();
  }

  onGroupOptionSelected(g: EntityRecord): void {
    if (!g) return;
    this.newGroupId = g.id || '';
    this.groupSearchText = g['name'] || g['title'] || '';
  }

  onMadrasaBlur(): void {
    setTimeout(() => {
      const trimmed = (this.madrasaSearchText || '').trim().toLowerCase();
      const exactMatch = this.madrasas.find(m => (m['name'] || m['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newMadrasaId !== exactMatch.id) {
          this.onMadrasaOptionSelected(exactMatch);
        }
      } else {
        const current = this.madrasas.find(m => m.id === this.newMadrasaId);
        this.madrasaSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  onCourseBlur(): void {
    setTimeout(() => {
      const trimmed = (this.courseSearchText || '').trim().toLowerCase();
      const exactMatch = this.availableCourses.find(c => (c['name'] || c['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newCourseId !== exactMatch.id) {
          this.onCourseOptionSelected(exactMatch);
        }
      } else {
        const current = this.availableCourses.find(c => c.id === this.newCourseId);
        this.courseSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  onClassBlur(): void {
    setTimeout(() => {
      const trimmed = (this.classSearchText || '').trim().toLowerCase();
      const exactMatch = this.availableClasses.find(c => (c['name'] || c['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newClassId !== exactMatch.id) {
          this.onClassOptionSelected(exactMatch);
        }
      } else {
        const current = this.availableClasses.find(c => c.id === this.newClassId);
        this.classSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  onGroupBlur(): void {
    setTimeout(() => {
      const trimmed = (this.groupSearchText || '').trim().toLowerCase();
      const exactMatch = this.availableGroups.find(g => (g['name'] || g['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newGroupId !== exactMatch.id) {
          this.onGroupOptionSelected(exactMatch);
        }
      } else {
        const current = this.availableGroups.find(g => g.id === this.newGroupId);
        this.groupSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  clearMadrasa(): void {
    this.newMadrasaId = '';
    this.madrasaSearchText = '';
    this.onMadrasaChange();
    this.filterMadrasas();
  }

  clearCourse(): void {
    this.newCourseId = '';
    this.courseSearchText = '';
    this.onCourseChange();
    this.filterCourses();
  }

  clearClass(): void {
    this.newClassId = '';
    this.classSearchText = '';
    this.onClassChange();
    this.filterClasses();
  }

  clearGroup(): void {
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterGroups();
  }

  displayEntityName = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item['name'] || item['title'] || '';
  };

  onMadrasaChange() {
    this.newCourseId = '';
    this.courseSearchText = '';
    this.newClassId = '';
    this.classSearchText = '';
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterCourses();
    this.filterClasses();
    this.filterGroups();
  }

  onCourseChange() {
    this.newClassId = '';
    this.classSearchText = '';
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterClasses();
    this.filterGroups();
  }

  onClassChange() {
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterGroups();
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
