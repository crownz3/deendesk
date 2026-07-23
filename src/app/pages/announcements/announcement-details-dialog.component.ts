import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Announcement } from '../../core/models/domain.model';
import { AnnouncementService } from '../../core/services/announcement.service';

@Component({
  selector: 'app-announcement-details-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">campaign</mat-icon>
      {{ data.announcement.title }}
      <button mat-icon-button class="close-btn" mat-dialog-close><mat-icon>close</mat-icon></button>
    </h2>

    <mat-dialog-content class="dialog-content">
      <div class="meta-banner">
        <div class="meta-item">
          <span>Target Audience:</span>
          <strong>{{ announcementService.getScopeLabel(data.announcement.targetScope) }}</strong>
        </div>
        <div class="meta-item">
          <span>Priority Level:</span>
          <span class="priority-badge" [ngClass]="data.announcement.priority">
            {{ data.announcement.priority | uppercase }}
          </span>
        </div>
        <div class="meta-item" *ngIf="data.announcement.publishedByName">
          <span>Published By:</span>
          <strong>{{ data.announcement.publishedByName }}</strong>
        </div>
      </div>

      <div class="madrasa-scope-row" *ngIf="data.announcement.targetMadrasaNames?.length">
        <mat-icon>school</mat-icon>
        <span>Applicable Madrasas: <strong>{{ data.announcement.targetMadrasaNames?.join(', ') }}</strong></span>
      </div>

      <div class="content-box">
        <p class="full-content">{{ data.announcement.content }}</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: bold; }
    .close-btn { margin-left: auto; }
    .dialog-content { max-height: 75vh; overflow-y: auto; padding-top: 8px; }

    .meta-banner {
      display: flex; flex-wrap: wrap; gap: 16px; background: #f8f9fa; border: 1px solid #e9ecef;
      padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;
      .meta-item {
        display: flex; align-items: center; gap: 6px;
        span { color: #666; }
        .priority-badge {
          font-weight: bold; padding: 2px 8px; border-radius: 12px; font-size: 11px;
          &.urgent { background: #ffebee; color: #c62828; }
          &.important { background: #fff8e1; color: #f57f17; }
          &.normal { background: #e3f2fd; color: #1565c0; }
        }
      }
    }

    .madrasa-scope-row {
      display: flex; align-items: center; gap: 8px; background: #e8f5e9; color: #2e7d32;
      padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px;
    }

    .content-box {
      background: white; border: 1px solid #ddd; padding: 20px; border-radius: 8px;
      .full-content { font-size: 15px; line-height: 1.6; color: #222; margin: 0; white-space: pre-wrap; }
    }
  `],
  standalone: false
})
export class AnnouncementDetailsDialogComponent {
  constructor(
    public announcementService: AnnouncementService,
    private dialogRef: MatDialogRef<AnnouncementDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { announcement: Announcement }
  ) {}
}
