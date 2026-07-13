import { Injectable } from '@angular/core';
import { CsvService } from './csv.service';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor(private csvService: CsvService) { }

  exportToCsv(filename: string, data: any[]) {
    if (!data || data.length === 0) return;
    const csvContent = this.csvService.toCsv(data);
    this.csvService.download(`${filename}.csv`, csvContent);
  }

  exportToExcel(filename: string, data: any[]) {
    if (!data || data.length === 0) return;
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }

  exportToPdf(filename: string, columns: string[], data: any[], title: string = '') {
    if (!data || data.length === 0) return;
    
    const doc = new jsPDF();
    
    if (title) {
        doc.setFontSize(18);
        doc.text(title, 14, 22);
    }
    
    const rows = data.map(item => columns.map(col => item[col] || ''));
    
    (doc as any).autoTable({
      head: [columns.map(c => this.camelCaseToTitle(c))],
      body: rows,
      startY: title ? 30 : 10,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    doc.save(`${filename}.pdf`);
  }

  private camelCaseToTitle(camelCase: string): string {
    const result = camelCase.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}
