import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { EventService } from '../../core/services/event.service';
import { AppUser, EventParticipant, EventAttendance, EventScheduleHistory } from '../../core/models/domain.model';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { QuickAddDialogComponent } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { firstValueFrom } from 'rxjs';
import { AuditLogService } from '../../core/services/audit-log.service';

@Component({
  selector: 'app-event-details-dialog',
  templateUrl: './event-details-dialog.component.html',
  styleUrls: ['./event-details-dialog.component.scss'],
  standalone: false
})
export class EventDetailsDialogComponent implements OnInit {
  event: any;
  profile: AppUser | null = null;
  staffList: any[] = [];
  activeTab = 0;
  isLoading = false;

  // Resolved list states
  participants: EventParticipant[] = [];
  attendanceRecords: EventAttendance[] = [];
  scheduleHistory: EventScheduleHistory[] = [];
  activityLogs: any[] = [];

  // Attendance stats
  attendanceStats = {
    present: 0,
    absent: 0,
    excused: 0,
    notMarked: 0,
    percentage: 0
  };

  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());

  constructor(
    private readonly eventService: EventService,
    private readonly auditLogService: AuditLogService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly dialogRef: MatDialogRef<EventDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { event: any; profile: AppUser | null }
  ) {
    this.event = data.event;
    this.profile = data.profile;
    this.staffList = (data as any).staff || [];
  }

  getEventStatus(e: any): string {
    if (!e) return 'expired';
    const status = (e.status || 'upcoming').toLowerCase();

    if (['completed', 'cancelled', 'postponed', 'preponed'].includes(status)) {
      return status;
    }

    const now = new Date();
    const endDate = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : null);
    const startDate = e.startDate?.toDate ? e.startDate.toDate() : (e.startDate ? new Date(e.startDate) : null);

    const checkDate = endDate || startDate;

    if (checkDate && !isNaN(checkDate.getTime())) {
      if (checkDate < now) {
        return 'expired';
      }
    }

    return status;
  }

  ngOnInit(): void {
    this.loadAllDetails();
  }

  async loadAllDetails(): Promise<void> {
    this.isLoading = true;
    try {
      // 1. Load participants
      this.participants = await this.eventService.listParticipants(this.event.id).toPromise() || [];
      
      // 2. Load attendance
      this.attendanceRecords = await this.eventService.listAttendance(this.event.id).toPromise() || [];
      
      // 3. Load schedule history
      this.scheduleHistory = await this.eventService.listScheduleHistory(this.event.id).toPromise() || [];
      
      // 4. Load activity logs
      await this.loadActivityLogs();

      // Compute stats
      this.computeAttendanceStats();
    } catch (e) {
      console.error(e);
      this.snackBar.open('Error loading details', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  async loadActivityLogs(): Promise<void> {
    this.activityLogs = await this.auditLogService.getLogsForTarget(this.event.id);
  }

  computeAttendanceStats(): void {
    const total = this.participants.length;
    if (total === 0) {
      this.attendanceStats = { present: 0, absent: 0, excused: 0, notMarked: 0, percentage: 0 };
      return;
    }

    let p = 0, a = 0, e = 0, nm = 0;
    for (const part of this.participants) {
      if (part.attendanceStatus === 'present') p++;
      else if (part.attendanceStatus === 'absent') a++;
      else if (part.attendanceStatus === 'excused') e++;
      else nm++;
    }

    const marked = p + a + e;
    const percentage = marked > 0 ? Math.round((p / marked) * 100) : 0;

    this.attendanceStats = {
      present: p,
      absent: a,
      excused: e,
      notMarked: nm,
      percentage
    };
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }

  getStaffName(staffId: string): string {
    if (!staffId) return 'N/A';
    const staff = this.staffList.find(s => s.id === staffId);
    return staff ? ((staff['name'] as string) || (staff['displayName'] as string) || staffId) : 'Unknown';
  }

  get canManage(): boolean {
    if (!this.profile) return false;
    if (this.profile.role === 'superAdmin' || this.profile.role === 'organizationAdmin') return true;
    if (this.profile.permissions?.includes('manageEvents')) return true;
    const staffId = this.profile.entityType === 'staff' ? this.profile.entityId : null;
    if (staffId && (this.event.staffInChargeId === staffId || this.event.additionalResponsibleStaffIds?.includes(staffId))) return true;
    return false;
  }

  get canRecordAttendance(): boolean {
    if (!this.profile) return false;
    if (this.profile.role === 'superAdmin' || this.profile.role === 'organizationAdmin') return true;
    if (this.profile.permissions?.includes('recordEventAttendance')) return true;
    const staffId = this.profile.entityType === 'staff' ? this.profile.entityId : null;
    if (staffId && (this.event.staffInChargeId === staffId || this.event.additionalResponsibleStaffIds?.includes(staffId))) return true;
    return false;
  }

  async changeStatus(newStatus: string): Promise<void> {
    let reason = '';
    let notes = '';

    if (newStatus === 'cancelled' || newStatus === 'postponed' || newStatus === 'completed') {
      const dialogRef = this.dialog.open(QuickAddDialogComponent, {
        width: '400px',
        data: {
          title: newStatus === 'completed' ? 'Complete Event' : `${newStatus === 'cancelled' ? 'Cancel' : 'Postpone'} Event`,
          fields: [
            { 
              key: 'reason', 
              label: newStatus === 'completed' ? 'Completion Notes' : 'Reason', 
              type: 'textarea', 
              required: newStatus !== 'completed' 
            }
          ],
          submitLabel: 'Save'
        }
      });
      const result = await firstValueFrom(dialogRef.afterClosed());
      if (!result) return; // User cancelled
      
      const enteredReason = result.value?.['reason'] as string || '';
      
      if (newStatus !== 'completed' && !enteredReason.trim()) {
        this.snackBar.open('Reason is required.', 'Close', { duration: 3000 });
        return;
      }
      
      if (newStatus === 'completed') {
        notes = enteredReason;
      } else {
        reason = enteredReason;
      }
    }

    try {
      this.isLoading = true;
      const res = await this.eventService.changeStatus(this.event.id, newStatus, reason, notes);
      this.event.status = newStatus;
      this.snackBar.open(`Event status changed to ${newStatus}`, 'Close', { duration: 3000 });
      this.loadAllDetails();
    } catch (err: any) {
      this.snackBar.open(err.message || 'Failed to change status', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  async rescheduleEvent(isPostpone = false): Promise<void> {
    const formatTime = (timestamp: any) => {
      if (!timestamp) return '';
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const dialogRef = this.dialog.open(QuickAddDialogComponent, {
      width: '450px',
      data: {
        title: isPostpone ? 'Postpone Event' : 'Reschedule Event',
        fields: [
          { key: 'newStartDate', label: 'New Start Date', type: 'date', required: true },
          { key: 'newStartTime', label: 'New Start Time', type: 'time', required: true },
          { key: 'newEndDate', label: 'New End Date', type: 'date', required: true },
          { key: 'newEndTime', label: 'New End Time', type: 'time', required: true },
          { key: 'reason', label: isPostpone ? 'Reason for Postponing' : 'Reason for Rescheduling', type: 'textarea', required: true }
        ],
        initialValue: {
          newStartDate: this.event.startDate ? (this.event.startDate.toDate ? this.event.startDate.toDate() : new Date(this.event.startDate)) : '',
          newStartTime: formatTime(this.event.startDate),
          newEndDate: this.event.endDate ? (this.event.endDate.toDate ? this.event.endDate.toDate() : new Date(this.event.endDate)) : '',
          newEndTime: formatTime(this.event.endDate)
        },
        submitLabel: isPostpone ? 'Postpone' : 'Reschedule'
      }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) return;

    const startDateStr = result.value?.['newStartDate'] as Date;
    const startTimeStr = result.value?.['newStartTime'] as string;
    const endDateStr = result.value?.['newEndDate'] as Date;
    const endTimeStr = result.value?.['newEndTime'] as string;
    
    let newStart = 0;
    let newEnd = 0;

    if (startDateStr && startTimeStr) {
      const start = new Date(startDateStr);
      const [sh, sm] = startTimeStr.split(':').map(Number);
      start.setHours(sh, sm, 0, 0);
      newStart = start.getTime();
    }

    if (endDateStr && endTimeStr) {
      const end = new Date(endDateStr);
      const [eh, em] = endTimeStr.split(':').map(Number);
      end.setHours(eh, em, 0, 0);
      newEnd = end.getTime();
    }

    const reason = result.value?.['reason'] as string || '';

    if (!newStart || !newEnd || isNaN(newStart) || isNaN(newEnd)) {
      this.snackBar.open('Invalid date or time selected.', 'Close', { duration: 3000 });
      return;
    }

    const currentStartObj = this.event.startDate?.toDate ? this.event.startDate.toDate() : new Date(this.event.startDate);
    const currentEndObj = this.event.endDate?.toDate ? this.event.endDate.toDate() : new Date(this.event.endDate);
    const currentStart = currentStartObj.getTime();
    const currentEnd = currentEndObj.getTime();

    if (newEnd <= newStart) {
      this.snackBar.open('End date/time must be after the start date/time.', 'Close', { duration: 3000 });
      return;
    }

    if (newStart === currentStart && newEnd === currentEnd) {
      this.snackBar.open('New schedule must be different from the current schedule.', 'Close', { duration: 3000 });
      return;
    }

    if (isPostpone && newStart <= currentStart) {
      this.snackBar.open('For postponement, the new start date/time must be after the current start date/time.', 'Close', { duration: 4000 });
      return;
    }

    try {
      this.isLoading = true;
      await this.eventService.rescheduleEvent(this.event.id, newStart, newEnd, reason);
      this.snackBar.open('Event rescheduled successfully.', 'Close', { duration: 3000 });
      this.loadAllDetails();
    } catch (err: any) {
      this.snackBar.open(err.message || 'Failed to reschedule event', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }


  async syncParticipants(): Promise<void> {
    try {
      this.isLoading = true;
      const res = await this.eventService.syncParticipants(this.event.id);
      this.snackBar.open(`Synced. Added: ${res.addedCount}, Retained: ${res.retainedCount}, Deactivated: ${res.deactivatedCount}`, 'Close', { duration: 4000 });
      this.loadAllDetails();
    } catch (err: any) {
      this.snackBar.open(err.message || 'Sync failed', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
