import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface StudentAttendanceHistoryRecord {
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  note?: string;
  periodName?: string;
  recordedByName?: string;
}

export interface StudentAttendanceHistoryDialogData {
  studentName: string;
  admissionNo?: string;
  parentPhone?: string;
  groupName?: string;
  records: StudentAttendanceHistoryRecord[];
}

@Component({
  selector: 'app-student-attendance-history-dialog',
  standalone: false,
  template: `
    <div class="hist-dialog">

      <!-- Header -->
      <div class="hist-header">
        <div class="hist-header-info">
          <div class="hist-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="hist-title-block">
            <h2 class="hist-name">{{ data.studentName }}</h2>
            <div class="hist-meta-row">
              <span class="hist-meta-chip" *ngIf="data.admissionNo">
                <mat-icon>tag</mat-icon> {{ data.admissionNo }}
              </span>
              <span class="hist-meta-chip phone" *ngIf="data.parentPhone">
                <mat-icon>phone</mat-icon> {{ data.parentPhone }}
              </span>
            </div>
          </div>
        </div>
        <button mat-icon-button type="button" class="hist-close" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Stats Row -->
      <div class="hist-stats-row">
        <div class="stat-chip total">
          <span class="sc-num">{{ totalCount }}</span>
          <span class="sc-lbl">Total Days</span>
        </div>
        <div class="stat-chip present">
          <span class="sc-num">{{ effectivePresent }}</span>
          <span class="sc-lbl">Attended</span>
          <span class="sc-sub">Present + Late</span>
        </div>
        <div class="stat-chip absent">
          <span class="sc-num">{{ absentCount }}</span>
          <span class="sc-lbl">Absent</span>
        </div>
        <div class="stat-chip late">
          <span class="sc-num">{{ lateCount }}</span>
          <span class="sc-lbl">Late</span>
          <span class="sc-sub">counted present</span>
        </div>
        <div class="stat-chip leave">
          <span class="sc-num">{{ leaveCount }}</span>
          <span class="sc-lbl">Leave</span>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="hist-filter-tabs">
        <button type="button" class="ftab" [class.active]="selectedFilter === 'all'" (click)="selectedFilter = 'all'">
          All <span class="ftab-badge">{{ totalCount }}</span>
        </button>
        <button type="button" class="ftab present" [class.active]="selectedFilter === 'present'" (click)="selectedFilter = 'present'">
          Present <span class="ftab-badge">{{ presentCount }}</span>
        </button>
        <button type="button" class="ftab absent" [class.active]="selectedFilter === 'absent'" (click)="selectedFilter = 'absent'">
          Absent <span class="ftab-badge">{{ absentCount }}</span>
        </button>
        <button type="button" class="ftab late" [class.active]="selectedFilter === 'late'" (click)="selectedFilter = 'late'">
          Late <span class="ftab-badge">{{ lateCount }}</span>
        </button>
        <button type="button" class="ftab leave" [class.active]="selectedFilter === 'leave'" (click)="selectedFilter = 'leave'">
          Leave <span class="ftab-badge">{{ leaveCount }}</span>
        </button>
      </div>

      <!-- Records List -->
      <div class="hist-body">

        <!-- Empty State -->
        <div class="hist-empty" *ngIf="filteredRecords.length === 0">
          <mat-icon>event_busy</mat-icon>
          <p>No records found for this filter.</p>
        </div>

        <!-- Record Cards -->
        <div class="rec-card" *ngFor="let rec of filteredRecords; let i = index"
             [class.present]="rec.status === 'present'"
             [class.absent]="rec.status === 'absent'"
             [class.late]="rec.status === 'late'"
             [class.leave]="rec.status === 'leave'">

          <div class="rec-left">
            <span class="rec-index">{{ i + 1 }}</span>
            <div class="rec-status-dot" [class]="rec.status"></div>
          </div>

          <div class="rec-main">
            <div class="rec-top-row">
              <span class="rec-date">{{ formatDateDisplay(rec.date) }}</span>
              <span class="status-badge" [class]="rec.status">
                <mat-icon class="badge-ico" *ngIf="rec.status === 'present'">check_circle</mat-icon>
                <mat-icon class="badge-ico" *ngIf="rec.status === 'absent'">cancel</mat-icon>
                <mat-icon class="badge-ico" *ngIf="rec.status === 'late'">schedule</mat-icon>
                <mat-icon class="badge-ico" *ngIf="rec.status === 'leave'">event_busy</mat-icon>
                {{ rec.status | uppercase }}
              </span>
            </div>
            <div class="rec-bottom-row">
              <span class="rec-period" *ngIf="rec.periodName">{{ rec.periodName }}</span>
              <span class="rec-note" *ngIf="rec.note">{{ rec.note }}</span>
              <span class="rec-by" *ngIf="rec.recordedByName">By {{ rec.recordedByName }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="hist-footer">
        <span class="hist-rate">Attendance Rate: <strong>{{ overallPct }}%</strong> <span class="rate-note">(Present + Late / Total)</span></span>
        <button type="button" class="hist-close-btn" (click)="dialogRef.close()">Close</button>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: Roboto, 'Helvetica Neue', sans-serif;
    }

    .hist-dialog {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
    }

    /* ---- Header ---- */
    .hist-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      flex-shrink: 0;
    }

    .hist-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .hist-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #eff6ff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        color: #3b82f6;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .hist-title-block {
      min-width: 0;

      .hist-name {
        font-size: 1rem;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 220px;
      }
    }

    .hist-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 3px;
    }

    .hist-meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.72rem;
      color: #64748b;

      mat-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }

      &.phone {
        color: #2563eb;
        font-weight: 600;
      }
    }

    .hist-close {
      color: #94a3b8;
      flex-shrink: 0;
      &:hover { color: #1e293b; }
    }

    /* ---- Stats Row ---- */
    .hist-stats-row {
      display: flex;
      gap: 6px;
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;

      .stat-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 12px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #fff;
        min-width: 54px;
        flex-shrink: 0;

        .sc-num {
          font-size: 1.1rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .sc-lbl {
          font-size: 0.65rem;
          color: #64748b;
          margin-top: 1px;
        }

        &.total   { .sc-num { color: #0f172a; } }
        &.present { background: #f0fdf4; border-color: #86efac; .sc-num { color: #16a34a; } }
        &.absent  { background: #fef2f2; border-color: #fca5a5; .sc-num { color: #dc2626; } }
        &.late    { background: #fffbeb; border-color: #fcd34d; .sc-num { color: #d97706; } }
        &.leave   { background: #eff6ff; border-color: #93c5fd; .sc-num { color: #2563eb; } }
      }
    }

    /* ---- Filter Tabs ---- */
    .hist-filter-tabs {
      display: flex;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: #fff;
      border-bottom: 2px solid #e2e8f0;
      flex-shrink: 0;
      padding: 0 6px;
      gap: 2px;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }

      .ftab {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 10px 12px;
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
        font-size: 0.8rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;

        .ftab-badge {
          background: #e2e8f0;
          color: #475569;
          border-radius: 10px;
          padding: 1px 6px;
          font-size: 0.7rem;
          font-weight: 700;
        }

        &.active {
          color: #0f172a;
          border-bottom-color: #0f172a;

          .ftab-badge { background: #0f172a; color: #fff; }
        }

        &.present.active { color: #16a34a; border-bottom-color: #16a34a; .ftab-badge { background: #16a34a; } }
        &.absent.active  { color: #dc2626; border-bottom-color: #dc2626; .ftab-badge { background: #dc2626; } }
        &.late.active    { color: #d97706; border-bottom-color: #d97706; .ftab-badge { background: #d97706; } }
        &.leave.active   { color: #2563eb; border-bottom-color: #2563eb; .ftab-badge { background: #2563eb; } }
      }
    }

    /* ---- Body / Scroll Area ---- */
    .hist-body {
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      background: #f8fafc;
      -webkit-overflow-scrolling: touch;
    }

    /* ---- Empty State ---- */
    .hist-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: #94a3b8;
      text-align: center;
      gap: 8px;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
      }
    }

    /* ---- Record Cards ---- */
    .rec-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #fff;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 8px;
      border-left: 3px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);

      &.present { border-left-color: #16a34a; }
      &.absent  { border-left-color: #dc2626; }
      &.late    { border-left-color: #d97706; }
      &.leave   { border-left-color: #2563eb; }
    }

    .rec-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;

      .rec-index {
        font-size: 0.7rem;
        color: #94a3b8;
        font-weight: 600;
        width: 18px;
        text-align: center;
      }

      .rec-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.present { background: #16a34a; }
        &.absent  { background: #dc2626; }
        &.late    { background: #d97706; }
        &.leave   { background: #2563eb; }
      }
    }

    .rec-main {
      flex: 1;
      min-width: 0;
    }

    .rec-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;

      .rec-date {
        font-size: 0.83rem;
        font-weight: 600;
        color: #0f172a;
      }
    }

    .rec-bottom-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;

      .rec-period {
        font-size: 0.72rem;
        color: #475569;
        background: #f1f5f9;
        padding: 1px 7px;
        border-radius: 6px;
      }

      .rec-note {
        font-size: 0.72rem;
        color: #475569;
        font-style: italic;
      }

      .rec-by {
        font-size: 0.68rem;
        color: #94a3b8;
        margin-left: auto;
      }
    }

    /* ---- Status Badge ---- */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.68rem;
      font-weight: 700;

      .badge-ico {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }

      &.present { background: #dcfce7; color: #15803d; }
      &.absent  { background: #fee2e2; color: #b91c1c; }
      &.late    { background: #fef3c7; color: #b45309; }
      &.leave   { background: #dbeafe; color: #1d4ed8; }
    }

    /* ---- Footer ---- */
    .hist-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: #fff;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;

      .hist-rate {
        font-size: 0.83rem;
        color: #475569;
        strong { color: #16a34a; }
      }

      .hist-close-btn {
        padding: 7px 18px;
        border-radius: 8px;
        border: none;
        background: #1e293b;
        color: #fff;
        font-weight: 600;
        font-size: 0.83rem;
        cursor: pointer;
        &:hover { background: #334155; }
      }
    }
  `]
})
export class StudentAttendanceHistoryDialogComponent implements OnInit {
  selectedFilter: 'all' | 'present' | 'absent' | 'late' | 'leave' = 'all';

