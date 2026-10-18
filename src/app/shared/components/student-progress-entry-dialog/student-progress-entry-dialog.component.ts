import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { ALL_QURAN_SURAHS, ALL_QURAN_JUZ, QuranJuzItem } from '../../../core/constants/defaults';
import { MatSnackBar } from '@angular/material/snack-bar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getDeenDeskFirestore } from '../../../core/services/firebase-app';

export interface StudentProgressEntryDialogData {
  student: EntityRecord;
  currentUser: any;
  studentTypeMode?: string;
}

export interface EvaluationLogRecord {
  date: string;
  lessonType: string;
  rangeText: string;
  mistakes: number;
  remarks: string;
  evaluatedByName?: string;
}

export interface ItemDiagnostics {
  key: string;
  title: string;
  type: 'surah' | 'juz' | 'maktab';
  status: 'completed' | 'in_progress' | 'not_started';
  totalMistakes: number;
  lastDate?: string;
  evaluations: EvaluationLogRecord[];
  needsRevision: boolean;
  advisoryNote: string;
}

@Component({
  selector: 'app-student-progress-entry-dialog',
  templateUrl: './student-progress-entry-dialog.component.html',
  styleUrls: ['./student-progress-entry-dialog.component.scss'],
  standalone: false,
})
export class StudentProgressEntryDialogComponent implements OnInit {
  student: EntityRecord;
  studentTypeMode: string = 'hifz';
  isSaving = false;
  isLoadingHistory = false;

  activeTabIndex: number = 0;

  // Hifz & Dawr Data
  juzArray: number[] = Array.from({ length: 30 }, (_, i) => i + 1);
  allQuranJuzList: QuranJuzItem[] = ALL_QURAN_JUZ;
  allSurahs = ALL_QURAN_SURAHS;
  filteredSurahs: string[] = [];
  surahSearch = '';

  // Status tracking sets
  completedJuzs: Set<number> = new Set();
  inProgressJuzs: Set<number> = new Set();

  completedSurahs: Set<string> = new Set();
  inProgressSurahs: Set<string> = new Set();

  // Dawr Data
  completedDawrRounds: number = 0;
  currentRoundJuz: number | null = null;

  // Maktab Data
  maktabSubStages = [
    { id: 'miftah', title: 'Miftah (Curriculum Subjects)' },
    { id: 'tilawat', title: 'Tilawatul Quran (Quran Reading)' }
  ];
  activeMaktabSubStage: 'miftah' | 'tilawat' = 'miftah';
  qaidaTotalPages: number[] = Array.from({ length: 36 }, (_, i) => i + 1);
  completedMaktabPages: Set<number> = new Set();
  inProgressMaktabPage: number = 1;

  // Correlated Diagnostics and Evaluation History
  juzDiagnosticsMap = new Map<number, ItemDiagnostics>();
  surahDiagnosticsMap = new Map<string, ItemDiagnostics>();
  maktabDiagnosticsMap = new Map<number, ItemDiagnostics>();

