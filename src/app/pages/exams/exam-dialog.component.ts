import { Component, Inject, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Exam, ExamScheduleItem, ExamStatus, ExamType } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ExamService } from '../../core/services/exam.service';

@Component({
  selector: 'app-exam-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit ? 'edit' : 'assignment' }}</mat-icon>
      {{ isEdit ? 'Edit Examination & Schedule' : 'Create New Examination' }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Exam Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Annual Examination 2026" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Academic Year</mat-label>
            <input matInput formControlName="academicYear" placeholder="e.g. 2025-2026" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Exam Type</mat-label>
            <mat-select formControlName="examType">
              <mat-option value="annual">Annual Exam</mat-option>
              <mat-option value="mid_term">Mid-Term Exam</mat-option>
              <mat-option value="monthly">Monthly Test</mat-option>
              <mat-option value="weekly_test">Weekly Test</mat-option>
              <mat-option value="admission">Admission Test</mat-option>
              <mat-option value="re_exam">Re-Exam / Supplementary</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Start Date</mat-label>
            <input matInput type="date" formControlName="startDate" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>End Date</mat-label>
            <input matInput type="date" formControlName="endDate" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Target Stage</mat-label>
            <input matInput formControlName="targetStage" placeholder="e.g. Primary Stage, Hifz Stage" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Target Classes (Comma Separated)</mat-label>
            <input matInput formControlName="targetClassesInput" placeholder="e.g. Class 1, Class 2, Class 3" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Gender Scope</mat-label>
            <mat-select formControlName="genderScope">
              <mat-option value="all">All (Co-Ed)</mat-option>
              <mat-option value="male">Boys Only</mat-option>
              <mat-option value="female">Girls Only</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-full">
            <mat-label>Special Instructions / Rules</mat-label>
            <textarea matInput formControlName="instructions" rows="2" placeholder="e.g. Hall tickets required. No electronic devices allowed."></textarea>
          </mat-form-field>
        </div>

        <!-- Timetable Schedule Section -->
        <div class="schedule-section">
          <div class="section-header">
            <h3><mat-icon>calendar_month</mat-icon> Exam Timetable & Paper Schedules</h3>
            <button type="button" mat-stroked-button color="primary" (click)="addScheduleRow()">
              <mat-icon>add</mat-icon> Add Subject Paper
            </button>
          </div>

          <div formArrayName="schedules" class="schedules-list">
            <div *ngFor="let sGroup of schedulesFormArray.controls; let i = index" [formGroupName]="i" class="schedule-card">
              <div class="schedule-header">
                <strong>Paper #{{ i + 1 }}</strong>
                <button type="button" mat-icon-button color="warn" (click)="removeScheduleRow(i)" title="Remove Paper">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-2">
                  <mat-label>Subject Name</mat-label>
                  <input matInput formControlName="subjectName" placeholder="e.g. Quran Hifz, Tajweed, Arabic" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Exam Date</mat-label>
                  <input matInput type="date" formControlName="examDate" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Start Time</mat-label>
                  <input matInput type="time" formControlName="startTime" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>End Time</mat-label>
                  <input matInput type="time" formControlName="endTime" />
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Max Marks</mat-label>
                  <input matInput type="number" formControlName="maxMarks" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Pass Marks</mat-label>
                  <input matInput type="number" formControlName="passMarks" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Hall / Room No.</mat-label>
                  <input matInput formControlName="hallOrRoom" placeholder="e.g. Main Hall 1" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Supervisor Name</mat-label>
                  <input matInput formControlName="supervisorName" placeholder="e.g. Usthad Ibrahim" />
                </mat-form-field>
              </div>

              <!-- Reschedule / Adjustment Status -->
              <div class="form-row bg-light p-2 rounded">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Schedule Status</mat-label>
                  <mat-select formControlName="scheduleStatus">
                    <mat-option value="scheduled">Normal (Scheduled)</mat-option>
                    <mat-option value="preponed">Preponed</mat-option>
                    <mat-option value="postponed">Postponed</mat-option>
                    <mat-option value="rescheduled">Rescheduled</mat-option>
                    <mat-option value="cancelled">Cancelled</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-2">
                  <mat-label>Adjustment Reason / Remarks</mat-label>
                  <input matInput formControlName="rescheduleReason" placeholder="e.g. Postponed due to public holiday" />
                </mat-form-field>
              </div>
            </div>
          </div>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || submitting" (click)="save()">
        {{ submitting ? 'Saving...' : 'Save Exam & Schedule' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      max-height: 75vh;
      overflow-y: auto;
      padding-top: 8px;
    }
    .form-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .flex-1 { flex: 1; min-width: 140px; }
    .flex-2 { flex: 2; min-width: 200px; }
    .flex-full { width: 100%; }

    .schedule-section {
      margin-top: 16px;
      border-top: 1px solid #e0e0e0;
      padding-top: 16px;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 16px;
          color: #1e3c72;
        }
      }

      .schedule-card {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;

        .schedule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
      }
    }
    .bg-light { background: #f0f4f8; }
    .p-2 { padding: 8px; }
    .rounded { border-radius: 6px; }
  `],
  standalone: false
})
export class ExamDialogComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private examService: ExamService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ExamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { exam?: Exam }
  ) {
    this.isEdit = !!data?.exam;
    this.form = this.fb.group({
      title: [data?.exam?.title || '', Validators.required],
      academicYear: [data?.exam?.academicYear || '2025-2026', Validators.required],
      examType: [data?.exam?.examType || 'annual', Validators.required],
      startDate: [data?.exam?.startDate || new Date().toISOString().split('T')[0], Validators.required],
      endDate: [data?.exam?.endDate || new Date().toISOString().split('T')[0], Validators.required],
      targetStage: [data?.exam?.targetStage || ''],
      targetClassesInput: [data?.exam?.targetClassNames?.join(', ') || ''],
      genderScope: [data?.exam?.genderScope || 'all'],
      instructions: [data?.exam?.instructions || ''],
      schedules: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    if (this.data?.exam?.schedules?.length) {
      this.data.exam.schedules.forEach((item) => this.addScheduleRow(item));
    } else {
      // Add one empty schedule row by default
      this.addScheduleRow();
    }
  }

  get schedulesFormArray(): FormArray {
    return this.form.get('schedules') as FormArray;
  }

  addScheduleRow(item?: ExamScheduleItem): void {
    const row = this.fb.group({
      id: [item?.id || 'sch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)],
      subjectName: [item?.subjectName || '', Validators.required],
      examDate: [item?.examDate || new Date().toISOString().split('T')[0], Validators.required],
      startTime: [item?.startTime || '09:00', Validators.required],
      endTime: [item?.endTime || '11:00', Validators.required],
      maxMarks: [item?.maxMarks ?? 100, [Validators.required, Validators.min(1)]],
      passMarks: [item?.passMarks ?? 40, [Validators.required, Validators.min(1)]],
      hallOrRoom: [item?.hallOrRoom || ''],
      supervisorName: [item?.supervisorName || ''],
      scheduleStatus: [item?.scheduleStatus || 'scheduled'],
      rescheduleReason: [item?.rescheduleReason || ''],
    });
    this.schedulesFormArray.push(row);
  }

  removeScheduleRow(index: number): void {
    this.schedulesFormArray.removeAt(index);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    this.submitting = true;
    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) {
      this.submitting = false;
      return;
    }

    const val = this.form.value;
    const targetClassNames = val.targetClassesInput
      ? val.targetClassesInput.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];

    const payload: Partial<Exam> = {
      title: val.title,
      academicYear: val.academicYear,
      examType: val.examType as ExamType,
      startDate: val.startDate,
      endDate: val.endDate,
      targetStage: val.targetStage,
      targetClassNames,
      genderScope: val.genderScope,
      instructions: val.instructions,
      schedules: val.schedules,
      status: this.data?.exam?.status || 'scheduled',
    };

    try {
      if (this.isEdit && this.data.exam?.id) {
        await this.examService.updateExam(this.data.exam.id, payload, currentUser);
        this.snackBar.open('Exam updated successfully', 'Close', { duration: 3000 });
      } else {
        await this.examService.createExam(payload, currentUser);
        this.snackBar.open('Exam created successfully', 'Close', { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save exam', 'Close', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}
