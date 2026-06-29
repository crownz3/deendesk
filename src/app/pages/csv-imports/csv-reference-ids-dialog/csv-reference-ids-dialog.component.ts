import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EntityRecord } from '../../../core/services/repository.service';

export interface CsvReferenceIdsDialogData {
  organizationId?: string;
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
}

@Component({
  selector: 'app-csv-reference-ids-dialog',
  templateUrl: './csv-reference-ids-dialog.component.html',
  styleUrls: ['./csv-reference-ids-dialog.component.scss'],
  standalone: false,
})
export class CsvReferenceIdsDialogComponent implements OnInit {
  madrasaMap = new Map<string, string>();
  courseMap = new Map<string, string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CsvReferenceIdsDialogData,
    private readonly clipboard: Clipboard,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    console.log('[CSV Reference Dialog Data Debug]', {
      organizationId: this.data?.organizationId,
      madrasasCount: this.data?.madrasas?.length || 0,
      coursesCount: this.data?.courses?.length || 0,
      classesCount: this.data?.classes?.length || 0,
    });

    this.madrasaMap = new Map(
      (this.data.madrasas || [])
        .filter(item => !!item.id)
        .map((item) => [item.id as string, String(item['name'] || item['title'] || item['displayName'] || item.id)])
    );

    this.courseMap = new Map(
      (this.data.courses || [])
        .filter(item => !!item.id)
        .map((item) => [item.id as string, String(item['name'] || item['title'] || item['courseName'] || item.id)])
    );
  }

  getMadrasaName(madrasaId: unknown): string {
    return this.madrasaMap.get(String(madrasaId || '')) || '-';
  }

  getCourseName(courseId: unknown): string {
    return this.courseMap.get(String(courseId || '')) || '-';
  }

  copy(value: string): void {
    if (!value) return;
    this.clipboard.copy(value);
    this.snackBar.open('ID copied', 'Close', { duration: 2000 });
  }
}
