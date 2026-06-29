import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AttendanceHistoryDialogComponent } from '../attendance-history-dialog/attendance-history-dialog.component';
import { EntityRecord } from '../../../core/services/repository.service';
import { PERMISSION_LABELS, ROLE_LABELS } from '../../../core/constants/defaults';
import { AuthService } from '../../../core/services/auth.service';
import { CredentialService } from '../../../core/services/credential.service';

export interface UserDetailsDialogData {
  user: EntityRecord;
}

@Component({
  selector: 'app-user-details-dialog',
  templateUrl: './user-details-dialog.component.html',
  styleUrls: ['./user-details-dialog.component.scss'],
  standalone: false,
})
export class UserDetailsDialogComponent implements OnInit {
  user: EntityRecord;
  currentUserRole?: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserDetailsDialogData,
    public dialogRef: MatDialogRef<UserDetailsDialogComponent>,
    private auth: AuthService,
    private credentialService: CredentialService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.user = data.user;
  }

  ngOnInit() {
    this.auth.profile$.subscribe(profile => {
      if (profile) {
        this.currentUserRole = profile.role;
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  viewAttendanceHistory(): void {
    this.dialog.open(AttendanceHistoryDialogComponent, {
      width: '500px',
      data: {
        title: `Attendance History for ${this.user['displayName'] || this.user['name']}`,
        studentId: String(this.user.id)
      }
    });
  }

  viewStudyPlan(): void {
    this.snackBar.open(`Study Plan for ${this.user['displayName'] || this.user['name']} coming soon.`, 'Close', { duration: 3000 });
  }

  getRoleLabel(roleKey: unknown): string {
    const key = String(roleKey);
    return ROLE_LABELS[key as keyof typeof ROLE_LABELS] || key;
  }

  getPermissionLabel(permKey: unknown): string {
    const key = String(permKey);
    return PERMISSION_LABELS[key as keyof typeof PERMISSION_LABELS] || key;
  }

  get permissions(): string[] {
    const perms = this.user['permissions'];
    return Array.isArray(perms) ? perms : [];
  }

  get credentialInfo(): { status: string, display: string } {
    return this.credentialService.getCredentialStatus(this.user);
  }

  get showTemporaryPassword(): boolean {
    const info = this.credentialInfo;
    return info.status === 'TEMP_PASSWORD_PENDING' && info.display !== 'Temporary password pending';
  }

  get passwordStatus(): string {
    const info = this.credentialInfo;
    if (info.status === 'TEMP_PASSWORD_PENDING') return 'Temporary password pending';
    if (info.status === 'PASSWORD_CHANGED') return 'Password changed';
    return 'Login not created';
  }

  get isSuperAdmin(): boolean {
    return this.user['role'] === 'superAdmin';
  }

  getDate(key: string): Date | string | null {
    const value = this.user[key];
    if (!value) return null;
    if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
      return (value as any).toDate();
    }
    return value as Date | string;
  }

  getArray(key: string): any[] {
    const value = this.user[key];
    return Array.isArray(value) ? value : [];
  }

  getString(key: string): string {
    return String(this.user[key] || '');
  }
}
