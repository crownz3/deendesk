import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';

export interface AssignStaffDialogData {
  node: any;
  assignedStaff: any[];
  allStaff: any[];
}

@Component({
  selector: 'app-academic-tree-assign-staff-dialog',
  templateUrl: './academic-tree-assign-staff-dialog.component.html',
  styleUrls: ['./academic-tree-assign-staff-dialog.component.scss'],
  standalone: false,
})
export class AcademicTreeAssignStaffDialogComponent implements OnInit {
  node: any;
  availableUsers: any[] = [];
  selectedUsers: any[] = [];
  originalSelectedIds = new Set<string>();
  
  isSaving = false;
  errorMsg = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssignStaffDialogData,
    public readonly dialogRef: MatDialogRef<AcademicTreeAssignStaffDialogComponent>,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.node = this.data.node;
    const all = this.data.allStaff || [];
    const currentlyAssigned = this.data.assignedStaff || [];

    this.originalSelectedIds = new Set(currentlyAssigned.map(s => s.id));
    this.selectedUsers = [...currentlyAssigned];

    this.availableUsers = all.filter(staff => !this.staffMatchesNode(staff, this.node));

    console.log('[Academic Tree Assign Staff Open Debug]', {
      nodeId: this.node.id,
      nodeType: this.node.type,
      nodeTitle: this.node.title,
      assignedCount: this.selectedUsers.length,
      totalStaffLoaded: all.length,
    });
  }

  private userHasId(user: any, singleKeys: string[], arrayKeys: string[], id: string): boolean {
    if (!user || !id) return false;
    const hasSingle = singleKeys.some(key => user?.[key] === id);
    const hasArray = arrayKeys.some(key => Array.isArray(user?.[key]) && user[key].includes(id));
    return hasSingle || hasArray;
  }

  private staffMatchesNode(staff: any, node: any): boolean {
    if (!staff || !node?.id || !node?.type) return false;
    if (node.type === 'course') {
      return this.userHasId(staff, ['courseId', 'assignedCourseId'], ['courseIds', 'assignedCourseIds', 'teachingCourseIds'], node.id);
    }
    if (node.type === 'class') {
      return this.userHasId(staff, ['classId', 'assignedClassId'], ['classIds', 'assignedClassIds', 'teachingClassIds'], node.id);
    }
    if (node.type === 'subject') {
      return this.userHasId(staff, ['subjectId', 'assignedSubjectId'], ['subjectIds', 'assignedSubjectIds', 'teachingSubjectIds'], node.id);
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
      type: 'staff',
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
    const removedUsers = (this.data.assignedStaff || []).filter(s => !newSelectedIds.has(s.id));

    console.log('[Assign Save Debug]', {
      nodeId: this.node.id,
      nodeType: this.node.type,
      nodeTitle: this.node.title,
      selectedCount: this.selectedUsers.length,
      removedCount: removedUsers.length,
    });

    try {
      for (const staff of addedUsers) {
        let patch: any = {};
        if (this.node.type === 'course') {
          patch = { teachingCourseIds: arrayUnion(this.node.id) };
        } else if (this.node.type === 'class') {
          patch = { teachingClassIds: arrayUnion(this.node.id) };
        } else if (this.node.type === 'subject') {
          patch = { teachingSubjectIds: arrayUnion(this.node.id) };
        }
        await this.repo.update('users', staff.id, patch, user);
      }

      for (const staff of removedUsers) {
        let patch: any = {};
        if (this.node.type === 'course') {
          patch = { teachingCourseIds: arrayRemove(this.node.id) };
        } else if (this.node.type === 'class') {
          patch = { teachingClassIds: arrayRemove(this.node.id) };
        } else if (this.node.type === 'subject') {
          patch = { teachingSubjectIds: arrayRemove(this.node.id) };
        }
        await this.repo.update('users', staff.id, patch, user);
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
