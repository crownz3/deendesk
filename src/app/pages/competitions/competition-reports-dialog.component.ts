import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Competition, CompetitionExpense, CompetitionParticipant } from '../../core/models/domain.model';
import { CompetitionService } from '../../core/services/competition.service';

@Component({
  selector: 'app-competition-reports-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title no-print">
      <mat-icon color="accent">summarize</mat-icon>
      Competition Reports & Financial Audit - {{ data.competition.title }}
      <button mat-icon-button class="close-btn" mat-dialog-close><mat-icon>close</mat-icon></button>
    </h2>

    <mat-dialog-content class="dialog-content">
      <mat-tab-group class="no-print">
        <mat-tab label="Official Winner Announcement Sheet">
          <div class="tab-body">
            <button mat-raised-button color="accent" (click)="printReport()">
              <mat-icon>print</mat-icon> Print Winner Announcement Sheet
            </button>
          </div>
        </mat-tab>

        <mat-tab label="Participation Certificate List">
          <div class="tab-body">
            <button mat-raised-button color="primary" (click)="printReport()">
              <mat-icon>print</mat-icon> Print Participant Certificate List
            </button>
          </div>
        </mat-tab>

        <mat-tab label="Financial Expense Audit">
          <div class="tab-body">
            <button mat-raised-button color="warn" (click)="printReport()">
              <mat-icon>print</mat-icon> Print Financial Report
            </button>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Printable Report Document Area -->
      <div id="printable-area" class="printable-document">
        <div class="institute-header text-center">
          <h2>DEENDESK MADRASA & ACADEMIC INSTITUTION</h2>
          <h3>OFFICIAL COMPETITION & EVENT REPORT</h3>
          <p><strong>{{ data.competition.title }}</strong> (Category: {{ data.competition.category }})</p>
          <p>Date: {{ data.competition.eventDate }} | Venue: {{ data.competition.venue }} | Target: {{ data.competition.targetAudience }}</p>
        </div>

        <!-- 1. Winner Announcement Section -->
        <div class="report-section">
          <h4 class="section-title">🏆 OFFICIAL WINNERS & AWARD RECIPIENTS</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Award / Rank</th>
                <th>Winner Name / Team</th>
                <th>Class</th>
                <th>Trophy / Medal</th>
                <th>Gift Item Awarded</th>
                <th>Cash Prize</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let prz of data.competition.prizes">
                <td><strong class="prize-title">{{ prz.title }}</strong></td>
                <td><strong>{{ prz.winnerStudentName || 'Pending Announcement' }}</strong></td>
                <td>{{ prz.winnerClassName || '-' }}</td>
                <td>{{ prz.trophyName || '-' }}</td>
                <td>{{ prz.giftItemName }}</td>
                <td>{{ prz.cashAmount ? ('₹' + prz.cashAmount) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. Participant & Attendance Summary -->
        <div class="report-section margin-top-20">
          <h4 class="section-title">👥 PARTICIPATION & CERTIFICATE ROLL</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Participant Name</th>
                <th>Class</th>
                <th>Check-in Status</th>
                <th>Score / Points</th>
                <th>Participation Gift Received</th>
                <th>Judge Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of participants; let i = index">
                <td>{{ i + 1 }}</td>
                <td><strong>{{ p.studentName }}</strong></td>
                <td>{{ p.className || '-' }}</td>
                <td><span class="status-tag">{{ p.checkInStatus | uppercase }}</span></td>
                <td>{{ p.scoreOrPoints || '-' }}</td>
                <td>{{ p.receivedParticipationGift ? 'YES (Gift + Certificate)' : 'No' }}</td>
                <td>{{ p.judgeRemarks || '-' }}</td>
              </tr>
              <tr *ngIf="participants.length === 0">
                <td colspan="7" class="text-center py-3">No registered participants recorded.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 3. Financial Expense & Budget Audit -->
        <div class="report-section margin-top-20">
          <h4 class="section-title">💰 EVENT FINANCIAL AUDIT & EXPENSE BREAKDOWN</h4>
          <div class="audit-summary-box">
            <span>Allocated Budget: <strong>₹{{ data.competition.allocatedBudget }}</strong></span>
            <span>Total Actual Expense: <strong>₹{{ calculateTotalExpense() }}</strong></span>
            <span>Net Balance: <strong [ngClass]="calculateBalance() < 0 ? 'text-danger' : 'text-success'">₹{{ calculateBalance() }}</strong></span>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense Category</th>
                <th>Description</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let exp of expenses">
                <td>{{ exp.expenseDate }}</td>
                <td>{{ exp.expenseCategory }}</td>
                <td>{{ exp.description }}</td>
                <td><strong>₹{{ exp.amount }}</strong></td>
              </tr>
              <tr *ngIf="expenses.length === 0">
                <td colspan="4" class="text-center py-3">No expenses recorded for this event.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Signatures -->
        <div class="signature-block">
          <div class="sig-col">
            <div class="sig-line"></div>
            <p>Event Coordinator</p>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <p>Chief Judge / Guest</p>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <p>Principal / Management</p>
          </div>
        </div>
      </div>
    </mat-dialog-content>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .close-btn { margin-left: auto; }
    .dialog-content { max-height: 82vh; overflow-y: auto; }
    .tab-body { padding: 12px 0 20px 0; }
    .margin-top-20 { margin-top: 24px; }

    .printable-document { background: white; padding: 24px; border: 1px solid #ccc; border-radius: 8px; }
    .institute-header {
      border-bottom: 2px solid #2e7d32; padding-bottom: 12px; margin-bottom: 20px;
      h2 { margin: 0; color: #2e7d32; font-size: 20px; font-weight: bold; }
      h3 { margin: 4px 0; font-size: 16px; color: #444; }
      p { margin: 2px 0; font-size: 13px; color: #666; }
    }
    .text-center { text-align: center; }

    .section-title { font-size: 15px; color: #1b5e20; margin-bottom: 8px; font-weight: 700; }
    .report-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
      th { background: #e8f5e9; font-weight: bold; color: #2e7d32; }
      .prize-title { color: #1b5e20; }
      .status-tag { font-size: 11px; font-weight: bold; color: #333; }
    }

    .audit-summary-box {
      display: flex; justify-content: space-around; background: #f1f8e9; padding: 12px;
      border-radius: 6px; margin-bottom: 12px; font-size: 14px;
    }
    .signature-block {
      display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px;
      .sig-col { text-align: center; width: 28%; }
      .sig-line { border-top: 1px solid #444; margin-bottom: 6px; }
      p { font-size: 12px; font-weight: bold; margin: 0; color: #444; }
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
export class CompetitionReportsDialogComponent implements OnInit {
  participants: CompetitionParticipant[] = [];
  expenses: CompetitionExpense[] = [];

  constructor(
    private competitionService: CompetitionService,
    private dialogRef: MatDialogRef<CompetitionReportsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competition: Competition }
  ) {}

  ngOnInit(): void {
    this.competitionService.listParticipants(this.data.competition.id!).subscribe((list) => {
      this.participants = list;
    });
    this.competitionService.listExpenses(this.data.competition.id!).subscribe((list) => {
      this.expenses = list;
    });
  }

  calculateTotalExpense(): number {
    return this.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  calculateBalance(): number {
    return (this.data.competition.allocatedBudget || 0) - this.calculateTotalExpense();
  }

  printReport(): void {
    window.print();
  }
}
