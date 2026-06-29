import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-report-export-options-dialog',
  templateUrl: './report-export-options-dialog.component.html',
  styleUrls: ['./report-export-options-dialog.component.scss'],
  standalone: false
})
export class ReportExportOptionsDialogComponent {
  format: 'pdf' | 'csv' | 'excel' = 'pdf';

  constructor(@Inject(MAT_DIALOG_DATA) public data: { reportType: string; totalRows: number }) {}
}
