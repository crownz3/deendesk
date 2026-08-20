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
  grouping?: string[];
  enableTotalSummary?: boolean;
  totalDisplayScope?: 'lastPage' | 'everyPage' | 'none';
  selectedTotalColumnKeys?: string[];
  columnTotalModes?: { [key: string]: 'sum' | 'count' };
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

      const grouping = options.grouping || [];
      const primaryGroupKey = grouping.length > 0 ? grouping[0] : null;

      const isGroupedKey = (key: string) => {
        if (grouping.length === 0) return false;
        return grouping.includes(key) ||
          (grouping.includes('madrasaNameDisplay') && key === 'madrasaInchargeDisplay') ||
          (grouping.includes('madrasaId') && (key === 'madrasaNameDisplay' || key === 'madrasaInchargeDisplay'));
      };

      const isMultiGroupMatch = (rowA: any, rowB: any, targetKey: string) => {
        let lvl = grouping.indexOf(targetKey);
        if (lvl === -1 && targetKey === 'madrasaInchargeDisplay') {
          lvl = grouping.indexOf('madrasaNameDisplay');
        }
        const keysToCheck = lvl >= 0 ? grouping.slice(0, lvl + 1) : [targetKey];
        return keysToCheck.every(k => {
          const valA = String(rowA[k] || '').trim().toLowerCase();
          const valB = String(rowB[k] || '').trim().toLowerCase();
          return valA === valB;
        });
      };

      const alignment = options.alignColumns || 'center';
      const N = exportData.length;

      const tableData: any[] = [];

      if (grouping.length > 0 && N > 0) {
        // Calculate page height and estimated capacities to prevent rowSpan overflow
        const pageHeight = options.orientation === 'landscape'
          ? (options.pageSize === 'Legal' ? 216 : 210)
          : (options.pageSize === 'Legal' ? 356 : (options.pageSize === 'Letter' ? 279 : 297));

        const availFirstHeight = pageHeight - startY - 12 - 15;
        const availOtherHeight = pageHeight - 15 - 12 - 15;

        // Estimate row height based on text length across columns
        const getRowH = (r: any) => {
          let maxL = 1;
          for (const col of columns) {
            const str = String(r[col.key] || '');
            const lines = Math.ceil(str.length / 26);
            if (lines > maxL) maxL = lines;
          }
          return 6.0 + (maxL - 1) * 3.5;
        };

        // Determine page row ranges
        const pageRanges: { start: number; end: number }[] = [];
        let pStart = 0;
        let pageIdx = 0;

        while (pStart < N) {
          const targetH = (pageIdx === 0) ? availFirstHeight : availOtherHeight;
          let accH = 0;
          let pEnd = pStart;

          while (pEnd < N) {
            const h = getRowH(exportData[pEnd]);
            if (accH + h > targetH && pEnd > pStart) {
              pEnd--;
              break;
            }
            accH += h;
            pEnd++;
          }
          if (pEnd >= N) pEnd = N - 1;
          pageRanges.push({ start: pStart, end: pEnd });
          pStart = pEnd + 1;
          pageIdx++;
        }

        // Build tableData using native rowSpan for each page range
        for (const range of pageRanges) {
          const activeSpans = new Array(columns.length).fill(0);

          for (let i = range.start; i <= range.end; i++) {
            const row = exportData[i];
            const rowCells: any[] = [];

            for (let c = 0; c < columns.length; c++) {
              const col = columns[c];
              const key = col.key;
              const isGrouped = isGroupedKey(key);

              let val = row[key];
              if (val && typeof val === 'object' && 'toDate' in val) {
                val = val.toDate().toISOString().split('T')[0];
              } else if (val instanceof Date) {
                val = val.toISOString().split('T')[0];
              }
              const valStr = val === null || val === undefined || val === '' ? '-' : String(val);

              if (isGrouped) {
                if (activeSpans[c] > 0) {
                  activeSpans[c]--;
                  // Cell is omitted for jspdf-autotable rowSpan!
                } else {
                  let span = 1;
                  for (let k = i + 1; k <= range.end; k++) {
                    if (isMultiGroupMatch(row, exportData[k], key)) span++;
                    else break;
                  }

                  if (span > 1) {
                    activeSpans[c] = span - 1;
                    rowCells.push({
                      content: valStr,
                      rowSpan: span,
                      styles: {
                        valign: 'middle',
                        halign: alignment,
                        fontStyle: 'bold',
                        fillColor: [255, 255, 255]
                      }
                    });
                  } else {
                    rowCells.push({
                      content: valStr,
                      styles: {
                        valign: 'middle',
                        halign: alignment,
                        fontStyle: 'bold',
                        fillColor: [255, 255, 255]
                      }
                    });
                  }
                }
              } else {
                rowCells.push(valStr);
              }
            }

            tableData.push(rowCells);
          }
        }
      } else {
        // Flat table structure when no grouping is selected
        for (let i = 0; i < N; i++) {
          const row = exportData[i];
          tableData.push(columns.map(col => {
            let val = row[col.key];
            if (val && typeof val === 'object' && 'toDate' in val) {
              val = val.toDate().toISOString().split('T')[0];
            } else if (val instanceof Date) {
              val = val.toISOString().split('T')[0];
            }
            return val === null || val === undefined || val === '' ? '-' : String(val);
          }));
        }
      }

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

      const enableTotal = options.enableTotalSummary !== false && options.selectedTotalColumnKeys && options.selectedTotalColumnKeys.length > 0;
      let footerRow: any[] = [];

      if (enableTotal) {
        footerRow = columns.map((col, idx) => {
          if (options.selectedTotalColumnKeys?.includes(col.key)) {
            const mode = options.columnTotalModes?.[col.key] || (
              ['count', 'amount', 'score', 'total', 'fee', 'paid', 'due'].some(k => col.key.toLowerCase().includes(k)) ? 'sum' : 'count'
            );

            if (mode === 'count') {
              const nonNullCount = exportData.filter(r => r[col.key] !== null && r[col.key] !== undefined && r[col.key] !== '' && r[col.key] !== '-').length;
              return {
                content: `Total: ${nonNullCount}`,
                styles: { fontStyle: 'bold', halign: alignment, fillColor: [248, 250, 252], textColor: [15, 23, 42] }
              };
            } else {
              const sum = exportData.reduce((acc, r) => {
                const val = parseFloat(r[col.key]);
                return acc + (isNaN(val) ? 0 : val);
              }, 0);
              const sumStr = Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
              return {
                content: `Sum: ${sumStr}`,
                styles: { fontStyle: 'bold', halign: alignment, fillColor: [248, 250, 252], textColor: [15, 23, 42] }
              };
            }
          }

          if (idx === 0) {
            return {
              content: 'Total Summary',
              styles: { fontStyle: 'bold', halign: alignment, fillColor: [248, 250, 252], textColor: [15, 23, 42] }
            };
          }

          return {
            content: '-',
            styles: { fontStyle: 'bold', halign: alignment, fillColor: [248, 250, 252], textColor: [15, 23, 42] }
          };
        });
      }

      autoTable(doc, {
        head: [headers],
        body: tableData,
        foot: enableTotal ? [footerRow] : undefined,
        showFoot: options.totalDisplayScope === 'everyPage' ? 'everyPage' : (enableTotal ? 'lastPage' : undefined),
        footStyles: {
          fillColor: [248, 250, 252],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          halign: alignment,
          valign: 'middle'
        },
        startY: startY,
        theme: primaryGroupKey ? 'grid' : (options.theme || 'striped'),
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
          halign: alignment,
          valign: 'middle'
        },
        alternateRowStyles: options.highlightRows !== false && !primaryGroupKey ? {
          fillColor: altRgb
        } : undefined,
        showHead: options.repeatHeader !== false ? 'everyPage' : 'firstPage',
        didDrawCell: (hookData: any) => {
          if (hookData.section === 'body' && primaryGroupKey) {
            const rowIndex = hookData.row.index;
            const isNewGroup = (rowIndex === 0) || (
              exportData[rowIndex] && exportData[rowIndex - 1] &&
              String(exportData[rowIndex][primaryGroupKey] || '').trim().toLowerCase() !==
              String(exportData[rowIndex - 1][primaryGroupKey] || '').trim().toLowerCase()
            );

            // Draw clean top group divider line
            if (isNewGroup) {
              doc.setDrawColor(148, 163, 184); // #94a3b8 line
              doc.setLineWidth(0.4);
              doc.line(hookData.cell.x, hookData.cell.y, hookData.cell.x + hookData.cell.width, hookData.cell.y);
            }
          }
        },
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

  public exportToExcel(data: any[], columns: ReportFieldMetadata[], title: string, grouping: string[] = []): void {
    if (!data || data.length === 0) return;

    const primaryGroupKey = grouping.length > 0 ? grouping[0] : null;
    const isGroupedKey = (key: string) => {
      if (!primaryGroupKey) return false;
      return key === primaryGroupKey ||
        (primaryGroupKey === 'madrasaNameDisplay' && key === 'madrasaInchargeDisplay') ||
        (primaryGroupKey === 'madrasaId' && (key === 'madrasaNameDisplay' || key === 'madrasaInchargeDisplay'));
    };

    const exportData = data.map((row, index) => {
      const newRow: any = {};
      columns.forEach(col => {
        let val = row[col.key];
        if (val && typeof val === 'object' && 'toDate' in val) {
          val = val.toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        const valStr = val === null || val === undefined || val === '' ? '-' : String(val);

        if (primaryGroupKey && isGroupedKey(col.key)) {
          const isStartOfGroup = (index === 0) || String(data[index - 1][primaryGroupKey] || '').trim().toLowerCase() !== String(row[primaryGroupKey] || '').trim().toLowerCase();
          newRow[col.label] = isStartOfGroup ? valStr : '';
        } else {
          newRow[col.label] = valStr;
        }
      });
      return newRow;
    });

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Report');
    xlsx.writeFile(wb, `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
  }

  public exportToCsv(data: any[], columns: ReportFieldMetadata[], title: string, grouping: string[] = []): void {
    if (!data || data.length === 0) return;

    const primaryGroupKey = grouping.length > 0 ? grouping[0] : null;
    const isGroupedKey = (key: string) => {
      if (!primaryGroupKey) return false;
      return key === primaryGroupKey ||
        (primaryGroupKey === 'madrasaNameDisplay' && key === 'madrasaInchargeDisplay') ||
        (primaryGroupKey === 'madrasaId' && (key === 'madrasaNameDisplay' || key === 'madrasaInchargeDisplay'));
    };

    const exportData = data.map((row, index) => {
      const newRow: any = {};
      columns.forEach(col => {
        let val = row[col.key];
        if (val && typeof val === 'object' && 'toDate' in val) {
          val = val.toDate().toISOString().split('T')[0];
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        const valStr = val === null || val === undefined || val === '' ? '-' : String(val);

        if (primaryGroupKey && isGroupedKey(col.key)) {
          const isStartOfGroup = (index === 0) || String(data[index - 1][primaryGroupKey] || '').trim().toLowerCase() !== String(row[primaryGroupKey] || '').trim().toLowerCase();
          newRow[col.label] = isStartOfGroup ? valStr : '';
        } else {
          newRow[col.label] = valStr;
        }
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
