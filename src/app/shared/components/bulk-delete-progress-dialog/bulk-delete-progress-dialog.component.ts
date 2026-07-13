import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CollectionOption,
  BulkDeletionSummary,
  DataManagementService,
} from '../../../core/services/data-management.service';

export interface BulkDeleteProgressDialogData {
  selectedOptions: CollectionOption[];
}

export type ProgressState = 'running' | 'done' | 'error';

@Component({
  selector: 'app-bulk-delete-progress-dialog',
  standalone: false,
  templateUrl: './bulk-delete-progress-dialog.component.html',
  styleUrl: './bulk-delete-progress-dialog.component.scss',
})
export class BulkDeleteProgressDialogComponent implements OnDestroy {

  state: ProgressState = 'running';
  progressPercent = 0;
  completedCount = 0;
  currentCollection = '';
  runningDocsDeleted = 0;
  runningAuthDeleted = 0;
  summary: BulkDeletionSummary | null = null;
  errorMessage = '';
  failedCollections: string[] = [];

  constructor(
    public readonly dialogRef: MatDialogRef<BulkDeleteProgressDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: BulkDeleteProgressDialogData,
    private readonly dataMgmt: DataManagementService,
  ) {
    // Prevent backdrop / ESC close while deletion is running
    this.dialogRef.disableClose = true;
    this.startDeletion();
  }

  ngOnDestroy(): void {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  close(): void {
    if (this.state !== 'running') {
      this.dialogRef.close(this.summary);
    }
  }

  // ── Core deletion logic ────────────────────────────────────────────────────

  private async startDeletion(): Promise<void> {
    const total = this.data.selectedOptions.length;
    const keys  = this.data.selectedOptions.map(o => o.key);

    // Animate progress locally while the Cloud Function runs server-side
    const STEP_MS = 800;
    const animInterval = setInterval(() => {
      if (this.completedCount < total - 1 && this.state === 'running') {
        this.completedCount++;
        this.currentCollection =
          this.data.selectedOptions[this.completedCount - 1]?.label || '';
        // Cap at 85 % until we get the real result
        this.progressPercent = Math.round((this.completedCount / total) * 85);
      }
    }, STEP_MS);

    try {
      this.currentCollection =
        this.data.selectedOptions[0]?.label || 'Preparing…';

      const result = await this.dataMgmt.bulkDelete(keys);

      clearInterval(animInterval);

      this.runningDocsDeleted = result.totalDocs;
      this.runningAuthDeleted = result.totalAuth;
      this.completedCount     = total;
      this.progressPercent    = 100;
      this.summary            = result;
      this.failedCollections  = Object.entries(result.results)
        .filter(([, r]) => r.failed > 0)
        .map(([k]) => k);

      this.state = 'done';
      this.dialogRef.disableClose = false;

    } catch (err: any) {
      clearInterval(animInterval);
      this.state        = 'error';
      this.errorMessage =
        err?.message || err?.details || 'An unexpected error occurred during deletion.';
      this.dialogRef.disableClose = false;
    }
  }
}