  // Currently inspected item for side drawer / modal detail
  inspectedItem: ItemDiagnostics | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentProgressEntryDialogData,
    public dialogRef: MatDialogRef<StudentProgressEntryDialogComponent>,
    private repo: RepositoryService,
    private snackBar: MatSnackBar
  ) {
    this.student = data.student;
    this.studentTypeMode = data.studentTypeMode || 'hifz';
  }

  async ngOnInit(): Promise<void> {
    this.initExistingProgress();
    this.filterSurahs();
    await this.fetchStudentEvaluationHistory();
  }

  initExistingProgress(): void {
    const prog = this.student['progress'] || {};
    
    // Hifz
    if (prog.hifz) {
      if (Array.isArray(prog.hifz.completedJuzs)) {
        prog.hifz.completedJuzs.forEach((j: number) => this.completedJuzs.add(j));
      }
      if (Array.isArray(prog.hifz.inProgressJuzs)) {
        prog.hifz.inProgressJuzs.forEach((j: number) => this.inProgressJuzs.add(j));
      }
      if (Array.isArray(prog.hifz.completedSurahs)) {
        prog.hifz.completedSurahs.forEach((s: string) => this.completedSurahs.add(s));
      }
      if (Array.isArray(prog.hifz.inProgressSurahs)) {
        prog.hifz.inProgressSurahs.forEach((s: string) => this.inProgressSurahs.add(s));
      }
    }

    // Dawr
    if (prog.dawr) {
      this.completedDawrRounds = prog.dawr.completedRounds || 0;
      this.currentRoundJuz = prog.dawr.currentRoundJuz || null;
    }

    // Maktab
    if (prog.maktab) {
      if (Array.isArray(prog.maktab.miftahCompletedPages)) {
        prog.maktab.miftahCompletedPages.forEach((p: number) => this.completedMaktabPages.add(p));
      }
      this.inProgressMaktabPage = prog.maktab.miftahCurrentPage || 1;
      if (Array.isArray(prog.maktab.tilawatCompletedSurahs)) {
        prog.maktab.tilawatCompletedSurahs.forEach((s: string) => this.completedSurahs.add(s));
      }
    }

    // Set default active tab based on studentTypeMode
    if (this.studentTypeMode === 'maktab') {
      this.activeTabIndex = 2; // Maktab tab
    } else if (this.studentTypeMode === 'dawr') {
      this.activeTabIndex = 1; // Dawr tab
    } else {
      this.activeTabIndex = 0; // Hifz tab
    }
  }

  async fetchStudentEvaluationHistory(): Promise<void> {
    const stId = this.student?.id || this.student?.['id'] || this.student?.['studentId'];
    if (!stId) return;

    this.isLoadingHistory = true;
    try {
      const firestore = getDeenDeskFirestore();
      const q = query(
        collection(firestore, 'studentDailyProgress'),
        where('studentId', '==', stId)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const sortedDocs = snap.docs
          .map(d => d.data())
          .filter(d => !d['isDeleted'])
          .sort((a, b) => String(b['date'] || '').localeCompare(String(a['date'] || '')));

        this.processEvaluationHistory(sortedDocs);
      }
    } catch (err) {
      console.warn('Could not load detailed student daily evaluation history:', err);
    } finally {
      this.isLoadingHistory = false;
    }
  }

  processEvaluationHistory(docs: any[]): void {
    docs.forEach(doc => {
      const date = doc.date || '';
      const teacher = doc.evaluatedByName || doc.recordedByName || '';

      // 1. Process Hifz Sabaq
      const sabaqSurah = doc.hifzProgress?.sabaqSurahName || doc.sabaqSurah || '';
      const sabaqFromA = doc.hifzProgress?.sabaqFromAyah || doc.sabaqAyahFrom || 1;
      const sabaqToA = doc.hifzProgress?.sabaqToAyah || doc.sabaqAyahTo || 1;
      const sabaqMist = parseInt(String(doc.hifzProgress?.sabaqMistakes || doc.sabaqMistakes || 0), 10) || 0;
      const sabaqJuz = doc.hifzProgress?.sabaqJuzNo || doc.sabaqJuz;

      if (sabaqSurah) {
        this.recordSurahEvaluation(sabaqSurah, {
          date,
          lessonType: 'New Lesson (Sabaq)',
          rangeText: `Ayah ${sabaqFromA} – ${sabaqToA}`,
          mistakes: sabaqMist,
          remarks: doc.remarks || '',
          evaluatedByName: teacher
        });
      }

      if (sabaqJuz) {
        const juzNum = parseInt(String(sabaqJuz), 10);
        if (juzNum >= 1 && juzNum <= 30) {
          this.recordJuzEvaluation(juzNum, {
            date,
            lessonType: 'New Lesson (Sabaq)',
            rangeText: `Pg ${doc.hifzProgress?.sabaqStartPage || 1} – ${doc.hifzProgress?.sabaqEndPage || 2}`,
            mistakes: sabaqMist,
            remarks: doc.remarks || '',
            evaluatedByName: teacher
          });
        }
      }

      // 2. Process Old Lesson (Sabqi)
      const sabqiSurah = doc.sabqiSurah || doc.hifzProgress?.sabqiRange;
      const sabqiMist = parseInt(String(doc.sabqiMistakes || doc.hifzProgress?.sabqiMistakes || 0), 10) || 0;
      if (sabqiSurah && typeof sabqiSurah === 'string' && !sabqiSurah.startsWith('Juz')) {
        this.recordSurahEvaluation(sabqiSurah, {
          date,
          lessonType: 'Old Lesson (Sabqi)',
          rangeText: `Ayah ${doc.sabqiAyahFrom || 1} – ${doc.sabqiAyahTo || 10}`,
          mistakes: sabqiMist,
          remarks: doc.remarks || '',
          evaluatedByName: teacher
        });
      }

      // 3. Process Revision (Manzil / Dawr)
      const manzilJuz = doc.manzilStartJuz || doc.dawrProgress?.startJuz || doc.manzilJuz;
      const manzilMist = parseInt(String(doc.manzilMistakes || doc.dawrMistakes || 0), 10) || 0;
      if (manzilJuz) {
        const jNum = parseInt(String(manzilJuz).replace(/\D/g, ''), 10);
        if (jNum >= 1 && jNum <= 30) {
          this.recordJuzEvaluation(jNum, {
            date,
            lessonType: 'Revision (Manzil/Dawr)',
            rangeText: doc.manzilRange || doc.dawrPortionJuz || `Juz ${jNum}`,
            mistakes: manzilMist,
            remarks: doc.remarks || '',
            evaluatedByName: teacher
          });
        }
      }

      // 4. Process Maktab
      const mProg = doc.maktabProgress;
      if (mProg) {
        if (mProg.stage === 'Tilawatul Quran' && mProg.surahName) {
          this.recordSurahEvaluation(mProg.surahName, {
            date,
            lessonType: 'Tilawatul Quran Reading',
            rangeText: `Ayah ${mProg.fromAyah || 1} – ${mProg.toAyah || 10}`,
            mistakes: doc.overallMistakes || 0,
            remarks: doc.remarks || '',
            evaluatedByName: teacher
          });
        }

        const pg = parseInt(String(doc.maktabPageNo || mProg.startPage || 1), 10);
        if (pg) {
          this.recordMaktabEvaluation(pg, {
            date,
            lessonType: 'Miftah Curriculum',
            rangeText: `${doc.maktabSubject || 'Qaida'} (Page ${pg})`,
            mistakes: doc.overallMistakes || 0,
            remarks: doc.remarks || '',
            evaluatedByName: teacher
          });
        }
      }
    });

    // Auto-correlate in-progress items:
    // If an item has evaluations and is not in completed set, auto-highlight as in-progress!
    this.surahDiagnosticsMap.forEach((diag, surah) => {
      if (!this.completedSurahs.has(surah) && diag.evaluations.length > 0) {
        this.inProgressSurahs.add(surah);
      }
    });

    this.juzDiagnosticsMap.forEach((diag, juz) => {
      if (!this.completedJuzs.has(juz) && diag.evaluations.length > 0) {
        this.inProgressJuzs.add(juz);
      }
    });
  }

  recordSurahEvaluation(surahName: string, log: EvaluationLogRecord): void {
    // Normalize surah name
    const match = this.allSurahs.find(s => s.toLowerCase() === surahName.toLowerCase() || s.toLowerCase().includes(surahName.toLowerCase()));
    const normalized = match || surahName;

    let diag = this.surahDiagnosticsMap.get(normalized);
    if (!diag) {
      diag = {
        key: 'surah_' + normalized,
        title: normalized,
        type: 'surah',
        status: this.completedSurahs.has(normalized) ? 'completed' : (this.inProgressSurahs.has(normalized) ? 'in_progress' : 'not_started'),
        totalMistakes: 0,
        evaluations: [],
        needsRevision: false,
        advisoryNote: ''
      };
      this.surahDiagnosticsMap.set(normalized, diag);
    }

    diag.evaluations.push(log);
    diag.totalMistakes += log.mistakes;
    if (!diag.lastDate || log.date > diag.lastDate) {
      diag.lastDate = log.date;
    }

    if (diag.totalMistakes > 0) {
      diag.needsRevision = true;
      diag.advisoryNote = `⚠️ Weak area: ${diag.totalMistakes} mistake(s) logged on recitation. Recommend re-memorization & recitation review.`;
    } else {
      diag.advisoryNote = `✨ Strong performance: Memorized with 0 mistakes logged.`;
    }
  }

  recordJuzEvaluation(juzNumber: number, log: EvaluationLogRecord): void {
    let diag = this.juzDiagnosticsMap.get(juzNumber);
    if (!diag) {
      const jItem = this.allQuranJuzList.find(j => j.number === juzNumber);
      diag = {
        key: 'juz_' + juzNumber,
        title: jItem ? jItem.displayName : `Juz ${juzNumber}`,
        type: 'juz',
        status: this.completedJuzs.has(juzNumber) ? 'completed' : (this.inProgressJuzs.has(juzNumber) ? 'in_progress' : 'not_started'),
        totalMistakes: 0,
        evaluations: [],
        needsRevision: false,
        advisoryNote: ''
      };
      this.juzDiagnosticsMap.set(juzNumber, diag);
    }

    diag.evaluations.push(log);
    diag.totalMistakes += log.mistakes;
    if (!diag.lastDate || log.date > diag.lastDate) {
      diag.lastDate = log.date;
    }

    if (diag.totalMistakes > 0) {
      diag.needsRevision = true;
      diag.advisoryNote = `⚠️ Needs revision: ${diag.totalMistakes} mistake(s) recorded in this Juz. Recommend reciting again with teacher guidance.`;
    } else {
      diag.advisoryNote = `✨ Mastered: Recited with high accuracy and 0 mistakes.`;
    }
  }

  recordMaktabEvaluation(pageNumber: number, log: EvaluationLogRecord): void {
    let diag = this.maktabDiagnosticsMap.get(pageNumber);
    if (!diag) {
      diag = {
        key: 'maktab_pg_' + pageNumber,
        title: `Page ${pageNumber}`,
        type: 'maktab',
        status: this.completedMaktabPages.has(pageNumber) ? 'completed' : (pageNumber === this.inProgressMaktabPage ? 'in_progress' : 'not_started'),
        totalMistakes: 0,
        evaluations: [],
        needsRevision: false,
        advisoryNote: ''
      };
      this.maktabDiagnosticsMap.set(pageNumber, diag);
    }

    diag.evaluations.push(log);
    diag.totalMistakes += log.mistakes;
    if (!diag.lastDate || log.date > diag.lastDate) {
      diag.lastDate = log.date;
    }

    if (diag.totalMistakes > 0) {
      diag.needsRevision = true;
      diag.advisoryNote = `⚠️ Weak pronunciation on this page: ${diag.totalMistakes} mistake(s). Practice reading letters and words again.`;
    }
  }

  // Inspect Juz
  inspectJuz(juz: number): void {
    let diag = this.juzDiagnosticsMap.get(juz);
    if (!diag) {
      const jItem = this.allQuranJuzList.find(j => j.number === juz);
      diag = {
        key: 'juz_' + juz,
        title: jItem ? jItem.displayName : `Juz ${juz}`,
        type: 'juz',
        status: this.completedJuzs.has(juz) ? 'completed' : (this.inProgressJuzs.has(juz) ? 'in_progress' : 'not_started'),
        totalMistakes: 0,
        evaluations: [],
        needsRevision: false,
        advisoryNote: 'No evaluation logs recorded yet for this Juz.'
      };
      this.juzDiagnosticsMap.set(juz, diag);
    }
    // Sync current status
    diag.status = this.completedJuzs.has(juz) ? 'completed' : (this.inProgressJuzs.has(juz) ? 'in_progress' : 'not_started');
    this.inspectedItem = diag;
  }

  // Inspect Surah
  inspectSurah(surah: string): void {
    let diag = this.surahDiagnosticsMap.get(surah);
    if (!diag) {
      diag = {
        key: 'surah_' + surah,
        title: surah,
        type: 'surah',
        status: this.completedSurahs.has(surah) ? 'completed' : (this.inProgressSurahs.has(surah) ? 'in_progress' : 'not_started'),
        totalMistakes: 0,
        evaluations: [],
        needsRevision: false,
        advisoryNote: 'No evaluation logs recorded yet for this Surah.'
      };
      this.surahDiagnosticsMap.set(surah, diag);
    }
    diag.status = this.completedSurahs.has(surah) ? 'completed' : (this.inProgressSurahs.has(surah) ? 'in_progress' : 'not_started');
    this.inspectedItem = diag;
  }

  // Inspect Maktab Page
  inspectMaktabPage(page: number): void {
    let diag = this.maktabDiagnosticsMap.get(page);
    if (!diag) {
      diag = {
        key: 'maktab_pg_' + page,
        title: `Page ${page}`,
        type: 'maktab',
        status: this.completedMaktabPages.has(page) ? 'completed' : (page === this.inProgressMaktabPage ? 'in_progress' : 'not_started'),
        totalMistakes: 0,
        evaluations: [],
        needsRevision: false,
        advisoryNote: 'No evaluations recorded for this page yet.'
      };
      this.maktabDiagnosticsMap.set(page, diag);
    }
    diag.status = this.completedMaktabPages.has(page) ? 'completed' : (page === this.inProgressMaktabPage ? 'in_progress' : 'not_started');
    this.inspectedItem = diag;
  }

  // Interactive Status Changes from Inspection or Click
  setItemStatus(item: ItemDiagnostics, newStatus: 'completed' | 'in_progress' | 'not_started'): void {
    item.status = newStatus;

    if (item.type === 'juz') {
      const juzNum = parseInt(item.key.replace('juz_', ''), 10);
      this.completedJuzs.delete(juzNum);
      this.inProgressJuzs.delete(juzNum);
      if (newStatus === 'completed') this.completedJuzs.add(juzNum);
      if (newStatus === 'in_progress') this.inProgressJuzs.add(juzNum);
    } else if (item.type === 'surah') {
      this.completedSurahs.delete(item.title);
      this.inProgressSurahs.delete(item.title);
      if (newStatus === 'completed') this.completedSurahs.add(item.title);
      if (newStatus === 'in_progress') this.inProgressSurahs.add(item.title);
    } else if (item.type === 'maktab') {
      const pg = parseInt(item.key.replace('maktab_pg_', ''), 10);
      this.completedMaktabPages.delete(pg);
      if (newStatus === 'completed') this.completedMaktabPages.add(pg);
      if (newStatus === 'in_progress') this.inProgressMaktabPage = pg;
    }
  }

  getJuzStatus(juz: number): 'completed' | 'in_progress' | 'not_started' {
    if (this.completedJuzs.has(juz)) return 'completed';
    if (this.inProgressJuzs.has(juz)) return 'in_progress';
    return 'not_started';
  }

  getSurahStatus(surah: string): 'completed' | 'in_progress' | 'not_started' {
    if (this.completedSurahs.has(surah)) return 'completed';
    if (this.inProgressSurahs.has(surah)) return 'in_progress';
    return 'not_started';
  }

  getMaktabPageStatus(page: number): 'completed' | 'in_progress' | 'not_started' {
    if (this.completedMaktabPages.has(page)) return 'completed';
    if (this.inProgressMaktabPage === page) return 'in_progress';
    return 'not_started';
  }

  hasWeakness(key: string, type: 'surah' | 'juz' | 'maktab'): boolean {
    if (type === 'surah') {
      return (this.surahDiagnosticsMap.get(key)?.totalMistakes || 0) > 0;
    }
    if (type === 'juz') {
      const jNum = parseInt(key, 10);
      return (this.juzDiagnosticsMap.get(jNum)?.totalMistakes || 0) > 0;
    }
    if (type === 'maktab') {
      const pNum = parseInt(key, 10);
      return (this.maktabDiagnosticsMap.get(pNum)?.totalMistakes || 0) > 0;
    }
    return false;
  }

  filterSurahs(): void {
    const s = this.surahSearch.trim().toLowerCase();
    if (!s) {
      this.filteredSurahs = [...this.allSurahs];
    } else {
      this.filteredSurahs = this.allSurahs.filter(st => st.toLowerCase().includes(s));
    }
  }

  closeInspection(): void {
    this.inspectedItem = null;
  }

  async saveProgress(): Promise<void> {
    this.isSaving = true;
    try {
      const progressUpdate = {
        hifz: {
          completedJuzs: Array.from(this.completedJuzs).sort((a, b) => a - b),
          inProgressJuzs: Array.from(this.inProgressJuzs).sort((a, b) => a - b),
          completedSurahs: Array.from(this.completedSurahs),
          inProgressSurahs: Array.from(this.inProgressSurahs)
        },
        dawr: {
          completedRounds: this.completedDawrRounds || 0,
          currentRoundJuz: this.currentRoundJuz || null
        },
        maktab: {
          miftahCompletedPages: Array.from(this.completedMaktabPages).sort((a, b) => a - b),
          miftahCurrentPage: this.inProgressMaktabPage,
          tilawatCompletedSurahs: Array.from(this.completedSurahs).filter(s => this.completedSurahs.has(s))
        },
        lastUpdated: new Date().toISOString()
      };

      await this.repo.update('users', this.student.id!, {
        progress: progressUpdate
      }, this.data.currentUser);

      this.snackBar.open('Student baseline progress saved successfully!', 'Dismiss', { duration: 3000 });
      this.dialogRef.close(progressUpdate);
    } catch (error) {
      console.error('Failed to update progress', error);
      this.snackBar.open('Error saving baseline progress.', 'Dismiss', { duration: 3000 });
    } finally {
      this.isSaving = false;
    }
  }
}
