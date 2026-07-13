import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-help-guide-dialog',
  templateUrl: './help-guide-dialog.component.html',
  styleUrls: ['./help-guide-dialog.component.scss'],
  standalone: false,
})
export class HelpGuideDialogComponent {
  currentLang: 'en' | 'ta' = 'en';

  constructor(public dialogRef: MatDialogRef<HelpGuideDialogComponent>) {}

  setLanguage(lang: 'en' | 'ta'): void {
    this.currentLang = lang;
  }

  close(): void {
    this.dialogRef.close();
  }
}
