import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReportFieldMetadata } from '../../../core/models/report.model';

@Component({
  selector: 'app-report-export-wizard',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Advanced Export Wizard</h2>
    <mat-dialog-content class="wizard-content">
      <mat-tab-group [(selectedIndex)]="activeTabIndex">
        <mat-tab label="Format">
          <div style="padding: 16px;">
            <mat-radio-group [(ngModel)]="format" style="display:flex; flex-direction:column; gap:16px;">
              <mat-radio-button value="pdf">PDF Document (.pdf)</mat-radio-button>
              <mat-radio-button value="excel">Excel Spreadsheet (.xlsx)</mat-radio-button>
              <mat-radio-button value="csv">CSV File (.csv)</mat-radio-button>
            </mat-radio-group>
          </div>
        </mat-tab>

        <mat-tab label="Columns">
          <div style="padding: 16px;">
            <p>Select which columns to include in the export:</p>

            <div style="display: flex; gap: 12px; margin-bottom: 12px;">
              <button mat-stroked-button color="primary" type="button" (click)="selectAllColumns()">Select All</button>
              <button mat-stroked-button type="button" (click)="deselectAllColumns()">Deselect All</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 300px; overflow-y: auto;">
              <div *ngFor="let col of data.availableColumns">
                 <mat-checkbox [checked]="isSelected(col.key)" (change)="toggleColumn(col.key)">
                   {{ col.label }}
                 </mat-checkbox>
              </div>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="PDF Customization & Live Preview" *ngIf="format === 'pdf'">
          <div class="pdf-customizer-grid">
            <!-- Left Side: Controls -->
            <div class="controls-panel">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>App / Organization Name</mat-label>
                <input matInput [(ngModel)]="pdfOptions.organizationName" placeholder="e.g. DeenDesk Madrasa Management">
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Report Header Title</mat-label>
                <input matInput [(ngModel)]="pdfOptions.headerTitle" placeholder="e.g. Madrasa Student Roster Report">
              </mat-form-field>

              <div class="d-flex gap-2">
                <mat-form-field appearance="outline" style="flex: 1;">
                  <mat-label>Header Background Color</mat-label>
                  <mat-select [(ngModel)]="pdfOptions.headerColor">
                    <mat-option value="#3f51b5">Primary Blue (#3f51b5)</mat-option>
                    <mat-option value="#00695c">Teal (#00695c)</mat-option>
                    <mat-option value="#2e7d32">Emerald Green (#2e7d32)</mat-option>
                    <mat-option value="#6a1b9a">Deep Purple (#6a1b9a)</mat-option>
                    <mat-option value="#37474f">Charcoal Gray (#37474f)</mat-option>
                    <mat-option value="#d32f2f">Crimson Red (#d32f2f)</mat-option>
                    <mat-option value="#000000">Classic Black (#000000)</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width: 120px;">
                  <mat-label>Hex Color</mat-label>
                  <input matInput [(ngModel)]="pdfOptions.headerColor" placeholder="#3f51b5">
                </mat-form-field>
              </div>

              <div class="d-flex gap-2">
                <mat-form-field appearance="outline" style="flex: 1;">
                  <mat-label>Row Highlight Color</mat-label>
                  <mat-select [(ngModel)]="pdfOptions.highlightColor">
                    <mat-option value="#f8fafc">Subtle Slate (#f8fafc)</mat-option>
                    <mat-option value="#e8f5e9">Mint Green (#e8f5e9)</mat-option>
                    <mat-option value="#e3f2fd">Soft Blue (#e3f2fd)</mat-option>
                    <mat-option value="#fff9c4">Soft Yellow (#fff9c4)</mat-option>
                    <mat-option value="#f3e5f5">Soft Purple (#f3e5f5)</mat-option>
                    <mat-option value="#fff3e0">Soft Orange (#fff3e0)</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width: 120px;">
                  <mat-label>Row Hex</mat-label>
                  <input matInput [(ngModel)]="pdfOptions.highlightColor" placeholder="#f8fafc">
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Max Export Rows Limit</mat-label>
                <mat-select [(ngModel)]="pdfOptions.maxRows">
                  <mat-option value="all">All Available Records</mat-option>
                  <mat-option [value]="10">Top 10 Records</mat-option>
                  <mat-option [value]="25">Top 25 Records</mat-option>
                  <mat-option [value]="50">Top 50 Records</mat-option>
                  <mat-option [value]="100">Top 100 Records</mat-option>
                  <mat-option [value]="500">Top 500 Records</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Column Text Alignment</mat-label>
                <mat-select [(ngModel)]="pdfOptions.alignColumns">
                  <mat-option value="center">Center All Columns (Recommended)</mat-option>
                  <mat-option value="left">Left Align</mat-option>
                  <mat-option value="right">Right Align</mat-option>
                </mat-select>
              </mat-form-field>

              <div class="d-flex gap-2">
                <mat-form-field appearance="outline" style="flex: 1;">
                  <mat-label>Orientation</mat-label>
                  <mat-select [(ngModel)]="pdfOptions.orientation">
                    <mat-option value="landscape">Landscape</mat-option>
                    <mat-option value="portrait">Portrait</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" style="flex: 1;">
                  <mat-label>Page Size</mat-label>
                  <mat-select [(ngModel)]="pdfOptions.pageSize">
                    <mat-option value="A4">A4</mat-option>
                    <mat-option value="Letter">Letter</mat-option>
                    <mat-option value="Legal">Legal</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="options-checklist">
                <mat-checkbox [(ngModel)]="pdfOptions.showLogo">Show Logo</mat-checkbox>
                <mat-checkbox [(ngModel)]="pdfOptions.showPageNumbers">Show Page Numbers</mat-checkbox>
                <mat-checkbox [(ngModel)]="pdfOptions.repeatHeader">Repeat Header on Every Page</mat-checkbox>
                <mat-checkbox [(ngModel)]="pdfOptions.highlightRows">Highlight Alternate Rows</mat-checkbox>
                <mat-checkbox [(ngModel)]="pdfOptions.enableGroupSubtotals">Include Per-Group Subtotals (Madrasa Subtotals)</mat-checkbox>
                <mat-checkbox [(ngModel)]="pdfOptions.enableTotalSummary">Include Overall Grand Total Row on Last Page</mat-checkbox>
              </div>
            </div>

            <!-- Right Side: Live PDF Preview Card -->
            <div class="preview-panel">
              <div class="preview-header-bar">
                <span><mat-icon style="font-size: 16px; vertical-align: middle;">visibility</mat-icon> Live PDF Document Preview</span>
                <span class="badge">{{ pdfOptions.orientation | uppercase }} • {{ pdfOptions.pageSize }}</span>
              </div>

              <div class="pdf-page-paper" [class.landscape]="pdfOptions.orientation === 'landscape'">
                <!-- PDF Header Section -->
                <div class="pdf-doc-header">
                  <div class="pdf-logo-box" *ngIf="pdfOptions.showLogo">
                    <img src="assets/images/deendesk-logo.png" alt="Logo" class="pdf-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                    <span class="pdf-logo-fallback" style="display:none;">DD</span>
                  </div>
                  <div class="pdf-title-box">
                    <div class="pdf-app-name">{{ pdfOptions.organizationName || 'DeenDesk' }}</div>
                    <div class="pdf-doc-title">{{ pdfOptions.headerTitle || 'Report' }}</div>
                  </div>
                </div>

                <!-- PDF Live Table -->
                <table class="pdf-live-table">
                  <thead>
                    <tr [style.background-color]="validHexColor(pdfOptions.headerColor)">
                      <th style="width: 42px; text-align: center; font-weight: 700;">S.No</th>
                      <th *ngFor="let col of activePreviewColumns" [style.text-align]="pdfOptions.alignColumns || 'center'">
                        {{ col.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of mockRows; let idx = index" [style.background-color]="pdfOptions.highlightRows && idx % 2 === 1 ? validHexColor(pdfOptions.highlightColor, '#f8fafc') : 'transparent'">
                      <td style="width: 42px; text-align: center; font-weight: 700; color: #475569;">{{ idx + 1 }}</td>
                      <td *ngFor="let col of activePreviewColumns" [style.text-align]="pdfOptions.alignColumns || 'center'">
                        {{ getMockValue(col, idx) }}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- PDF Page Footer -->
                <div class="pdf-doc-footer" *ngIf="pdfOptions.showPageNumbers">
                  <span>Page 1 of 1</span>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="export()">Export {{ format | uppercase }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .wizard-content {
      padding-top: 8px;
    }
    .pdf-customizer-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 16px;
      padding: 16px 0;
      max-height: 520px;
    }
    .controls-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      padding-right: 8px;
      max-height: 480px;
    }
    .preview-panel {
      background: #eef2f5;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      max-height: 480px;
    }
    @media (max-width: 768px) {
      .pdf-customizer-grid {
        grid-template-columns: 1fr !important;
        max-height: none !important;
      }
      .controls-panel, .preview-panel {
        max-height: none !important;
        padding-right: 0 !important;
      }
    }
    .preview-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 13px;
      color: #475569;
    }
    .badge {
      background: #cbd5e1;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .pdf-page-paper {
      background: #ffffff;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: 380px;
      box-sizing: border-box;
    }
    .pdf-doc-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .pdf-logo-box {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pdf-logo-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .pdf-logo-fallback {
      background: #3f51b5;
      color: #fff;
      font-weight: bold;
      font-size: 11px;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pdf-app-name {
      font-weight: 700;
      font-size: 15px;
      color: #1e293b;
    }
    .pdf-doc-title {
      font-size: 12px;
      color: #64748b;
    }
    .pdf-live-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 4px;
      flex: 1;
    }
    .pdf-live-table th {
      color: #ffffff;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
    }
    .pdf-live-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .pdf-doc-footer {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      font-size: 10px;
      color: #94a3b8;
    }
    .w-full { width: 100%; }
    .d-flex { display: flex; }
    .gap-2 { gap: 8px; }
    .options-checklist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }
  `]
})
export class ReportExportWizardComponent {
  public activeTabIndex = 0;
  public format: 'pdf' | 'excel' | 'csv' = 'pdf';
  public selectedColumns: string[];
  public pdfOptions = {
    orientation: 'landscape',
    pageSize: 'A4',
    showLogo: true,
    showPageNumbers: true,
    repeatHeader: true,
    theme: 'striped',
    organizationName: 'DeenDesk',
    headerTitle: '',
    headerColor: '#3f51b5',
    alignColumns: 'center',
    highlightRows: true,
    highlightColor: '#f8fafc',
    maxRows: 'all' as number | 'all',
    enableTotalSummary: true,
    enableGroupSubtotals: true
  };

  public mockRows = [1, 2, 3, 4];

  constructor(
    public dialogRef: MatDialogRef<ReportExportWizardComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { availableColumns: ReportFieldMetadata[], selectedColumns: ReportFieldMetadata[], reportTitle?: string, appName?: string }
  ) {
    this.selectedColumns = data.selectedColumns.map(c => c.key);
    if (data.reportTitle) this.pdfOptions.headerTitle = data.reportTitle;
    if (data.appName) this.pdfOptions.organizationName = data.appName;
  }

  get activePreviewColumns(): ReportFieldMetadata[] {
    const cols = this.data.availableColumns.filter(c => this.selectedColumns.includes(c.key));
    return cols.length > 0 ? cols.slice(0, 5) : this.data.availableColumns.slice(0, 4);
  }

  validHexColor(colorStr: string, fallback = '#3f51b5'): string {
    if (!colorStr) return fallback;
    let hex = colorStr.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    return /^#[0-9A-Fa-f]{6}$/.test(hex) || /^#[0-9A-Fa-f]{3}$/.test(hex) ? hex : fallback;
  }

  getMockValue(col: ReportFieldMetadata, idx: number): string {
    const samples: Record<string, string[]> = {
      name: ['AL BAQIYATH ACADEMY', 'Al-Noor Foundation', 'Madrasa An-Noor', 'Darul Uloom'],
      studentNameDisplay: ['Ahmad Mansoor', 'Mohamed Bilal', 'Fathima Salih', 'Umar Farooq'],
      fatherNameDisplay: ['V.K.G. Sheik Mansoor', 'K.S. Kaja Mydeen', 'A.S. Muharrama', 'A.M. Syed Ali'],
      status: ['Active', 'Active', 'Inactive', 'Active'],
      code: ['AGIRA26', 'm3', 'AGIRA17', 'AGIRA10'],
      gender: ['Male', 'Male', 'Female', 'Male'],
      stageDisplay: ['Primary', 'Middle', 'Secondary', 'Hifz'],
      classNameDisplay: ['Class 1A', 'Class 2B', 'Class 3A', 'Class 4C']
    };

    const key = col.key;
    if (samples[key]) {
      return samples[key][idx % samples[key].length];
    }
    if (key.toLowerCase().includes('date')) return `2026-07-0${idx + 1}`;
    if (key.toLowerCase().includes('status')) return idx % 2 === 0 ? 'Active' : 'Pending';
    return `Sample ${col.label} ${idx + 1}`;
  }

  isSelected(key: string): boolean {
    return this.selectedColumns.includes(key);
  }

  selectAllColumns() {
    this.selectedColumns = this.data.availableColumns.map(c => c.key);
  }

  deselectAllColumns() {
    this.selectedColumns = [];
  }

  toggleColumn(key: string) {
    if (this.isSelected(key)) {
      this.selectedColumns = this.selectedColumns.filter(k => k !== key);
    } else {
      this.selectedColumns.push(key);
    }
  }

  cancel() {
    this.dialogRef.close(null);
  }

  export() {
    const exportColumns = this.data.availableColumns.filter(c => this.selectedColumns.includes(c.key));
    this.dialogRef.close({
      format: this.format,
      columns: exportColumns.length ? exportColumns : this.data.availableColumns,
      pdfOptions: this.pdfOptions
    });
  }
}
