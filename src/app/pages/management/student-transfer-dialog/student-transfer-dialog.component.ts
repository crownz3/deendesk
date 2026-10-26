import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getDeenDeskFirestore } from '../../../core/services/firebase-app';
import { doc, getDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';

export interface StudentTransferData {
  student?: EntityRecord;
  students?: EntityRecord[];
}

@Component({
  selector: 'app-student-transfer-dialog',
  templateUrl: './student-transfer-dialog.component.html',
  styleUrls: ['./student-transfer-dialog.component.scss'],
  standalone: false,
})
export class StudentTransferDialogComponent implements OnInit {
  loading = true;
  saving = false;

  targetStudents: EntityRecord[] = [];
  firstStudent: EntityRecord | null = null;

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  groups: EntityRecord[] = [];
  allStaff: EntityRecord[] = [];

  // Filtered lists for autocomplete
  filteredMadrasas: EntityRecord[] = [];
  filteredCourses: EntityRecord[] = [];
  filteredClasses: EntityRecord[] = [];
  filteredGroups: EntityRecord[] = [];

  // Search input texts
  madrasaSearchText = '';
  courseSearchText = '';
  classSearchText = '';
  groupSearchText = '';

  newMadrasaId = '';
  newCourseId = '';
  newClassId = '';
  newGroupId = '';
  reason = '';
  actionDate = new Date().toISOString().substring(0, 10);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentTransferData,
    private dialogRef: MatDialogRef<StudentTransferDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.targetStudents = data.students?.length ? data.students : (data.student ? [data.student] : []);
    this.firstStudent = this.targetStudents[0] || null;

    if (this.firstStudent) {
      this.newMadrasaId = String(this.firstStudent['madrasaId'] || '');
      this.newCourseId = String(this.firstStudent['courseId'] || '');
      this.newClassId = String(this.firstStudent['classId'] || '');
      this.newGroupId = String(this.firstStudent['groupId'] || '');
    }
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const [madrasas, courses, classes, groups, staff, users] = await Promise.all([
        this.repo.getAllOnce('madrasas', profile),
        this.repo.getAllOnce('courses', profile),
        this.repo.getAllOnce('classes', profile),
        this.repo.getAllOnce('classGroups', profile),
        this.repo.getAllOnce('staff', profile).catch(() => []),
        this.repo.getAllOnce('users', profile, { roles: ['teacher', 'staff', 'madrasaIncharge'] }).catch(() => [])
      ]);
      this.madrasas = madrasas.filter((m: any) => m['status'] === 'active');
      this.courses = courses.filter((c: any) => c['status'] === 'active');
      this.classes = classes.filter((c: any) => c['status'] === 'active');
      this.groups = groups.filter((g: any) => g['status'] === 'active');
      this.allStaff = [...(staff || []), ...(users || [])];

      this.syncSearchTexts();
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to load data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  private extractId(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') return String(val.id || val.uid || val.docId || val.userId || '').trim();
    return String(val).trim();
  }

  syncSearchTexts(): void {
    const targetMId = this.extractId(this.newMadrasaId);
    const m = this.madrasas.find(x => this.extractId(x.id) === targetMId);
    if (m) {
      this.madrasaSearchText = m['name'] || m['title'] || '';
    } else {
      this.newMadrasaId = '';
      this.madrasaSearchText = '';
    }

    const targetCId = this.extractId(this.newCourseId);
    const c = this.availableCourses.find(x => this.extractId(x.id) === targetCId);
    if (c) {
      this.courseSearchText = c['name'] || c['title'] || '';
    } else {
      this.newCourseId = '';
      this.courseSearchText = '';
    }

    const targetClId = this.extractId(this.newClassId);
    const cl = this.availableClasses.find(x => this.extractId(x.id) === targetClId);
    if (cl) {
      this.classSearchText = cl['name'] || cl['title'] || '';
    } else {
      this.newClassId = '';
      this.classSearchText = '';
    }

    const targetGId = this.extractId(this.newGroupId);
    const g = this.availableGroups.find(x => this.extractId(x.id) === targetGId);
    if (g) {
      this.groupSearchText = g['name'] || g['title'] || '';
    } else {
      this.newGroupId = '';
      this.groupSearchText = '';
    }

    this.filterMadrasas();
    this.filterCourses();
    this.filterClasses();
    this.filterGroups();
  }

  classBelongsToMadrasa(cls: EntityRecord, targetMId: string): boolean {
    if (!targetMId || !cls) return false;
    const clsMId = this.extractId(cls['madrasaId'] || cls['parentMadrasaId'] || cls['madrasa']);
    if (clsMId && clsMId === targetMId) return true;
    const clsMIds = Array.isArray(cls['madrasaIds'])
      ? cls['madrasaIds'].map((x: any) => this.extractId(x)).filter(Boolean)
      : [];
    return clsMIds.includes(targetMId);
  }

  groupBelongsToMadrasa(grp: EntityRecord, targetMId: string): boolean {
    if (!targetMId || !grp) return false;
    const grpMId = this.extractId(grp['madrasaId'] || grp['parentMadrasaId'] || grp['madrasa']);
    if (grpMId && grpMId === targetMId) return true;
    const grpMIds = Array.isArray(grp['madrasaIds'])
      ? grp['madrasaIds'].map((x: any) => this.extractId(x)).filter(Boolean)
      : [];
    if (grpMIds.includes(targetMId)) return true;

    // Fall back to parent class's madrasa
    const parentClassId = this.extractId(grp['classId'] || grp['class']);
    if (parentClassId) {
      const parentClass = this.classes.find(c => this.extractId(c.id) === parentClassId);
      if (parentClass) {
        return this.classBelongsToMadrasa(parentClass, targetMId);
      }
    }
    return false;
  }

  classBelongsToCourse(cls: EntityRecord, targetCId: string): boolean {
    if (!targetCId || !cls) return false;
    const clsCId = this.extractId(cls['courseId'] || cls['course']);
    if (clsCId && clsCId === targetCId) return true;

    if (Array.isArray(cls['courseIds'])) {
      const ids = cls['courseIds'].map((x: any) => this.extractId(x)).filter(Boolean);
      if (ids.includes(targetCId)) return true;
    }

    const courseObj = this.courses.find(c => this.extractId(c.id) === targetCId);
    if (courseObj) {
      const cName = String(courseObj['name'] || courseObj['title'] || '').trim().toLowerCase();
      const cCode = String(courseObj['code'] || '').trim().toLowerCase();
      const clsCourseName = String(cls['courseName'] || '').trim().toLowerCase();
      const clsCourseCode = String(cls['courseCode'] || '').trim().toLowerCase();

      if (clsCourseName && (clsCourseName === cName || clsCourseName === cCode)) return true;
      if (cCode && clsCourseCode && clsCourseCode === cCode) return true;

      const rawCourse = typeof cls['course'] === 'string' ? cls['course'].trim().toLowerCase() : '';
      if (rawCourse && (rawCourse === cName || rawCourse === cCode)) return true;

      // Fallback keyword heuristics only when class has no explicit courseId
      if (!clsCId) {
        const clsName = String(cls['name'] || cls['title'] || '').trim().toLowerCase();
        const isHifzCourse = cName.includes('hifz') || cName.includes('hiflu') || cName.includes('tahfeez');
        const isMaktabCourse = cName.includes('maktab') || cName.includes('makthab');

        if (isHifzCourse && (clsName.includes('hifz') || clsName.includes('hiflu') || clsName.includes('tahfeez'))) {
          return true;
        }
        if (isMaktabCourse && (clsName.includes('maktab') || clsName.includes('makthab'))) {
          return true;
        }
      }
    }

    return false;
  }

  groupBelongsToCourse(grp: EntityRecord, targetCId: string): boolean {
    if (!targetCId || !grp) return false;
    const grpCId = this.extractId(grp['courseId'] || grp['course']);
    if (grpCId && grpCId === targetCId) return true;

    // Check parent class
    const parentClassId = this.extractId(grp['classId'] || grp['class']);
    if (parentClassId) {
      const parentClass = this.classes.find(c => this.extractId(c.id) === parentClassId);
      if (parentClass && this.classBelongsToCourse(parentClass, targetCId)) {
        return true;
      }
    }

    const courseObj = this.courses.find(c => this.extractId(c.id) === targetCId);
    if (courseObj) {
      const cName = String(courseObj['name'] || courseObj['title'] || '').trim().toLowerCase();
      const grpCourseName = String(grp['courseName'] || grp['course'] || '').trim().toLowerCase();
      if (grpCourseName && grpCourseName === cName) return true;
    }

    return false;
  }

  get availableCourses(): EntityRecord[] {
    const targetMId = this.extractId(this.newMadrasaId);
    if (!targetMId) return [];

    // 1. Identify which classes actually belong to this madrasa
    const madrasaClasses = this.classes.filter(cls => this.classBelongsToMadrasa(cls, targetMId));

    // 2. Identify which groups actually belong to this madrasa
    const madrasaGroups = this.groups.filter(grp => this.groupBelongsToMadrasa(grp, targetMId));

    // If this madrasa has classes or groups configured, ONLY show courses that have active classes/groups in this madrasa!
    if (madrasaClasses.length > 0 || madrasaGroups.length > 0) {
      return this.courses.filter(course => {
        const cId = this.extractId(course.id);
        const hasMatchingClass = madrasaClasses.some(cls => this.classBelongsToCourse(cls, cId));
        if (hasMatchingClass) return true;
        const hasMatchingGroup = madrasaGroups.some(grp => this.groupBelongsToCourse(grp, cId));
        if (hasMatchingGroup) return true;
        return false;
      });
    }

    // Fallback: If this madrasa has zero classes and zero groups configured yet, check direct madrasa linkage on the course
    return this.courses.filter(c => {
      const directMId = this.extractId(c['madrasaId'] || c['parentMadrasaId']);
      if (directMId && directMId === targetMId) return true;

      const cMIds = Array.isArray(c['madrasaIds'])
        ? c['madrasaIds'].map((x: any) => this.extractId(x)).filter(Boolean)
        : [];
      return cMIds.includes(targetMId);
    });
  }

  get availableClasses(): EntityRecord[] {
    const targetMId = this.extractId(this.newMadrasaId);
    const targetCId = this.extractId(this.newCourseId);
    if (!targetMId) return [];

    return this.classes.filter(cls => {
      // 1. Madrasa Match: Must strictly belong to the selected madrasa
      if (!this.classBelongsToMadrasa(cls, targetMId)) return false;

      // 2. Course Match: Must belong to selected course if selected
      if (targetCId) {
        if (!this.classBelongsToCourse(cls, targetCId)) return false;
      }

      return true;
    });
  }

  get availableGroups(): EntityRecord[] {
    const targetMId = this.extractId(this.newMadrasaId);
    const targetClassId = this.extractId(this.newClassId);
    const targetCId = this.extractId(this.newCourseId);
    if (!targetMId) return [];

    return this.groups.filter(grp => {
      // 1. Class Match: Group must belong to selected class if selected
      if (targetClassId) {
        const grpClassId = this.extractId(grp['classId'] || grp['class']);
        if (grpClassId !== targetClassId) return false;
      }

      // 2. Madrasa Match: Group must strictly belong to the selected madrasa
      if (!this.groupBelongsToMadrasa(grp, targetMId)) return false;

      // 3. Course Match: If course is selected and group has courseId, it must match
      if (targetCId) {
        if (!this.groupBelongsToCourse(grp, targetCId)) return false;
      }

      return true;
    });
  }

  filterMadrasas(): void {
    const selected = this.madrasas.find(m => m.id === this.newMadrasaId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.madrasaSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredMadrasas = [...this.madrasas];
    } else {
      this.filteredMadrasas = this.madrasas.filter(m => {
        const name = (m['name'] || m['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  filterCourses(): void {
    const list = this.availableCourses;
    const selected = list.find(c => c.id === this.newCourseId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.courseSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredCourses = [...list];
    } else {
      this.filteredCourses = list.filter(c => {
        const name = (c['name'] || c['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  filterClasses(): void {
    const list = this.availableClasses;
    const selected = list.find(c => c.id === this.newClassId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.classSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredClasses = [...list];
    } else {
      this.filteredClasses = list.filter(c => {
        const name = (c['name'] || c['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  filterGroups(): void {
    const list = this.availableGroups;
    const selected = list.find(g => g.id === this.newGroupId);
    const selectedName = selected ? (selected['name'] || selected['title'] || '').toLowerCase().trim() : '';
    const q = (this.groupSearchText || '').toLowerCase().trim();

    if (!q || q === selectedName) {
      this.filteredGroups = [...list];
    } else {
      this.filteredGroups = list.filter(g => {
        const name = (g['name'] || g['title'] || '').toLowerCase();
        return name.includes(q);
      });
    }
  }

  onMadrasaOptionSelected(m: EntityRecord): void {
    if (!m) return;
    this.newMadrasaId = m.id || '';
    this.madrasaSearchText = m['name'] || m['title'] || '';
    this.onMadrasaChange();
  }

  onCourseOptionSelected(c: EntityRecord): void {
    if (!c) return;
    this.newCourseId = c.id || '';
    this.courseSearchText = c['name'] || c['title'] || '';
    this.onCourseChange();
  }

  onClassOptionSelected(c: EntityRecord): void {
    if (!c) return;
    this.newClassId = c.id || '';
    this.classSearchText = c['name'] || c['title'] || '';
    this.onClassChange();
  }

  onGroupOptionSelected(g: EntityRecord): void {
    if (!g) return;
    this.newGroupId = g.id || '';
    this.groupSearchText = g['name'] || g['title'] || '';
  }

  onMadrasaBlur(): void {
    setTimeout(() => {
      const trimmed = (this.madrasaSearchText || '').trim().toLowerCase();
      const exactMatch = this.madrasas.find(m => (m['name'] || m['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newMadrasaId !== exactMatch.id) {
          this.onMadrasaOptionSelected(exactMatch);
        }
      } else {
        const current = this.madrasas.find(m => m.id === this.newMadrasaId);
        this.madrasaSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  onCourseBlur(): void {
    setTimeout(() => {
      const trimmed = (this.courseSearchText || '').trim().toLowerCase();
      const exactMatch = this.availableCourses.find(c => (c['name'] || c['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newCourseId !== exactMatch.id) {
          this.onCourseOptionSelected(exactMatch);
        }
      } else {
        const current = this.availableCourses.find(c => c.id === this.newCourseId);
        this.courseSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  onClassBlur(): void {
    setTimeout(() => {
      const trimmed = (this.classSearchText || '').trim().toLowerCase();
      const exactMatch = this.availableClasses.find(c => (c['name'] || c['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newClassId !== exactMatch.id) {
          this.onClassOptionSelected(exactMatch);
        }
      } else {
        const current = this.availableClasses.find(c => c.id === this.newClassId);
        this.classSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  onGroupBlur(): void {
    setTimeout(() => {
      const trimmed = (this.groupSearchText || '').trim().toLowerCase();
      const exactMatch = this.availableGroups.find(g => (g['name'] || g['title'] || '').trim().toLowerCase() === trimmed);
      if (exactMatch) {
        if (this.newGroupId !== exactMatch.id) {
          this.onGroupOptionSelected(exactMatch);
        }
      } else {
        const current = this.availableGroups.find(g => g.id === this.newGroupId);
        this.groupSearchText = current ? (current['name'] || current['title'] || '') : '';
      }
    }, 200);
  }

  clearMadrasa(): void {
    this.newMadrasaId = '';
    this.madrasaSearchText = '';
    this.onMadrasaChange();
    this.filterMadrasas();
  }

  clearCourse(): void {
    this.newCourseId = '';
    this.courseSearchText = '';
    this.onCourseChange();
    this.filterCourses();
  }

  clearClass(): void {
    this.newClassId = '';
    this.classSearchText = '';
    this.onClassChange();
    this.filterClasses();
  }

  clearGroup(): void {
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterGroups();
  }

  displayEntityName = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item['name'] || item['title'] || '';
  };

  onMadrasaChange() {
    this.newCourseId = '';
    this.courseSearchText = '';
    this.newClassId = '';
    this.classSearchText = '';
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterCourses();
    this.filterClasses();
    this.filterGroups();

    if (this.availableCourses.length === 1) {
      const singleCourse = this.availableCourses[0];
      this.newCourseId = singleCourse.id || '';
      this.courseSearchText = singleCourse['name'] || singleCourse['title'] || '';
      this.filterClasses();
      if (this.availableClasses.length === 1) {
        const singleClass = this.availableClasses[0];
        this.newClassId = singleClass.id || '';
        this.classSearchText = singleClass['name'] || singleClass['title'] || '';
        this.filterGroups();
        if (this.availableGroups.length === 1) {
          const singleGroup = this.availableGroups[0];
          this.newGroupId = singleGroup.id || '';
          this.groupSearchText = singleGroup['name'] || singleGroup['title'] || '';
        }
      }
    }
  }

  onCourseChange() {
    this.newClassId = '';
    this.classSearchText = '';
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterClasses();
    this.filterGroups();

    if (this.availableClasses.length === 1) {
      const singleClass = this.availableClasses[0];
      this.newClassId = singleClass.id || '';
      this.classSearchText = singleClass['name'] || singleClass['title'] || '';
      this.filterGroups();
      if (this.availableGroups.length === 1) {
        const singleGroup = this.availableGroups[0];
        this.newGroupId = singleGroup.id || '';
        this.groupSearchText = singleGroup['name'] || singleGroup['title'] || '';
      }
    }
  }

  onClassChange() {
    this.newGroupId = '';
    this.groupSearchText = '';
    this.filterGroups();

    if (this.availableGroups.length === 1) {
      const singleGroup = this.availableGroups[0];
      this.newGroupId = singleGroup.id || '';
      this.groupSearchText = singleGroup['name'] || singleGroup['title'] || '';
    }
  }

  close() {
    this.dialogRef.close();
  }

  async submit() {
    if (!this.reason) {
      this.snackBar.open('Please provide a reason for transfer', 'Close', { duration: 3000 });
      return;
    }

    if (!this.newMadrasaId || !this.newCourseId || !this.newClassId || !this.newGroupId) {
      this.snackBar.open('Please select all new academic assignments', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const targetMadrasaName = this.madrasas.find(m => m.id === this.newMadrasaId)?.['name'] || '';
      const targetCourseName = this.courses.find(c => c.id === this.newCourseId)?.['name'] || this.courses.find(c => c.id === this.newCourseId)?.['title'] || '';
      const targetClassName = this.classes.find(c => c.id === this.newClassId)?.['name'] || this.classes.find(c => c.id === this.newClassId)?.['title'] || '';
      const targetGroupName = this.groups.find(g => g.id === this.newGroupId)?.['name'] || this.groups.find(g => g.id === this.newGroupId)?.['title'] || '';

      const studentUpdates = {
        madrasaId: this.newMadrasaId,
        madrasaName: targetMadrasaName,
        madrasaIds: [this.newMadrasaId],
        assignedMadrasaId: this.newMadrasaId,
        assignedMadrasaIds: [this.newMadrasaId],
        primaryMadrasaId: this.newMadrasaId,
        courseId: this.newCourseId,
        courseName: targetCourseName,
        courseIds: [this.newCourseId],
        classId: this.newClassId,
        className: targetClassName,
        classIds: [this.newClassId],
        assignedClassId: this.newClassId,
        assignedClassIds: [this.newClassId],
        groupId: this.newGroupId,
        groupName: targetGroupName,
        classGroupId: this.newGroupId,
        assignedGroupId: this.newGroupId,
        groupIds: [this.newGroupId],
        classGroupIds: [this.newGroupId],
        assignedGroupIds: [this.newGroupId],
        assignedClassGroup: targetGroupName,
        assignedClassGroups: [this.newGroupId],
        sectionId: this.newGroupId,
        section: this.newGroupId,
        sectionName: targetGroupName,
        movementStatus: 'Transferred',
        movementType: 'TRANSFER',
        movementTag: 'Transferred',
        status: 'active',
        academicStatus: 'active',
        lastTransferDate: this.actionDate,
        updatedAt: new Date().toISOString(),
      };

      const transferredStudentIds = new Set<string>();
      const previousGroupIds = new Set<string>();
      const firestore = getDeenDeskFirestore();

      for (const std of this.targetStudents) {
        const studentId = String(std.id || std['uid'] || std['docId']);
        const sName = String(std['name'] || std['studentName'] || std['displayName'] || 'Student');

        const prevMId = String(std['madrasaId'] || '');
        const prevCId = String(std['courseId'] || '');
        const prevClId = String(std['classId'] || '');
        const prevGId = String(std['groupId'] || std['classGroupId'] || std['assignedGroupId'] || '');

        const prevGroupTokens = [
          prevGId,
          ...(Array.isArray(std['groupIds']) ? std['groupIds'] : []),
          ...(Array.isArray(std['classGroupIds']) ? std['classGroupIds'] : []),
          ...(Array.isArray(std['assignedGroupIds']) ? std['assignedGroupIds'] : []),
          ...(Array.isArray(std['assignedClassGroups']) ? std['assignedClassGroups'] : [])
        ].map(v => String(v || '').trim()).filter(Boolean);

        prevGroupTokens.forEach(gId => {
          if (gId && gId !== this.newGroupId) {
            previousGroupIds.add(gId);
          }
        });

        const candidateIds = [std.id, std['uid'], std['docId'], std['userId'], std['entityId']]
          .map(v => String(v || '').trim())
          .filter(Boolean);

        // Find linked user document ID in users collection if not explicitly on std
        let linkedUserUid = String(std['userId'] || std['uid'] || '').trim();
        if (!linkedUserUid) {
          try {
            if (std.id) {
              const qEntity = query(collection(firestore, 'users'), where('entityId', '==', std.id), limit(1));
              const snapEntity = await getDocs(qEntity);
              if (!snapEntity.empty) {
                linkedUserUid = snapEntity.docs[0].id;
              }
            }
            if (!linkedUserUid && std['email']) {
              const qEmail = query(collection(firestore, 'users'), where('email', '==', std['email']), limit(1));
              const snapEmail = await getDocs(qEmail);
              if (!snapEmail.empty) {
                linkedUserUid = snapEmail.docs[0].id;
              }
            }
          } catch (lookupErr) {
            console.warn('Could not query linked user for student transfer:', lookupErr);
          }
        }
        if (linkedUserUid && !candidateIds.includes(linkedUserUid)) {
          candidateIds.push(linkedUserUid);
        }
        candidateIds.forEach(id => transferredStudentIds.add(id.toLowerCase()));

        const prevMadrasaName = this.getMadrasaName(prevMId) || '';
        const prevClassName = this.getClassName(prevClId) || '';
        const prevGroupName = this.getGroupName(prevGId) || '';
        const fromText = `${prevMadrasaName ? prevMadrasaName + ' • ' : ''}${prevClassName || 'Class'}${prevGroupName ? ' (' + prevGroupName + ')' : ''}`;
        const toText = `${targetMadrasaName ? targetMadrasaName + ' • ' : ''}${targetClassName || 'Class'}${targetGroupName ? ' (' + targetGroupName + ')' : ''}`;

        const transferHistory = {
          studentId: studentId,
          studentName: sName,
          previousMadrasaId: prevMId || undefined,
          previousMadrasaName: prevMadrasaName || undefined,
          previousCourseId: prevCId || undefined,
          previousCourseName: this.getCourseName(prevCId) || undefined,
          previousClassId: prevClId || undefined,
          previousClassName: prevClassName || undefined,
          previousGroupId: prevGId || undefined,
          previousGroupName: prevGroupName || undefined,
          newMadrasaId: this.newMadrasaId,
          newMadrasaName: targetMadrasaName,
          newCourseId: this.newCourseId,
          newCourseName: targetCourseName,
          newClassId: this.newClassId,
          newClassName: targetClassName,
          newGroupId: this.newGroupId,
          newGroupName: targetGroupName,
          fromStage: fromText,
          toStage: toText,
          reason: `Transferred from ${fromText} to ${toText}. Reason: ${this.reason}`,
          actionDate: this.actionDate,
          actionType: 'Transfer',
          movementType: 'TRANSFER',
          movementStatus: 'Transferred',
          organizationId: std['organizationId'] || profile?.organizationId || undefined,
          madrasaId: this.newMadrasaId,
          createdAt: new Date().toISOString(),
          createdBy: profile?.displayName || profile?.email || 'System'
        };

        await this.repo.create('studentTransfers', transferHistory, profile);

        await this.repo.create('userLifecycleHistory', {
          userId: studentId,
          userName: sName,
          personType: 'student',
          lifecycleAction: 'Transferred',
          actionType: 'Transfer',
          reason: `Transferred from ${fromText} to ${toText}. Reason: ${this.reason}`,
          fromStage: fromText,
          toStage: toText,
          previousMadrasaId: prevMId,
          previousMadrasaName: prevMadrasaName || undefined,
          newMadrasaId: this.newMadrasaId,
          newMadrasaName: targetMadrasaName || undefined,
          previousCourseId: prevCId,
          newCourseId: this.newCourseId,
          previousClassId: prevClId,
          previousClassName: prevClassName || undefined,
          newClassId: this.newClassId,
          newClassName: targetClassName || undefined,
          previousGroupId: prevGId,
          previousGroupName: prevGroupName || undefined,
          newGroupId: this.newGroupId,
          newGroupName: targetGroupName || undefined,
          effectiveDate: new Date().toISOString(),
          effectiveDateMs: Date.now(),
          performedBy: profile?.displayName || profile?.email || 'System',
          actionPerformedByName: profile?.displayName || profile?.email || 'System',
          organizationId: profile?.organizationId || std['organizationId'] || '',
          madrasaId: this.newMadrasaId,
          status: 'active'
        }, profile).catch(e => console.warn('Failed to log userLifecycleHistory for transfer:', e));

        for (const sId of candidateIds) {
          await this.repo.update('students', sId, studentUpdates, profile).catch(() => {});
          await this.repo.update('users', sId, studentUpdates, profile).catch(() => {});
        }
      }

      // Also scan this.groups for any group holding the transferred student in any roster field
      this.groups.forEach(g => {
        const gId = String(g.id || '').trim();
        if (gId && gId !== this.newGroupId) {
          const rawTokens = [
            ...(Array.isArray(g['assignedStudentIds']) ? g['assignedStudentIds'] : []),
            ...(Array.isArray(g['assignedStudents']) ? g['assignedStudents'] : []),
            ...(Array.isArray(g['studentIds']) ? g['studentIds'] : []),
            ...(Array.isArray(g['students']) ? g['students'] : []),
          ].map(v => typeof v === 'object' && v !== null ? String(v.id || v.uid || v.userId || '') : String(v || '')).filter(Boolean);

          if (rawTokens.some(tok => transferredStudentIds.has(tok.toLowerCase().trim()))) {
            previousGroupIds.add(gId);
          }
        }
      });

      // Update classGroups rosters in Firestore (thoroughly clean from old groups, add to new group)
      try {
        for (const oldGId of Array.from(previousGroupIds)) {
          let oldGroupDoc = this.groups.find(g => g.id === oldGId);
          let currentData: any = oldGroupDoc;
          if (!currentData) {
            try {
              const snap = await getDoc(doc(firestore, 'classGroups', oldGId));
              if (snap.exists()) currentData = snap.data();
            } catch { /* ignore */ }
          }

          const rawAssigned = Array.isArray(currentData?.['assignedStudentIds']) ? currentData['assignedStudentIds'] : [];
          const updatedAssigned = rawAssigned.filter((id: any) => !transferredStudentIds.has(String(id).toLowerCase().trim()));

          const rawStudentIds = Array.isArray(currentData?.['studentIds']) ? currentData['studentIds'] : [];
          const updatedStudentIds = rawStudentIds.filter((id: any) => !transferredStudentIds.has(String(id).toLowerCase().trim()));

          const rawStudents = Array.isArray(currentData?.['students']) ? currentData['students'] : [];
          const updatedStudents = rawStudents.filter((st: any) => {
            const stId = typeof st === 'object' && st !== null ? String(st.id || st.uid || st.userId || '') : String(st || '');
            return !transferredStudentIds.has(stId.toLowerCase().trim());
          });

          const rawAssignedStudents = Array.isArray(currentData?.['assignedStudents']) ? currentData['assignedStudents'] : [];
          const updatedAssignedStudents = rawAssignedStudents.filter((st: any) => {
            const stId = typeof st === 'object' && st !== null ? String(st.id || st.uid || st.userId || '') : String(st || '');
            return !transferredStudentIds.has(stId.toLowerCase().trim());
          });

          const nextCount = Math.max(0, updatedAssigned.length);
          await this.repo.update('classGroups', oldGId, {
            assignedStudentIds: updatedAssigned,
            studentIds: updatedStudentIds,
            students: updatedStudents,
            assignedStudents: updatedAssignedStudents,
            studentCount: nextCount
          }, profile).catch(() => {});
        }

        let newGroupDoc = this.groups.find(g => g.id === this.newGroupId);
        let rawAssigned: any[] = [];
        let currentCount = 0;
        if (newGroupDoc) {
          rawAssigned = Array.isArray(newGroupDoc['assignedStudentIds']) ? [...newGroupDoc['assignedStudentIds']] : [];
          currentCount = Number(newGroupDoc['studentCount']) || 0;
        } else {
          try {
            const snap = await getDoc(doc(firestore, 'classGroups', this.newGroupId));
            if (snap.exists()) {
              const data = snap.data();
              rawAssigned = Array.isArray(data['assignedStudentIds']) ? [...data['assignedStudentIds']] : [];
              currentCount = Number(data['studentCount']) || 0;
            }
          } catch { /* ignore */ }
        }
        this.targetStudents.forEach(st => {
          const sIds = [st.id, st['uid'], st['docId'], st['userId']].map(v => String(v || '').trim()).filter(Boolean);
          sIds.forEach(sid => {
            if (!rawAssigned.some(existing => String(existing).toLowerCase().trim() === sid.toLowerCase())) {
              rawAssigned.push(sid);
            }
          });
        });
        const nextCount = Math.max(rawAssigned.length, currentCount + this.targetStudents.length);
        await this.repo.update('classGroups', this.newGroupId, {
          assignedStudentIds: rawAssigned,
          studentCount: nextCount
        }, profile).catch(() => {});
      } catch (grpErr) {
        console.warn('Non-fatal: could not update group rosters during transfer:', grpErr);
      }

      this.repo.clearCache('students');
      this.repo.clearCache('users');
      this.repo.clearCache('classGroups');
      this.repo.clearCache('classes');
      this.repo.clearCache('studentTransfers');
      this.repo.clearCache('userLifecycleHistory');

      this.snackBar.open(`${this.targetStudents.length} student(s) transferred successfully.`, 'Close', { duration: 4000 });
      this.dialogRef.close({ success: true });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to transfer student(s)', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  getMadrasaName(id: any) { return this.madrasas.find(m => m.id === id)?.['name'] || id || 'None'; }
  getCourseName(id: any) { return this.courses.find(c => c.id === id)?.['name'] || id || 'None'; }
  getClassName(id: any) { return this.classes.find(c => c.id === id)?.['name'] || id || 'None'; }
  getGroupName(id: any) { return this.groups.find(g => g.id === id)?.['name'] || id || 'None'; }

  getGroupAssignedStaffName(groupOrId: EntityRecord | string | undefined | null): string {
    if (!groupOrId) return '';
    const grp = typeof groupOrId === 'string' 
      ? this.groups.find(g => g.id === groupOrId || g['name'] === groupOrId) 
      : groupOrId;
    if (!grp) return '';

    // 1. Direct assigned staff/teacher name property
    const directStaff = grp['assignedStaffName'] || grp['teacherName'] || grp['staffName'] || grp['assignedTeacherName'] || grp['inchargeName'] || grp['usthadhName'];
    if (typeof directStaff === 'string' && directStaff.trim()) {
      return directStaff.trim();
    }
    if (Array.isArray(grp['assignedStaffNames']) && grp['assignedStaffNames'].length > 0) {
      return grp['assignedStaffNames'].filter(Boolean).join(', ');
    }
    if (Array.isArray(grp['teacherNames']) && grp['teacherNames'].length > 0) {
      return grp['teacherNames'].filter(Boolean).join(', ');
    }
    if (Array.isArray(grp['staffNames']) && grp['staffNames'].length > 0) {
      return grp['staffNames'].filter(Boolean).join(', ');
    }

    // 2. Check staff tokens/IDs against allStaff list
    const staffTokens = Array.from(new Set([
      ...(Array.isArray(grp['assignedStaffIds']) ? grp['assignedStaffIds'] : []),
      ...(Array.isArray(grp['teacherUids']) ? grp['teacherUids'] : []),
      ...(Array.isArray(grp['teacherIds']) ? grp['teacherIds'] : []),
      ...(Array.isArray(grp['staffIds']) ? grp['staffIds'] : []),
      ...(Array.isArray(grp['inchargeIds']) ? grp['inchargeIds'] : []),
      grp['teacherUid'],
      grp['teacherId'],
      grp['assignedStaffId'],
      grp['staffId']
    ].filter(Boolean).map(v => String(v).trim())));

    if (staffTokens.length > 0 && this.allStaff.length > 0) {
      const names: string[] = [];
      staffTokens.forEach(stToken => {
        const found = this.allStaff.find(s => 
          String(s.id).trim() === stToken || 
          String(s['uid'] || '').trim() === stToken ||
          String(s['userId'] || '').trim() === stToken ||
          String(s['email'] || '').trim().toLowerCase() === stToken.toLowerCase()
        );
        if (found) {
          const n = found['displayName'] || found['fullName'] || found['name'] || found['email'];
          if (n && !names.includes(String(n))) names.push(String(n));
        }
      });
      if (names.length > 0) return names.join(', ');
    }

    // 3. Reverse lookup: check if any staff member is assigned to this group
    if (grp.id && this.allStaff.length > 0) {
      const assignedFromStaff = this.allStaff.filter(s => {
        const gIds = [
          s['groupId'], s['classGroupId'], s['assignedGroupId'],
          ...(Array.isArray(s['groupIds']) ? s['groupIds'] : []),
          ...(Array.isArray(s['classGroupIds']) ? s['classGroupIds'] : []),
          ...(Array.isArray(s['assignedGroupIds']) ? s['assignedGroupIds'] : [])
        ].filter(Boolean).map(String);
        return gIds.includes(String(grp.id));
      });
      if (assignedFromStaff.length > 0) {
        const names = assignedFromStaff.map(s => s['displayName'] || s['fullName'] || s['name']).filter(Boolean);
        if (names.length > 0) return Array.from(new Set(names)).join(', ');
      }
    }

    return '';
  }
}
