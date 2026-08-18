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


}
