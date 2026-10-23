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
  allStaff: EntityRecord[] = [];

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
      const [madrasas, courses, classes, groups, staff, users] = await Promise.all([
        this.repo.getAllOnce('madrasas', profile),
        this.repo.getAllOnce('courses', profile),
        this.repo.getAllOnce('classes', profile),
        this.repo.getAllOnce('classGroups', profile),
        this.repo.getAllOnce('staff', profile).catch(() => []),
        this.repo.getAllOnce('users', profile, { roles: ['teacher', 'staff', 'madrasaIncharge'] }).catch(() => [])
      ]);
      this.madrasas = madrasas.filter((m: any) => m['status'] === 'active');
      this.courses = courses.filter((c: any) => c['status'] === 'active');
      this.classes = classes.filter((c: any) => c['status'] === 'active');
      this.groups = groups.filter((g: any) => g['status'] === 'active');
      this.allStaff = [...(staff || []), ...(users || [])];

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
        classGroupId: this.newGroupId,
        assignedGroupId: this.newGroupId,
        groupIds: [this.newGroupId],
        classGroupIds: [this.newGroupId],
        assignedGroupIds: [this.newGroupId],
        sectionId: this.newGroupId,
        section: this.newGroupId,
        sectionName: targetGroupName,
        movementStatus: 'Transferred',
        movementType: 'TRANSFER',
        movementTag: 'Transferred',
        lastTransferDate: this.actionDate,
        updatedAt: new Date().toISOString(),
      };

      const transferredStudentIds = new Set<string>();
      const previousGroupIds = new Set<string>();

      for (const std of this.targetStudents) {
        const studentId = String(std.id || std['uid'] || std['docId']);
        const sName = String(std['name'] || std['studentName'] || std['displayName'] || 'Student');

        const prevMId = String(std['madrasaId'] || '');
        const prevCId = String(std['courseId'] || '');
        const prevClId = String(std['classId'] || '');
        const prevGId = String(std['groupId'] || std['classGroupId'] || std['assignedGroupId'] || '');

        if (prevGId && prevGId !== this.newGroupId) {
          previousGroupIds.add(prevGId);
        }

        const candidateIds = [std.id, std['uid'], std['docId'], std['userId'], std['entityId']]
          .map(v => String(v || '').trim())
          .filter(Boolean);
        candidateIds.forEach(id => transferredStudentIds.add(id.toLowerCase()));

        const prevMadrasaName = this.getMadrasaName(prevMId) || '';
        const prevClassName = this.getClassName(prevClId) || '';
        const prevGroupName = this.getGroupName(prevGId) || '';
        const fromText = `${prevMadrasaName ? prevMadrasaName + ' • ' : ''}${prevClassName || 'Class'}${prevGroupName ? ' (' + prevGroupName + ')' : ''}`;
        const toText = `${targetMadrasaName ? targetMadrasaName + ' • ' : ''}${targetClassName || 'Class'}${targetGroupName ? ' (' + targetGroupName + ')' : ''}`;

        const transferHistory = {
          studentId: studentId,
          studentName: sName,
          previousMadrasaId: prevMId || undefined,
          previousMadrasaName: prevMadrasaName || undefined,
          previousCourseId: prevCId || undefined,
          previousCourseName: this.getCourseName(prevCId) || undefined,
          previousClassId: prevClId || undefined,
          previousClassName: prevClassName || undefined,
          previousGroupId: prevGId || undefined,
          previousGroupName: prevGroupName || undefined,
          newMadrasaId: this.newMadrasaId,
          newMadrasaName: targetMadrasaName,
          newCourseId: this.newCourseId,
          newCourseName: targetCourseName,
          newClassId: this.newClassId,
          newClassName: targetClassName,
          newGroupId: this.newGroupId,
          newGroupName: targetGroupName,
          fromStage: fromText,
          toStage: toText,
          reason: `Transferred from ${fromText} to ${toText}. Reason: ${this.reason}`,
          actionDate: this.actionDate,
          actionType: 'Transfer',
          movementType: 'TRANSFER',
          movementStatus: 'Transferred',
          organizationId: std['organizationId'] || profile?.organizationId || undefined,
          madrasaId: this.newMadrasaId,
          createdAt: new Date().toISOString(),
          createdBy: profile?.displayName || profile?.email || 'System'
        };

        await this.repo.create('studentTransfers', transferHistory, profile);

        await this.repo.create('userLifecycleHistory', {
          userId: studentId,
          userName: sName,
          personType: 'student',
          lifecycleAction: 'Transferred',
          actionType: 'Transfer',
          reason: `Transferred from ${fromText} to ${toText}. Reason: ${this.reason}`,
          fromStage: fromText,
          toStage: toText,
          previousMadrasaId: prevMId,
          previousMadrasaName: prevMadrasaName || undefined,
          newMadrasaId: this.newMadrasaId,
          newMadrasaName: targetMadrasaName || undefined,
          previousCourseId: prevCId,
          newCourseId: this.newCourseId,
          previousClassId: prevClId,
          previousClassName: prevClassName || undefined,
          newClassId: this.newClassId,
          newClassName: targetClassName || undefined,
          previousGroupId: prevGId,
          previousGroupName: prevGroupName || undefined,
          newGroupId: this.newGroupId,
          newGroupName: targetGroupName || undefined,
          effectiveDate: new Date().toISOString(),
          effectiveDateMs: Date.now(),
          performedBy: profile?.displayName || profile?.email || 'System',
          actionPerformedByName: profile?.displayName || profile?.email || 'System',
          organizationId: profile?.organizationId || std['organizationId'] || '',
          madrasaId: this.newMadrasaId,
          status: 'active'
        }, profile).catch(e => console.warn('Failed to log userLifecycleHistory for transfer:', e));

        for (const sId of candidateIds) {
          await this.repo.update('students', sId, studentUpdates, profile).catch(() => {});
          await this.repo.update('users', sId, {
            ...studentUpdates,
            madrasaIds: [this.newMadrasaId]
          }, profile).catch(() => {});
        }
      }

      // Update classGroups rosters in Firestore (remove from old groups, add to new group)
      try {
        for (const oldGId of Array.from(previousGroupIds)) {
          const oldGroupDoc = this.groups.find(g => g.id === oldGId);
          if (oldGroupDoc) {
            const rawAssigned = Array.isArray(oldGroupDoc['assignedStudentIds']) ? oldGroupDoc['assignedStudentIds'] : [];
            const updatedAssigned = rawAssigned.filter((id: any) => !transferredStudentIds.has(String(id).toLowerCase().trim()));
            const nextCount = Math.max(0, (Number(oldGroupDoc['studentCount']) || rawAssigned.length) - this.targetStudents.length);
            await this.repo.update('classGroups', oldGId, {
              assignedStudentIds: updatedAssigned,
              studentCount: nextCount
            }, profile).catch(() => {});
          }
        }

        const newGroupDoc = this.groups.find(g => g.id === this.newGroupId);
        if (newGroupDoc) {
          const rawAssigned = Array.isArray(newGroupDoc['assignedStudentIds']) ? [...newGroupDoc['assignedStudentIds']] : [];
          this.targetStudents.forEach(st => {
            const sId = String(st.id || st['uid'] || st['docId'] || '');
            if (sId && !rawAssigned.some(existing => String(existing).toLowerCase().trim() === sId.toLowerCase())) {
              rawAssigned.push(sId);
            }
          });
          const nextCount = (Number(newGroupDoc['studentCount']) || 0) + this.targetStudents.length;
          await this.repo.update('classGroups', this.newGroupId, {
            assignedStudentIds: rawAssigned,
            studentCount: nextCount
          }, profile).catch(() => {});
        }
      } catch (grpErr) {
        console.warn('Non-fatal: could not update group rosters during transfer:', grpErr);
      }

      this.repo.clearCache('students');
      this.repo.clearCache('users');
      this.repo.clearCache('classGroups');
      this.repo.clearCache('studentTransfers');
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

  getGroupAssignedStaffName(groupOrId: EntityRecord | string | undefined | null): string {
    if (!groupOrId) return '';
    const grp = typeof groupOrId === 'string' 
      ? this.groups.find(g => g.id === groupOrId || g['name'] === groupOrId) 
      : groupOrId;
    if (!grp) return '';

    // 1. Direct assigned staff/teacher name property
    const directStaff = grp['assignedStaffName'] || grp['teacherName'] || grp['staffName'] || grp['assignedTeacherName'] || grp['inchargeName'] || grp['usthadhName'];
    if (typeof directStaff === 'string' && directStaff.trim()) {
      return directStaff.trim();
    }
    if (Array.isArray(grp['assignedStaffNames']) && grp['assignedStaffNames'].length > 0) {
      return grp['assignedStaffNames'].filter(Boolean).join(', ');
    }
    if (Array.isArray(grp['teacherNames']) && grp['teacherNames'].length > 0) {
      return grp['teacherNames'].filter(Boolean).join(', ');
    }
    if (Array.isArray(grp['staffNames']) && grp['staffNames'].length > 0) {
      return grp['staffNames'].filter(Boolean).join(', ');
    }

    // 2. Check staff tokens/IDs against allStaff list
    const staffTokens = Array.from(new Set([
      ...(Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'] : []),
      ...(Array.isArray(grp['teacherUids']) ? grp['teacherUids'] : []),
      ...(Array.isArray(grp['teacherIds']) ? grp['teacherIds'] : []),
      ...(Array.isArray(grp['staffIds']) ? grp['staffIds'] : []),
      ...(Array.isArray(grp['inchargeIds']) ? grp['inchargeIds'] : []),
      grp['teacherUid'],
      grp['teacherId'],
      grp['assignedStaffId'],
      grp['staffId']
    ].filter(Boolean).map(v => String(v).trim())));

    if (staffTokens.length > 0 && this.allStaff.length > 0) {
      const names: string[] = [];
      staffTokens.forEach(stToken => {
        const found = this.allStaff.find(s => 
          String(s.id).trim() === stToken || 
          String(s['uid'] || '').trim() === stToken ||
          String(s['userId'] || '').trim() === stToken ||
          String(s['email'] || '').trim().toLowerCase() === stToken.toLowerCase()
        );
        if (found) {
          const n = found['displayName'] || found['fullName'] || found['name'] || found['email'];
          if (n && !names.includes(String(n))) names.push(String(n));
        }
      });
      if (names.length > 0) return names.join(', ');
    }

    // 3. Reverse lookup: check if any staff member is assigned to this group
    if (grp.id && this.allStaff.length > 0) {
      const assignedFromStaff = this.allStaff.filter(s => {
        const gIds = [
          s['groupId'], s['classGroupId'], s['assignedGroupId'],
          ...(Array.isArray(s['groupIds']) ? s['groupIds'] : []),
          ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'] : []),
          ...(Array.isArray(s['assignedGroupIds']) ? s['assignedGroupIds'] : [])
        ].filter(Boolean).map(String);
        return gIds.includes(String(grp.id));
      });
      if (assignedFromStaff.length > 0) {
        const names = assignedFromStaff.map(s => s['displayName'] || s['fullName'] || s['name']).filter(Boolean);
        if (names.length > 0) return Array.from(new Set(names)).join(', ');
      }
    }

    return '';
  }
}
