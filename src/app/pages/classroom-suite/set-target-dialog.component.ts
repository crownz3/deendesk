import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ALL_QURAN_SURAHS, SURAH_AYAH_COUNT, getSurahAyahCount } from '../../core/constants/defaults';
import { EntityRecord } from '../../core/services/repository.service';

export interface SetTargetDialogData {
  student: EntityRecord;
  studentTypeMode: 'hifz' | 'maktab' | 'dawr';
  currentTarget?: any;
  defaultDawrRounds?: number;
}

@Component({
  selector: 'app-set-target-dialog',
  template: `
    <div class="target-dialog-header">
      <div class="header-title-box">
        <mat-icon class="target-icon">gps_fixed</mat-icon>
        <div>
          <h2>Set Target Goal: {{ student['fullName'] || student['name'] }}</h2>
          <p class="subtitle" *ngIf="student['admissionNo']">Admission #{{ student['admissionNo'] }} | Mode: <strong>{{ studentTypeMode | uppercase }}</strong></p>
        </div>
      </div>
      <button mat-icon-button type="button" (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="target-dialog-body">

      <!-- Target Period & Date Range Selection -->
      <div class="card-section date-section">
        <label class="section-label"><mat-icon>calendar_today</mat-icon> Target Duration & Date Range</label>
        
        <div class="period-pills-row">
          <button type="button" class="period-pill" [class.active]="targetPeriod === 'weekly'" (click)="setTargetPeriod('weekly')">
            📆 Weekly (7 Days)
          </button>
          <button type="button" class="period-pill" [class.active]="targetPeriod === 'monthly'" (click)="setTargetPeriod('monthly')">
            📅 Monthly (30 Days)
          </button>
          <button type="button" class="period-pill" [class.active]="targetPeriod === 'custom'" (click)="setTargetPeriod('custom')">
            ⚙️ Custom Range
          </button>
        </div>

        <div class="dates-grid">
          <div>
            <label>Start Date:</label>
            <mat-form-field appearance="outline" class="full-width-field" subscriptSizing="dynamic">
              <input matInput [matDatepicker]="pickerStart" [value]="startDateObj" (dateChange)="onStartDateObjChange($event.value)" readonly />
              <mat-datepicker-toggle matIconSuffix [for]="pickerStart"></mat-datepicker-toggle>
              <mat-datepicker #pickerStart></mat-datepicker>
            </mat-form-field>
          </div>
          <div>
            <label>Target End Date:</label>
            <mat-form-field appearance="outline" class="full-width-field" subscriptSizing="dynamic">
              <input matInput [matDatepicker]="pickerEnd" [value]="endDateObj" (dateChange)="onEndDateObjChange($event.value)" readonly />
              <mat-datepicker-toggle matIconSuffix [for]="pickerEnd"></mat-datepicker-toggle>
              <mat-datepicker #pickerEnd></mat-datepicker>
            </mat-form-field>
          </div>
        </div>

        <div class="period-summary-badge">
          <mat-icon>info</mat-icon> Target Active: <strong>{{ formatDateDisplay(startDate) }}</strong> to <strong>{{ formatDateDisplay(endDate) }}</strong> ({{ calculatedDays }} Days)
        </div>
      </div>

      <!-- Incomplete Target & Carry-Over Rollover Section -->
      <div class="card-section warning-section" *ngIf="isIncomplete || showRolloverSection">
        <div class="warning-title">
          <mat-icon color="warn">warning</mat-icon>
          <strong>Previous Target Incomplete / Delayed</strong>
        </div>
        <p class="warning-desc">The previous target period ended before the goal was completed. You can carry over the remaining portion to the new date range.</p>

        <div class="rollover-controls">
          <label>Reason for Incomplete Target:</label>
          <select class="dialog-select" [(ngModel)]="incompleteReason">
            <option value="Medical / Illness" label="Medical / Illness Leave">Medical / Illness Leave</option>
            <option value="Student Absence" label="Student Absence / Leave">Student Absence / Leave</option>
            <option value="Tajweed Practice" label="Needs Extra Tajweed & Revision Practice">Needs Extra Tajweed & Revision Practice</option>
            <option value="Slow Memorization Pace" label="Slow Memorization Pace">Slow Memorization Pace</option>
            <option value="Holiday / Break" label="Holiday / Event Break">Holiday / Event Break</option>
            <option value="Custom Reason" label="Other Reason (Specify below)">Other Reason (Specify below)</option>
          </select>

          <input type="text" class="dialog-input" style="margin-top: 8px;" [(ngModel)]="incompleteNotes" placeholder="Additional teacher notes on why target was delayed..." />

          <button type="button" class="rollover-btn" (click)="applyRollover()">
            <mat-icon>autorenew</mat-icon> Rollover & Carry Over Target Portion to New Range
          </button>
        </div>
      </div>

      <!-- Portion-Specific Target Goal Inputs -->
      <div class="card-section targets-content">
        
        <!-- HIFZ MODE TARGETS (Sabaq, Sabqi, Manzil) -->
        <div *ngIf="studentTypeMode === 'hifz'">
          <div class="portion-tabs-header">
            <button type="button" class="p-tab-btn" [class.active]="activeHifzTab === 'sabaq'" (click)="activeHifzTab = 'sabaq'">
              📖 New Lesson
            </button>
            <button type="button" class="p-tab-btn" [class.active]="activeHifzTab === 'sabqi'" (click)="activeHifzTab = 'sabqi'">
              📗 Old Lesson (Sabaq)
            </button>
            <button type="button" class="p-tab-btn" [class.active]="activeHifzTab === 'manzil'" (click)="activeHifzTab = 'manzil'">
              📙 Revision / Old Lesson
            </button>
          </div>

          <!-- Sabaq Target -->
          <div class="tab-box" *ngIf="activeHifzTab === 'sabaq'">
            
            <div style="margin-bottom: 12px; display: flex; gap: 16px; align-items: center;">
              <label style="margin:0;">Target Mode:</label>
              <mat-radio-group [(ngModel)]="sabaqTargetMode" style="display:flex; gap: 12px;">
                <mat-radio-button value="surah">By Surah</mat-radio-button>
                <mat-radio-button value="juz">By Juz</mat-radio-button>
              </mat-radio-group>
            </div>

            <ng-container *ngIf="sabaqTargetMode === 'surah'">
              <label>Target Surah Name (Auto-complete 114 Surahs):</label>
              <mat-form-field appearance="outline" class="full-width-field" subscriptSizing="dynamic">
              <input type="text" matInput [(ngModel)]="sabaqSurah" (input)="filterSurahs()" [matAutocomplete]="autoSurah" placeholder="Type Surah name (e.g. Al-Baqarah)..." />
              <button mat-icon-button matSuffix *ngIf="sabaqSurah" (click)="sabaqSurah=''; filterSurahs(); sabaqFromAyah=null; sabaqToAyah=null;">
                <mat-icon>close</mat-icon>
              </button>
              <mat-autocomplete #autoSurah="matAutocomplete" (optionSelected)="onSurahSelected($event.option.value)">
                <mat-option *ngFor="let surah of filteredSurahs" [value]="surah">
                  {{ surah }}
                </mat-option>
              </mat-autocomplete>
            </mat-form-field>
            </ng-container>

            <ng-container *ngIf="sabaqTargetMode === 'juz'">
              <label>Target Juz Number (1-30):</label>
              <input type="number" class="dialog-input" [(ngModel)]="sabaqJuz" placeholder="e.g. 30" min="1" max="30" />
            </ng-container>

            <div class="grid-2" style="margin-top: 10px;">
              <div>
                <label>From Ayah:</label>
                <input type="number" class="dialog-input" [(ngModel)]="sabaqFromAyah" placeholder="1" />
              </div>
              <div>
                <label>To Ayah:</label>
                <input type="number" class="dialog-input" [(ngModel)]="sabaqToAyah" placeholder="25" />
              </div>
            </div>
          </div>

          <!-- Sabqi Target -->
          <div class="tab-box" *ngIf="activeHifzTab === 'sabqi'">
            <label>Target Sabqi (Recent Memorization) Range:</label>
            <input type="text" class="dialog-input" [(ngModel)]="sabqiJuzRange" placeholder="e.g. Juz 1 to 5 (1/2 Juz per day)" />
            <small class="help-text">Set the recent Juz portion expected to be revised daily in Sabqi session.</small>
          </div>

          <!-- Manzil Target -->
          <div class="tab-box" *ngIf="activeHifzTab === 'manzil'">
            <label>Target Manzil (Old Memorization) Range:</label>
            <input type="text" class="dialog-input" [(ngModel)]="manzilJuzRange" placeholder="e.g. Juz 1 to 15 (1 Juz per day)" />
            <small class="help-text">Set the back revision Juz portion expected to be recited daily in Manzil session.</small>
          </div>
        </div>

        <!-- DAWR MODE TARGETS -->
        <div *ngIf="studentTypeMode === 'dawr'">
          <div class="tab-box">
            <label>Target Dawr Quran Revision Rounds (N Times for Certification):</label>
            <input type="number" class="dialog-input" [(ngModel)]="dawrRounds" placeholder="e.g. 3 or 5" />
            <small class="help-text">Student must complete N full Quran revision cycles to qualify for Hifz Sanad/Certificate.</small>

            <label style="margin-top: 12px;">Target Daily Revision Portion:</label>
            <input type="text" class="dialog-input" [(ngModel)]="dawrDailyJuz" placeholder="e.g. 2 Juz / day" />
          </div>
        </div>

        <!-- MAKTAB MODE TARGETS -->
        <div *ngIf="studentTypeMode === 'maktab'">
          <div class="tab-box">
            <label>Subject / Book Title:</label>
            <input type="text" class="dialog-input" [(ngModel)]="maktabSubject" placeholder="e.g. Deeniyyat Book 1" />

            <div class="grid-2" style="margin-top: 10px;">
              <div>
                <label>Target Page No:</label>
                <input type="number" class="dialog-input" [(ngModel)]="maktabPage" placeholder="Page #" />
              </div>
              <div>
                <label>Target Line No:</label>
                <input type="number" class="dialog-input" [(ngModel)]="maktabLineNo" placeholder="Line #" />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>

    <div class="target-dialog-footer">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" type="button" (click)="saveTarget()">
        <mat-icon>check_circle</mat-icon> Save & Apply Target Goal
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }

    .target-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;

      .header-title-box {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;

        .target-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
          color: #3b82f6;
          flex-shrink: 0;
        }

        h2 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
          word-break: break-word;
        }
        .subtitle { margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b; }
      }
    }

    .target-dialog-body {
      padding: 14px 16px;
      max-height: calc(90vh - 130px);
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .card-section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      box-sizing: border-box;

      .section-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.88rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;

        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3b82f6; flex-shrink: 0; }
      }
    }

    .period-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;

      .period-pill {
        flex: 1 1 auto;
        text-align: center;
        padding: 6px 10px;
        border-radius: 20px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #334155;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s ease;

        &.active {
          background: #3b82f6;
          color: #ffffff;
          border-color: #3b82f6;
        }
      }
    }

    .dates-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;

      @media (max-width: 520px) {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      label { display: block; font-size: 0.78rem; font-weight: 600; color: #475569; margin-bottom: 4px; }

    }

    .period-summary-badge {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.78rem;
      line-height: 1.4;
      word-break: break-word;

      mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    }

    .warning-section {
      background: #fffbeb;
      border-color: #fde68a;

      .warning-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.88rem;
        color: #92400e;
        margin-bottom: 4px;
      }

      .warning-desc {
        font-size: 0.80rem;
        color: #78350f;
        margin: 0 0 10px 0;
      }

      .rollover-controls {
        label { display: block; font-size: 0.78rem; font-weight: 600; color: #78350f; margin-bottom: 4px; }

        .rollover-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 10px;
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          background: #d97706;
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;

          mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
        }
      }
    }

    .portion-tabs-header {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 12px;

      .p-tab-btn {
        flex: 1 1 30%;
        min-width: 90px;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        font-size: 0.78rem;
        font-weight: 700;
        color: #475569;
        cursor: pointer;
        white-space: normal;
        text-align: center;
        transition: all 0.2s ease;

        &.active {
          color: #2563eb;
          background: #eff6ff;
          border-color: #3b82f6;
        }
      }
    }

    .tab-box {
      label { display: block; font-size: 0.80rem; font-weight: 600; color: #334155; margin-bottom: 4px; }
      .help-text { display: block; font-size: 0.75rem; color: #64748b; margin-top: 4px; }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;

        @media (max-width: 420px) {
          grid-template-columns: 1fr;
          gap: 8px;
        }
      }
    }

    .dialog-input, .dialog-select {
      width: 100%;
      height: 38px;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.85rem;
      box-sizing: border-box;
      background: #ffffff;
      color: #0f172a;
      outline: none;

      &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
    }

    .full-width-field {
      width: 100%;
      box-sizing: border-box;
    }

    .target-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
      padding: 12px 16px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;

      @media (max-width: 480px) {
        button {
          flex: 1 1 100%;
          width: 100%;
          justify-content: center;
        }
      }
    }
  `],
  standalone: false,
})
export class SetTargetDialogComponent implements OnInit {
  student: EntityRecord;
  studentTypeMode: 'hifz' | 'maktab' | 'dawr';

