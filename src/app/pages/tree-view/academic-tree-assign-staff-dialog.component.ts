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
  originalSelectedIds = new Set<string>();

  // Transfer feature
  allGroups: any[] = [];
  transferMenuUserId: string | null = null;
  isTransferring = false;
  transferSearch = '';
  successMsg = '';
  availableSearch = '';
  assignedSearch = '';

  isSaving = false;
  errorMsg = '';

  get filteredAvailableUsers(): any[] {
    if (!this.availableSearch.trim()) return this.availableUsers;
    const q = this.availableSearch.toLowerCase().trim();
    return this.availableUsers.filter(u =>
      (u.name || u.displayName || '').toLowerCase().includes(q) ||
      (u.email || u.role || '').toLowerCase().includes(q)
    );
  }

  get filteredSelectedUsers(): any[] {
    if (!this.assignedSearch.trim()) return this.selectedUsers;
    const q = this.assignedSearch.toLowerCase().trim();
    return this.selectedUsers.filter(u =>
      (u.name || u.displayName || '').toLowerCase().includes(q) ||
      (u.email || u.role || '').toLowerCase().includes(q)
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
      console.warn('[Assign Staff Dialog] Name resolution warning:', e);
    }
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssignStaffDialogData,
    public readonly dialogRef: MatDialogRef<AcademicTreeAssignStaffDialogComponent>,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.node = this.data.node;
    this.resolveNames();
    
    const incomingAssigned = this.data.assignedStaff || [];
    const incomingAvailable = this.data.availableStaff || [];

    this.selectedUsers = this.uniqueUsers(incomingAssigned);
    this.availableUsers = this.uniqueUsers(
      incomingAvailable.filter((staff: any) => !this.isAlreadySelected(staff))
    );

    this.originalSelectedIds = new Set();
    this.selectedUsers.forEach(staff => {
      const id = this.getUserId(staff);
      if (id) this.originalSelectedIds.add(id);
    });

    this.loadTransferTargets();
  }

  async loadTransferTargets() {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const groups = await this.repo.getAllOnce<any>('classGroups', profile);
      this.allGroups = groups
        .filter((g: any) => g.id !== this.node?.id)
        .map((g: any) => ({ ...g, _type: 'classGroup' }));
    } catch (e) {
      // Transfer targets not critical
    }
  }

  public getUserId(user: any): string {
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
    return ['teacher', 'staff', 'madrasaincharge', 'coordinator', 'organizationadmin'].includes(role);
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

  removeStaff(staff: any): void {
    if (!staff) return;
    this.availableUsers = [...this.availableUsers, staff];
    this.selectedUsers = this.selectedUsers.filter(u => this.getUserId(u) !== this.getUserId(staff));
  }

  toggleTransferMenu(userId: string): void {
    this.transferMenuUserId = this.transferMenuUserId === userId ? null : userId;
    this.transferSearch = '';
  }

  get filteredTransferGroups(): any[] {
    if (!this.transferSearch) return this.allGroups;
    const q = this.transferSearch.toLowerCase();
    return this.allGroups.filter(g => (g.name || '').toLowerCase().includes(q));
  }

  async transferStaff(staff: any, targetGroup: any): Promise<void> {
    this.transferMenuUserId = null;
    this.isTransferring = true;
    this.errorMsg = '';
    try {
      const userProfile = await firstValueFrom(this.auth.profile$);
      const staffId = this.getUserId(staff);
      // Remove from current group
      const currentIds: string[] = Array.isArray(this.node?.assignedStaff)
        ? this.node.assignedStaff.map((s: any) => this.getUserId(s))
        : [];
      const newCurrentIds = currentIds.filter(id => id !== staffId);
      await this.repo.update('classGroups', this.node.id, { assignedStaffIds: newCurrentIds }, userProfile);
      // Add to target group
      const targetAssignedIds: string[] = Array.isArray(targetGroup.assignedStaffIds)
        ? [...targetGroup.assignedStaffIds]
        : [];
      if (!targetAssignedIds.includes(staffId)) targetAssignedIds.push(staffId);
      await this.repo.update('classGroups', targetGroup.id, { assignedStaffIds: targetAssignedIds }, userProfile);
      // Remove from selected list
      this.selectedUsers = this.selectedUsers.filter(u => this.getUserId(u) !== staffId);
      this.successMsg = `${staff.name || 'Staff'} transferred to ${targetGroup.name || 'target'}.`;
      setTimeout(() => this.successMsg = '', 3000);
    } catch (e: any) {
      this.errorMsg = e?.message || 'Transfer failed.';
    } finally {
      this.isTransferring = false;
    }
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
