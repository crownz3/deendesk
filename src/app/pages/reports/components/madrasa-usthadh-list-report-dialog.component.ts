import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { RepositoryService, EntityRecord } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface UsthadhReportItem {
  globalIndex: number;
  id: string;
  usthadhName: string;
  phone: string;
  groupsDisplay: string;
  gender: string;
  hasMissingGender: boolean;
  roleDisplay: string;
}

export interface MadrasaUsthadhGroup {
  madrasaId: string;
  madrasaName: string;
  usthadhs: UsthadhReportItem[];
  unassignedUsthadhs: UsthadhReportItem[];
}

@Component({
  selector: 'app-madrasa-usthadh-list-report-dialog',
  templateUrl: './madrasa-usthadh-list-report-dialog.component.html',
  styleUrls: ['./madrasa-usthadh-list-report-dialog.component.scss'],
  standalone: false
})
export class MadrasaUsthadhListReportDialogComponent implements OnInit {
  public loading = true;

  // Filter Models - Initially EMPTY so user must select Madrasa first
  public selectedMadrasaIds: string[] = [];
  public selectedGender = 'all';
  public madrasaSearchQuery = '';
  public showUnassignedSection = true; // Toggle for showing unassigned staff section

  // Options
  public includeBismillah = true;
  public includeOrgName = true;
  public showAppNameBranding = true;
  public organizationName = 'BISMILLAH INSTITUTION SYSTEM';

  // Data Collections
  public madrasas: EntityRecord[] = [];
  public staffMembers: EntityRecord[] = [];
  public classGroups: EntityRecord[] = [];

  // Grouped Result List
  public madrasaGroups: MadrasaUsthadhGroup[] = [];

  // Gender Filter Options
  public genderOptions = [
    { value: 'all', label: 'All Genders (Boys & Girls Madrasas)' },
    { value: 'male', label: 'Boys (Male Usthadhs)' },
    { value: 'female', label: 'Girls (Female Muallimas)' },
    { value: 'missing', label: '⚠️ Unassigned Gender Only' }
  ];

