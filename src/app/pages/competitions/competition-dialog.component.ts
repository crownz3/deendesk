import { Component, Inject, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Competition, CompetitionPrize, PrizeCategory } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { CompetitionService } from '../../core/services/competition.service';

@Component({
  selector: 'app-competition-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="accent">{{ isEdit ? 'edit' : 'emoji_events' }}</mat-icon>
      {{ isEdit ? 'Edit Competition Event & Prizes' : 'Create New Competition Event' }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form">
        <!-- Event Details (Who, When, Where) -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Event / Competition Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Annual Quran Recitation & Qirat Competition 2026" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option value="Quran Recitation & Qirat">Quran Recitation & Qirat</mat-option>
              <mat-option value="Naat & Islamic Nasheed">Naat & Nasheed</mat-option>
              <mat-option value="Islamic Speech & Debate">Islamic Speech & Debate</mat-option>
              <mat-option value="Calligraphy & Art">Calligraphy & Art</mat-option>
              <mat-option value="Sports & Athletics">Sports & Athletics</mat-option>
              <mat-option value="General Knowledge & Quiz">Quiz & General Knowledge</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Date (When)</mat-label>
            <input matInput type="date" formControlName="eventDate" />
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
            <mat-label>Venue / Location (Where)</mat-label>
            <input matInput formControlName="venue" placeholder="e.g. Main Auditorium Hall B" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Target Audience / Classes (Who)</mat-label>
            <input matInput formControlName="targetAudience" placeholder="e.g. Juniors (Class 1-4), Sub-Junior, Seniors" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Gender Scope</mat-label>
            <mat-select formControlName="genderScope">
              <mat-option value="all">All (Boys & Girls)</mat-option>
              <mat-option value="male">Boys Only</mat-option>
              <mat-option value="female">Girls Only</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Allocated Budget (₹)</mat-label>
            <input matInput type="number" formControlName="allocatedBudget" placeholder="e.g. 5000" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Chief Guests / Judges (Comma Separated)</mat-label>
            <input matInput formControlName="judgesInput" placeholder="e.g. Maulana Yousuf, Usthad Ibrahim" />
          </mat-form-field>
        </div>

        <!-- Prizes & Award Configuration Section -->
        <div class="prizes-section">
          <div class="section-header">
            <h3><mat-icon color="accent">emoji_events</mat-icon> Prize, Awards & Gift Configuration</h3>
            <button type="button" mat-stroked-button color="accent" (click)="addPrizeRow()">
              <mat-icon>add</mat-icon> Add Custom Award
            </button>
          </div>

          <div formArrayName="prizes" class="prizes-list">
            <div *ngFor="let pGroup of prizesFormArray.controls; let i = index" [formGroupName]="i" class="prize-card">
              <div class="prize-header">
                <span class="prize-badge" [ngClass]="pGroup.value.category">
                  {{ pGroup.value.category | uppercase }}
                </span>
                <button type="button" mat-icon-button color="warn" (click)="removePrizeRow(i)" title="Remove Award">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Award Rank/Category</mat-label>
                  <mat-select formControlName="category">
                    <mat-option value="1st_prize">1st Prize (Winner)</mat-option>
                    <mat-option value="2nd_prize">2nd Prize (1st Runner-up)</mat-option>
                    <mat-option value="3rd_prize">3rd Prize (2nd Runner-up)</mat-option>
                    <mat-option value="runner_up">Runner-up Special</mat-option>
                    <mat-option value="consolation">Consolation Award</mat-option>
                    <mat-option value="participation">Participation Gift & Certificate</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-2">
                  <mat-label>Award Title</mat-label>
                  <input matInput formControlName="title" placeholder="e.g. 1st Prize Winner Shield" />
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-2">
                  <mat-label>Specific Gift Item(s)</mat-label>
                  <input matInput formControlName="giftItemName" placeholder="e.g. Smart Watch + Quran Copy + Cash Prize" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Cash Prize (₹)</mat-label>
                  <input matInput type="number" formControlName="cashAmount" placeholder="e.g. 1000" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Trophy / Medal Title</mat-label>
                  <input matInput formControlName="trophyName" placeholder="e.g. Gold Medal & Shield" />
                </mat-form-field>
              </div>
            </div>
          </div>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="accent" [disabled]="form.invalid || submitting" (click)="save()">
        {{ submitting ? 'Saving...' : 'Save Event & Prizes' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-height: 78vh; overflow-y: auto; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .flex-1 { flex: 1; min-width: 140px; }
    .flex-2 { flex: 2; min-width: 220px; }

    .prizes-section {
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
          color: #2e7d32;
        }
      }

      .prize-card {
        background: #f4fbf7;
        border: 1px solid #c8e6c9;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;

        .prize-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .prize-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 12px;

            &[class*="1st_prize"] { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
            &[class*="2nd_prize"] { background: #f5f5f5; color: #616161; border: 1px solid #e0e0e0; }
            &[class*="3rd_prize"] { background: #efebe9; color: #5d4037; border: 1px solid #d7ccc8; }
            &.consolation { background: #e3f2fd; color: #1565c0; }
            &.participation { background: #e8f5e9; color: #2e7d32; }
          }
        }
      }
    }
  `],
  standalone: false
})
export class CompetitionDialogComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private competitionService: CompetitionService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<CompetitionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competition?: Competition }
  ) {
    this.isEdit = !!data?.competition;
    this.form = this.fb.group({
      title: [data?.competition?.title || '', Validators.required],
      category: [data?.competition?.category || 'Quran Recitation & Qirat', Validators.required],
      eventDate: [data?.competition?.eventDate || new Date().toISOString().split('T')[0], Validators.required],
      startTime: [data?.competition?.startTime || '10:00', Validators.required],
      endTime: [data?.competition?.endTime || '13:00', Validators.required],
      venue: [data?.competition?.venue || '', Validators.required],
      targetAudience: [data?.competition?.targetAudience || 'All Students', Validators.required],
      genderScope: [data?.competition?.genderScope || 'all'],
      allocatedBudget: [data?.competition?.allocatedBudget || 3000, Validators.required],
      judgesInput: [data?.competition?.judges?.join(', ') || ''],
      prizes: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    const defaultPrizes = this.data?.competition?.prizes?.length
      ? this.data.competition.prizes
      : this.competitionService.getDefaultPrizeStructure();

    defaultPrizes.forEach((p) => this.addPrizeRow(p));
  }

  get prizesFormArray(): FormArray {
    return this.form.get('prizes') as FormArray;
  }

  addPrizeRow(item?: CompetitionPrize): void {
    const row = this.fb.group({
      id: [item?.id || 'prz-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)],
      category: [item?.category || '1st_prize', Validators.required],
      title: [item?.title || '1st Prize (Winner)', Validators.required],
      giftItemName: [item?.giftItemName || '', Validators.required],
      cashAmount: [item?.cashAmount || 0],
      trophyName: [item?.trophyName || ''],
    });
    this.prizesFormArray.push(row);
  }

  removePrizeRow(index: number): void {
    this.prizesFormArray.removeAt(index);
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
    const judges = val.judgesInput
      ? val.judgesInput.split(',').map((j: string) => j.trim()).filter(Boolean)
      : [];

    const payload: Partial<Competition> = {
      title: val.title,
      category: val.category,
      eventDate: val.eventDate,
      startTime: val.startTime,
      endTime: val.endTime,
      venue: val.venue,
      targetAudience: val.targetAudience,
      genderScope: val.genderScope,
      allocatedBudget: val.allocatedBudget,
      judges,
      prizes: val.prizes,
      status: this.data?.competition?.status || 'upcoming',
    };

    try {
      if (this.isEdit && this.data.competition?.id) {
        await this.competitionService.updateCompetition(this.data.competition.id, payload, currentUser);
        this.snackBar.open('Competition event updated!', 'Close', { duration: 3000 });
      } else {
        await this.competitionService.createCompetition(payload, currentUser);
        this.snackBar.open('Competition event created!', 'Close', { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save competition event', 'Close', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}
