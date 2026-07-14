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
    { name: 'Activity Reports', configs: REPORT_DEFINITIONS.filter(c => c.category === 'activity') }
  ].filter(group => group.configs.length > 0);

  public _reportSearch = '';
  public filteredReportGroups = this.reportGroups;
  public savedReports: SavedReportTemplate[] = [];
  public filteredSavedReports: SavedReportTemplate[] = [];

  get reportSearch(): string {
    return this._reportSearch;
  }
  
  set reportSearch(value: string) {
    this._reportSearch = value;
    this.updateFilteredGroups();
  }

  private updateFilteredGroups() {
    if (!this._reportSearch) {
      this.filteredReportGroups = this.reportGroups;
      this.filteredSavedReports = this.savedReports;
      return;
    }
    const q = this._reportSearch.toLowerCase();
    
    this.filteredReportGroups = this.reportGroups.map(group => {
      // If group name matches, return all configs in it
      if (group.name.toLowerCase().includes(q)) {
        return group;
      }
      // Otherwise filter the configs
      const filteredConfigs = group.configs.filter(c => c.name.toLowerCase().includes(q));
      return { ...group, configs: filteredConfigs };
    }).filter(group => group.configs.length > 0);

    this.filteredSavedReports = this.savedReports.filter(r => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }

  public availableFields: ReportFieldMetadata[] = [];
  public selectedColumns: ReportFieldMetadata[] = [];
  public displayColumns: string[] = []; // Just keys for mat-table
  
  public dataSource = new MatTableDataSource<any>([]);
  public state!: ReportState;
  
  public rightSidebarTab: 'columns' | 'filters' | 'sorting' | 'grouping' | 'export' = 'columns';
  public visualizationMode: 'table' | 'bar' | 'pie' | 'line' = 'table';
  
  public isLeftSidebarVisible = true;
  public isRightSidebarVisible = true;
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private sub = new Subscription();

  constructor(
    public builder: ReportBuilderService,
    private exportService: ReportExportService,
    private dialog: MatDialog,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  get allFilterableFields(): ReportFieldMetadata[] {
    if (!this.state.baseDefinition) return [];
    
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
        this.dataSource.data = state.data;
        this.selectedColumns = [...state.columns];
        this.displayColumns = state.columns.map(c => c.key);
        this.updateAvailableFields();
      })
    );

    this.loadSavedReports();

    // Load default report on init
    this.builder.loadReportDefinition('student-list');
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  async loadSavedReports() {
    const profile = await firstValueFrom(this.auth.profile$);
    if (!profile) return;
    this.savedReports = await this.repo.getAllOnce<SavedReportTemplate & Record<string, any>>('reports', profile) as SavedReportTemplate[];
    this.filteredSavedReports = [...this.savedReports];
  }

  public selectReport(reportId: string) {
    const saved = this.savedReports.find(r => r.id === reportId);
    if (saved) {
      this.builder.loadReportDefinition(saved.baseReportId);
      // Wait for base to load, then apply saved state
      setTimeout(() => {
        this.builder.updateColumns(saved.columns);
        this.builder.updateFilters(saved.filters || []);
      }, 50);
    } else {
      this.builder.loadReportDefinition(reportId);
    }
  }

  public openSaveReportDialog() {
    const dialogRef = this.dialog.open(SaveReportDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && result.name) {
        const profile = await firstValueFrom(this.auth.profile$);
        if (!profile) return;
        
        if (!this.state.baseDefinition) {
          this.snackBar.open('Cannot save report without a base definition.', 'Close', {duration: 3000});
          return;
        }

        const template: any = {
          name: result.name,
          description: result.description || '',
          baseReportId: this.state.baseDefinition.id,
          category: this.state.baseDefinition.category,
          columns: this.selectedColumns,
          filters: this.state.filters,
          sorting: [], // To be implemented if sorting is added to UI
          grouping: [], // To be implemented
          aggregations: {},
          exportSettings: {},
          appearance: {},
          pageSize: 50
        };

        if (profile.madrasaId) {
          template.madrasaId = profile.madrasaId;
        }
        if (profile.organizationId) {
          template.organizationId = profile.organizationId;
        }

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

  // --- Drag and Drop Logic ---

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
    
    // IMMEDIATELY sync displayColumns so mat-table doesn't crash if a column def is removed
    this.displayColumns = this.selectedColumns.map(c => c.key);

    if (event.container.id === 'selectedColumnsList' || event.previousContainer.id === 'selectedColumnsList') {
       // Update state if selected columns changed
       const newColumns = [...this.selectedColumns];
       this.builder.updateColumns(newColumns);
    }
  }

  public removeColumn(index: number) {
    this.selectedColumns.splice(index, 1);
    this.displayColumns = this.selectedColumns.map(c => c.key);
    this.builder.updateColumns([...this.selectedColumns]);
  }

  public addColumn(field: ReportFieldMetadata) {
    this.selectedColumns.push(field);
    this.displayColumns = this.selectedColumns.map(c => c.key);
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

  private updateAvailableFields() {
    // In a fully dynamic system, this would come from a schema definition.
    // For now, we extract all possible fields from the base definition columns 
    // that are not currently selected.
    if (this.state.baseDefinition) {
      const allPossible = this.state.baseDefinition.columns;
      const selectedKeys = this.selectedColumns.map(c => c.key);
      this.availableFields = allPossible.filter((c: ReportFieldMetadata) => !selectedKeys.includes(c.key) && !c.hidden);
    }
  }

  public guessTypeForKey(key: string, value?: any): any {
    if (!key) return null;
    let lower = key.toLowerCase().trim();
    
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
    const opts: PdfExportOptions = {
      orientation: 'landscape',
      pageSize: 'A4',
      theme: 'striped',
      showLogo: true,
      showPageNumbers: true,
      repeatHeader: true,
      organizationName: 'DeenDesk' // Should come from context
    };
    this.exportService.exportToPdf(this.state.data, this.selectedColumns, this.state.baseDefinition?.name || 'Report', opts);
  }

  public exportExcel() {
    this.exportService.exportToExcel(this.state.data, this.selectedColumns, this.state.baseDefinition?.name || 'Report');
  }

  public openExportWizard() {
    const dialogRef = this.dialog.open(ReportExportWizardComponent, {
      width: '600px',
      data: {
        availableColumns: this.state.baseDefinition?.columns || [],
        selectedColumns: this.selectedColumns
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.format === 'pdf') {
          this.exportService.exportToPdf(this.state.data, result.columns, this.state.baseDefinition?.name || 'Report', result.pdfOptions);
        } else if (result.format === 'excel') {
          this.exportService.exportToExcel(this.state.data, result.columns, this.state.baseDefinition?.name || 'Report');
        } else if (result.format === 'csv') {
          this.exportService.exportToCsv(this.state.data, result.columns, this.state.baseDefinition?.name || 'Report');
        }
      }
    });
  }
}
