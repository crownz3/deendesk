import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppUser, Course, CourseStageAssignment, Madrasa } from '../../core/models/domain.model';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../core/constants/defaults';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface StageHeadDialogData {
  user?: AppUser;
  madrasas: Madrasa[];
  courses: Course[];
  allStaffUsers: AppUser[];
}

@Component({
  standalone: false,
  selector: 'app-stage-head-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon color="primary">assignment_ind</mat-icon>
        {{ isEdit ? 'Edit Stage Head Assignment' : 'Assign New Stage Head / Course Lead' }}
      </h2>
      <button mat-icon-button mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="assignment-form">
        <!-- Select Person / Staff with Search -->
        <mat-form-field appearance="outline" class="full-width" *ngIf="!isEdit">
          <mat-label>Select User / Staff Member</mat-label>
          <mat-select formControlName="userId" (selectionChange)="onUserSelected($event.value)">
            <div class="select-search-box" (keydown)="$event.stopPropagation()">
              <mat-icon class="search-icon">search</mat-icon>
              <input
                type="text"
                placeholder="Search staff by name..."
                [(ngModel)]="staffSearchText"
                [ngModelOptions]="{standalone: true}"
                (input)="filterStaff()"
                class="select-search-input"
              />
              <button *ngIf="staffSearchText" mat-icon-button type="button" class="clear-search-btn" (click)="staffSearchText = ''; filterStaff()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <mat-option *ngFor="let staff of filteredStaffUsers" [value]="staff.id || staff.uid">
              {{ staff.displayName }}
            </mat-option>
            <mat-option *ngIf="filteredStaffUsers.length === 0" disabled>No staff members found</mat-option>
          </mat-select>
          <mat-hint>Choose an existing staff member to assign as Stage Head</mat-hint>
        </mat-form-field>

        <div *ngIf="isEdit" class="user-summary-card">
          <mat-icon color="primary">account_circle</mat-icon>
          <div>
            <strong>{{ selectedUser?.displayName }}</strong>
          </div>
        </div>

        <!-- Assigned Madrasas with Search & All Madrasas Option -->
        <div class="madrasa-selection-box">
          <div class="all-madrasas-row">
            <mat-checkbox [checked]="isAllMadrasasSelected()" (change)="toggleSelectAllMadrasas($event.checked)" color="primary">
              <strong>Assign to All Madrasas (Organization-wide)</strong>
            </mat-checkbox>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Assigned Madrasas</mat-label>
            <mat-select formControlName="madrasaIds" multiple (selectionChange)="onMadrasaSelectionChange($event.value)">
              <div class="select-search-box" (keydown)="$event.stopPropagation()">
                <mat-icon class="search-icon">search</mat-icon>
                <input
                  type="text"
                  placeholder="Search madrasas..."
                  [(ngModel)]="madrasaSearchText"
                  [ngModelOptions]="{standalone: true}"
                  (input)="filterMadrasas()"
                  class="select-search-input"
                />
                <button *ngIf="madrasaSearchText" mat-icon-button type="button" class="clear-search-btn" (click)="madrasaSearchText = ''; filterMadrasas()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <mat-option *ngFor="let m of filteredMadrasas" [value]="m.id">
                {{ m.name }} ({{ m.code }})
              </mat-option>
              <mat-option *ngIf="filteredMadrasas.length === 0" disabled>No madrasas found</mat-option>
            </mat-select>
            <mat-hint>Select specific madrasas or check 'Assign to All Madrasas'</mat-hint>
          </mat-form-field>
        </div>

        <!-- Gender Scope -->
        <div class="gender-scope-section">
          <label class="section-label">Gender Scope (Student & Staff Section)</label>
          <mat-button-toggle-group formControlName="genderScope" class="full-width gender-toggle">
            <mat-button-toggle value="male">
              <mat-icon>male</mat-icon> Boys Section Only
            </mat-button-toggle>
            <mat-button-toggle value="female">
              <mat-icon>female</mat-icon> Girls Section Only
            </mat-button-toggle>
            <mat-button-toggle value="all">
              <mat-icon>people</mat-icon> Both / Co-Ed
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <!-- Course & Stage Pairing Section -->
        <div class="course-stage-builder">
          <h4 class="builder-title">
            <mat-icon color="accent">menu_book</mat-icon> Course & Stage Assignments
          </h4>
          <p class="builder-desc">Assign specific courses and stages led by this person.</p>

          <div class="add-pair-row">
            <!-- Course Select with Search -->
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Course</mat-label>
              <mat-select [(value)]="selectedCourseId" (selectionChange)="onCourseChange($event.value)">
                <div class="select-search-box" (keydown)="$event.stopPropagation()">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    type="text"
                    placeholder="Search course..."
                    [(ngModel)]="courseSearchText"
                    [ngModelOptions]="{standalone: true}"
                    (input)="filterCourses()"
                    class="select-search-input"
                  />
                  <button *ngIf="courseSearchText" mat-icon-button type="button" class="clear-search-btn" (click)="courseSearchText = ''; filterCourses()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
                <mat-option *ngFor="let c of filteredCourses" [value]="c.id">
                  {{ c.name }} ({{ c.code }})
                </mat-option>
                <mat-option *ngIf="filteredCourses.length === 0" disabled>No courses found</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Stage Select with Search & Full List -->
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Stage / Level</mat-label>
              <mat-select [(value)]="selectedStage" [disabled]="!selectedCourseId">
                <div class="select-search-box" (keydown)="$event.stopPropagation()" *ngIf="currentCourseStages.length > 2">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    type="text"
                    placeholder="Search stage..."
                    [(ngModel)]="stageSearchText"
                    [ngModelOptions]="{standalone: true}"
                    (input)="filterStages()"
                    class="select-search-input"
                  />
                  <button *ngIf="stageSearchText" mat-icon-button type="button" class="clear-search-btn" (click)="stageSearchText = ''; filterStages()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
                <mat-option value="">All Stages (Entire Course)</mat-option>
                <mat-option *ngFor="let st of filteredStages" [value]="st">
                  {{ st }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="accent" type="button" (click)="addAssignment()" [disabled]="!selectedCourseId">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>

          <!-- Added Assignments Chip List -->
          <div class="assignment-chips-container" *ngIf="assignments.length > 0">
            <div *ngFor="let ass of assignments; let i = index" class="assignment-chip">
              <span class="chip-course">{{ getCourseName(ass.courseId) }}</span>
              <span class="chip-stage" *ngIf="ass.stage">({{ ass.stage }})</span>
              <span class="chip-stage" *ngIf="!ass.stage">(All Stages)</span>
              <button mat-icon-button type="button" class="chip-remove" (click)="removeAssignment(i)">
                <mat-icon>cancel</mat-icon>
              </button>
            </div>
          </div>
          <div class="empty-assignments" *ngIf="assignments.length === 0">
            <em>No course-stage assignments added yet. Use the fields above to add.</em>
          </div>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving || (!selectedCourseId && assignments.length === 0)">
        <mat-icon *ngIf="!saving">check_circle</mat-icon>
        <mat-spinner diameter="18" *ngIf="saving"></mat-spinner>
        {{ isEdit ? 'Update Lead' : 'Assign Lead' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px 8px;
      h2 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
    }
    .dialog-content {
      padding: 16px 24px;
      max-width: 600px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .madrasa-selection-box {
      margin-bottom: 16px;
      .all-madrasas-row {
        margin-bottom: 8px;
        background: #e8eaf6;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #c5cae9;
      }
    }
    .select-search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      position: sticky;
      top: 0;
      background: #ffffff;
      z-index: 10;
      border-bottom: 1px solid #e0e0e0;
      .search-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
        color: #757575;
      }
      .select-search-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 0.88rem;
        padding: 4px 0;
        background: transparent;
      }
      .clear-search-btn {
        width: 20px;
        height: 20px;
        line-height: 20px;
        mat-icon {
          font-size: 14px;
          height: 14px;
          width: 14px;
        }
      }
    }
    .user-summary-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 8px;
      margin-bottom: 16px;
      .text-subtle {
        display: block;
        font-size: 0.85rem;
        color: #666;
      }
    }
    .gender-scope-section {
      margin-bottom: 20px;
      .section-label {
        display: block;
        font-weight: 500;
        font-size: 0.85rem;
        margin-bottom: 8px;
        color: #555;
      }
      .gender-toggle {
        display: flex;
        mat-button-toggle {
          flex: 1;
          font-size: 0.85rem;
          mat-icon {
            font-size: 18px;
            height: 18px;
            width: 18px;
            vertical-align: middle;
          }
        }
      }
    }
    .course-stage-builder {
      border: 1px dashed #ccc;
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
      .builder-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 4px;
        font-size: 1rem;
      }
      .builder-desc {
        margin: 0 0 12px;
        font-size: 0.8rem;
        color: #666;
      }
      .add-pair-row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        .flex-1 {
          flex: 1;
          min-width: 140px;
        }
      }
    }
    .assignment-chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .assignment-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #e3f2fd;
      color: #0d47a1;
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 500;
      .chip-stage {
        color: #1565c0;
        font-weight: 400;
      }
      .chip-remove {
        width: 20px;
        height: 20px;
        line-height: 20px;
        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
        }
      }
    }
    .empty-assignments {
      margin-top: 8px;
      font-size: 0.8rem;
      color: #888;
    }
    .dialog-actions {
      padding: 12px 24px 16px;
    }
  `]
})
export class StageHeadDialogComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  saving = false;
  selectedUser: AppUser | null = null;

  availableStaff: AppUser[] = [];
  filteredStaffUsers: AppUser[] = [];
  staffSearchText = '';

  filteredMadrasas: Madrasa[] = [];
  madrasaSearchText = '';

  filteredCourses: Course[] = [];
  courseSearchText = '';

  currentCourseStages: string[] = [];
  filteredStages: string[] = [];
  stageSearchText = '';

  selectedCourseId = '';
  selectedStage = '';
  assignments: CourseStageAssignment[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StageHeadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StageHeadDialogData,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.isEdit = !!data.user;
    this.selectedUser = data.user || null;

    this.form = this.fb.group({
      userId: [data.user?.id || data.user?.uid || '', this.isEdit ? [] : [Validators.required]],
      madrasaIds: [data.user?.madrasaIds || [], [Validators.required]],
      genderScope: [data.user?.genderScope || 'all', [Validators.required]],
    });

    if (data.user?.assignedCourseStages) {
      this.assignments = [...data.user.assignedCourseStages];
    } else if (data.user?.assignedCourseIds) {
      this.assignments = data.user.assignedCourseIds.map(cId => ({ courseId: cId }));
    }
  }

  ngOnInit(): void {
    const STAFF_ROLES = ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin', 'superAdmin', 'stageHead'];
    this.availableStaff = (this.data.allStaffUsers || []).filter(u => 
      (u.status || 'active') !== 'disabled' && (STAFF_ROLES.includes(u.role) || (u as any)['entityType'] === 'staff')
    );
    this.filteredStaffUsers = [...this.availableStaff];
    this.filteredMadrasas = [...(this.data.madrasas || [])];
    this.filteredCourses = [...(this.data.courses || [])];
  }

  isAllMadrasasSelected(): boolean {
    const selected: string[] = this.form.get('madrasaIds')?.value || [];
    const allIds = (this.data.madrasas || []).map(m => m.id).filter(Boolean) as string[];
    return allIds.length > 0 && selected.length >= allIds.length;
  }

  toggleSelectAllMadrasas(checked: boolean): void {
    if (checked) {
      const allIds = (this.data.madrasas || []).map(m => m.id).filter(Boolean) as string[];
      this.form.get('madrasaIds')?.setValue(allIds);
    } else {
      this.form.get('madrasaIds')?.setValue([]);
    }
  }

  onMadrasaSelectionChange(selectedValues: string[]): void {
    // Standard selection change handler
  }

  filterStaff(): void {
    const q = this.staffSearchText.toLowerCase().trim();
    if (!q) {
      this.filteredStaffUsers = [...this.availableStaff];
    } else {
      this.filteredStaffUsers = this.availableStaff.filter(
        u => u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
  }

  filterMadrasas(): void {
    const q = this.madrasaSearchText.toLowerCase().trim();
    if (!q) {
      this.filteredMadrasas = [...(this.data.madrasas || [])];
    } else {
      this.filteredMadrasas = (this.data.madrasas || []).filter(
        m => m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q))
      );
    }
  }

  filterCourses(): void {
    const q = this.courseSearchText.toLowerCase().trim();
    if (!q) {
      this.filteredCourses = [...(this.data.courses || [])];
    } else {
      this.filteredCourses = (this.data.courses || []).filter(
        c => c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))
      );
    }
  }

  filterStages(): void {
    const q = this.stageSearchText.toLowerCase().trim();
    if (!q) {
      this.filteredStages = [...this.currentCourseStages];
    } else {
      this.filteredStages = this.currentCourseStages.filter(st => st.toLowerCase().includes(q));
    }
  }

  onUserSelected(userId: string): void {
    this.selectedUser = this.data.allStaffUsers.find(u => u.id === userId || u.uid === userId) || null;
  }

  onCourseChange(courseId: string): void {
    const course = this.data.courses.find(c => c.id === courseId);
    let stages: string[] = [];
    if (course) {
      if (Array.isArray(course.stages) && course.stages.length > 0) {
        stages = course.stages;
      } else {
        const typeKey = (course.type || (course as any)['courseType'] || '').toLowerCase();
        stages = DEFAULT_STAGES_BY_COURSE_TYPE[typeKey] || [];
      }
    }

    this.currentCourseStages = stages;
    this.filteredStages = [...this.currentCourseStages];
    this.stageSearchText = '';
    this.selectedStage = '';
  }

  getConflictMessage(courseId: string, stage?: string): string | null {
    const targetUserId = this.selectedUser ? (this.selectedUser.id || this.selectedUser.uid) : null;
    const targetMadrasaIds: string[] = this.form.value?.madrasaIds || [];
    const targetGenderScope: string = this.form.value?.genderScope || 'all';

    const courseName = this.getCourseName(courseId);
    const stageDisplay = stage ? stage : 'All Stages';

    for (const otherUser of (this.data.allStaffUsers || [])) {
      const otherId = otherUser.id || otherUser.uid;
      if (targetUserId && otherId === targetUserId) continue;

      const otherAssignments = otherUser.assignedCourseStages || [];
      if (otherAssignments.length === 0) continue;

      const otherMadrasaIds: string[] = otherUser.madrasaIds || [];
      const madrasaOverlaps = targetMadrasaIds.length === 0 ||
        otherMadrasaIds.length === 0 ||
        targetMadrasaIds.some(id => otherMadrasaIds.includes(id));

      if (!madrasaOverlaps) continue;

      const otherGender = otherUser.genderScope || 'all';
      const genderOverlaps = targetGenderScope === 'all' ||
        otherGender === 'all' ||
        targetGenderScope === otherGender;

      if (!genderOverlaps) continue;

      for (const ass of otherAssignments) {
        if (ass.courseId === courseId) {
          const stageOverlaps = !stage || !ass.stage || stage === ass.stage;
          if (stageOverlaps) {
            const genderLabel = otherGender === 'male' ? 'Boys Section' : otherGender === 'female' ? 'Girls Section' : 'Both Sections';
            const leadName = otherUser.displayName || (otherUser as any)['name'] || otherUser.email || 'another user';
            return `Conflict: ${courseName} (${stageDisplay}) for ${genderLabel} is already assigned to ${leadName}.`;
          }
        }
      }
    }
    return null;
  }

  addAssignment(): void {
    if (!this.selectedCourseId) return;

    const exists = this.assignments.some(
      a => a.courseId === this.selectedCourseId && (a.stage || '') === (this.selectedStage || '')
    );

    if (exists) {
      this.snackBar.open('This course and stage assignment already exists.', 'OK', { duration: 3000 });
      return;
    }

    const conflictMsg = this.getConflictMessage(this.selectedCourseId, this.selectedStage || undefined);
    if (conflictMsg) {
      this.snackBar.open(conflictMsg, 'OK', { duration: 5000 });
      return;
    }

    this.assignments.push({
      courseId: this.selectedCourseId,
      stage: this.selectedStage || undefined,
    });

    this.selectedCourseId = '';
    this.selectedStage = '';
    this.currentCourseStages = [];
    this.filteredStages = [];
  }

  removeAssignment(index: number): void {
    this.assignments.splice(index, 1);
  }

  getCourseName(courseId: string): string {
    const course = this.data.courses.find(c => c.id === courseId);
    return course ? course.name : courseId;
  }

  async save(): Promise<void> {
    if (this.assignments.length === 0 && this.selectedCourseId) {
      this.addAssignment();
    }
    if (this.form.invalid || this.assignments.length === 0) {
      this.snackBar.open('Please select and add a course assignment', 'OK', { duration: 3000 });
      return;
    }

    for (const ass of this.assignments) {
      const conflictMsg = this.getConflictMessage(ass.courseId, ass.stage);
      if (conflictMsg) {
        this.snackBar.open(conflictMsg, 'OK', { duration: 5000 });
        return;
      }
    }
    this.saving = true;

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const formValue = this.form.value;
      const targetUser = this.selectedUser;

      if (!targetUser) {
        this.snackBar.open('Please select a user to assign', 'OK', { duration: 3000 });
        this.saving = false;
        return;
      }

      const assignedCourseIds = Array.from(new Set(this.assignments.map(a => a.courseId)));
      const assignedStages = Array.from(new Set(this.assignments.map(a => a.stage).filter(Boolean))) as string[];

      const existingRole = targetUser.role || 'teacher';
      const roleToSet = ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin', 'superAdmin'].includes(existingRole)
        ? existingRole
        : 'stageHead';

      const updatePayload: Partial<AppUser> = {
        role: roleToSet,
        madrasaIds: formValue.madrasaIds,
        genderScope: formValue.genderScope,
        assignedCourseIds,
        assignedStages,
        assignedCourseStages: this.assignments,
      };

      const docId = targetUser.id || targetUser.uid;

      // Update in users collection
      await this.repo.update('users', docId, updatePayload as any, profile);

      // If user has linked staff entity, update staff collection too
      if (targetUser.entityId && targetUser.entityType === 'staff') {
        await this.repo.update('staff', targetUser.entityId, updatePayload as any, profile).catch(e => {
          console.warn('[StageHeadDialog] Optional staff collection update skipped/failed:', e);
        });
      }

      this.snackBar.open('Stage Head assigned successfully!', 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save Stage Head assignment', 'OK', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }
}