  totalCount = 0;
  presentCount = 0;
  absentCount = 0;
  lateCount = 0;
  leaveCount = 0;
  effectivePresent = 0;
  overallPct = 100;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentAttendanceHistoryDialogData,
    public dialogRef: MatDialogRef<StudentAttendanceHistoryDialogComponent>
  ) {}

  ngOnInit(): void {
    this.calculateSummaryStats();
  }

  calculateSummaryStats(): void {
    const recs = this.data.records || [];
    this.totalCount = recs.length;
    this.presentCount = recs.filter(r => r.status === 'present').length;
    this.absentCount = recs.filter(r => r.status === 'absent').length;
    this.lateCount = recs.filter(r => r.status === 'late').length;
    this.leaveCount = recs.filter(r => r.status === 'leave').length;

    const ep = this.presentCount + this.lateCount;
    this.effectivePresent = ep;
    this.overallPct = this.totalCount > 0 ? Math.round((ep / this.totalCount) * 100) : 0;
  }

  getPct(count: number): number {
    if (this.totalCount === 0) return 0;
    return Math.round((count / this.totalCount) * 100);
  }

  get filteredRecords(): StudentAttendanceHistoryRecord[] {
    const recs = this.data.records || [];
    if (this.selectedFilter === 'all') return recs;
    return recs.filter(r => r.status === this.selectedFilter);
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }
}