  constructor(
    public dialogRef: MatDialogRef<MadrasaUsthadhListReportDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  public async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const orgs = await this.repo.getAllOnce<EntityRecord>('organizations', profile).catch(() => []);
      const currentOrg = orgs.find(o => String(o.id) === String(profile?.organizationId)) || orgs[0];
      this.organizationName = String(currentOrg?.['name'] || (profile as any)?.organizationName || 'BISMILLAH INSTITUTION SYSTEM').toUpperCase();

      const [madrasasRes, staffRes, usersRes, classGroupsRes] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('madrasas', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('staff', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('users', profile).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('classGroups', profile).catch(() => [])
      ]);

      this.madrasas = madrasasRes || [];
      this.classGroups = classGroupsRes || [];

      // Deduplicated Map for Staff Members (EXCLUDING STUDENTS STRICTLY)
      const combinedStaffMap = new Map<string, EntityRecord>();

      // 1. Process staff collection records
      (staffRes || []).forEach(st => {
        const role = String(st['role'] || st['userRole'] || st['type'] || '').toLowerCase();
        if (role === 'student' || role.includes('student')) return; // EXCLUDE STUDENTS
        if (st.id) combinedStaffMap.set(String(st.id), st);
      });

      // 2. Process users collection records
      (usersRes || []).forEach(u => {
        const uId = String(u.id);
        const role = String(u['role'] || u['userRole'] || u['type'] || '').toLowerCase();
        
        // STRICTLY EXCLUDE STUDENTS
        if (role === 'student' || role.includes('student')) return;

        // ONLY INCLUDE TEACHING / STAFF / INCHARGE ROLES
        const isStaffRole = role.includes('usthadh') || role.includes('teacher') || role.includes('staff') ||
                            role.includes('incharge') || role.includes('head') || role.includes('admin') ||
                            role.includes('principal') || role.includes('muallim');

        if (isStaffRole) {
          if (!combinedStaffMap.has(uId)) {
            combinedStaffMap.set(uId, u);
          } else {
            const existing = combinedStaffMap.get(uId)!;
            combinedStaffMap.set(uId, { ...u, ...existing });
          }
        }
      });

      this.staffMembers = Array.from(combinedStaffMap.values());

      this.generateReport();
    } catch (err) {
      console.error('Error loading madrasa usthadh report data:', err);
    } finally {
      this.loading = false;
    }
  }

  get filteredMadrasas(): EntityRecord[] {
    if (!this.madrasaSearchQuery.trim()) return this.madrasas;
    const q = this.madrasaSearchQuery.toLowerCase();
    return this.madrasas.filter(m => String(m['name'] || '').toLowerCase().includes(q));
  }

  public generateReport() {
    this.madrasaGroups = [];
    if (this.selectedMadrasaIds.length === 0) {
      return;
    }

    let globalCounter = 1;

    // Filter Madrasas based on selection
    let activeMadrasas = [...this.madrasas];
    if (!this.selectedMadrasaIds.includes('all')) {
      activeMadrasas = activeMadrasas.filter(m => this.selectedMadrasaIds.includes(String(m.id)));
    }

    activeMadrasas.forEach(m => {
      const mId = String(m.id);
      const mName = String(m['name'] || m['madrasaName'] || 'Madrasa');

      // Filter staff belonging to this Madrasa or assigned to class groups in this Madrasa
      let mStaff = this.staffMembers.filter(st => {
        const stId = String(st.id);
        const stMadrasa = String(st['madrasaId'] || st['madarsaBranch'] || '');
        const role = String(st['role'] || st['userRole'] || '').toLowerCase();
        
        // Triple check: NO STUDENTS
        if (role === 'student' || role.includes('student')) return false;

        const isAssignedToClassGroup = this.classGroups.some(cg => {
          const cgMadrasa = String(cg['madrasaId'] || '');
          if (cgMadrasa && cgMadrasa !== mId) return false;
          const teacherId = String(cg['staffId'] || cg['teacherId'] || cg['usthadhId'] || '');
          const assignedIds = (cg['assignedStaffIds'] || cg['teacherIds'] || []) as string[];
          return teacherId === stId || assignedIds.includes(stId);
        });

        // Staff must either belong to this madrasa or be assigned to a class group in this madrasa
        if (stMadrasa && stMadrasa !== mId && !isAssignedToClassGroup) return false;
        if (!stMadrasa && !isAssignedToClassGroup) return false;

        const rawGender = String(st['gender'] || st['sex'] || '').trim();
        const hasMissingGender = !rawGender || ['unassigned', 'unknown', 'none', '-', 'null', 'undefined'].includes(rawGender.toLowerCase());

        // Gender Filter
        if (this.selectedGender === 'male') {
          if (hasMissingGender || !(rawGender.toLowerCase().includes('male') || rawGender.toLowerCase() === 'm')) return false;
        } else if (this.selectedGender === 'female') {
          if (hasMissingGender || !(rawGender.toLowerCase().includes('female') || rawGender.toLowerCase() === 'f')) return false;
        } else if (this.selectedGender === 'missing') {
          if (!hasMissingGender) return false;
        }

        return true;
      });

      if (mStaff.length === 0) return;

      const usthadhList: UsthadhReportItem[] = [];
      const unassignedUsthadhList: UsthadhReportItem[] = [];

      // Tracks names & phones placed in Table 1 to ensure zero duplication between lists
      const assignedPersonKeys = new Set<string>();
      const processedUnassignedKeys = new Set<string>();

      // FIRST PASS: Build Assigned Usthadhs (Table 1)
      mStaff.forEach(st => {
        const stId = String(st.id);
        const stName = String(st['name'] || st['fullName'] || st['displayName'] || st['usthadhName'] || 'Usthadh').trim();
        const stPhone = String(st['phone'] || st['phoneNumber'] || st['mobile'] || st['mobileNumber'] || st['contactNo'] || '-').trim();
        const normName = stName.toLowerCase().replace(/\s+/g, '');

        // Find assigned Class Groups for this Usthadh in this Madrasa
        const assignedGroups = this.classGroups.filter(cg => {
          const cgMadrasa = String(cg['madrasaId'] || '');
          if (cgMadrasa && cgMadrasa !== mId) return false;

          const teacherId = String(cg['staffId'] || cg['teacherId'] || cg['usthadhId'] || '');
          const assignedIds = (cg['assignedStaffIds'] || cg['teacherIds'] || []) as string[];

          return teacherId === stId || assignedIds.includes(stId);
        });

        if (assignedGroups.length > 0) {
          const groupsDisplay = assignedGroups.map(g => String(g['name'] || g['groupName'] || 'Group')).join(' / ');
          const rawGender = String(st['gender'] || st['sex'] || '').trim();
          const roleDisplay = String(st['role'] || st['userRole'] || 'Teacher').trim();
          const hasMissingGender = !rawGender || ['unassigned', 'unknown', 'none', '-', 'null', 'undefined'].includes(rawGender.toLowerCase());
          const displayGender = hasMissingGender ? 'Unassigned' : rawGender;

          usthadhList.push({
            globalIndex: globalCounter++,
            id: stId,
            usthadhName: stName,
            phone: stPhone,
            groupsDisplay,
            gender: displayGender,
            hasMissingGender,
            roleDisplay
          });

          assignedPersonKeys.add(normName);
          if (stPhone && stPhone !== '-') {
            assignedPersonKeys.add(stPhone.replace(/\D/g, ''));
          }
        }
      });

      // SECOND PASS: Build Unassigned Usthadhs (Table 2)
      // Strictly EXCLUDE any person already in assignedPersonKeys!
      mStaff.forEach(st => {
        const stId = String(st.id);
        const stName = String(st['name'] || st['fullName'] || st['displayName'] || st['usthadhName'] || 'Usthadh').trim();
        const stPhone = String(st['phone'] || st['phoneNumber'] || st['mobile'] || st['mobileNumber'] || st['contactNo'] || '-').trim();
        const normName = stName.toLowerCase().replace(/\s+/g, '');
        const normPhone = stPhone.replace(/\D/g, '');

        // IF THIS PERSON IS ALREADY IN ASSIGNED TABLE 1, DO NOT ADD TO TABLE 2!
        if (assignedPersonKeys.has(normName) || (normPhone && assignedPersonKeys.has(normPhone))) {
          return;
        }

        // Avoid adding duplicate unassigned entries for the same person
        if (processedUnassignedKeys.has(normName) || (normPhone && processedUnassignedKeys.has(normPhone))) {
          return;
        }

        const rawGender = String(st['gender'] || st['sex'] || '').trim();
        const roleDisplay = String(st['role'] || st['userRole'] || 'Teacher').trim();
        const hasMissingGender = !rawGender || ['unassigned', 'unknown', 'none', '-', 'null', 'undefined'].includes(rawGender.toLowerCase());
        const displayGender = hasMissingGender ? 'Unassigned' : rawGender;

        unassignedUsthadhList.push({
          globalIndex: globalCounter++,
          id: stId,
          usthadhName: stName,
          phone: stPhone,
          groupsDisplay: 'Unassigned',
          gender: displayGender,
          hasMissingGender,
          roleDisplay
        });

        processedUnassignedKeys.add(normName);
        if (normPhone) {
          processedUnassignedKeys.add(normPhone);
        }
      });

      if (usthadhList.length > 0 || unassignedUsthadhList.length > 0) {
        this.madrasaGroups.push({
          madrasaId: mId,
          madrasaName: mName,
          usthadhs: usthadhList,
          unassignedUsthadhs: unassignedUsthadhList
        });
      }
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
          <title>Madrasa-Wise Usthadh & Group Roster Report</title>
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
              color: #000000;
              background-color: #ffffff;
            }
            .report-main-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .bismillah-header {
              text-align: center;
              font-size: 22px;
              font-weight: bold;
              margin-bottom: 6px;
              font-family: 'Amiri', 'Traditional Arabic', serif;
            }
            .org-name-header h2 {
              margin: 0;
              font-size: 18px;
              font-weight: 800;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .usthadh-report-table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-size: 13px;
              table-layout: fixed !important;
              border: 2px solid #000000 !important;
            }
            .usthadh-report-table th, .usthadh-report-table td {
              padding: 8px 10px;
              text-align: left;
              border: 1px solid #000000 !important;
              word-wrap: break-word;
              overflow-wrap: break-word;
              vertical-align: middle;
            }
            .usthadh-report-table th {
              background-color: #ffffff;
              color: #000000;
              font-weight: 800;
              font-size: 13px;
              text-align: center;
              border-bottom: 2px solid #000000 !important;
            }
            .last-section-row td {
              border-bottom: 2px solid #000000 !important;
            }
            .missing-gender-row {
              background-color: #fffdf0 !important;
            }
            .missing-gender-chip {
              display: inline-block;
              margin-left: 6px;
              background-color: #fef3c7;
              color: #b45309;
              font-size: 10px;
              font-weight: bold;
              padding: 1px 5px;
              border-radius: 3px;
              border: 1px solid #fde68a;
            }
            .unassigned-section-header {
              margin: 16px 0 8px 0;
              font-size: 13px;
              font-weight: 800;
              color: #9a3412;
            }
            .col-sno { width: 7%; text-align: center !important; font-weight: 600; }
            .col-madrasa { width: 30%; font-weight: 700; color: #000000; text-align: center !important; }
            .col-usthadh { width: 33%; font-weight: 600; color: #000000; }
            .col-phone { width: 14%; text-align: center !important; font-weight: 600; }
            .col-group { width: 16%; font-weight: 500; color: #000000; text-align: center !important; }

            .card-footer-branding {
              text-align: right;
              font-size: 10px;
              color: #64748b;
              margin-top: 12px;
            }
          </style>
        </head>
        <body>
          ${printableElement.innerHTML}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  }
}
