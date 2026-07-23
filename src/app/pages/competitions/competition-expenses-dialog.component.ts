import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Competition, CompetitionExpense } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { CompetitionService } from '../../core/services/competition.service';

@Component({
  selector: 'app-competition-expenses-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">receipt_long</mat-icon>
      Competition Expense & Budget Audit - {{ data.competition.title }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- Budget Audit Summary Cards -->
      <div class="budget-summary-grid">
        <div class="summary-card budget">
          <span>Allocated Budget</span>
          <strong>₹{{ data.competition.allocatedBudget }}</strong>
        </div>
        <div class="summary-card actual">
          <span>Total Actual Spent</span>
          <strong>₹{{ calculateTotalSpent() }}</strong>
        </div>
        <div class="summary-card balance" [ngClass]="calculateBalance() < 0 ? 'over-budget' : 'under-budget'">
          <span>Remaining Balance</span>
          <strong>₹{{ calculateBalance() }}</strong>
        </div>
      </div>

      <!-- Add Expense Form -->
      <div class="add-expense-card">
        <h4>Log New Event Expense</h4>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Category</mat-label>
            <mat-select [(ngModel)]="newCategory">
              <mat-option value="trophies_prizes">Trophies & Medals</mat-option>
              <mat-option value="gifts_certificates">Gifts & Certificates</mat-option>
              <mat-option value="sound_stage">Sound & Stage Setup</mat-option>
              <mat-option value="refreshments_food">Refreshments & Food</mat-option>
              <mat-option value="guest_honorarium">Chief Guest Honorarium</mat-option>
              <mat-option value="printing">Printing & Banners</mat-option>
              <mat-option value="miscellaneous">Miscellaneous</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="newDescription" placeholder="e.g. Purchase of 3 Trophies & 50 Certificates" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Amount (₹)</mat-label>
            <input matInput type="number" [(ngModel)]="newAmount" placeholder="e.g. 1500" />
          </mat-form-field>

          <button mat-raised-button color="warn" (click)="addExpense()">
            <mat-icon>add</mat-icon> Add Expense
          </button>
        </div>
      </div>

      <!-- Expense Audit Table -->
      <div class="table-container">
        <table class="expense-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount (₹)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let exp of expenses">
              <td>{{ exp.expenseDate }}</td>
              <td>
                <span class="category-chip">{{ getCategoryLabel(exp.expenseCategory) }}</span>
              </td>
              <td>{{ exp.description }}</td>
              <td><strong>₹{{ exp.amount }}</strong></td>
              <td>
                <button mat-icon-button color="warn" (click)="deleteExpense(exp)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </tr>

            <tr *ngIf="expenses.length === 0">
              <td colspan="5" class="text-center py-4">No expenses logged for this event yet. Use the form above to add itemized expenses.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-height: 80vh; overflow-y: auto; }
    .budget-summary-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;
      .summary-card {
        padding: 16px; border-radius: 10px; background: #f8f9fa; border: 1px solid #e9ecef;
        span { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
        strong { font-size: 20px; font-weight: 700; color: #333; }
        &.budget strong { color: #1976d2; }
        &.actual strong { color: #e65100; }
        &.balance.under-budget strong { color: #2e7d32; }
        &.balance.over-budget strong { color: #c62828; }
      }
    }
    .add-expense-card {
      background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;
      h4 { margin: 0 0 8px 0; color: #f57f17; font-size: 15px; }
    }
    .form-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .flex-1 { flex: 1; min-width: 130px; }
    .flex-2 { flex: 2; min-width: 220px; }

    .table-container { border: 1px solid #e0e0e0; border-radius: 8px; overflow-x: auto; }
    .expense-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { padding: 10px 12px; border-bottom: 1px solid #eee; text-align: left; vertical-align: middle; }
      th { background: #f5f5f5; font-weight: bold; color: #333; }
      .category-chip {
        background: #e0f2f1; color: #00695c; font-weight: 600; padding: 3px 8px; border-radius: 12px; font-size: 11px;
      }
    }
    .text-center { text-align: center; }
    .py-4 { padding: 24px; color: #777; }
  `],
  standalone: false
})
export class CompetitionExpensesDialogComponent implements OnInit {
  expenses: CompetitionExpense[] = [];
  newCategory = 'trophies_prizes';
  newDescription = '';
  newAmount = 0;

  constructor(
    private competitionService: CompetitionService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<CompetitionExpensesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competition: Competition }
  ) {}

  ngOnInit(): void {
    this.competitionService.listExpenses(this.data.competition.id!).subscribe((list) => {
      this.expenses = list;
    });
  }

  calculateTotalSpent(): number {
    return this.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  calculateBalance(): number {
    return (this.data.competition.allocatedBudget || 0) - this.calculateTotalSpent();
  }

  async addExpense(): Promise<void> {
    if (!this.newDescription.trim() || this.newAmount <= 0) {
      this.snackBar.open('Please enter description and valid amount', 'Close', { duration: 3000 });
      return;
    }

    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) return;

    const payload: Partial<CompetitionExpense> = {
      competitionId: this.data.competition.id!,
      expenseCategory: this.newCategory as any,
      description: this.newDescription.trim(),
      amount: this.newAmount,
      expenseDate: new Date().toISOString().split('T')[0],
    };

    try {
      await this.competitionService.createExpense(payload, currentUser, this.data.competition);
      this.snackBar.open('Expense added!', 'Close', { duration: 3000 });
      this.newDescription = '';
      this.newAmount = 0;
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to add expense', 'Close', { duration: 3000 });
    }
  }

  async deleteExpense(exp: CompetitionExpense): Promise<void> {
    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) return;

    try {
      await this.competitionService.deleteExpense(exp.id!, exp.amount, this.data.competition, currentUser);
      this.snackBar.open('Expense deleted!', 'Close', { duration: 3000 });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete expense', 'Close', { duration: 3000 });
    }
  }

  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'trophies_prizes': return 'Trophies & Medals';
      case 'gifts_certificates': return 'Gifts & Certificates';
      case 'sound_stage': return 'Sound & Stage';
      case 'refreshments_food': return 'Food & Refreshments';
      case 'guest_honorarium': return 'Guest Honorarium';
      case 'printing': return 'Printing & Banners';
      default: return 'Miscellaneous';
    }
  }
}
