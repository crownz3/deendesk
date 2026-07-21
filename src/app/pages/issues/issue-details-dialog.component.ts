import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { AppUser } from '../../core/models/domain.model';
import { IssueService } from '../../core/services/issue.service';
import { AuditLogService } from '../../core/services/audit-log.service';

@Component({
  selector: 'app-issue-details-dialog',
  templateUrl: './issue-details-dialog.component.html',
  styleUrls: ['./issue-details-dialog.component.scss'],
  standalone: false
})
export class IssueDetailsDialogComponent implements OnInit {
  issue: any;
  profile: AppUser | null = null;
  staffList: any[] = [];

  privateDetails: any = null;
  internalNotes: any[] = [];
  statusHistory: any[] = [];
  assignments: any[] = [];
  attachments: any[] = [];
  activityLogs: any[] = [];

  isLoading = true;
  activeTab = 0;

  // Add Internal Note form fields
  newNoteText = '';
  newNoteType: 'general' | 'confidential' | 'safeguarding' | 'action' = 'general';

  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());

  constructor(
    private readonly issueService: IssueService,
    private readonly auditLogService: AuditLogService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly dialogRef: MatDialogRef<IssueDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { issue: any; profile: AppUser | null; staff: any[] }
  ) {
    this.issue = data.issue;
    this.profile = data.profile;
    this.staffList = data.staff;
  }

  ngOnInit(): void {
    this.loadAllTimelines();
  }

  async loadAllTimelines(): Promise<void> {
    this.isLoading = true;
    try {
      // 1. Get Private Details (restricted access)
      if (this.canViewPrivateDetails) {
        this.issueService.getPrivateDetails(this.issue.id).subscribe({
          next: (pd) => this.privateDetails = pd,
          error: (e) => console.warn('Private details restricted or not found', e)
        });
      }

      // 2. Get Internal Notes
      if (this.canViewInternalNotes) {
        this.issueService.listInternalNotes(this.issue.id, this.profile).subscribe(notes => this.internalNotes = notes);
      }

      // 3. Status History
      this.issueService.listStatusHistory(this.issue.id, this.profile).subscribe(hist => this.statusHistory = hist);

      // 4. Assignments
      this.issueService.listAssignments(this.issue.id, this.profile).subscribe(assign => this.assignments = assign);

      // 5. Attachments
      this.issueService.listAttachments(this.issue.id, this.profile).subscribe(att => this.attachments = att);

      // 6. Audit Logs
      await this.loadAuditLogs();
    } catch (e) {
      console.error(e);
      this.snackBar.open('Error loading issue details', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  async loadAuditLogs(): Promise<void> {
    this.activityLogs = await this.auditLogService.getLogsForTarget(this.issue.id);
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }

  // --- Scoping / Role Checks ---
  get isReporter(): boolean {
    return this.issue.reportedBy === this.profile?.uid;
  }

  get isAssignee(): boolean {
    return this.issue.assignedStaffId === this.profile?.uid ||
           this.issue.assignedCoordinatorId === this.profile?.uid ||
           this.issue.assignedMadrasaInchargeId === this.profile?.uid;
  }

  get isManager(): boolean {
    if (!this.profile) return false;
    return ['superAdmin', 'organizationAdmin'].includes(this.profile.role) || (this.profile.permissions?.includes('manageIssues') ?? false);
  }

  get canViewPrivateDetails(): boolean {
    if (!this.profile) return false;
    if (this.profile.role === 'superAdmin' || this.profile.role === 'organizationAdmin') return true;
    if (this.issue.confidential) {
      return this.profile.permissions?.includes('viewConfidentialIssues') || false;
    }
    return this.isManager || this.isAssignee;
  }

  get canViewInternalNotes(): boolean {
    if (this.profile?.role === 'student' || this.profile?.role === 'parent') return false;
    return this.isManager || this.isAssignee;
  }

  get canManageStatus(): boolean {
    return this.isManager || this.isAssignee;
  }

  get canReopen(): boolean {
    if (!this.profile) return false;
    return this.profile.permissions?.includes('reopenIssues') || false;
  }

  get canClose(): boolean {
    if (!this.profile) return false;
    return this.profile.permissions?.includes('closeIssues') || false;
  }

  // --- Interactive Actions ---
  async addNote(): Promise<void> {
    if (!this.newNoteText.trim()) return;

    try {
      this.isLoading = true;
      await this.issueService.addInternalNote(this.issue.id, this.newNoteText.trim(), this.newNoteType);
      this.newNoteText = '';
      this.snackBar.open('Internal note added.', 'Close', { duration: 3000 });
      this.loadAllTimelines();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to add note.', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  async changeStatus(newStatus: string): Promise<void> {
    let reason = '';
    if (newStatus === 'rejected' || newStatus === 'duplicate' || newStatus === 'reopened') {
      reason = prompt(`Enter reason for marking this issue as ${newStatus}:`) || '';
      if (!reason) {
        this.snackBar.open('Reason is required.', 'Close', { duration: 3000 });
        return;
      }
    }

    try {
      this.isLoading = true;
      await this.issueService.changeStatus(this.issue.id, newStatus, reason);
      this.issue.status = newStatus;
      this.snackBar.open(`Issue status updated to ${newStatus}.`, 'Close', { duration: 3000 });
      this.loadAllTimelines();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to change status.', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  async assignIssue(): Promise<void> {
    const assigneeUid = prompt('Enter assignee staff UID:') || '';
    if (!assigneeUid) return;

    const assignmentType = prompt('Enter assignment type (coordinator / incharge / staff):') as any;
    if (!['coordinator', 'incharge', 'staff'].includes(assignmentType)) {
      this.snackBar.open('Invalid assignment type.', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      await this.issueService.assignIssue(this.issue.id, assigneeUid, assignmentType, 'Assigned via Details Panel');
      this.snackBar.open('Issue assigned successfully.', 'Close', { duration: 3000 });
      this.loadAllTimelines();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Assignment failed.', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  async resolveIssue(): Promise<void> {
    const resolution = prompt('Enter resolution summary details:') || '';
    const actionTaken = prompt('Enter action taken description:') || '';

    if (!resolution || !actionTaken) {
      this.snackBar.open('Resolution and Action Taken details are required.', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      await this.issueService.resolveIssue(this.issue.id, resolution, actionTaken);
      this.issue.status = 'resolved';
      this.snackBar.open('Issue marked as resolved.', 'Close', { duration: 3000 });
      this.loadAllTimelines();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to resolve issue.', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  async closeIssue(): Promise<void> {
    const closureNotes = prompt('Enter final closure notes / evaluation details:') || '';
    if (!closureNotes) {
      this.snackBar.open('Closure notes are required.', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      await this.issueService.closeIssue(this.issue.id, closureNotes);
      this.issue.status = 'closed';
      this.snackBar.open('Issue closed successfully.', 'Close', { duration: 3000 });
      this.loadAllTimelines();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to close issue.', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  async reopenIssue(): Promise<void> {
    const reason = prompt('Enter reason for reopening:') || '';
    if (!reason) {
      this.snackBar.open('Reopen reason is required.', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      await this.issueService.reopenIssue(this.issue.id, reason);
      this.issue.status = 'reopened';
      this.snackBar.open('Issue reopened.', 'Close', { duration: 3000 });
      this.loadAllTimelines();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to reopen issue.', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
