import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { LoaderService } from '../../core/services/loader.service';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';

export interface AssignStudentsDialogData {
  mode?: string;
  node: any;
  assignedStudents: any[];
  availableStudents?: any[];
  allStudents: any[];
}

@Component({
  selector: 'app-academic-tree-assign-students-dialog',
  templateUrl: './academic-tree-assign-students-dialog.component.html',
  styleUrls: ['./academic-tree-assign-students-dialog.component.scss'],
  standalone: false,
})
export class AcademicTreeAssignStudentsDialogComponent implements OnInit {
  node: any;
  availableStudents: any[] = [];
  selectedStudents: any[] = [];
  originalSelectedIds = new Set<string>();
  originalSelectedStudents: any[] = [];

  // Transfer feature
  allGroups: any[] = [];
  transferMenuStudentId: string | null = null;
  isTransferring = false;
  transferSearch = '';
  availableSearch = '';
  assignedSearch = '';
  mobileTab: 'available' | 'assigned' = 'available';

  isSaving = false;
  errorMsg = '';
  successMsg = '';

  get filteredAvailableStudents(): any[] {
    if (!this.availableSearch.trim()) return this.availableStudents;
    const q = this.availableSearch.toLowerCase().trim();
    return this.availableStudents.filter(s =>
      (s.name || s.displayName || '').toLowerCase().includes(q) ||
      (s.email || s.parentName || s.admissionNo || '').toLowerCase().includes(q)
    );
  }

  get filteredSelectedStudents(): any[] {
    if (!this.assignedSearch.trim()) return this.selectedStudents;
    const q = this.assignedSearch.toLowerCase().trim();
    return this.selectedStudents.filter(s =>
      (s.name || s.displayName || '').toLowerCase().includes(q) ||
      (s.email || s.parentName || s.admissionNo || '').toLowerCase().includes(q)
    );
  }

  courseName = '';
  className = '';
  groupName = '';

  get fullBreadcrumb(): string {
    const parts: string[] = [];
    if (this.courseName && !this.isUid(this.courseName)) parts.push(this.courseName);
    if (this.className && !this.isUid(this.className)) parts.push(this.className);
    
    const nodeTitle = this.node?.title || this.node?.name || '';
    if (this.node?.type === 'classGroup') {
      const gName = this.groupName || nodeTitle;
      if (gName && !this.isUid(gName)) parts.push(gName);
    } else if (this.node?.type === 'class') {
      if (!this.className && nodeTitle && !this.isUid(nodeTitle)) parts.push(nodeTitle);
    } else if (this.node?.type === 'course') {
      if (!this.courseName && nodeTitle && !this.isUid(nodeTitle)) parts.push(nodeTitle);
    }

    return parts.length > 0 ? parts.join(' \u2014 ') : (nodeTitle || 'Academic Unit');
  }

