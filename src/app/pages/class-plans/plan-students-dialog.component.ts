import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ClassPlan } from '../../core/models/domain.model';
import { EntityRecord } from '../../core/services/repository.service';

export interface PlanStudentsDialogData {
  plan: ClassPlan;
  students: EntityRecord[];
  classes: EntityRecord[];
  classGroups: EntityRecord[];
  className: string;
  groupName: string;
}

@Component({
  selector: 'app-plan-students-dialog',
  templateUrl: './plan-students-dialog.component.html',
  styleUrls: ['./plan-students-dialog.component.scss'],
  standalone: false,
})
export class PlanStudentsDialogComponent implements OnInit {
  searchQuery = '';
  filteredStudents: EntityRecord[] = [];
  planStudents: EntityRecord[] = [];

  constructor(
    public dialogRef: MatDialogRef<PlanStudentsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PlanStudentsDialogData
  ) {}

  ngOnInit() {
    this.computePlanStudents();
    this.filterStudents();
  }

  computePlanStudents() {
    const plan = this.data.plan;
    const students = this.data.students || [];

    const targetClassIds = new Set<string>();
    if (plan.classId) targetClassIds.add(plan.classId);
    if (Array.isArray(plan.classIds)) {
      plan.classIds.forEach(id => targetClassIds.add(id));
    }

    const targetGroupIds = new Set<string>();
    if (plan.groupId) targetGroupIds.add(plan.groupId);
    if (Array.isArray(plan.groupIds)) {
      plan.groupIds.forEach(id => targetGroupIds.add(id));
    }

    this.planStudents = students.filter(student => {
      if (student['status'] === 'inactive') return false;

      // Match course
      if (plan.courseId && student['courseId'] && String(student['courseId']) !== String(plan.courseId)) {
        return false;
      }

      // Match class
      const studentClassId = String(student['classId'] || '');
      if (targetClassIds.size > 0 && !targetClassIds.has(studentClassId)) {
        return false;
      }

      // Match group/section
      const studentGroupId = String(student['groupId'] || '');
      if (targetGroupIds.size > 0 && studentGroupId && !targetGroupIds.has(studentGroupId)) {
        return false;
      }

      return true;
    });
  }

  filterStudents() {
    if (!this.searchQuery) {
      this.filteredStudents = this.planStudents;
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredStudents = this.planStudents.filter(s => {
      const name = String(s['displayName'] || s['name'] || '').toLowerCase();
      const code = String(s['studentId'] || s['rollNo'] || s['code'] || '').toLowerCase();
      const phone = String(s['parentPhone'] || s['phone'] || '').toLowerCase();
      return name.includes(q) || code.includes(q) || phone.includes(q);
    });
  }

  getClassName(classId: string): string {
    const cls = this.data.classes.find(c => c.id === classId);
    return String(cls?.['name'] || classId || 'General Class');
  }

  getGroupName(groupId: string): string {
    const group = this.data.classGroups.find(g => g.id === groupId);
    return String(group?.['name'] || groupId || '');
  }

  close() {
    this.dialogRef.close();
  }
}
