import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { getDeenDeskFirestore } from '../../../core/services/firebase-app';
import { ALL_QURAN_SURAHS, ALL_QURAN_JUZ, QuranJuzItem, getSurahAyahCount } from '../../../core/constants/defaults';
import { EntityRecord } from '../../../core/services/repository.service';

export interface MaktabSubjectEntry {
  subject: string;
  customSubjectName?: string;
  stage: string;
  startPage: number | null;
  endPage: number | null;
  lineNo: number | null;
  notes?: string;
}

export interface HifzExtraLessonEntry {
  id: string;
  lessonType: 'sabaq' | 'sabqi' | 'manzil' | 'dawr';
  evalMode: 'surah' | 'juz';
  surahName?: string;
  fromAyah?: number | null;
  toAyah?: number | null;
  juzNo?: number | null;
  juzPortion?: string;
  fromPage?: number | null;
  toPage?: number | null;
  mistakes?: number;
}

export interface StudentProgressEvaluationDialogData {
  student: EntityRecord;
  studentTypeMode: 'hifz' | 'maktab' | 'dawr';
  evalCadence: 'daily' | 'weekly';
  selectedDateStr: string;
  selectedWeekYear: number;
  selectedWeekNumber: number;
  selectedWeekStartStr: string;
  selectedWeekEndStr: string;
  classId?: string;
  groupId?: string;
  madrasaId?: string;
  currentUser: any;
  isOrgAdmin?: boolean;
  isSuperAdmin?: boolean;
  currentRosterItem?: any;
}

@Component({
  selector: 'app-student-progress-evaluation-dialog',
  templateUrl: './student-progress-evaluation-dialog.component.html',
  styleUrls: ['./student-progress-evaluation-dialog.component.scss'],
  standalone: false
})
export class StudentProgressEvaluationDialogComponent implements OnInit {
  student: EntityRecord;
  studentTypeMode: 'hifz' | 'maktab' | 'dawr' = 'hifz';
  evalCadence: 'daily' | 'weekly' = 'daily';
  
  isSaving = false;
  isLoadingHistory = false;
  lastProgressSummary: string | null = null;
  lastProgressRaw: any = null;

  // Constants
  allQuranSurahs = ALL_QURAN_SURAHS;
  allQuranJuzList: QuranJuzItem[] = ALL_QURAN_JUZ;
  allJuzNumbers: number[] = Array.from({ length: 30 }, (_, i) => i + 1);
  juzPortionOptions: string[] = [
    'Full Juz',
    '1st Quarter (Rub\' 1)',
    '2nd Quarter (Rub\' 2)',
    '3rd Quarter (Rub\' 3)',
    '4th Quarter (Rub\' 4)',
    '1st Half (Nisf 1)',
    '2nd Half (Nisf 2)'
  ];

  // Pre-configured Maktab Subjects (stages are managed at class/student level)
  predefinedMaktabSubjects: Array<{ id: string; title: string }> = [
    { id: 'Noorani Qaida', title: 'Noorani Qaida / Base Qaida' },
    { id: 'Nazira Quran', title: 'Nazira (Quran Reading)' },
    { id: 'Masnoon Duas', title: 'Masnoon Duas & Daily Adhkar' },
    { id: 'Fiqh & Akhlaq', title: 'Fiqh & Islamic Studies (Akhlaq)' },
    { id: 'Hadith', title: 'Hadith Memorization' },
    { id: 'Custom', title: 'Other / Custom Subject' }
  ];

  // Maktab Multi-Subject Entries
  maktabSubjects: MaktabSubjectEntry[] = [];

  // Hifz Evaluation Settings
  hifzEvalUnitMode: 'surah' | 'juz' = 'surah';
  hifzEntryMethod: 'ayah' | 'page' = 'ayah';

  // Hifz Primary Lessons
  // 1. Sabaq (New Lesson)
  sabaqStartSurah = '';
  sabaqStartAyah: number | null = null;
  sabaqEndSurah = '';
  sabaqEndAyah: number | null = null;
  sabaqJuz: number | null = null;
  sabaqStartPage: number | null = null;
  sabaqEndPage: number | null = null;
  sabaqMistakes: number | null = null;

  // 2. Sabqi (Old Lesson)
  sabqiStartSurah = '';
  sabqiStartAyah: number | null = null;
  sabqiEndSurah = '';
  sabqiEndAyah: number | null = null;
  sabqiJuz: number | null = null;
  sabqiStartPage: number | null = null;
  sabqiEndPage: number | null = null;
  sabqiMistakes: number | null = null;

  // 3. Dawr / Manzil (Revision)
  manzilStartSurah = '';
  manzilStartAyah: number | null = null;
  manzilEndSurah = '';
  manzilEndAyah: number | null = null;
  manzilStartJuz: number | null = null;
  manzilStartPortion = 'Full Juz';
  manzilEndJuz: number | null = null;
  manzilEndPortion = 'Full Juz';
  manzilMistakes: number | null = null;

