import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { getFirestore, arrayUnion, arrayRemove, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
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
  
  isSaving = false;
  errorMsg = '';
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssignStaffDialogData,
    public readonly dialogRef: MatDialogRef<AcademicTreeAssignStaffDialogComponent>,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.node = this.data.node;
    const all = this.data.allStaff || [];
    
    const incomingAssigned = (this.data.assignedStaff || []).filter((user: any) => this.isStaffUser(user));
    const incomingAvailable = (this.data.availableStaff || []).filter((user: any) => this.isStaffUser(user));
    const allStaff = (this.data.allStaff || []).filter((user: any) => this.isStaffUser(user));

    this.selectedUsers = this.uniqueUsers(incomingAssigned);
    this.availableUsers = this.uniqueUsers(
      incomingAvailable.filter((staff: any) => !this.isAlreadySelected(staff))
    );

    this.originalSelectedIds = new Set(this.selectedUsers.map(s => this.getUserId(s)).filter(Boolean));

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

  private getUserId(user: any): string {
    return user?.id || user?.uid || user?.docId || '';
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

  private validateStaffAssignmentScope(staff: any, profile: any): boolean {
    const role = String(staff?.role || '').toLowerCase();
    const isStaffRole = role === 'teacher' || role === 'staff';
    const sameOrg = staff?.organizationId === profile?.organizationId;

    const currentMadrasaIds = Array.isArray(profile?.madrasaIds)
      ? [...profile.madrasaIds]
      : [];

    if (profile?.madrasaId && !currentMadrasaIds.includes(profile.madrasaId)) {
      currentMadrasaIds.push(profile.madrasaId);
    }

    const staffMadrasaIds = Array.isArray(staff?.madrasaIds)
      ? [...staff.madrasaIds]
      : [];

    if (staff?.madrasaId && !staffMadrasaIds.includes(staff.madrasaId)) {
      staffMadrasaIds.push(staff.madrasaId);
    }

    // Admins and coordinators might have global madrasa bypass, but we enforce overlap for madrasaIncharge
    const madrasaOverlap = (profile?.role === 'superAdmin' || profile?.role === 'organizationAdmin') || staffMadrasaIds.some((id: string) => currentMadrasaIds.includes(id));

    const valid = isStaffRole && sameOrg && madrasaOverlap;

    console.log('[Staff Assignment Scope Precheck]', {
      staffId: staff.id || staff.uid,
      valid,
      isStaffRole,
      sameOrg,
      madrasaOverlap,
      staffRole: staff.role,
      staffOrganizationId: staff.organizationId,
      staffMadrasaId: staff.madrasaId,
      staffMadrasaIds: staff.madrasaIds,
      currentUserOrganizationId: profile.organizationId,
      currentUserMadrasaId: profile.madrasaId,
      currentUserMadrasaIds: profile.madrasaIds,
    });

    return valid;
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

    const newSelectedIds = new Set(this.selectedUsers.map(s => s.id));
    
    const addedUsers = this.selectedUsers.filter(s => !this.originalSelectedIds.has(s.id));
    const removedUsers = (this.data.assignedStaff || []).filter(s => !newSelectedIds.has(s.id));

    console.log('[Assign Staff Save Start Debug]', {
      nodeId: this.node?.id,
      nodeType: this.node?.type,
      nodeTitle: this.node?.title,
      selectedStaffCount: this.selectedUsers?.length || 0,
      originalAssignedCount: this.originalSelectedIds?.size || 0,
    });

    console.log('[Assign Staff Save Diff Result Debug]', {
      addedStaff: addedUsers.map(staff => ({
        id: staff.id || staff.uid,
        role: staff.role,
        status: staff.status,
        organizationId: staff.organizationId,
        madrasaId: staff.madrasaId,
        madrasaIds: staff.madrasaIds,
        teachingClassIds: staff.teachingClassIds,
      })),
      removedStaff: removedUsers.map(staff => ({
        id: staff.id || staff.uid,
        role: staff.role,
        status: staff.status,
        organizationId: staff.organizationId,
        madrasaId: staff.madrasaId,
        madrasaIds: staff.madrasaIds,
        teachingClassIds: staff.teachingClassIds,
      })),
    });

    try {
      for (const staff of addedUsers) {
        if (!this.validateStaffAssignmentScope(staff, userProfile)) {
          throw new Error(`Staff member ${staff.name || staff.displayName || staff.id} is outside your assigned madrasa scope or missing madrasa assignment.`);
        }

        let patch: any = {};
        if (this.node.type === 'course') {
          patch = { teachingCourseIds: arrayUnion(this.node.id), updatedAt: serverTimestamp(), updatedBy: userProfile?.uid };
        } else if (this.node.type === 'class') {
          patch = { teachingClassIds: arrayUnion(this.node.id), updatedAt: serverTimestamp(), updatedBy: userProfile?.uid };
        } else if (this.node.type === 'subject') {
          patch = { teachingSubjectIds: arrayUnion(this.node.id), updatedAt: serverTimestamp(), updatedBy: userProfile?.uid };
        }
        
        console.log('[Staff Assignment Update Debug]', {
          writePath: `users/${staff.id || staff.uid}`,
          staffId: staff.id || staff.uid,
          classId: this.node?.id,
          patch,
        });

        const staffDocRef = doc(this.firestore, 'users', staff.id || staff.uid);
        const staffDoc = await getDoc(staffDocRef);
        console.log('[Firestore OldData Diagnostic]', {
          staffId: staff.id || staff.uid,
          exists: staffDoc.exists(),
          data: staffDoc.data()
        });

        try {
          await updateDoc(staffDocRef, patch);
        } catch (e: any) {
          throw new Error(`Failed on staff ${staff.id || staff.uid}: ${e.message}`);
        }
      }

      for (const staff of removedUsers) {
        if (!this.validateStaffAssignmentScope(staff, userProfile)) {
          throw new Error(`Staff member ${staff.name || staff.displayName || staff.id} is outside your assigned madrasa scope or missing madrasa assignment.`);
        }

        let patch: any = {};
        if (this.node.type === 'course') {
          patch = { teachingCourseIds: arrayRemove(this.node.id), updatedAt: serverTimestamp(), updatedBy: userProfile?.uid };
        } else if (this.node.type === 'class') {
          patch = { teachingClassIds: arrayRemove(this.node.id), updatedAt: serverTimestamp(), updatedBy: userProfile?.uid };
        } else if (this.node.type === 'subject') {
          patch = { teachingSubjectIds: arrayRemove(this.node.id), updatedAt: serverTimestamp(), updatedBy: userProfile?.uid };
        }

        console.log('[Staff Assignment Update Debug]', {
          writePath: `users/${staff.id || staff.uid}`,
          staffId: staff.id || staff.uid,
          classId: this.node?.id,
          patch,
        });

        const staffDocRef = doc(this.firestore, 'users', staff.id || staff.uid);
        const staffDoc = await getDoc(staffDocRef);
        console.log('[Firestore OldData Diagnostic]', {
          staffId: staff.id || staff.uid,
          exists: staffDoc.exists(),
          data: staffDoc.data()
        });

        try {
          await updateDoc(staffDocRef, patch);
        } catch (e: any) {
          throw new Error(`Failed on staff ${staff.id || staff.uid}: ${e.message}`);
        }
      }

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
