import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { where } from 'firebase/firestore';
import { AuthService } from '../../core/services/auth.service';
import { FeeService } from '../../core/services/fee.service';
import { EntityRecord } from '../../core/services/repository.service';

@Component({
  selector: 'app-fee-payment-history-dialog',
  template: `
    <h2 mat-dialog-title>Payment History</h2>
    <mat-dialog-content>
      <div class="assignment-info">
        <div class="info-row">
          <span class="label">Student</span>
          <span class="value">{{ data.assignment['studentName'] || data.assignment['studentId'] }}</span>
        </div>
        <div class="info-row">
          <span class="label">Fee Plan</span>
          <span class="value">{{ data.assignment['feePlanTitle'] || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">Total / Paid / Balance</span>
          <span class="value">
            ₹{{ data.assignment['amount'] }} /
            <span class="paid">₹{{ data.assignment['paidAmount'] || 0 }}</span> /
            <span class="balance">₹{{ data.assignment['balanceAmount'] || data.assignment['amount'] }}</span>
          </span>
        </div>
      </div>

      <div class="history-list" *ngIf="payments.length > 0; else noHistory">
        <table class="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Receipt</th>
              <th>Collected By</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of payments">
              <td>{{ $any(p['paymentDate']) | date:'mediumDate' }}</td>
              <td class="paid">₹{{ $any(p['amountPaid']) | number:'1.0-0' }}</td>
              <td>{{ p['paymentMethod'] }}</td>
              <td>{{ p['receiptNumber'] || '—' }}</td>
              <td>{{ p['collectedByStaffName'] || '—' }}</td>
              <td>{{ p['remarks'] || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ng-template #noHistory>
        <div class="empty-history">
          <ion-icon name="document-text-outline"></ion-icon>
          <p>No payment records found for this assignment.</p>
        </div>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .assignment-info {
      background: rgba(59, 130, 246, 0.04);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 20px;
      border: 1px solid rgba(59, 130, 246, 0.1);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 14px;
    }
    .info-row .label { color: #6b7280; font-weight: 500; }
    .info-row .value { font-weight: 600; }
    .paid { color: #10b981; }
    .balance { color: #ef4444; }
    .history-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .history-table th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      background: rgba(0, 0, 0, 0.02);
      border-bottom: 2px solid rgba(0, 0, 0, 0.06);
    }
    .history-table td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    }
    .empty-history {
      text-align: center;
      padding: 32px;
      color: #9ca3af;
    }
    .empty-history ion-icon {
      font-size: 36px;
      display: block;
      margin: 0 auto 8px;
    }
    mat-dialog-content { max-height: 70vh; overflow-y: auto; }
  `],
  standalone: false,
})
export class FeePaymentHistoryDialogComponent implements OnInit {
  payments: EntityRecord[] = [];

  constructor(
    private readonly dialogRef: MatDialogRef<FeePaymentHistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { assignment: EntityRecord },
    private readonly auth: AuthService,
    private readonly feeService: FeeService
  ) {}

  async ngOnInit(): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    if (profile && this.data.assignment.id) {
      this.feeService
        .listFeePayments(profile, [
          where('feeAssignmentId', '==', this.data.assignment.id),
        ])
        .subscribe((payments) => {
          this.payments = payments.sort((a, b) => {
            const dateA = String(a['paymentDate'] || '');
            const dateB = String(b['paymentDate'] || '');
            return dateB.localeCompare(dateA);
          });
        });
    }
  }
}
