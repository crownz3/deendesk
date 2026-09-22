import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AttendanceHistoryDialogComponent } from '../../shared/components/attendance-history-dialog/attendance-history-dialog.component';
import { StudentProgressTrackerDialogComponent } from '../../shared/components/student-progress-tracker-dialog/student-progress-tracker-dialog.component';

export interface AcademicTreeStudentsDialogData {
  nodeTitle: string;
  nodeType: string;
  students: any[];
}

export interface GroupedStudentsSection {
  madrasaName: string;
  groups: {
    groupName: string;
    className?: string;
    studentCount: number;
    students: any[];
  }[];
  totalStudents: number;
}

@Component({
  selector: 'app-academic-tree-students-dialog',
  templateUrl: './academic-tree-students-dialog.component.html',
  styleUrls: ['./academic-tree-students-dialog.component.scss'],
  standalone: false,
})
export class AcademicTreeStudentsDialogComponent implements OnInit {
  searchQuery = '';
  filteredStudents: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AcademicTreeStudentsDialogData,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.filteredStudents = this.data.students || [];
  }

  get groupedStudentSections(): GroupedStudentsSection[] {
    const map = new Map<string, GroupedStudentsSection>();

    (this.filteredStudents || []).forEach(st => {
      let mName = String(st['madrasaName'] || st['madrasa'] || '').trim();
      if (!mName || mName === 'N/A' || mName === '-') {
        mName = 'General Madrasa';
      }

      let gName = String(st['groupName'] || st['sectionName'] || st['group'] || '').trim();
      if (!gName || gName === 'N/A' || gName === '-') {
        gName = 'General Class Group';
      }

      const cName = String(st['className'] || '').trim();

      const mKey = mName.toLowerCase();
      if (!map.has(mKey)) {
        map.set(mKey, {
          madrasaName: mName,
          groups: [],
          totalStudents: 0
        });
      }

      const mSec = map.get(mKey)!;
      mSec.totalStudents++;

      let grpObj = mSec.groups.find(g => g.groupName.toLowerCase() === gName.toLowerCase());
      if (!grpObj) {
        grpObj = {
          groupName: gName,
          className: (cName && cName !== 'N/A') ? cName : undefined,
          studentCount: 0,
          students: []
        };
        mSec.groups.push(grpObj);
      }

      grpObj.studentCount++;
      grpObj.students.push(st);
    });

    return Array.from(map.values());
  }

  get titleInfo(): { mainTitle: string; subTitle?: string } {
    const raw = this.data.nodeTitle || 'Assigned Students';
    const match = raw.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return {
        mainTitle: match[1].trim(),
        subTitle: match[2].trim()
      };
    }
    if (raw.includes(' — ')) {
      const parts = raw.split(' — ');
      return {
        mainTitle: parts[0].trim(),
        subTitle: parts[1].trim()
      };
    }
    return { mainTitle: raw };
  }

  getParentDisplay(student: any): { name: string; phone?: string } {
    const name = String(student.parentName || student.fatherName || student.guardianName || '').trim();
    let phone = String(
      (student.parentPhone && student.parentPhone !== 'N/A') ? student.parentPhone :
      (student.parentMobileNumber || student.fatherMobileNumber || student.fatherPhone || student.guardianPhone || student.parentMobile || '')
    ).trim();

    if (phone === 'N/A' || phone === '-') phone = '';

    return {
      name: (name && name !== 'N/A') ? name : 'N/A',
      phone: phone || undefined
    };
  }

  getStudentPhoneDisplay(student: any): string {
    let phone = String(
      (student.studentPhone && student.studentPhone !== 'N/A') ? student.studentPhone :
      (student.mobileNumber || student.phone || student.mobile || student.contactNumber || '')
    ).trim();

    if (!phone || phone === 'N/A' || phone === '-') return 'No phone';
    return phone;
  }

  getStudentStage(student: any): string {
    if (!student) return 'N/A';
    const val = student.stage || student.level || student.stageOrLevel || student.stageName || student.currentStage || student.stageDisplay || '';
    if (!val || val === 'N/A' || val === '-') return 'N/A';
    return String(val).trim();
  }

  onSearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredStudents = this.data.students || [];
      return;
    }

    this.filteredStudents = (this.data.students || []).filter((s) => {
      const name = (s.name || s.displayName || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const parentName = (s.fatherName || s.parentName || s.guardianName || '').toLowerCase();
      const parentEmail = (s.parentEmail || '').toLowerCase();
      const stage = this.getStudentStage(s).toLowerCase();

      return name.includes(q) || email.includes(q) || parentName.includes(q) || parentEmail.includes(q) || stage.includes(q);
    });
  }

  viewAttendanceHistory(student: any): void {
    this.dialog.open(AttendanceHistoryDialogComponent, {
      width: '500px',
      data: {
        title: `Attendance History for ${student.name || student.displayName || 'Student'}`,
        studentId: String(student.id)
      }
    });
  }

  openProgressTracker(student: any): void {
    this.dialog.open(StudentProgressTrackerDialogComponent, {
      data: { student },
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh',
      maxHeight: '90vh',
      panelClass: 'student-progress-tracker-dialog-panel'
    });
  }
}