  public isUid(str: string): boolean {
    if (!str) return false;
    const trimmed = String(str).trim();
    return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) && !trimmed.includes(' ');
  }

  async resolveNames(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);

      let rawCourse = this.node?.parentCourseName || this.node?.courseName || '';
      const courseId = this.node?.parentCourseId || this.node?.courseId || (this.isUid(rawCourse) ? rawCourse : '');
      
      if (!rawCourse || this.isUid(rawCourse)) {
        if (courseId) {
          const courses = await this.repo.getAllOnce<any>('courses', profile);
          const matched = courses.find((c: any) => c.id === courseId);
          if (matched) {
            rawCourse = matched.name || matched.displayName || matched.title || matched.code || courseId;
          }
        }
      }
      this.courseName = this.isUid(rawCourse) ? 'Course' : rawCourse;

      let rawClass = this.node?.parentClassName || this.node?.className || '';
      const classId = this.node?.parentClassId || this.node?.classId || (this.isUid(rawClass) ? rawClass : '');
      
      if (!rawClass || this.isUid(rawClass)) {
        if (classId) {
          const classes = await this.repo.getAllOnce<any>('classes', profile);
          const matched = classes.find((c: any) => c.id === classId);
          if (matched) {
            rawClass = matched.name || matched.displayName || matched.title || classId;
          }
        }
      }
      this.className = this.isUid(rawClass) ? '' : rawClass;

      if (this.node?.type === 'classGroup') {
        let rawGroup = this.node?.title || this.node?.name || '';
        if (this.isUid(rawGroup) && this.node?.id) {
          const groups = await this.repo.getAllOnce<any>('classGroups', profile);
          const matchedG = groups.find((g: any) => g.id === this.node.id);
          if (matchedG) {
            rawGroup = matchedG.name || matchedG.title || rawGroup;
          }
        }
        this.groupName = this.isUid(rawGroup) ? 'Group' : rawGroup;
      }
    } catch (e) {
      console.warn('[Assign Student Dialog] Name resolution warning:', e);
    }
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssignStudentsDialogData,
    public readonly dialogRef: MatDialogRef<AcademicTreeAssignStudentsDialogComponent>,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.node = this.data?.node;
    this.resolveNames();
    
    const incomingAssigned = Array.isArray(this.data?.assignedStudents) ? this.data.assignedStudents : [];
    const incomingAvailable = Array.isArray(this.data?.availableStudents) ? this.data.availableStudents : [];

    this.selectedStudents = this.uniqueUsers(incomingAssigned);
    this.availableStudents = this.uniqueUsers(
      incomingAvailable.filter((student: any) => {
        if (this.isAlreadySelected(student)) return false;
        if (this.node?.type === 'classGroup' && this.node?.id) {
          const sGroup = student.groupId || student.assignedGroupId;
          if (sGroup && sGroup !== this.node.id) return false;
        } else if (this.node?.type === 'class' && this.node?.id) {
          const sClass = student.classId || student.assignedClassId;
          if (sClass && sClass !== this.node.id) return false;
        }
        return true;
      })
    );

    this.originalSelectedStudents = [...this.selectedStudents];
    this.originalSelectedIds = new Set();
    this.selectedStudents.forEach(student => {
      const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
        .map(v => String(v || '').trim())
        .filter(Boolean);
      ids.forEach(id => this.originalSelectedIds.add(id));
    });

    this.loadTransferTargets();
  }

  async loadTransferTargets() {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const groups = await this.repo.getAllOnce<any>('classGroups', profile);
      const classes = await this.repo.getAllOnce<any>('classes', profile);
      const courses = await this.repo.getAllOnce<any>('courses', profile);
      const madrasas = await this.repo.getAllOnce<any>('madrasas', profile);

      const enrichedGroups = groups.filter((g: any) => g.id !== this.node?.id).map((g: any) => {
        const cls = classes.find((c: any) => c.id === g.classId);
        const crs = courses.find((c: any) => c.id === (g.courseId || cls?.courseId));
        const mdr = madrasas.find((m: any) => m.id === (g.madrasaId || cls?.madrasaId || crs?.madrasaId));

        return {
          ...g,
          _type: 'classGroup',
          className: g.className || cls?.name || cls?.title || '',
          courseId: g.courseId || cls?.courseId || crs?.id || null,
          courseName: g.courseName || crs?.title || crs?.name || '',
          madrasaId: g.madrasaId || cls?.madrasaId || crs?.madrasaId || mdr?.id || null,
          madrasaName: g.madrasaName || mdr?.name || '',
        };
      });

      const enrichedClasses = classes.filter((c: any) => c.id !== this.node?.id).map((c: any) => {
        const crs = courses.find((cr: any) => cr.id === c.courseId);
        const mdr = madrasas.find((m: any) => m.id === (c.madrasaId || crs?.madrasaId));

        return {
          ...c,
          _type: 'class',
          courseId: c.courseId || crs?.id || null,
          courseName: c.courseName || crs?.title || crs?.name || '',
          madrasaId: c.madrasaId || crs?.madrasaId || mdr?.id || null,
          madrasaName: c.madrasaName || mdr?.name || '',
        };
      });

      this.allGroups = [...enrichedGroups, ...enrichedClasses];
    } catch (e) {
      // Transfer targets fallback
    }
  }

  public getUserId(user: any): string {
    return user?.id || user?.uid || user?.docId || '';
  }

  private normalizeRole(role: string | undefined | null): string {
    return String(role || '').trim().toLowerCase();
  }

  private isStudentUser(user: any): boolean {
    return this.normalizeRole(user?.role) === 'student';
  }

  private isAlreadySelected(student: any): boolean {
    const id = this.getUserId(student);
    return this.selectedStudents.some(selected => this.getUserId(selected) === id);
  }

  private uniqueUsers(users: any[]): any[] {
    const map = new Map<string, any>();
    for (const user of users || []) {
      const key = this.getUserId(user);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, user);
      }
    }
    return Array.from(map.values());
  }

  drop(event: CdkDragDrop<any[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    
    console.log('[Assign Dialog Transfer Debug]', {
      type: 'students',
      availableCount: this.availableStudents.length,
      selectedCount: this.selectedStudents.length,
    });
  }

  addStudent(student: any): void {
    if (!this.isStudentUser(student)) {
      console.warn('[Blocked Non Student In Student Dialog]', {
        id: student?.id || student?.uid,
        role: student?.role,
        name: student?.name || student?.displayName
      });
      return;
    }
    if (this.isAlreadySelected(student)) return;
    this.selectedStudents = [...this.selectedStudents, student];
    this.availableStudents = this.availableStudents.filter(item => this.getUserId(item) !== this.getUserId(student));
  }

  removeStudent(student: any): void {
    if (!student) return;
    this.availableStudents = [...this.availableStudents, student];
    this.selectedStudents = this.selectedStudents.filter(item => this.getUserId(item) !== this.getUserId(student));
  }

  activeTransferTab: 'sameClass' | 'sameMadrasa' | 'otherMadrasa' | 'unassign' = 'sameClass';

  toggleTransferMenu(studentId: string): void {
    if (this.transferMenuStudentId === studentId) {
      this.transferMenuStudentId = null;
    } else {
      this.transferMenuStudentId = studentId;
      this.transferSearch = '';
      this.activeTransferTab = 'sameClass';
    }
  }

  get sameClassTargets(): any[] {
    const parentClassId = this.node?.parentClassId || this.node?.classId;
    return this.allGroups.filter(g => g._type === 'classGroup' && g.classId === parentClassId && g.id !== this.node?.id);
  }

  get sameMadrasaTargets(): any[] {
    const parentMadrasaId = this.node?.madrasaId || this.data?.node?.madrasaId;
    const parentClassId = this.node?.parentClassId || this.node?.classId;
    return this.allGroups.filter(g => {
      const isSameMadrasa = !g.madrasaId || g.madrasaId === parentMadrasaId;
      const isDifferentClass = (g._type === 'class' && g.id !== parentClassId) || (g._type === 'classGroup' && g.classId !== parentClassId);
      return isSameMadrasa && isDifferentClass;
    });
  }

  get otherMadrasaTargets(): any[] {
    const parentMadrasaId = this.node?.madrasaId || this.data?.node?.madrasaId;
    return this.allGroups.filter(g => g.madrasaId && g.madrasaId !== parentMadrasaId);
  }

  get filteredSameClassTargets(): any[] {
    const list = this.sameClassTargets;
    if (!this.transferSearch) return list;
    const q = this.transferSearch.toLowerCase();
    return list.filter(g => 
      (g.name || '').toLowerCase().includes(q) ||
      (g.title || '').toLowerCase().includes(q)
    );
  }

  get filteredSameMadrasaTargets(): any[] {
    const list = this.sameMadrasaTargets;
    if (!this.transferSearch) return list;
    const q = this.transferSearch.toLowerCase();
    return list.filter(g => 
      (g.name || '').toLowerCase().includes(q) ||
      (g.title || '').toLowerCase().includes(q) ||
      (g.className || '').toLowerCase().includes(q) ||
      (g.courseName || '').toLowerCase().includes(q)
    );
  }

  get filteredOtherMadrasaTargets(): any[] {
    const list = this.otherMadrasaTargets;
    if (!this.transferSearch) return list;
    const q = this.transferSearch.toLowerCase();
    return list.filter(g => 
      (g.name || '').toLowerCase().includes(q) ||
      (g.title || '').toLowerCase().includes(q) ||
      (g.className || '').toLowerCase().includes(q) ||
      (g.madrasaName || '').toLowerCase().includes(q) ||
      (g.courseName || '').toLowerCase().includes(q)
    );
  }

  get filteredTransferGroups(): any[] {
    if (!this.transferSearch) return this.allGroups;
    const q = this.transferSearch.toLowerCase();
    return this.allGroups.filter(g => (g.name || '').toLowerCase().includes(q));
  }

  async unassignFromGroupOnly(student: any): Promise<void> {
    this.transferMenuStudentId = null;
    this.isTransferring = true;
    this.errorMsg = '';
    this.loader.show('Unassigning student...');
    try {
      const userProfile = await firstValueFrom(this.auth.profile$);
      const patch = { groupId: null, groupName: null };
      const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
        .map(v => String(v || '').trim())
        .filter(Boolean);

      const promises = ids.flatMap(sId => [
        this.repo.update('students', sId, patch, userProfile).catch(() => {}),
        this.repo.update('users', sId, patch, userProfile).catch(() => {})
      ]);
      await Promise.all(promises);

      this.repo.clearCache('students');
      this.repo.clearCache('users');

      this.selectedStudents = this.selectedStudents.filter(s => this.getUserId(s) !== this.getUserId(student));
      this.successMsg = `${student.name || student.displayName || 'Student'} unassigned from group.`;
      setTimeout(() => this.successMsg = '', 3000);
    } catch (e: any) {
      this.errorMsg = e?.message || 'Unassign failed.';
    } finally {
      this.isTransferring = false;
      this.loader.hide();
    }
  }

  async removeFromClassCompletely(student: any): Promise<void> {
    this.transferMenuStudentId = null;
    this.isTransferring = true;
    this.errorMsg = '';
    this.loader.show('Removing student from class...');
    try {
      const userProfile = await firstValueFrom(this.auth.profile$);
      const patch = { classId: null, className: null, groupId: null, groupName: null };
      const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
        .map(v => String(v || '').trim())
        .filter(Boolean);

      const promises = ids.flatMap(sId => [
        this.repo.update('students', sId, patch, userProfile).catch(() => {}),
        this.repo.update('users', sId, patch, userProfile).catch(() => {})
      ]);
      await Promise.all(promises);

      this.repo.clearCache('students');
      this.repo.clearCache('users');

      this.selectedStudents = this.selectedStudents.filter(s => this.getUserId(s) !== this.getUserId(student));
      this.successMsg = `${student.name || student.displayName || 'Student'} removed from class completely.`;
      setTimeout(() => this.successMsg = '', 3000);
    } catch (e: any) {
      this.errorMsg = e?.message || 'Remove failed.';
    } finally {
      this.isTransferring = false;
      this.loader.hide();
    }
  }

  async transferStudent(student: any, targetGroup: any): Promise<void> {
    this.transferMenuStudentId = null;
    this.isTransferring = true;
    this.errorMsg = '';
    this.loader.show('Transferring student...');
    try {
      const userProfile = await firstValueFrom(this.auth.profile$);
      const targetType = targetGroup._type;
      let patch: any = {};
      if (targetType === 'classGroup') {
        patch = {
          groupId: targetGroup.id,
          groupName: targetGroup.name || targetGroup.title || '',
          classId: targetGroup.classId || targetGroup.parentClassId || null,
          className: targetGroup.className || targetGroup.parentClassName || null,
          courseId: targetGroup.courseId || targetGroup.parentCourseId || null,
          courseName: targetGroup.courseName || targetGroup.parentCourseName || null,
          madrasaId: targetGroup.madrasaId || null,
          madrasaName: targetGroup.madrasaName || null,
        };
      } else {
        patch = {
          classId: targetGroup.id,
          className: targetGroup.name || targetGroup.title || '',
          groupId: null,
          groupName: null,
          courseId: targetGroup.courseId || targetGroup.parentCourseId || null,
          courseName: targetGroup.courseName || targetGroup.parentCourseName || null,
          madrasaId: targetGroup.madrasaId || null,
          madrasaName: targetGroup.madrasaName || null,
        };
      }

      const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
        .map(v => String(v || '').trim())
        .filter(Boolean);

      const promises = ids.flatMap(sId => [
        this.repo.update('students', sId, patch, userProfile).catch(() => {}),
        this.repo.update('users', sId, patch, userProfile).catch(() => {})
      ]);
      await Promise.all(promises);

      const studentId = String(student.id || student.uid || student.userId || '');
      const sName = String(student.name || student.displayName || student['studentName'] || 'Student');
      const targetName = targetGroup.name || targetGroup.title || 'target';

      await this.repo.create('userLifecycleHistory', {
        userId: studentId,
        userName: sName,
        personType: 'student',
        lifecycleAction: 'Transferred',
        actionType: 'Transfer',
        reason: `Transferred to ${targetName} (${patch.className || ''} ${patch.groupName ? '- ' + patch.groupName : ''}) via Academic Tree`,
        previousMadrasaId: student['madrasaId'] || '',
        newMadrasaId: patch.madrasaId || student['madrasaId'] || '',
        previousCourseId: student['courseId'] || '',
        newCourseId: patch.courseId || student['courseId'] || '',
        previousClassId: student['classId'] || '',
        newClassId: patch.classId || student['classId'] || '',
        previousGroupId: student['groupId'] || '',
        newGroupId: patch.groupId || student['groupId'] || '',
        effectiveDate: new Date().toISOString(),
        effectiveDateMs: Date.now(),
        performedBy: userProfile?.displayName || userProfile?.email || 'System',
        actionPerformedByName: userProfile?.displayName || userProfile?.email || 'System',
        organizationId: userProfile?.organizationId || student['organizationId'] || '',
        madrasaId: patch.madrasaId || student['madrasaId'] || '',
        status: 'active'
      }, userProfile).catch(e => console.warn('Failed to log transfer to userLifecycleHistory', e));

      await this.repo.create('studentTransfers', {
        studentId: studentId,
        studentName: sName,
        previousMadrasaId: student['madrasaId'] || undefined,
        previousCourseId: student['courseId'] || undefined,
        previousClassId: student['classId'] || undefined,
        previousGroupId: student['groupId'] || undefined,
        newMadrasaId: patch.madrasaId || student['madrasaId'] || undefined,
        newCourseId: patch.courseId || student['courseId'] || undefined,
        newClassId: patch.classId || student['classId'] || undefined,
        newGroupId: patch.groupId || student['groupId'] || undefined,
        reason: `Transferred to ${targetName} via Academic Tree`,
        actionDate: new Date().toISOString().substring(0, 10),
        organizationId: userProfile?.organizationId || student['organizationId'] || undefined,
        madrasaId: patch.madrasaId || student['madrasaId'] || undefined,
      }, userProfile).catch(e => console.warn('Failed to log studentTransfers', e));

      this.repo.clearCache('students');
      this.repo.clearCache('users');
      this.repo.clearCache('userLifecycleHistory');

      // Remove from selected list (they are now assigned elsewhere)
      this.selectedStudents = this.selectedStudents.filter(s => this.getUserId(s) !== this.getUserId(student));
      this.successMsg = `${student.name || student.displayName || 'Student'} transferred to ${targetGroup.name || targetGroup.title || 'target'}.`;
      setTimeout(() => this.successMsg = '', 3000);
    } catch (e: any) {
      this.errorMsg = e?.message || 'Transfer failed.';
    } finally {
      this.isTransferring = false;
      this.loader.hide();
    }
  }

  addAll(): void {
    const validStudents = this.availableStudents.filter((user: any) => this.isStudentUser(user));
    this.selectedStudents = this.uniqueUsers([...this.selectedStudents, ...validStudents]);
    this.availableStudents = [];
  }

  removeAll(): void {
    this.availableStudents = this.uniqueUsers([...this.availableStudents, ...this.selectedStudents]);
    this.selectedStudents = [];
  }

  async save() {
    this.isSaving = true;
    this.errorMsg = '';
    this.loader.show('Saving student assignments...');
    try {
      const user = await firstValueFrom(this.auth.profile$);

      const selectedIds = new Set<string>();
      this.selectedStudents.forEach(student => {
        const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
          .map(v => String(v || '').trim())
          .filter(Boolean);
        ids.forEach(id => selectedIds.add(id));
      });

      const addedStudents = this.selectedStudents.filter(student => {
        const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
          .map(v => String(v || '').trim())
          .filter(Boolean);
        return !ids.some(id => this.originalSelectedIds.has(id));
      });

      const removedStudents = (this.originalSelectedStudents || []).filter((student: any) => {
        const ids = [student.id, student.uid, student.docId, student.userId, student['entityId']]
          .map(v => String(v || '').trim())
          .filter(Boolean);
        return !ids.some(id => selectedIds.has(id));
      });

      console.log('[Assign Save Debug]', {
        nodeId: this.node?.id,
        nodeType: this.node?.type,
        nodeTitle: this.node?.title || this.node?.name,
        addedCount: addedStudents.length,
        addedNames: addedStudents.map((s: any) => s.name || s.displayName),
        removedCount: removedStudents.length,
        removedNames: removedStudents.map((s: any) => s.name || s.displayName)
      });

      const updatePromises: Promise<any>[] = [];

      for (const student of addedStudents) {
        let patch: any = {};
        if (this.node.type === 'class') {
          patch = { 
            classId: this.node.id, 
            className: this.node.title || this.node.name,
            courseId: this.node.parentCourseId || null,
            courseName: this.node.parentCourseName || null
          };
        } else if (this.node.type === 'classGroup') {
          patch = {
            groupId: this.node.isDefaultGroup ? null : this.node.id,
            groupName: this.node.isDefaultGroup ? null : (this.node.title || this.node.name),
            classId: this.node.parentClassId || null,
            className: this.node.parentClassName || null,
            courseId: this.node.parentCourseId || null,
            courseName: this.node.parentCourseName || null
          };
        }
        if (Object.keys(patch).length > 0) {
          const ids = Array.from(new Set([student.id, student.uid, student.docId, student.userId, student['entityId']]
            .map(v => String(v || '').trim())
            .filter(Boolean)));

          for (const studentId of ids) {
            updatePromises.push(this.repo.update('students', studentId, patch, user).catch(() => {}));
            updatePromises.push(this.repo.update('users', studentId, patch, user).catch(() => {}));
          }
        }
      }

      for (const student of removedStudents) {
        let patch: any = {};
        if (this.node.type === 'class') {
          patch = { classId: null, className: null, groupId: null, groupName: null };
        } else if (this.node.type === 'classGroup') {
          patch = { groupId: null, groupName: null };
        }
        
        if (Object.keys(patch).length > 0) {
          const ids = Array.from(new Set([student.id, student.uid, student.docId, student.userId, student['entityId']]
            .map(v => String(v || '').trim())
            .filter(Boolean)));

          for (const studentId of ids) {
            updatePromises.push(this.repo.update('students', studentId, patch, user).catch(() => {}));
            updatePromises.push(this.repo.update('users', studentId, patch, user).catch(() => {}));
          }
        }
      }

      await Promise.all(updatePromises);

      this.repo.clearCache('students');
      this.repo.clearCache('users');

      this.dialogRef.close({ updated: true });
    } catch (error: any) {
      console.error('[Assign Save Failed]', {
        nodeId: this.node?.id,
        nodeType: this.node?.type,
        errorCode: error?.code,
        errorMessage: error?.message,
        error,
      });
      this.errorMsg = error?.message || 'Failed to save assignments.';
    } finally {
      this.isSaving = false;
      this.loader.hide();
    }
  }
}
