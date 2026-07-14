import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface UserSwapData {
  currentUser: EntityRecord;
}

@Component({
  selector: 'app-user-swap-dialog',
  templateUrl: './user-swap-dialog.component.html',
  styleUrls: ['./user-swap-dialog.component.scss'],
  standalone: false,
})
export class UserSwapDialogComponent implements OnInit {
  loading = true;
  saving = false;

  availableUsers: EntityRecord[] = [];
  selectedUserId = '';
  reason = '';
  actionDate = new Date().toISOString().substring(0, 10);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserSwapData,
    private dialogRef: MatDialogRef<UserSwapDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const role = this.data.currentUser['role'];
      const isStudent = role === 'student';
      
      let allUsers: EntityRecord[] = [];
      if (isStudent) {
        allUsers = await this.repo.getAllOnce('students', profile);
      } else {
        allUsers = await this.repo.getAllOnce('staff', profile);
      }
      
      const currentUserUid = String(this.data.currentUser.id || this.data.currentUser['uid']);
      this.availableUsers = allUsers.filter((u: any) => 
        u['status'] !== 'inactive' && String(u.id || u['uid']) !== currentUserUid
      );
      
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  close() {
    this.dialogRef.close();
  }

  async submit() {
    if (!this.selectedUserId) {
      this.snackBar.open('Please select a user to swap assignments with.', 'Close', { duration: 3000 });
      return;
    }
    
    if (!this.reason) {
      this.snackBar.open('Please provide a reason for the swap.', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const currentUserUid = String(this.data.currentUser.id || this.data.currentUser['uid']);
      const targetUser = this.availableUsers.find(u => String(u.id || u['uid']) === this.selectedUserId);
      const targetUserUid = String(targetUser?.id || targetUser?.['uid']);

      const isStudent = this.data.currentUser['role'] === 'student';

      if (isStudent) {
        const currentUserUpdates = {
          courseId: targetUser?.['courseId'] || null,
          classId: targetUser?.['classId'] || null,
          groupId: targetUser?.['groupId'] || null,
        };
        const targetUserUpdates = {
          courseId: this.data.currentUser['courseId'] || null,
          classId: this.data.currentUser['classId'] || null,
          groupId: this.data.currentUser['groupId'] || null,
        };
        
        await this.repo.update('students', currentUserUid, currentUserUpdates, profile);
        await this.repo.update('students', targetUserUid, targetUserUpdates, profile);
        
        const cuUserDocId = String(this.data.currentUser['userId'] || currentUserUid);
        const tuUserDocId = String(targetUser?.['userId'] || targetUserUid);
        if (cuUserDocId) await this.repo.update('users', cuUserDocId, currentUserUpdates, profile).catch(e => console.warn(e));
        if (tuUserDocId) await this.repo.update('users', tuUserDocId, targetUserUpdates, profile).catch(e => console.warn(e));
        
      } else {
        const groups = await this.repo.getAllOnce('classGroups', profile);
        
        for (const group of groups) {
          const assignedStaff = Array.isArray(group['assignedStaffIds']) ? [...group['assignedStaffIds']] : [];
          const hasA = assignedStaff.includes(currentUserUid);
          const hasB = assignedStaff.includes(targetUserUid);
          
          if (hasA && !hasB) {
            const newStaff = assignedStaff.filter(id => id !== currentUserUid);
            newStaff.push(targetUserUid);
            await this.repo.update('classGroups', String(group.id), { assignedStaffIds: newStaff }, profile);
          } else if (hasB && !hasA) {
            const newStaff = assignedStaff.filter(id => id !== targetUserUid);
            newStaff.push(currentUserUid);
            await this.repo.update('classGroups', String(group.id), { assignedStaffIds: newStaff }, profile);
          }
        }
      }

      this.snackBar.open('Assignments swapped successfully', 'Close', { duration: 3000 });
      this.dialogRef.close({ success: true });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to swap users', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }
}
