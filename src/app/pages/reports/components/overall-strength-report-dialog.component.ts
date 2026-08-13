import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { RepositoryService, EntityRecord } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';

export interface MatrixRowData {
  sNo: number;
  rowId: string;
  rowTitle: string;
  shiftCounts: { [shiftKey: string]: number };
  total: number;
}

export interface ShiftColumnHeader {
  key: string;
  id: string;
  name: string;
}

export type ReportGroupingBasis = 'course' | 'class' | 'classGroup' | 'madrasa';

@Component({
  selector: 'app-overall-strength-report-dialog',
  templateUrl: './overall-strength-report-dialog.component.html',
  styleUrls: ['./overall-strength-report-dialog.component.scss'],
  standalone: false,
})
export class OverallStrengthReportDialogComponent implements OnInit {
  public loading = true;

  // Report Controls & Filters
  public selectedMonth = 'January';
  public selectedYear = 2026;
  public selectedMadrasaId = 'all';
  public reportBasis: ReportGroupingBasis = 'course';
  public consolidateGroupNames = false;

  public months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  public years = [2024, 2025, 2026, 2027];

  // Advanced PDF Customization Controls
  public includeBismillah = true;
  public includeOrgName = true;
  public showAppNameBranding = false; // Option to remove Deendesk app branding
  public includeUnregisteredMatharasa = true;

  // Entity Lists
  public organizationName = '';
  public madrasas: EntityRecord[] = [];
  public courses: EntityRecord[] = [];
  public classes: EntityRecord[] = [];
  public classGroups: EntityRecord[] = [];
  public students: EntityRecord[] = [];
  public shifts: EntityRecord[] = [];

  // Dynamic Shift Headers & Matrix Data
  public shiftColumns: ShiftColumnHeader[] = [];
  public matrixRows: MatrixRowData[] = [];
  public shiftTotals: { [shiftKey: string]: number } = {};
  public grandTotal = 0;

  public unregisteredMatharasaList = [
    { title: 'STRENGTH UNREGISTERED MATHARASA LIST', subtitle: 'PULIYANKUDI 2' }
  ];

  constructor(
    public dialogRef: MatDialogRef<OverallStrengthReportDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  public async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      const orgs = await this.repo.getAllOnce<EntityRecord>('organizations', profile).catch(() => []);
      const currentOrg = orgs.find(o => String(o.id) === String(profile?.organizationId)) || orgs[0];
      this.organizationName = String(currentOrg?.['name'] || (profile as any)?.organizationName || 'AL BAQIYATH GROUP OF INSTITUTIONS AND RESEARCH ACADEMY');

      this.madrasas = await this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => []);
      this.courses = await this.repo.getAllOnce<EntityRecord>('courses', profile).catch(() => []);
      this.classes = await this.repo.getAllOnce<EntityRecord>('classes', profile).catch(() => []);
      this.classGroups = await this.repo.getAllOnce<EntityRecord>('classGroups', profile).catch(() => []);
      this.students = await this.repo.getAllOnce<EntityRecord>('students', profile).catch(() => []);
      const fetchedShifts = await this.repo.getAllOnce<EntityRecord>('shifts', profile).catch(() => []);

      if (fetchedShifts.length === 0) {
        const defaultNames = ['Morning', 'Evening', 'After Maghrib', 'Night'];
        this.shifts = defaultNames.map((name, idx) => ({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          code: name.toUpperCase().replace(/\s+/g, '_'),
          displayOrder: idx + 1
        }));
      } else {
        this.shifts = fetchedShifts.sort((a, b) => (Number(a['displayOrder'] || 0) - Number(b['displayOrder'] || 0)));
      }

