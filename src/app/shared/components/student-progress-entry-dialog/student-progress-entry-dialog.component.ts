import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { ALL_QURAN_SURAHS } from '../../../core/constants/defaults';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface StudentProgressEntryDialogData {
  student: EntityRecord;
  currentUser: any;
}

@Component({
  selector: 'app-student-progress-entry-dialog',
  templateUrl: './student-progress-entry-dialog.component.html',
  styleUrls: ['./student-progress-entry-dialog.component.scss'],
  standalone: false,
})
export class StudentProgressEntryDialogComponent implements OnInit {
  student: EntityRecord;
  isSaving = false;

  activeTabIndex: number = 0;

  // Hifz Data
  juzArray: number[] = Array.from({ length: 30 }, (_, i) => i + 1);
  completedJuzs: Set<number> = new Set();
  allSurahs = ALL_QURAN_SURAHS;
  completedSurahs: Set<string> = new Set();
  surahSearch = '';
  filteredSurahs: string[] = [];

  // Dawr Data
  completedDawrRounds: number = 0;
  currentRoundJuz: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentProgressEntryDialogData,
    public dialogRef: MatDialogRef<StudentProgressEntryDialogComponent>,
    private repo: RepositoryService,
    private snackBar: MatSnackBar
  ) {
    this.student = data.student;
  }

  ngOnInit(): void {
    const prog = this.student['progress'];
    if (prog) {
      if (prog.hifz) {
        if (Array.isArray(prog.hifz.completedJuzs)) {
          prog.hifz.completedJuzs.forEach((j: number) => this.completedJuzs.add(j));
        }
        if (Array.isArray(prog.hifz.completedSurahs)) {
          prog.hifz.completedSurahs.forEach((s: string) => this.completedSurahs.add(s));
        }
      }
      if (prog.dawr) {
        this.completedDawrRounds = prog.dawr.completedRounds || 0;
        this.currentRoundJuz = prog.dawr.currentRoundJuz || null;
      }
    }
    this.filterSurahs();
  }

  toggleJuz(juz: number): void {
    if (this.completedJuzs.has(juz)) {
      this.completedJuzs.delete(juz);
    } else {
      this.completedJuzs.add(juz);
    }
  }

  toggleSurah(surah: string): void {
    if (this.completedSurahs.has(surah)) {
      this.completedSurahs.delete(surah);
    } else {
      this.completedSurahs.add(surah);
    }
  }

  filterSurahs(): void {
    const s = this.surahSearch.trim().toLowerCase();
    if (!s) {
      this.filteredSurahs = [...this.allSurahs];
    } else {
      this.filteredSurahs = this.allSurahs.filter(st => st.toLowerCase().includes(s));
    }
  }

  async saveProgress(): Promise<void> {
    this.isSaving = true;
    try {
      const progressUpdate = {
        hifz: {
          completedJuzs: Array.from(this.completedJuzs).sort((a, b) => a - b),
          completedSurahs: Array.from(this.completedSurahs)
        },
        dawr: {
          completedRounds: this.completedDawrRounds || 0,
          currentRoundJuz: this.currentRoundJuz || null
        },
        lastUpdated: new Date().toISOString()
      };

      await this.repo.update('users', this.student.id!, {
        progress: progressUpdate
      }, this.data.currentUser);

      this.snackBar.open('Student progress updated successfully!', 'Dismiss', { duration: 3000 });
      this.dialogRef.close(progressUpdate);
    } catch (error) {
      console.error('Failed to update progress', error);
      this.snackBar.open('Error saving progress.', 'Dismiss', { duration: 3000 });
    } finally {
      this.isSaving = false;
    }
  }
}
