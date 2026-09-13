import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { firstValueFrom, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { getDeenDeskFirestore } from '../../core/services/firebase-app';

export interface StaffOptionItem {
  id: string;
  name: string;
  role?: string;
  madrasaName?: string;
  groupName?: string;
}

export interface SimpleSlotDialogData {
  entry?: {
    id?: string;
    activityName?: string;
    startTime?: string;
    endTime?: string;
    teacherId?: string;
    teacherName?: string;
    notes?: string;
    dayOfWeek?: string;
  };
  groupId: string;
  classId?: string;
  madrasaId?: string;
  organizationId?: string;
  dayOfWeek: string;
  assignedStaffOptions?: StaffOptionItem[];
}

@Component({
  selector: 'app-simple-timetable-slot-dialog',
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" class="simple-dialog-container">
      <div class="dialog-header">
        <h2>
          <mat-icon class="header-icon">schedule</mat-icon>
          {{ isEdit ? 'Edit Schedule Slot' : 'Add Timetable Period Slot' }}
        </h2>
        <button mat-icon-button mat-dialog-close type="button" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- 1. Activity / Period Name -->
        <div class="form-field-group">
          <label class="field-label">Period / Activity Name *</label>
          <mat-form-field appearance="outline" class="full-width">
            <input matInput formControlName="activityName" placeholder="e.g. Quran Class, Sabaq, Tajweed" />
            <mat-icon matPrefix class="field-prefix-icon book-icon">book</mat-icon>
          </mat-form-field>
        </div>

        <!-- 2. Timing Mode Selection -->
        <div class="form-field-group">
          <label class="field-label">Period Timing *</label>
          <mat-radio-group formControlName="timeMode" class="timing-radio-group">
            <mat-radio-button value="ANYTIME" color="primary">
              <strong>Flexible Timing (Anytime)</strong> &mdash; <span class="subtext">No fixed hours required</span>
            </mat-radio-button>
            <mat-radio-button value="SPECIFIC" color="primary">
              <strong>Specific Hours</strong> &mdash; <span class="subtext">Set Start & End time</span>
            </mat-radio-button>
          </mat-radio-group>

          <!-- Specific Time Pickers (Visible if SPECIFIC selected) -->
          <div class="time-pickers-row" *ngIf="form.get('timeMode')?.value === 'SPECIFIC'">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Start Time</mat-label>
              <input matInput type="time" formControlName="startTime" />
              <mat-icon matPrefix class="field-prefix-icon">access_time</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>End Time</mat-label>
              <input matInput type="time" formControlName="endTime" />
              <mat-icon matPrefix class="field-prefix-icon">access_time</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- 3. Assigned Staff / Ustadh Autocomplete Search -->
        <div class="form-field-group">
          <label class="field-label">Assigned Staff / Ustadh (Optional)</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-icon matPrefix class="field-prefix-icon">person_search</mat-icon>
            <input matInput
                   type="text"
                   placeholder="Search Ustadh or Teacher name..."
                   formControlName="teacherSearch"
                   [matAutocomplete]="auto" />
            <button type="button"
                    mat-icon-button
                    matSuffix
                    *ngIf="form.get('teacherSearch')?.value"
                    (click)="clearTeacherSelection()"
                    title="Clear staff assignment">
              <mat-icon style="font-size: 18px;">clear</mat-icon>
            </button>

            <mat-autocomplete #auto="matAutocomplete"
                              [displayWith]="displayStaffFn"
                              (optionSelected)="onStaffSelected($event)">
              <mat-option *ngFor="let s of filteredStaffList" [value]="s" class="staff-option-item">
                <div class="staff-card">
                  <div class="staff-main-row">
                    <span class="staff-name" [title]="s.name">{{ s.name }}</span>
                    <span class="staff-role-tag" *ngIf="s.role">{{ s.role }}</span>
                  </div>
                  <div class="staff-sub-row" *ngIf="s.madrasaName || s.groupName">
                    <span *ngIf="s.madrasaName">{{ s.madrasaName }}</span>
                    <span class="dot" *ngIf="s.madrasaName && s.groupName">&bull;</span>
                    <span *ngIf="s.groupName" class="group-name">{{ s.groupName }}</span>
                  </div>
                </div>
              </mat-option>
              <mat-option *ngIf="filteredStaffList.length === 0" [disabled]="true">
                <em>No matching teachers found</em>
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
        </div>

        <!-- 4. Notes / Instructions -->
        <div class="form-field-group">
          <label class="field-label">Notes & Instructions (Optional)</label>
          <mat-form-field appearance="outline" class="full-width">
            <textarea matInput formControlName="notes" rows="2" placeholder="Add optional class notes or instructions..."></textarea>
            <mat-icon matPrefix class="field-prefix-icon">notes</mat-icon>
          </mat-form-field>
        </div>

        <!-- 5. Specific Days & Recurrence Duration Selection (Only for New Slots) -->
        <div class="schedule-options-container" *ngIf="!isEdit">
          <label class="field-label">Apply On Specific Days *</label>

          <!-- Quick Day Presets -->
          <div class="day-presets-row">
            <button type="button" class="preset-pill" [class.active]="isAllDaysSelected" (click)="selectDayPreset('ALL')">
              All 7 Days (Mon&ndash;Sun)
            </button>
            <button type="button" class="preset-pill" [class.active]="isWeekdaysSelected" (click)="selectDayPreset('WEEKDAYS')">
              Weekdays (Mon&ndash;Fri)
            </button>
            <button type="button" class="preset-pill" [class.active]="isSingleDaySelected" (click)="selectDayPreset('SINGLE')">
              {{ data.dayOfWeek || getTodayDayName() }}
            </button>
          </div>

          <!-- Day Chips Grid -->
          <div class="day-chips-grid">
            <button type="button"
                    class="day-chip"
                    *ngFor="let day of allDaysList"
                    [class.selected]="selectedDaysSet.has(day.fullName)"
                    (click)="toggleDaySelection(day.fullName)">
              <span class="day-abbr">{{ day.shortName }}</span>
              <mat-icon class="check-icon" *ngIf="selectedDaysSet.has(day.fullName)">check_circle</mat-icon>
            </button>
          </div>

          <!-- Recurrence Duration / Validity Selector -->
          <div class="recurrence-duration-group">
            <label class="field-label" style="margin-top: 14px;">Schedule Validity / Duration *</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-select formControlName="recurrenceRange">
                <mat-select-trigger>
                  <ng-container [ngSwitch]="form.get('recurrenceRange')?.value">
                    <span *ngSwitchCase="'ONGOING'">Weekly Routine (Ongoing)</span>
                    <span *ngSwitchCase="'SINGLE_DAY'">For 1 Day Only (Single Day)</span>
                    <span *ngSwitchCase="'WEEK_1'">For 1 Week (7 Days)</span>
                    <span *ngSwitchCase="'WEEK_2'">For 2 Weeks (14 Days)</span>
                    <span *ngSwitchCase="'MONTH_1'">For 1 Month (30 Days)</span>
                    <span *ngSwitchCase="'MONTH_2'">For 2 Months (60 Days)</span>
                    <span *ngSwitchCase="'MONTH_3'">For 3 Months (90 Days)</span>
                    <span *ngSwitchCase="'MONTH_6'">For 6 Months (180 Days)</span>
                    <span *ngSwitchCase="'ACADEMIC_YEAR'">Full Academic Year (365 Days)</span>
                    <span *ngSwitchCase="'CUSTOM'">Custom Date Range</span>
                    <span *ngSwitchDefault>Weekly Routine (Ongoing)</span>
                  </ng-container>
                </mat-select-trigger>

                <mat-option value="ONGOING">
                  <div class="select-option-row">
                    <mat-icon style="color: #6366f1; margin-right: 8px;">all_inclusive</mat-icon>
                    <span><strong>Weekly Routine (Ongoing)</strong> &mdash; Applies every week</span>
                  </div>
                </mat-option>

                <mat-option value="SINGLE_DAY">
                  <div class="select-option-row">
                    <mat-icon style="color: #f43f5e; margin-right: 8px;">filter_1</mat-icon>
                    <span><strong>For 1 Day Only</strong> &mdash; Applies for 1 single day</span>
                  </div>
                </mat-option>

                <mat-option value="WEEK_1">
                  <div class="select-option-row">
                    <mat-icon style="color: #8b5cf6; margin-right: 8px;">date_range</mat-icon>
                    <span><strong>For 1 Week</strong> &mdash; Repeat for 7 days</span>
                  </div>
                </mat-option>

                <mat-option value="WEEK_2">
                  <div class="select-option-row">
                    <mat-icon style="color: #06b6d4; margin-right: 8px;">date_range</mat-icon>
                    <span><strong>For 2 Weeks</strong> &mdash; Repeat for 14 days</span>
                  </div>
                </mat-option>

                <mat-option value="MONTH_1">
                  <div class="select-option-row">
                    <mat-icon style="color: #10b981; margin-right: 8px;">event_note</mat-icon>
                    <span><strong>For 1 Month</strong> &mdash; Repeat for 30 days</span>
                  </div>
                </mat-option>

                <mat-option value="MONTH_2">
                  <div class="select-option-row">
                    <mat-icon style="color: #f59e0b; margin-right: 8px;">calendar_today</mat-icon>
                    <span><strong>For 2 Months</strong> &mdash; Repeat for 60 days</span>
                  </div>
                </mat-option>

                <mat-option value="MONTH_3">
                  <div class="select-option-row">
                    <mat-icon style="color: #3b82f6; margin-right: 8px;">calendar_month</mat-icon>
                    <span><strong>For 3 Months</strong> &mdash; Repeat for 90 days</span>
                  </div>
                </mat-option>

                <mat-option value="MONTH_6">
                  <div class="select-option-row">
                    <mat-icon style="color: #ec4899; margin-right: 8px;">event_available</mat-icon>
                    <span><strong>For 6 Months</strong> &mdash; Repeat for 180 days</span>
                  </div>
                </mat-option>

                <mat-option value="ACADEMIC_YEAR">
                  <div class="select-option-row">
                    <mat-icon style="color: #059669; margin-right: 8px;">school</mat-icon>
                    <span><strong>Full Academic Year</strong> &mdash; Repeat for 365 days</span>
                  </div>
                </mat-option>

                <mat-option value="CUSTOM">
                  <div class="select-option-row">
                    <mat-icon style="color: #64748b; margin-right: 8px;">edit_calendar</mat-icon>
                    <span><strong>Custom Date Range...</strong> &mdash; Pick start & end date</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matPrefix class="field-prefix-icon">repeat</mat-icon>
            </mat-form-field>

            <!-- Custom Date Pickers (Shown if CUSTOM selected) -->
            <div class="time-pickers-row" *ngIf="form.get('recurrenceRange')?.value === 'CUSTOM'" style="margin-top: 10px;">
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Start Date</mat-label>
                <input matInput type="date" formControlName="customStartDate" />
                <mat-icon matPrefix class="field-prefix-icon">today</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="half-width">
                <mat-label>End Date</mat-label>
                <input matInput type="date" formControlName="customEndDate" />
                <mat-icon matPrefix class="field-prefix-icon">event</mat-icon>
              </mat-form-field>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog Footer Actions -->
      <div class="dialog-actions">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-button color="warn" type="button" *ngIf="isEdit" (click)="deleteSlot()">
          <mat-icon>delete</mat-icon> Delete Slot
        </button>
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || isSaving || (!isEdit && selectedDaysSet.size === 0)">
          <mat-icon>check_circle</mat-icon> {{ isEdit ? 'Update Slot' : 'Save Slot' }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 85vh;
      overflow: hidden;
    }

    ::ng-deep .simple-timetable-dialog-panel .mat-dialog-container,
    ::ng-deep .simple-timetable-dialog-panel .mat-mdc-dialog-container,
    ::ng-deep .simple-timetable-dialog-panel .mat-mdc-dialog-surface {
      padding: 0 !important;
      overflow: hidden !important;
      border-radius: 16px !important;
      display: flex !important;
      flex-direction: column !important;
      max-height: 85vh !important;
    }

    .simple-dialog-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 85vh;
      box-sizing: border-box;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      font-family: Inter, Roboto, 'Helvetica Neue', sans-serif;

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        border-bottom: 1px solid #f1f5f9;
        flex-shrink: 0;
        background: #ffffff;
        z-index: 2;

        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;

          .header-icon {
            color: #6366f1;
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .close-btn {
          color: #64748b;
        }
      }

      .dialog-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 20px 24px;
        box-sizing: border-box;

        &::-webkit-scrollbar {
          width: 6px;
        }
        &::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        &::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        &::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .full-width {
          width: 100% !important;
          display: block;
        }

        .form-field-group {
          margin-bottom: 18px;
          width: 100%;

          .field-label {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: #334155;
            margin-bottom: 6px;
          }

          .full-width {
            width: 100% !important;
            display: block;
          }

          .field-prefix-icon {
            color: #64748b;
            margin-right: 8px;

            &.book-icon {
              color: #6366f1;
            }
          }

          .timing-radio-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #f8fafc;
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 10px;

            .subtext {
              font-size: 0.82rem;
              color: #64748b;
              font-weight: 400;
            }
          }

          .time-pickers-row {
            display: flex;
            gap: 14px;
            margin-top: 10px;
            width: 100%;

            .half-width {
              flex: 1;
              width: 100%;
            }

            @media (max-width: 600px) {
              flex-direction: column;
              gap: 10px;
            }
          }
        }

        .schedule-options-container {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          width: 100%;
          box-sizing: border-box;

          .field-label {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: #334155;
            margin-bottom: 8px;
          }

          .day-presets-row {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: wrap;

            .preset-pill {
              font-size: 0.78rem;
              font-weight: 600;
              padding: 5px 14px;
              border-radius: 20px;
              background: #ffffff;
              border: 1px solid #cbd5e1;
              color: #475569;
              cursor: pointer;
              transition: all 0.2s ease;

              &:hover {
                border-color: #6366f1;
                color: #6366f1;
              }

              &.active {
                background: #6366f1;
                border-color: #6366f1;
                color: #ffffff;
              }
            }
          }

          .day-chips-grid {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;

            .day-chip {
              flex: 1;
              min-width: 44px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              padding: 8px 6px;
              border-radius: 10px;
              background: #ffffff;
              border: 1px solid #cbd5e1;
              color: #334155;
              font-weight: 700;
              font-size: 0.82rem;
              cursor: pointer;
              transition: all 0.2s ease;

              &:hover {
                border-color: #3b82f6;
              }

              &.selected {
                background: #eff6ff;
                border-color: #3b82f6;
                color: #2563eb;

                .check-icon {
                  font-size: 14px;
                  width: 14px;
                  height: 14px;
                  color: #2563eb;
                }
              }
            }
          }

          .recurrence-duration-group {
            width: 100%;
            margin-top: 10px;

            .full-width {
              width: 100% !important;
              display: block;
            }

            .time-pickers-row {
              display: flex;
              gap: 14px;
              margin-top: 10px;
              width: 100%;

              .half-width {
                flex: 1;
                width: 100%;
              }

              @media (max-width: 600px) {
                flex-direction: column;
                gap: 10px;
              }
            }
          }

          .select-option-row {
            display: flex;
            align-items: center;
          }
        }
      }

      .dialog-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 14px 24px;
        border-top: 1px solid #f1f5f9;
        flex-shrink: 0;
        background: #ffffff;
        z-index: 2;

        button {
          border-radius: 8px;
          font-weight: 600;
          padding: 4px 16px;
        }

        @media (max-width: 600px) {
          padding: 12px 16px;
          gap: 8px;

          button {
            padding: 4px 12px;
            font-size: 0.85rem;
          }
        }
      }
    }

    ::ng-deep .staff-option-item {
      height: auto !important;
      min-height: 48px !important;
      padding: 8px 14px !important;
      border-bottom: 1px solid #f8fafc;

      .mat-option-text {
        width: 100%;
        overflow: hidden;
      }

      &:hover {
        background: #f8fafc !important;
      }

      .staff-card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 100%;

        .staff-main-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;

          .staff-name {
            font-weight: 600;
            color: #0f172a;
            font-size: 0.88rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            min-width: 0;
          }

          .staff-role-tag {
            font-size: 0.7rem;
            font-weight: 600;
            background: #e0e7ff;
            color: #4338ca;
            padding: 2px 8px;
            border-radius: 6px;
            text-transform: capitalize;
            flex-shrink: 0;
            white-space: nowrap;
          }
        }

        .staff-sub-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          .dot {
            color: #cbd5e1;
          }

          .group-name {
            color: #475569;
            font-weight: 500;
          }
        }
      }
    }
  `],
  standalone: false
})
export class SimpleTimetableSlotDialogComponent implements OnInit {
  form = this.fb.nonNullable.group({
    activityName: ['Quran Class', Validators.required],
    timeMode: ['ANYTIME'],
    startTime: ['09:00'],
    endTime: ['10:00'],
    teacherSearch: ['' as string | StaffOptionItem],
    teacherId: [''],
    notes: [''],
    recurrenceRange: ['ONGOING'],
    customStartDate: [''],
    customEndDate: ['']
  });

  isEdit = false;
  isSaving = false;
  staffList: StaffOptionItem[] = [];
  filteredStaffList: StaffOptionItem[] = [];

  allDaysList = [
    { fullName: 'Monday', shortName: 'Mon' },
    { fullName: 'Tuesday', shortName: 'Tue' },
    { fullName: 'Wednesday', shortName: 'Wed' },
    { fullName: 'Thursday', shortName: 'Thu' },
    { fullName: 'Friday', shortName: 'Fri' },
    { fullName: 'Saturday', shortName: 'Sat' },
    { fullName: 'Sunday', shortName: 'Sun' }
  ];

  selectedDaysSet = new Set<string>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    public readonly dialogRef: MatDialogRef<SimpleTimetableSlotDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SimpleSlotDialogData
  ) {}

  getTodayDayName(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }

  async ngOnInit(): Promise<void> {
    this.isEdit = !!this.data.entry?.id;

    if (!this.isEdit) {
      const defaultDay = this.data.dayOfWeek || this.getTodayDayName();
      this.selectedDaysSet.clear();
      this.selectedDaysSet.add(defaultDay);
    }

    if (this.data.assignedStaffOptions && this.data.assignedStaffOptions.length > 0) {
      this.staffList = this.data.assignedStaffOptions;
    } else {
      const user = await firstValueFrom(this.auth.profile$);
      if (user) {
        const isOrgAdminUser = user.role === 'organizationAdmin' || user.role === 'superAdmin';
        const TEACHING_ROLES = ['teacher', 'staff', 'madrasaincharge', 'ustadh', 'coordinator', 'instructor'];
        this.repo.list<EntityRecord>('staff', user).subscribe((staff) => {
          this.staffList = (staff || [])
            .filter(s => {
              if (!isOrgAdminUser && this.data.madrasaId && s['madrasaId'] && s['madrasaId'] !== this.data.madrasaId) return false;
              if (isOrgAdminUser) return true;
              const role = String(s['role'] || s['designation'] || '').toLowerCase();
              return !role || TEACHING_ROLES.some(r => role.includes(r));
            })
            .map(s => ({
              id: s.id || s['name'],
              name: s['name'] || s['fullName'] || s['displayName'] || 'Staff Member',
              role: s['role'] || s['designation'] || 'Ustadh',
              madrasaName: s['madrasaName'] || '',
              groupName: s['groupName'] || s['classGroupName'] || ''
            }));
          this.updateFilteredStaff('');
        });
      }
    }

    this.filteredStaffList = [...this.staffList];

    // Listen to autocomplete search changes
    this.form.get('teacherSearch')?.valueChanges.pipe(
      startWith('')
    ).subscribe(val => {
      const query = typeof val === 'string' ? val : (val?.name || '');
      this.updateFilteredStaff(query);
    });

    if (this.data.entry) {
      const isAnytime = !this.data.entry.startTime || this.data.entry.startTime === 'Anytime' || this.data.entry.startTime === 'Flexible';
      const existingTeacherId = this.data.entry.teacherId || '';
      const existingTeacherName = this.data.entry.teacherName || '';
      let matchingStaff = this.staffList.find(s => s.id === existingTeacherId);
      if (!matchingStaff && existingTeacherName) {
        matchingStaff = { id: existingTeacherId, name: existingTeacherName };
      }

      this.form.patchValue({
        activityName: this.data.entry.activityName || 'Quran Class',
        timeMode: isAnytime ? 'ANYTIME' : 'SPECIFIC',
        startTime: isAnytime ? '09:00' : (this.data.entry.startTime || '09:00'),
        endTime: this.data.entry.endTime || '10:00',
        teacherId: existingTeacherId,
        teacherSearch: matchingStaff || existingTeacherName || '',
        notes: this.data.entry.notes || ''
      });
    }
  }

  get isAllDaysSelected(): boolean {
    return this.selectedDaysSet.size === 7;
  }

  get isWeekdaysSelected(): boolean {
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    return this.selectedDaysSet.size === 5 && weekdays.every(d => this.selectedDaysSet.has(d));
  }

  get isSingleDaySelected(): boolean {
    const singleDay = this.data.dayOfWeek || this.getTodayDayName();
    return this.selectedDaysSet.size === 1 && this.selectedDaysSet.has(singleDay);
  }

  selectDayPreset(preset: 'ALL' | 'WEEKDAYS' | 'SINGLE'): void {
    this.selectedDaysSet.clear();
    if (preset === 'ALL') {
      this.allDaysList.forEach(d => this.selectedDaysSet.add(d.fullName));
    } else if (preset === 'WEEKDAYS') {
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(d => this.selectedDaysSet.add(d));
    } else if (preset === 'SINGLE') {
      this.selectedDaysSet.add(this.data.dayOfWeek || this.getTodayDayName());
    }
  }

  toggleDaySelection(dayName: string): void {
    if (this.selectedDaysSet.has(dayName)) {
      if (this.selectedDaysSet.size > 1) {
        this.selectedDaysSet.delete(dayName);
      }
    } else {
      this.selectedDaysSet.add(dayName);
    }
  }

  displayStaffFn(staff?: StaffOptionItem | string): string {
    if (!staff) return '';
    return typeof staff === 'string' ? staff : staff.name;
  }

  onStaffSelected(event: MatAutocompleteSelectedEvent): void {
    const selected: StaffOptionItem = event.option.value;
    if (selected && selected.id) {
      this.form.patchValue({ teacherId: selected.id });
    }
  }

  clearTeacherSelection(): void {
    this.form.patchValue({ teacherSearch: '', teacherId: '' });
    this.updateFilteredStaff('');
  }

  private updateFilteredStaff(query: string): void {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.filteredStaffList = [...this.staffList];
    } else {
      this.filteredStaffList = this.staffList.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.role || '').toLowerCase().includes(q) ||
        (s.madrasaName || '').toLowerCase().includes(q) ||
        (s.groupName || '').toLowerCase().includes(q)
      );
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.isSaving) return;

    try {
      this.isSaving = true;
      const user = await firstValueFrom(this.auth.profile$);
      if (!user) return;

      const val = this.form.getRawValue();
      const teacherSearchVal = val.teacherSearch;
      let teacherId = val.teacherId;
      let teacherName = '';

      if (typeof teacherSearchVal === 'object' && teacherSearchVal !== null) {
        teacherId = teacherSearchVal.id;
        teacherName = teacherSearchVal.name;
      } else if (typeof teacherSearchVal === 'string' && teacherSearchVal.trim()) {
        const found = this.staffList.find(s => s.id === teacherId || s.name.toLowerCase() === teacherSearchVal.toLowerCase());
        teacherName = found ? found.name : teacherSearchVal.trim();
        if (found) teacherId = found.id;
      }

      const isAnytime = val.timeMode === 'ANYTIME';
      const startTime = isAnytime ? 'Anytime' : val.startTime;
      const endTime = isAnytime ? '' : val.endTime;

      if (this.isEdit && this.data.entry?.id) {
        // Update existing entry
        const updatePayload = {
          activityName: val.activityName,
          startTime: startTime,
          endTime: endTime,
          teacherId: teacherId || null,
          teacherName: teacherName || null,
          description: val.notes || null,
          notes: val.notes || null,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid
        };

        await this.repo.update('timetableEntries', this.data.entry.id, updatePayload, user);
        this.snackBar.open('Schedule slot updated successfully!', 'Dismiss', { duration: 3000 });
      } else {
        // Create new entry
        const daysToCreate = Array.from(this.selectedDaysSet);
        const recurrenceRange = val.recurrenceRange || 'ONGOING';
        let numDays = 0;
        if (recurrenceRange === 'WEEK_1') numDays = 7;
        else if (recurrenceRange === 'WEEK_2') numDays = 14;
        else if (recurrenceRange === 'MONTH_1') numDays = 30;
        else if (recurrenceRange === 'MONTH_2') numDays = 60;
        else if (recurrenceRange === 'MONTH_3') numDays = 90;
        else if (recurrenceRange === 'MONTH_6') numDays = 180;
        else if (recurrenceRange === 'ACADEMIC_YEAR') numDays = 365;

        let startDateStr: string | null = null;
        let endDateStr: string | null = null;

        if (recurrenceRange === 'CUSTOM') {
          startDateStr = val.customStartDate || new Date().toISOString().split('T')[0];
          endDateStr = val.customEndDate || null;
        } else if (numDays > 0) {
          startDateStr = new Date().toISOString().split('T')[0];
          const endDateObj = new Date();
          endDateObj.setDate(endDateObj.getDate() + numDays);
          endDateStr = endDateObj.toISOString().split('T')[0];
        }

        for (const day of daysToCreate) {
          const createPayload = {
            classPlanId: this.data.groupId,
            groupId: this.data.groupId,
            classId: this.data.classId || '',
            madrasaId: this.data.madrasaId || '',
            organizationId: this.data.organizationId || user.organizationId || '',
            activityName: val.activityName,
            hifzSessionType: 'sabak',
            dayOfWeek: day,
            startTime: startTime,
            endTime: endTime,
            teacherId: teacherId || null,
            teacherName: teacherName || null,
            description: val.notes || null,
            notes: val.notes || null,
            scheduleType: 'period',
            recurrenceRange: recurrenceRange,
            startDate: startDateStr,
            endDate: endDateStr,
            status: 'active',
            createdAt: Timestamp.now(),
            createdBy: user.uid
          };

          await this.repo.create('timetableEntries', createPayload, user);
        }

        const durationText = recurrenceRange === 'MONTH_1' ? 'for 1 Month' : (recurrenceRange === 'MONTH_3' ? 'for 3 Months' : 'routine');
        this.snackBar.open(`Schedule slot created for ${daysToCreate.length} day(s) (${durationText})!`, 'Dismiss', { duration: 3500 });
      }

      this.repo.clearCache();
      this.dialogRef.close(true);
    } catch (err) {
      console.error('Error saving timetable slot:', err);
      this.snackBar.open('Failed to save schedule slot', 'Close', { duration: 3500 });
    } finally {
      this.isSaving = false;
    }
  }

  async deleteSlot(): Promise<void> {
    if (!this.data.entry?.id) return;
    try {
      this.isSaving = true;
      const user = await firstValueFrom(this.auth.profile$);
      if (!user) return;

      const firestore = getDeenDeskFirestore();
      await deleteDoc(doc(firestore, 'timetableEntries', this.data.entry.id));
      this.repo.clearCache();
      this.snackBar.open('Schedule slot deleted.', 'Dismiss', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err) {
      console.error('Error deleting timetable slot:', err);
      this.snackBar.open('Failed to delete slot', 'Close', { duration: 3500 });
    } finally {
      this.isSaving = false;
    }
  }
}
