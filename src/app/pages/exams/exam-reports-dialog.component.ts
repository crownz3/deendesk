import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Exam, ExamStudentMark, ExamStudentResultSummary } from '../../core/models/domain.model';
import { ExamService } from '../../core/services/exam.service';

@Component({
  selector: 'app-exam-reports-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title no-print">
      <mat-icon color="primary">analytics</mat-icon>
      Exam Reports & Tabulation Sheet - {{ data.exam.title }}
      <button mat-icon-button class="close-btn" mat-dialog-close><mat-icon>close</mat-icon></button>
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- Tabs for report types -->
      <mat-tab-group class="no-print">
        <mat-tab label="Class Tabulation Sheet (Cross-List)">
          <div class="tab-body">
            <div class="report-actions">
              <button mat-raised-button color="primary" (click)="printReport()">
                <mat-icon>print</mat-icon> Print Tabulation Sheet
              </button>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Individual Student Progress Cards">
          <div class="tab-body">
            <div class="report-actions">
              <mat-form-field appearance="outline" class="student-select">
                <mat-label>Select Student for Progress Card</mat-label>
                <mat-select [(ngModel)]="selectedStudentId">
                  <mat-option *ngFor="let res of summaries" [value]="res.studentId">
                    {{ res.studentName }} (Roll: {{ res.rollNumber || '-' }})
                  </mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-raised-button color="accent" [disabled]="!selectedStudentId" (click)="printReport()">
                <mat-icon>print</mat-icon> Print Progress Card
              </button>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Supervisor Duty Schedule">
          <div class="tab-body">
            <div class="report-actions">
              <button mat-raised-button (click)="printReport()">
                <mat-icon>print</mat-icon> Print Supervisor Roster
              </button>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Printable Report Document Area -->
      <div id="printable-area" class="printable-document">
        <!-- Report Header Banner -->
        <div class="institute-header text-center">
          <h2>DEENDESK MADRASA & ACADEMIC INSTITUTION</h2>
          <h3>OFFICIAL EXAMINATION REPORT</h3>
          <p><strong>{{ data.exam.title }}</strong> (Academic Year: {{ data.exam.academicYear }})</p>
        </div>

        <!-- 1. Class Tabulation Sheet -->
        <div class="report-section" *ngIf="!selectedStudentId">
          <h4 class="section-title">CLASS TABULATION SHEET & RANKING</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Roll #</th>
                <th>Student Name</th>
                <th>Class</th>
                <th *ngFor="let sch of data.exam.schedules">{{ sch.subjectName }}</th>
                <th>Total Marks</th>
                <th>% Score</th>
                <th>Grade</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of summaries">
                <td><strong>#{{ s.rank }}</strong></td>
                <td>{{ s.rollNumber || '-' }}</td>
                <td><strong>{{ s.studentName }}</strong></td>
                <td>{{ s.className || '-' }}</td>
                <td *ngFor="let sch of data.exam.schedules">
                  {{ getSubjectMarkText(s, sch.id) }}
                </td>
                <td><strong>{{ s.totalObtainedMarks }}</strong> / {{ s.totalMaxMarks }}</td>
                <td><strong>{{ s.percentage }}%</strong></td>
                <td><span class="grade-tag">{{ s.grade }}</span></td>
                <td>
                  <span class="status-tag" [ngClass]="s.overallPassed ? 'pass' : 'fail'">
                    {{ s.overallPassed ? 'PASSED' : 'RE-EXAM' }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="summaries.length === 0">
                <td [attr.colspan]="(data.exam.schedules?.length || 0) + 8" class="text-center py-4">
                  No evaluation marks entered for this exam yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. Individual Student Progress Card -->
        <div class="report-section progress-card" *ngIf="selectedStudentId && selectedStudent">
          <div class="card-border">
            <div class="card-header text-center">
              <h3>STUDENT PROGRESS CARD & MARKSHEET</h3>
              <p>Exam: {{ data.exam.title }} | Academic Year: {{ data.exam.academicYear }}</p>
            </div>

            <div class="student-meta-grid">
              <div><strong>Student Name:</strong> {{ selectedStudent.studentName }}</div>
              <div><strong>Roll Number:</strong> {{ selectedStudent.rollNumber || '-' }}</div>
              <div><strong>Class:</strong> {{ selectedStudent.className || '-' }}</div>
              <div><strong>Overall Rank in Class:</strong> #{{ selectedStudent.rank }}</div>
            </div>

            <table class="report-table subject-breakdown">
              <thead>
                <tr>
                  <th>Subject Paper</th>
                  <th>Max Marks</th>
                  <th>Pass Marks</th>
                  <th>Written</th>
                  <th>Oral</th>
                  <th>Grace</th>
                  <th>Total Obtained</th>
                  <th>Paper Result</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let mark of selectedStudent.subjectMarks">
                  <td><strong>{{ mark.subjectName }}</strong></td>
                  <td>{{ mark.maxMarks }}</td>
                  <td>{{ mark.passMarks }}</td>
                  <td>{{ mark.isAbsent ? '-' : mark.writtenMarksObtained }}</td>
                  <td>{{ mark.isAbsent ? '-' : mark.oralMarksObtained }}</td>
                  <td>{{ mark.graceMarks || 0 }}</td>
                  <td><strong>{{ mark.isAbsent ? 0 : mark.totalMarksObtained }}</strong></td>
                  <td>
                    <span class="status-tag" [ngClass]="mark.isPassed ? 'pass' : 'fail'">
                      {{ mark.isAbsent ? 'ABSENT' : (mark.isPassed ? 'PASS' : 'FAIL') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="summary-box">
              <div class="sum-item">Grand Total: <strong>{{ selectedStudent.totalObtainedMarks }} / {{ selectedStudent.totalMaxMarks }}</strong></div>
              <div class="sum-item">Percentage Score: <strong>{{ selectedStudent.percentage }}%</strong></div>
              <div class="sum-item">Overall Grade: <strong>{{ selectedStudent.grade }}</strong></div>
              <div class="sum-item">Final Status:
                <strong [ngClass]="selectedStudent.overallPassed ? 'text-success' : 'text-danger'">
                  {{ selectedStudent.overallPassed ? 'PASSED & PROMOTED' : 'REQUIRES RE-EXAM' }}
                </strong>
              </div>
            </div>

            <!-- Signature Block -->
            <div class="signature-block">
              <div class="sig-col">
                <div class="sig-line"></div>
                <p>Class Teacher Signature</p>
              </div>
              <div class="sig-col">
                <div class="sig-line"></div>
                <p>Exam Controller Signature</p>
              </div>
              <div class="sig-col">
                <div class="sig-line"></div>
                <p>Principal / Incharge Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .close-btn { margin-left: auto; }
    .dialog-content { max-height: 82vh; overflow-y: auto; }
    .tab-body { padding: 16px 0; }
    .report-actions { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
    .student-select { min-width: 300px; }

    .printable-document {
      background: white; padding: 24px; border: 1px solid #ccc; border-radius: 8px;
    }
    .institute-header {
      border-bottom: 2px solid #1e3c72; padding-bottom: 12px; margin-bottom: 20px;
      h2 { margin: 0; color: #1e3c72; font-size: 20px; font-weight: bold; }
      h3 { margin: 4px 0; font-size: 16px; color: #555; }
      p { margin: 0; font-size: 13px; color: #777; }
    }
    .text-center { text-align: center; }

    .report-table {
      width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px;
      th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: center; }
      th { background: #f0f4f8; font-weight: bold; color: #333; }
      .grade-tag { font-weight: bold; color: #1565c0; }
      .status-tag {
        font-weight: bold; padding: 3px 8px; border-radius: 10px; font-size: 11px;
        &.pass { background: #e8f5e9; color: #2e7d32; }
        &.fail { background: #ffebee; color: #c62828; }
      }
    }

    .progress-card {
      .card-border { border: 2px solid #1e3c72; padding: 20px; border-radius: 10px; }
      .student-meta-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;
        background: #f8f9fa; padding: 12px; border-radius: 6px; font-size: 14px;
      }
      .summary-box {
        display: flex; justify-content: space-around; background: #eef2f7; padding: 12px;
        border-radius: 6px; margin-top: 16px; font-size: 14px;
      }
      .signature-block {
        display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px;
        .sig-col { text-align: center; width: 28%; }
        .sig-line { border-top: 1px solid #444; margin-bottom: 6px; }
        p { font-size: 12px; font-weight: bold; margin: 0; color: #444; }
      }
    }
    .text-success { color: #2e7d32; }
    .text-danger { color: #c62828; }

    @media print {
      .no-print { display: none !important; }
      .printable-document { border: none; padding: 0; }
    }
  `],
  standalone: false
})
export class ExamReportsDialogComponent implements OnInit {
  summaries: ExamStudentResultSummary[] = [];
  selectedStudentId = '';

  constructor(
    private examService: ExamService,
    private dialogRef: MatDialogRef<ExamReportsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { exam: Exam }
  ) {}

  ngOnInit(): void {
    this.examService.listExamMarks(this.data.exam.id!).subscribe((marks) => {
      this.summaries = this.examService.calculateResultSummaries(
        marks,
        this.data.exam.schedules || []
      );
    });
  }

  get selectedStudent(): ExamStudentResultSummary | undefined {
    return this.summaries.find((s) => s.studentId === this.selectedStudentId);
  }

  getSubjectMarkText(summary: ExamStudentResultSummary, scheduleId: string): string {
    const mark = summary.subjectMarks.find((m) => m.scheduleItemId === scheduleId);
    if (!mark) return '-';
    if (mark.isAbsent) return 'ABS';
    return `${mark.totalMarksObtained}/${mark.maxMarks}`;
  }

  printReport(): void {
    window.print();
  }
}
