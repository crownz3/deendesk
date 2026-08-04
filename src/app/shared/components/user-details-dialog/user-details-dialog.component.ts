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
  assignedStaffList: EntityRecord[] = [];
  assignedStaffNames: string[] = [];
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

  get totalStudentCount(): number {
    if (this.assignedStudents.length > 0) {
      return this.assignedStudents.length;
    }
    return this.assignedGroups.reduce((acc, g) => acc + (Number(g['studentCount']) || 0), 0);
  }

  public isUid(str: string): boolean {
    if (!str) return false;
    const trimmed = String(str).trim();
    return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) && !trimmed.includes(' ');
  }

  private extractAllStrings(val: any): string[] {
    if (!val) return [];
    if (typeof val === 'string') return [val.trim()];
    if (typeof val === 'number') return [String(val)];
    if (Array.isArray(val)) {
      return val.flatMap(item => this.extractAllStrings(item));
    }
    if (typeof val === 'object') {
      const ids: string[] = [];
      if (val.id) ids.push(String(val.id).trim());
      if (val.uid) ids.push(String(val.uid).trim());
      if (val.userId) ids.push(String(val.userId).trim());
      if (val.entityId) ids.push(String(val.entityId).trim());
      if (val.docId) ids.push(String(val.docId).trim());
      if (val.email) ids.push(String(val.email).trim());
      return ids;
    }
    return [];
  }

  async loadAcademicDetails() {
    this.loadingStudents = true;
    try {
      const firestore = getFirestore(getDeenDeskFirebaseApp());
      const studentsRef = collection(firestore, 'students');
      const usersRef = collection(firestore, 'users');
      
      const [groupsSnap, classesSnap, coursesSnap, usersSnap] = await Promise.all([
        getDocs(collection(firestore, 'classGroups')),
        getDocs(collection(firestore, 'classes')),
        getDocs(collection(firestore, 'courses')),
        getDocs(collection(firestore, 'users'))
      ]);

      const allGroups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));
      const allClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));
      const allCourses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityRecord));

      const userMap = new Map<string, EntityRecord>();
      allUsers.forEach(u => {
        if (u.id) userMap.set(u.id, u);
        if (u['uid']) userMap.set(String(u['uid']), u);
      });

      const courseMap = new Map<string, string>();
      allCourses.forEach(c => { if (c.id) courseMap.set(c.id, String(c['name'] || c['title'] || c.id)); });

      const classMap = new Map<string, string>();
      allClasses.forEach(c => { if (c.id) classMap.set(c.id, String(c['name'] || c['title'] || c.id)); });

      const groupMap = new Map<string, string>();
      allGroups.forEach(g => { if (g.id) groupMap.set(g.id, String(g['name'] || g['title'] || g.id)); });

      const isClassGroupDoc = Boolean(this.user['assignedStaffIds'] || this.user['studentCount'] || allGroups.some(g => g.id === this.user.id));
      const isClassDoc = Boolean(!isClassGroupDoc && allClasses.some(c => c.id === this.user.id));

      const userStaffIds = [
        ...this.extractAllStrings(this.user.id),
        ...this.extractAllStrings(this.user['id']),
        ...this.extractAllStrings(this.user['uid']),
        ...this.extractAllStrings(this.user['userId']),
        ...this.extractAllStrings(this.user['docId']),
        ...this.extractAllStrings(this.user['entityId']),
        ...this.extractAllStrings(this.user['staffId']),
        ...this.extractAllStrings(this.user['studentId']),
        ...this.extractAllStrings(this.user['email']),
      ].filter(Boolean);

      const userGroupIds = [
        ...this.extractAllStrings(this.user['groupId']),
        ...this.extractAllStrings(this.user['classGroupId']),
        ...this.extractAllStrings(this.user['groupIds']),
        ...this.extractAllStrings(this.user['classGroupIds']),
        ...this.extractAllStrings(this.user['assignedClassGroup']),
      ].filter(Boolean);

      const userClassIds = [
        ...this.extractAllStrings(this.user['classId']),
        ...this.extractAllStrings(this.user['classIds']),
      ].filter(Boolean);

      // 1. Find assigned class groups
      let matchedGroups: EntityRecord[] = [];

      if (isClassGroupDoc) {
        const currentGroup = allGroups.find(g => g.id === this.user.id) || this.user;
        matchedGroups = [currentGroup];
      } else {
        matchedGroups = allGroups.filter(g => {
          const gId = String(g.id || g['docId'] || '').trim();
          
          if (userGroupIds.includes(gId)) return true;

          const staffTokens = [
            ...this.extractAllStrings(g['assignedStaffIds']),
            ...this.extractAllStrings(g['assignedStaff']),
            ...this.extractAllStrings(g['staffIds']),
            ...this.extractAllStrings(g['teacherIds']),
            ...this.extractAllStrings(g['teachers']),
            ...this.extractAllStrings(g['staff']),
          ];
          if (userStaffIds.some(id => staffTokens.includes(id))) return true;

          const studentTokens = [
            ...this.extractAllStrings(g['assignedStudentIds']),
            ...this.extractAllStrings(g['assignedStudents']),
            ...this.extractAllStrings(g['studentIds']),
            ...this.extractAllStrings(g['students']),
          ];
          if (userStaffIds.some(id => studentTokens.includes(id))) return true;

          if (g['classId'] && userClassIds.includes(String(g['classId']).trim())) {
            return true;
          }

          return false;
        });
      }

      this.assignedGroups = matchedGroups;

      // Extract unique names
      const cNamesSet = new Set<string>();
      const clNamesSet = new Set<string>();
      const gNamesSet = new Set<string>();

      if (this.user['name'] && (isClassGroupDoc || this.user['assignedStaffIds'])) {
        gNamesSet.add(String(this.user['name']));
      }

      matchedGroups.forEach(g => {
        if (g['name']) gNamesSet.add(String(g['name']));
        if (g['courseId'] && courseMap.has(g['courseId'])) cNamesSet.add(courseMap.get(g['courseId'])!);
        if (g['classId'] && classMap.has(g['classId'])) clNamesSet.add(classMap.get(g['classId'])!);
      });

      // Direct group / course / class references on user object
      userGroupIds.forEach(gid => {
        if (groupMap.has(gid)) {
          gNamesSet.add(groupMap.get(gid)!);
        } else if (gid && !this.isUid(gid)) {
          gNamesSet.add(gid);
        }
      });

      const directGroupRef = this.user['assignedClassGroup'] || this.user['groupName'] || this.user['group'] || this.user['section'];
      if (directGroupRef && typeof directGroupRef === 'string') {
        gNamesSet.add(directGroupRef);
      }

      // Fallback: If groupNames is still empty BUT user has classId, find matching class groups by classId
      if (gNamesSet.size === 0 && userClassIds.length > 0) {
        allGroups.forEach(g => {
          if (g['classId'] && userClassIds.includes(String(g['classId']).trim())) {
            if (g['name']) gNamesSet.add(String(g['name']));
            if (!matchedGroups.some(mg => mg.id === g.id)) matchedGroups.push(g);
          }
        });
      }

      if (this.user['courseId'] && courseMap.has(this.user['courseId'])) cNamesSet.add(courseMap.get(this.user['courseId'])!);
      if (this.user['classId'] && classMap.has(this.user['classId'])) clNamesSet.add(classMap.get(this.user['classId'])!);

      this.courseNames = Array.from(cNamesSet);
      this.classNames = Array.from(clNamesSet);
      this.groupNames = Array.from(gNamesSet);

      // Extract Assigned Staff (Teachers / Staff assigned to these class groups or class)
      const staffIdsSet = new Set<string>();
      const staffNamesSet = new Set<string>();

      const directStaffTokens = [
        ...this.extractAllStrings(this.user['assignedStaffIds']),
        ...this.extractAllStrings(this.user['assignedStaff']),
        ...this.extractAllStrings(this.user['staffIds']),
        ...this.extractAllStrings(this.user['teacherIds']),
        ...this.extractAllStrings(this.user['groupStaff']),
      ];
      directStaffTokens.forEach(id => staffIdsSet.add(id));

      matchedGroups.forEach(g => {
        const tokens = [
          ...this.extractAllStrings(g['assignedStaffIds']),
          ...this.extractAllStrings(g['assignedStaff']),
          ...this.extractAllStrings(g['staffIds']),
          ...this.extractAllStrings(g['teacherIds']),
          ...this.extractAllStrings(g['groupStaff']),
        ];
        tokens.forEach(id => staffIdsSet.add(id));
      });

      const staffList: EntityRecord[] = [];
      staffIdsSet.forEach(sid => {
        if (userMap.has(sid)) {
          staffList.push(userMap.get(sid)!);
        } else if (!this.isUid(sid)) {
          staffNamesSet.add(sid);
        }
      });

      this.assignedStaffList = staffList;
      this.assignedStaffNames = Array.from(staffNamesSet);

      // 2. Load students in assigned groups across both 'students' and 'users' collections
      const uniqueStudentsMap = new Map<string, EntityRecord>();
      const groupIdsToQuery = Array.from(new Set([
        ...matchedGroups.map(g => String(g.id)),
        ...(isClassGroupDoc ? [String(this.user.id)] : [])
      ])).filter(Boolean);

      const fetchQueries: Promise<any>[] = [];

      for (const gid of groupIdsToQuery) {
        fetchQueries.push(getDocs(query(studentsRef, where('groupId', '==', gid))));
        fetchQueries.push(getDocs(query(studentsRef, where('classGroupId', '==', gid))));
        fetchQueries.push(getDocs(query(usersRef, where('role', '==', 'student'), where('groupId', '==', gid))));
        fetchQueries.push(getDocs(query(usersRef, where('role', '==', 'student'), where('classGroupId', '==', gid))));
      }

      const classIdsToQuery = Array.from(new Set([
        ...matchedGroups.map(g => String(g['classId'] || '')),
        ...userClassIds
      ])).filter(Boolean);

      for (const cid of classIdsToQuery) {
        fetchQueries.push(getDocs(query(studentsRef, where('classId', '==', cid))));
        fetchQueries.push(getDocs(query(usersRef, where('role', '==', 'student'), where('classId', '==', cid))));
      }

      const explicitStudentIds = [
        ...this.extractAllStrings(this.user['assignedStudentIds']),
        ...this.extractAllStrings(this.user['studentIds']),
        ...matchedGroups.flatMap(g => [
          ...this.extractAllStrings(g['assignedStudentIds']),
          ...this.extractAllStrings(g['studentIds'])
        ])
      ];

      explicitStudentIds.forEach(sid => {
        if (userMap.has(sid)) {
          const studentDoc = userMap.get(sid)!;
          if (studentDoc.id) uniqueStudentsMap.set(studentDoc.id, studentDoc);
        }
      });

      const snaps = await Promise.all(fetchQueries);
      snaps.forEach(snap => {
        if (snap && snap.docs) {
          snap.docs.forEach((doc: any) => {
            const data = doc.data();
            const id = doc.id;
            if (id && !uniqueStudentsMap.has(id)) {
              uniqueStudentsMap.set(id, { id, ...data });
            }
          });
        }
      });

      this.assignedStudents = Array.from(uniqueStudentsMap.values());
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
