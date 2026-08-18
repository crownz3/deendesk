import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RepositoryService, EntityRecord } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface CourseMadrasasDialogData {
  courseId?: string;
  courseName: string;
  courseCode?: string;
  madrasaIds?: string[];
  madrasaNames?: string[];
  userId?: string;
  user?: EntityRecord;
}

export interface MadrasaGroupDetail {
  groupId: string;
  groupName: string;
  shift?: string;
  staffNames: string[];
  studentCount: number;
  students: EntityRecord[];
  studentsExpanded?: boolean;
}

export interface MadrasaClassDetail {
  classId: string;
  className: string;
  groups: MadrasaGroupDetail[];
}

export interface MadrasaCourseDetail {
  madrasaId: string;
  madrasaName: string;
  madrasaCode: string;
  addedAt?: any;
  expanded?: boolean;
  classes: MadrasaClassDetail[];
}

@Component({
  selector: 'app-course-madrasas-dialog',
  templateUrl: './course-madrasas-dialog.component.html',
  styleUrls: ['./course-madrasas-dialog.component.scss'],
  standalone: false,
})
export class CourseMadrasasDialogComponent implements OnInit {
  loading = true;
  searchQuery = '';
  madrasaDetails: MadrasaCourseDetail[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CourseMadrasasDialogData,
    private dialogRef: MatDialogRef<CourseMadrasasDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.loadDetails();
  }

