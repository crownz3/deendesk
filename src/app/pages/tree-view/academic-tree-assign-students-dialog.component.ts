import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';

export interface AssignStudentsDialogData {
  node: any;
  assignedStudents: any[];
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
  availableUsers: any[] = [];
  selectedUsers: any[] = [];
  originalSelectedIds = new Set<string>();
  
  isSaving = false;
  errorMsg = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssignStudentsDialogData,
    public readonly dialogRef: MatDialogRef<AcademicTreeAssignStudentsDialogComponent>,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.node = this.data.node;
    const all = this.data.allStudents || [];
    const currentlyAssigned = this.data.assignedStudents || [];

    this.originalSelectedIds = new Set(currentlyAssigned.map(s => s.id));
    this.selectedUsers = [...currentlyAssigned];

    // Build unassigned based on rules
    this.availableUsers = all.filter(student => !this.studentMatchesNode(student, this.node));

    console.log('[Academic Tree Assign Students Open Debug]', {
      nodeId: this.node.id,
      nodeType: this.node.type,
      nodeTitle: this.node.title,
      assignedCount: this.selectedUsers.length,
      totalStudentsLoaded: all.length,
    });
  }

  private studentMatchesNode(student: any, node: any): boolean {
    if (!student || !node?.id || !node?.type) return false;
    if (node.type === 'course') {
      return student.courseId === node.id || (student.courseIds || []).includes(node.id);
    }
    if (node.type === 'class') {
      return student.classId === node.id || (student.classIds || []).includes(node.id);
    }
    if (node.type === 'subject') {
      return student.subjectId === node.id || (student.subjectIds || []).includes(node.id);
    }
    return false;
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
      availableCount: this.availableUsers.length,
      selectedCount: this.selectedUsers.length,
    });
  }

  addAll() {
    this.selectedUsers.push(...this.availableUsers);
    this.availableUsers = [];
  }

  removeAll() {
    this.availableUsers.push(...this.selectedUsers);
    this.selectedUsers = [];
  }

  async save() {
    this.isSaving = true;
    this.errorMsg = '';
    const user = await firstValueFrom(this.auth.profile$);

    const newSelectedIds = new Set(this.selectedUsers.map(s => s.id));
    
    const addedUsers = this.selectedUsers.filter(s => !this.originalSelectedIds.has(s.id));
    const removedUsers = (this.data.assignedStudents || []).filter(s => !newSelectedIds.has(s.id));

    console.log('[Assign Save Debug]', {
      nodeId: this.node.id,
      nodeType: this.node.type,
      nodeTitle: this.node.title,
      selectedCount: this.selectedUsers.length,
      removedCount: removedUsers.length,
    });

    console.log('[Class Student Assignment Debug]', {
      classId: this.node.id,
      className: this.node.title,
      parentCourseId: this.node.parentCourseId,
      parentCourseName: this.node.parentCourseName,
      selectedStudentCount: this.selectedUsers.length,
    });

    try {
      for (const student of addedUsers) {
        let patch: any = {};
        if (this.node.type === 'class') {
          patch = { 
            classId: this.node.id, 
            className: this.node.title,
            courseId: this.node.parentCourseId || null,
            courseName: this.node.parentCourseName || null
          };
        }
        if (Object.keys(patch).length > 0) {
          await this.repo.update('users', student.id, patch, user);
        }
      }

      for (const student of removedUsers) {
        let patch: any = {};
        if (this.node.type === 'class') {
          if (student.classId === this.node.id) {
            patch = { classId: null, className: null };
            // Keeping courseId/courseName per user instruction
          }
        }
        
        if (Object.keys(patch).length > 0) {
          await this.repo.update('users', student.id, patch, user);
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
