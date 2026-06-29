import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AttendanceHistoryDialogComponent } from '../../shared/components/attendance-history-dialog/attendance-history-dialog.component';

export interface AcademicTreeStaffDialogData {
  nodeTitle: string;
  nodeType: string;
  staff: any[];
}

@Component({
  selector: 'app-academic-tree-staff-dialog',
  templateUrl: './academic-tree-staff-dialog.component.html',
  styleUrls: ['./academic-tree-staff-dialog.component.scss'],
  standalone: false,
})
export class AcademicTreeStaffDialogComponent implements OnInit {
  searchQuery = '';
  filteredStaff: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AcademicTreeStaffDialogData,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.filteredStaff = this.data.staff || [];

    console.log('[Academic Tree Staff Dialog Debug]', {
      nodeTitle: this.data?.nodeTitle,
      nodeType: this.data?.nodeType,
      totalStaff: this.data?.staff?.length || 0,
      teachers: (this.data?.staff || []).filter(user => user?.role === 'teacher' || user?.role === 'TEACHER').length,
      staffUsers: (this.data?.staff || []).filter(user => user?.role === 'staff' || user?.role === 'STAFF').length,
    });
  }

  onSearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredStaff = this.data.staff || [];
      return;
    }

    this.filteredStaff = (this.data.staff || []).filter((s) => {
      const name = (s.name || s.displayName || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const role = (s.role || '').toLowerCase();
      const designation = (s.designation || s.jobTitle || '').toLowerCase();

      return name.includes(q) || email.includes(q) || role.includes(q) || designation.includes(q);
    });
  }

  viewAttendanceHistory(staff: any): void {
    this.dialog.open(AttendanceHistoryDialogComponent, {
      width: '500px',
      data: {
        title: `Attendance History for ${staff.name || staff.displayName || 'Staff'}`,
        studentId: String(staff.id) // using studentId as generic user id for this dialog
      }
    });
  }

  viewStudyPlan(staff: any): void {
    this.snackBar.open(`Study Plan for ${staff.name || staff.displayName || 'Staff'} coming soon.`, 'Close', { duration: 3000 });
  }
}
