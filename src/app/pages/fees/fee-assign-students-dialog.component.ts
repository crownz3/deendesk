import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { FeePlan } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { FeeService } from '../../core/services/fee.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';

@Component({
  selector: 'app-fee-assign-students-dialog',
  template: `
    <h2 mat-dialog-title>Assign Students to Fee Plan</h2>
    <mat-dialog-content>
      <div class="plan-info">
        <strong>{{ data.plan['title'] }}</strong>
        <span class="chip">₹{{ data.plan['amount'] }}</span>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Search students</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" placeholder="Name...">
        </mat-form-field>
      </div>

      <div class="selection-actions">
        <button mat-stroked-button type="button" (click)="selectAll()">Select All</button>
        <button mat-stroked-button type="button" (click)="deselectAll()">Deselect All</button>
        <span class="selected-count">{{ selectedIds.size }} selected</span>
      </div>

      <div class="student-list">
        <mat-checkbox
          *ngFor="let student of filteredStudents(); trackBy: trackById"
          [checked]="selectedIds.has(student.id || '')"
          (change)="toggle(student)"
          class="student-item">
          <span class="student-name">{{ student['name'] || student['displayName'] }}</span>
          <span class="student-meta" *ngIf="student['className'] || student['courseName']">
            {{ student['courseName'] }} / {{ student['className'] }}
          </span>
        </mat-checkbox>

        <div class="empty" *ngIf="filteredStudents().length === 0">
          No students found for the current scope.
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary"
        [disabled]="selectedIds.size === 0 || assigning"
        (click)="assign()">
        {{ assigning ? 'Assigning...' : ('Assign ' + selectedIds.size + ' Students') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .plan-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: rgba(59, 130, 246, 0.05);
      border-radius: 10px;
      margin-bottom: 16px;
      border: 1px solid rgba(59, 130, 246, 0.1);
    }
    .plan-info strong { font-size: 16px; flex: 1; }
    .chip {
      padding: 4px 12px;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
      font-weight: 600;
      font-size: 14px;
    }
    .filters { margin-bottom: 12px; }
    .full-width { width: 100%; }
    .selection-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .selected-count {
      margin-left: auto;
      font-size: 13px;
      color: #6b7280;
      font-weight: 500;
    }
    .student-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 8px;
    }
    .student-item {
      display: flex !important;
      padding: 8px 4px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    }
    .student-name { font-weight: 500; }
    .student-meta {
      font-size: 12px;
      color: #6b7280;
      margin-left: 8px;
    }
    .empty {
      text-align: center;
      padding: 24px;
      color: #9ca3af;
      font-size: 14px;
    }
    mat-dialog-content { max-height: 70vh; overflow-y: auto; }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
  `],
  standalone: false,
})
export class FeeAssignStudentsDialogComponent implements OnInit {
  students: EntityRecord[] = [];
  selectedIds = new Set<string>();
  searchQuery = '';
  assigning = false;

  constructor(
    private readonly dialogRef: MatDialogRef<FeeAssignStudentsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: EntityRecord },
    private readonly auth: AuthService,
    private readonly feeService: FeeService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {}

  async ngOnInit(): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    if (profile) {
      this.repo.list<EntityRecord>('students', profile).subscribe((students) => {
        let filtered = students;
        const plan = this.data.plan;
        if (plan['applicableMadrasaId']) {
          filtered = filtered.filter((s) => s['madrasaId'] === plan['applicableMadrasaId']);
        }
        if (plan['applicableCourseId']) {
          filtered = filtered.filter((s) => s['courseId'] === plan['applicableCourseId']);
        }
        if (plan['applicableClassId']) {
          filtered = filtered.filter((s) => s['classId'] === plan['applicableClassId']);
        }
        if (plan['applicableGroupId']) {
          filtered = filtered.filter((s) => s['groupId'] === plan['applicableGroupId']);
        }
        this.students = filtered;
      });
    }
  }

  trackById(_: number, item: EntityRecord): string {
    return item.id || '';
  }

  filteredStudents(): EntityRecord[] {
    if (!this.searchQuery) return this.students;
    const q = this.searchQuery.toLowerCase();
    return this.students.filter(
      (s) =>
        (s['name']?.toString().toLowerCase() || '').includes(q) ||
        (s['displayName']?.toString().toLowerCase() || '').includes(q)
    );
  }

  toggle(student: EntityRecord): void {
    const id = student.id || '';
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  selectAll(): void {
    this.filteredStudents().forEach((s) => {
      if (s.id) this.selectedIds.add(s.id);
    });
  }

  deselectAll(): void {
    this.selectedIds.clear();
  }

  async assign(): Promise<void> {
    if (this.selectedIds.size === 0) return;
    this.assigning = true;

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const selected = this.students.filter((s) => this.selectedIds.has(s.id || ''));

      const plan = {
        ...this.data.plan,
        id: String(this.data.plan.id),
      } as FeePlan & { id: string };

      const count = await this.feeService.assignFeePlanToStudents(plan, selected, profile);
      this.snackBar.open(`Fee plan assigned to ${count} students.`, 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error('[Assign Students] Error:', err);
      this.snackBar.open(err?.message || 'Failed to assign.', 'OK', { duration: 5000 });
    } finally {
      this.assigning = false;
    }
  }
}