  // Dawr specific
  dawrRoundNo: number = 1;
  dawrWeeklyJuzCount: number = 5;

  // Multi-Lesson Extra Entries for Hifz
  extraLessonsList: HifzExtraLessonEntry[] = [];

  // General Evaluation
  overallMistakes: number = 0;
  starRating: number = 5;
  performanceGrade: string = 'Mumtaz (Excellent)';
  remarks: string = '';

  // Role permissions & Organization Subject Configuration
  isOrgAdmin = false;
  isSuperAdmin = false;
  canConfigureSubjects = false;
  isManagingSubjects = false;
  newSubjectTitle = '';

  // Snapshot for in-dialog Undo
  initialStateSnapshot = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentProgressEvaluationDialogData,
    public dialogRef: MatDialogRef<StudentProgressEvaluationDialogComponent>,
    private snackBar: MatSnackBar
  ) {
    this.student = data.student;
    this.studentTypeMode = data.studentTypeMode || 'hifz';
    this.evalCadence = data.evalCadence || 'daily';
    this.isOrgAdmin = !!data.isOrgAdmin;
    this.isSuperAdmin = !!data.isSuperAdmin;
    this.canConfigureSubjects = this.isOrgAdmin || this.isSuperAdmin;
  }

  async ngOnInit(): Promise<void> {
    await this.loadOrgConfiguredSubjects();
    this.initFromExistingRoster();
    await this.fetchStudentHistoricalProgress();
    this.captureInitialSnapshot();
  }

  async loadOrgConfiguredSubjects(): Promise<void> {
    const orgId = this.data.currentUser?.organizationId;
    if (orgId) {
      try {
        const snap = await getDoc(doc(getDeenDeskFirestore(), 'organizations', orgId));
        if (snap.exists()) {
          const orgData: any = snap.data();
          const orgSubs = orgData?.academicSettings?.maktabSubjects;
          if (Array.isArray(orgSubs) && orgSubs.length > 0) {
            this.predefinedMaktabSubjects = orgSubs.map((s: any) => typeof s === 'string' ? { id: s, title: s } : { id: s.id || s.title, title: s.title || s.id });
          }
        }
      } catch (e) {
        console.warn('Could not load org maktab subjects:', e);
      }
    }

    // Strict Role Enforcement: Only Org Admin & Super Admin can configure or select Custom
    if (!this.canConfigureSubjects) {
      this.predefinedMaktabSubjects = this.predefinedMaktabSubjects.filter(s => s.id !== 'Custom');
    }
  }

  toggleConfigureSubjectsMode(): void {
    if (!this.canConfigureSubjects) return;
    this.isManagingSubjects = !this.isManagingSubjects;
  }

  addNewOrgSubject(): void {
    if (!this.canConfigureSubjects) return;
    const name = this.newSubjectTitle.trim();
    if (!name) {
      this.snackBar.open('Please enter a subject name', 'OK', { duration: 2500 });
      return;
    }

    const newSub = {
      id: name,
      title: name
    };

    this.predefinedMaktabSubjects.push(newSub);
    this.newSubjectTitle = '';
    this.saveOrgConfiguredSubjects();
  }

  removeOrgSubject(idx: number): void {
    if (!this.canConfigureSubjects) return;
    this.predefinedMaktabSubjects.splice(idx, 1);
    this.saveOrgConfiguredSubjects();
  }

  async saveOrgConfiguredSubjects(): Promise<void> {
    if (!this.canConfigureSubjects) return;
    const orgId = this.data.currentUser?.organizationId;
    if (!orgId) return;

    try {
      const orgRef = doc(getDeenDeskFirestore(), 'organizations', orgId);
      const snap = await getDoc(orgRef);
      const currentSettings = snap.exists() ? (snap.data()['academicSettings'] || {}) : {};

      const subjectsToSave = this.predefinedMaktabSubjects
        .filter(s => s.id !== 'Custom')
        .map(s => ({
          id: s.id || s.title,
          title: s.title || s.id
        }));

      await setDoc(orgRef, {
        academicSettings: {
          ...currentSettings,
          maktabSubjects: subjectsToSave
        }
      }, { merge: true });

      this.snackBar.open('Curriculum subjects saved to organization details!', 'OK', { duration: 3000 });
    } catch (e: any) {
      console.error('Failed to save org subjects:', e);
      this.snackBar.open('Failed to save organization subjects: ' + e.message, 'Close', { duration: 4000 });
    }
  }

  captureInitialSnapshot(): void {
    this.initialStateSnapshot = JSON.stringify({
      maktabSubjects: this.maktabSubjects,
      sabaqStartSurah: this.sabaqStartSurah,
      sabaqStartAyah: this.sabaqStartAyah,
      sabaqEndSurah: this.sabaqEndSurah,
      sabaqEndAyah: this.sabaqEndAyah,
      sabaqJuz: this.sabaqJuz,
      sabaqStartPage: this.sabaqStartPage,
      sabaqEndPage: this.sabaqEndPage,
      sabaqMistakes: this.sabaqMistakes,
      sabqiStartSurah: this.sabqiStartSurah,
      sabqiStartAyah: this.sabqiStartAyah,
      sabqiEndSurah: this.sabqiEndSurah,
      sabqiEndAyah: this.sabqiEndAyah,
      sabqiJuz: this.sabqiJuz,
      sabqiStartPage: this.sabqiStartPage,
      sabqiEndPage: this.sabqiEndPage,
      sabqiMistakes: this.sabqiMistakes,
      manzilStartSurah: this.manzilStartSurah,
      manzilStartAyah: this.manzilStartAyah,
      manzilEndSurah: this.manzilEndSurah,
      manzilEndAyah: this.manzilEndAyah,
      manzilStartJuz: this.manzilStartJuz,
      manzilStartPortion: this.manzilStartPortion,
      manzilEndJuz: this.manzilEndJuz,
      manzilEndPortion: this.manzilEndPortion,
      manzilMistakes: this.manzilMistakes,
      dawrRoundNo: this.dawrRoundNo,
      dawrWeeklyJuzCount: this.dawrWeeklyJuzCount,
      extraLessonsList: this.extraLessonsList,
      overallMistakes: this.overallMistakes,
      starRating: this.starRating,
      performanceGrade: this.performanceGrade,
      remarks: this.remarks
    });
  }

  resetToInitialSnapshot(): void {
    if (!this.initialStateSnapshot) return;
    try {
      const snap = JSON.parse(this.initialStateSnapshot);
      Object.assign(this, snap);
      this.snackBar.open('Dialog inputs reverted to original values.', 'OK', { duration: 2500 });
    } catch (e) {
      console.error(e);
    }
  }

  initFromExistingRoster(): void {
    const item = this.data.currentRosterItem;
    if (!item) {
      if (this.studentTypeMode === 'maktab') {
        this.addMaktabSubject('Noorani Qaida');
      }
      return;
    }

    if (this.studentTypeMode === 'maktab') {
      if (Array.isArray(item.maktabSubjectsList) && item.maktabSubjectsList.length > 0) {
        this.maktabSubjects = JSON.parse(JSON.stringify(item.maktabSubjectsList));
      } else {
        const subName = item.weeklyMaktabSubject || item.maktabSubject || 'Noorani Qaida';
        const startPg = item.weeklyMaktabStartPage || 1;
        const endPg = item.weeklyMaktabEndPage || item.maktabPage || 1;
        const lineNo = item.maktabLineNo || 1;
        this.maktabSubjects.push({
          subject: subName,
          stage: '',
          startPage: startPg,
          endPage: endPg,
          lineNo: lineNo,
          notes: ''
        });
      }
    } else {
      // Hifz / Dawr
      this.sabaqStartSurah = item.weeklySabaqStartSurah || item.sabaqSurah || '';
      this.sabaqStartAyah = item.weeklySabaqStartAyah || item.sabaqFromAyah || null;
      this.sabaqEndSurah = item.weeklySabaqEndSurah || item.sabaqSurah || '';
      this.sabaqEndAyah = item.weeklySabaqEndAyah || item.sabaqToAyah || null;
      this.sabaqJuz = item.weeklySabaqStartJuz || item.sabaqJuzNo || null;
      this.sabaqStartPage = item.weeklySabaqStartPage || null;
      this.sabaqEndPage = item.weeklySabaqEndPage || null;
      this.sabaqMistakes = item.sabaqMistakes || null;

      this.sabqiStartSurah = item.weeklySabqiStartSurah || item.sabqiSurah || '';
      this.sabqiStartAyah = item.weeklySabqiStartAyah || item.sabqiFromAyah || null;
      this.sabqiEndSurah = item.weeklySabqiEndSurah || item.sabqiSurah || '';
      this.sabqiEndAyah = item.weeklySabqiEndAyah || item.sabqiToAyah || null;
      this.sabqiJuz = item.weeklySabqiStartJuz || item.sabqiJuz || null;
      this.sabqiStartPage = item.weeklySabqiStartPage || null;
      this.sabqiEndPage = item.weeklySabqiEndPage || null;
      this.sabqiMistakes = item.sabqiMistakes || null;

      this.manzilStartSurah = item.weeklyManzilStartSurah || item.manzilSurah || '';
      this.manzilStartAyah = item.weeklyManzilStartAyah || item.manzilFromAyah || null;
      this.manzilEndSurah = item.weeklyManzilEndSurah || item.manzilSurah || '';
      this.manzilEndAyah = item.weeklyManzilEndAyah || item.manzilToAyah || null;
      this.manzilStartJuz = item.weeklyManzilStartJuz || item.manzilJuz || null;
      this.manzilStartPortion = item.weeklyManzilStartPortion || item.manzilJuzPortion || 'Full Juz';
      this.manzilEndJuz = item.weeklyManzilEndJuz || item.manzilJuz || null;
      this.manzilEndPortion = item.weeklyManzilEndPortion || 'Full Juz';
      this.manzilMistakes = item.manzilMistakes || null;

      this.dawrRoundNo = item.weeklyDawrRounds || item.dawrRoundNo || 1;
      this.dawrWeeklyJuzCount = item.weeklyDawrJuzCount || 5;

      if (Array.isArray(item.hifzLessonsList) && item.hifzLessonsList.length > 0) {
        this.extraLessonsList = JSON.parse(JSON.stringify(item.hifzLessonsList));
      }

      if (this.sabaqStartPage || this.sabaqJuz) {
        this.hifzEvalUnitMode = 'juz';
      } else {
        this.hifzEvalUnitMode = 'surah';
      }
    }

    this.starRating = item.weeklyRating || item.hifzRating || 5;
    this.overallMistakes = item.weeklyMistakes || item.sabaqMistakes || 0;
    this.remarks = item.weeklyNotes || item.maktabRemarks || '';
    this.updateGradeFromRating();
  }

  async fetchStudentHistoricalProgress(): Promise<void> {
    if (!this.student?.id) return;
    this.isLoadingHistory = true;
    try {
      const firestore = getDeenDeskFirestore();
      // Look for latest daily progress record
      const dailyColl = collection(firestore, 'studentDailyProgress');
      const q = query(
        dailyColl,
        where('studentId', '==', this.student.id)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const sortedDocs = snapshot.docs
          .map(d => d.data())
          .sort((a, b) => String(b['date'] || '').localeCompare(String(a['date'] || '')));
        const docData = sortedDocs[0];
        if (docData) {
          this.lastProgressRaw = docData;
          this.buildLastProgressSummary(docData);
        }
      }
    } catch (e) {
      console.warn('Could not fetch historical progress:', e);
    } finally {
      this.isLoadingHistory = false;
    }
  }

  getStudentStageDisplay(student: any): string {
    if (!student) return '';
    const raw = (
      student['stage'] ||
      student['stageName'] ||
      student['currentStage'] ||
      student['stageOrLevel'] ||
      student['stageDisplay'] ||
      student['programStage'] ||
      student['dawrStage'] ||
      student['targetGoals']?.stage ||
      student['hifzStage'] ||
      student['courseStage'] ||
      student['level'] ||
      ''
    ).toString().trim();

    if (!raw || raw === '-' || raw.toLowerCase() === 'n/a') return '';
    const rawLower = raw.toLowerCase();
    if (rawLower.includes(' - group ') || rawLower.includes(' – group ') || /^group\s+[a-z0-9]/i.test(rawLower)) {
      return '';
    }
    return raw;
  }

  buildLastProgressSummary(docData: any): void {
    if (this.studentTypeMode === 'maktab') {
      const m = docData.maktabProgress || docData;
      const sub = m.subjectName || m.maktabSubject || 'Qaida';
      const pg = m.pageNo || m.maktabPageNo || 1;
      const line = m.lineNo || m.maktabLessonNo ? ` Line ${m.lineNo || m.maktabLessonNo}` : '';
      this.lastProgressSummary = `Last Milestone (${docData.date || 'Recent'}): ${sub} — Pg ${pg}${line}`;
    } else {
      const h = docData.hifzProgress || docData;
      const sabaq = h.sabaqSurahName || h.sabaqSurah || '';
      const fromAyah = h.sabaqFromAyah || h.sabaqAyahFrom || 1;
      const toAyah = h.sabaqToAyah || h.sabaqAyahTo || 1;
      const juz = h.sabaqJuzNo || h.sabaqJuz;
      if (sabaq) {
        this.lastProgressSummary = `Last Milestone (${docData.date || 'Recent'}): Sabaq: ${sabaq} (${fromAyah} - ${toAyah})`;
      } else if (juz) {
        this.lastProgressSummary = `Last Milestone (${docData.date || 'Recent'}): Sabaq: Juz ${juz} (${h.sabaqJuzPortion || 'Full Juz'})`;
      }
    }
  }

  continueFromLastMilestone(): void {
    if (!this.lastProgressRaw) return;
    const docData = this.lastProgressRaw;
    if (this.studentTypeMode === 'maktab') {
      const m = docData.maktabProgress || docData;
      const lastPg = parseInt(String(m.pageNo || m.maktabPageNo || 1), 10) || 1;
      const lastLine = parseInt(String(m.lineNo || m.maktabLessonNo || 1), 10) || 1;
      if (this.maktabSubjects.length === 0) {
        this.addMaktabSubject(m.subjectName || 'Noorani Qaida');
      }
      this.maktabSubjects[0].startPage = lastPg;
      this.maktabSubjects[0].endPage = lastPg + 1;
      this.maktabSubjects[0].lineNo = lastLine;
      this.snackBar.open(`Continued from Page ${lastPg}!`, 'OK', { duration: 2500 });
    } else {
      const h = docData.hifzProgress || docData;
      const sabaq = h.sabaqSurahName || h.sabaqSurah;
      const toAyah = parseInt(String(h.sabaqToAyah || h.sabaqAyahTo || 1), 10) || 1;
      if (sabaq) {
        this.sabaqStartSurah = sabaq;
        this.sabaqStartAyah = toAyah + 1;
        this.sabaqEndSurah = sabaq;
        this.sabaqEndAyah = toAyah + 10;
        this.hifzEvalUnitMode = 'surah';
        this.snackBar.open(`Continued from ${sabaq} Ayah ${toAyah + 1}!`, 'OK', { duration: 2500 });
      }
    }
  }

  // Maktab Methods
  addMaktabSubject(defaultId: string = 'Noorani Qaida'): void {
    const config = this.predefinedMaktabSubjects.find(s => s.id === defaultId);
    this.maktabSubjects.push({
      subject: config ? config.id : (this.predefinedMaktabSubjects[0]?.id || defaultId),
      stage: '',
      startPage: 1,
      endPage: 2,
      lineNo: 1,
      notes: ''
    });
  }

  removeMaktabSubject(index: number): void {
    this.maktabSubjects.splice(index, 1);
  }

  getStagesForSubject(subjectId: string): string[] {
    return [];
  }

  onSubjectChanged(item: MaktabSubjectEntry): void {
    item.stage = '';
  }

  // Hifz Extra Lessons
  addExtraLesson(): void {
    this.extraLessonsList.push({
      id: 'lesson_' + Date.now(),
      lessonType: 'sabaq',
      evalMode: this.hifzEvalUnitMode,
      surahName: this.allQuranSurahs[0],
      fromAyah: 1,
      toAyah: 10,
      juzNo: 1,
      fromPage: 1,
      toPage: 5,
      mistakes: 0
    });
  }

  removeExtraLesson(idx: number): void {
    this.extraLessonsList.splice(idx, 1);
  }

  setRating(rating: number): void {
    this.starRating = rating;
    this.updateGradeFromRating();
  }

  updateGradeFromRating(): void {
    switch (this.starRating) {
      case 5:
        this.performanceGrade = 'Mumtaz (Excellent)';
        break;
      case 4:
        this.performanceGrade = 'Jayyid Jiddan (Very Good)';
        break;
      case 3:
        this.performanceGrade = 'Jayyid (Good)';
        break;
      case 2:
        this.performanceGrade = 'Maqbool (Fair)';
        break;
      default:
        this.performanceGrade = 'Needs Revision';
        break;
    }
  }

  // Surah Ayah Count & Validation Helpers
  getMaxAyah(surahName: string | null | undefined): number | null {
    if (!surahName) return null;
    return getSurahAyahCount(surahName);
  }

  onSabaqStartSurahChange(): void {
    if (this.sabaqStartSurah) {
      if (!this.sabaqEndSurah) {
        this.sabaqEndSurah = this.sabaqStartSurah;
      }
      const maxA = this.getMaxAyah(this.sabaqStartSurah);
      if (!this.sabaqStartAyah || this.sabaqStartAyah < 1) {
        this.sabaqStartAyah = 1;
      } else if (maxA && this.sabaqStartAyah > maxA) {
        this.sabaqStartAyah = maxA;
      }
    }
  }

  onSabaqEndSurahChange(): void {
    if (this.sabaqEndSurah) {
      const maxA = this.getMaxAyah(this.sabaqEndSurah);
      if (!this.sabaqEndAyah || this.sabaqEndAyah < 1) {
        this.sabaqEndAyah = maxA ? Math.min(10, maxA) : 10;
      } else if (maxA && this.sabaqEndAyah > maxA) {
        this.sabaqEndAyah = maxA;
      }
    }
  }

  onSabqiStartSurahChange(): void {
    if (this.sabqiStartSurah) {
      if (!this.sabqiEndSurah) {
        this.sabqiEndSurah = this.sabqiStartSurah;
      }
      const maxA = this.getMaxAyah(this.sabqiStartSurah);
      if (!this.sabqiStartAyah || this.sabqiStartAyah < 1) {
        this.sabqiStartAyah = 1;
      } else if (maxA && this.sabqiStartAyah > maxA) {
        this.sabqiStartAyah = maxA;
      }
    }
  }

  onSabqiEndSurahChange(): void {
    if (this.sabqiEndSurah) {
      const maxA = this.getMaxAyah(this.sabqiEndSurah);
      if (!this.sabqiEndAyah || this.sabqiEndAyah < 1) {
        this.sabqiEndAyah = maxA ? Math.min(10, maxA) : 10;
      } else if (maxA && this.sabqiEndAyah > maxA) {
        this.sabqiEndAyah = maxA;
      }
    }
  }

  validateSabaqAyahs(): string | null {
    if (this.hifzEvalUnitMode !== 'surah' || this.hifzEntryMethod !== 'ayah') return null;
    if (this.sabaqStartSurah && this.sabaqStartAyah) {
      const maxStart = this.getMaxAyah(this.sabaqStartSurah);
      if (maxStart && this.sabaqStartAyah > maxStart) {
        return `Start Ayah (${this.sabaqStartAyah}) exceeds total ${maxStart} ayahs of ${this.sabaqStartSurah}.`;
      }
    }
    if (this.sabaqEndSurah && this.sabaqEndAyah) {
      const maxEnd = this.getMaxAyah(this.sabaqEndSurah);
      if (maxEnd && this.sabaqEndAyah > maxEnd) {
        return `End Ayah (${this.sabaqEndAyah}) exceeds total ${maxEnd} ayahs of ${this.sabaqEndSurah}.`;
      }
    }
    if (this.sabaqStartSurah && this.sabaqEndSurah && this.sabaqStartSurah === this.sabaqEndSurah) {
      if (this.sabaqStartAyah && this.sabaqEndAyah && this.sabaqStartAyah > this.sabaqEndAyah) {
        return `Start Ayah (${this.sabaqStartAyah}) cannot be greater than End Ayah (${this.sabaqEndAyah}).`;
      }
    }
    return null;
  }

  validateSabqiAyahs(): string | null {
    if (this.hifzEvalUnitMode !== 'surah' || this.hifzEntryMethod !== 'ayah') return null;
    if (this.sabqiStartSurah && this.sabqiStartAyah) {
      const maxStart = this.getMaxAyah(this.sabqiStartSurah);
      if (maxStart && this.sabqiStartAyah > maxStart) {
        return `Start Ayah (${this.sabqiStartAyah}) exceeds total ${maxStart} ayahs of ${this.sabqiStartSurah}.`;
      }
    }
    if (this.sabqiEndSurah && this.sabqiEndAyah) {
      const maxEnd = this.getMaxAyah(this.sabqiEndSurah);
      if (maxEnd && this.sabqiEndAyah > maxEnd) {
        return `End Ayah (${this.sabqiEndAyah}) exceeds total ${maxEnd} ayahs of ${this.sabqiEndSurah}.`;
      }
    }
    if (this.sabqiStartSurah && this.sabqiEndSurah && this.sabqiStartSurah === this.sabqiEndSurah) {
      if (this.sabqiStartAyah && this.sabqiEndAyah && this.sabqiStartAyah > this.sabqiEndAyah) {
        return `Start Ayah (${this.sabqiStartAyah}) cannot be greater than End Ayah (${this.sabqiEndAyah}).`;
      }
    }
    return null;
  }

  async saveEvaluation(): Promise<void> {
    if (this.studentTypeMode !== 'maktab') {
      const sabaqErr = this.validateSabaqAyahs();
      if (sabaqErr) {
        this.snackBar.open(sabaqErr, 'Fix Ayah', { duration: 4000 });
        return;
      }
      const sabqiErr = this.validateSabqiAyahs();
      if (sabqiErr) {
        this.snackBar.open(sabqiErr, 'Fix Ayah', { duration: 4000 });
        return;
      }
    }

    this.isSaving = true;
    try {
      const firestore = getDeenDeskFirestore();
      const studentId = this.student.id;
      const orgId = this.data.currentUser?.organizationId || '';
      const madrasaId = this.data.madrasaId || '';
      const classId = this.data.classId || '';
      const groupId = this.data.groupId || '';

      const dateStr = this.data.selectedDateStr;
      const weekYear = this.data.selectedWeekYear;
      const weekNo = this.data.selectedWeekNumber;

      // 1. Prepare clean primary representations for backward compatibility
      const primaryMaktab = this.maktabSubjects[0] || null;

      // 2. Build Daily Progress Record
      const dailyDocId = `${studentId}_${dateStr}`;
      const dailyDocRef = doc(firestore, 'studentDailyProgress', dailyDocId);
      const dailyPayload: any = {
        id: dailyDocId,
        studentId: studentId,
        studentName: this.student['fullName'] || this.student['name'],
        organizationId: orgId,
        madrasaId: madrasaId,
        classId: classId,
        groupId: groupId,
        date: dateStr,
        studentType: this.studentTypeMode,
        evaluatedByUid: this.data.currentUser?.uid || '',
        evaluatedByName: this.data.currentUser?.displayName || this.data.currentUser?.email || '',
        recordedAt: Timestamp.now(),
        starRating: this.starRating,
        grade: this.performanceGrade,
        remarks: this.remarks
      };

      if (this.studentTypeMode === 'maktab') {
        dailyPayload.maktabSubject = primaryMaktab ? (primaryMaktab.customSubjectName || primaryMaktab.subject) : '';
        dailyPayload.maktabPageNo = primaryMaktab?.endPage || null;
        dailyPayload.maktabLessonNo = primaryMaktab?.lineNo || null;
        dailyPayload.maktabSubjectsList = this.maktabSubjects;
        dailyPayload.maktabProgress = {
          subjectName: primaryMaktab ? (primaryMaktab.customSubjectName || primaryMaktab.subject) : '',
          stage: primaryMaktab?.stage || '',
          startPage: primaryMaktab?.startPage || null,
          pageNo: primaryMaktab?.endPage || null,
          lineNo: primaryMaktab?.lineNo || null,
          mistakesCount: this.overallMistakes,
          subjectsCount: this.maktabSubjects.length
        };
      } else {
        // Hifz
        dailyPayload.sabaqSurah = this.sabaqEndSurah;
        dailyPayload.sabaqAyahFrom = this.sabaqStartAyah;
        dailyPayload.sabaqAyahTo = this.sabaqEndAyah;
        dailyPayload.sabaqMistakes = this.sabaqMistakes || 0;
        dailyPayload.sabqiSurah = this.sabqiEndSurah;
        dailyPayload.sabqiAyahFrom = this.sabqiStartAyah;
        dailyPayload.sabqiAyahTo = this.sabqiEndAyah;
        dailyPayload.sabqiJuz = this.sabqiJuz ? `Juz ${this.sabqiJuz}` : '';
        dailyPayload.sabqiMistakes = this.sabqiMistakes || 0;
        dailyPayload.manzilSurah = this.manzilEndSurah;
        dailyPayload.manzilAyahFrom = this.manzilStartAyah;
        dailyPayload.manzilAyahTo = this.manzilEndAyah;
        dailyPayload.manzilJuz = this.manzilStartJuz ? `Juz ${this.manzilStartJuz}` : '';
        dailyPayload.manzilMistakes = this.manzilMistakes || 0;
        dailyPayload.hifzLessonsList = this.extraLessonsList;
        dailyPayload.hifzProgress = {
          evalUnitMode: this.hifzEvalUnitMode,
          sabaqSurahName: this.sabaqEndSurah,
          sabaqFromAyah: this.sabaqStartAyah,
          sabaqToAyah: this.sabaqEndAyah,
          sabaqJuzNo: this.sabaqJuz,
          sabaqStartPage: this.sabaqStartPage,
          sabaqEndPage: this.sabaqEndPage,
          sabaqMistakes: this.sabaqMistakes || 0,
          sabqiRange: this.sabqiEndSurah || (this.sabqiJuz ? `Juz ${this.sabqiJuz}` : ''),
          manzilRange: this.manzilStartJuz ? `Juz ${this.manzilStartJuz} (${this.manzilStartPortion})` : this.manzilEndSurah,
          rating: this.starRating
        };

        if (this.studentTypeMode === 'dawr') {
          dailyPayload.dawrRoundNo = this.dawrRoundNo || 1;
          dailyPayload.dawrPortionJuz = this.manzilStartJuz ? `Juz ${this.manzilStartJuz} (${this.manzilStartPortion || 'Full Juz'})` : 'Juz 1';
          dailyPayload.dawrMistakes = this.manzilMistakes || 0;
          dailyPayload.dawrProgress = {
            roundNo: this.dawrRoundNo || 1,
            startJuz: this.manzilStartJuz || 1,
            startPortion: this.manzilStartPortion || 'Full Juz',
            endJuz: this.manzilEndJuz || 1,
            endPortion: this.manzilEndPortion || 'Full Juz',
            portionJuz: this.manzilStartJuz ? `Juz ${this.manzilStartJuz} (${this.manzilStartPortion || 'Full Juz'})` : 'Juz 1',
            dawrMistakes: this.manzilMistakes || 0,
            rating: this.starRating
          };
        }
      }

      await setDoc(dailyDocRef, dailyPayload, { merge: true });

      // 3. If Weekly evaluation cadence or selected, also save to studentWeeklyProgress
      if (this.evalCadence === 'weekly') {
        const weeklyDocId = `${studentId}_week_${weekYear}_${weekNo}`;
        const weeklyDocRef = doc(firestore, 'studentWeeklyProgress', weeklyDocId);
        const weeklyPayload: any = {
          id: weeklyDocId,
          studentId: studentId,
          organizationId: orgId,
          madrasaId: madrasaId,
          classId: classId,
          groupId: groupId,
          year: weekYear,
          weekNumber: weekNo,
          weekStartDate: this.data.selectedWeekStartStr,
          weekEndDate: this.data.selectedWeekEndStr,
          studentType: this.studentTypeMode,
          recordedByUid: this.data.currentUser?.uid || '',
          recordedByName: this.data.currentUser?.displayName || '',
          recordedAt: Timestamp.now(),
          starRating: this.starRating,
          grade: this.performanceGrade,
          notes: this.remarks
        };

        if (this.studentTypeMode === 'maktab') {
          weeklyPayload.maktab = {
            subject: primaryMaktab ? (primaryMaktab.customSubjectName || primaryMaktab.subject) : '',
            startPage: primaryMaktab?.startPage || 1,
            endPage: primaryMaktab?.endPage || 1,
            lineNo: primaryMaktab?.lineNo || 1,
            rating: this.starRating,
            notes: this.remarks
          };
          weeklyPayload.maktabSubjectsList = this.maktabSubjects;
        } else {
          weeklyPayload.hifz = {
            evalUnitMode: this.hifzEvalUnitMode,
            sabaqStartSurah: this.sabaqStartSurah,
            sabaqStartAyah: this.sabaqStartAyah,
            sabaqEndSurah: this.sabaqEndSurah,
            sabaqEndAyah: this.sabaqEndAyah,
            sabaqStartJuz: this.sabaqJuz,
            sabaqEndJuz: this.sabaqJuz,
            sabaqStartPage: this.sabaqStartPage,
            sabaqEndPage: this.sabaqEndPage,
            sabqiStartSurah: this.sabqiStartSurah,
            sabqiStartAyah: this.sabqiStartAyah,
            sabqiEndSurah: this.sabqiEndSurah,
            sabqiEndAyah: this.sabqiEndAyah,
            sabqiStartJuz: this.sabqiJuz,
            sabqiEndJuz: this.sabqiJuz,
            sabqiStartPage: this.sabqiStartPage,
            sabqiEndPage: this.sabqiEndPage,
            manzilStartSurah: this.manzilStartSurah,
            manzilEndSurah: this.manzilEndSurah,
            manzilStartJuz: this.manzilStartJuz,
            manzilStartPortion: this.manzilStartPortion,
            manzilEndJuz: this.manzilEndJuz,
            manzilEndPortion: this.manzilEndPortion,
            weeklyMistakes: this.overallMistakes,
            rating: this.starRating,
            notes: this.remarks
          };
          weeklyPayload.hifzLessonsList = this.extraLessonsList;

          if (this.studentTypeMode === 'dawr') {
            weeklyPayload.dawr = {
              roundNo: this.dawrRoundNo || 1,
              startJuz: this.manzilStartJuz || 1,
              startPortion: this.manzilStartPortion || 'Full Juz',
              endJuz: this.manzilEndJuz || 1,
              endPortion: this.manzilEndPortion || 'Full Juz',
              weeklyJuzCount: 1,
              rating: this.starRating,
              notes: this.remarks
            };
          }
        }

        await setDoc(weeklyDocRef, weeklyPayload, { merge: true });
      }

      this.snackBar.open(`Progress saved for ${this.student['fullName'] || this.student['name']}!`, 'OK', {
        duration: 3000,
        panelClass: ['app-snackbar']
      });

      this.dialogRef.close({
        saved: true,
        savedDocRefs: [
          `studentDailyProgress/${dailyDocId}`,
          ...(this.evalCadence === 'weekly' ? [`studentWeeklyProgress/${studentId}_week_${weekYear}_${weekNo}`] : [])
        ],
        dailyPayload,
        dawrRoundNo: this.dawrRoundNo,
        maktabSubjects: this.maktabSubjects,
        hifzLessonsList: this.extraLessonsList,
        sabaqStartSurah: this.sabaqStartSurah,
        sabaqStartAyah: this.sabaqStartAyah,
        sabaqEndSurah: this.sabaqEndSurah,
        sabaqEndAyah: this.sabaqEndAyah,
        sabaqJuz: this.sabaqJuz,
        sabaqStartPage: this.sabaqStartPage,
        sabaqEndPage: this.sabaqEndPage,
        sabqiStartSurah: this.sabqiStartSurah,
        sabqiStartAyah: this.sabqiStartAyah,
        sabqiEndSurah: this.sabqiEndSurah,
        sabqiEndAyah: this.sabqiEndAyah,
        sabqiJuz: this.sabqiJuz,
        sabqiStartPage: this.sabqiStartPage,
        sabqiEndPage: this.sabqiEndPage,
        manzilStartJuz: this.manzilStartJuz,
        manzilStartPortion: this.manzilStartPortion,
        manzilEndJuz: this.manzilEndJuz,
        manzilEndPortion: this.manzilEndPortion,
        starRating: this.starRating,
        overallMistakes: this.overallMistakes,
        remarks: this.remarks
      });
    } catch (err: any) {
      console.error('Error saving student progress evaluation:', err);
      this.snackBar.open(err.message || 'Failed to save evaluation', 'Close', { duration: 4000 });
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
