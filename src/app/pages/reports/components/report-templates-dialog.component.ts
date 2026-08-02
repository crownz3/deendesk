import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SavedReportTemplate } from '../../../core/models/report.model';

export interface ReportTemplatesDialogData {
  activeReportId: string;
  savedReports: SavedReportTemplate[];
  reportGroups: { name: string; configs: any[] }[];
}

@Component({
  selector: 'app-report-templates-dialog',
  templateUrl: './report-templates-dialog.component.html',
  styleUrls: ['./report-templates-dialog.component.scss'],
  standalone: false,
})
export class ReportTemplatesDialogComponent {
  searchQuery = '';
  selectedCategory = 'all';

  constructor(
    public dialogRef: MatDialogRef<ReportTemplatesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportTemplatesDialogData
  ) {}

  get activeReportId(): string {
    return this.data.activeReportId || '';
  }

  get categories(): { id: string; label: string; count: number }[] {
    const list = [
      { id: 'all', label: 'All Templates', count: this.allTemplatesCount },
      { id: 'saved', label: 'Saved Reports', count: this.data.savedReports.length },
    ];

    for (const group of this.data.reportGroups) {
      list.push({
        id: group.name.toLowerCase().replace(/\s+/g, '-'),
        label: group.name,
        count: group.configs.length,
      });
    }

    return list.filter(c => c.count > 0 || c.id === 'all');
  }

  get allTemplatesCount(): number {
    let count = this.data.savedReports.length;
    for (const g of this.data.reportGroups) {
      count += g.configs.length;
    }
    return count;
  }

  get filteredSavedReports(): SavedReportTemplate[] {
    if (this.selectedCategory !== 'all' && this.selectedCategory !== 'saved') {
      return [];
    }
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.data.savedReports;
    return this.data.savedReports.filter(
      r => (r.name && r.name.toLowerCase().includes(q)) || (r.description && r.description.toLowerCase().includes(q))
    );
  }

  get filteredGroups(): { name: string; configs: any[] }[] {
    if (this.selectedCategory === 'saved') {
      return [];
    }

    const q = this.searchQuery.toLowerCase().trim();

    return this.data.reportGroups
      .map(group => {
        const catId = group.name.toLowerCase().replace(/\s+/g, '-');
        if (this.selectedCategory !== 'all' && this.selectedCategory !== catId) {
          return null;
        }

        const matchingConfigs = group.configs.filter(
          c =>
            !q ||
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.description && c.description.toLowerCase().includes(q)) ||
            (c.category && c.category.toLowerCase().includes(q))
        );

        if (matchingConfigs.length === 0) return null;
        return { name: group.name, configs: matchingConfigs };
      })
      .filter((g): g is { name: string; configs: any[] } => g !== null);
  }

  getCategoryIcon(category: string): string {
    const cat = (category || '').toLowerCase();
    if (cat.includes('student')) return 'school';
    if (cat.includes('staff') || cat.includes('teacher')) return 'badge';
    if (cat.includes('madrasa')) return 'account_balance';
    if (cat.includes('academic') || cat.includes('course') || cat.includes('class')) return 'menu_book';
    if (cat.includes('attendance')) return 'event_available';
    if (cat.includes('count')) return 'calculate';
    if (cat.includes('activity')) return 'insights';
    if (cat.includes('event')) return 'event';
    if (cat.includes('issue')) return 'report_problem';
    if (cat.includes('property') || cat.includes('asset')) return 'inventory_2';
    if (cat.includes('lifecycle')) return 'history_edu';
    return 'analytics';
  }

  selectTemplate(reportId?: string) {
    if (reportId) {
      this.dialogRef.close(reportId);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
