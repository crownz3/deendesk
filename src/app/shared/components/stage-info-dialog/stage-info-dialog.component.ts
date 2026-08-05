import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord } from '../../../core/services/repository.service';

export interface StageInfoData {
  title?: string;
  courseName?: string;
  stageName?: string;
  subStageName?: string;
  description?: string;
  subStages?: { name: string; description?: string }[];
  groupInfo?: {
    name?: string;
    courseName?: string;
    stageName?: string;
    staffName?: string;
    schedule?: string;
    studentCount?: number;
    description?: string;
  };
}

@Component({
  selector: 'app-stage-info-dialog',
  templateUrl: './stage-info-dialog.component.html',
  styleUrls: ['./stage-info-dialog.component.scss'],
  standalone: false,
})
export class StageInfoDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StageInfoData,
    private dialogRef: MatDialogRef<StageInfoDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
