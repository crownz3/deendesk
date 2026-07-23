import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  AttendanceStatus,
  Exam,
  ExamPaperAttendance,
  ExamScheduleItem,
  ExamStudentMark,
} from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ExamService } from '../../core/services/exam.service';

export interface MarkEntryRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  attendanceStatus: AttendanceStatus;
  writtenMarks: number;
  oralMarks: number;
  graceMarks: number;
  remarks: string;
  existingMarkId?: string;
  existingAttendanceId?: string;
}

@Component({
  selector: 'app-exam-marks-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="accent">fact_check</mat-icon>
      Attendance & Marks Entry - {{ data.exam.title }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- Select Schedule / Paper -->
      <div class="schedule-selector">
        <mat-form-field appearance="outline" class="flex-full">
          <mat-label>Select Subject Paper / Session</mat-label>
          <mat-select [(ngModel)]="selectedScheduleId" (selectionChange)="onScheduleChange()">
            <mat-option *ngFor="let sch of data.exam.schedules" [value]="sch.id">
              <strong>{{ sch.subjectName }}</strong> — {{ sch.examDate }} ({{ sch.startTime }} - {{ sch.endTime }})
              <span *ngIf="sch.hallOrRoom"> [Room: {{ sch.hallOrRoom }}]</span>
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div *ngIf="selectedSchedule" class="paper-summary">
        <span class="info-pill">Max Marks: <strong>{{ selectedSchedule.maxMarks }}</strong></span>
        <span class="info-pill">Pass Marks: <strong>{{ selectedSchedule.passMarks }}</strong></span>
        <span class="info-pill" *ngIf="selectedSchedule.supervisorName">Supervisor: <strong>{{ selectedSchedule.supervisorName }}</strong></span>
        <span class="info-pill status-pill" [ngClass]="selectedSchedule.scheduleStatus">
          Status: <strong>{{ selectedSchedule.scheduleStatus | uppercase }}</strong>
        </span>
      </div>

      <!-- Add Student Quick Row -->
      <div class="add-student-bar" *ngIf="selectedSchedule">
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Add Student Name</mat-label>
          <input matInput [(ngModel)]="newStudentName" placeholder="e.g. Muhammad Ali" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Roll No.</mat-label>
          <input matInput [(ngModel)]="newStudentRoll" placeholder="e.g. 101" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Class</mat-label>
          <input matInput [(ngModel)]="newStudentClass" placeholder="e.g. Class 1" />
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="addStudentRow()">
          <mat-icon>person_add</mat-icon> Add Student
        </button>
      </div>

      <!-- Mark Entry Grid -->
      <div class="table-container" *ngIf="selectedSchedule">
        <table class="marks-table">
          <thead>
            <tr>
              <th>Roll #</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Attendance</th>
              <th>Written Marks</th>
              <th>Oral Marks</th>
              <th>Grace</th>
              <th>Total Marks</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td><strong>{{ row.rollNumber || '-' }}</strong></td>
              <td>{{ row.studentName }}</td>
              <td>{{ row.className || '-' }}</td>
              <td>
                <select class="form-select" [(ngModel)]="row.attendanceStatus">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="leave">On Leave</option>
                </select>
              </td>
              <td>
                <input type="number" class="num-input" [(ngModel)]="row.writtenMarks" [disabled]="row.attendanceStatus === 'absent'" />
              </td>
              <td>
                <input type="number" class="num-input" [(ngModel)]="row.oralMarks" [disabled]="row.attendanceStatus === 'absent'" />
              </td>
              <td>
                <input type="number" class="num-input" [(ngModel)]="row.graceMarks" [disabled]="row.attendanceStatus === 'absent'" />
              </td>
              <td>
                <strong class="total-val">
                  {{ row.attendanceStatus === 'absent' ? 0 : (row.writtenMarks + row.oralMarks + row.graceMarks) }}
                </strong> / {{ selectedSchedule.maxMarks }}
              </td>
              <td>
                <span class="badge" [ngClass]="calculateRowPassed(row) ? 'badge-success' : 'badge-danger'">
                  {{ row.attendanceStatus === 'absent' ? 'ABSENT' : (calculateRowPassed(row) ? 'PASS' : 'FAIL') }}
                </span>
              </td>
              <td>
                <input type="text" class="text-input" [(ngModel)]="row.remarks" placeholder="Optional notes" />
              </td>
            </tr>

            <tr *ngIf="rows.length === 0">
              <td colspan="10" class="text-center py-3">No student records added for this paper yet. Use the form above to add students.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-raised-button color="accent" [disabled]="submitting || !selectedSchedule" (click)="saveAll()">
        <mat-icon>save</mat-icon> {{ submitting ? 'Saving...' : 'Save Attendance & Marks' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-height: 80vh; overflow-y: auto; }
    .flex-full { width: 100%; }
    .paper-summary {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;

      .info-pill {
        background: #f0f4f8;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 13px;
        color: #333;
      }
      .status-pill.scheduled { background: #e3f2fd; color: #1565c0; }
      .status-pill.postponed { background: #fff3e0; color: #e65100; }
      .status-pill.preponed { background: #e8f5e9; color: #2e7d32; }
      .status-pill.cancelled { background: #ffebee; color: #c62828; }
    }
    .add-student-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      background: #fafafa;
      padding: 12px 12px 0 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      .flex-1 { flex: 1; min-width: 130px; }
      button { margin-bottom: 16px; }
    }
    .table-container {
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    .marks-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th, td {
        padding: 10px 12px;
        border-bottom: 1px solid #eee;
        text-align: left;
        vertical-align: middle;
      }
      th {
        background: #f5f5f5;
        font-weight: 700;
        color: #444;
      }
      .num-input {
        width: 70px;
        padding: 6px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .text-input {
        width: 120px;
        padding: 6px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .form-select {
        padding: 6px;
        border-radius: 4px;
        border: 1px solid #ccc;
      }
      .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
      }
      .badge-success { background: #e8f5e9; color: #2e7d32; }
      .badge-danger { background: #ffebee; color: #c62828; }
      .total-val { font-size: 15px; color: #1976d2; }
    }
    .text-center { text-align: center; }
    .py-3 { padding: 24px; color: #777; }
  `],
  standalone: false
})
export class ExamMarksDialogComponent implements OnInit {
  selectedScheduleId = '';
  selectedSchedule: ExamScheduleItem | null = null;
  rows: MarkEntryRow[] = [];

  newStudentName = '';
  newStudentRoll = '';
  newStudentClass = '';

  submitting = false;

  constructor(
    private examService: ExamService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ExamMarksDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { exam: Exam }
  ) {}

  ngOnInit(): void {
    if (this.data.exam.schedules?.length) {
      this.selectedScheduleId = this.data.exam.schedules[0].id;
      this.onScheduleChange();
    }
  }

  onScheduleChange(): void {
    this.selectedSchedule =
      this.data.exam.schedules?.find((s) => s.id === this.selectedScheduleId) || null;
    this.rows = [];
    if (!this.selectedSchedule) return;

    // Load existing marks & attendance from backend
    this.examService
      .listExamMarks(this.data.exam.id!, this.selectedScheduleId)
      .subscribe((marks) => {
        if (marks.length) {
          this.rows = marks.map((m) => ({
            studentId: m.studentId,
            studentName: m.studentName,
            rollNumber: m.rollNumber || '',
            className: m.className || '',
            attendanceStatus: m.isAbsent ? 'absent' : 'present',
            writtenMarks: m.writtenMarksObtained || 0,
            oralMarks: m.oralMarksObtained || 0,
            graceMarks: m.graceMarks || 0,
            remarks: m.remarks || '',
            existingMarkId: m.id,
          }));
        } else {
          // Pre-fill dummy/sample students for demo if empty
          this.rows = [
            { studentId: 'std-1', studentName: 'Ahmad Raza', rollNumber: '101', className: 'Class 1', attendanceStatus: 'present', writtenMarks: 45, oralMarks: 40, graceMarks: 0, remarks: 'Good Quran recitation' },
            { studentId: 'std-2', studentName: 'Fatimah Binte Ali', rollNumber: '102', className: 'Class 1', attendanceStatus: 'present', writtenMarks: 48, oralMarks: 47, graceMarks: 0, remarks: 'Excellent' },
            { studentId: 'std-3', studentName: 'Zayd Bin Haritha', rollNumber: '103', className: 'Class 1', attendanceStatus: 'absent', writtenMarks: 0, oralMarks: 0, graceMarks: 0, remarks: 'Absent due to illness' }
          ];
        }
      });
  }

  addStudentRow(): void {
    if (!this.newStudentName.trim()) return;
    this.rows.push({
      studentId: 'std-' + Date.now(),
      studentName: this.newStudentName.trim(),
      rollNumber: this.newStudentRoll.trim(),
      className: this.newStudentClass.trim() || 'Class 1',
      attendanceStatus: 'present',
      writtenMarks: 0,
      oralMarks: 0,
      graceMarks: 0,
      remarks: '',
    });
    this.newStudentName = '';
    this.newStudentRoll = '';
  }

  calculateRowPassed(row: MarkEntryRow): boolean {
    if (row.attendanceStatus === 'absent') return false;
    const total = (row.writtenMarks || 0) + (row.oralMarks || 0) + (row.graceMarks || 0);
    const passMarks = this.selectedSchedule?.passMarks || 40;
    return total >= passMarks;
  }

  async saveAll(): Promise<void> {
    if (!this.selectedSchedule) return;

    this.submitting = true;
    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) {
      this.submitting = false;
      return;
    }

    const marksPayload: Partial<ExamStudentMark>[] = this.rows.map((r) => ({
      id: r.existingMarkId,
      examId: this.data.exam.id!,
      scheduleItemId: this.selectedScheduleId,
      subjectId: this.selectedSchedule?.subjectId || '',
      subjectName: this.selectedSchedule?.subjectName || 'Subject',
      studentId: r.studentId,
      studentName: r.studentName,
      rollNumber: r.rollNumber,
      className: r.className,
      writtenMarksObtained: r.writtenMarks || 0,
      oralMarksObtained: r.oralMarks || 0,
      graceMarks: r.graceMarks || 0,
      maxMarks: this.selectedSchedule?.maxMarks || 100,
      passMarks: this.selectedSchedule?.passMarks || 40,
      isAbsent: r.attendanceStatus === 'absent',
      remarks: r.remarks,
    }));

    const attendancePayload: Partial<ExamPaperAttendance>[] = this.rows.map((r) => ({
      examId: this.data.exam.id!,
      scheduleItemId: this.selectedScheduleId,
      studentId: r.studentId,
      studentName: r.studentName,
      rollNumber: r.rollNumber,
      className: r.className,
      status: r.attendanceStatus,
      remarks: r.remarks,
    }));

    try {
      await this.examService.saveExamMarksBatch(marksPayload, currentUser);
      await this.examService.saveExamAttendance(attendancePayload, currentUser);
      this.snackBar.open('Attendance & Marks saved successfully!', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save marks', 'Close', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}
