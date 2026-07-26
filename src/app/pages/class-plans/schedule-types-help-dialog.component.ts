import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-schedule-types-help-dialog',
  templateUrl: './schedule-types-help-dialog.component.html',
  styleUrls: ['./schedule-types-help-dialog.component.scss'],
  standalone: false,
})
export class ScheduleTypesHelpDialogComponent {
  constructor(public readonly dialogRef: MatDialogRef<ScheduleTypesHelpDialogComponent>) {}
}
