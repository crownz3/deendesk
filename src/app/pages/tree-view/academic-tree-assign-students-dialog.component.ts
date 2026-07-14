import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
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

  // Transfer feature
  allGroups: any[] = [];
  transferMenuStudentId: string | null = null;
  isTransferring = false;
  transferSearch = '';
  
  isSaving = false;
  errorMsg = '';
  successMsg = '';;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssignStudentsDialogData,
    public readonly dialogRef: MatDialogRef<AcademicTreeAssignStudentsDialogComponent>,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.node = this.data?.node;
    
    const incomingAssigned = Array.isArray(this.data?.assignedStudents) ? this.data.assignedStudents : [];
    const incomingAvailable = Array.isArray(this.data?.availableStudents) ? this.data.availableStudents : [];

    this.selectedStudents = this.uniqueUsers(incomingAssigned);
    this.availableStudents = this.uniqueUsers(
      incomingAvailable.filter((student: any) => !this.isAlreadySelected(student))
    );

    this.originalSelectedIds = new Set();
    this.selectedStudents.forEach(student => {
      const id = this.getUserId(student);
      if (id) this.originalSelectedIds.add(id);
    });

    this.loadTransferTargets();
  }

  async loadTransferTargets() {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const groups = await this.repo.getAllOnce<any>('classGroups', profile);
      const classes = await this.repo.getAllOnce<any>('classes', profile);
      // Combine groups and classes, exclude current node
      this.allGroups = [
        ...groups.filter((g: any) => g.id !== this.node?.id).map((g: any) => ({ ...g, _type: 'classGroup' })),
        ...classes.filter((c: any) => c.id !== this.node?.id).map((c: any) => ({ ...c, _type: 'class' }))
      ];
    } catch (e) {
      // Transfer targets not critical
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

  toggleTransferMenu(studentId: string): void {
    this.transferMenuStudentId = this.transferMenuStudentId === studentId ? null : studentId;
    this.transferSearch = '';
  }

  get filteredTransferGroups(): any[] {
    if (!this.transferSearch) return this.allGroups;
    const q = this.transferSearch.toLowerCase();
    return this.allGroups.filter(g => (g.name || '').toLowerCase().includes(q));
  }

  async transferStudent(student: any, targetGroup: any): Promise<void> {
    this.transferMenuStudentId = null;
    this.isTransferring = true;
    this.errorMsg = '';
    try {
      const userProfile = await firstValueFrom(this.auth.profile$);
      const targetType = targetGroup._type;
      let patch: any = {};
      if (targetType === 'classGroup') {
        patch = {
          groupId: targetGroup.id,
          groupName: targetGroup.name || '',
          classId: targetGroup.classId || null,
          className: targetGroup.className || null,
        };
      } else {
        patch = {
          classId: targetGroup.id,
          className: targetGroup.name || '',
          groupId: null,
          groupName: null,
        };
      }
      await this.repo.update('students', this.getUserId(student), patch, userProfile);
      // Remove from selected list (they are now assigned elsewhere)
      this.selectedStudents = this.selectedStudents.filter(s => this.getUserId(s) !== this.getUserId(student));
      this.successMsg = `${student.name || 'Student'} transferred to ${targetGroup.name || 'target'}.`;
      setTimeout(() => this.successMsg = '', 3000);
    } catch (e: any) {
      this.errorMsg = e?.message || 'Transfer failed.';
    } finally {
      this.isTransferring = false;
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
    const user = await firstValueFrom(this.auth.profile$);

    const selectedIds = new Set(this.selectedStudents.map(student => this.getUserId(student)));

    const addedStudents = this.selectedStudents.filter(student => !this.originalSelectedIds.has(this.getUserId(student)));
    
    const allStudents = this.data?.allStudents || [];
    const removedStudents = allStudents.filter((student: any) => {
      const id = this.getUserId(student);
      return this.originalSelectedIds.has(id) && !selectedIds.has(id);
    });

    try {
      for (const student of addedStudents) {
        let patch: any = {};
        if (this.node.type === 'class') {
          patch = { 
            classId: this.node.id, 
            className: this.node.title,
            courseId: this.node.parentCourseId || null,
            courseName: this.node.parentCourseName || null
          };
        } else if (this.node.type === 'classGroup') {
          patch = {
            groupId: this.node.id,
            groupName: this.node.title,
            classId: this.node.parentClassId || null,
            className: this.node.parentClassName || null,
            courseId: this.node.parentCourseId || null,
            courseName: this.node.parentCourseName || null
          };
        }
        if (Object.keys(patch).length > 0) {
          await this.repo.update('students', this.getUserId(student), patch, user);
        }
      }

      for (const student of removedStudents) {
        let patch: any = {};
        if (this.node.type === 'class') {
          if (student.classId === this.node.id) {
            patch = { classId: null, className: null, groupId: null, groupName: null };
            // Keeping courseId/courseName per user instruction
          }
        } else if (this.node.type === 'classGroup') {
          if (student.groupId === this.node.id) {
            patch = { groupId: null, groupName: null };
          }
        }
        
        if (Object.keys(patch).length > 0) {
          await this.repo.update('students', this.getUserId(student), patch, user);
        }
      }

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
    }
  }
}
