import { Injectable } from '@angular/core';
import { ReportFieldMetadata } from '../../../core/models/report.model';
import * as xlsx from 'xlsx';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface PdfExportOptions {
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter' | 'Legal';
  theme: 'striped' | 'grid' | 'plain';
  showLogo: boolean;
  showPageNumbers: boolean;
  repeatHeader: boolean;
  organizationName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {
  constructor(private snackBar: MatSnackBar) {}

  public async exportToPdf(
    data: any[],
    columns: ReportFieldMetadata[],
    title: string,
    options: PdfExportOptions,
    logoBase64?: string | null
  ): Promise<void> {
    if (!data || data.length === 0) {
      this.snackBar.open('No records available to export.', 'Close', { duration: 3000 });
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF(options.orientation, 'mm', options.pageSize);
      
      let startY = 25;
      
      if (options.showLogo && logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 10, 15, 15);
        doc.setFontSize(18);
        doc.text(options.organizationName || 'Organization', 32, 17);
        doc.setFontSize(12);
        doc.text(title, 32, 23);
        startY = 35;
      } else {
        doc.setFontSize(18);
        doc.text(options.organizationName || 'Organization', 14, 15);
        doc.setFontSize(14);
        doc.text(title, 14, 22);
      }

      const headers = columns.map(c => c.label);
      const keys = columns.map(c => c.key);

      const tableData = data.map(row => {
        return keys.map(key => {
          let val = row[key];
          if (val && typeof val === 'object' && 'toDate' in val) {
            val = val.toDate().toISOString().split('T')[0];
          } else if (val instanceof Date) {
            val = val.toISOString().split('T')[0];
          }
          return val === null || val === undefined || val === '' ? '-' : String(val);
        });
      });

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: startY,
        theme: options.theme,
        headStyles: { fillColor: [63, 81, 181] },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        showHead: options.repeatHeader ? 'everyPage' : 'firstPage',
        didDrawPage: (data: any) => {
          if (options.showPageNumbers) {
            const pageCount = doc.getNumberOfPages();
            doc.setFontSize(8);
            doc.text(
              `Page ${data.pageNumber}`,
              data.settings.margin.left,
              doc.internal.pageSize.height - 10
            );
          }
        }
      });

      doc.save(`${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      this.snackBar.open('Error generating PDF.', 'Close', { duration: 3000 });
    }
  }

  public exportToExcel(data: any[], columns: ReportFieldMetadata[], title: string): void {
    if (!data || data.length === 0) return;

    const exportData = data.map(row => {
      const newRow: any = {};
      columns.forEach(col => {
        let val = row[col.key];
        if (val && typeof val === 'object' && 'toDate' in val) {
          val = val.toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        if (val === null || val === undefined || val === '') {
          val = '-';
        }
        newRow[col.label] = val;
      });
      return newRow;
    });

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Report');
    xlsx.writeFile(wb, `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
  }

  public exportToCsv(data: any[], columns: ReportFieldMetadata[], title: string): void {
    if (!data || data.length === 0) return;

    const exportData = data.map(row => {
      const newRow: any = {};
      columns.forEach(col => {
        let val = row[col.key];
        if (val && typeof val === 'object' && 'toDate' in val) {
          val = val.toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        if (val === null || val === undefined || val === '') {
          val = '-';
        }
        newRow[col.label] = val;
      });
      return newRow;
    });

    const ws = xlsx.utils.json_to_sheet(exportData);
    const csv = xlsx.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