  targetPeriod: 'weekly' | 'monthly' | 'custom' = 'weekly';
  startDate = this.getTodayStr();
  endDate = this.getCalculatedDateStr(7);
  calculatedDays = 7;

  isIncomplete = false;
  showRolloverSection = false;
  incompleteReason = 'Medical / Illness';
  incompleteNotes = '';

  activeHifzTab: 'sabaq' | 'sabqi' | 'manzil' = 'sabaq';
  sabaqTargetMode: 'surah' | 'juz' = 'surah';
  sabaqSurah = '';
  sabaqJuz: number | null = null;
  sabaqFromAyah: number | null = 1;
  sabaqToAyah: number | null = 25;
  sabqiJuzRange = 'Juz 1 to 5';
  manzilJuzRange = 'Juz 1 to 15';

  dawrRounds: number | null = 3;
  dawrDailyJuz = '2 Juz / day';

  maktabSubject = '';
  maktabPage: number | null = null;
  maktabLineNo: number | null = null;

  allSurahs = ALL_QURAN_SURAHS;
  filteredSurahs: string[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SetTargetDialogData,
    public dialogRef: MatDialogRef<SetTargetDialogComponent>
  ) {
    this.student = data.student;
    this.studentTypeMode = data.studentTypeMode || 'hifz';
    this.dawrRounds = data.defaultDawrRounds || 3;

    if (data.currentTarget) {
      const cur = data.currentTarget;
      this.sabaqTargetMode = cur.sabaqTargetMode || 'surah';
      this.sabaqJuz = cur.sabaqJuz || null;
      this.sabaqSurah = cur.sabaqSurah || '';
      this.sabaqFromAyah = cur.sabaqFromAyah || 1;
      this.sabaqToAyah = cur.sabaqToAyah || 25;
      this.sabqiJuzRange = cur.sabqiJuzRange || 'Juz 1 to 5';
      this.manzilJuzRange = cur.manzilJuzRange || 'Juz 1 to 15';
      this.dawrRounds = cur.targetDawrRounds || data.defaultDawrRounds || 3;
      this.dawrDailyJuz = cur.dawrDailyJuz || '2 Juz / day';
      this.maktabSubject = cur.maktabSubject || '';
      this.maktabPage = cur.maktabPage || null;
      this.maktabLineNo = cur.maktabLineNo || null;

      if (cur.endDate) {
        this.endDate = cur.endDate;
        this.isIncomplete = cur.isIncomplete || false;
      }
    }
  }

