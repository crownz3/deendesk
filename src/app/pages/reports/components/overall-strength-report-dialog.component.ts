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

export type ReportGroupingBasis = 'departmentGender' | 'shiftGender' | 'shift' | 'course' | 'class' | 'classGroup' | 'madrasa';

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
  public reportBasis: ReportGroupingBasis = 'departmentGender';
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

  public unenteredShiftClassGroupCount = 0;
  public unenteredShiftStudentCount = 0;
  public splitShiftByGender = false;

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
      
      // Fetch students from primary 'students' collection (single source of truth matching Dashboard & Students page)
      const fetchedStudents = await this.repo.getAllOnce<EntityRecord>('students', profile).catch(() => []);
      this.students = fetchedStudents;

      console.log('📊 [Overall Strength Debug] Total registered students in collection:', fetchedStudents.length);

      const statusMap: Record<string, number> = {};
      this.students.forEach(s => {
        const st = String(s['status'] || 'undefined');
        statusMap[st] = (statusMap[st] || 0) + 1;
      });
      console.log('📊 [Overall Strength Debug] Student Status Distribution:', statusMap);

      const fetchedShifts = await this.repo.getAllOnce<EntityRecord>('shifts', profile).catch(() => []);

      const defaultNames = ['Morning', 'Evening', 'After Maghrib', 'Night'];
      if (fetchedShifts.length === 0) {
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
    // 1. Setup Base Shift Headers
    if (!this.shifts || this.shifts.length === 0) {
      const defaultNames = ['Morning', 'Evening', 'After Maghrib', 'Night'];
      this.shifts = defaultNames.map((name, idx) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        code: name.toUpperCase().replace(/\s+/g, '_'),
        displayOrder: idx + 1
      }));
    }

    if (this.splitShiftByGender) {
      const cols: ShiftColumnHeader[] = [];
      this.shifts.forEach(s => {
        const baseKey = String(s.id || s['name']).toLowerCase().replace(/\s+/g, '-');
        const baseName = String(s['name'] || 'Shift');
        cols.push({ key: `${baseKey}_boys`, id: `${baseKey}_boys`, name: `${baseName} (Boys)` });
        cols.push({ key: `${baseKey}_girls`, id: `${baseKey}_girls`, name: `${baseName} (Girls)` });
      });
      cols.push({ key: 'unassigned_boys', id: 'unassigned_boys', name: 'Shift Not Specified (Boys)' });
      cols.push({ key: 'unassigned_girls', id: 'unassigned_girls', name: 'Shift Not Specified (Girls)' });
      this.shiftColumns = cols;
    } else {
      this.shiftColumns = this.shifts.map(s => ({
        key: String(s.id || s['name']).toLowerCase().replace(/\s+/g, '-'),
        id: String(s.id || s['name']).toLowerCase().replace(/\s+/g, '-'),
        name: String(s['name'] || 'Shift')
      }));
    }

    // Build Shift ID and Name lookup Map
    const shiftMap = new Map<string, string>();
    this.shifts.forEach(s => {
      if (s.id) shiftMap.set(String(s.id).toLowerCase(), String(s['name'] || s['code'] || s.id).toLowerCase());
      if (s['name']) shiftMap.set(String(s['name']).toLowerCase(), String(s['name']).toLowerCase());
    });

    // 2. Filter Active Students
    let activeStudents = this.students.filter(s => s['status'] !== 'inactive' && s['status'] !== 'dropped');
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

    // Dynamic unregistered matharasa list computation
    const unregMadrasas = this.madrasas.filter(m => {
      const status = String(m['status'] || '').toLowerCase();
      const type = String(m['type'] || '').toLowerCase();
      const name = String(m['name'] || '').toLowerCase();
      const isRegistered = m['isRegistered'];
      return isRegistered === false || status === 'unregistered' || type === 'unregistered' || name.includes('unregistered');
    });

    if (unregMadrasas.length > 0) {
      this.unregisteredMatharasaList = unregMadrasas.map(m => ({
        title: String(m['name'] || 'STRENGTH UNREGISTERED MATHARASA LIST').toUpperCase(),
        subtitle: String(m['location'] || m['place'] || m['code'] || m['address'] || '').toUpperCase()
      }));
    } else {
      const studentUnregMap = new Map<string, string>();
      activeStudents.forEach(st => {
        const mName = String(st['madrasaName'] || st['madrasaNameDisplay'] || '').trim();
        if (mName.toLowerCase().includes('unregistered')) {
          studentUnregMap.set(mName.toUpperCase(), mName.toUpperCase());
        }
      });

      if (studentUnregMap.size > 0) {
        this.unregisteredMatharasaList = Array.from(studentUnregMap.values()).map(name => ({
          title: 'STRENGTH UNREGISTERED MATHARASA LIST',
          subtitle: name.replace(/STRENGTH UNREGISTERED MATHARASA LIST/i, '').replace(/^[\s\-_]+/, '') || name
        }));
      } else {
        this.unregisteredMatharasaList = [];
      }
    }

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

    const matrixMap = new Map<string, MatrixRowData>();

    const createBlankRow = (id: string, title: string, sNo: number): MatrixRowData => {
      const shiftCounts: { [key: string]: number } = {};
      this.shiftColumns.forEach(col => shiftCounts[col.key] = 0);
      shiftCounts['unassigned'] = 0;
      shiftCounts['unassigned_boys'] = 0;
      shiftCounts['unassigned_girls'] = 0;
      return {
        sNo,
        rowId: id,
        rowTitle: title,
        shiftCounts,
        total: 0
      };
    };

    if (this.reportBasis === 'departmentGender') {
      // Standard Department & Gender Split with Imam Shafi integration
      const predefinedRows = [
        { id: 'mifthah-boys', title: 'Mifthah (Boys)' },
        { id: 'thilavath-boys', title: 'Thilavath(Boys)' },
        { id: 'mifthah-girls', title: 'Mifthah (Girls)' },
        { id: 'thilavath-girls', title: 'Thilavath(Girls)' },
        { id: 'hifz-boys', title: 'Hifz (Boys)' },
        { id: 'hifz-girls', title: 'Hifz (Girls)' }
      ];

      predefinedRows.forEach((r, idx) => {
        matrixMap.set(r.id, createBlankRow(r.id, r.title, idx + 1));
      });
    } else if (this.reportBasis === 'shiftGender') {
      const predefinedRows = [
        { id: 'morning-boys', title: 'Morning Shift (Boys)' },
        { id: 'morning-girls', title: 'Morning Shift (Girls)' },
        { id: 'evening-boys', title: 'Evening Shift (Boys)' },
        { id: 'evening-girls', title: 'Evening Shift (Girls)' },
        { id: 'after-maghrib-boys', title: 'After Maghrib Shift (Boys)' },
        { id: 'after-maghrib-girls', title: 'After Maghrib Shift (Girls)' },
        { id: 'night-boys', title: 'Night Shift (Boys)' },
        { id: 'night-girls', title: 'Night Shift (Girls)' },
        { id: 'unassigned-boys', title: 'Shift Not Specified (Boys)' },
        { id: 'unassigned-girls', title: 'Shift Not Specified (Girls)' }
      ];

      predefinedRows.forEach((r, idx) => {
        matrixMap.set(r.id, createBlankRow(r.id, r.title, idx + 1));
      });
    } else if (this.reportBasis === 'shift') {
      const predefinedRows = [
        { id: 'morning', title: 'Morning Shift' },
        { id: 'evening', title: 'Evening Shift' },
        { id: 'after-maghrib', title: 'After Maghrib Shift' },
        { id: 'night', title: 'Night Shift' },
        { id: 'unassigned', title: 'Shift Not Specified' }
      ];

      predefinedRows.forEach((r, idx) => {
        matrixMap.set(r.id, createBlankRow(r.id, r.title, idx + 1));
      });
    } else if (this.consolidateGroupNames) {
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
          matrixMap.set(key, createBlankRow(key, baseTitle, matrixMap.size + 1));
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
        matrixMap.set(entity.id, createBlankRow(entity.id, entity.title, idx + 1));
      });
    }

    // Log Class Groups that have missing or unentered shifts
    const missingShiftGroups = this.classGroups.filter(g => !g['shiftId'] && !g['shiftName'] && !g['shift']);
    this.unenteredShiftClassGroupCount = missingShiftGroups.length;
    console.log(`⚠️ [Overall Strength Debug] Found ${missingShiftGroups.length} Class Groups with UNENTERED/MISSING shift:`, 
      missingShiftGroups.map(g => ({ id: g.id, name: g['name'], madrasaId: g['madrasaId'] }))
    );

    this.unenteredShiftStudentCount = 0;

    // 4. Count Students 1-to-1
    activeStudents.forEach(student => {
      const gId = String(student['groupId'] || student['classGroupId'] || '');
      const groupDoc = groupMap.get(gId);

      const clsId = String(student['classId'] || groupDoc?.['classId'] || '');
      const classDoc = classMap.get(clsId);

      const crsId = String(student['courseId'] || classDoc?.['courseId'] || groupDoc?.['courseId'] || '');
      const courseDoc = courseMap.get(crsId);

      const mId = String(student['madrasaId'] || classDoc?.['madrasaId'] || groupDoc?.['madrasaId'] || '');

      const rawShiftEntered = Boolean(
        groupDoc?.['shiftId'] || groupDoc?.['shiftName'] || groupDoc?.['shift'] ||
        courseDoc?.['shiftId'] || courseDoc?.['shiftName'] || courseDoc?.['shift'] ||
        classDoc?.['shiftId'] || classDoc?.['shiftName'] || classDoc?.['shift'] ||
        student['shiftId'] || student['shiftName'] || student['shift']
      );

      const combinedText = (
        String(student['stage'] || '') + ' ' +
        String(student['stageLevel'] || '') + ' ' +
        String(courseDoc?.['name'] || '') + ' ' +
        String(classDoc?.['name'] || '') + ' ' +
        String(groupDoc?.['name'] || '')
      ).toLowerCase();

      // Gender Resolution
      const directGender = String(student['gender'] || student['sex'] || groupDoc?.['genderScope'] || groupDoc?.['gender'] || courseDoc?.['gender'] || '').toLowerCase();
      const isGirl = (
        directGender === 'female' || directGender === 'girl' || directGender === 'girls' || directGender === 'g' ||
        combinedText.includes('girls') || combinedText.includes('female') || combinedText.includes('banat') || combinedText.includes('girls section')
      );

      // Resolve Shift without forcing auto-resolution to evening
      const sIdRaw = String(
        groupDoc?.['shiftId'] || groupDoc?.['shiftName'] || groupDoc?.['shift'] ||
        courseDoc?.['shiftId'] || courseDoc?.['shiftName'] || courseDoc?.['shift'] ||
        classDoc?.['shiftId'] || classDoc?.['shiftName'] || classDoc?.['shift'] ||
        student['shiftId'] || student['shiftName'] || student['shift'] || ''
      ).trim().toLowerCase();

      let resolvedShiftName = shiftMap.get(sIdRaw) || sIdRaw;

      if (!resolvedShiftName || resolvedShiftName === 'unassigned') {
        const textToSearch = (
          String(groupDoc?.['name'] || '') + ' ' +
          String(courseDoc?.['name'] || '') + ' ' +
          String(classDoc?.['name'] || '') + ' ' +
          String(student['timing'] || '')
        ).toLowerCase();

        if (textToSearch.includes('morning')) resolvedShiftName = 'morning';
        else if (textToSearch.includes('evening')) resolvedShiftName = 'evening';
        else if (textToSearch.includes('maghrib')) resolvedShiftName = 'after-maghrib';
        else if (textToSearch.includes('night')) resolvedShiftName = 'night';
        else resolvedShiftName = 'unassigned';
      }

      // Determine Target Row ID
      let targetRowId = '';

      if (this.reportBasis === 'departmentGender') {
        if (combinedText.includes('mifthah') || combinedText.includes('miftah')) {
          targetRowId = isGirl ? 'mifthah-girls' : 'mifthah-boys';
        } else if (combinedText.includes('thilavath') || combinedText.includes('thilawath') || combinedText.includes('tilawat')) {
          targetRowId = isGirl ? 'thilavath-girls' : 'thilavath-boys';
        } else if (combinedText.includes('hifz') || combinedText.includes('hifdh')) {
          targetRowId = isGirl ? 'hifz-girls' : 'hifz-boys';
        } else {
          targetRowId = isGirl ? 'thilavath-girls' : 'thilavath-boys';
        }
      } else if (this.reportBasis === 'shiftGender') {
        let cleanShift = resolvedShiftName.replace(/[-_\s]*(boys|girls)$/i, '').trim();
        if (!cleanShift || cleanShift === 'unassigned') cleanShift = 'unassigned';
        targetRowId = isGirl ? `${cleanShift}-girls` : `${cleanShift}-boys`;
      } else if (this.reportBasis === 'shift') {
        let cleanShift = resolvedShiftName.replace(/[-_\s]*(boys|girls)$/i, '').trim();
        if (!cleanShift || cleanShift === 'unassigned') cleanShift = 'unassigned';
        targetRowId = cleanShift;
      } else if (this.consolidateGroupNames) {
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

      // Match resolved shift name against shiftColumns
      let matchedCol = this.shiftColumns.find(col => 
        col.key === resolvedShiftName || 
        col.name.toLowerCase() === resolvedShiftName ||
        col.key.includes(resolvedShiftName) ||
        resolvedShiftName.includes(col.key)
      );

      if (!matchedCol && (resolvedShiftName.includes('maghrib') || resolvedShiftName.includes('after_maghrib'))) {
        matchedCol = this.shiftColumns.find(col => col.key.includes('maghrib') || col.name.toLowerCase().includes('maghrib'));
      }

      let baseColKey = matchedCol ? matchedCol.key : 'unassigned';
      let colKey = baseColKey;

      if (this.splitShiftByGender) {
        if (baseColKey === 'unassigned') {
          colKey = isGirl ? 'unassigned_girls' : 'unassigned_boys';
        } else {
          colKey = isGirl ? `${baseColKey}_girls` : `${baseColKey}_boys`;
        }
      }

      if (baseColKey === 'unassigned') {
        this.unenteredShiftStudentCount++;
      }

      let rowData = matrixMap.get(targetRowId);
      if (!rowData && targetRowId) {
        let title = targetRowId;
        if (this.consolidateGroupNames) {
          title = getBaseName(groupDoc ? String(groupDoc['name']) : targetRowId);
        } else {
          title = groupDoc ? String(groupDoc['name']) : targetRowId;
        }
        rowData = createBlankRow(targetRowId, title, matrixMap.size + 1);
        matrixMap.set(targetRowId, rowData);
      }

      if (rowData) {
        rowData.shiftCounts[colKey] = (rowData.shiftCounts[colKey] || 0) + 1;
        rowData.total += 1;
      }
    });

    if (this.splitShiftByGender) {
      this.shiftColumns = this.shiftColumns.filter(col => {
        let totalForCol = 0;
        matrixMap.forEach(row => { totalForCol += (row.shiftCounts[col.key] || 0); });
        return totalForCol > 0;
      });
    } else {
      let unassignedTotal = 0;
      matrixMap.forEach(row => { unassignedTotal += (row.shiftCounts['unassigned'] || 0); });
      if (unassignedTotal > 0 && !this.shiftColumns.some(c => c.key === 'unassigned')) {
        this.shiftColumns.push({ key: 'unassigned', id: 'unassigned', name: 'Shift Not Specified' });
      }
    }

    // Rows to display
    if (this.reportBasis === 'departmentGender' || this.reportBasis === 'shiftGender' || this.reportBasis === 'shift') {
      this.matrixRows = Array.from(matrixMap.values());
    } else {
      this.matrixRows = Array.from(matrixMap.values()).filter(r => r.total > 0 || this.matrixRows.length < 10);
    }
    
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

    console.log('📊 [Overall Strength Debug] Active Students counted in Matrix:', activeStudents.length);
    console.log('⚠️ [Overall Strength Debug] Active Students with NO explicit shift entered:', this.unenteredShiftStudentCount);
    console.log('📊 [Overall Strength Debug] Calculated Matrix Grand Total:', this.grandTotal);
    console.log('📊 [Overall Strength Debug] Matrix Rows:', this.matrixRows.map(r => ({ title: r.rowTitle, total: r.total, counts: r.shiftCounts })));
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
