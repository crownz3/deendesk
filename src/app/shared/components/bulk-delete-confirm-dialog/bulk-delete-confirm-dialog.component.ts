import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CollectionOption } from '../../../core/services/data-management.service';

export interface BulkDeleteConfirmDialogData {
  selectedOptions: CollectionOption[];
}

@Component({
  selector: 'app-bulk-delete-confirm-dialog',
  standalone: false,
  template: `
    <div class="confirm-dialog">
      <div class="confirm-header">
        <div class="danger-icon-wrap">
          <ion-icon name="warning-outline"></ion-icon>
        </div>
        <div>
          <h2>Confirm Bulk Deletion</h2>
          <p class="subtitle">This action is permanent and cannot be undone.</p>
        </div>
      </div>

      <div class="collections-list">
        <p class="list-label">You are about to delete:</p>
        <div class="chip-row">
          <span class="collection-chip" *ngFor="let opt of data.selectedOptions">
            <ion-icon [name]="opt.icon"></ion-icon>
            {{ opt.label }}
            <span class="auth-badge" *ngIf="opt.authLinked" title="Firebase Auth accounts will also be deleted">🔑 Auth</span>
          </span>
        </div>
      </div>

      <div class="confirm-input-section">
        <p class="type-prompt">To continue, type <strong>DELETE</strong> below:</p>
        <mat-form-field appearance="outline" class="confirm-field">
          <mat-label>Type DELETE to confirm</mat-label>
          <input
            matInput
            [(ngModel)]="confirmText"
            (input)="onInput()"
            [class.input-valid]="isConfirmed"
            autocomplete="off"
            spellcheck="false"
            id="bulk-delete-confirm-input"
          />
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-stroked-button class="cancel-btn" (click)="cancel()" id="bulk-delete-cancel-btn">
          Cancel
        </button>
        <button
          mat-raised-button
          class="delete-btn"
          [disabled]="!isConfirmed"
          (click)="confirm()"
          id="bulk-delete-confirm-btn"
        >
          <ion-icon name="trash-outline" slot="start"></ion-icon>
          Delete {{ data.selectedOptions.length }} Collection{{ data.selectedOptions.length > 1 ? 's' : '' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 0;
      min-width: 480px;
      max-width: 580px;
    }

    .confirm-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 28px 28px 20px;
      border-bottom: 1px solid var(--app-border, #e5e7eb);
      background: linear-gradient(135deg, rgba(239,68,68,0.04) 0%, rgba(220,38,38,0.02) 100%);
    }

    .danger-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.12);
      border: 2px solid rgba(239, 68, 68, 0.3);
      flex-shrink: 0;
      ion-icon {
        font-size: 26px;
        color: #dc2626;
      }
    }

    h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 800;
      color: var(--app-text-main, #111827);
    }

    .subtitle {
      margin: 0;
      font-size: 13px;
      color: #dc2626;
      font-weight: 600;
    }

    .collections-list {
      padding: 20px 28px;
    }

    .list-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--app-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px;
    }

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .collection-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 6px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      font-size: 13px;
      font-weight: 600;
      color: #dc2626;

      ion-icon {
        font-size: 14px;
      }
    }

    .auth-badge {
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid rgba(234, 179, 8, 0.4);
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 10px;
      font-weight: 700;
      color: #92400e;
      margin-left: 2px;
    }

    .confirm-input-section {
      padding: 0 28px 20px;
    }

    .type-prompt {
      margin: 0 0 12px;
      font-size: 14px;
      color: var(--app-text-main, #111827);

      strong {
        font-family: monospace;
        font-size: 15px;
        color: #dc2626;
        background: rgba(239, 68, 68, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .confirm-field {
      width: 100%;
    }

    .confirm-field.mat-mdc-form-field .mdc-notched-outline__leading,
    .confirm-field.mat-mdc-form-field .mdc-notched-outline__notch,
    .confirm-field.mat-mdc-form-field .mdc-notched-outline__trailing {
      border-color: var(--app-border, #e5e7eb);
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 28px 24px;
      border-top: 1px solid var(--app-border, #e5e7eb);
    }

    .cancel-btn {
      font-weight: 600;
    }

    .delete-btn {
      background: #dc2626 !important;
      color: white !important;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;

      ion-icon {
        font-size: 16px;
      }

      &:disabled {
        background: rgba(220, 38, 38, 0.3) !important;
        color: rgba(255,255,255,0.5) !important;
        cursor: not-allowed;
      }
    }

    @media (max-width: 560px) {
      .confirm-dialog { min-width: unset; }
    }
  `]
})
export class BulkDeleteConfirmDialogComponent {
  confirmText = '';
  isConfirmed = false;

  constructor(
    public readonly dialogRef: MatDialogRef<BulkDeleteConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: BulkDeleteConfirmDialogData,
  ) {}

  onInput(): void {
    this.isConfirmed = this.confirmText.trim() === 'DELETE';
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    if (this.isConfirmed) {
      this.dialogRef.close(true);
    }
  }
}
