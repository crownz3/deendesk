import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QuranService, ReciterMeta } from '../../core/services/quran.service';
import { QuranAudioService } from '../../core/services/quran-audio.service';

@Component({
  selector: 'app-reciter-select-dialog',
  standalone: false,
  template: `
    <div class="reciter-dialog-header">
      <div class="header-title">
        <div class="header-icon-badge">
          <ion-icon name="mic-outline"></ion-icon>
        </div>
        <div>
          <h2>Select Reciter</h2>
          <p class="subtitle">Choose your preferred reciter for Quran audio recitations</p>
        </div>
      </div>
      <button mat-icon-button (click)="close()" class="close-btn" aria-label="Close">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="reciter-dialog-content">
      <div class="reciter-grid">
        <div 
          *ngFor="let r of reciters" 
          class="reciter-card"
          [class.selected]="r.id === activeReciterId"
          (click)="selectReciter(r)"
        >
          <img [src]="r.image" [alt]="r.name" class="reciter-avatar" (error)="onImgError($event)" />
          
          <div class="reciter-info">
            <span class="reciter-name">{{ r.name }}</span>
          </div>

          <div class="selected-badge" *ngIf="r.id === activeReciterId">
            <ion-icon name="checkmark-circle"></ion-icon>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="reciter-dialog-actions">
      <button mat-button (click)="close()" class="cancel-btn">Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      border-radius: 20px;
      overflow: hidden;
    }

    .reciter-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--app-border-color, #e2e8f0);
      background: var(--app-surface-card, #ffffff);

      .header-title {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(13, 148, 136, 0.1);
          color: var(--app-primary, #0d9488);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        h2 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--app-text-main, #0f172a);
          line-height: 1.2;
        }

        .subtitle {
          margin: 2px 0 0 0;
          font-size: 0.82rem;
          color: var(--app-text-muted, #64748b);
        }
      }

      .close-btn {
        color: var(--app-text-muted, #94a3b8);
        ion-icon {
          font-size: 22px;
        }
      }
    }

    .reciter-dialog-content {
      padding: 20px 24px !important;
      max-height: 65vh;
      overflow-x: hidden !important;
      overflow-y: auto;
      background: var(--app-bg, #f8fafc);
      margin: 0 !important;
    }

    .reciter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    .reciter-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--app-border-color, #e2e8f0);
      background: var(--app-surface-card, #ffffff);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;

      &:hover {
        border-color: var(--app-primary, #0d9488);
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
      }

      &.selected {
        border-color: var(--app-primary, #0d9488);
        border-width: 2px;
        background: var(--app-primary-light, rgba(13, 148, 136, 0.06));
        box-shadow: 0 4px 14px rgba(13, 148, 136, 0.12);
      }

      .reciter-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--app-primary, #0d9488);
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      .reciter-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0; // prevents flex item overflow

        .reciter-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--app-text-main, #0f172a);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .quality-tag {
          display: inline-block;
          margin-top: 3px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--app-primary, #0d9488);
          background: rgba(13, 148, 136, 0.08);
          padding: 2px 8px;
          border-radius: 6px;
          width: fit-content;
        }
      }

      .selected-badge {
        color: var(--app-primary, #0d9488);
        font-size: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
    }

    .reciter-dialog-actions {
      padding: 12px 24px;
      border-top: 1px solid var(--app-border-color, #e2e8f0);
      background: var(--app-surface-card, #ffffff);
      margin: 0 !important;

      .cancel-btn {
        font-weight: 600;
        color: var(--app-text-muted, #64748b);
      }
    }
  `]
})
export class ReciterSelectDialogComponent {
  reciters: ReciterMeta[] = [];
  activeReciterId: string = '';

  constructor(
    private dialogRef: MatDialogRef<ReciterSelectDialogComponent>,
    private quranService: QuranService,
    private quranAudioService: QuranAudioService,
    @Inject(MAT_DIALOG_DATA) public data: { currentReciterId: string }
  ) {
    this.reciters = this.quranService.getReciters();
    this.activeReciterId = data?.currentReciterId || this.reciters[0]?.id;
  }

  selectReciter(reciter: ReciterMeta): void {
    this.quranAudioService.setReciter(reciter);
    this.dialogRef.close(reciter);
  }

  close(): void {
    this.dialogRef.close();
  }

  onImgError(event: any): void {
    event.target.src = 'assets/quran-data/reciters/mishary.jpg';
  }

  getAudioQualityLabel(folder: string): string {
    if (!folder) return 'Studio Audio';
    if (folder.includes('192kbps')) return '192 kbps HD Audio';
    if (folder.includes('128kbps')) return '128 kbps Audio';
    if (folder.includes('64kbps')) return '64 kbps Audio';
    if (folder.includes('40kbps')) return '40 kbps Audio';
    return 'High Quality Audio';
  }
}