  async loadDetails() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const allMadrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile);
      const allCourses = await this.repo.getAllOnce<EntityRecord>('courses', profile);
      const allClasses = await this.repo.getAllOnce<EntityRecord>('classes', profile);
      const allGroups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile);
      const allStudents = await this.repo.getAllOnce<EntityRecord>('students', profile);
      const allUsers = await this.repo.getAllOnce<EntityRecord>('users', profile);
      const allStaff = await this.repo.getAllOnce<EntityRecord>('staff', profile).catch(() => []);

      function extractId(val: any): string {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'object') return String(val.id || val.uid || val.docId || val._id || '').trim();
        return String(val).trim();
      }

      function extractAllStrings(val: any): string[] {
        if (!val) return [];
        if (typeof val === 'string') {
          if (val.includes(',')) return val.split(',').map(s => s.trim()).filter(Boolean);
          return [val.trim()];
        }
        if (Array.isArray(val)) return val.flatMap(item => extractAllStrings(item));
        return [];
      }

      const targetName = String(this.data.courseName || '').trim().toLowerCase();
      const targetCode = String(this.data.courseCode || '').trim().toLowerCase();
      const targetId = extractId(this.data.courseId);

      const targetUserIds = [
        extractId(this.data.userId),
        extractId(this.data.user?.id),
        extractId(this.data.user?.['uid']),
        extractId(this.data.user?.['userId']),
        extractId(this.data.user?.['docId']),
      ].filter(Boolean);

      const targetUserGroupIds = this.data.user ? [
        ...extractAllStrings(this.data.user['groupId']),
        ...extractAllStrings(this.data.user['classGroupId']),
        ...extractAllStrings(this.data.user['groupIds']),
        ...extractAllStrings(this.data.user['classGroupIds']),
        ...extractAllStrings(this.data.user['assignedClassGroup']),
      ].map(extractId).filter(Boolean) : [];

      const targetUserGroupNames = this.data.user ? [
        ...extractAllStrings(this.data.user['assignedClassGroup']),
        ...extractAllStrings(this.data.user['groupName']),
        ...extractAllStrings(this.data.user['group']),
        ...extractAllStrings(this.data.user['section']),
      ].map(s => s.toLowerCase()).filter(Boolean) : [];

      // Find all madrasa course instances for this course
      const matchingMadrasaCourses = allCourses.filter(c => {
        const cMadrasa = extractId(c['madrasaId']);
        if (!cMadrasa) return false;
        const cName = String(c['name'] || '').trim().toLowerCase();
        const cCode = String(c['code'] || '').trim().toLowerCase();
        const cBaseId = extractId(c['baseCourseId'] || c['masterCourseId'] || c.id).toLowerCase();

        return (targetId && cBaseId === targetId) ||
               (targetCode && cCode === targetCode) ||
               (targetName && cName === targetName);
      });

      const isCourseMode = matchingMadrasaCourses.length > 0 || allCourses.some(c => {
        const cId = extractId(c.id);
        const cName = String(c['name'] || '').trim().toLowerCase();
        return (targetId && cId === targetId) || (targetName && cName === targetName);
      });

      const isUserMode = targetUserIds.length > 0;

      function isGroupAssignedToTargetUser(grp: EntityRecord): boolean {
        if (!isUserMode) return true;

        const grpId = extractId(grp.id || grp['docId']);
        if (grpId && targetUserGroupIds.includes(grpId)) return true;

        const grpName = String(grp['name'] || grp['groupName'] || grp['title'] || '').trim().toLowerCase();
        if (grpName && targetUserGroupNames.includes(grpName)) return true;

        const staffTokens = [
          ...extractAllStrings(grp['assignedStaffIds']),
          ...extractAllStrings(grp['assignedStaff']),
          ...extractAllStrings(grp['staffIds']),
          ...extractAllStrings(grp['teacherIds']),
          ...extractAllStrings(grp['teachers']),
          ...extractAllStrings(grp['staff']),
          ...extractAllStrings(grp['groupStaff']),
        ].map(extractId);

        if (targetUserIds.some(id => staffTokens.includes(id))) return true;

        const studentTokens = [
          ...extractAllStrings(grp['assignedStudentIds']),
          ...extractAllStrings(grp['assignedStudents']),
          ...extractAllStrings(grp['studentIds']),
          ...extractAllStrings(grp['students']),
        ].map(extractId);

        if (targetUserIds.some(id => studentTokens.includes(id))) return true;

        const grpMId = extractId(grp['madrasaId']);
        if (grpMId) {
          const mDoc = allMadrasas.find(m => extractId(m.id) === grpMId);
          if (mDoc) {
            const mIncharges = [
              ...(Array.isArray(mDoc['inchargeIds']) ? mDoc['inchargeIds'] : []),
              ...(mDoc['inchargeId'] ? [mDoc['inchargeId']] : []),
              ...(mDoc['incharge'] ? [mDoc['incharge']] : []),
              ...(Array.isArray(mDoc['coordinatorIds']) ? mDoc['coordinatorIds'] : []),
              ...(mDoc['coordinatorId'] ? [mDoc['coordinatorId']] : []),
              ...(mDoc['coordinator'] ? [mDoc['coordinator']] : [])
            ].map(extractId);
            if (targetUserIds.some(id => mIncharges.includes(id))) return true;
          }
        }

        return false;
      }

      const detailsList: MadrasaCourseDetail[] = [];
      const madrasaIdSet = new Set<string>();

      matchingMadrasaCourses.forEach(c => {
        const mId = extractId(c['madrasaId']);
        if (mId) madrasaIdSet.add(mId);
        if (Array.isArray(c['madrasaIds'])) {
          c['madrasaIds'].forEach(m => {
            const id = extractId(m);
            if (id) madrasaIdSet.add(id);
          });
        }
      });

      if (Array.isArray(this.data.madrasaIds) && this.data.madrasaIds.length > 0) {
        this.data.madrasaIds.forEach(id => {
          const clean = extractId(id);
          if (clean) madrasaIdSet.add(clean);
        });
      }

      // Collect madrasa IDs from classes and groups linked to this course
      const courseClasses = allClasses.filter((c: any) => {
        const cId = extractId(c['courseId'] || c['course']);
        const cCode = String(c['courseCode'] || '').toLowerCase();
        const cName = String(c['courseName'] || c['course'] || '').toLowerCase();
        return (cId && cId === targetId) ||
               (targetCode && cCode === targetCode) ||
               (targetName && cName === targetName);
      });
      courseClasses.forEach((c: any) => {
        const mId = extractId(c['madrasaId']);
        if (mId) madrasaIdSet.add(mId);
      });

      const classIdSet = new Set(courseClasses.map((c: any) => extractId(c.id)));
      const courseGroups = allGroups.filter((g: any) => {
        const gCourse = extractId(g['courseId'] || g['course']);
        const gClass = extractId(g['classId'] || g['class']);
        return (targetId && gCourse === targetId) || (gClass && classIdSet.has(gClass));
      });
      courseGroups.forEach((g: any) => {
        const mId = extractId(g['madrasaId']);
        if (mId) madrasaIdSet.add(mId);
      });

      // Fallback matching by passed names
      const namesList = this.data.madrasaNames || [];
      if (madrasaIdSet.size === 0 && namesList.length > 0) {
        namesList.forEach(mName => {
          const mDoc = allMadrasas.find(m => String(m['name'] || m['title'] || '').toLowerCase() === mName.toLowerCase());
          if (mDoc) madrasaIdSet.add(extractId(mDoc.id));
        });
      }

      for (const mId of Array.from(madrasaIdSet)) {
        const mDoc = allMadrasas.find(m => extractId(m.id) === mId || extractId(m['code']).toLowerCase() === mId.toLowerCase());
        const mName = mDoc ? String(mDoc['name'] || mDoc['title'] || mId) : mId;
        const mCode = mDoc ? String(mDoc['code'] || '') : '';
        const realMadrasaId = mDoc ? extractId(mDoc.id) : mId;

        const courseDoc = matchingMadrasaCourses.find(c => extractId(c['madrasaId']) === realMadrasaId || extractId(c['madrasaId']) === mId);
        const rawAdded = courseDoc ? (courseDoc['createdAt'] || courseDoc['updatedAt']) : null;
        const addedAt = rawAdded ? (typeof (rawAdded as any)?.toDate === 'function' ? (rawAdded as any).toDate() : rawAdded) : null;

        let mClasses = allClasses.filter(cls => {
          const clsMadrasa = extractId(cls['madrasaId']);
          if (clsMadrasa && clsMadrasa !== realMadrasaId && clsMadrasa !== mId) return false;

          if (isCourseMode) {
            const clsCourseId = extractId(cls['courseId'] || cls['course']);
            const clsCourseCode = String(cls['courseCode'] || '').toLowerCase();
            const clsCourseName = String(cls['courseName'] || cls['course'] || cls['name'] || cls['title'] || '').trim().toLowerCase();

            return (targetId && clsCourseId === targetId) ||
                   (targetCode && clsCourseCode === targetCode) ||
                   (targetName && clsCourseName === targetName) ||
                   (targetName && clsCourseName.includes(targetName)) ||
                   (courseDoc && clsCourseId === extractId(courseDoc.id));
          }

          return true;
        });

        if (mClasses.length === 0) {
          const madrasaGroups = allGroups.filter(g => {
            const gMadrasa = extractId(g['madrasaId']);
            const matchesMadrasa = gMadrasa === realMadrasaId || gMadrasa === mId || !gMadrasa;
            if (!matchesMadrasa) return false;
            return isGroupAssignedToTargetUser(g);
          });

          if (madrasaGroups.length > 0) {
            const grpByClassMap = new Map<string, { id: string; name: string }>();
            madrasaGroups.forEach(grp => {
              const cId = extractId(grp['classId'] || grp['class']) || 'default_class';
              const cName = String(grp['className'] || grp['class'] || grp['courseName'] || 'General Class');
              if (!grpByClassMap.has(cId)) {
                grpByClassMap.set(cId, { id: cId, name: cName });
              }
            });

            mClasses = Array.from(grpByClassMap.values()).map(c => ({
              id: c.id,
              name: c.name,
              title: c.name,
              madrasaId: realMadrasaId
            }));
          }
        }

        const classDetails: MadrasaClassDetail[] = [];

        for (const cls of mClasses) {
          const clsId = String(cls.id);
          const clsName = String(cls['name'] || cls['title'] || 'Class');

          const grps = allGroups.filter(g => {
            const gClass = extractId(g['classId'] || g['class']);
            const gMadrasa = extractId(g['madrasaId']);
            const gClassName = String(g['className'] || g['class'] || '');
            const matchesClass = gClass === clsId || (gMadrasa === realMadrasaId && gClassName.toLowerCase() === clsName.toLowerCase()) || (clsId === 'default_class' && (gMadrasa === realMadrasaId || gMadrasa === mId));

            if (!matchesClass) return false;

            return isGroupAssignedToTargetUser(g);
          });

          const groupDetails: MadrasaGroupDetail[] = [];

          if (grps.length === 0 && !isUserMode) {
            const rawClsStudents = allStudents.filter(st => {
              if (String(st['status'] || 'active').toLowerCase() === 'inactive') return false;
              return String(st['classId'] || st['class']) === clsId;
            });
            const clsStudentMap = new Map<string, EntityRecord>();
            rawClsStudents.forEach(st => {
              const k = String(st['uid'] || st['userId'] || st.id || '').toLowerCase();
              if (k) clsStudentMap.set(k, st);
            });
            const clsStudents = Array.from(clsStudentMap.values());

            groupDetails.push({
              groupId: clsId,
              groupName: 'General Section',
              staffNames: [],
              studentCount: clsStudents.length,
              students: clsStudents,
              studentsExpanded: false
            });
          } else {
            for (const grp of grps) {
              const grpId = String(grp.id);
              const grpName = String(grp['name'] || grp['groupName'] || grp['title'] || 'Section');
              const shift = grp['shift'] ? String(grp['shift']) : undefined;

              const assignedIds: string[] = Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'].map(String) : [];
              const staffNames = assignedIds.map(id => {
                const cleanId = String(id || '').trim();
                if (!cleanId) return null;

                const u = allUsers.find(usr =>
                  String(usr['uid'] || usr.id || '').toLowerCase() === cleanId.toLowerCase() ||
                  String(usr['email'] || '').toLowerCase() === cleanId.toLowerCase()
                );
                if (u) return String(u['displayName'] || u['name'] || u['email'] || cleanId);

                const s = allStaff.find(st =>
                  String(st.id || st['userId'] || st['uid'] || '').toLowerCase() === cleanId.toLowerCase() ||
                  String(st['email'] || '').toLowerCase() === cleanId.toLowerCase()
                );
                if (s) return String(s['name'] || s['displayName'] || s['email'] || cleanId);

                return cleanId.length > 20 ? 'Staff Member' : cleanId;
              }).filter((name): name is string => !!name);

              const rawGrpStudents = allStudents.filter(st => {
                if (String(st['status'] || 'active').toLowerCase() === 'inactive') return false;
                const stGroup = String(st['groupId'] || st['classGroupId'] || st['group'] || '').trim();
                const stClass = String(st['classId'] || st['class'] || '').trim();
                if (stGroup) return stGroup === grpId;
                return (stClass && stClass === clsId && grpId === 'default_class');
              });

              const grpStudentMap = new Map<string, EntityRecord>();
              rawGrpStudents.forEach(st => {
                const k = String(st['uid'] || st['userId'] || st.id || '').toLowerCase();
                if (k) grpStudentMap.set(k, st);
              });
              const grpStudents = Array.from(grpStudentMap.values());

              groupDetails.push({
                groupId: grpId,
                groupName: grpName,
                shift,
                staffNames,
                studentCount: grpStudents.length,
                students: grpStudents,
                studentsExpanded: false
              });
            }
          }

          if (groupDetails.length > 0) {
            classDetails.push({
              classId: clsId,
              className: clsName,
              groups: groupDetails
            });
          }
        }

        if (!isUserMode || classDetails.length > 0) {
          detailsList.push({
            madrasaId: mId,
            madrasaName: mName,
            madrasaCode: mCode,
            addedAt,
            expanded: true,
            classes: classDetails
          });
        }
      }

      this.madrasaDetails = detailsList;
    } catch (e) {
      console.error('Error loading madrasa course details:', e);
    } finally {
      this.loading = false;
    }
  }

  get filteredMadrasas(): MadrasaCourseDetail[] {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) return this.madrasaDetails;
    return this.madrasaDetails.filter(m =>
      m.madrasaName.toLowerCase().includes(q) ||
      m.madrasaCode.toLowerCase().includes(q)
    );
  }
}
