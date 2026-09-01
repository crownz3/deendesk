import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { RepositoryService, EntityRecord } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface StudentRosterItem {
  sNo: number;
  name: string;
  stage: string;
  group: string;
  mobile: string;
  status?: string;
}

export interface MadrasaBatchMovement {
  id: string;
  madrasaId: string;
  madrasaName: string;
  usthadhName: string;
  monthYearDisplay: string;
  shiftDisplay: string;
  groupNameDisplay: string;
  lastMonthCount: number;
  currentMonthCount: number;
  newAdmissionCount: number;
  leftCount: number;
  promoteCount: number;
  demoteCount: number;
  transferCount: number;
  studentRoster: StudentRosterItem[];
  leftStudentRoster: StudentRosterItem[];
  promotedStudentRoster: StudentRosterItem[];
  demotedStudentRoster: StudentRosterItem[];
  transferredStudentRoster: StudentRosterItem[];
}

@Component({
  selector: 'app-madrasa-student-movement-report-dialog',
  templateUrl: './madrasa-student-movement-report-dialog.component.html',
  styleUrls: ['./madrasa-student-movement-report-dialog.component.scss'],
  standalone: false,
})
export class MadrasaStudentMovementReportDialogComponent implements OnInit {
  public loading = true;

  // Filters & Control Parameters
  public selectedMadrasaIds: string[] = [];
  public selectedShift = 'all';
  public selectedGroupId = 'all';
  public selectedMonth = 'September';
  public selectedYear = 2026;
  public compareMonth = 'August';
  public compareYear = 2026;
  public madrasaSearchQuery = '';

  public months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  public years = [2024, 2025, 2026, 2027];
  public shiftOptions = [
    { value: 'all', label: 'All Shifts' },
    { value: 'morning', label: 'Morning' },
    { value: 'evening', label: 'Evening' },
    { value: 'after-maghrib', label: 'After Maghrib' },
    { value: 'night', label: 'Night' }
  ];

  // Branding & Export Controls
  public includeBismillah = true;
  public includeOrgName = true;
  public showAppNameBranding = false;
  public organizationName = '';

  // Data Collections
  public madrasas: EntityRecord[] = [];
  public classGroups: EntityRecord[] = [];
  public classes: EntityRecord[] = [];
  public courses: EntityRecord[] = [];
  public staffMembers: EntityRecord[] = [];
  public students: EntityRecord[] = [];
  public users: EntityRecord[] = [];

  // Report Result Batches
  public batchReports: MadrasaBatchMovement[] = [];

  constructor(
    public dialogRef: MatDialogRef<MadrasaStudentMovementReportDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  get filteredMadrasas(): EntityRecord[] {
    const q = (this.madrasaSearchQuery || '').toLowerCase().trim();
    if (!q) return this.madrasas;
    return this.madrasas.filter(m => String(m['name'] || '').toLowerCase().includes(q));
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
      this.staffMembers = await this.repo.getAllOnce<EntityRecord>('staff', profile).catch(() => []);
      this.users = await this.repo.getAllOnce<EntityRecord>('users', profile).catch(() => []);
      this.students = await this.repo.getAllOnce<EntityRecord>('students', profile).catch(() => []);

      // Default: Initially select ONLY ONE Madrasa (the first madrasa)
      if (this.madrasas.length > 0) {
        this.selectedMadrasaIds = [String(this.madrasas[0].id)];
      } else {
        this.selectedMadrasaIds = ['all'];
      }

      this.generateReport();
    } catch (e) {
      console.error('Error loading madrasa student movement report data:', e);
    } finally {
      this.loading = false;
    }
  }

  private isStudentEnrolledByMonth(student: EntityRecord, monthIdx: number, year: number): boolean {
    const raw = student['admissionDate'] || student['joiningDate'] || student['createdAt'] || student['date'];
    if (!raw) return true;
    let dt: Date | null = null;
    if (raw?.seconds) dt = new Date(raw.seconds * 1000);
    else if (typeof raw === 'string' || typeof raw === 'number') dt = new Date(raw);
    if (!dt || isNaN(dt.getTime())) return true;

    const y = dt.getFullYear();
    const m = dt.getMonth();
    if (y > year) return false;
    if (y === year && m > monthIdx) return false;
    return true;
  }

