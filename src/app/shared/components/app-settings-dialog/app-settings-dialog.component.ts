import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { SidebarSettingsService, SidebarMode } from '../../../core/services/sidebar-settings.service';

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './app-settings-dialog.component.html',
  styleUrls: ['./app-settings-dialog.component.scss'],
  standalone: false
})
export class AppSettingsDialogComponent {
  selectedMode: SidebarMode;
  activeTab = 'general';

  constructor(
    public dialogRef: MatDialogRef<AppSettingsDialogComponent>,
    private sidebarSettings: SidebarSettingsService
  ) {
    this.selectedMode = this.sidebarSettings.currentMode;
  }

  saveSettings() {
    this.sidebarSettings.setSidebarMode(this.selectedMode);
    this.dialogRef.close();
  }

  close() {
    this.dialogRef.close();
  }
}
