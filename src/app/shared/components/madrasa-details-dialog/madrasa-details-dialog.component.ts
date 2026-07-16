import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserDetailsDialogComponent } from '../user-details-dialog/user-details-dialog.component';
import { firstValueFrom } from 'rxjs';

export interface MadrasaDetailsDialogData {
  madrasa: EntityRecord;
}

@Component({
  selector: 'app-madrasa-details-dialog',
  templateUrl: './madrasa-details-dialog.component.html',
  styleUrls: ['./madrasa-details-dialog.component.scss'],
  standalone: false,
})
export class MadrasaDetailsDialogComponent implements OnInit {
  madrasa: EntityRecord;
  loading = true;

  organizationName = '-';
  coordinators: EntityRecord[] = [];
  incharges: EntityRecord[] = [];
  staffList: (EntityRecord & { assignments: string })[] = [];
  studentsList: (EntityRecord & { courseName: string; className: string; groupName: string })[] = [];

  counts = {
    students: 0,
    staff: 0,
    coordinators: 0,
    incharges: 0
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MadrasaDetailsDialogData,
    public dialogRef: MatDialogRef<MadrasaDetailsDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private dialog: MatDialog
  ) {
    this.madrasa = data.madrasa;
  }

  async ngOnInit() {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const mId = this.madrasa.id!;

      const [orgs, users, staff, students, courses, classes, groups] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('organizations', profile),
        this.repo.getAllOnce<EntityRecord>('users', profile),
        this.repo.getAllOnce<EntityRecord>('staff', profile),
        this.repo.getAllOnce<EntityRecord>('students', profile),
        this.repo.getAllOnce<EntityRecord>('courses', profile),
        this.repo.getAllOnce<EntityRecord>('classes', profile),
        this.repo.getAllOnce<EntityRecord>('classGroups', profile)
      ]);

      const org = orgs.find(o => o.id === this.madrasa['organizationId']);
      this.organizationName = org ? String(org['name']) : '-';

      const mergeUser = (record: EntityRecord, defaultRole?: string) => {
        const userRow = users.find(u =>
          u['uid'] === record['userId'] ||
          u.id === record['userId'] ||
          u['entityId'] === record.id
        );
        return {
          ...userRow,
          ...record,
          id: record.id,
          uid: userRow?.['uid'] || userRow?.id || record.id,
          name: record['name'] || userRow?.['displayName'] || userRow?.['name'] || '',
          displayName: record['name'] || userRow?.['displayName'] || userRow?.['name'] || '',
          email: record['email'] || userRow?.['email'] || '',
          phone: record['phone'] || record['mobileNumber'] || userRow?.['phone'] || '',
          role: record['role'] || userRow?.['role'] || defaultRole || '',
        } as EntityRecord;
      };

      this.coordinators = users.filter(u =>
        u['role'] === 'coordinator' &&
        (u['madrasaId'] === mId || (Array.isArray(u['madrasaIds']) && u['madrasaIds'].includes(mId)))
      );

      this.incharges = users.filter(u =>
        u['role'] === 'madrasaIncharge' &&
        (u['madrasaId'] === mId || (Array.isArray(u['madrasaIds']) && u['madrasaIds'].includes(mId)))
      );

      const madrasaStaffRaw = staff.filter(s =>
        Array.isArray(s['madrasaIds']) && s['madrasaIds'].includes(mId)
      );

      const staffRoles = ['teacher', 'staff', 'madrasaincharge', 'coordinator', 'organizationadmin'];
      const extraStaffUsers = users.filter(u => 
        staffRoles.includes(String(u['role'] || '').trim().toLowerCase()) &&
        (u['madrasaId'] === mId || (Array.isArray(u['madrasaIds']) && u['madrasaIds'].includes(mId)))
      );

      const allStaffRecordsMap = new Map<string, any>();
      madrasaStaffRaw.forEach(s => allStaffRecordsMap.set(String(s['userId'] || s.id || ''), s));
      extraStaffUsers.forEach(u => {
        const uidStr = String(u['uid'] || u.id || '');
        if (!allStaffRecordsMap.has(uidStr)) {
          allStaffRecordsMap.set(uidStr, u);
        }
      });
      const combinedStaffRaw = Array.from(allStaffRecordsMap.values());

      this.staffList = combinedStaffRaw.map(s => {
        const merged = mergeUser(s, 'teacher');
        const assignedGroups = groups.filter(g =>
          g['madrasaId'] === mId &&
          Array.isArray(g['assignedStaffIds']) &&
          (g['assignedStaffIds'] as string[]).includes(s.id!)
        );

        const assignmentStrings = assignedGroups.map(g => {
          const course = courses.find(c => c.id === g['courseId']);
          const cls = classes.find(c => c.id === g['classId']);
          const courseLabel = course ? (course['title'] || course['name']) : 'Unknown Course';
          const classLabel = cls ? cls['name'] : 'Unknown Class';
          return `${courseLabel} - ${classLabel} (${g['name']})`;
        });

        return {
          ...merged,
          assignments: assignmentStrings.length > 0 ? assignmentStrings.join(', ') : 'No assignments'
        };
      });

      const madrasaStudentsRaw = students.filter(s => s['madrasaId'] === mId);

      this.studentsList = madrasaStudentsRaw.map(s => {
        const merged = mergeUser(s, 'student');
        const course = courses.find(c => c.id === s['courseId']);
        const cls = classes.find(c => c.id === s['classId']);
        const grp = groups.find(g => g.id === s['groupId']);

        return {
          ...merged,
          courseName: course ? String(course['title'] || course['name']) : '-',
          className: cls ? String(cls['name']) : '-',
          groupName: grp ? String(grp['name']) : '-'
        };
      });

      this.counts.coordinators = this.coordinators.length;
      this.counts.incharges = this.incharges.length;
      this.counts.staff = this.staffList.length;
      this.counts.students = this.studentsList.length;

    } catch (e) {
      console.error('Failed to load Madrasa details', e);
    } finally {
      this.loading = false;
    }
  }

  viewUser(user: EntityRecord) {
    this.dialog.open(UserDetailsDialogComponent, {
      data: { user },
      width: '80vw',
      maxWidth: '80vw',
      height: '85vh',
      panelClass: 'user-details-dialog-panel'
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
