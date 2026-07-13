import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-course-details-dialog',
  templateUrl: './course-details-dialog.component.html',
  styleUrls: ['./course-details-dialog.component.scss'],
  standalone: false,
})
export class CourseDetailsDialogComponent implements OnInit {
  course: EntityRecord;
  loadingCounts = true;

  classesCount = 0;
  subjectsCount = 0;
  studentsCount = 0;
  staffCount = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { course: EntityRecord },
    private repo: RepositoryService,
    private auth: AuthService
  ) {
    this.course = data.course;
  }

  ngOnInit(): void {
    this.loadCounts();
  }

  private async loadCounts(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      // Load classes
      const classes = await this.repo.getAllOnce('classes', profile);
      const courseClasses = classes.filter((c: any) => c['courseId'] === this.course.id);
      this.classesCount = courseClasses.length;

      // Load subjects
      const subjects = await this.repo.getAllOnce('subjects', profile);
      const courseSubjects = subjects.filter((s: any) => 
        s['courseId'] === this.course.id || 
        (s['classId'] && courseClasses.some((c: any) => c.id === s['classId']))
      );
      this.subjectsCount = courseSubjects.length;

      // Load users and count students / staff
      const studentsData = await this.repo.getAllOnce('users', profile, { roles: ['student'] });
      const students = studentsData.filter((u: any) => (
        u['courseId'] === this.course.id ||
        (Array.isArray(u['courseIds']) && u['courseIds'].includes(this.course.id)) ||
        (u['classId'] && courseClasses.some((c: any) => c.id === u['classId']))
      ));
      this.studentsCount = students.length;

      const classIds = new Set(courseClasses.map((c: any) => String(c.id)));
      const groups = await this.repo.getAllOnce('classGroups', profile);
      const courseGroups = groups.filter((group: any) => classIds.has(String(group['classId'])));
      const staffIds = new Set<string>();
      courseGroups.forEach((group: any) => {
        if (Array.isArray(group['assignedStaffIds'])) {
          group['assignedStaffIds'].forEach((id: unknown) => staffIds.add(String(id)));
        }
      });
      this.staffCount = staffIds.size;

      console.log('[Course Counts Debug]', {
        courseId: this.course.id,
        courseName: this.course['name'] || this.course['title'],
        classesCount: this.classesCount,
        subjectsCount: this.subjectsCount,
        studentsCount: this.studentsCount,
        staffCount: this.staffCount,
      });

    } catch (e) {
      console.error('[Course Counts Error]', e);
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
}
