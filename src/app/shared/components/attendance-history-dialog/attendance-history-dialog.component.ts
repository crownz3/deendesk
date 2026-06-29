import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { firstValueFrom, map, Observable, of } from 'rxjs';
import { AttendanceRecord, AppUser, AttendanceStatus } from '../../../core/models/domain.model';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuickAddDialogComponent } from '../quick-add-dialog/quick-add-dialog.component';

export interface AttendanceHistoryDialogData {
  title: string;
  studentId?: string;
  classPlanId?: string;
  classId?: string;
}

@Component({
  selector: 'app-attendance-history-dialog',
  templateUrl: './attendance-history-dialog.component.html',
  styleUrls: ['./attendance-history-dialog.component.scss'],
  standalone: false
})
export class AttendanceHistoryDialogComponent implements OnInit {
  records$: Observable<(EntityRecord & AttendanceRecord)[]> = of([]);
  teachers: Record<string, EntityRecord> = {};
  isLoading = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AttendanceHistoryDialogData,
    private dialogRef: MatDialogRef<AttendanceHistoryDialogComponent>,
    private dialog: MatDialog,
    private repo: RepositoryService,
    private auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      const teacherList = await firstValueFrom(this.repo.list('users', profile));
      this.teachers = teacherList.reduce((acc, t) => ({ ...acc, [t.id as string]: t }), {} as Record<string, EntityRecord>);

      this.records$ = this.repo.list<EntityRecord & AttendanceRecord>('attendance', profile).pipe(
        map(records => {
          let filtered = records;
          if (this.data.studentId) {
            filtered = filtered.filter(r => r.studentId === this.data.studentId);
          }
          if (this.data.classPlanId) {
            filtered = filtered.filter(r => r['classPlanId'] === this.data.classPlanId);
          }
          if (this.data.classId) {
            filtered = filtered.filter(r => r['classId'] === this.data.classId);
          }
          filtered.sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            
            const aCreated = a['createdAt'] as any;
            const bCreated = b['createdAt'] as any;
            const aTime = aCreated?.toDate ? aCreated.toDate().getTime() : new Date(aCreated || 0).getTime();
            const bTime = bCreated?.toDate ? bCreated.toDate().getTime() : new Date(bCreated || 0).getTime();
            return bTime - aTime;
          });

          const uniqueDates = new Set<string>();
          const deduped = [];
          for (const r of filtered) {
            if (!uniqueDates.has(r.date)) {
              uniqueDates.add(r.date);
              deduped.push(r);
            }
          }
          return deduped;
        })
      );
    } catch (e) {
      console.error('Failed to load attendance history', e);
    } finally {
      this.isLoading = false;
    }
  }

  getTeacherName(teacherId?: string): string {
    if (!teacherId) return 'Unknown';
    return String(this.teachers[teacherId]?.['name'] || this.teachers[teacherId]?.['displayName'] || 'Unknown');
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'present': return 'checkmark-circle-outline';
      case 'absent': return 'close-circle-outline';
      case 'late': return 'time-outline';
      case 'leave': return 'calendar-outline';
      default: return 'ellipse-outline';
    }
  }

  async updateStatus(record: EntityRecord & AttendanceRecord, status: AttendanceStatus, toggleGroup?: any): Promise<void> {
    if (!record.id) return;
    const previousValue = record.status;

    let updateData: Partial<AttendanceRecord> = { status };

    if (status === 'absent' || status === 'leave') {
      const result = await firstValueFrom(this.dialog.open(QuickAddDialogComponent, {
        width: '500px',
        data: {
          title: status === 'absent' ? 'Absent Details' : 'Leave Details',
          fields: [
            { 
              key: 'informed', 
              label: 'Informed?', 
              type: 'button-toggle', 
              required: true,
              options: [{label: 'Yes', value: 'Yes'}, {label: 'No', value: 'No'}] 
            },
            { key: 'reason', label: 'Reason', type: 'textarea' }
          ],
          submitLabel: 'Save'
        }
      }).afterClosed());

      if (result?.value) {
        updateData = { ...updateData, ...result.value };
      } else {
        if (toggleGroup) toggleGroup.value = previousValue || null;
        return;
      }
    } else if (status === 'late') {
      const result = await firstValueFrom(this.dialog.open(QuickAddDialogComponent, {
        width: '500px',
        data: {
          title: 'Late Details',
          fields: [
            { key: 'lateTime', label: 'How much time late? (e.g. 15 mins)', type: 'text', required: true }
          ],
          submitLabel: 'Save'
        }
      }).afterClosed());

      if (result?.value) {
        updateData = { ...updateData, ...result.value };
      } else {
        if (toggleGroup) toggleGroup.value = previousValue || null;
        return;
      }
    } else {
      (updateData as any).informed = null;
      (updateData as any).reason = null;
      (updateData as any).lateTime = null;
    }

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      await this.repo.update('attendance', String(record.id), updateData, profile);
    } catch (e) {
      console.error('Failed to update attendance history record', e);
      if (toggleGroup) toggleGroup.value = previousValue || null;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
