import { Component, EventEmitter, Input, Output, OnChanges, OnInit, AfterViewInit, ViewChild, SimpleChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TableColumn } from '../../../core/models/domain.model';
import { ROLE_LABELS } from '../../../core/constants/defaults';
import { EntityRecord } from '../../../core/services/repository.service';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  standalone: false,
})
export class DataTableComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() resourceKey = 'default';
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
  @Input() excludeRole?: string | string[];

  @Input() pageSizeOptions = [10, 25, 50, 100];
  @Input() pageSize = 12;

  @Output() edit = new EventEmitter<EntityRecord>();
  @Output() remove = new EventEmitter<EntityRecord>();
  @Output() activate = new EventEmitter<EntityRecord>();
  @Output() swap = new EventEmitter<EntityRecord>();
  @Output() resetPassword = new EventEmitter<EntityRecord>();
  @Output() sendResetEmail = new EventEmitter<EntityRecord>();
  @Output() promote = new EventEmitter<EntityRecord>();
  @Output() viewDetails = new EventEmitter<EntityRecord>();
  @Output() viewStudents = new EventEmitter<EntityRecord>();
  @Output() viewMadrasas = new EventEmitter<EntityRecord>();
  @Output() permanentlyDelete = new EventEmitter<EntityRecord>();
  @Output() transfer = new EventEmitter<EntityRecord>();
  @Output() assignStudents = new EventEmitter<EntityRecord>();
  @Output() assignStaff = new EventEmitter<EntityRecord>();
  @Output() emptyAction = new EventEmitter<void>();
  @Output() impersonate = new EventEmitter<any>();

  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<EntityRecord>();
  selection = new SelectionModel<EntityRecord>(true, []);

  viewMode: 'table' | 'card' = 'table';
  visibleCardFieldKeys: string[] = [];
  pageIndex = 0;

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadViewPreferences();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows']) {
      this.dataSource.data = this.rows || [];
    }
    if (changes['columns'] || changes['resourceKey']) {
      this.loadViewPreferences();
    }
  }

  loadViewPreferences(): void {
    try {
      const savedMode = localStorage.getItem(`deendesk_view_mode_${this.resourceKey}`);
      if (savedMode === 'card' || savedMode === 'table') {
        this.viewMode = savedMode;
      }

      const savedFields = localStorage.getItem(`deendesk_card_fields_${this.resourceKey}`);
      if (savedFields) {
        this.visibleCardFieldKeys = JSON.parse(savedFields);
      } else {
        this.resetDefaultCardFields(false);
      }
    } catch (e) {
      this.resetDefaultCardFields(false);
    }
  }

  resetDefaultCardFields(save = true): void {
    if (!this.columns || !this.columns.length) {
      this.visibleCardFieldKeys = [];
      return;
    }

    const defaultPriorityKeys = [
      'displayName', 'name', 'title', 'role', 'mobileNumber', 'phone', 'mobile', 
      'gender', 'madrasaId', 'madrasas', 'madrasaCount', 'classGroup', 'stage', 
      'status', 'credentialStatus', 'studentCount'
    ];
    
    let selected = this.columns
      .map(c => c.key)
      .filter(k => 
        defaultPriorityKeys.includes(k) || 
        k.toLowerCase().includes('name') || 
        k.toLowerCase().includes('phone') || 
        k.toLowerCase().includes('mobile') || 
        k.toLowerCase().includes('role') || 
        k.toLowerCase().includes('gender') || 
        k.toLowerCase().includes('stage')
      );

    if (selected.length === 0) {
      selected = this.columns.slice(0, 6).map(c => c.key);
    }

    this.visibleCardFieldKeys = Array.from(new Set(selected));
    if (save) {
      try {
        localStorage.setItem(`deendesk_card_fields_${this.resourceKey}`, JSON.stringify(this.visibleCardFieldKeys));
      } catch (e) {}
    }
  }

  onViewModeChange(mode: 'table' | 'card'): void {
    this.viewMode = mode;
    try {
      localStorage.setItem(`deendesk_view_mode_${this.resourceKey}`, mode);
    } catch (e) {}
  }

  toggleCardField(key: string): void {
    if (this.visibleCardFieldKeys.includes(key)) {
      this.visibleCardFieldKeys = this.visibleCardFieldKeys.filter(k => k !== key);
    } else {
      this.visibleCardFieldKeys = [...this.visibleCardFieldKeys, key];
    }
    try {
      localStorage.setItem(`deendesk_card_fields_${this.resourceKey}`, JSON.stringify(this.visibleCardFieldKeys));
    } catch (e) {}
  }

  isCardFieldVisible(key: string): boolean {
    return this.visibleCardFieldKeys.includes(key);
  }

  get visibleCardColumns(): TableColumn[] {
    return this.columns.filter(c => this.visibleCardFieldKeys.includes(c.key));
  }

  onPageChange(event: PageEvent | any): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  get pagedRows(): EntityRecord[] {
    const start = this.pageIndex * this.pageSize;
    return (this.rows || []).slice(start, start + this.pageSize);
  }

  formatStageDisplay(val: string): string {
    if (!val || val === 'N/A' || val === '-') return val;
    const str = String(val).trim();
    if (str.includes(' - ') || str.includes(':-') || str.includes(': ')) return str;

    const match = str.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(Stage\s*\d+|Sub-stage\s*\d+|Grade\s*\d+|Year\s*\d+|\d+)\b/i);
    if (match) {
      const mainPart = match[1].trim();
      const subPart = match[2].trim();
      const lower = mainPart.toLowerCase();
      if (lower !== 'stage' && lower !== 'substage' && lower !== 'sub-stage' && lower !== 'grade' && lower !== 'year') {
        return `${mainPart} - ${subPart}`;
      }
    }
    return str;
  }

  getCardFieldValue(row: EntityRecord, key: string): string {
    if (key === 'madrasaId' || key === 'madrasaIds') {
      if (row['madrasaNames'] && row['madrasaNames'] !== '-') return String(row['madrasaNames']);
      if (row['madrasaName']) return String(row['madrasaName']);
    }
    if (key === 'organizationId') {
      if (row['organizationName'] && row['organizationName'] !== '-') return String(row['organizationName']);
    }
    if (key === 'courseId') {
      if (row['courseName'] && row['courseName'] !== '-') return String(row['courseName']);
    }
    if (key === 'classId') {
      if (row['className'] && row['className'] !== '-') return String(row['className']);
    }
    if (key === 'linkedStudentIds' || key === 'studentId') {
      if (row['studentNames'] && row['studentNames'] !== '-') return String(row['studentNames']);
    }
    if (key === 'stage' || key === 'currentStage' || key === 'stageName' || key === 'targetStage') {
      return this.formatStageDisplay(this.text(row, key));
    }
    return this.text(row, key);
  }

  getCardTitle(row: EntityRecord): string {
    return String(row['displayName'] || row['name'] || row['primaryOrganizerName'] || row['title'] || row['code'] || 'Record');
  }

  getCardSubtitle(row: EntityRecord): string {
    if (row['email'] && String(row['email']).includes('@')) {
      return String(row['email']);
    }
    if (row['role']) {
      return this.formatRole(row['role']);
    }
    return '';
  }

  getCardAvatar(row: EntityRecord): string {
    return String(row['photoURL'] || row['avatarUrl'] || '');
  }

  getCardInitials(row: EntityRecord): string {
    const title = this.getCardTitle(row);
    const parts = title.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '?';
  }

  hasMadrasasButton(row: EntityRecord): boolean {
    return Boolean(row['madrasaCount'] || row['madrasaId'] || row['madrasaIds'] || row['madrasas']);
  }

  hasStudentsButton(row: EntityRecord): boolean {
    const count = Number(row['studentCount']);
    if (!isNaN(count) && count > 0) return true;
    return Boolean(this.allowAssignStudents);
  }

  hasAcademicButton(row: EntityRecord): boolean {
    return Boolean(row['classId'] || row['className'] || row['stage'] || row['groupId'] || row['classGroup']);
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      // Special sort handling for different column types
      const column = this.columns.find(c => c.key === property);
      if (column?.type === 'date') {
        const dateVal = this.getDate(item, property);
        return dateVal ? new Date(dateVal).getTime() : 0;
      }
      if (column?.type === 'role') {
        return this.formatRole(item[property]);
      }
      if (column?.type === 'boolean') {
        return item[property] ? 1 : 0;
      }
      // Fallback to the displayed text
      const textVal = this.text(item, property);
      return textVal === 'N/A' ? '' : textVal.toLowerCase();
    };
  }

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

  parseValueToDate(value: any): Date | null {
    if (value === undefined || value === null || value === '') return null;

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
      const dt = value > 1e11 ? new Date(value) : new Date(value * 1000);
      return isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof value === 'object') {
      if ('toDate' in value && typeof (value as any).toDate === 'function') {
        const dt = (value as any).toDate();
        return isNaN(dt.getTime()) ? null : dt;
      }
      if ('seconds' in value && typeof (value as any).seconds === 'number') {
        const dt = new Date((value as any).seconds * 1000);
        return isNaN(dt.getTime()) ? null : dt;
      }
      if ('_seconds' in value && typeof (value as any)._seconds === 'number') {
        const dt = new Date((value as any)._seconds * 1000);
        return isNaN(dt.getTime()) ? null : dt;
      }
      if ('toMillis' in value && typeof (value as any).toMillis === 'function') {
        const dt = new Date((value as any).toMillis());
        return isNaN(dt.getTime()) ? null : dt;
      }
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const tsMatch = trimmed.match(/Timestamp\(seconds=(\d+)/i);
      if (tsMatch) {
        const sec = Number(tsMatch[1]);
        if (!isNaN(sec)) {
          const dt = new Date(sec * 1000);
          return isNaN(dt.getTime()) ? null : dt;
        }
      }

      const num = Number(trimmed);
      if (!isNaN(num) && num > 1000000) {
        const dt = num > 1e11 ? new Date(num) : new Date(num * 1000);
        return isNaN(dt.getTime()) ? null : dt;
      }
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        const dt = new Date(parsed);
        return isNaN(dt.getTime()) ? null : dt;
      }
    }
    return null;
  }

  formatDateTime(val: any): string | null {
    const dt = this.parseValueToDate(val);
    if (!dt) return null;
    return dt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  text(row: EntityRecord, key: string): string {
    const value = this.value(row, key);
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'N/A';
    }
    if (value === undefined || value === null || value === '') return 'N/A';

    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('date') || lowerKey.includes('time') || lowerKey.includes('timestamp') || lowerKey.endsWith('at') || lowerKey.endsWith('ms')) {
      const formatted = this.formatDateTime(value);
      if (formatted) return formatted;
    }

    return String(value);
  }

  getDate(row: EntityRecord, key: string): Date | null {
    const value = row[key];
    return this.parseValueToDate(value);
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

  getStagesList(row: EntityRecord, key: string): string[] {
    const raw = row['stages'] || row[key];
    if (Array.isArray(raw)) {
      return raw.map(s => this.formatStageDisplay(typeof s === 'string' ? s : (s?.name || s?.title || String(s)))).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(',').map(s => this.formatStageDisplay(s.trim())).filter(Boolean);
    }
    return [];
  }

  getVisibleStages(row: EntityRecord, key: string, max = 2): string[] {
    return this.getStagesList(row, key).slice(0, max);
  }

  getHiddenStagesCount(row: EntityRecord, key: string, max = 2): number {
    const total = this.getStagesList(row, key).length;
    return total > max ? total - max : 0;
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
