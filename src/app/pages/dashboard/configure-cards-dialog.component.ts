import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfigureCardsDialogData {
  allCards: { label: string; icon: string; tone?: string }[];
  visibleLabels: string[];
}

@Component({
  selector: 'app-configure-cards-dialog',
  template: `
    <div class="dialog-header">
      <div class="title-group">
        <ion-icon name="grid-outline" class="header-icon"></ion-icon>
        <div>
          <h2 mat-dialog-title>Configure Dashboard Cards</h2>
          <p class="subtitle">Select which overview cards you want to display on your dashboard.</p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close type="button" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <div class="quick-actions-bar">
        <button mat-button color="primary" type="button" (click)="selectAll()">
          <ion-icon name="checkmark-done-outline" slot="start"></ion-icon>
          Select All
        </button>
        <button mat-button color="warn" type="button" (click)="deselectAll()">
          <ion-icon name="close-circle-outline" slot="start"></ion-icon>
          Deselect All
        </button>
        <button mat-button type="button" (click)="resetDefaults()">
          <ion-icon name="refresh-outline" slot="start"></ion-icon>
          Reset Defaults
        </button>
      </div>

      <div class="cards-selection-grid">
        <div 
          *ngFor="let card of data.allCards" 
          class="card-option-item"
          [class.selected]="selectedMap[card.label]"
          (click)="toggleCard(card.label)"
        >
          <mat-checkbox 
            [checked]="selectedMap[card.label]" 
            (change)="toggleCard(card.label)"
            (click)="$event.stopPropagation()"
            color="primary"
          ></mat-checkbox>

          <div class="card-option-info">
            <ion-icon [name]="card.icon" class="card-icon" [ngClass]="card.tone || 'primary'"></ion-icon>
            <span class="card-label">{{ card.label }}</span>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="getSelectedCount() === 0">
        Apply Changes ({{ getSelectedCount() }})
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px 12px;

      .title-group {
        display: flex;
        gap: 12px;
        align-items: center;

        .header-icon {
          font-size: 26px;
          color: #2563eb;
          background: #eff6ff;
          padding: 8px;
          border-radius: 12px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .subtitle {
          margin: 2px 0 0;
          font-size: 13px;
          color: #64748b;
        }
      }

      .close-btn {
        margin: -8px -8px 0 0;
      }
    }

    .dialog-content {
      padding: 12px 24px 20px !important;
      max-height: 65vh;
      overflow-y: auto;
    }

    .quick-actions-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      flex-wrap: wrap;

      button {
        font-size: 12px;
        font-weight: 700;
      }
    }

    .cards-selection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }

    .card-option-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      &.selected {
        border-color: #2563eb;
        background: #f0f6ff;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
      }

      .card-option-info {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;

        .card-icon {
          font-size: 20px;

          &.primary { color: #2563eb; }
          &.success { color: #16a34a; }
          &.warning { color: #ea580c; }
          &.danger { color: #dc2626; }
          &.purple { color: #9333ea; }
        }

        .card-label {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }
      }
    }

    .dialog-actions {
      padding: 12px 24px 20px;
      border-top: 1px solid #f1f5f9;
    }

    @media (max-width: 480px) {
      .cards-selection-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  standalone: false,
})
export class ConfigureCardsDialogComponent {
  selectedMap: Record<string, boolean> = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfigureCardsDialogData,
    private readonly dialogRef: MatDialogRef<ConfigureCardsDialogComponent>
  ) {
    this.initSelectedMap();
  }

  private initSelectedMap(): void {
    const visibleSet = new Set(this.data.visibleLabels || []);
    this.data.allCards.forEach(card => {
      this.selectedMap[card.label] = visibleSet.has(card.label);
    });
  }

  toggleCard(label: string): void {
    this.selectedMap[label] = !this.selectedMap[label];
  }

  selectAll(): void {
    this.data.allCards.forEach(card => {
      this.selectedMap[card.label] = true;
    });
  }

  deselectAll(): void {
    this.data.allCards.forEach(card => {
      this.selectedMap[card.label] = false;
    });
  }

  resetDefaults(): void {
    this.selectAll();
  }

  getSelectedCount(): number {
    return Object.values(this.selectedMap).filter(Boolean).length;
  }

  save(): void {
    const selectedLabels = Object.keys(this.selectedMap).filter(key => this.selectedMap[key]);
    this.dialogRef.close(selectedLabels);
  }
}
