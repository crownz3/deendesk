import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EventService } from '../../core/services/event.service';
import { AppUser, EventParticipant, EventAttendance } from '../../core/models/domain.model';

@Component({
  selector: 'app-event-attendance-dialog',
  templateUrl: './event-attendance-dialog.component.html',
  styleUrls: ['./event-attendance-dialog.component.scss'],
  standalone: false
})
export class EventAttendanceDialogComponent implements OnInit {
  event: any;
  profile: AppUser | null = null;
  isLoading = false;
  isSaving = false;

  participants: EventParticipant[] = [];
  attendanceRecords: EventAttendance[] = [];
  
  // Working copy of attendance changes
  // key: participantId, value: status
  attendanceChanges = new Map<string, 'present' | 'absent' | 'excused' | 'notApplicable'>();
  hasUnsavedChanges = false;

  // Filters
  searchQuery = '';
  roleFilter = 'all';
  statusFilter = 'all';

  constructor(
    private readonly eventService: EventService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<EventAttendanceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { event: any; profile: AppUser | null }
  ) {
    this.event = data.event;
    this.profile = data.profile;
  }

  ngOnInit(): void {
    this.loadAttendanceData();
  }

  async loadAttendanceData(): Promise<void> {
    this.isLoading = true;
    try {
      this.participants = await this.eventService.listParticipants(this.event.id).toPromise() || [];
      this.attendanceRecords = await this.eventService.listAttendance(this.event.id).toPromise() || [];

      // Load initial state into changes map
      this.attendanceChanges.clear();
      for (const p of this.participants) {
        this.attendanceChanges.set(p.participantId, p.attendanceStatus || 'notApplicable');
      }
      this.hasUnsavedChanges = false;
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to load attendance list.', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  get canRecord(): boolean {
    if (!this.profile) return false;
    if (this.profile.role === 'superAdmin' || this.profile.role === 'organizationAdmin') return true;
    if (this.profile.permissions?.includes('recordEventAttendance')) return true;
    const staffId = this.profile.entityType === 'staff' ? this.profile.entityId : null;
    if (staffId && (this.event.staffInChargeId === staffId || this.event.additionalResponsibleStaffIds?.includes(staffId))) return true;
    return false;
  }

  get filteredParticipants(): EventParticipant[] {
    return this.participants.filter(p => {
      const matchesSearch = p.participantNameSnapshot.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesRole = this.roleFilter === 'all' || p.participantType === this.roleFilter;
      const currentStatus = this.attendanceChanges.get(p.participantId) || 'notApplicable';
      const matchesStatus = this.statusFilter === 'all' || currentStatus === this.statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  get stats() {
    let present = 0, absent = 0, excused = 0, total = 0;
    this.attendanceChanges.forEach(val => {
      total++;
      if (val === 'present') present++;
      else if (val === 'absent') absent++;
      else if (val === 'excused') excused++;
    });

    const marked = present + absent + excused;
    const percentage = marked > 0 ? Math.round((present / marked) * 100) : 0;
    const notMarked = total - marked;

    return { present, absent, excused, notMarked, percentage, total };
  }

  markStatus(participantId: string, status: 'present' | 'absent' | 'excused' | 'notApplicable'): void {
    if (!this.canRecord) return;
    this.attendanceChanges.set(participantId, status);
    this.hasUnsavedChanges = true;
  }

  bulkMark(status: 'present' | 'absent' | 'excused'): void {
    if (!this.canRecord) return;
    const filtered = this.filteredParticipants;
    for (const p of filtered) {
      this.attendanceChanges.set(p.participantId, status);
    }
    this.hasUnsavedChanges = true;
    this.snackBar.open(`Marked ${filtered.length} visible participants as ${status}.`, 'Close', { duration: 2000 });
  }

  resetAll(): void {
    if (!this.canRecord) return;
    for (const p of this.participants) {
      this.attendanceChanges.set(p.participantId, 'notApplicable');
    }
    this.hasUnsavedChanges = true;
  }

  async save(): Promise<void> {
    if (!this.canRecord) return;
    this.isSaving = true;
    try {
      const recordsToSave: Partial<EventAttendance>[] = [];
      this.attendanceChanges.forEach((status, participantId) => {
        const p = this.participants.find(part => part.participantId === participantId);
        if (p) {
          recordsToSave.push({
            participantId,
            participantType: p.participantType,
            participantName: p.participantNameSnapshot,
            status,
            organizationId: this.event.organizationId,
            madrasaId: p.madrasaId || this.event.madrasaIds[0] || ''
          });
        }
      });

      await this.eventService.saveAttendance(this.event.id, recordsToSave, this.profile);
      this.snackBar.open('Attendance records updated successfully.', 'Close', { duration: 3000 });
      this.hasUnsavedChanges = false;
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to save attendance.', 'Close', { duration: 4000 });
      console.error(e);
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    if (this.hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to discard them?')) {
      return;
    }
    this.dialogRef.close(false);
  }
}
