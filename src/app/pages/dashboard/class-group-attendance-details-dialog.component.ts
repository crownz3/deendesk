import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

export interface StudentAttendanceDetailRecord {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'unmarked';
  note?: string;
  parentPhone?: string;
}

export interface ClassGroupAttendanceDetailsDialogData {
  groupName: string;
  madrasaName: string;
  className?: string;
  dateStr: string;
  takenByName?: string;
  takenAtText?: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  totalStudents: number;
  studentRecords: StudentAttendanceDetailRecord[];
  groupId: string;
  madrasaId?: string;
  classId?: string;
}

@Component({
  selector: 'app-class-group-attendance-details-dialog',
  template: `
    <div class="dialog-header">
      <div class="header-left">
        <div class="group-icon-avatar">
          <ion-icon name="people"></ion-icon>
        </div>
        <div>
          <h2 mat-dialog-title>{{ data.groupName }}</h2>
          <p class="subtitle">
            <span>{{ data.madrasaName }}</span>
            <span *ngIf="data.className"> &bull; {{ data.className }}</span>
            <span> &bull; <strong>{{ data.dateStr }}</strong></span>
          </p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close type="button" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <!-- Attendance Taken Info Bar -->
      <div class="taken-info-bar" *ngIf="data.takenByName">
        <span class="taken-by">
          <mat-icon>check_circle</mat-icon> Taken by <strong>{{ data.takenByName }}</strong>
        </span>
        <span class="taken-time" *ngIf="data.takenAtText">
          <mat-icon>schedule</mat-icon> {{ data.takenAtText }}
        </span>
      </div>

      <!-- Stats Metric Badges -->
      <div class="metrics-grid">
        <div class="metric-box present">
          <span class="value">{{ data.presentCount }}</span>
          <span class="label">Present</span>
        </div>
        <div class="metric-box absent">
          <span class="value">{{ data.absentCount }}</span>
          <span class="label">Absent</span>
        </div>
        <div class="metric-box late">
          <span class="value">{{ data.lateCount }}</span>
          <span class="label">Late</span>
        </div>
        <div class="metric-box leave">
          <span class="value">{{ data.leaveCount }}</span>
          <span class="label">Leave</span>
        </div>
        <div class="metric-box total">
          <span class="value">{{ data.totalStudents }}</span>
          <span class="label">Total</span>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-wrap" *ngIf="data.studentRecords && data.studentRecords.length > 0">
        <mat-icon class="search-icon">search</mat-icon>
        <input type="text" [(ngModel)]="searchQuery" placeholder="Search student name or roll number..." class="search-input" />
      </div>

      <!-- Student Records List -->
      <div class="students-list-container">
        <div class="student-row" *ngFor="let st of filteredStudents; let i = index">
          <div class="st-info">
            <span class="st-index">{{ i + 1 }}.</span>
            <div>
              <h4 class="st-name">{{ st.studentName }}</h4>
              <span class="st-meta">
                <span class="st-roll" *ngIf="st.rollNumber">Roll: {{ st.rollNumber }}</span>
                <span class="st-phone" *ngIf="st.parentPhone"> &bull; {{ st.parentPhone }}</span>
              </span>
            </div>
          </div>

          <div class="st-status-side">
            <span class="status-badge" [ngClass]="st.status">
              {{ formatStatusLabel(st.status) }}
            </span>
            <span class="st-note" *ngIf="st.note" [title]="st.note">
              <mat-icon>note</mat-icon> {{ st.note }}
            </span>
          </div>
        </div>

        <div class="empty-list" *ngIf="filteredStudents.length === 0">
          <mat-icon class="empty-icon">info</mat-icon>
          <p>{{ searchQuery ? 'No student records match your search query.' : 'No detailed student records found for this group.' }}</p>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close type="button">Close</button>
      <button mat-raised-button color="primary" type="button" (click)="navigateToEdit()">
        <mat-icon>edit</mat-icon> Edit Attendance
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .group-icon-avatar {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .group-icon-avatar ion-icon {
      font-size: 22px;
    }
    .subtitle {
      margin: 2px 0 0;
      font-size: 0.82rem;
      color: #64748b;
    }
    h2[mat-dialog-title] {
      margin: 0;
      font-size: 1.18rem;
      font-weight: 700;
      color: #0f172a;
    }
    .close-btn {
      color: #64748b;
    }
    .dialog-content {
      padding: 16px 20px !important;
      max-height: 68vh;
    }
    .taken-info-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      font-size: 0.82rem;
      color: #166534;
      margin-bottom: 14px;
    }
    .taken-info-bar mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      vertical-align: middle;
      color: #10b981;
    }
    .taken-time {
      color: #475569;
    }
    .taken-time mat-icon {
      color: #64748b;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .metric-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .metric-box .value {
      font-size: 1.15rem;
      font-weight: 800;
    }
    .metric-box .label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .metric-box.present { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    .metric-box.absent { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
    .metric-box.late { background: #fffbe6; border-color: #fef08a; color: #b45309; }
    .metric-box.leave { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
    .metric-box.total { background: #f8fafc; border-color: #cbd5e1; color: #334155; }
    
    .search-wrap {
      position: relative;
      margin-bottom: 12px;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .search-input {
      width: 100%;
      padding: 8px 12px 8px 36px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.85rem;
      outline: none;
      box-sizing: border-box;
    }
    .search-input:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    }
    .students-list-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .student-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 8px;
      background: white;
      border: 1px solid #e2e8f0;
    }
    .st-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .st-index {
      font-weight: 700;
      color: #94a3b8;
      font-size: 0.8rem;
      min-width: 20px;
    }
    .st-name {
      margin: 0;
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
    }
    .st-meta {
      font-size: 0.76rem;
      color: #64748b;
    }
    .st-status-side {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .status-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-badge.present { background: #d1fae5; color: #065f46; }
    .status-badge.absent { background: #fee2e2; color: #991b1b; }
    .status-badge.late { background: #fef3c7; color: #92400e; }
    .status-badge.leave { background: #dbeafe; color: #1e40af; }
    .status-badge.unmarked { background: #f1f5f9; color: #64748b; }
    .st-note {
      font-size: 0.72rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .st-note mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .dialog-actions {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      gap: 8px;
    }
    .empty-list {
      text-align: center;
      padding: 20px;
      color: #64748b;
      font-size: 0.85rem;
    }
    .empty-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #94a3b8;
    }
  `]
})
export class ClassGroupAttendanceDetailsDialogComponent {
  searchQuery = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ClassGroupAttendanceDetailsDialogData,
    private dialogRef: MatDialogRef<ClassGroupAttendanceDetailsDialogComponent>,
    private router: Router
  ) {}

  get filteredStudents(): StudentAttendanceDetailRecord[] {
    if (!this.data.studentRecords) return [];
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return this.data.studentRecords;
    }
    const q = this.searchQuery.trim().toLowerCase();
    return this.data.studentRecords.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q))
    );
  }

  formatStatusLabel(status: string): string {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'late': return 'Late';
      case 'leave': return 'Leave';
      default: return 'Unmarked';
    }
  }

  navigateToEdit(): void {
    this.dialogRef.close();
    this.router.navigate(['/classroom-suite'], {
      queryParams: {
        madrasaId: this.data.madrasaId || '',
        groupId: this.data.groupId || '',
        classId: this.data.classId || '',
        date: this.data.dateStr || ''
      }
    });
  }
}
