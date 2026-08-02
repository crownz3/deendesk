import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AttendanceHistoryDialogComponent } from '../attendance-history-dialog/attendance-history-dialog.component';
import { EntityRecord } from '../../../core/services/repository.service';
import { PERMISSION_LABELS, ROLE_LABELS } from '../../../core/constants/defaults';
import { AuthService } from '../../../core/services/auth.service';
import { CredentialService } from '../../../core/services/credential.service';
import { where, getDocs, query, collection, getFirestore } from 'firebase/firestore';
import { getDeenDeskFirebaseApp } from '../../../core/services/firebase-app';

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
  activeTab: 'minimal' | 'more' | 'students' = 'minimal';

  courseNames: string[] = [];
  classNames: string[] = [];
  groupNames: string[] = [];
  assignedStudents: EntityRecord[] = [];
  assignedGroups: EntityRecord[] = [];
  loadingStudents = false;

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

    this.loadAcademicDetails();
  }

  get userPhone(): string {
    const p = this.user['phone'] || this.user['mobileNumber'] || this.user['phoneNumber'] || this.user['mobile'];
    return p ? String(p) : '-';
  }

  async loadAcademicDetails() {
    this.loadingStudents = true;
    try {
      const firestore = getFirestore(getDeenDeskFirebaseApp());
      const usersRef = collection(firestore, 'users');
      
      const [groupsSnap, classesSnap, coursesSnap] = await Promise.all([
        getDocs(collection(firestore, 'classGroups')),
        getDocs(collection(firestore, 'classes')),
        getDocs(collection(firestore, 'courses'))
      ]);

      const allGroups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));
      const allClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));
      const allCourses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));

      const courseMap = new Map<string, string>();
      allCourses.forEach(c => { if (c.id) courseMap.set(c.id, String(c['name'] || c['title'] || c.id)); });

      const classMap = new Map<string, string>();
      allClasses.forEach(c => { if (c.id) classMap.set(c.id, String(c['name'] || c['title'] || c.id)); });

      const groupMap = new Map<string, string>();
      allGroups.forEach(g => { if (g.id) groupMap.set(g.id, String(g['name'] || g['title'] || g.id)); });

      const userStaffIds = [this.user.id, this.user['uid'], this.user['userId'], this.user['entityId'], this.user['email']]
        .map(value => String(value || '').trim())
        .filter(Boolean);

      // 1. Find assigned class groups
      let matchedGroups: EntityRecord[] = [];
      if (['staff', 'teacher', 'madrasaIncharge', 'coordinator'].includes(String(this.user['role']))) {
        matchedGroups = allGroups.filter(g =>
          Array.isArray(g['assignedStaffIds']) &&
          userStaffIds.some(id => (g['assignedStaffIds'] as unknown[]).map(String).includes(id))
        );
      }
      
      if (this.user['groupId']) {
        const found = allGroups.find(g => g.id === this.user['groupId']);
        if (found && !matchedGroups.some(mg => mg.id === found.id)) {
          matchedGroups.push(found);
        }
      }

      this.assignedGroups = matchedGroups;

      // Extract unique names
      const cNamesSet = new Set<string>();
      const clNamesSet = new Set<string>();
      const gNamesSet = new Set<string>();

      matchedGroups.forEach(g => {
        if (g['name']) gNamesSet.add(String(g['name']));
        if (g['courseId'] && courseMap.has(g['courseId'])) cNamesSet.add(courseMap.get(g['courseId'])!);
        if (g['classId'] && classMap.has(g['classId'])) clNamesSet.add(classMap.get(g['classId'])!);
      });

      // Check direct user references
      if (this.user['courseId'] && courseMap.has(this.user['courseId'])) cNamesSet.add(courseMap.get(this.user['courseId'])!);
      if (this.user['classId'] && classMap.has(this.user['classId'])) clNamesSet.add(classMap.get(this.user['classId'])!);

      this.courseNames = Array.from(cNamesSet);
      this.classNames = Array.from(clNamesSet);
      this.groupNames = Array.from(gNamesSet);

      // Load students in assigned groups
      if (matchedGroups.length > 0) {
        const studentPromises: Promise<EntityRecord[]>[] = [];
        for (const group of matchedGroups) {
          if (!group.id) continue;
          const q = query(usersRef, where('role', '==', 'student'), where('groupId', '==', group.id));
          studentPromises.push(getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord))));
        }
        const results = await Promise.all(studentPromises);
        const allStudents = results.reduce((acc, val) => acc.concat(val), []);
        const unique = new Map<string, EntityRecord>();
        for (const s of allStudents) {
          if (s.id) unique.set(s.id, s);
        }
        this.assignedStudents = Array.from(unique.values());
      }
    } catch (e) {
      console.error('Failed to load academic details', e);
    } finally {
      this.loadingStudents = false;
    }
  }

  openStudentDetails(student: EntityRecord): void {
    this.dialog.open(UserDetailsDialogComponent, {
      data: { user: student },
      width: '80vw',
      maxWidth: '80vw',
      height: '85vh',
      panelClass: 'user-details-dialog-panel'
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

  get isStaffProfile(): boolean {
    return ['staff', 'teacher', 'madrasaIncharge', 'coordinator'].includes(String(this.user['role']));
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
