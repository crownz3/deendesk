import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BugStatus, QaBug } from '../../../core/models/domain.model';
import { QaTestingService } from '../../../core/services/qa-testing.service';

export interface QaBugDetailsDialogData {
  bug: QaBug;
  canEdit?: boolean;
}

@Component({
  selector: 'app-qa-bug-details-dialog',
  templateUrl: './qa-bug-details-dialog.component.html',
  styleUrls: ['./qa-bug-details-dialog.component.scss'],
  standalone: false,
})
export class QaBugDetailsDialogComponent implements OnInit {
  bug!: QaBug;
  newCommentText = '';
  isSubmittingComment = false;
  statusReason = '';
  showReasonInput = false;
  targetStatus: BugStatus | null = null;

  readonly allStatuses: BugStatus[] = [
    'New',
    'In Progress',
    'Fixed',
    'Ready for Testing',
    'Verified',
    'Reopened',
    'Closed',
    'Rejected',
  ];

  constructor(
    private dialogRef: MatDialogRef<QaBugDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QaBugDetailsDialogData,
    private qaService: QaTestingService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.bug = this.data.bug;
  }

  async onStatusChange(newStatus: BugStatus): Promise<void> {
    if (!this.bug?.id) return;
    if (newStatus === 'Rejected' || newStatus === 'Reopened') {
      this.targetStatus = newStatus;
      this.showReasonInput = true;
      return;
    }

    try {
      await this.qaService.changeBugStatus(this.bug.id, newStatus, this.bug.status);
      this.bug.status = newStatus;
      this.snackBar.open(`Status updated to ${newStatus}`, 'OK', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Failed to update status: ${err.message}`, 'Close', { duration: 4000 });
    }
  }

  async confirmStatusChangeWithReason(): Promise<void> {
    if (!this.targetStatus || !this.bug?.id) return;
    try {
      await this.qaService.changeBugStatus(this.bug.id, this.targetStatus, this.bug.status, this.statusReason);
      this.bug.status = this.targetStatus;
      this.showReasonInput = false;
      this.statusReason = '';
      this.targetStatus = null;
      this.snackBar.open(`Status updated to ${this.bug.status}`, 'OK', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Error: ${err.message}`, 'Close', { duration: 4000 });
    }
  }

  async onSubmitComment(): Promise<void> {
    if (!this.newCommentText || !this.newCommentText.trim() || !this.bug?.id) return;
    this.isSubmittingComment = true;
    try {
      await this.qaService.addBugComment(this.bug.id, this.newCommentText.trim());
      this.newCommentText = '';
      this.snackBar.open('Comment added', 'OK', { duration: 2500 });
    } catch (err: any) {
      this.snackBar.open(`Failed to post comment: ${err.message}`, 'Close');
    } finally {
      this.isSubmittingComment = false;
    }
  }

  close(): void {
    this.dialogRef.close(this.bug);
  }
}
