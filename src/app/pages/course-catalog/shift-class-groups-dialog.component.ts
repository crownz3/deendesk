import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RepositoryService, EntityRecord } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface ShiftClassGroupsDialogData {
  shift: EntityRecord;
  allClassGroups: EntityRecord[];
}

interface ClassGroupRow {
  group: EntityRecord;
  selected: boolean;
  madrasaName?: string;
}

@Component({
  selector: 'app-shift-class-groups-dialog',
  templateUrl: './shift-class-groups-dialog.component.html',
  styleUrls: ['./shift-class-groups-dialog.component.scss'],
  standalone: false,
})
export class ShiftClassGroupsDialogComponent implements OnInit {
  public shift: EntityRecord;
  public rows: ClassGroupRow[] = [];
  public filteredRows: ClassGroupRow[] = [];
  public searchQuery = '';
  public saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ShiftClassGroupsDialogData,
    private dialogRef: MatDialogRef<ShiftClassGroupsDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.shift = data.shift;
  }

  ngOnInit(): void {
    const shiftId = String(this.shift.id || '');
    this.rows = (this.data.allClassGroups || []).map(group => ({
      group,
      selected: String(group['shiftId'] || '') === shiftId,
      madrasaName: group['madrasaName'] || group['madrasaCode'] || ''
    }));
    this.applyFilter();
  }

  public applyFilter(): void {
    const q = (this.searchQuery || '').toLowerCase().trim();
    if (!q) {
      this.filteredRows = [...this.rows];
      return;
    }
    this.filteredRows = this.rows.filter(r => {
      const name = String(r.group['name'] || r.group['id'] || '').toLowerCase();
      const madrasa = String(r.madrasaName || '').toLowerCase();
      const course = String(r.group['courseName'] || r.group['courseId'] || '').toLowerCase();
      return name.includes(q) || madrasa.includes(q) || course.includes(q);
    });
  }

  get selectedCount(): number {
    return this.rows.filter(r => r.selected).length;
  }

  get unassignedCount(): number {
    return this.rows.filter(r => !r.group['shiftId']).length;
  }

  isUnassigned(row: { group: EntityRecord }): boolean {
    return !row.group['shiftId'];
  }

  get allSelected(): boolean {
    return this.filteredRows.length > 0 && this.filteredRows.every(r => r.selected);
  }

  get someSelected(): boolean {
    return this.filteredRows.some(r => r.selected) && !this.allSelected;
  }

  public toggleAll(): void {
    const selectAll = !this.allSelected;
    this.filteredRows.forEach(r => (r.selected = selectAll));
  }

  public toggleRow(row: ClassGroupRow): void {
    row.selected = !row.selected;
  }

  public async saveAssignments(): Promise<void> {
    this.saving = true;
    const profile = await firstValueFrom(this.auth.profile$);
    const shiftId = String(this.shift.id || '');
    const shiftName = String(this.shift['name'] || '');

    try {
      const updates: Promise<void>[] = this.rows.map(row => {
        const currentShiftId = String(row.group['shiftId'] || '');
        if (row.selected && currentShiftId !== shiftId) {
          return this.repo.update('classGroups', String(row.group.id), { shiftId, shiftName }, profile);
        } else if (!row.selected && currentShiftId === shiftId) {
          return this.repo.update('classGroups', String(row.group.id), { shiftId: null as any, shiftName: null as any }, profile);
        }
        return Promise.resolve();
      });

      await Promise.all(updates);
      this.repo.clearCache('classGroups');
      this.snackBar.open(`${this.selectedCount} class group(s) linked to "${shiftName}" shift!`, 'Close', { duration: 3000 });
      this.dialogRef.close({ updated: true });
    } catch (err: any) {
      this.snackBar.open('Error saving assignments: ' + (err?.message || err), 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }

  public cancel(): void {
    this.dialogRef.close();
  }
}