  ngOnInit(): void {
    this.filteredSurahs = [...this.allSurahs];
    this.onDatesUpdated();
  }

  filterSurahs(): void {
    const q = (this.sabaqSurah || '').toLowerCase().trim();
    if (!q) {
      this.filteredSurahs = [...this.allSurahs];
    } else {
      this.filteredSurahs = this.allSurahs.filter(s => s.toLowerCase().includes(q));
    }
  }

  onSurahSelected(value: string): void {
    const ayahCount = getSurahAyahCount(value);
    if (ayahCount) {
      this.sabaqFromAyah = 1;
      this.sabaqToAyah = ayahCount;
    }
  }

  setTargetPeriod(period: 'weekly' | 'monthly' | 'custom'): void {
    this.targetPeriod = period;
    if (period === 'weekly') {
      this.endDate = this.getCalculatedDateStr(7);
    } else if (period === 'monthly') {
      this.endDate = this.getCalculatedDateStr(30);
    }
    this.onDatesUpdated();
  }

  onDatesUpdated(): void {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      this.calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    }
  }

  applyRollover(): void {
    this.startDate = this.getTodayStr();
    this.endDate = this.getCalculatedDateStr(7);
    this.targetPeriod = 'weekly';
    this.isIncomplete = false;
    this.onDatesUpdated();
  }

  saveTarget(): void {
    const result = {
      targetPeriod: this.targetPeriod,
      startDate: this.startDate,
      endDate: this.endDate,
      sabaqTargetMode: this.sabaqTargetMode,
      sabaqSurah: this.sabaqSurah,
      sabaqJuz: this.sabaqJuz,
      sabaqFromAyah: this.sabaqFromAyah,
      sabaqToAyah: this.sabaqToAyah,
      sabqiJuzRange: this.sabqiJuzRange,
      manzilJuzRange: this.manzilJuzRange,
      dawrRounds: this.dawrRounds,
      dawrDailyJuz: this.dawrDailyJuz,
      maktabSubject: this.maktabSubject,
      maktabPage: this.maktabPage,
      maktabLineNo: this.maktabLineNo,
      incompleteReason: this.incompleteReason,
      incompleteNotes: this.incompleteNotes,
    };

    this.dialogRef.close(result);
  }

  get startDateObj(): Date {
    return this.startDate ? new Date(this.startDate + 'T00:00:00') : new Date();
  }

  get endDateObj(): Date {
    return this.endDate ? new Date(this.endDate + 'T00:00:00') : new Date();
  }

  onStartDateObjChange(val: Date | null): void {
    if (!val) return;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    this.startDate = `${y}-${m}-${d}`;
    this.onDatesUpdated();
  }

  onEndDateObjChange(val: Date | null): void {
    if (!val) return;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    this.endDate = `${y}-${m}-${d}`;
    this.onDatesUpdated();
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  }

  private getTodayStr(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  private getCalculatedDateStr(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
}
