import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

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

  constructor(@Inject(MAT_DIALOG_DATA) public data: AcademicTreeStaffDialogData) {}

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
}
