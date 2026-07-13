import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface AssignStaffDialogData {
  mode?: string;
  node: any;
  assignedStaff: any[];
  availableStaff?: any[];
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
    
    const incomingAssigned = (this.data.assignedStaff || []).filter((user: any) => this.isStaffUser(user));
    const incomingAvailable = (this.data.availableStaff || []).filter((user: any) => this.isStaffUser(user));

    this.selectedUsers = this.uniqueUsers(incomingAssigned);
    this.availableUsers = this.uniqueUsers(
      incomingAvailable.filter((staff: any) => !this.isAlreadySelected(staff))
    );

    console.log('[Assign Staff Dialog Role Filter Debug]', {
      incomingAssignedCount: this.data.assignedStaff?.length || 0,
      incomingAvailableCount: this.data.availableStaff?.length || 0,
      filteredAssignedCount: this.selectedUsers.length,
      filteredAvailableCount: this.availableUsers.length,
      invalidIncomingAssigned: (this.data.assignedStaff || []).filter((user: any) => !this.isStaffUser(user)).map((user: any) => ({
        id: user.id || user.uid,
        role: user.role,
        name: user.name || user.displayName
      })),
      invalidIncomingAvailable: (this.data.availableStaff || []).filter((user: any) => !this.isStaffUser(user)).map((user: any) => ({
        id: user.id || user.uid,
        role: user.role,
        name: user.name || user.displayName
      })),
    });
  }

  private getUserId(user: any): string {
    return user?.id || user?.uid || user?.docId || '';
  }

  private getStaffAssignmentId(user: any): string {
    return String(user?.entityId || user?.id || user?.uid || user?.userId || '').trim();
  }

  private normalizeRole(role: string | undefined | null): string {
    return String(role || '').trim().toLowerCase();
  }

  private isStaffUser(user: any): boolean {
    const role = this.normalizeRole(user?.role);
    return role === 'teacher' || role === 'staff';
  }

  private isAlreadySelected(staff: any): boolean {
    const id = this.getUserId(staff);
    return this.selectedUsers.some(selected => this.getUserId(selected) === id);
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
      type: 'staff',
      availableCount: this.availableUsers.length,
      selectedCount: this.selectedUsers.length,
    });
  }

  addStaff(staff: any): void {
    if (!this.isStaffUser(staff)) {
      console.warn('[Blocked Non Staff In Staff Dialog]', {
        id: staff?.id || staff?.uid,
        role: staff?.role,
        name: staff?.name || staff?.displayName
      });
      return;
    }
    this.selectedUsers.push(staff);
    this.availableUsers.splice(this.availableUsers.indexOf(staff), 1);
  }

  addAll() {
    const validStaff = this.availableUsers.filter((user: any) => this.isStaffUser(user));
    this.selectedUsers = this.uniqueUsers([...this.selectedUsers, ...validStaff]);
    this.availableUsers = [];
  }

  removeAll() {
    this.availableUsers.push(...this.selectedUsers);
    this.selectedUsers = [];
  }

  async save() {
    this.isSaving = true;
    this.errorMsg = '';
    const userProfile = await firstValueFrom(this.auth.profile$);

    console.log('[Staff Assignment Current User Scope Debug]', {
      uid: userProfile?.uid,
      role: userProfile?.role,
      status: userProfile?.status,
      permissions: userProfile?.permissions,
      organizationId: userProfile?.organizationId,
      madrasaId: userProfile?.madrasaId,
      madrasaIds: userProfile?.madrasaIds,
      canManageStaff: userProfile?.permissions?.includes('manageStaff'),
    });

    if (userProfile?.role !== 'superAdmin' && !userProfile?.permissions?.includes('manageStaff')) {
      this.errorMsg = 'You do not have permission to assign staff.';
      this.isSaving = false;
      return;
    }

    this.selectedUsers = this.selectedUsers.filter((u: any) => this.isStaffUser(u));

    const invalidSelected = this.selectedUsers.filter((u: any) => !this.isStaffUser(u));
    if (invalidSelected.length) {
      console.error('[Blocked Save Invalid Staff Dialog Roles]', {
        invalidSelected: invalidSelected.map((u: any) => ({
          id: u.id || u.uid,
          role: u.role,
          name: u.name || u.displayName
        }))
      });
      this.isSaving = false;
      return;
    }

    if (this.node?.type !== 'classGroup') {
      this.errorMsg = 'Staff can only be assigned to class groups.';
      this.isSaving = false;
      return;
    }

    try {
      const selectedStaffIds = Array.from(new Set(
        this.selectedUsers.map(staff => this.getStaffAssignmentId(staff)).filter(Boolean)
      ));
      await this.repo.update('classGroups', this.node.id, { assignedStaffIds: selectedStaffIds }, userProfile);
      this.dialogRef.close({ updated: true });
    } catch (error: any) {
      console.error('[Staff Assignment Update Failed]', {
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
