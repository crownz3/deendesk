import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ViewChild, AfterViewInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
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
    { name: 'Student Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'student') },
    { name: 'Staff Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'staff') },
    { name: 'Madrasa Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'madrasa') },
    { name: 'Academic Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'academic') },
    { name: 'Attendance Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'attendance') },
    { name: 'Generic Count Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'count') },
    { name: 'Activity Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'activity') },
    { name: 'Event Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'events') },
    { name: 'Issue Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'issues') },
    { name: 'Property Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'properties') },
    { name: 'Lifecycle Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'lifecycle') }
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
  
  public dataSource = new MatTableDataSource<any>([]);
  public state?: ReportState;
  
  public rightSidebarTab: 'columns' | 'filters' | 'sorting' | 'grouping' | 'export' = 'columns';
  public visualizationMode: 'table' | 'bar' = 'table';
  
  public isLeftSidebarVisible = true;
  public isRightSidebarVisible = true;
  
  private _paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginator(paginator: MatPaginator) {
    if (paginator) {
      this._paginator = paginator;
      this.dataSource.paginator = paginator;
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
    // Re-trigger the ngOnInit flow to reload data
    this.ngOnInit();
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
        this.displayColumns = this.selectedColumns.map(c => c.key);
        if (this._paginator) {
          this.dataSource.paginator = this._paginator;
        }
      })
    );

    this.loadSavedReports();
  }

  ngAfterViewInit() {
    if (this._paginator) {
      this.dataSource.paginator = this._paginator;
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
        this.selectReport(selectedReportId);
      }
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

  public exportPdf() {
    const reportTitle = this.state?.baseDefinition?.name || 'Report';
    const opts: PdfExportOptions = {
      orientation: 'landscape',
      pageSize: 'A4',
      theme: 'striped',
      showLogo: true,
      showPageNumbers: true,
      repeatHeader: true,
      organizationName: 'DeenDesk',
      headerTitle: reportTitle,
      headerColor: '#3f51b5',
      alignColumns: 'center',
      highlightRows: true
    };
    this.exportService.exportToPdf(this.state?.data || [], this.selectedColumns, reportTitle, opts);
  }

  public exportExcel() {
    this.exportService.exportToExcel(this.state?.data || [], this.selectedColumns, this.state?.baseDefinition?.name || 'Report');
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
        const data = this.state?.data || [];
        const baseTitle = this.state?.baseDefinition?.name || 'Report';
        if (result.format === 'pdf') {
          this.exportService.exportToPdf(data, result.columns, baseTitle, result.pdfOptions);
        } else if (result.format === 'excel') {
          this.exportService.exportToExcel(data, result.columns, baseTitle);
        } else if (result.format === 'csv') {
          this.exportService.exportToCsv(data, result.columns, baseTitle);
        }
      }
    });
  }
}
