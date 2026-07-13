import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ClassTransferData {
  transferType: 'students' | 'staff';
  sourceClassRecord: EntityRecord;
}

@Component({
  selector: 'app-class-transfer-wizard-dialog',
  templateUrl: './class-transfer-wizard-dialog.component.html',
  styleUrls: ['./class-transfer-wizard-dialog.component.scss'],
  standalone: false,
})
export class ClassTransferWizardDialogComponent implements OnInit {
  loading = true;
  saving = false;

  classes: EntityRecord[] = [];
  groups: EntityRecord[] = [];
  records: EntityRecord[] = [];
  
  selectedClassId = '';
  selectedGroupId = '';
  transferMode: 'all' | 'selected' = 'all';
  
  selectedRecords = new Set<string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ClassTransferData,
    private dialogRef: MatDialogRef<ClassTransferWizardDialogComponent>,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      
      const allClasses = await this.repo.getAllOnce('classes', profile);
      this.classes = allClasses.filter(c => c.id !== this.data.sourceClassRecord.id && c['status'] === 'active');
      
      const allGroups = await this.repo.getAllOnce('classGroups', profile);
      this.groups = allGroups.filter(g => g['status'] === 'active');

      if (this.data.transferType === 'students') {
        const students = await this.repo.getAllOnce('students', profile);
        this.records = students.filter(s => s['classId'] === this.data.sourceClassRecord.id);
      } else {
        const staffData = await this.repo.getAllOnce('staff', profile);
        const staffById = new Map<string, EntityRecord>();
        staffData.forEach((staff) => {
          this.identityValues(staff).forEach((id) => staffById.set(id, staff));
        });

        const sourceGroups = this.groups.filter(g => g['classId'] === this.data.sourceClassRecord.id);
        const assignedStaffIds = this.uniqueStrings(
          sourceGroups.flatMap(group => Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'] : [])
        );

        this.records = assignedStaffIds.map((id) => {
          const staff = staffById.get(id);
          return {
            ...(staff || {}),
            id,
            assignmentId: id,
            name: staff?.['name'] || staff?.['displayName'] || staff?.['email'] || id,
          } as EntityRecord;
        });
      }
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to load data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  get availableGroups() {
    return this.groups.filter(g => g['classId'] === this.selectedClassId);
  }

  private uniqueStrings(values: unknown[]): string[] {
    return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
  }

  private identityValues(row: EntityRecord): string[] {
    return this.uniqueStrings([row.id, row['uid'], row['userId'], row['entityId'], row['email']]);
  }

  toggleRecord(id: string) {
    if (this.selectedRecords.has(id)) {
      this.selectedRecords.delete(id);
    } else {
      this.selectedRecords.add(id);
    }
  }

  async save() {
    if (!this.selectedClassId) {
      this.snackBar.open('Please select a target class', 'Close', { duration: 3000 });
      return;
    }

    let recordsToTransfer: EntityRecord[] = [];
    if (this.transferMode === 'all') {
      recordsToTransfer = this.records;
    } else {
      recordsToTransfer = this.records.filter(r => r.id && this.selectedRecords.has(r.id));
    }

    if (recordsToTransfer.length === 0) {
      this.snackBar.open('No records selected to transfer', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const targetClass = this.classes.find(c => c.id === this.selectedClassId);
      
      for (const record of recordsToTransfer) {
        if (!record.id) continue;

        if (this.data.transferType === 'students') {
          // Update student
          await this.repo.update('students', record.id, {
            classId: this.selectedClassId,
            courseId: targetClass?.['courseId'] || record['courseId'],
            groupId: this.selectedGroupId || null
          }, profile);

          // Add Promotion History
          await this.repo.create('promotionHistory', {
            studentId: record.id,
            organizationId: record['organizationId'],
            madrasaId: record['madrasaId'],
            previousCourseId: String(record['courseId'] ?? ''),
            previousClassId: this.data.sourceClassRecord.id,
            newCourseId: String(targetClass?.['courseId'] ?? ''),
            newClassId: this.selectedClassId,
            action: 'transfer',
            reason: 'Class Deactivation Transfer',
            actionDate: new Date().toISOString().slice(0, 10),
            status: 'active',
          }, profile);

        } else {
          const targetGroup = this.selectedGroupId
            ? this.groups.find(group => group.id === this.selectedGroupId)
            : this.availableGroups.find(group => group['isDefault']) || this.availableGroups[0];

          if (!targetGroup?.id) {
            throw new Error('Target class does not have a class group for staff assignment.');
          }

          const staffId = String(record['assignmentId'] || record.id || '');
          if (!staffId) continue;

          const sourceGroups = this.groups.filter(group => group['classId'] === this.data.sourceClassRecord.id);
          for (const group of sourceGroups) {
            if (!group.id) continue;
            const currentIds = Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'].map(String) : [];
            if (currentIds.includes(staffId)) {
              const nextIds = currentIds.filter(id => id !== staffId);
              await this.repo.update('classGroups', group.id, { assignedStaffIds: nextIds }, profile);
              group['assignedStaffIds'] = nextIds;
            }
          }

          const targetIds = Array.isArray(targetGroup['assignedStaffIds']) ? targetGroup['assignedStaffIds'].map(String) : [];
          if (!targetIds.includes(staffId)) {
            const nextTargetIds = [...targetIds, staffId];
            await this.repo.update('classGroups', targetGroup.id, { assignedStaffIds: nextTargetIds }, profile);
            targetGroup['assignedStaffIds'] = nextTargetIds;
          }
        }
      }
      
      this.snackBar.open(`Transferred ${recordsToTransfer.length} ${this.data.transferType} successfully.`, 'Close', { duration: 4000 });
      this.dialogRef.close(true);
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to transfer records', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}
