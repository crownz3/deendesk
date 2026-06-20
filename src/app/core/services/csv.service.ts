import { Injectable } from '@angular/core';

export interface CsvValidationResult {
  validRows: Record<string, string>[];
  errors: string[];
  skippedRows: number;
}

@Injectable({ providedIn: 'root' })
export class CsvService {
  parse(csvText: string): Record<string, string>[] {
    const rows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (rows.length === 0) {
      return [];
    }

    const headers = this.splitLine(rows[0]).map((header) => header.trim());
    return rows.slice(1).map((line) => {
      const values = this.splitLine(line);
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = values[index]?.trim() ?? '';
        return row;
      }, {});
    });
  }

  validate(rows: Record<string, string>[], requiredFields: string[]): CsvValidationResult {
    const errors: string[] = [];
    const seen = new Set<string>();
    const validRows: Record<string, string>[] = [];
    let skippedRows = 0;

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const missing = requiredFields.filter((field) => !row[field]);
      const fingerprint = JSON.stringify(row).toLowerCase();

      if (missing.length > 0) {
        errors.push(`Row ${rowNumber}: Missing ${missing.join(', ')}`);
        return;
      }

      if (seen.has(fingerprint)) {
        skippedRows += 1;
        return;
      }

      seen.add(fingerprint);
      validRows.push(row);
    });

    return { validRows, errors, skippedRows };
  }

  toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return '';
    }

    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((header) => this.escape(String(row[header] ?? ''))).join(','));
    return [headers.join(','), ...body].join('\n');
  }

  download(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private splitLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let quoted = false;

    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  private escape(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
