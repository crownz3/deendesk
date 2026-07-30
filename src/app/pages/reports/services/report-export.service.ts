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
  headerTitle?: string;
  headerColor?: string;
  alignColumns?: 'center' | 'left' | 'right';
  highlightRows?: boolean;
  highlightColor?: string;
  maxRows?: number | 'all';
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
      const appName = options.organizationName?.trim() || 'DeenDesk';
      const docTitle = options.headerTitle?.trim() || title;

      if (options.showLogo && logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 10, 15, 15);
        doc.setFontSize(18);
        doc.text(appName, 32, 17);
        doc.setFontSize(12);
        doc.text(docTitle, 32, 23);
        startY = 35;
      } else {
        doc.setFontSize(18);
        doc.text(appName, 14, 15);
        doc.setFontSize(14);
        doc.text(docTitle, 14, 22);
      }

      let exportData = data;
      if (options.maxRows && options.maxRows !== 'all') {
        exportData = data.slice(0, Number(options.maxRows));
      }

      const headers = columns.map(c => c.label);
      const keys = columns.map(c => c.key);

      const tableData = exportData.map(row => {
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

      // Parse custom hex header color (default: #3f51b5)
      const hexColor = (options.headerColor || '#3f51b5').replace('#', '');
      const r = parseInt(hexColor.substring(0, 2), 16) || 63;
      const g = parseInt(hexColor.substring(2, 4), 16) || 81;
      const b = parseInt(hexColor.substring(4, 6), 16) || 181;
      const headerRgb: [number, number, number] = [r, g, b];

      // Parse custom hex row highlight color (default: #f8fafc)
      const altHexColor = (options.highlightColor || '#f8fafc').replace('#', '');
      const altR = parseInt(altHexColor.substring(0, 2), 16) || 248;
      const altG = parseInt(altHexColor.substring(2, 4), 16) || 250;
      const altB = parseInt(altHexColor.substring(4, 6), 16) || 252;
      const altRgb: [number, number, number] = [altR, altG, altB];

      const alignment = options.alignColumns || 'center';

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: startY,
        theme: options.theme || 'striped',
        headStyles: {
          fillColor: headerRgb,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: alignment
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: 'linebreak',
          halign: alignment
        },
        alternateRowStyles: options.highlightRows !== false ? {
          fillColor: altRgb
        } : undefined,
        showHead: options.repeatHeader !== false ? 'everyPage' : 'firstPage',
        didDrawPage: (data: any) => {
          if (options.showPageNumbers !== false) {
            doc.setFontSize(8);
            doc.text(
              `Page ${data.pageNumber}`,
              data.settings.margin.left,
              doc.internal.pageSize.height - 10
            );
          }
        }
      });

      doc.save(`${docTitle.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
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
