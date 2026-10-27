import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AttendanceHistoryDialogComponent } from '../attendance-history-dialog/attendance-history-dialog.component';
import { StudentProgressTrackerDialogComponent } from '../student-progress-tracker-dialog/student-progress-tracker-dialog.component';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { PERMISSION_LABELS, ROLE_LABELS } from '../../../core/constants/defaults';
import { AuthService } from '../../../core/services/auth.service';
import { CredentialService } from '../../../core/services/credential.service';
import { getDeenDeskFirestore } from '../../../core/services/firebase-app';

export interface UserDetailsDialogData {
  user: EntityRecord;
}

export interface GroupedMadrasaAssignment {
  madrasaId: string;
  madrasaName: string;
  classGroups: {
    groupId: string;
    groupName: string;
    className?: string;
    courseName?: string;
    studentCount: number;
    students: EntityRecord[];
  }[];
  totalStudents: number;
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
  groupedAssignments: GroupedMadrasaAssignment[] = [];
  assignedStaffList: EntityRecord[] = [];
  assignedStaffNames: string[] = [];
  loadingStudents = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserDetailsDialogData,
    public dialogRef: MatDialogRef<UserDetailsDialogComponent>,
    private auth: AuthService,
    private credentialService: CredentialService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private repo: RepositoryService
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
    if (typeof val === 'string') {
      if (val.includes(',')) {
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [val.trim()];
    }
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

  private addSplitNames(val: any, targetSet: Set<string>): void {
    if (!val) return;
    if (typeof val === 'string') {
      if (val.includes(',')) {
        val.split(',').map(s => s.trim()).filter(Boolean).forEach(name => targetSet.add(name));
      } else {
        const trimmed = val.trim();
        if (trimmed) targetSet.add(trimmed);
      }
    } else if (Array.isArray(val)) {
      val.forEach(item => this.addSplitNames(item, targetSet));
    }
  }

  async loadAcademicDetails() {
    this.loadingStudents = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      const [allGroups, allClasses, allCourses, allUsers, directStudents, allMadrasas] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('classGroups', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('classes', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('courses', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('users', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('students', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => [])
      ]);

      const userStudents = allUsers.filter(u => u['role'] === 'student');

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

      const madrasaMap = new Map<string, string>();
      allMadrasas.forEach(m => { if (m.id) madrasaMap.set(m.id, String(m['name'] || m['title'] || m.id)); });

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
        const explicitGroups = allGroups.filter(g => {
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

          return false;
        });

        if (explicitGroups.length > 0) {
          matchedGroups = explicitGroups;
        } else {
          matchedGroups = allGroups.filter(g => {
            if (g['classId'] && userClassIds.includes(String(g['classId']).trim())) {
              return true;
            }
            return false;
          });
        }
      }

      this.assignedGroups = matchedGroups;

      // Extract unique names
      const cNamesSet = new Set<string>();
      const clNamesSet = new Set<string>();
      const gNamesSet = new Set<string>();

      if (this.user['name'] && isClassGroupDoc) {
        this.addSplitNames(this.user['name'], gNamesSet);
      }

      matchedGroups.forEach(g => {
        if (g['name']) this.addSplitNames(g['name'], gNamesSet);
        if (g['courseId'] && courseMap.has(g['courseId'])) cNamesSet.add(courseMap.get(g['courseId'])!);
        if (g['classId'] && classMap.has(g['classId'])) clNamesSet.add(classMap.get(g['classId'])!);
      });

      // Direct group / course / class references on user object
      userGroupIds.forEach(gid => {
        if (groupMap.has(gid)) {
          this.addSplitNames(groupMap.get(gid)!, gNamesSet);
        } else if (gid && !this.isUid(gid)) {
          this.addSplitNames(gid, gNamesSet);
        }
      });

      const directGroupRef = this.user['assignedClassGroup'] || this.user['groupName'] || this.user['group'] || this.user['section'];
      if (directGroupRef) {
        this.addSplitNames(directGroupRef, gNamesSet);
      }

      // Fallback: If groupNames is still empty BUT user has classId, find matching class groups by classId
      if (gNamesSet.size === 0 && userClassIds.length > 0) {
        allGroups.forEach(g => {
          if (g['classId'] && userClassIds.includes(String(g['classId']).trim())) {
            if (g['name']) this.addSplitNames(g['name'], gNamesSet);
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

      // 2. Load and filter assigned students across both 'students' and 'users' collections
      const studentMap = new Map<string, EntityRecord>();
      [...directStudents, ...userStudents].forEach(st => {
        const nameStr = String(st['displayName'] || st['name'] || st['studentName'] || '').trim().toLowerCase();
        const emailStr = String(st['email'] || '').trim().toLowerCase();
        const uidStr = String(st['uid'] || st['userId'] || st['studentId'] || '').trim();
        const docId = String(st.id || '').trim();

        const key = nameStr || uidStr || (emailStr && emailStr !== 'n/a' ? emailStr : '') || docId;
        if (key) {
          const existing = studentMap.get(key) || {};
          studentMap.set(key, { ...existing, ...st });
        }
      });
      const allStudents = Array.from(studentMap.values());

      const groupIdsSet = new Set([
        ...matchedGroups.map(g => String(g.id).trim()),
        ...(isClassGroupDoc ? [String(this.user.id).trim()] : [])
      ].filter(Boolean));

      const classIdsSet = new Set([
        ...matchedGroups.map(g => String(g['classId'] || '').trim()).filter(Boolean),
        ...userClassIds
      ]);

      const explicitStudentIds = [
        ...this.extractAllStrings(this.user['assignedStudentIds']),
        ...this.extractAllStrings(this.user['studentIds']),
        ...matchedGroups.flatMap(g => [
          ...this.extractAllStrings(g['assignedStudentIds']),
          ...this.extractAllStrings(g['studentIds'])
        ])
      ];
      const explicitSet = new Set(explicitStudentIds);

      this.assignedStudents = allStudents.filter(st => {
        const sStatus = String(st['status'] || st['state'] || '').toLowerCase();
        if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(sStatus)) return false;

        if (st.id && explicitSet.has(st.id)) return true;

        const stTeacherTokens = [
          ...this.extractAllStrings(st['teacherId']),
          ...this.extractAllStrings(st['assignedStaffId']),
          ...this.extractAllStrings(st['staffId']),
          ...this.extractAllStrings(st['teacherUid']),
          ...this.extractAllStrings(st['assignedTeacherId']),
        ];
        if (stTeacherTokens.some(tok => userStaffIds.includes(tok))) return true;

        const userCourseIds = [
          ...this.extractAllStrings(this.user['courseId']),
          ...this.extractAllStrings(this.user['courseIds']),
          ...matchedGroups.map(g => String(g['courseId'] || '').trim()).filter(Boolean),
          ...allClasses.filter(c => userClassIds.includes(String(c.id).trim())).map(c => String(c['courseId'] || '').trim()).filter(Boolean)
        ];

        const stGroupTokens = [
          ...this.extractAllStrings(st['groupId']),
          ...this.extractAllStrings(st['classGroupId']),
          ...this.extractAllStrings(st['group']),
          ...this.extractAllStrings(st['groupIds']),
          ...this.extractAllStrings(st['classGroupIds']),
          ...this.extractAllStrings(st['assignedGroupId']),
        ];
        if (stGroupTokens.some(gid => groupIdsSet.has(gid))) return true;

        const stClassTokens = [
          ...this.extractAllStrings(st['classId']),
          ...this.extractAllStrings(st['assignedClassId']),
          ...this.extractAllStrings(st['classIds']),
        ];
        if (stClassTokens.some(cid => classIdsSet.has(cid))) return true;

        const stCourseTokens = [
          ...this.extractAllStrings(st['courseId']),
          ...this.extractAllStrings(st['assignedCourseId']),
          ...this.extractAllStrings(st['courseIds'])
        ];
        if (stCourseTokens.some(cid => userCourseIds.includes(cid))) return true;

        return false;
      });

      // 3. Build Madrasa-scoped Group Assignments for clear Multi-Madrasa & Multi-Group display
      const groupedMap = new Map<string, GroupedMadrasaAssignment>();

      matchedGroups.forEach(g => {
        const gId = String(g.id || g['docId'] || '').trim();
        const gName = String(g['name'] || g['title'] || gId).trim();
        
        let mId = String(g['madrasaId'] || g['madrasa'] || '').trim();
        if (!mId && g['classId']) {
          const parentClass = allClasses.find(c => String(c.id).trim() === String(g['classId']).trim());
          if (parentClass && parentClass['madrasaId']) {
            mId = String(parentClass['madrasaId']).trim();
          }
        }
        if (!mId && this.user['madrasaId']) {
          mId = String(this.user['madrasaId']).trim();
        }

        const mName = mId && madrasaMap.has(mId) ? madrasaMap.get(mId)! : (mId || 'General Madrasa');

        // Filter students assigned to this group
        const cleanGId = gId.toLowerCase().trim();
        const groupStudents = this.assignedStudents.filter(st => {
          const stGroupTokens = [
            ...this.extractAllStrings(st['groupId']),
            ...this.extractAllStrings(st['classGroupId']),
            ...this.extractAllStrings(st['group']),
            ...this.extractAllStrings(st['groupIds']),
            ...this.extractAllStrings(st['classGroupIds']),
            ...this.extractAllStrings(st['assignedGroupId']),
            ...this.extractAllStrings(st['sectionId']),
            ...this.extractAllStrings(st['section']),
          ].map(v => v.toLowerCase().trim());
          return stGroupTokens.includes(cleanGId);
        });

        let clsName = '';
        if (g['classId'] && classMap.has(g['classId'])) {
          clsName = classMap.get(g['classId'])!;
        }
        let crsName = '';
        if (g['courseId'] && courseMap.has(g['courseId'])) {
          crsName = courseMap.get(g['courseId'])!;
        }

        const groupObj = {
          groupId: gId,
          groupName: gName,
          className: clsName,
          courseName: crsName,
          studentCount: groupStudents.length || (Number(g['studentCount']) || 0),
          students: groupStudents
        };

        const groupKey = mId || 'general';
        if (!groupedMap.has(groupKey)) {
          groupedMap.set(groupKey, {
            madrasaId: mId || 'general',
            madrasaName: mName,
            classGroups: [],
            totalStudents: 0
          });
        }
        const gAssignment = groupedMap.get(groupKey)!;
        gAssignment.classGroups.push(groupObj);
        gAssignment.totalStudents += groupObj.studentCount;
      });

      // Catch any assigned students not in matchedGroups
      const assignedGroupStudentIds = new Set(
        Array.from(groupedMap.values())
          .flatMap(ga => ga.classGroups)
          .flatMap(cg => cg.students)
          .map(st => String(st.id || '').trim())
      );

      const unassignedStudents = this.assignedStudents.filter(st => !assignedGroupStudentIds.has(String(st.id || '').trim()));
      if (unassignedStudents.length > 0) {
        const unassignedKey = 'other_students';
        if (!groupedMap.has(unassignedKey)) {
          groupedMap.set(unassignedKey, {
            madrasaId: 'other',
            madrasaName: 'Directly Assigned Students',
            classGroups: [{
              groupId: 'general',
              groupName: 'General Students',
              studentCount: unassignedStudents.length,
              students: unassignedStudents
            }],
            totalStudents: unassignedStudents.length
          });
        }
      }

      this.groupedAssignments = Array.from(groupedMap.values());

      console.log('🔍 [UserDetailsDialog StudentScoping Debug]', {
        staffName: this.user?.['displayName'] || this.user?.['name'] || this.user?.['email'],
        staffRole: this.user?.['role'],
        groupIdsSet: Array.from(groupIdsSet),
        classIdsSet: Array.from(classIdsSet),
        groupedAssignments: this.groupedAssignments,
        totalAssignedStudents: this.assignedStudents.length
      });
    } catch (e) {
      console.error('Failed to load academic details', e);
    } finally {
      this.loadingStudents = false;
    }
  }

  openStudentDetails(student: EntityRecord): void {
    this.dialog.open(UserDetailsDialogComponent, {
      data: { user: student },
      width: '95vw',
      maxWidth: '900px',
      maxHeight: '90vh',
      panelClass: 'user-details-dialog-panel'
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  openProgressTracker(): void {
    this.dialog.open(StudentProgressTrackerDialogComponent, {
      width: '95vw',
      maxWidth: '1000px',
      maxHeight: '92vh',
      panelClass: 'student-progress-tracker-dialog-panel',
      data: { student: this.user }
    });
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
