import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Subscription, firstValueFrom } from 'rxjs';
import { ReportBuilderService, ReportState } from './services/report-builder.service';
import { ReportExportService, PdfExportOptions } from './services/report-export.service';
import { REPORT_DEFINITIONS } from './report-definitions';
import { ReportFieldMetadata, ReportDefinition, SavedReportTemplate } from '../../core/models/report.model';
import { ReportExportWizardComponent } from './components/report-export-wizard.component';
import { AddCustomColumnDialogComponent } from './components/add-custom-column-dialog.component';
import { AddUserInputColumnDialogComponent } from './components/add-user-input-column-dialog.component';
import { SaveReportDialogComponent } from './components/save-report-dialog.component';
import { ManageReportsDialogComponent } from './components/manage-reports-dialog.component';
import { ReportTemplatesDialogComponent } from './components/report-templates-dialog.component';
import { OverallStrengthReportDialogComponent } from './components/overall-strength-report-dialog.component';
import { MadrasaStudentMovementReportDialogComponent } from './components/madrasa-student-movement-report-dialog.component';
import { MadrasaUsthadhListReportDialogComponent } from './components/madrasa-usthadh-list-report-dialog.component';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage implements OnInit, OnDestroy, AfterViewInit {
  public reportGroups = [
    { name: 'Client Requested Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'client') },
    { name: 'Student Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'student') },
    { name: 'Staff Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'staff') },
    { name: 'Madrasa Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'madrasa') },
    { name: 'Generic Count Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'count') }
  ].filter(group => group.configs.length > 0);

  public _reportSearch = '';
  public filteredReportGroups = this.reportGroups;
  public savedReports: SavedReportTemplate[] = [];
  public filteredSavedReports: SavedReportTemplate[] = [];

  get reportSearch(): string {
    return this._reportSearch;
  }
  
  set reportSearch(val: string) {
    this._reportSearch = val;
    this.filterReports();
  }

  public filterReports() {
    const q = (this._reportSearch || '').toLowerCase().trim();
    if (!q) {
      this.filteredReportGroups = this.reportGroups;
      this.filteredSavedReports = [...this.savedReports];
      return;
    }

    this.filteredSavedReports = this.savedReports.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.description && r.description.toLowerCase().includes(q))
    );

    this.filteredReportGroups = this.reportGroups.map(group => {
      const matchingConfigs = group.configs.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        ((c as any).description && (c as any).description.toLowerCase().includes(q))
      );
      return {
        ...group,
        configs: matchingConfigs
      };
    }).filter(group => group.configs.length > 0);
  }

  public availableFields: ReportFieldMetadata[] = [];
  public selectedColumns: ReportFieldMetadata[] = [];
  public displayColumns: string[] = [];
  get displayedColumnKeys(): string[] { return this.displayColumns; }
  set displayedColumnKeys(val: string[]) { this.displayColumns = val; }

  public fieldSearchQuery = '';
  public tableSearchQuery = '';

  get filteredAvailableFields(): ReportFieldMetadata[] {
    const q = (this.fieldSearchQuery || '').toLowerCase().trim();
    if (!q) return this.availableFields;
    return this.availableFields.filter(f =>
      (f.label && f.label.toLowerCase().includes(q)) ||
      (f.key && f.key.toLowerCase().includes(q))
    );
  }

  applyTableFilter(query: string): void {
    this.tableSearchQuery = query;
    this.dataSource.filter = (query || '').trim().toLowerCase();
  }
  
  public dataSource = new MatTableDataSource<any>([]);
  public state?: ReportState;
  
  public rightSidebarTab: 'columns' | 'filters' | 'grouping' | 'totals' | 'export' = 'columns';
  public visualizationMode: 'table' | 'bar' = 'table';


  get selectedGroupFields(): string[] {
    return this.state?.grouping || [];
  }

  setGroupFields(fieldKeys: string[]): void {
    const grouping = Array.isArray(fieldKeys) ? fieldKeys.filter(Boolean) : [];
    this.builder.updateGrouping(grouping);
    this.sortDataByGrouping(grouping);
  }

  public getActiveGroupingKeys(): string[] {
    if (this.state?.grouping && this.state.grouping.length > 0) {
      return this.state.grouping;
    }
    if (this._sort && this._sort.active && this._sort.direction) {
      return [this._sort.active];
    }
    return [];
  }

  public isSameOrAliasField(keyA: string, keyB: string): boolean {
    if (keyA === keyB) return true;
    const madrasaAliases = ['madrasaNameDisplay', 'madrasaName', 'madrasa', 'madrasaId', 'madrasas', 'matharasaName', 'madrasa_id'];
    if (madrasaAliases.includes(keyA) && madrasaAliases.includes(keyB)) return true;

    const courseAliases = ['courseNameDisplay', 'courseName', 'courseTitle', 'course', 'courseId'];
    if (courseAliases.includes(keyA) && courseAliases.includes(keyB)) return true;

    const classAliases = ['classNameDisplay', 'className', 'classTitle', 'class', 'classId'];
    if (classAliases.includes(keyA) && classAliases.includes(keyB)) return true;

    const groupAliases = ['assignedClassGroupDisplay', 'groupName', 'classGroupName', 'classGroupId', 'groupId', 'group'];
    if (groupAliases.includes(keyA) && groupAliases.includes(keyB)) return true;

    const staffAliases = ['assignedStaffNamesDisplay', 'usthadhName', 'staffName', 'teacherName', 'staff', 'teacher'];
    if (staffAliases.includes(keyA) && staffAliases.includes(keyB)) return true;

    return false;
  }

  private getNormalizedValue(row: any, key: string): string {
    if (!row) return '';
    if (['madrasaNameDisplay', 'madrasaName', 'madrasa', 'madrasaId', 'madrasas', 'matharasaName'].includes(key)) {
      const val = row['madrasaNameDisplay'] || row['madrasaName'] || row['matharasaName'] || row['madrasa'] || row['madrasaId'] || '';
      return String(val || '').trim().toLowerCase();
    }
    if (['courseNameDisplay', 'courseName', 'courseTitle', 'course', 'courseId'].includes(key)) {
      const val = row['courseNameDisplay'] || row['courseName'] || row['courseTitle'] || row['course'] || row['courseId'] || '';
      return String(val || '').trim().toLowerCase();
    }
    if (['classNameDisplay', 'className', 'classTitle', 'class', 'classId'].includes(key)) {
      const val = row['classNameDisplay'] || row['className'] || row['classTitle'] || row['class'] || row['classId'] || '';
      return String(val || '').trim().toLowerCase();
    }
    if (['assignedClassGroupDisplay', 'groupName', 'classGroupName', 'classGroupId', 'groupId', 'group'].includes(key)) {
      const val = row['assignedClassGroupDisplay'] || row['groupName'] || row['classGroupName'] || row['classGroupId'] || row['groupId'] || row['group'] || '';
      return String(val || '').trim().toLowerCase();
    }
    if (['assignedStaffNamesDisplay', 'usthadhName', 'staffName', 'teacherName', 'staff'].includes(key)) {
      const val = row['assignedStaffNamesDisplay'] || row['usthadhName'] || row['staffName'] || row['teacherName'] || row['staff'] || '';
      return String(val || '').trim().toLowerCase();
    }
    return String(row[key] || '').trim().toLowerCase();
  }

  isGroupField(colKey: string): boolean {
    const activeGrouping = this.getActiveGroupingKeys();
    if (!activeGrouping || activeGrouping.length === 0) return false;

    return activeGrouping.some(gKey => this.isSameOrAliasField(gKey, colKey));
  }

  private isMultiLevelMatch(rowA: any, rowB: any, colKey: string): boolean {
    if (!rowA || !rowB) return false;
    const grouping = this.getActiveGroupingKeys();
    if (!grouping || grouping.length === 0) return false;

    let targetIndex = grouping.findIndex(g => this.isSameOrAliasField(g, colKey));
    if (targetIndex === -1 && (colKey === 'madrasaInchargeDisplay' || colKey === 'madrasaIncharge')) {
      targetIndex = grouping.findIndex(g => this.isSameOrAliasField(g, 'madrasaNameDisplay'));
    }
    const keysToCheck = targetIndex >= 0 ? grouping.slice(0, targetIndex + 1) : [colKey];

    return keysToCheck.every(key => {
      const valA = this.getNormalizedValue(rowA, key);
      const valB = this.getNormalizedValue(rowB, key);
      return valA !== '' && valA === valB;
    });
  }

  getAbsoluteIndex(pageIndexOnScreen: number): number {
    if (this._paginator) {
      const pageIndex = this._paginator.pageIndex || 0;
      const pageSize = this._paginator.pageSize || 20;
      return (pageIndex * pageSize) + pageIndexOnScreen;
    }
    return pageIndexOnScreen;
  }

  shouldShowCell(element: any, colKey: string, pageIndexOnScreen: number): boolean {
    const grouping = this.getActiveGroupingKeys();
    if (!grouping || grouping.length === 0 || !this.isGroupField(colKey)) {
      return true;
    }
    const absIndex = this.getAbsoluteIndex(pageIndexOnScreen);
    if (absIndex === 0) return true;

    const data = this.dataSource.filteredData || this.dataSource.data;
    const prevElement = data[absIndex - 1];
    if (!prevElement) return true;

    return !this.isMultiLevelMatch(element, prevElement, colKey);
  }

  isNewGroupRow(pageIndexOnScreen: number): boolean {
    const grouping = this.getActiveGroupingKeys();
    if (!grouping || grouping.length === 0) {
      return false;
    }
    const absIndex = this.getAbsoluteIndex(pageIndexOnScreen);
    if (absIndex === 0) return false;

    const data = this.dataSource.filteredData || this.dataSource.data;
    const currentElem = data[absIndex];
    const prevElement = data[absIndex - 1];
    if (!currentElem || !prevElement) return false;

    const primaryGroupKey = grouping[0];
    const currentVal = this.getNormalizedValue(currentElem, primaryGroupKey);
    const prevVal = this.getNormalizedValue(prevElement, primaryGroupKey);

    return currentVal !== prevVal;
  }

  getGroupRowSpan(element: any, colKey: string, pageIndexOnScreen: number): number | null {
    const grouping = this.getActiveGroupingKeys();
    if (!grouping || grouping.length === 0 || !this.isGroupField(colKey)) {
      return 1;
    }
    
    if (!this.shouldShowCell(element, colKey, pageIndexOnScreen)) {
      return null;
    }

    const absIndex = this.getAbsoluteIndex(pageIndexOnScreen);
    const data = this.dataSource.filteredData || this.dataSource.data;

    let span = 1;
    for (let k = absIndex + 1; k < data.length; k++) {
      if (this.isMultiLevelMatch(element, data[k], colKey)) {
        span++;
      } else {
        break;
      }
    }

    if (this._paginator) {
      const pageSize = this._paginator.pageSize || 20;
      const indexInPage = pageIndexOnScreen % pageSize;
      const remainingOnPage = pageSize - indexInPage;
      if (span > remainingOnPage) {
        span = remainingOnPage;
      }
    }

    return span > 1 ? span : 1;
  }

  public sortDataByGrouping(grouping: string[]): void {
    if (!this.dataSource || !this.dataSource.data || !grouping || grouping.length === 0) return;

    const sorted = [...this.dataSource.data].sort((a, b) => {
      for (const gKey of grouping) {
        const valA = this.getNormalizedValue(a, gKey);
        const valB = this.getNormalizedValue(b, gKey);
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    this.dataSource.data = sorted;
  }

  public getGroupSubtotalSummary(element: any): string {
    if (!element || !this.dataSource || !this.dataSource.filteredData) return '';
    const grouping = this.getActiveGroupingKeys();
    if (!grouping || grouping.length === 0) return '';
    
    const primaryGroupKey = grouping[0];
    const targetVal = this.getNormalizedValue(element, primaryGroupKey);
    if (!targetVal) return '';

    const groupRows = this.dataSource.filteredData.filter(r => 
      this.getNormalizedValue(r, primaryGroupKey) === targetVal
    );

    const numericCols = this.selectedColumns.filter(c => this.isNumericKey(c.key));
    if (numericCols.length === 0) {
      return `${groupRows.length} item(s)`;
    }

    const parts = numericCols.map(col => {
      const sum = groupRows.reduce((acc, r) => {
        const v = parseFloat(r[col.key]);
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
      const sumVal = Number.isInteger(sum) ? sum : parseFloat(sum.toFixed(2));
      return `${col.label}: ${sumVal}`;
    });

    return parts.join(' | ');
  }

  // Totals & Aggregation Settings
  public enableTotalSummary = true;
  public enableGroupSubtotals = true;
  public showRowTotalColumn = false;
  public selectedTotalColumnKeys: string[] = [];
  public totalDisplayScope: 'lastPage' | 'everyPage' = 'lastPage';
  public columnTotalModes: { [key: string]: 'sum' | 'count' } = {};

  public updateDisplayColumns(): void {
    let keys = this.selectedColumns.map(c => c.key);
    if (this.enableTotalSummary && this.showRowTotalColumn) {
      keys = [...keys, 'row_total_summary'];
    }
    this.displayColumns = keys;
  }

  public isTotalColumnSelected(key: string): boolean {
    return this.selectedTotalColumnKeys.includes(key);
  }

  public toggleTotalColumn(key: string): void {
    if (this.isTotalColumnSelected(key)) {
      this.selectedTotalColumnKeys = this.selectedTotalColumnKeys.filter(k => k !== key);
    } else {
      this.selectedTotalColumnKeys.push(key);
    }
    this.updateDisplayColumns();
  }

  public getColumnTotalMode(key: string): 'sum' | 'count' {
    if (this.columnTotalModes[key]) return this.columnTotalModes[key];
    return this.isNumericKey(key) ? 'sum' : 'count';
  }

  public setColumnTotalMode(key: string, mode: 'sum' | 'count'): void {
    this.columnTotalModes[key] = mode;
  }

  public isNumericKey(key: string): boolean {
    const k = (key || '').toLowerCase();
    return k.includes('count') || k.includes('amount') || k.includes('score') || k.includes('total') ||
           k.includes('capacity') || k.includes('order') || k.includes('fee') || k.includes('paid') ||
           k.includes('due') || k.includes('balance') || k.includes('age');
  }

  public getColumnSum(key: string): string | number {
    if (!this.dataSource || !this.dataSource.filteredData) return 0;
    const mode = this.getColumnTotalMode(key);

    if (mode === 'count') {
      const count = this.dataSource.filteredData.filter(row => {
        const val = row[key];
        return val !== null && val !== undefined && val !== '' && val !== '-';
      }).length;
      return `${count} count`;
    }

    const sum = this.dataSource.filteredData.reduce((acc, row) => {
      const val = parseFloat(row[key]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return Number.isInteger(sum) ? sum : parseFloat(sum.toFixed(2));
  }

  public getRowTotal(row: any): number {
    if (!row) return 0;
    const keysToSum = this.selectedTotalColumnKeys.length > 0
      ? this.selectedTotalColumnKeys
      : this.selectedColumns.map(c => c.key).filter(k => this.isNumericKey(k));

    return keysToSum.reduce((acc, key) => {
      const val = parseFloat(row[key]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }

  public getGrandTotalSum(): number {
    if (!this.dataSource || !this.dataSource.filteredData) return 0;
    return this.dataSource.filteredData.reduce((acc, row) => acc + this.getRowTotal(row), 0);
  }
  
  public isLeftSidebarVisible = true;
  public isRightSidebarVisible = true;
  public isMobileView = false;
  public mobileDisplayMode: 'table' | 'cards' = 'table';

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobileViewport();
  }

  private checkMobileViewport() {
    const wasMobile = this.isMobileView;
    this.isMobileView = window.innerWidth <= 768;
    if (this.isMobileView && !wasMobile) {
      this.isLeftSidebarVisible = false;
      this.isRightSidebarVisible = false;
    }
  }

  public toggleMobileDisplayMode(mode: 'table' | 'cards'): void {
    this.mobileDisplayMode = mode;
  }
  
  private _paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginator(paginator: MatPaginator) {
    if (paginator) {
      this._paginator = paginator;
      this.dataSource.paginator = paginator;
    }
  }

  private _sort!: MatSort;
  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      this._sort = sort;
      this.dataSource.sort = sort;
    }
  }

  private sub = new Subscription();

  constructor(
    public builder: ReportBuilderService,
    private exportService: ReportExportService,
    private dialog: MatDialog,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  refreshData(): void {
    this.repo.clearCache();
    this.ngOnInit();
  }

  get isClassGroupReport(): boolean {
    const baseDef = this.state?.baseDefinition;
    return baseDef?.collection === 'classGroups' || baseDef?.id === 'class-group-list';
  }

  get unassignedCount(): number {
    return this.state?.unassignedCount || 0;
  }

  get paginatedData(): any[] {
    if (!this.dataSource || !this.dataSource.filteredData) return [];
    const data = this.dataSource.filteredData;
    if (!this._paginator) return data;
    const startIndex = this._paginator.pageIndex * this._paginator.pageSize;
    return data.slice(startIndex, startIndex + this._paginator.pageSize);
  }

  get allFilterableFields(): ReportFieldMetadata[] {
    if (!this.state || !this.state.baseDefinition) return [];
    
    const all = [...this.state.baseDefinition.columns];
    const baseKeys = new Set(all.map(c => c.key));
    
    for (const col of this.selectedColumns) {
      if (!baseKeys.has(col.key)) {
        all.push(col);
        baseKeys.add(col.key);
      }
    }
    
    for (const col of this.availableFields) {
      if (!baseKeys.has(col.key)) {
        all.push(col);
        baseKeys.add(col.key);
      }
    }
    
    return all.filter(c => !c.hidden);
  }

  ngOnInit() {
    this.checkMobileViewport();
    this.dataSource.sortingDataAccessor = (data: any, sortHeaderId: string) => {
      const value = data[sortHeaderId];
      if (value === null || value === undefined || value === '' || value === '-') {
        return '';
      }
      if (typeof value === 'number') {
        return value;
      }
      const num = Number(value);
      if (!isNaN(num) && String(value).trim() !== '' && !String(value).includes('/') && !String(value).includes('-')) {
        return num;
      }
      return String(value).toLowerCase().trim();
    };

    this.dataSource.filterPredicate = (data: any, filter: string) => {
      if (!filter) return true;
      const searchStr = Object.keys(data).map(key => {
        const val = data[key];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }).join(' ').toLowerCase();

      return searchStr.includes(filter);
    };

    this.sub.add(
      this.builder.state$.subscribe(state => {
        this.state = state;
        
        if (state.baseDefinition) {
          if (this.selectedColumns.length === 0) {
            this.selectedColumns = [...state.columns];
          }
          this.updateAvailableFields();
        }

        this.dataSource.data = state.data || [];
        const activeGrouping = this.getActiveGroupingKeys();
        if (activeGrouping.length > 0) {
          this.sortDataByGrouping(activeGrouping);
        }
        if (this.tableSearchQuery) {
          this.dataSource.filter = this.tableSearchQuery.trim().toLowerCase();
        }
        this.updateDisplayColumns();
        if (this._paginator) {
          this.dataSource.paginator = this._paginator;
        }
        if (this._sort) {
          this.dataSource.sort = this._sort;
        }
      })
    );

    this.loadSavedReports();
  }

  ngAfterViewInit() {
    if (this._paginator) {
      this.dataSource.paginator = this._paginator;
    }
    if (this._sort) {
      this.dataSource.sort = this._sort;
      this._sort.sortChange.subscribe(() => {
        if (this._sort.active && this._sort.direction) {
          this.sortDataByGrouping([this._sort.active]);
        }
      });
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  async loadSavedReports() {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) return;
    const allTemplates = await this.repo.getAllOnce<SavedReportTemplate & Record<string, any>>('reports', profile) as SavedReportTemplate[];
    
    const userOrgId = profile.organizationId;
    const userUid = profile.uid;

    this.savedReports = allTemplates.filter(r => {
      if (profile.role === 'superAdmin') return true;
      if (r.organizationId) {
        return r.organizationId === userOrgId;
      }
      return r.createdBy === userUid || !userOrgId;
    });
    this.filteredSavedReports = [...this.savedReports];
  }

  public selectReport(reportId: string) {
    // Clear previous report columns and data immediately
    this.selectedColumns = [];
    this.displayColumns = [];
    this.availableFields = [];
    this.dataSource.data = [];

    if (this.state) {
      this.state.loading = true;
      this.state.data = [];
    }

    const saved = this.savedReports.find(r => r.id === reportId);
    if (saved) {
      this.builder.loadReportDefinition(saved.baseReportId);
      // Wait for base to load, then apply saved custom configuration
      setTimeout(() => {
        if (saved.columns && saved.columns.length > 0) {
          this.selectedColumns = [...saved.columns];
          this.builder.updateColumns(saved.columns);
        }
        if (saved.filters) {
          this.builder.updateFilters(saved.filters);
        }
      }, 100);
    } else {
      this.builder.loadReportDefinition(reportId);
    }
  }

  get activeReportName(): string {
    if (!this.state?.activeReportId) return 'Select Report Template';
    const saved = this.savedReports.find(r => r.id === this.state?.activeReportId);
    if (saved) return saved.name;

    for (const group of this.reportGroups) {
      const found = group.configs.find(c => c.id === this.state?.activeReportId);
      if (found) return found.name;
    }
    return 'Select Report Template';
  }

  public openReportTemplatesDialog(): void {
    const dialogRef = this.dialog.open(ReportTemplatesDialogComponent, {
      width: '760px',
      maxWidth: '92vw',
      panelClass: 'report-templates-dialog-panel',
      data: {
        activeReportId: this.state?.activeReportId || '',
        savedReports: this.savedReports || [],
        reportGroups: this.reportGroups || []
      }
    });

    dialogRef.afterClosed().subscribe((selectedReportId: string | undefined) => {
      if (selectedReportId) {
        if (selectedReportId === 'overall-strength-report') {
          this.openOverallStrengthReportDialog();
        } else if (selectedReportId === 'madrasa-student-movement-details-report') {
          this.openMadrasaStudentMovementReportDialog();
        } else if (selectedReportId === 'madrasa-usthadh-list-report') {
          this.openMadrasaUsthadhListReportDialog();
        } else {
          this.selectReport(selectedReportId);
        }
      }
    });
  }

  public openOverallStrengthReportDialog() {
    this.dialog.open(OverallStrengthReportDialogComponent, {
      width: '95vw',
      maxWidth: '1100px',
      autoFocus: false,
      panelClass: 'overall-strength-dialog-panel'
    });
  }

  public openMadrasaStudentMovementReportDialog() {
    this.dialog.open(MadrasaStudentMovementReportDialogComponent, {
      width: '95vw',
      maxWidth: '1000px',
      autoFocus: false,
      panelClass: 'madrasa-student-movement-dialog-panel'
    });
  }

  public openMadrasaUsthadhListReportDialog() {
    this.dialog.open(MadrasaUsthadhListReportDialogComponent, {
      width: '95vw',
      maxWidth: '1000px',
      autoFocus: false,
      panelClass: 'madrasa-usthadh-dialog-panel'
    });
  }

  public openSaveReportDialog() {
    const dialogRef = this.dialog.open(SaveReportDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && result.name) {
        const profile = await firstValueFrom(this.auth.profile$);
        if (!profile) return;
        
        if (!this.state || !this.state.baseDefinition) {
          this.snackBar.open('Cannot save report without a base definition.', 'Close', {duration: 3000});
          return;
        }

        const template: any = {
          name: result.name,
          description: result.description || '',
          baseReportId: this.state.baseDefinition.id,
          category: this.state.baseDefinition.category,
          columns: this.selectedColumns,
          filters: this.state.filters || [],
          sorting: [],
          grouping: [],
          aggregations: {},
          exportSettings: {},
          appearance: {},
          pageSize: 50,
          organizationId: profile.organizationId || '',
          madrasaId: profile.madrasaId || ''
        };

        try {
          await this.repo.create('reports', template, profile);
          this.snackBar.open('Report saved successfully', 'Close', {duration: 3000});
          this.loadSavedReports(); // Reload list
        } catch (error: any) {
          this.snackBar.open('Error saving report: ' + error.message, 'Close', {duration: 5000});
        }
      }
    });
  }

  public openManageReportsDialog() {
    const dialogRef = this.dialog.open(ManageReportsDialogComponent, {
      width: '600px',
      data: {
        reports: this.savedReports
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) return;
      const profile = await firstValueFrom(this.auth.profile$);
      if (!profile) return;

      if (result.action === 'rename' && result.newName) {
        try {
          await this.repo.update('reports', result.reportId, { name: result.newName }, profile);
          this.snackBar.open('Report renamed successfully.', 'Close', { duration: 3000 });
          this.loadSavedReports();
        } catch (err: any) {
          this.snackBar.open('Error renaming report: ' + err.message, 'Close', { duration: 3000 });
        }
      } else if (result.action === 'update') {
        try {
          await this.repo.update('reports', result.reportId, {
            columns: this.selectedColumns,
            filters: this.state?.filters || []
          }, profile);
          this.snackBar.open('Report configuration updated successfully.', 'Close', { duration: 3000 });
          this.loadSavedReports();
        } catch (err: any) {
          this.snackBar.open('Error updating report: ' + err.message, 'Close', { duration: 3000 });
        }
      } else if (result.action === 'delete') {
        try {
          await this.repo.remove('reports', result.reportId);
          this.snackBar.open('Custom report deleted.', 'Close', { duration: 3000 });
          this.loadSavedReports();
        } catch (err: any) {
          this.snackBar.open('Error deleting report: ' + err.message, 'Close', { duration: 3000 });
        }
      }
    });
  }

  // --- Drag and Drop Logic ---

  public updateAvailableFields() {
    if (!this.state || !this.state.baseDefinition) return;

    // Collect all known fields from base definition + current available + selected
    const knownFieldsMap = new Map<string, ReportFieldMetadata>();
    this.state.baseDefinition.columns.forEach(c => knownFieldsMap.set(c.key, c));
    this.availableFields.forEach(c => knownFieldsMap.set(c.key, c));
    this.selectedColumns.forEach(c => knownFieldsMap.set(c.key, c));

    const activeSelectedKeys = new Set(this.selectedColumns.map(c => c.key));
    this.availableFields = Array.from(knownFieldsMap.values()).filter(c => !activeSelectedKeys.has(c.key) && !c.hidden);
  }

  public drop(event: CdkDragDrop<ReportFieldMetadata[]>) {
    if (event.previousContainer === event.container) {
      // Reordering within the same list
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Moving between available and selected
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    
    // IMMEDIATELY sync displayColumns and availableFields
    this.displayColumns = this.selectedColumns.map(c => c.key);
    this.updateAvailableFields();

    if (event.container.id === 'selectedColumnsList' || event.previousContainer.id === 'selectedColumnsList') {
       // Update state if selected columns changed
       const newColumns = [...this.selectedColumns];
       this.builder.updateColumns(newColumns);
    }
  }

  public removeColumn(index: number) {
    const removed = this.selectedColumns.splice(index, 1);
    this.displayColumns = this.selectedColumns.map(c => c.key);
    this.updateAvailableFields();
    this.builder.updateColumns([...this.selectedColumns]);
  }

  public addColumn(field: ReportFieldMetadata) {
    if (!this.selectedColumns.some(c => c.key === field.key)) {
      this.selectedColumns.push(field);
    }
    this.displayColumns = this.selectedColumns.map(c => c.key);
    this.updateAvailableFields();
    this.builder.updateColumns([...this.selectedColumns]);
  }

  public openAddCustomColumnDialog() {
    let sampleKeys: string[] = [];
    if (this.state && this.state.data && this.state.data.length > 0) {
      // Collect unique keys from the first few rows to give a good sample
      const keySet = new Set<string>();
      this.state.data.slice(0, 5).forEach(row => Object.keys(row).forEach(k => keySet.add(k)));
      sampleKeys = Array.from(keySet).sort();
    }

    const dialogRef = this.dialog.open(AddCustomColumnDialogComponent, {
      width: '700px',
      data: { availableKeys: sampleKeys }
    });

    dialogRef.afterClosed().subscribe((result: ReportFieldMetadata) => {
      if (result) {
        this.availableFields.push(result);
        this.addColumn(result);
      }
    });
  }

  public openAddUserInputColumnDialog() {
    const dialogRef = this.dialog.open(AddUserInputColumnDialogComponent, {
      width: '450px'
    });

    dialogRef.afterClosed().subscribe((label: string) => {
      if (label) {
        const newKey = '_custom_col_' + new Date().getTime();
        const newField: ReportFieldMetadata = {
          key: newKey,
          label: label,
          type: 'text' as any,
          isUserInput: true,
          defaultVisible: true,
          sortable: false,
          filterable: false,
          groupable: false,
          exportable: true
        };
        this.availableFields.push(newField);
        this.addColumn(newField);
      }
    });
  }

  public guessTypeForKey(key: string, value?: any): any {
    if (!key) return null;
    let lower = key.toLowerCase().trim();

    if (lower === 'org' || lower === 'orgname' || lower.includes('organization') || lower.includes('org')) {
      return 'organization';
    }
    
    const validTypes = ['organization', 'madrasa', 'user', 'course', 'class', 'subject', 'student', 'parent', 'staff', 'teacher', 'coordinator', 'incharge'];
    
    // Check if the key contains any of our known types
    for (const type of validTypes) {
      if (lower.includes(type)) {
        return type;
      }
    }
    
    if (lower.includes('createdby') || lower.includes('updatedby')) {
      return 'user';
    }

    // Still end with ID?
    if (lower.endsWith('id') && key.length > 2) {
      let prefix = lower.slice(0, -2);
      if (prefix.endsWith('_')) {
        prefix = prefix.slice(0, -1);
      }
      return prefix;
    }
    
    // Fallback: If the string value looks exactly like a 28-character Firebase Auth UID
    if (value && typeof value === 'string' && value.length === 28) {
      // It's highly likely a user (teacher/coordinator/parent/admin)
      return 'user';
    }
    
    return null;
  }

  // --- Export Logic ---

  public getSortedExportData(): any[] {
    const rawData = this.dataSource.filteredData.length > 0 ? this.dataSource.filteredData : (this.state?.data || []);
    if (this._sort && this._sort.active && this._sort.direction) {
      return this.dataSource.sortData([...rawData], this._sort);
    }
    return rawData;
  }

  public exportPdf() {
    const reportTitle = this.state?.baseDefinition?.name || 'Report';
    const opts: PdfExportOptions = {
      orientation: 'landscape',
      pageSize: 'A4',
      theme: 'grid',
      showLogo: true,
      showPageNumbers: true,
      repeatHeader: true,
      organizationName: 'DeenDesk',
      headerTitle: reportTitle,
      headerColor: '#3f51b5',
      alignColumns: 'center',
      highlightRows: true,
      grouping: this.state?.grouping || [],
      enableTotalSummary: this.enableTotalSummary,
      enableGroupSubtotals: this.enableGroupSubtotals,
      totalDisplayScope: this.enableTotalSummary ? this.totalDisplayScope : 'none',
      selectedTotalColumnKeys: this.enableTotalSummary ? this.selectedTotalColumnKeys : [],
      columnTotalModes: this.columnTotalModes
    };
    const exportData = this.getSortedExportData();
    this.exportService.exportToPdf(exportData, this.selectedColumns, reportTitle, opts);
  }

  public exportExcel() {
    const exportData = this.getSortedExportData();
    this.exportService.exportToExcel(exportData, this.selectedColumns, this.state?.baseDefinition?.name || 'Report', this.state?.grouping || []);
  }

  public openExportWizard() {
    const reportTitle = this.state?.baseDefinition?.name || 'Report';
    const dialogRef = this.dialog.open(ReportExportWizardComponent, {
      width: '90vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      data: {
        availableColumns: this.state?.baseDefinition?.columns || [],
        selectedColumns: this.selectedColumns,
        reportTitle: reportTitle,
        appName: 'DeenDesk'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const data = this.getSortedExportData();
        const baseTitle = this.state?.baseDefinition?.name || 'Report';
        if (result.format === 'pdf') {
          const pdfOpts: PdfExportOptions = {
            ...result.pdfOptions,
            grouping: this.state?.grouping || [],
            enableTotalSummary: this.enableTotalSummary,
            enableGroupSubtotals: this.enableGroupSubtotals,
            totalDisplayScope: this.enableTotalSummary ? this.totalDisplayScope : 'none',
            selectedTotalColumnKeys: this.enableTotalSummary ? this.selectedTotalColumnKeys : [],
            columnTotalModes: this.columnTotalModes
          };
          this.exportService.exportToPdf(data, result.columns, baseTitle, pdfOpts);
        } else if (result.format === 'excel') {
          this.exportService.exportToExcel(data, result.columns, baseTitle, this.state?.grouping || []);
        } else if (result.format === 'csv') {
          this.exportService.exportToCsv(data, result.columns, baseTitle, this.state?.grouping || []);
        }
      }
    });
  }
}
