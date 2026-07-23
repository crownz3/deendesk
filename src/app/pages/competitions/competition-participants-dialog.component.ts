import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  Competition,
  CompetitionParticipant,
  CompetitionPrize,
} from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { CompetitionService } from '../../core/services/competition.service';

@Component({
  selector: 'app-competition-participants-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="accent">group_add</mat-icon>
      Participants & Award Winner Selection - {{ data.competition.title }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- Add Participant Form -->
      <div class="add-participant-card">
        <h4>Register New Participant / Team</h4>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Student / Participant Name</mat-label>
            <input matInput [(ngModel)]="newStudentName" placeholder="e.g. Abdullah Bin Masood" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Class</mat-label>
            <input matInput [(ngModel)]="newClassName" placeholder="e.g. Class 2" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Team / House Name</mat-label>
            <input matInput [(ngModel)]="newTeamName" placeholder="e.g. Green House" />
          </mat-form-field>

          <button mat-raised-button color="accent" (click)="registerNewParticipant()">
            <mat-icon>person_add</mat-icon> Register
          </button>
        </div>
      </div>

      <!-- Participants Table -->
      <div class="table-container">
        <table class="part-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Class / Team</th>
              <th>Check-in Status</th>
              <th>Score / Points</th>
              <th>Participation Gift Given?</th>
              <th>Award / Prize Assigned</th>
              <th>Judge Remarks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of participants">
              <td><strong>{{ p.studentName }}</strong></td>
              <td>{{ p.className || p.teamOrHouseName || '-' }}</td>
              <td>
                <select class="form-select" [(ngModel)]="p.checkInStatus">
                  <option value="registered">Registered</option>
                  <option value="present">Checked In (Present)</option>
                  <option value="performed">Performed</option>
                  <option value="absent">Absent</option>
                </select>
              </td>
              <td>
                <input type="number" class="num-input" [(ngModel)]="p.scoreOrPoints" placeholder="Score" />
              </td>
              <td class="text-center">
                <mat-checkbox [(ngModel)]="p.receivedParticipationGift" color="primary"></mat-checkbox>
              </td>
              <td>
                <select class="form-select prize-select" (change)="assignPrizeToParticipant(p, $event)">
                  <option value="">-- No Award --</option>
                  <option *ngFor="let prz of data.competition.prizes" [value]="prz.id" [selected]="prz.winnerStudentId === p.studentId">
                    {{ prz.title }} ({{ prz.giftItemName }})
                  </option>
                </select>
              </td>
              <td>
                <input type="text" class="text-input" [(ngModel)]="p.judgeRemarks" placeholder="Judge notes" />
              </td>
              <td>
                <button mat-icon-button color="warn" (click)="deleteParticipant(p)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </tr>

            <tr *ngIf="participants.length === 0">
              <td colspan="8" class="text-center py-4">No participants registered for this event yet. Use the form above to add participants.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-raised-button color="accent" [disabled]="submitting" (click)="saveAll()">
        <mat-icon>save</mat-icon> {{ submitting ? 'Saving...' : 'Save Participants & Winners' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-height: 80vh; overflow-y: auto; }
    .add-participant-card {
      background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;
      h4 { margin: 0 0 8px 0; color: #2e7d32; font-size: 15px; }
    }
    .form-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .flex-1 { flex: 1; min-width: 130px; }
    .flex-2 { flex: 2; min-width: 200px; }

    .table-container { border: 1px solid #e0e0e0; border-radius: 8px; overflow-x: auto; }
    .part-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { padding: 10px 12px; border-bottom: 1px solid #eee; text-align: left; vertical-align: middle; }
      th { background: #f5f5f5; font-weight: bold; color: #333; }
      .num-input { width: 65px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
      .text-input { width: 120px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
      .form-select { padding: 6px; border-radius: 4px; border: 1px solid #ccc; }
      .prize-select { font-weight: bold; color: #2e7d32; }
    }
    .text-center { text-align: center; }
    .py-4 { padding: 24px; color: #777; }
  `],
  standalone: false
})
export class CompetitionParticipantsDialogComponent implements OnInit {
  participants: CompetitionParticipant[] = [];
  newStudentName = '';
  newClassName = '';
  newTeamName = '';

  submitting = false;

  constructor(
    private competitionService: CompetitionService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<CompetitionParticipantsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competition: Competition }
  ) {}

  ngOnInit(): void {
    this.competitionService.listParticipants(this.data.competition.id!).subscribe((list) => {
      if (list.length) {
        this.participants = list;
      } else {
        // Pre-fill sample participants for demo
        this.participants = [
          { id: 'part-1', competitionId: this.data.competition.id!, studentId: 'std-1', studentName: 'Ahmad Raza', className: 'Class 1', checkInStatus: 'performed', scoreOrPoints: 95, receivedParticipationGift: true, judgeRemarks: 'Clear voice & perfect Tajweed' },
          { id: 'part-2', competitionId: this.data.competition.id!, studentId: 'std-2', studentName: 'Fatimah Binte Ali', className: 'Class 1', checkInStatus: 'performed', scoreOrPoints: 90, receivedParticipationGift: true, judgeRemarks: 'Very good recitation' },
          { id: 'part-3', competitionId: this.data.competition.id!, studentId: 'std-3', studentName: 'Zayd Bin Haritha', className: 'Class 2', checkInStatus: 'performed', scoreOrPoints: 85, receivedParticipationGift: true, judgeRemarks: 'Good performance' }
        ] as CompetitionParticipant[];
      }
    });
  }

  async registerNewParticipant(): Promise<void> {
    if (!this.newStudentName.trim()) return;

    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) return;

    const payload: Partial<CompetitionParticipant> = {
      competitionId: this.data.competition.id!,
      studentId: 'std-' + Date.now(),
      studentName: this.newStudentName.trim(),
      className: this.newClassName.trim(),
      teamOrHouseName: this.newTeamName.trim(),
      checkInStatus: 'registered',
      receivedParticipationGift: false,
    };

    try {
      await this.competitionService.registerParticipant(payload, currentUser);
      this.snackBar.open('Participant registered!', 'Close', { duration: 3000 });
      this.newStudentName = '';
      this.newClassName = '';
      this.newTeamName = '';
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to register participant', 'Close', { duration: 3000 });
    }
  }

  assignPrizeToParticipant(p: CompetitionParticipant, event: Event): void {
    const prizeId = (event.target as HTMLSelectElement).value;
    const prizes = [...(this.data.competition.prizes || [])];

    // Clear participant from any previous prize assignment
    prizes.forEach((prz) => {
      if (prz.winnerStudentId === p.studentId) {
        prz.winnerStudentId = undefined;
        prz.winnerStudentName = undefined;
        prz.winnerClassName = undefined;
      }
    });

    if (prizeId) {
      const targetPrize = prizes.find((prz) => prz.id === prizeId);
      if (targetPrize) {
        targetPrize.winnerStudentId = p.studentId;
        targetPrize.winnerStudentName = p.studentName;
        targetPrize.winnerClassName = p.className;
      }
    }

    this.data.competition.prizes = prizes;
  }

  async deleteParticipant(p: CompetitionParticipant): Promise<void> {
    if (p.id) {
      await this.competitionService.deleteParticipant(p.id);
      this.snackBar.open('Participant removed', 'Close', { duration: 3000 });
    } else {
      const index = this.participants.indexOf(p);
      if (index !== -1) this.participants.splice(index, 1);
    }
  }

  async saveAll(): Promise<void> {
    this.submitting = true;
    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) {
      this.submitting = false;
      return;
    }

    try {
      // Save participants
      for (const p of this.participants) {
        if (p.id) {
          await this.competitionService.updateParticipant(p.id, p, currentUser);
        } else {
          await this.competitionService.registerParticipant(p, currentUser);
        }
      }

      // Save updated prize winners back to competition master
      await this.competitionService.updateCompetition(
        this.data.competition.id!,
        { prizes: this.data.competition.prizes },
        currentUser
      );

      this.snackBar.open('Participants & Winner Awards saved successfully!', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save participants', 'Close', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}
