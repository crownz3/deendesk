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

  private async loadCounts(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      // Load groups
      const groups = await this.repo.getAllOnce('classGroups', profile);
      this.groups = groups.filter((g: any) => g['classId'] === this.classRecord.id)
                          .sort((a: any, b: any) => (a['displayOrder'] || 99) - (b['displayOrder'] || 99));
      this.groupsCount = this.groups.length;

      // Load users and count students
      const studentsData = await this.repo.getAllOnce('users', profile, { roles: ['student'] });
      const students = studentsData.filter((u: any) => (
        u['classId'] === this.classRecord.id ||
        (Array.isArray(u['classIds']) && u['classIds'].includes(this.classRecord.id))
      ));
      this.studentsCount = students.length;

      const staffIds = new Set<string>();
      this.groups.forEach((group: any) => {
        if (Array.isArray(group['assignedStaffIds'])) {
          group['assignedStaffIds'].forEach((id: unknown) => staffIds.add(String(id)));
        }
      });
      this.staffCount = staffIds.size;

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
