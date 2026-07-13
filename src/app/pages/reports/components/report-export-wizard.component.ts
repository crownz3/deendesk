import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReportFieldMetadata } from '../../../core/models/report.model';

@Component({
  selector: 'app-report-export-wizard',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Advanced Export Wizard</h2>
    <mat-dialog-content>
      <mat-tab-group>
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
            <div *ngFor="let col of data.availableColumns">
               <mat-checkbox [checked]="isSelected(col.key)" (change)="toggleColumn(col.key)">
                 {{ col.label }}
               </mat-checkbox>
            </div>
          </div>
        </mat-tab>
        <mat-tab label="PDF Settings" *ngIf="format === 'pdf'">
          <div style="padding: 16px; display:flex; flex-direction:column; gap:16px;">
            <mat-form-field appearance="outline">
              <mat-label>Orientation</mat-label>
              <mat-select [(ngModel)]="pdfOptions.orientation">
                <mat-option value="portrait">Portrait</mat-option>
                <mat-option value="landscape">Landscape</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Page Size</mat-label>
              <mat-select [(ngModel)]="pdfOptions.pageSize">
                <mat-option value="A4">A4</mat-option>
                <mat-option value="Letter">Letter</mat-option>
                <mat-option value="Legal">Legal</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-checkbox [(ngModel)]="pdfOptions.showLogo">Show Logo</mat-checkbox>
            <mat-checkbox [(ngModel)]="pdfOptions.showPageNumbers">Show Page Numbers</mat-checkbox>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="export()">Export</button>
    </mat-dialog-actions>
  `
})
export class ReportExportWizardComponent {
  public format: 'pdf' | 'excel' | 'csv' = 'pdf';
  public selectedColumns: string[];
  public pdfOptions = {
    orientation: 'landscape',
    pageSize: 'A4',
    showLogo: true,
    showPageNumbers: true,
    theme: 'striped'
  };

  constructor(
    public dialogRef: MatDialogRef<ReportExportWizardComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { availableColumns: ReportFieldMetadata[], selectedColumns: ReportFieldMetadata[] }
  ) {
    this.selectedColumns = data.selectedColumns.map(c => c.key);
  }

  isSelected(key: string): boolean {
    return this.selectedColumns.includes(key);
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
      columns: exportColumns,
      pdfOptions: this.pdfOptions
    });
  }
}
