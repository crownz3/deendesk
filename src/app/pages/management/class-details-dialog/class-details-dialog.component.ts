import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-class-details-dialog',
  templateUrl: './class-details-dialog.component.html',
  styleUrls: ['./class-details-dialog.component.scss'],
  standalone: false,
})
export class ClassDetailsDialogComponent implements OnInit {
  classRecord: EntityRecord;
  loadingCounts = true;

  groupsCount = 0;
  studentsCount = 0;
  staffCount = 0;

  groups: any[] = [];
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { classRecord: EntityRecord },
    private repo: RepositoryService,
    private auth: AuthService,
    private router: Router,
    private dialogRef: MatDialogRef<ClassDetailsDialogComponent>
  ) {
    this.classRecord = data.classRecord;
  }

  ngOnInit(): void {
    this.loadCounts();
  }

  courseStage = '';

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

  get stageDisplay(): string {
    const r = this.classRecord;
    if (!r) return '-';
    const val = r['stage'] || r['stageName'] || r['level'] || r['levelName'] || r['levels'] || r['stages'];
    if (Array.isArray(val) && val.length > 0) {
      return val.filter(Boolean).join(', ');
    }
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
    if (typeof val === 'number') {
      return String(val);
    }
    if (this.courseStage) {
      return this.courseStage;
    }
    return '-';
  }

  getRoleLabel(role: any): string {
    if (!role || typeof role !== 'string') return 'Staff';
    const r = role.toLowerCase();
    if (r.includes('teacher')) return 'Teacher';
    if (r.includes('incharge')) return 'Madrasa Incharge';
    if (r.includes('coordinator')) return 'Coordinator';
    if (r.includes('admin')) return 'Admin';
    if (r.includes('ustadh')) return 'Ustadh';
    return role;
  }

  private async loadCounts(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const targetClassId = String(this.classRecord?.id || this.classRecord?.['classId'] || '').trim();

      const [groupsSnap, coursesSnap, studentsSnap, usersSnap, staffSnap] = await Promise.all([
        this.repo.getAllOnce('classGroups', profile).catch(() => []),
        this.repo.getAllOnce('courses', profile).catch(() => []),
        this.repo.getAllOnce('students', profile).catch(() => []),
        this.repo.getAllOnce('users', profile).catch(() => []),
        this.repo.getAllOnce('staff', profile).catch(() => [])
      ]);

      // Stage fallback from course
      if (this.classRecord?.['courseId']) {
        const matchedCourse = coursesSnap.find((c: any) => c.id === this.classRecord['courseId']);
        if (matchedCourse) {
          const cStage = matchedCourse['stage'] || matchedCourse['stages'] || matchedCourse['name'];
          if (Array.isArray(cStage)) {
            this.courseStage = cStage.filter(Boolean).join(', ');
          } else if (typeof cStage === 'string') {
            this.courseStage = cStage;
          }
        }
      }

      // Filter groups
      this.groups = groupsSnap.filter((g: any) => String(g['classId'] || '') === targetClassId)
                              .sort((a: any, b: any) => (a['displayOrder'] || 99) - (b['displayOrder'] || 99));
      this.groupsCount = this.groups.length;

      // Merge all student records across `students` & `users` collections
      const studentMap = new Map<string, EntityRecord>();
      const addStudentIfValid = (s: EntityRecord) => {
        const id = s.id || s['uid'] || s['entityId'];
        if (!id || studentMap.has(id)) return;
        const role = String(s['role'] || '').toLowerCase();
        const roles: string[] = Array.isArray(s['roles']) ? s['roles'].map((r: any) => String(r).toLowerCase()) : (role ? [role] : []);
        if (roles.includes('student') || role === 'student' || s['entityType'] === 'student' || s['admissionNo']) {
          studentMap.set(id, s);
        }
      };

      studentsSnap.forEach(addStudentIfValid);
      usersSnap.forEach(addStudentIfValid);
      const allStudents = Array.from(studentMap.values());

      // Filter students for this class
      const classStudents = allStudents.filter((st: any) => {
        const cTokens = [
          ...this.extractAllStrings(st['classId']),
          ...this.extractAllStrings(st['assignedClassId']),
          ...this.extractAllStrings(st['classIds']),
          ...this.extractAllStrings(st['assignedClassIds'])
        ];
        if (cTokens.includes(targetClassId)) return true;

        // Check if student's group belongs to this class
        const gTokens = [
          ...this.extractAllStrings(st['groupId']),
          ...this.extractAllStrings(st['classGroupId']),
          ...this.extractAllStrings(st['assignedGroupId']),
          ...this.extractAllStrings(st['groupIds']),
          ...this.extractAllStrings(st['classGroupIds'])
        ];
        return this.groups.some((g: any) => gTokens.includes(g.id));
      });

      // Merge all staff records across `staff` & `users` collections
      const staffRolesList = ['teacher', 'staff', 'madrasaincharge', 'coordinator', 'organizationadmin', 'ustadh', 'stagehead', 'headteacher'];
      const staffMap = new Map<string, EntityRecord>();
      const addStaffIfValid = (st: EntityRecord) => {
        const id = st.id || st['uid'] || st['entityId'];
        if (!id || staffMap.has(id)) return;
        const role = String(st['role'] || '').toLowerCase();
        const roles: string[] = Array.isArray(st['roles']) ? st['roles'].map((r: any) => String(r).toLowerCase()) : (role ? [role] : []);
        if (roles.some((r: string) => staffRolesList.includes(r)) || staffRolesList.includes(role) || st['entityType'] === 'staff') {
          staffMap.set(id, st);
        }
      };

      staffSnap.forEach(addStaffIfValid);
      usersSnap.forEach(addStaffIfValid);
      const allStaff = Array.from(staffMap.values());

      // Associate students and staff per group
      const allClassStudentsSet = new Set<string>();
      const allClassStaffSet = new Set<string>();

      this.groups.forEach((group: any) => {
        // Group students
        group.groupStudents = classStudents.filter((st: any) => {
          const gTokens = [
            ...this.extractAllStrings(st['groupId']),
            ...this.extractAllStrings(st['classGroupId']),
            ...this.extractAllStrings(st['assignedGroupId']),
            ...this.extractAllStrings(st['groupIds']),
            ...this.extractAllStrings(st['classGroupIds'])
          ];
          if (gTokens.includes(group.id)) return true;
          if (group.isDefault && !gTokens.length) return true;
          return false;
        });

        group.groupStudents.forEach((s: any) => allClassStudentsSet.add(s.id || s['uid']));

        // Group staff tokens
        const groupStaffTokens = new Set([
          ...this.extractAllStrings(group['assignedStaffIds']),
          ...this.extractAllStrings(group['assignedStaff']),
          ...this.extractAllStrings(group['staffIds']),
          ...this.extractAllStrings(group['teacherIds']),
          ...this.extractAllStrings(group['groupStaff'])
        ]);

        group.groupStaff = allStaff.filter((st: any) => {
          const stTokens = this.extractAllStrings(st);
          if (Array.from(groupStaffTokens).some(tok => stTokens.includes(tok))) return true;

          const stGroupTokens = [
            ...this.extractAllStrings(st['groupId']),
            ...this.extractAllStrings(st['classGroupId']),
            ...this.extractAllStrings(st['assignedGroupId']),
            ...this.extractAllStrings(st['groupIds']),
            ...this.extractAllStrings(st['classGroupIds'])
          ];
          if (stGroupTokens.includes(group.id)) return true;

          const stClassTokens = [
            ...this.extractAllStrings(st['classId']),
            ...this.extractAllStrings(st['assignedClassId']),
            ...this.extractAllStrings(st['classIds']),
            ...this.extractAllStrings(st['assignedClassIds'])
          ];
          return stClassTokens.includes(targetClassId);
        });

        group.groupStaff.forEach((sf: any) => allClassStaffSet.add(sf.id || sf['uid']));
      });

      this.studentsCount = allClassStudentsSet.size || classStudents.length;
      this.staffCount = allClassStaffSet.size;

    } catch (e) {
      console.error('[Class Counts Error]', e);
    } finally {
      this.loadingCounts = false;
    }
  }

  formatList(value: any): string {
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : '-';
    }
    if (typeof value === 'string') {
      return value.trim() || '-';
    }
    return '-';
  }

  getDate(value: any): Date | null {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
  
  manageGroups() {
    this.dialogRef.close();
    this.router.navigate(['/classGroups'], { queryParams: { classId: this.classRecord.id } });
  }
}
