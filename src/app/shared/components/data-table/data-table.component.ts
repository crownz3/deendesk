import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TableColumn } from '../../../core/models/domain.model';
import { ROLE_LABELS } from '../../../core/constants/defaults';
import { EntityRecord } from '../../../core/services/repository.service';
import { SelectionModel } from '@angular/cdk/collections';

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
  @Input() allowDelete = false;
  @Input() allowTransfer = false;
  @Input() allowSwap: boolean = false;
  @Input() allowAssignStudents: boolean = false;
  @Input() allowAssignStaff: boolean = false;
  @Input() allowImpersonate = false;
  @Input() generatedCredentials: Record<string, any> = {};
  @Input() currentUid?: string;

  @Output() edit = new EventEmitter<EntityRecord>();
  @Output() remove = new EventEmitter<EntityRecord>();
  @Output() activate = new EventEmitter<EntityRecord>();
  @Output() swap = new EventEmitter<EntityRecord>();
  @Output() resetPassword = new EventEmitter<EntityRecord>();
  @Output() sendResetEmail = new EventEmitter<EntityRecord>();
  @Output() promote = new EventEmitter<EntityRecord>();
  @Output() viewDetails = new EventEmitter<EntityRecord>();
  @Output() permanentlyDelete = new EventEmitter<EntityRecord>();
  @Output() transfer = new EventEmitter<EntityRecord>();
  @Output() assignStudents = new EventEmitter<EntityRecord>();
  @Output() assignStaff = new EventEmitter<EntityRecord>();
  @Output() emptyAction = new EventEmitter<void>();
  @Output() impersonate = new EventEmitter<any>();

  constructor(private snackBar: MatSnackBar) {}

  selection = new SelectionModel<EntityRecord>(true, []);

  get displayedColumns(): string[] {
    const cols = ['select', ...this.columns.map((column) => column.key)];
    return this.showActions ? [...cols, 'actions'] : cols;
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.rows.length;
    return numSelected > 0 && numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.rows);
  }

  checkboxLabel(row?: EntityRecord): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
  }

  value(row: EntityRecord, key: string): unknown {
    const val = row[key];
    // If value exists, return as-is (including arrays)
    if (val !== undefined && val !== null && val !== '') return val;

    // Backwards-compat: fall back from plural keys (madrasaIds) to singular (madrasaId)
    // and wrap the single string in an array so the idRef renderer works uniformly.
    if (key.endsWith('Ids')) {
      const singularKey = key.slice(0, -1); // madrasaIds → madrasaId
      const singularVal = row[singularKey];
      if (singularVal !== undefined && singularVal !== null && singularVal !== '') {
        return Array.isArray(singularVal) ? singularVal : [singularVal];
      }
    }

    return val;
  }

  isArray(val: unknown): val is unknown[] {
    return Array.isArray(val);
  }

  asArray(val: unknown): unknown[] {
    return Array.isArray(val) ? val : [];
  }

  staffPeople(row: EntityRecord, key: string): any[] {
    const value = this.value(row, key);
    return Array.isArray(value) ? value : [];
  }

  visibleStaffPeople(row: EntityRecord, key: string): any[] {
    return this.staffPeople(row, key).slice(0, 3);
  }

  hiddenStaffCount(row: EntityRecord, key: string): number {
    return Math.max(this.staffPeople(row, key).length - 3, 0);
  }

  staffTooltip(row: EntityRecord, key: string): string {
    const people = this.staffPeople(row, key);
    return people.length
      ? people.map((person) => person.name || person.displayName || person.email || person.id).join('\n')
      : 'No staff assigned';
  }

  staffInitials(person: any): string {
    const name = String(person?.name || person?.displayName || person?.email || '?').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
  }

  staffAvatar(person: any): string {
    return String(person?.photoURL || person?.avatarUrl || '');
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

    let roles: string[] = [];
    if (Array.isArray(row['roles']) && row['roles'].length > 0) {
      roles = [...row['roles']];
    } else {
      const roleRaw = String(row['role'] || 'user');
      roles = roleRaw.split(',').map(r => r.trim());
    }

    if (roles.includes('madrasaIncharge') && !roles.includes('teacher')) {
      roles.push('teacher');
    }

    const displayRole = roles.map(r => r in ROLE_LABELS ? ROLE_LABELS[r as keyof typeof ROLE_LABELS] : (r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' '))).join(', ');

    const text = `DeenDesk Login Credentials

Role: ${displayRole}
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

  formatRole(roleRaw: any): string {
    if (!roleRaw) return '';
    const roles = String(roleRaw).split(',').map(r => r.trim());
    return roles.map(r => r in ROLE_LABELS ? ROLE_LABELS[r as keyof typeof ROLE_LABELS] : (r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' '))).join(', ');
  }
}
