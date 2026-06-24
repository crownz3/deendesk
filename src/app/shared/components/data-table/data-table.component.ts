import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TableColumn } from '../../../core/models/domain.model';
import { EntityRecord } from '../../../core/services/repository.service';

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  standalone: false,
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() rows: EntityRecord[] = [];
  @Input() emptyTitle = 'No data found';
  @Input() emptyText = 'No records found for the selected filter.';
  @Input() emptyButton?: string;
  @Input() emptyIcon = 'file-tray-outline';
  @Input() showActions = true;
  @Input() allowCredentials = false;
  @Input() allowPromotion = false;
  @Input() allowDetails = false;
  @Input() generatedCredentials: Record<string, any> = {};
  @Input() currentUid?: string;

  @Output() edit = new EventEmitter<EntityRecord>();
  @Output() remove = new EventEmitter<EntityRecord>();
  @Output() resetPassword = new EventEmitter<EntityRecord>();
  @Output() sendResetEmail = new EventEmitter<EntityRecord>();
  @Output() promote = new EventEmitter<EntityRecord>();
  @Output() viewDetails = new EventEmitter<EntityRecord>();
  @Output() emptyAction = new EventEmitter<void>();

  constructor(private snackBar: MatSnackBar) {}

  get displayedColumns(): string[] {
    return this.showActions ? [...this.columns.map((column) => column.key), 'actions'] : this.columns.map((column) => column.key);
  }

  value(row: EntityRecord, key: string): unknown {
    return row[key];
  }

  isArray(val: unknown): val is unknown[] {
    return Array.isArray(val);
  }

  asArray(val: unknown): unknown[] {
    return Array.isArray(val) ? val : [];
  }

  text(row: EntityRecord, key: string): string {
    const value = this.value(row, key);
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'N/A';
    }
    return value === undefined || value === null || value === '' ? 'N/A' : String(value);
  }

  getDate(row: EntityRecord, key: string): Date | string | null {
    const value = row[key];
    if (!value) return null;
    if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
      return (value as any).toDate();
    }
    return value as Date | string;
  }

  trackByColumn(_: number, column: TableColumn): string {
    return column.key;
  }

  trackByRow(_: number, row: EntityRecord): string {
    return String(row.id ?? row['uid'] ?? row['email'] ?? JSON.stringify(row));
  }

  isSelf(row: EntityRecord): boolean {
    if (!this.currentUid) return false;
    const uid = String(row.id ?? row['uid'] ?? row['userId'] ?? '');
    return uid === this.currentUid;
  }

  async copyTemporaryPassword(row: EntityRecord): Promise<void> {
    const password = row['temporaryPasswordDisplay'];
    if (!password || password === 'Temporary password pending' || password === 'Password changed' || password === 'Login not created') return;

    const displayName = row['primaryOrganizerName'] || row['displayName'] || row['name'] || 'User';
    const email = row['primaryOrganizerEmail'] || row['email'];

    const text = `DeenDesk Login Credentials

Role: Organization Admin
Name: ${displayName}
Email: ${email}
Temporary Password: ${password}

Please login and change your password immediately.`;

    try {
      await navigator.clipboard.writeText(text);
      this.snackBar.open('Credentials copied to clipboard.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Failed to copy credentials.', 'Close', { duration: 3000 });
    }
  }

  async copyEmail(row: EntityRecord, key: string): Promise<void> {
    const email = this.text(row, key);
    if (!email || email === 'N/A') return;
    try {
      await navigator.clipboard.writeText(email);
      this.snackBar.open('Email copied to clipboard.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Failed to copy email.', 'Close', { duration: 3000 });
    }
  }

  async copyRawPassword(row: EntityRecord): Promise<void> {
    const password = row['temporaryPasswordDisplay'];
    if (!password || password === 'Temporary password pending' || password === 'Password changed' || password === 'Login not created') return;
    try {
      await navigator.clipboard.writeText(String(password));
      this.snackBar.open('Temporary password copied.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Failed to copy password.', 'Close', { duration: 3000 });
    }
  }
}