      this.calculateMatrix();
    } catch (e) {
      console.error('Error loading overall strength data:', e);
    } finally {
      this.loading = false;
    }
  }

  public calculateMatrix() {
    // 1. Setup Shift Headers
    this.shiftColumns = this.shifts.map(s => ({
      key: String(s.id || s['name']),
      id: String(s.id || s['name']),
      name: String(s['name'] || 'Shift')
    }));

    // Add fallback for unassigned shift if needed
    const hasUnassignedShift = this.shiftColumns.some(c => c.key === 'unassigned');
    if (!hasUnassignedShift) {
      this.shiftColumns.push({ key: 'unassigned', id: 'unassigned', name: 'Other / General' });
    }

    // 2. Filter Active Students
    let activeStudents = this.students.filter(s => s['status'] !== 'inactive');
    if (this.selectedMadrasaId !== 'all') {
      activeStudents = activeStudents.filter(s => String(s['madrasaId']) === String(this.selectedMadrasaId));
    }

    // Maps
    const groupMap = new Map<string, EntityRecord>();
    this.classGroups.forEach(g => { if (g.id) groupMap.set(String(g.id), g); });

    const classMap = new Map<string, EntityRecord>();
    this.classes.forEach(c => { if (c.id) classMap.set(String(c.id), c); });

    const courseMap = new Map<string, EntityRecord>();
    this.courses.forEach(c => { if (c.id) courseMap.set(String(c.id), c); });

    const madrasaMap = new Map<string, EntityRecord>();
    this.madrasas.forEach(m => { if (m.id) madrasaMap.set(String(m.id), m); });

    // Helper to get normalized base name for consolidation
    const getBaseName = (rawName: string): string => {
      if (!rawName) return 'General';
      const trimmed = rawName.trim();
      if (!this.consolidateGroupNames) return trimmed;
      return trimmed
        .replace(/[\s\-_]+(?:[0-9]+|[a-z]|sec(?:tion)?\s*[0-9a-z]+)$/i, '')
        .replace(/[\s\-_]+[0-9]+$/i, '')
        .trim() || trimmed;
    };

    // 3. Determine Row Entity Entities based on reportBasis
    const matrixMap = new Map<string, MatrixRowData>();

    if (this.consolidateGroupNames) {
      let sourceList: { id: string; name: string }[] = [];
      if (this.reportBasis === 'course') {
        sourceList = this.courses.map(c => ({ id: String(c.id), name: String(c['name']) }));
      } else if (this.reportBasis === 'class') {
        sourceList = this.classes.map(c => ({ id: String(c.id), name: String(c['name']) }));
      } else if (this.reportBasis === 'classGroup') {
        sourceList = this.classGroups.map(g => ({ id: String(g.id), name: String(g['name']) }));
      } else if (this.reportBasis === 'madrasa') {
        sourceList = this.madrasas.map(m => ({ id: String(m.id), name: String(m['name']) }));
      }

      sourceList.forEach(item => {
        const baseTitle = getBaseName(item.name);
        const key = baseTitle.toLowerCase();
        if (!matrixMap.has(key)) {
          const shiftCounts: { [key: string]: number } = {};
          this.shiftColumns.forEach(col => shiftCounts[col.key] = 0);
          matrixMap.set(key, {
            sNo: matrixMap.size + 1,
            rowId: key,
            rowTitle: baseTitle,
            shiftCounts,
            total: 0
          });
        }
      });
    } else {
      let rowEntities: { id: string; title: string }[] = [];
      if (this.reportBasis === 'course') {
        rowEntities = this.courses.map(c => ({ id: String(c.id), title: String(c['name']) }));
        if (rowEntities.length === 0) {
          rowEntities = [{ id: 'default-course', title: 'General Academic Division' }];
        }
      } else if (this.reportBasis === 'class') {
        rowEntities = this.classes.map(c => ({ id: String(c.id), title: String(c['name']) }));
      } else if (this.reportBasis === 'classGroup') {
        rowEntities = this.classGroups.map(g => ({ id: String(g.id), title: String(g['name']) }));
      } else if (this.reportBasis === 'madrasa') {
        rowEntities = this.madrasas.map(m => ({ id: String(m.id), title: String(m['name']) }));
      }

      rowEntities.forEach((entity, idx) => {
        const shiftCounts: { [key: string]: number } = {};
        this.shiftColumns.forEach(col => shiftCounts[col.key] = 0);
        matrixMap.set(entity.id, {
          sNo: idx + 1,
          rowId: entity.id,
          rowTitle: entity.title,
          shiftCounts,
          total: 0
        });
      });
    }

    // 4. Count Students 1-to-1
    activeStudents.forEach(student => {
      const gId = String(student['groupId'] || student['classGroupId'] || '');
      const groupDoc = groupMap.get(gId);

      const clsId = String(student['classId'] || groupDoc?.['classId'] || '');
      const classDoc = classMap.get(clsId);

      const crsId = String(student['courseId'] || classDoc?.['courseId'] || groupDoc?.['courseId'] || '');
      const courseDoc = courseMap.get(crsId);

      const mId = String(student['madrasaId'] || classDoc?.['madrasaId'] || groupDoc?.['madrasaId'] || '');

      // Determine Row ID based on grouping basis
      let targetRowId = '';
      if (this.consolidateGroupNames) {
        let rawTitle = '';
        if (this.reportBasis === 'course') rawTitle = courseDoc ? String(courseDoc['name']) : crsId;
        else if (this.reportBasis === 'class') rawTitle = classDoc ? String(classDoc['name']) : clsId;
        else if (this.reportBasis === 'classGroup') rawTitle = groupDoc ? String(groupDoc['name']) : gId;
        else if (this.reportBasis === 'madrasa') rawTitle = madrasaMap.get(mId) ? String(madrasaMap.get(mId)!['name']) : mId;

        targetRowId = getBaseName(rawTitle).toLowerCase();
      } else {
        if (this.reportBasis === 'course') {
          targetRowId = crsId || (this.courses[0] ? String(this.courses[0].id) : 'default-course');
        } else if (this.reportBasis === 'class') {
          targetRowId = clsId;
        } else if (this.reportBasis === 'classGroup') {
          targetRowId = gId;
        } else if (this.reportBasis === 'madrasa') {
          targetRowId = mId;
        }
      }

      // Determine Shift Key
      let shiftKey = String(groupDoc?.['shiftId'] || groupDoc?.['shiftName'] || groupDoc?.['shift'] || '').trim();
      if (!shiftKey) {
        // Fallback string match if group shift is unset
        const gName = String(groupDoc?.['name'] || '').toLowerCase();
        if (gName.includes('morning')) shiftKey = 'morning';
        else if (gName.includes('evening')) shiftKey = 'evening';
        else if (gName.includes('maghrib')) shiftKey = 'after-maghrib';
        else if (gName.includes('night')) shiftKey = 'night';
        else shiftKey = 'unassigned';
      }

      // Normalize shiftKey to match shiftColumns
      const matchedCol = this.shiftColumns.find(col => 
        col.key.toLowerCase() === shiftKey.toLowerCase() || 
        col.name.toLowerCase() === shiftKey.toLowerCase() ||
        col.key.toLowerCase().includes(shiftKey.toLowerCase())
      );
      const colKey = matchedCol ? matchedCol.key : 'unassigned';

      // Increment row count
      let rowData = matrixMap.get(targetRowId);
      if (!rowData && targetRowId) {
        let title = '';
        if (this.consolidateGroupNames) {
          title = getBaseName(groupDoc ? String(groupDoc['name']) : targetRowId);
        } else {
          title = groupDoc ? String(groupDoc['name']) : targetRowId;
        }
        const shiftCounts: { [key: string]: number } = {};
        this.shiftColumns.forEach(col => shiftCounts[col.key] = 0);
        rowData = {
          sNo: matrixMap.size + 1,
          rowId: targetRowId,
          rowTitle: title,
          shiftCounts,
          total: 0
        };
        matrixMap.set(targetRowId, rowData);
      }

      if (rowData) {
        rowData.shiftCounts[colKey] = (rowData.shiftCounts[colKey] || 0) + 1;
        rowData.total += 1;
      }
    });

    // 5. Calculate Summary Totals
    this.matrixRows = Array.from(matrixMap.values()).filter(r => r.total > 0 || this.matrixRows.length < 10);
    
    // Re-index S.No
    this.matrixRows.forEach((r, i) => r.sNo = i + 1);

    this.shiftTotals = {};
    this.shiftColumns.forEach(col => this.shiftTotals[col.key] = 0);
    this.grandTotal = 0;

    this.matrixRows.forEach(row => {
      this.shiftColumns.forEach(col => {
        const cnt = row.shiftCounts[col.key] || 0;
        this.shiftTotals[col.key] = (this.shiftTotals[col.key] || 0) + cnt;
      });
      this.grandTotal += row.total;
    });
  }

  public printReport() {
    const reportElem = document.querySelector('.report-paper-container');
    if (!reportElem) {
      window.print();
      return;
    }

    // Create an isolated hidden print iframe for 100% reliable multi-page printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.organizationName} - Overall Strength Report</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Amiri:wght@400;700&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #000000; padding: 15px; }
            .report-paper-container { background: #ffffff; width: 100%; }
            .bismillah-header { text-align: center; font-size: 18px; font-weight: 600; font-family: 'Amiri', 'Traditional Arabic', serif; margin-bottom: 8px; }
            .institution-header-title { text-align: center; font-size: 18px; font-weight: 800; color: #000000; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .report-header-subtitle { text-align: center; font-size: 15px; font-weight: 700; color: #000000; margin: 0 0 16px 0; }
            .report-matrix-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000000; margin-bottom: 20px; }
            .report-matrix-table th, .report-matrix-table td { border: 1px solid #000000; padding: 6px 10px; font-size: 13px; color: #000000; }
            .report-matrix-table th { font-weight: 700; text-align: center; background-color: #f8fafc; }
            .report-matrix-table .col-sno { width: 45px; text-align: center; }
            .report-matrix-table .col-division { text-align: left; font-weight: 500; }
            .report-matrix-table .col-session { text-align: center; min-width: 80px; }
            .report-matrix-table .col-total { text-align: center; width: 80px; }
            .report-matrix-table .bold-cell { font-weight: 700; }
            .report-matrix-table .total-summary-row td { font-weight: 700; font-size: 14px; }
            .report-matrix-table .total-summary-row .total-label-cell { text-align: center; }
            .report-matrix-table .total-summary-row .grand-total-cell { font-size: 15px; }
            .unregistered-section-box { border: 1.5px solid #64748b; border-radius: 2px; page-break-inside: avoid; break-inside: avoid; }
            .unregistered-box-header { background: #f1f5f9; text-align: center; font-size: 14px; font-weight: 700; padding: 8px; border-bottom: 1px solid #64748b; color: #000000; }
            .unregistered-box-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
            .unregistered-row { border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .red-text { color: #dc2626; font-size: 13.5px; }
            .app-branding-footer { margin-top: 24px; text-align: center; font-size: 11px; color: #64748b; font-style: italic; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; break-inside: avoid; }
            @page { size: auto; margin: 12mm; }
          </style>
        </head>
        <body>
          ${reportElem.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  }

  public getBasisLabel(): string {
    if (this.reportBasis === 'course') return 'Course / Division';
    if (this.reportBasis === 'class') return 'Class';
    if (this.reportBasis === 'classGroup') return 'Class Group';
    if (this.reportBasis === 'madrasa') return 'Madrasa Branch';
    return 'Division';
  }
}