  private didStudentLeaveByMonth(student: EntityRecord, monthIdx: number, year: number): boolean {
    const st = String(student['status'] || '').toLowerCase();
    const tag = String(student['movementStatus'] || student['movementTag'] || '').toLowerCase();
    const isLeft = st === 'inactive' || st === 'dropped' || st === 'left' || tag.includes('left') || tag.includes('drop');
    if (!isLeft) return false;

    const leftRaw = student['leftDate'] || student['dropoutDate'] || student['updatedAt'];
    if (!leftRaw) return true;
    let dt: Date | null = null;
    if (leftRaw?.seconds) dt = new Date(leftRaw.seconds * 1000);
    else if (typeof leftRaw === 'string' || typeof leftRaw === 'number') dt = new Date(leftRaw);
    if (!dt || isNaN(dt.getTime())) return true;

    const y = dt.getFullYear();
    const m = dt.getMonth();
    if (y < year) return true;
    if (y === year && m <= monthIdx) return true;
    return false;
  }

  public generateReport() {
    // 1. Determine Target Madrasas
    let targetMadrasas = this.madrasas;
    if (!this.selectedMadrasaIds.includes('all') && this.selectedMadrasaIds.length > 0) {
      targetMadrasas = this.madrasas.filter(m => this.selectedMadrasaIds.includes(String(m.id)));
    }

    if (targetMadrasas.length === 0 && this.madrasas.length > 0) {
      targetMadrasas = [this.madrasas[0]];
    }

    const teacherMap = new Map<string, string>();
    this.users.forEach(u => {
      const name = String(u['displayName'] || u['name'] || u['email'] || '').trim();
      if (u.id && name) teacherMap.set(String(u.id), name);
      if (u['uid'] && name) teacherMap.set(String(u['uid']), name);
    });
    this.staffMembers.forEach(s => {
      const name = String(s['displayName'] || s['name'] || s['email'] || '').trim();
      if (s.id && name) teacherMap.set(String(s.id), name);
      if (s['userId'] && name) teacherMap.set(String(s['userId']), name);
    });

    const classGroupMap = new Map<string, EntityRecord>();
    this.classGroups.forEach(g => { if (g.id) classGroupMap.set(String(g.id), g); });

    const classMap = new Map<string, EntityRecord>();
    this.classes.forEach(c => { if (c.id) classMap.set(String(c.id), c); });

    const courseMap = new Map<string, EntityRecord>();
    this.courses.forEach(crs => { if (crs.id) courseMap.set(String(crs.id), crs); });

    const selMonthIdx = Math.max(0, this.months.indexOf(this.selectedMonth));
    const cmpMonthIdx = Math.max(0, this.months.indexOf(this.compareMonth));

    this.batchReports = [];

    targetMadrasas.forEach(madrasa => {
      const mId = String(madrasa.id);
      const mName = String(madrasa['name'] || 'Madrasa').trim();

      // Find Class Groups for this Madrasa
      let mGroups = this.classGroups.filter(g => String(g['madrasaId']) === mId);
      if (mGroups.length === 0) {
        // Fallback to synthetic group for Madrasa
        mGroups = [{ id: `gen-${mId}`, name: 'General Section', madrasaId: mId }];
      }

      if (this.selectedGroupId !== 'all') {
        mGroups = mGroups.filter(g => String(g.id) === String(this.selectedGroupId));
      }

      mGroups.forEach(groupDoc => {
        const gId = String(groupDoc.id);
        const gName = String(groupDoc['name'] || 'Thilavath').trim();

        // Resolve Shift
        const rawShift = String(
          groupDoc['shiftName'] || groupDoc['shift'] || groupDoc['shiftId'] || 'Evening'
        ).trim();

        const normShift = rawShift.toLowerCase();
        if (this.selectedShift !== 'all') {
          if (!normShift.includes(this.selectedShift.toLowerCase())) return;
        }

        // Usthadh / Teacher Name
        const staffIds = [
          ...(groupDoc['assignedStaffIds'] || []),
          ...(groupDoc['assignedStaff'] || []),
          groupDoc['teacherId'],
          groupDoc['assignedTeacherId']
        ].filter(Boolean);

        const resolvedTeacherNames: string[] = [];
        staffIds.forEach(id => {
          const tName = teacherMap.get(String(id));
          if (tName) resolvedTeacherNames.push(tName);
        });

        const usthadhName = resolvedTeacherNames.length > 0
          ? Array.from(new Set(resolvedTeacherNames)).join(', ')
          : String(madrasa['inchargeName'] || madrasa['inchargeDisplay'] || 'Usthadh / Teacher Unassigned');

        // All Students belonging to this Madrasa & Class Group strictly
        const allGroupStudents = this.students.filter(s => {
          const sMadrasa = String(s['madrasaId'] || '');
          const sGroup = String(s['groupId'] || s['classGroupId'] || '');

          if (sMadrasa && sMadrasa !== mId) return false;

          if (gId.startsWith('gen-')) {
            return !sGroup || sGroup === gId;
          }
          return sGroup === gId;
        });

        // Enrolled Active Students for Selected Month
        const activeStudents = allGroupStudents.filter(s => {
          const isEnrolled = this.isStudentEnrolledByMonth(s, selMonthIdx, this.selectedYear);
          const isLeft = this.didStudentLeaveByMonth(s, selMonthIdx, this.selectedYear);
          return isEnrolled && !isLeft;
        });

        // Unique Active Student Roster
        const activeStudentNamesSet = new Set<string>();
        const studentRoster: StudentRosterItem[] = [];

        activeStudents.forEach(st => {
          const stName = String(st['name'] || st['displayName'] || st['studentName'] || 'Student').trim();
          const normName = stName.toLowerCase();
          if (activeStudentNamesSet.has(normName)) return;
          activeStudentNamesSet.add(normName);

          const stClass = classMap.get(String(st['classId']));
          const stCourse = courseMap.get(String(st['courseId']));
          const stageName = String(st['stage'] || st['stageLevel'] || stCourse?.['name'] || stClass?.['name'] || 'Mifthah').trim();
          const mobileNum = String(st['mobileNumber'] || st['mobile'] || st['phone'] || st['phoneNumber'] || st['guardianMobile'] || st['parentMobile'] || st['contactNumber'] || '-').trim();

          studentRoster.push({
            sNo: studentRoster.length + 1,
            name: stName,
            stage: stageName,
            group: gName,
            mobile: mobileNum,
            status: String(st['status'] || 'Active')
          });
        });

        // Active Enrolled Students for Compare Month
        const compareStudents = allGroupStudents.filter(s => {
          const isEnrolled = this.isStudentEnrolledByMonth(s, cmpMonthIdx, this.compareYear);
          const isLeft = this.didStudentLeaveByMonth(s, cmpMonthIdx, this.compareYear);
          return isEnrolled && !isLeft;
        });

        // Left Students Roster (Strictly exclude active students and deduplicate by name)
        const seenLeftNamesSet = new Set<string>();
        const leftStudentRoster: StudentRosterItem[] = [];

        allGroupStudents.forEach(st => {
          const stName = String(st['name'] || st['displayName'] || st['studentName'] || 'Student').trim();
          const normName = stName.toLowerCase();

          if (activeStudentNamesSet.has(normName)) return; // EXCLUDE ACTIVE
          if (seenLeftNamesSet.has(normName)) return; // DEDUPLICATE LEFT NAMES

          const isLeft = this.didStudentLeaveByMonth(st, selMonthIdx, this.selectedYear) ||
                         ['inactive', 'dropped', 'left'].includes(String(st['status'] || '').toLowerCase());

          if (isLeft) {
            seenLeftNamesSet.add(normName);
            const stClass = classMap.get(String(st['classId']));
            const stCourse = courseMap.get(String(st['courseId']));
            const stageName = String(st['stage'] || st['stageLevel'] || stCourse?.['name'] || stClass?.['name'] || 'Mifthah').trim();
            const mobileNum = String(st['mobileNumber'] || st['mobile'] || st['phone'] || st['phoneNumber'] || st['guardianMobile'] || st['parentMobile'] || st['contactNumber'] || '-').trim();

            leftStudentRoster.push({
              sNo: leftStudentRoster.length + 1,
              name: stName,
              stage: stageName,
              group: gName,
              mobile: mobileNum,
              status: 'Left'
            });
          }
        });

        // Promoted, Demoted, and Transferred Student Rosters
        const promotedStudentRoster: StudentRosterItem[] = [];
        const demotedStudentRoster: StudentRosterItem[] = [];
        const transferredStudentRoster: StudentRosterItem[] = [];

        allGroupStudents.forEach(st => {
          const stName = String(st['name'] || st['displayName'] || st['studentName'] || 'Student').trim();
          const tag = String(st['movementStatus'] || st['movementTag'] || st['movementType'] || st['status'] || '').toLowerCase();
          const stClass = classMap.get(String(st['classId']));
          const stCourse = courseMap.get(String(st['courseId']));
          const stageName = String(st['stage'] || st['stageLevel'] || stCourse?.['name'] || stClass?.['name'] || 'Mifthah').trim();
          const mobileNum = String(st['mobileNumber'] || st['mobile'] || st['phone'] || st['phoneNumber'] || st['guardianMobile'] || st['parentMobile'] || st['contactNumber'] || '-').trim();

          if (tag.includes('promote')) {
            promotedStudentRoster.push({
              sNo: promotedStudentRoster.length + 1,
              name: stName,
              stage: stageName,
              group: gName,
              mobile: mobileNum,
              status: 'Promoted'
            });
          }
          if (tag.includes('demote')) {
            demotedStudentRoster.push({
              sNo: demotedStudentRoster.length + 1,
              name: stName,
              stage: stageName,
              group: gName,
              mobile: mobileNum,
              status: 'Demoted'
            });
          }
          if (tag.includes('transfer')) {
            transferredStudentRoster.push({
              sNo: transferredStudentRoster.length + 1,
              name: stName,
              stage: stageName,
              group: gName,
              mobile: mobileNum,
              status: 'Transferred'
            });
          }
        });

        const currentCount = studentRoster.length;
        const lastMonthCount = compareStudents.length;
        const leftCount = leftStudentRoster.length;
        const promoteCount = promotedStudentRoster.length;
        const demoteCount = demotedStudentRoster.length;
        const transferCount = transferredStudentRoster.length;
        const newAdmissionCount = Math.max(0, currentCount - lastMonthCount + leftCount);

        this.batchReports.push({
          id: `${mId}-${gId}`,
          madrasaId: mId,
          madrasaName: mName,
          usthadhName,
          monthYearDisplay: `${this.selectedMonth} Month ${this.selectedYear}`,
          shiftDisplay: rawShift.charAt(0).toUpperCase() + rawShift.slice(1),
          groupNameDisplay: gName,
          lastMonthCount,
          currentMonthCount: currentCount,
          newAdmissionCount,
          leftCount,
          promoteCount,
          demoteCount,
          transferCount,
          studentRoster,
          leftStudentRoster,
          promotedStudentRoster,
          demotedStudentRoster,
          transferredStudentRoster
        });
      });
    });
  }

