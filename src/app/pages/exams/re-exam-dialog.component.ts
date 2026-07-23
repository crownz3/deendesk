import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Exam, ExamStudentMark, ReExamCandidate } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ExamService } from '../../core/services/exam.service';

@Component({
  selector: 'app-re-exam-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">published_with_changes</mat-icon>
      Re-Exam & Supplementary Management - {{ data.exam.title }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <p class="description">
        Manage students eligible for supplementary or re-sit examinations (due to failing scores or paper absences).
      </p>

      <div class="action-bar">
        <button mat-raised-button color="primary" (click)="autoGenerateCandidates()">
          <mat-icon>autorenew</mat-icon> Auto-Detect Failed/Absent Candidates
        </button>
      </div>

      <div class="table-container">
        <table class="reexam-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Class</th>
              <th>Failed / Absent Subjects</th>
              <th>Re-Exam Status</th>
              <th>Notes / Decision</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of candidates; let i = index">
              <td><strong>{{ c.studentName }}</strong></td>
              <td>{{ c.className || '-' }}</td>
              <td>
                <span class="subject-chip" *ngFor="let sub of c.failedSubjectNames">
                  {{ sub }}
                </span>
              </td>
              <td>
                <select class="form-select" [(ngModel)]="c.reExamStatus">
                  <option value="pending">Pending Schedule</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed & Passed</option>
                  <option value="waived">Waived / Promoted</option>
                </select>
              </td>
              <td>
                <input type="text" class="text-input" [(ngModel)]="c.notes" placeholder="e.g. Supplementary paper on Monday" />
              </td>
              <td>
                <button mat-icon-button color="warn" (click)="removeCandidate(i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </tr>

            <tr *ngIf="candidates.length === 0">
              <td colspan="6" class="text-center py-4">
                No re-exam candidates registered yet. Click "Auto-Detect Failed/Absent Candidates" to analyze exam results.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-raised-button color="warn" [disabled]="submitting" (click)="saveCandidates()">
        {{ submitting ? 'Saving...' : 'Save Re-Exam List' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-height: 75vh; overflow-y: auto; }
    .description { color: #555; margin-bottom: 16px; }
    .action-bar { margin-bottom: 16px; }
    .table-container { border: 1px solid #e0e0e0; border-radius: 8px; overflow-x: auto; }
    .reexam-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { padding: 10px 12px; border-bottom: 1px solid #eee; text-align: left; vertical-align: middle; }
      th { background: #f5f5f5; font-weight: bold; color: #333; }
      .subject-chip {
        display: inline-block; background: #ffebee; color: #c62828; font-size: 11px; font-weight: 600;
        padding: 3px 8px; border-radius: 12px; margin-right: 4px; margin-bottom: 2px;
      }
      .form-select, .text-input { padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; }
      .text-input { width: 100%; min-width: 150px; }
    }
    .text-center { text-align: center; }
    .py-4 { padding: 24px; color: #777; }
  `],
  standalone: false
})
export class ReExamDialogComponent implements OnInit {
  candidates: Partial<ReExamCandidate>[] = [];
  submitting = false;

  constructor(
    private examService: ExamService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ReExamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { exam: Exam }
  ) {}

  ngOnInit(): void {
    this.examService.listReExamCandidates(this.data.exam.id!).subscribe((list) => {
      this.candidates = list;
    });
  }

  autoGenerateCandidates(): void {
    this.examService.listExamMarks(this.data.exam.id!).subscribe((marks) => {
      const failedMap = new Map<string, { studentName: string; className: string; failedSubjects: string[] }>();

      marks.forEach((m) => {
        if (!m.isPassed || m.isAbsent) {
          const item = failedMap.get(m.studentId) || {
            studentName: m.studentName,
            className: m.className || '',
            failedSubjects: [],
          };
          item.failedSubjects.push(m.subjectName + (m.isAbsent ? ' (Absent)' : ' (Failed)'));
          failedMap.set(m.studentId, item);
        }
      });

      const newCandidates: Partial<ReExamCandidate>[] = [];
      failedMap.forEach((val, studentId) => {
        newCandidates.push({
          originalExamId: this.data.exam.id!,
          originalExamTitle: this.data.exam.title,
          studentId,
          studentName: val.studentName,
          className: val.className,
          failedSubjectNames: val.failedSubjects,
          reExamStatus: 'pending',
          notes: 'Auto-detected from exam evaluation marks',
        });
      });

      if (newCandidates.length === 0) {
        this.snackBar.open('No failed or absent candidates found! All students passed.', 'Close', { duration: 3000 });
      } else {
        this.candidates = newCandidates;
        this.snackBar.open(`Found ${newCandidates.length} candidate(s) needing re-exam.`, 'Close', { duration: 3000 });
      }
    });
  }

  removeCandidate(index: number): void {
    this.candidates.splice(index, 1);
  }

  async saveCandidates(): Promise<void> {
    this.submitting = true;
    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) {
      this.submitting = false;
      return;
    }

    try {
      await this.examService.saveReExamCandidates(this.candidates, currentUser);
      this.snackBar.open('Re-Exam candidate list saved successfully!', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save re-exam list', 'Close', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}
