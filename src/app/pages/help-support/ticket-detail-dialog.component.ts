import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import {
  AppUser,
  HelpTicketPriority,
  HelpTicketStatus,
  SupportTicket,
  SupportTicketMessage
} from '../../core/models/domain.model';
import { EntityRecord } from '../../core/services/repository.service';
import { HelpSupportService } from '../../core/services/help-support.service';

export interface TicketDetailDialogData {
  ticket: SupportTicket & EntityRecord;
  actor: AppUser;
}

@Component({
  selector: 'app-ticket-detail-dialog',
  templateUrl: './ticket-detail-dialog.component.html',
  styleUrls: ['./ticket-detail-dialog.component.scss'],
  standalone: false,
})
export class TicketDetailDialogComponent implements OnInit, OnDestroy {
  ticket: SupportTicket & EntityRecord;
  messages: SupportTicketMessage[] = [];
  loadingMessages = true;
  sendingReply = false;
  updatingStatus = false;

  replyText = '';
  selectedReplyFiles: File[] = [];
  filePreviews: string[] = [];

  selectedStatus: HelpTicketStatus;
  selectedPriority: HelpTicketPriority;

  previewImageUrl: string | null = null;
  private messagesSub?: Subscription;

  readonly statuses: { value: HelpTicketStatus; label: string; color: string; badgeClass: string }[] = [
    { value: 'OPEN', label: 'Open', color: '#0284c7', badgeClass: 'status-open' },
    { value: 'IN_PROGRESS', label: 'In Progress', color: '#d97706', badgeClass: 'status-progress' },
    { value: 'WAITING_FOR_USER', label: 'Waiting For User', color: '#7c3aed', badgeClass: 'status-waiting' },
    { value: 'RESOLVED', label: 'Resolved', color: '#16a34a', badgeClass: 'status-resolved' },
    { value: 'CLOSED', label: 'Closed', color: '#4b5563', badgeClass: 'status-closed' },
  ];

  readonly priorities: { value: HelpTicketPriority; label: string; color: string }[] = [
    { value: 'LOW', label: 'Low', color: '#6b7280' },
    { value: 'MEDIUM', label: 'Medium', color: '#2563eb' },
    { value: 'HIGH', label: 'High', color: '#d97706' },
    { value: 'URGENT', label: 'Urgent', color: '#dc2626' },
  ];

  constructor(
    public readonly dialogRef: MatDialogRef<TicketDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TicketDetailDialogData,
    private readonly helpService: HelpSupportService,
    private readonly snackBar: MatSnackBar
  ) {
    this.ticket = data.ticket;
    this.selectedStatus = data.ticket.status || 'OPEN';
    this.selectedPriority = data.ticket.priority || 'MEDIUM';
  }

  ngOnInit(): void {
    this.listenToMessages();
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
  }

  get isSuperAdmin(): boolean {
    return this.data.actor.role === 'superAdmin';
  }

  get organizationNameDisplay(): string {
    if (this.ticket.organizationName && this.ticket.organizationName !== 'N/A') {
      return this.ticket.organizationName;
    }
    if (this.ticket.organizationId) {
      return `Org (${this.ticket.organizationId.slice(0, 8)})`;
    }
    return 'System / Global';
  }

  private listenToMessages(): void {
    this.loadingMessages = true;
    this.messagesSub = this.helpService.listMessages(this.ticket.id || '').subscribe({
      next: (msgs) => {
        this.messages = msgs;
        this.loadingMessages = false;
      },
      error: (err) => {
        console.error('[TicketDetailDialog] Error loading messages:', err);
        this.loadingMessages = false;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const filesArr = Array.from(input.files);
      for (const file of filesArr) {
        if (file.size > 10 * 1024 * 1024) {
          this.snackBar.open(`File "${file.name}" exceeds 10MB limit`, 'Close', { duration: 3000 });
          continue;
        }
        this.selectedReplyFiles.push(file);

        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e: any) => this.filePreviews.push(e.target.result);
          reader.readAsDataURL(file);
        } else {
          this.filePreviews.push('');
        }
      }
    }
    input.value = '';
  }

  removeReplyFile(index: number): void {
    this.selectedReplyFiles.splice(index, 1);
    this.filePreviews.splice(index, 1);
  }

  async sendReply(): Promise<void> {
    if (!this.replyText.trim() && this.selectedReplyFiles.length === 0) {
      return;
    }

    this.sendingReply = true;
    try {
      await this.helpService.addReply(
        this.ticket.id || '',
        this.ticket,
        this.replyText,
        this.selectedReplyFiles,
        this.data.actor
      );

      this.replyText = '';
      this.selectedReplyFiles = [];
      this.filePreviews = [];
      this.snackBar.open('Reply sent successfully!', 'Close', { duration: 3000 });
    } catch (err: any) {
      console.error('[TicketDetailDialog] Failed to send reply:', err);
      this.snackBar.open(err.message || 'Failed to send reply', 'Close', { duration: 4000 });
    } finally {
      this.sendingReply = false;
    }
  }

  async updateStatusAndPriority(): Promise<void> {
    if (this.selectedStatus === this.ticket.status && this.selectedPriority === this.ticket.priority) {
      return;
    }

    this.updatingStatus = true;
    try {
      await this.helpService.updateTicketStatus(
        this.ticket.id || '',
        this.ticket,
        this.selectedStatus,
        this.selectedPriority,
        this.data.actor
      );

      this.ticket.status = this.selectedStatus;
      this.ticket.priority = this.selectedPriority;
      this.snackBar.open('Ticket status and priority updated successfully!', 'Close', { duration: 3000 });
    } catch (err: any) {
      console.error('[TicketDetailDialog] Error updating ticket status:', err);
      this.snackBar.open(err.message || 'Failed to update status', 'Close', { duration: 4000 });
    } finally {
      this.updatingStatus = false;
    }
  }

  openImagePreview(url: string): void {
    this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  getStatusBadgeClass(status: string): string {
    const s = this.statuses.find(item => item.value === status);
    return s ? s.badgeClass : 'status-open';
  }

  getStatusLabel(status: string): string {
    const s = this.statuses.find(item => item.value === status);
    return s ? s.label : status;
  }

  getPriorityColor(priority: string): string {
    const p = this.priorities.find(item => item.value === priority);
    return p ? p.color : '#2563eb';
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'Just now';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString();
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleString();
    }
    return String(timestamp);
  }

  close(): void {
    this.dialogRef.close();
  }
}
