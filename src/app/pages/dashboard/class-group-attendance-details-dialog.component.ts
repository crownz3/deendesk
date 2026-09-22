import { Component, Inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

export interface StudentAttendanceDetailRecord {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'unmarked';
  note?: string;
  parentPhone?: string;
}

export interface ClassGroupAttendanceDetailsDialogData {
  groupName: string;
  madrasaName: string;
  className?: string;
  dateStr: string;
  takenByName?: string;
  takenAtText?: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  totalStudents: number;
  studentRecords: StudentAttendanceDetailRecord[];
  groupId: string;
  madrasaId?: string;
  classId?: string;
}

@Component({
  selector: 'app-class-group-attendance-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    IonicModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './class-group-attendance-details-dialog.component.html',
  styleUrls: ['./class-group-attendance-details-dialog.component.scss']
})
export class ClassGroupAttendanceDetailsDialogComponent {
  searchQuery = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ClassGroupAttendanceDetailsDialogData,
    private dialogRef: MatDialogRef<ClassGroupAttendanceDetailsDialogComponent>,
    private router: Router
  ) {}

  get filteredStudents(): StudentAttendanceDetailRecord[] {
    if (!this.data.studentRecords) return [];
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return this.data.studentRecords;
    }
    const q = this.searchQuery.trim().toLowerCase();
    return this.data.studentRecords.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q))
    );
  }

  formatStatusLabel(status: string): string {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'late': return 'Late';
      case 'leave': return 'Leave';
      default: return 'Unmarked';
    }
  }

  navigateToEdit(): void {
    this.dialogRef.close();
    this.router.navigate(['/classroom-suite'], {
      queryParams: {
        madrasaId: this.data.madrasaId || '',
        groupId: this.data.groupId || '',
        classId: this.data.classId || '',
        date: this.data.dateStr || ''
      }
    });
  }
}
