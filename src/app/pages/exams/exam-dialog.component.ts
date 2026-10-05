import { Component, Inject, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Exam, ExamScheduleItem, ExamType } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ExamService } from '../../core/services/exam.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-exam-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="primary">{{ isEdit ? 'edit' : 'assignment' }}</mat-icon>
      {{ isEdit ? 'Edit Examination & Schedule' : 'Create New Examination' }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form">
        <!-- Basic Info Section -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Exam Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Annual Examination 2026" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Academic Year</mat-label>
            <input matInput formControlName="academicYear" placeholder="e.g. 2025-2026" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Exam Type</mat-label>
            <mat-select formControlName="examType">
              <mat-option value="annual">Annual Exam</mat-option>
              <mat-option value="half_yearly">Half Yearly Exam</mat-option>
              <mat-option value="quarterly">Quarterly Exam</mat-option>
              <mat-option value="mid_term">Mid-Term Exam</mat-option>
              <mat-option value="monthly">Monthly Test</mat-option>
              <mat-option value="weekly_test">Weekly Test</mat-option>
              <mat-option value="admission">Admission Test</mat-option>
              <mat-option value="re_exam">Re-Exam / Supplementary</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Exam Date Pickers -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Start Date</mat-label>
            <input matInput [matDatepicker]="pickerStart" formControlName="startDate" placeholder="Select start date" />
            <mat-datepicker-toggle matSuffix [for]="pickerStart"></mat-datepicker-toggle>
            <mat-datepicker #pickerStart></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>End Date</mat-label>
            <input matInput [matDatepicker]="pickerEnd" formControlName="endDate" placeholder="Select end date" />
            <mat-datepicker-toggle matSuffix [for]="pickerEnd"></mat-datepicker-toggle>
            <mat-datepicker #pickerEnd></mat-datepicker>
          </mat-form-field>
        </div>

        <!-- Cascading Scope Card: Madrasa -> Course -> Class -> Class Group with Searchable Options -->
        <div class="scope-card">
          <h4 class="scope-title">
            <mat-icon>school</mat-icon>
            Academic Scope & Target Madrasa Selection
          </h4>
          <div class="form-row">
            <!-- Madrasa Select with Search Field -->
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Madrasa</mat-label>
              <mat-select formControlName="madrasaId" (selectionChange)="onMadrasaChange()" (openedChange)="madrasaSearch = ''">
                <div class="select-search-box" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    matInput
                    type="text"
                    placeholder="Search madrasa..."
                    [ngModel]="madrasaSearch"
                    (ngModelChange)="madrasaSearch = $event"
                    [ngModelOptions]="{standalone: true}"
                    class="select-search-input"
                  />
                  <button *ngIf="madrasaSearch" type="button" class="clear-search-btn" (click)="madrasaSearch = ''">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                <mat-option value="all" *ngIf="currentUser?.role !== 'madrasaIncharge' && currentUser?.role !== 'coordinator' && currentUser?.role !== 'stageHead'">🌐 All Madrasas</mat-option>
                <mat-option *ngFor="let m of getSearchedMadrasas()" [value]="m.id">
                  {{ m['name'] || 'Madrasa #' + m.id }}
                </mat-option>
                <div class="no-search-results" *ngIf="getSearchedMadrasas().length === 0">
                  No madrasas matching "{{ madrasaSearch }}"
                </div>
              </mat-select>
            </mat-form-field>

            <!-- Course Select with Search Field -->
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Course</mat-label>
              <mat-select formControlName="targetCourseId" (selectionChange)="onCourseChange()" (openedChange)="courseSearch = ''">
                <div class="select-search-box" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    matInput
                    type="text"
                    placeholder="Search course..."
                    [ngModel]="courseSearch"
                    (ngModelChange)="courseSearch = $event"
                    [ngModelOptions]="{standalone: true}"
                    class="select-search-input"
                  />
                  <button *ngIf="courseSearch" type="button" class="clear-search-btn" (click)="courseSearch = ''">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                <mat-option value="all">📚 All Courses</mat-option>
                <mat-option *ngFor="let c of getSearchedCourses()" [value]="c.id">
                  {{ c['name'] || 'Course #' + c.id }}
                </mat-option>
                <div class="no-search-results" *ngIf="getSearchedCourses().length === 0">
                  No courses matching "{{ courseSearch }}"
                </div>
              </mat-select>
            </mat-form-field>

            <!-- Class Select with Search Field -->
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Class</mat-label>
              <mat-select formControlName="targetClassId" (selectionChange)="onClassChange()" (openedChange)="classSearch = ''">
                <div class="select-search-box" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    matInput
                    type="text"
                    placeholder="Search class..."
                    [ngModel]="classSearch"
                    (ngModelChange)="classSearch = $event"
                    [ngModelOptions]="{standalone: true}"
                    class="select-search-input"
                  />
                  <button *ngIf="classSearch" type="button" class="clear-search-btn" (click)="classSearch = ''">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                <mat-option value="all">🏫 All Classes</mat-option>
                <mat-option *ngFor="let cl of getSearchedClasses()" [value]="cl.id">
                  {{ cl['name'] || 'Class #' + cl.id }}
                </mat-option>
                <div class="no-search-results" *ngIf="getSearchedClasses().length === 0">
                  No classes matching "{{ classSearch }}"
                </div>
              </mat-select>
            </mat-form-field>

            <!-- Class Group Select with Search Field -->
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Class Group</mat-label>
              <mat-select formControlName="targetClassGroupId" (openedChange)="classGroupSearch = ''">
                <div class="select-search-box" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    matInput
                    type="text"
                    placeholder="Search group..."
                    [ngModel]="classGroupSearch"
                    (ngModelChange)="classGroupSearch = $event"
                    [ngModelOptions]="{standalone: true}"
                    class="select-search-input"
                  />
                  <button *ngIf="classGroupSearch" type="button" class="clear-search-btn" (click)="classGroupSearch = ''">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                <mat-option value="all">👥 All Class Groups</mat-option>
                <mat-option *ngFor="let cg of getSearchedClassGroups()" [value]="cg.id">
                  {{ cg['name'] || 'Group #' + cg.id }}
                </mat-option>
                <div class="no-search-results" *ngIf="getSearchedClassGroups().length === 0">
                  No groups matching "{{ classGroupSearch }}"
                </div>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- Target Stage, Gender Scope -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Target Stage</mat-label>
            <input matInput formControlName="targetStage" placeholder="e.g. Primary Stage, Hifz Stage" />
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
                  <input matInput [matDatepicker]="schDatePicker" formControlName="examDate" placeholder="Exam date" />
                  <mat-datepicker-toggle matSuffix [for]="schDatePicker"></mat-datepicker-toggle>
                  <mat-datepicker #schDatePicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Start Time</mat-label>
                  <input matInput type="time" formControlName="startTime" />
                  <mat-icon matSuffix>schedule</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>End Time</mat-label>
                  <input matInput type="time" formControlName="endTime" />
                  <mat-icon matSuffix>schedule</mat-icon>
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
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
    }
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

    .scope-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      margin: 8px 0 16px;

      .scope-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #3b82f6;
        }
      }
    }

    .select-search-box {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #ffffff;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;

      .search-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #94a3b8;
      }

      .select-search-input {
        border: none;
        outline: none;
        width: 100%;
        font-size: 13px;
        color: #1e293b;
        background: transparent;

        &::placeholder {
          color: #94a3b8;
        }
      }

      .clear-search-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        color: #94a3b8;

        &:hover {
          color: #64748b;
        }

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    .no-search-results {
      padding: 12px 16px;
      font-size: 13px;
      color: #94a3b8;
      font-style: italic;
      text-align: center;
    }

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
  currentUser: any = null;

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  classGroups: EntityRecord[] = [];

  madrasaSearch = '';
  courseSearch = '';
  classSearch = '';
  classGroupSearch = '';

  constructor(
    private fb: FormBuilder,
    private examService: ExamService,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ExamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { exam?: Exam }
  ) {
    this.isEdit = !!data?.exam;
    
    const parsedStart = data?.exam?.startDate ? new Date(data.exam.startDate) : new Date();
    const parsedEnd = data?.exam?.endDate ? new Date(data.exam.endDate) : new Date();

    this.form = this.fb.group({
      title: [data?.exam?.title || '', Validators.required],
      academicYear: [data?.exam?.academicYear || '2025-2026', Validators.required],
      examType: [data?.exam?.examType || 'annual', Validators.required],
      startDate: [parsedStart, Validators.required],
      endDate: [parsedEnd, Validators.required],
      madrasaId: [data?.exam?.madrasaId || 'all'],
      targetCourseId: [data?.exam?.targetCourseId || 'all'],
      targetClassId: [data?.exam?.targetClassId || 'all'],
      targetClassGroupId: [data?.exam?.targetClassGroupId || 'all'],
      targetStage: [data?.exam?.targetStage || ''],
      genderScope: [data?.exam?.genderScope || 'all'],
      instructions: [data?.exam?.instructions || ''],
      schedules: this.fb.array([]),
    });
  }

  async ngOnInit(): Promise<void> {
    const user = await firstValueFrom(this.auth.profile$);
    this.currentUser = user;
    if (user) {
      this.repo.list<EntityRecord>('madrasas', user).subscribe(res => this.madrasas = res || []);
      this.repo.list<EntityRecord>('courses', user).subscribe(res => this.courses = res || []);
      this.repo.list<EntityRecord>('classes', user).subscribe(res => this.classes = res || []);
      this.repo.list<EntityRecord>('classGroups', user).subscribe(res => this.classGroups = res || []);
    }

    if (this.data?.exam?.schedules?.length) {
      this.data.exam.schedules.forEach((item) => this.addScheduleRow(item));
    } else {
      this.addScheduleRow();
    }
  }

  get schedulesFormArray(): FormArray {
    return this.form.get('schedules') as FormArray;
  }

  getFilteredCourses(): EntityRecord[] {
    const mId = this.form.get('madrasaId')?.value;
    if (!mId || mId === 'all') return this.courses;
    return this.courses.filter(c => c['madrasaId'] === mId || (Array.isArray(c['madrasaIds']) && c['madrasaIds'].includes(mId)));
  }

  getFilteredClasses(): EntityRecord[] {
    const mId = this.form.get('madrasaId')?.value;
    const cId = this.form.get('targetCourseId')?.value;
    return this.classes.filter(cl => {
      if (mId && mId !== 'all' && cl['madrasaId'] !== mId) return false;
      if (cId && cId !== 'all' && cl['courseId'] !== cId) return false;
      return true;
    });
  }

  getFilteredClassGroups(): EntityRecord[] {
    const mId = this.form.get('madrasaId')?.value;
    const cId = this.form.get('targetCourseId')?.value;
    const clId = this.form.get('targetClassId')?.value;
    return this.classGroups.filter(cg => {
      if (clId && clId !== 'all' && cg['classId'] !== clId) return false;
      if (cId && cId !== 'all' && cg['courseId'] !== cId) return false;
      if (mId && mId !== 'all' && cg['madrasaId'] !== mId) return false;
      return true;
    });
  }

  getSearchedMadrasas(): EntityRecord[] {
    if (!this.madrasaSearch) return this.madrasas;
    const q = this.madrasaSearch.toLowerCase().trim();
    return this.madrasas.filter(m => ((m['name'] as string) || '').toLowerCase().includes(q));
  }

  getSearchedCourses(): EntityRecord[] {
    const base = this.getFilteredCourses();
    if (!this.courseSearch) return base;
    const q = this.courseSearch.toLowerCase().trim();
    return base.filter(c => ((c['name'] as string) || '').toLowerCase().includes(q));
  }

  getSearchedClasses(): EntityRecord[] {
    const base = this.getFilteredClasses();
    if (!this.classSearch) return base;
    const q = this.classSearch.toLowerCase().trim();
    return base.filter(cl => ((cl['name'] as string) || '').toLowerCase().includes(q));
  }

  getSearchedClassGroups(): EntityRecord[] {
    const base = this.getFilteredClassGroups();
    if (!this.classGroupSearch) return base;
    const q = this.classGroupSearch.toLowerCase().trim();
    return base.filter(cg => ((cg['name'] as string) || '').toLowerCase().includes(q));
  }

  onMadrasaChange(): void {
    this.form.patchValue({
      targetCourseId: 'all',
      targetClassId: 'all',
      targetClassGroupId: 'all'
    });
  }

  onCourseChange(): void {
    this.form.patchValue({
      targetClassId: 'all',
      targetClassGroupId: 'all'
    });
  }

  onClassChange(): void {
    this.form.patchValue({
      targetClassGroupId: 'all'
    });
  }

  addScheduleRow(item?: ExamScheduleItem): void {
    const parsedExamDate = item?.examDate ? new Date(item.examDate) : new Date();
    const row = this.fb.group({
      id: [item?.id || 'sch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)],
      subjectName: [item?.subjectName || '', Validators.required],
      examDate: [parsedExamDate, Validators.required],
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

  private formatDateToIsoString(val: any): string {
    if (!val) return new Date().toISOString().split('T')[0];
    if (val instanceof Date) {
      const yyyy = val.getFullYear();
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(val);
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

    const selectedMadrasa = this.madrasas.find(m => m.id === val.madrasaId);
    const selectedCourse = this.courses.find(c => c.id === val.targetCourseId);
    const selectedClass = this.classes.find(cl => cl.id === val.targetClassId);
    const selectedClassGroup = this.classGroups.find(cg => cg.id === val.targetClassGroupId);

    const formattedSchedules = (val.schedules || []).map((s: any) => ({
      ...s,
      examDate: this.formatDateToIsoString(s.examDate)
    }));

    const payload: Partial<Exam> = {
      title: val.title,
      academicYear: val.academicYear,
      examType: val.examType as ExamType,
      startDate: this.formatDateToIsoString(val.startDate),
      endDate: this.formatDateToIsoString(val.endDate),
      madrasaId: val.madrasaId,
      madrasaName: selectedMadrasa ? (selectedMadrasa['name'] as string) : (val.madrasaId === 'all' ? 'All Madrasas' : ''),
      targetCourseId: val.targetCourseId,
      targetCourseName: selectedCourse ? (selectedCourse['name'] as string) : (val.targetCourseId === 'all' ? 'All Courses' : ''),
      targetClassId: val.targetClassId,
      targetClassName: selectedClass ? (selectedClass['name'] as string) : (val.targetClassId === 'all' ? 'All Classes' : ''),
      targetClassGroupId: val.targetClassGroupId,
      targetClassGroupName: selectedClassGroup ? (selectedClassGroup['name'] as string) : (val.targetClassGroupId === 'all' ? 'All Class Groups' : ''),
      targetStage: val.targetStage,
      genderScope: val.genderScope,
      instructions: val.instructions,
      schedules: formattedSchedules,
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
