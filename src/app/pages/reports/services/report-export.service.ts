import { Injectable } from '@angular/core';
import { ReportFieldMetadata } from '../../../core/models/report.model';
import * as xlsx from 'xlsx';
import { MatSnackBar } from '@angular/material/snack-bar';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  enableGroupSubtotals?: boolean;
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

      const getNormalizedRowValue = (row: any, key: string): string => {
        if (!row) return '';
        const madrasaAliases = ['madrasaNameDisplay', 'madrasaName', 'madrasa', 'madrasaId', 'madrasas', 'matharasaName', 'madrasa_id'];
        if (madrasaAliases.includes(key)) {
          for (const a of madrasaAliases) {
            if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') {
              return String(row[a]).trim();
            }
          }
        }

        const courseAliases = ['courseNameDisplay', 'courseName', 'courseTitle', 'course', 'courseId'];
        if (courseAliases.includes(key)) {
          for (const a of courseAliases) {
            if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') {
              return String(row[a]).trim();
            }
          }
        }

        const classAliases = ['classNameDisplay', 'className', 'classTitle', 'class', 'classId'];
        if (classAliases.includes(key)) {
          for (const a of classAliases) {
            if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') {
              return String(row[a]).trim();
            }
          }
        }

        const groupAliases = ['assignedClassGroupDisplay', 'groupName', 'classGroupName', 'classGroupId', 'groupId', 'group'];
        if (groupAliases.includes(key)) {
          for (const a of groupAliases) {
            if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') {
              return String(row[a]).trim();
            }
          }
        }

        const staffAliases = ['assignedStaffNamesDisplay', 'usthadhName', 'staffName', 'teacherName', 'staff', 'teacher'];
        if (staffAliases.includes(key)) {
          for (const a of staffAliases) {
            if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') {
              return String(row[a]).trim();
            }
          }
        }

        const val = row[key];
        return val === undefined || val === null ? '' : String(val).trim();
      };

      const grouping = options.grouping || [];
      const primaryGroupKey = grouping.length > 0 ? grouping[0] : null;

      const isGroupedKey = (key: string) => {
        if (grouping.length === 0) return false;
        return grouping.includes(key) ||
          (grouping.includes('madrasaNameDisplay') && (key === 'madrasaName' || key === 'matharasaName' || key === 'madrasaInchargeDisplay')) ||
          (grouping.includes('madrasaId') && (key === 'madrasaNameDisplay' || key === 'madrasaInchargeDisplay'));
      };

      const isColumnNumeric = (colKey: string) => {
        const k = colKey.toLowerCase();
        return ['count', 'student', 'enrolled', 'amount', 'score', 'total', 'fee', 'paid', 'due', 'capacity', 'order', 'balance', 'age'].some(kw => k.includes(kw)) ||
          (options.selectedTotalColumnKeys && options.selectedTotalColumnKeys.includes(colKey));
      };

      const alignment = options.alignColumns || 'center';
      const N = exportData.length;

      const tableData: any[] = [];

      if (grouping.length > 0 && N > 0) {
        // Group exportData into contiguous group blocks using normalized group key values
        const groups: { val: string; rows: any[] }[] = [];
        let curVal: string | null = null;
        let curRows: any[] = [];

        for (const r of exportData) {
          const gVal = getNormalizedRowValue(r, primaryGroupKey!);
          if (curVal === null || gVal.toLowerCase() !== curVal.toLowerCase()) {
            if (curRows.length > 0) {
              groups.push({ val: curVal || 'Group', rows: curRows });
            }
            curVal = gVal;
            curRows = [r];
          } else {
            curRows.push(r);
          }
        }
        if (curRows.length > 0) {
          groups.push({ val: curVal || 'Group', rows: curRows });
        }

        for (const g of groups) {
          for (let rIdx = 0; rIdx < g.rows.length; rIdx++) {
            const row = g.rows[rIdx];
            const rowCells: any[] = [];

            for (let c = 0; c < columns.length; c++) {
              const col = columns[c];
              const key = col.key;
              const isGrouped = isGroupedKey(key);

              let val = getNormalizedRowValue(row, key) || row[key];
              if (val && typeof val === 'object' && 'toDate' in val) {
                val = val.toDate().toISOString().split('T')[0];
              } else if (val instanceof Date) {
                val = val.toISOString().split('T')[0];
              }
              const valStr = val === null || val === undefined || val === '' ? '-' : String(val);

              if (isGrouped) {
                if (rIdx === 0) {
                  rowCells.push({
                    content: valStr,
                    rowSpan: g.rows.length,
                    styles: {
                      valign: 'middle',
                      halign: alignment,
                      fontStyle: 'bold',
                      fillColor: [255, 255, 255]
                    }
                  });
                }
                // Omit cell if rIdx > 0 for rowSpan
              } else {
                rowCells.push(valStr);
              }
            }

            tableData.push(rowCells);
          }

          // Per-group Subtotal Row insertion
          if (options.enableGroupSubtotals !== false) {
            const subtotalRow = columns.map((col, idx) => {
              const key = col.key;

              if (idx === 0) {
                return {
                  content: `Total for ${g.val}`,
                  styles: {
                    fontStyle: 'bold',
                    halign: alignment,
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42]
                  }
                };
              }

              if (isColumnNumeric(key)) {
                const sum = g.rows.reduce((acc, r) => {
                  const v = parseFloat(r[key]);
                  return acc + (isNaN(v) ? 0 : v);
                }, 0);
                const sumStr = Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
                return {
                  content: `Subtotal: ${sumStr}`,
                  styles: {
                    fontStyle: 'bold',
                    halign: alignment,
                    fillColor: [241, 245, 249],
                    textColor: [37, 99, 235]
                  }
                };
              }

              return {
                content: idx === 1 ? `${g.rows.length} item(s)` : '-',
                styles: {
                  fontStyle: 'bold',
                  halign: alignment,
                  fillColor: [241, 245, 249],
                  textColor: [100, 116, 139]
                }
              };
            });

            tableData.push(subtotalRow);
          }
        }
      } else {
        // Flat table structure when no grouping is selected
        for (let i = 0; i < N; i++) {
          const row = exportData[i];
          tableData.push(columns.map(col => {
            let val = getNormalizedRowValue(row, col.key) || row[col.key];
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

      const enableTotal = options.enableTotalSummary !== false;
      let footerRow: any[] = [];

      if (enableTotal) {
        footerRow = columns.map((col, idx) => {
          const key = col.key;
          const isNumeric = isColumnNumeric(key);

          if (idx === 0) {
            return {
              content: 'Overall Grand Total',
              styles: { fontStyle: 'bold', halign: alignment, fillColor: [241, 245, 249], textColor: [15, 23, 42] }
            };
          }

          if (isNumeric) {
            const mode = options.columnTotalModes?.[key] || (
              ['count', 'amount', 'score', 'total', 'fee', 'paid', 'due', 'student', 'enrolled'].some(k => key.toLowerCase().includes(k)) ? 'sum' : 'count'
            );

            if (mode === 'count') {
              const nonNullCount = exportData.filter(r => r[key] !== null && r[key] !== undefined && r[key] !== '' && r[key] !== '-').length;
              return {
                content: `Total: ${nonNullCount}`,
                styles: { fontStyle: 'bold', halign: alignment, fillColor: [241, 245, 249], textColor: [37, 99, 235] }
              };
            } else {
              const sum = exportData.reduce((acc, r) => {
                const val = parseFloat(r[key]);
                return acc + (isNaN(val) ? 0 : val);
              }, 0);
              const sumStr = Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
              return {
                content: `Overall Total: ${sumStr}`,
                styles: { fontStyle: 'bold', halign: alignment, fillColor: [241, 245, 249], textColor: [37, 99, 235] }
              };
            }
          }

          return {
            content: idx === 1 ? `${exportData.length} Total Record(s)` : '-',
            styles: { fontStyle: 'bold', halign: alignment, fillColor: [241, 245, 249], textColor: [100, 116, 139] }
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
