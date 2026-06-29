import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AttendanceHistoryDialogComponent } from '../../shared/components/attendance-history-dialog/attendance-history-dialog.component';

export interface AcademicTreeStudentsDialogData {
  nodeTitle: string;
  nodeType: string;
  students: any[];
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

    console.log('[Academic Tree Students Dialog Debug]', {
      nodeTitle: this.data?.nodeTitle,
      nodeType: this.data?.nodeType,
      totalStudents: this.data?.students?.length || 0,
      studentsWithAttendance: (this.data?.students || []).filter(student => this.hasAttendanceData(student)).length,
      averageAttendance: this.getAverageAttendance(),
    });
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

      return name.includes(q) || email.includes(q) || parentName.includes(q) || parentEmail.includes(q);
    });
  }

  hasAttendanceData(student: any): boolean {
    return student?.attendancePercentage !== undefined ||
      student?.attendancePercent !== undefined ||
      student?.attendanceRate !== undefined ||
      student?.attendanceSummary?.percentage !== undefined ||
      student?.attendanceSummary?.attendancePercentage !== undefined;
  }

  getStudentAttendancePercentage(student: any): number {
    const value =
      student?.attendancePercentage ??
      student?.attendancePercent ??
      student?.attendanceRate ??
      student?.attendanceSummary?.percentage ??
      student?.attendanceSummary?.attendancePercentage ??
      null;

    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
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

  viewStudyPlan(student: any): void {
    this.snackBar.open(`Study Plan for ${student.name || student.displayName || 'Student'} coming soon.`, 'Close', { duration: 3000 });
  }

  getAttendanceStatus(student: any): string {
    if (!this.hasAttendanceData(student)) return 'No Data';

    const percent = this.getStudentAttendancePercentage(student);
    if (typeof percent === 'string') return percent;
    if (percent >= 90) return 'Excellent';
    if (percent >= 75) return 'Good';
    if (percent >= 50) return 'Needs Attention';
    return 'Critical';
  }

  getAttendanceStatusClass(student: any): string {
    if (!this.hasAttendanceData(student)) return 'status-no-data';
    const percent = this.getStudentAttendancePercentage(student);
    if (percent >= 90) return 'status-excellent';
    if (percent >= 75) return 'status-good';
    if (percent >= 50) return 'status-needs-attention';
    return 'status-critical';
  }

  getAverageAttendance(): number | string {
    const studentsWithAttendance = (this.data?.students || []).filter(student => this.hasAttendanceData(student));

    if (!studentsWithAttendance.length) {
      return 'No Data';
    }

    const total = studentsWithAttendance.reduce((sum, student) => {
      return sum + this.getStudentAttendancePercentage(student);
    }, 0);

    return Math.round(total / studentsWithAttendance.length);
  }
}
