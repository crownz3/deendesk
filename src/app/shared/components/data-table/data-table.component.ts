import { Component, EventEmitter, Input, Output, OnChanges, OnInit, AfterViewInit, ViewChild, SimpleChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TableColumn } from '../../../core/models/domain.model';
import { ROLE_LABELS } from '../../../core/constants/defaults';
import { EntityRecord } from '../../../core/services/repository.service';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';

import { StageInfoDialogComponent } from '../stage-info-dialog/stage-info-dialog.component';
import { MatDialog } from '@angular/material/dialog';

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
  @Input() allowEdit = true;
  @Input() allowPromotion = false;
  @Input() allowDetails = false;
  @Input() allowDelete = false;
  @Input() allowTransfer = false;
  @Input() allowSwap: boolean = false;
  @Input() allowAssignStudents: boolean = false;
  @Input() allowAssignStaff: boolean = false;
  @Input() allowImpersonate = false;
  @Input() allowProgressTracker = false;
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
  @Output() viewProgressTracker = new EventEmitter<EntityRecord>();
  @Output() emptyAction = new EventEmitter<void>();
  @Output() impersonate = new EventEmitter<any>();

  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<EntityRecord>();
  selection = new SelectionModel<EntityRecord>(true, []);

  viewMode: 'table' | 'card' = 'table';
  visibleCardFieldKeys: string[] = [];
  pageIndex = 0;

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  openGroupInfo(row: EntityRecord): void {
    this.dialog.open(StageInfoDialogComponent, {
      data: {
        title: 'Class Group Details',
        groupInfo: {
          name: String(row['name'] || row['title'] || 'Class Group'),
          courseName: String(row['courseName'] || row['courseId'] || ''),
          stageName: String(row['stage'] || row['stageOrLevel'] || row['level'] || ''),
          staffName: String(row['assignedStaffNames'] || row['staffName'] || ''),
          schedule: String(row['schedule'] || row['timing'] || row['shift'] || ''),
          studentCount: Number(row['studentCount'] || 0),
          description: String(row['description'] || row['remarks'] || '')
        }
      },
      width: '480px'
    });
  }

  onViewGroupStudents(row: EntityRecord, cg: any, event: Event): void {
    event.stopPropagation();
    const targetGroupId = String(cg.groupId || cg.id || '').trim();
    const targetGroupName = String(cg.groupName || cg.name || '').trim();
    const scopedRow: EntityRecord = {
      ...row,
      targetGroupId,
      targetGroupName
    };
    this.viewStudents.emit(scopedRow);
  }

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
        let keys: string[] = JSON.parse(savedFields);
        if (Array.isArray(keys) && this.columns && this.columns.length) {
          const defaultKeys = this.getDefaultPriorityKeys();
          const missingPriorityKeys = this.columns
            .map(c => c.key)
            .filter(k => !keys.includes(k) && (defaultKeys.includes(k) || k.toLowerCase().includes('staff') || k.toLowerCase().includes('teacher')));
          if (missingPriorityKeys.length > 0) {
            keys = Array.from(new Set([...keys, ...missingPriorityKeys]));
          }
          this.visibleCardFieldKeys = keys;
        } else {
          this.resetDefaultCardFields(false);
        }
      } else {
        this.resetDefaultCardFields(false);
      }
    } catch (e) {
      this.resetDefaultCardFields(false);
    }
  }

  getDefaultPriorityKeys(): string[] {
    return [
      'displayName', 'name', 'title', 'role', 'mobileNumber', 'phone', 'mobile', 
      'gender', 'courseId', 'classId', 'groupId', 'madrasaId', 'madrasas', 'madrasaCount', 'classGroup', 'stage', 
      'status', 'credentialStatus', 'studentCount', 'assignedStaffIds', 'groupStaff', 'teacherId', 'staffIds', 
      'assignedStaff', 'teacherName', 'staffName', 'staffNames', 'staff', 'classCount', 'groupCount'
    ];
  }

  resetDefaultCardFields(save = true): void {
    if (!this.columns || !this.columns.length) {
      this.visibleCardFieldKeys = [];
      return;
    }

    const defaultPriorityKeys = this.getDefaultPriorityKeys();
    
    let selected = this.columns
      .map(c => c.key)
      .filter(k => 
        defaultPriorityKeys.includes(k) || 
        k.toLowerCase().includes('name') || 
        k.toLowerCase().includes('phone') || 
        k.toLowerCase().includes('mobile') || 
        k.toLowerCase().includes('role') || 
        k.toLowerCase().includes('gender') || 
        k.toLowerCase().includes('course') || 
        k.toLowerCase().includes('class') || 
        k.toLowerCase().includes('group') || 
        k.toLowerCase().includes('stage') ||
        k.toLowerCase().includes('staff') ||
        k.toLowerCase().includes('teacher')
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

  isString(val: unknown): val is string {
    return typeof val === 'string';
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
    return this.rows || [];
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

  getTableCellValue(row: EntityRecord, column: TableColumn): string {
    const key = column.key;
    const cardVal = this.getCardFieldValue(row, key);
    if (cardVal && cardVal !== 'N/A' && cardVal !== '-' && cardVal !== String(row[key])) {
      return cardVal;
    }
    return this.text(row, key);
  }

  getFallbackName(row: EntityRecord, key: string): string | undefined {
    const idVal = this.value(row, key);
    if (this.isArray(idVal)) return undefined;

    const val = this.getCardFieldValue(row, key);
    if (val && val !== 'N/A' && val !== '-' && val !== String(row[key]) && val !== String(idVal)) {
      if (key.toLowerCase().includes('madrasa') && idVal && String(idVal) !== String(row['madrasaId'])) {
        return undefined;
      }
      return val;
    }
    return undefined;
  }

  getCardFieldValue(row: EntityRecord, key: string): string {
    if (key === 'madrasaId' || key === 'madrasaIds' || key === 'madrasa' || key === 'madrasas' || key === 'madrasaName' || key === 'madrasaNames') {
      const directVal = row[key];
      if (directVal && directVal !== '-') return String(directVal);
      const val = row['madrasaNames'] || row['madrasaName'] || row['madrasa'] || row['assignedMadrasas'] || row['assignedMadrasaNames'];
      if (val && val !== '-') return String(val);
    }
    if (key === 'organizationId') {
      const val = row['organizationName'] || row['orgName'] || row['organization'];
      if (val && val !== '-') return String(val);
    }
    if (key === 'courseId') {
      const val = row['courseName'] || row['courseTitle'] || row['course'];
      if (val && val !== '-') return String(val);
    }
    if (key === 'classId') {
      const val = row['className'] || row['classTitle'] || row['class'];
      if (val && val !== '-') return String(val);
    }
    if (key === 'groupId') {
      const val = row['groupName'] || row['sectionName'] || row['group'] || row['section'] || row['classGroupName'];
      if (val && val !== '-') return String(val);
    }
    if (key === 'linkedStudentIds' || key === 'studentId') {
      const val = row['studentNames'] || row['studentName'];
      if (val && val !== '-') return String(val);
    }
    if (key === 'teacherId' || key === 'assignedStaffIds') {
      const val = row['teacherName'] || row['staffName'] || row['staffNames'];
      if (val && val !== '-') return String(val);
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

  getMadrasaCountDisplay(row: EntityRecord): number {
    if (row['madrasaCount'] !== undefined && row['madrasaCount'] !== null && row['madrasaCount'] !== '') {
      return Number(row['madrasaCount']) || 0;
    }
    const madrasas = row['madrasaIds'] || row['madrasaNames'] || row['madrasas'] || row['assignedMadrasas'];
    if (Array.isArray(madrasas)) return madrasas.length || 1;
    if (typeof madrasas === 'string' && madrasas.includes(',')) {
      return madrasas.split(',').map(s => s.trim()).filter(Boolean).length || 1;
    }
    return 1;
  }

  hasMadrasasButton(row: EntityRecord): boolean {
    if (this.resourceKey === 'students' || this.resourceKey === 'student') return false;
    if (row['madrasaCount'] !== undefined || row['madrasaId'] || row['madrasaIds'] || row['madrasas'] || row['madrasaName'] || row['madrasaNames'] || row['madrasa'] || row['assignedMadrasas']) {
      return true;
    }
    return Boolean(this.allowEdit || this.allowDetails || ['users', 'staff', 'incharges', 'coordinators', 'management', 'teacher'].includes(this.resourceKey || ''));
  }

  hasStudentsButton(row: EntityRecord): boolean {
    const role = String(row['role'] || '').toLowerCase();
    if (role === 'student' || this.resourceKey === 'students' || this.resourceKey === 'student') return false;
    const count = Number(row['studentCount']);
    if (!isNaN(count) && count > 0) return true;
    return Boolean(this.allowAssignStudents);
  }

  hasAcademicButton(row: EntityRecord): boolean {
    if (this.resourceKey === 'students' || this.resourceKey === 'student') return false;
    return Boolean(row['classId'] || row['className'] || row['stage'] || row['groupId'] || row['classGroup']);
  }

  isMultiValue(row: EntityRecord, column: TableColumn): boolean {
    const items = this.getCardMultiValues(row, column);
    return Array.isArray(items) && items.length > 1;
  }

  getCardMultiValues(row: EntityRecord, column: TableColumn): any[] {
    if (!column || !row) return [];

    if (column.type === 'role' || column.key === 'roles' || column.key === 'role' || column.key === 'otherRoles') {
      const rawVal = row[column.key];
      let roles: string[] = [];
      if (Array.isArray(rawVal)) {
        roles = rawVal.map(r => String(r).trim());
      } else if (typeof rawVal === 'string') {
        roles = rawVal.split(',').map(r => r.trim());
      }

      if (roles.length > 0) {
        if (roles.some(r => ['teacher', 'ustadh', 'madrasaincharge', 'stagehead', 'coordinator', 'headteacher'].includes(r.toLowerCase()))) {
          roles = roles.filter(r => r.toLowerCase() !== 'staff');
        }
        roles = Array.from(new Set(roles));
        if (roles.length > 1) return roles;
        return [];
      }
    }

    if (column.type === 'staffChips') {
      const staff = this.staffPeople(row, column.key);
      if (staff && staff.length > 1) return staff;
    }

    if (column.type === 'stageChips') {
      const stages = this.getVisibleStages(row, column.key);
      if (stages && stages.length > 1) return stages;
    }

    if (column.type === 'idRef') {
      const val = this.value(row, column.key);
      if (this.isArray(val)) {
        const arr = this.asArray(val);
        if (arr.length > 1) return arr;
      }
    }

    const rawVal = row[column.key];
    if (Array.isArray(rawVal) && rawVal.length > 1) {
      return rawVal;
    }

    if (typeof rawVal === 'string' && rawVal.includes(',')) {
      const items = rawVal.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length > 1) return items;
    }

    const cardVal = this.getCardFieldValue(row, column.key);
    if (cardVal && cardVal !== 'N/A' && cardVal.includes(',')) {
      const items = cardVal.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length > 1) return items;
    }

    return [];
  }

  getItemText(item: any): string {
    if (item === null || item === undefined) return '';
    if (typeof item === 'object') {
      return item.name || item.title || item.label || item.displayName || item.email || item.id || String(item);
    }
    const str = String(item);
    if (str in ROLE_LABELS) {
      return ROLE_LABELS[str as keyof typeof ROLE_LABELS];
    }
    if (str.replace(/([A-Z])/g, ' $1') !== str) {
      return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    }
    return str;
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
    let roles = String(roleRaw).split(',').map(r => r.trim());
    if (roles.some(r => ['teacher', 'ustadh', 'madrasaincharge', 'stagehead', 'coordinator', 'headteacher'].includes(r.toLowerCase()))) {
      roles = roles.filter(r => r.toLowerCase() !== 'staff');
    }
    return roles.map(r => r in ROLE_LABELS ? ROLE_LABELS[r as keyof typeof ROLE_LABELS] : (r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' '))).join(', ');
  }
}
