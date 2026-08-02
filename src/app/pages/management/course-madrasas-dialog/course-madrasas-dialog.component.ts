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

      const targetName = (this.data.courseName || '').trim().toLowerCase();
      const targetCode = (this.data.courseCode || '').trim().toLowerCase();
      const targetId = (this.data.courseId || '').trim().toLowerCase();

      // Find all madrasa course instances for this course
      const matchingMadrasaCourses = allCourses.filter(c => {
        if (!c['madrasaId']) return false;
        const cName = String(c['name'] || '').trim().toLowerCase();
        const cCode = String(c['code'] || '').trim().toLowerCase();
        const cBaseId = String(c['baseCourseId'] || c['masterCourseId'] || c.id).trim().toLowerCase();

        return (targetId && cBaseId === targetId) ||
               (targetCode && cCode === targetCode) ||
               (targetName && cName === targetName);
      });

      const detailsList: MadrasaCourseDetail[] = [];
      const madrasaIdSet = new Set<string>();

      matchingMadrasaCourses.forEach(c => {
        if (c['madrasaId']) madrasaIdSet.add(String(c['madrasaId']));
      });

      if (Array.isArray(this.data.madrasaIds) && this.data.madrasaIds.length > 0) {
        this.data.madrasaIds.forEach(id => {
          if (id) madrasaIdSet.add(String(id));
        });
      }

      // Fallback matching by passed names
      const namesList = this.data.madrasaNames || [];
      if (madrasaIdSet.size === 0 && namesList.length > 0) {
        namesList.forEach(mName => {
          const mDoc = allMadrasas.find(m => String(m['name'] || m['title'] || '').toLowerCase() === mName.toLowerCase());
          if (mDoc) madrasaIdSet.add(String(mDoc.id));
        });
      }

      for (const mId of Array.from(madrasaIdSet)) {
        const mDoc = allMadrasas.find(m => String(m.id) === mId);
        const mName = mDoc ? String(mDoc['name'] || mDoc['title'] || mId) : mId;
        const mCode = mDoc ? String(mDoc['code'] || '') : '';

        const courseDoc = matchingMadrasaCourses.find(c => String(c['madrasaId']) === mId);
        const rawAdded = courseDoc ? (courseDoc['createdAt'] || courseDoc['updatedAt']) : null;
        const addedAt = rawAdded ? (typeof (rawAdded as any)?.toDate === 'function' ? (rawAdded as any).toDate() : rawAdded) : null;

        const mClasses = allClasses.filter(cls => {
          if (String(cls['madrasaId']) !== mId) return false;
          if (courseDoc && String(cls['courseId']) === String(courseDoc.id)) return true;
          const clsCourseName = String(cls['courseName'] || cls['course'] || '').trim().toLowerCase();
          return clsCourseName === targetName;
        });

        const classDetails: MadrasaClassDetail[] = [];

        for (const cls of mClasses) {
          const clsId = String(cls.id);
          const clsName = String(cls['name'] || cls['title'] || 'Class');

          const grps = allGroups.filter(g => String(g['classId']) === clsId || (String(g['madrasaId']) === mId && String(g['className']) === clsName));

          const groupDetails: MadrasaGroupDetail[] = [];

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
              return String(st['groupId'] || st['classGroupId'] || st['group']) === grpId ||
                     (String(st['madrasaId']) === mId && String(st['classId']) === clsId);
            });

            const grpStudentMap = new Map<string, EntityRecord>();
            rawGrpStudents.forEach(st => {
              const key = String(st['uid'] || st['userId'] || st['email'] || st.id || '').toLowerCase().trim();
              if (key && key !== 'undefined') {
                grpStudentMap.set(key, { ...(grpStudentMap.get(key) || {}), ...st });
              }
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

          classDetails.push({
            classId: clsId,
            className: clsName,
            groups: groupDetails
          });
        }

        detailsList.push({
          madrasaId: mId,
          madrasaName: mName,
          madrasaCode: mCode,
          addedAt,
          expanded: false,
          classes: classDetails
        });
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
