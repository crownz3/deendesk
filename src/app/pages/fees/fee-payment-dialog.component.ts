import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { FeeAssignment, FeePayment } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { FeeService } from '../../core/services/fee.service';
import { EntityRecord } from '../../core/services/repository.service';

@Component({
  selector: 'app-fee-payment-dialog',
  template: `
    <h2 mat-dialog-title>Record Payment</h2>
    <mat-dialog-content>
      <div class="payment-info">
        <div class="info-row">
          <span class="label">Student</span>
          <span class="value">{{ data.assignment['studentName'] || data.assignment['studentId'] }}</span>
        </div>
        <div class="info-row">
          <span class="label">Fee Plan</span>
          <span class="value">{{ data.assignment['feePlanTitle'] || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">Total Amount</span>
          <span class="value amount">₹{{ data.assignment['amount'] }}</span>
        </div>
        <div class="info-row">
          <span class="label">Already Paid</span>
          <span class="value paid">₹{{ data.assignment['paidAmount'] || 0 }}</span>
        </div>
        <div class="info-row">
          <span class="label">Balance</span>
          <span class="value balance">₹{{ data.assignment['balanceAmount'] || data.assignment['amount'] }}</span>
        </div>
      </div>

      <form [formGroup]="form" class="payment-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Amount Paid</mat-label>
          <input matInput type="number" formControlName="amountPaid" placeholder="0">
          <span matPrefix>₹&nbsp;</span>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Payment Date</mat-label>
          <input matInput [matDatepicker]="datePicker" formControlName="paymentDate">
          <mat-datepicker-toggle matSuffix [for]="datePicker"></mat-datepicker-toggle>
          <mat-datepicker #datePicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Payment Method</mat-label>
          <mat-select formControlName="paymentMethod">
            <mat-option value="cash">Cash</mat-option>
            <mat-option value="bankTransfer">Bank Transfer</mat-option>
            <mat-option value="upi">UPI</mat-option>
            <mat-option value="cheque">Cheque</mat-option>
            <mat-option value="online">Online</mat-option>
            <mat-option value="other">Other</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Receipt Number</mat-label>
          <input matInput formControlName="receiptNumber" placeholder="Optional">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Remarks</mat-label>
          <textarea matInput formControlName="remarks" rows="2" placeholder="Optional notes..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!form.valid || saving" (click)="save()">
        {{ saving ? 'Saving...' : 'Record Payment' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .payment-info {
      background: rgba(59, 130, 246, 0.04);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      border: 1px solid rgba(59, 130, 246, 0.1);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
    }
    .info-row .label {
      color: #6b7280;
      font-weight: 500;
    }
    .info-row .value {
      font-weight: 600;
    }
    .info-row .value.paid { color: #10b981; }
    .info-row .value.balance { color: #ef4444; }
    .payment-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .full-width { width: 100%; }
    mat-dialog-content { max-height: 70vh; overflow-y: auto; }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
  `],
  standalone: false,
})
export class FeePaymentDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<FeePaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { assignment: EntityRecord },
    private readonly auth: AuthService,
    private readonly feeService: FeeService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const balance = Number(this.data.assignment['balanceAmount']) || Number(this.data.assignment['amount']) || 0;
    this.form = this.fb.group({
      amountPaid: [balance, [Validators.required, Validators.min(1)]],
      paymentDate: [new Date(), Validators.required],
      paymentMethod: ['cash', Validators.required],
      receiptNumber: [''],
      remarks: [''],
    });
  }

  async save(): Promise<void> {
    if (!this.form.valid) return;
    this.saving = true;

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const val = this.form.value;
      const paymentDate = val.paymentDate instanceof Date
        ? val.paymentDate.toISOString().split('T')[0]
        : val.paymentDate || '';

      const assignmentData = {
        ...this.data.assignment,
        id: String(this.data.assignment.id),
      } as FeeAssignment & { id: string };

      const rawPayment: any = {
        amountPaid: Number(val.amountPaid),
        paymentDate,
        paymentMethod: val.paymentMethod,
        receiptNumber: val.receiptNumber || undefined,
        remarks: val.remarks || undefined,
        collectedByStaffId: profile?.uid,
        collectedByStaffName: profile?.displayName || profile?.email || '',
        organizationId: this.data.assignment['organizationId'] as string,
        madrasaId: this.data.assignment['madrasaId'] as string,
      };

      const cleanPayment = Object.fromEntries(
        Object.entries(rawPayment).filter(([_, v]) => v !== undefined)
      ) as Partial<FeePayment>;

      await this.feeService.recordPayment(
        assignmentData,
        cleanPayment,
        profile
      );

      this.snackBar.open('Payment recorded successfully.', 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error('[Payment Dialog] Save error:', err);
      this.snackBar.open(err?.message || 'Failed to record payment.', 'OK', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }
}
