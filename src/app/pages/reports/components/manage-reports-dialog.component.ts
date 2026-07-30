import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SavedReportTemplate } from '../../../core/models/report.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

export interface ManageReportResult {
  action: 'rename' | 'update' | 'delete';
  reportId: string;
  newName?: string;
}

@Component({
  selector: 'app-manage-reports-dialog',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Manage Custom Reports</h2>
    <mat-dialog-content>
      <div *ngIf="!data.reports || data.reports.length === 0" style="padding: 24px; text-align: center; color: #64748b;">
        No saved custom reports found for your organization.
      </div>

      <div *ngIf="data.reports && data.reports.length > 0" style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px; max-height: 420px; overflow-y: auto;">
        <div *ngFor="let report of data.reports" 
             style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          
          <!-- Normal Display Mode -->
          <div *ngIf="editingReportId !== report.id" style="flex: 1; margin-right: 12px;">
            <div style="font-weight: 600; font-size: 14px; color: #0f172a;">{{ report.name }}</div>
            <div style="font-size: 12px; color: #64748b;" *ngIf="report.description">{{ report.description }}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              Category: {{ (report.category || 'general') | titlecase }} • {{ (report.columns || []).length }} columns
            </div>
          </div>

          <!-- Inline Rename Edit Mode -->
          <div *ngIf="editingReportId === report.id" style="flex: 1; margin-right: 12px; display: flex; align-items: center; gap: 8px;">
            <mat-form-field appearance="outline" style="flex: 1; margin-bottom: -1.25em;">
              <mat-label>Report Name</mat-label>
              <input matInput [(ngModel)]="editName" (keyup.enter)="saveRename(report)" (keyup.escape)="cancelRename()">
            </mat-form-field>
            <button mat-icon-button color="primary" (click)="saveRename(report)" matTooltip="Save Name">
              <mat-icon>check</mat-icon>
            </button>
            <button mat-icon-button (click)="cancelRename()" matTooltip="Cancel">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Action Buttons -->
          <div *ngIf="editingReportId !== report.id" style="display: flex; gap: 4px;">
            <button mat-icon-button color="primary" matTooltip="Rename Report" (click)="startRename(report)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="accent" matTooltip="Update with current columns & filters" (click)="updateConfig(report)">
              <mat-icon>save_as</mat-icon>
            </button>
            <button mat-icon-button color="warn" matTooltip="Delete Custom Report" (click)="deleteReport(report)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .mat-dialog-content {
      padding-top: 0;
    }
  `]
})
export class ManageReportsDialogComponent {
  public editingReportId: string | null | undefined = null;
  public editName = '';

  constructor(
    public dialogRef: MatDialogRef<ManageReportsDialogComponent>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: { reports: SavedReportTemplate[] }
  ) {}

  startRename(report: SavedReportTemplate) {
    this.editingReportId = report.id || null;
    this.editName = report.name;
  }

  cancelRename() {
    this.editingReportId = null;
    this.editName = '';
  }

  saveRename(report: SavedReportTemplate) {
    if (this.editName && this.editName.trim() && this.editName.trim() !== report.name) {
      this.dialogRef.close({ action: 'rename', reportId: report.id || '', newName: this.editName.trim() } as ManageReportResult);
    } else {
      this.cancelRename();
    }
  }

  updateConfig(report: SavedReportTemplate) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Update Custom Report',
        message: `Are you sure you want to update "${report.name}" with the currently active columns and filters?`,
        confirmLabel: 'Update Report',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.dialogRef.close({ action: 'update', reportId: report.id || '' } as ManageReportResult);
      }
    });
  }

  deleteReport(report: SavedReportTemplate) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Custom Report',
        message: `Are you sure you want to permanently delete "${report.name}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.dialogRef.close({ action: 'delete', reportId: report.id || '' } as ManageReportResult);
      }
    });
  }
}