  public printReport() {
    const printableElement = document.querySelector('.printable-content');
    if (!printableElement) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Madrasa Student Movement & Roster Report</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box !important;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              margin: 0;
              padding: 0;
              color: #1e293b;
              background-color: #ffffff;
            }
            .report-main-header {
              text-align: center;
              margin-bottom: 16px;
            }
            .bismillah-header {
              text-align: center;
              font-size: 22px;
              font-weight: bold;
              margin-bottom: 4px;
              font-family: 'Amiri', 'Traditional Arabic', serif;
            }
            .org-name-header h2 {
              margin: 0;
              font-size: 17px;
              font-weight: 800;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .madrasa-report-card {
              background: #fff;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 14px;
              margin-bottom: 16px;
              page-break-inside: avoid;
              width: 100% !important;
              box-sizing: border-box !important;
            }
            .card-header-details {
              background-color: #f8fafc;
              padding: 8px 12px;
              border-radius: 4px;
              border: 1px solid #f1f5f9;
              margin-bottom: 12px;
            }
            .meta-info-table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-size: 12px !important;
            }
            .meta-info-table td.meta-cell {
              padding: 4px 6px !important;
              vertical-align: middle !important;
              border: none !important;
            }
            .meta-info-table td.meta-cell.wide {
              width: 50% !important;
            }
            .meta-label {
              font-weight: 700;
              color: #475569;
              margin-right: 4px;
              white-space: nowrap;
            }
            .meta-val {
              color: #0f172a;
            }
            .meta-val.inline-span {
              display: inline-block;
              margin-right: 20px;
            }
            .meta-val.text-bold {
              font-weight: 800;
              color: #1e3a8a;
            }
            .meta-val.text-accent {
              font-weight: 700;
              color: #0284c7;
            }
            .section-container {
              margin-bottom: 12px;
              width: 100%;
            }
            .section-title {
              margin: 0 0 6px 0;
              font-size: 13px;
              font-weight: 700;
              color: #1e293b;
            }
            .section-title.text-danger { color: #dc2626; }
            .section-title.text-success { color: #166534; }
            .section-title.text-warning { color: #d97706; }
            .section-title.text-info { color: #0284c7; }
            .table-responsive {
              width: 100% !important;
              overflow: visible !important;
            }
            .report-table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-size: 12px;
              table-layout: fixed !important;
              box-sizing: border-box !important;
            }
            .report-table th, .report-table td {
              padding: 5px 8px;
              text-align: left;
              border: 1px solid #cbd5e1;
              word-wrap: break-word;
              overflow-wrap: break-word;
              box-sizing: border-box !important;
            }
            .report-table th {
              background-color: #f1f5f9;
              color: #334155;
              font-weight: 700;
              font-size: 11px;
            }
            .metrics-table th, .metrics-table td {
              text-align: center;
              font-size: 12px;
              padding: 5px 3px;
            }
            .roster-table.left-table th {
              background-color: #fef2f2;
              color: #991b1b;
              border-color: #fecaca;
            }
            .roster-table.left-table td {
              border-color: #fecaca;
            }
            .status-chip {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 700;
            }
            .chip-active {
              background-color: #dcfce7;
              color: #166534;
            }
            .chip-left {
              background-color: #fee2e2;
              color: #dc2626;
            }
            .text-strike {
              text-decoration: line-through;
            }
            .text-danger {
              color: #dc2626;
            }
            .font-bold {
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          ${printableElement.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
