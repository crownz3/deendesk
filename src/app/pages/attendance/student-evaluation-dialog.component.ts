import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppUser, StudentDailyProgress } from '../../core/models/domain.model';
import { RepositoryService, EntityRecord } from '../../core/services/repository.service';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ALL_QURAN_SURAHS, getSurahAyahCount } from '../../core/constants/defaults';

export interface StudentEvaluationDialogData {
  studentId: string;
  studentName: string;
  date: string;
  courseId?: string;
  courseName?: string;
  courseType?: string;
  classId?: string;
  groupId?: string;
  profile: AppUser;
  existingRecord?: StudentDailyProgress & EntityRecord;
}

@Component({
  selector: 'app-student-evaluation-dialog',
  templateUrl: './student-evaluation-dialog.component.html',
  styleUrls: ['./student-evaluation-dialog.component.scss'],
  standalone: false
})
export class StudentEvaluationDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  courseType: string = 'hifz';

  evalUnitMode: 'surah' | 'juz' = 'surah';
  sabaqEvalUnitMode: 'surah' | 'juz' = 'surah';
  sabqiEvalUnitMode: 'surah' | 'juz' = 'surah';
  manzilEvalUnitMode: 'surah' | 'juz' = 'surah';

  surahList: string[] = ALL_QURAN_SURAHS;
  juzPortionOptions: string[] = [
    'Full Juz',
    '1st Quarter (Rub 1)',
    '2nd Quarter (Rub 2)',
    '3rd Quarter (Rub 3)',
    '4th Quarter (Rub 4)',
    '1st Half (Nisf 1)',
    '2nd Half (Nisf 2)'
  ];

  maktabSubjects: string[] = ['Nurani Qaida', 'Juz Amma', 'Masnoon Duas', 'Fiqh & Akhlaq', 'Seerah', 'Tajweed Practice'];

  grades: string[] = ['Excellent', 'Good', 'Fair', 'Needs Revision'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentEvaluationDialogData,
    private dialogRef: MatDialogRef<StudentEvaluationDialogComponent>,
    private fb: FormBuilder,
    private repo: RepositoryService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.courseType = (this.data.courseType || 'hifz').toLowerCase();
    const exist = this.data.existingRecord;

    this.form = this.fb.group({
      // Hifz Fields
      sabaqSurah: [exist?.sabaqSurah || 'Al-Baqarah'],
      sabaqAyahFrom: [exist?.sabaqAyahFrom || 1],
      sabaqAyahTo: [exist?.sabaqAyahTo || 10],
      sabaqMistakes: [exist?.sabaqMistakes || 0, [Validators.min(0)]],
      
      sabqiSurah: [exist?.['sabqiSurah'] || 'Al-Fatihah'],
      sabqiAyahFrom: [exist?.['sabqiAyahFrom'] || 1],
      sabqiAyahTo: [exist?.['sabqiAyahTo'] || 7],
      sabqiJuz: [exist?.sabqiJuz || 'Juz 1'],
      sabqiJuzPortion: [exist?.['sabqiJuzPortion'] || 'Full Juz'],
      sabqiMistakes: [exist?.sabqiMistakes || 0, [Validators.min(0)]],
      
      manzilSurah: [exist?.['manzilSurah'] || 'Yaseen'],
      manzilAyahFrom: [exist?.['manzilAyahFrom'] || 1],
      manzilAyahTo: [exist?.['manzilAyahTo'] || 83],
      manzilJuz: [exist?.manzilJuz || 'Juz 22'],
      manzilJuzPortion: [exist?.['manzilJuzPortion'] || 'Full Juz'],
      manzilMistakes: [exist?.manzilMistakes || 0, [Validators.min(0)]],

      daurJuzFrom: [exist?.daurJuzFrom || 1],
      daurJuzTo: [exist?.daurJuzTo || 5],
      daurRoundNumber: [exist?.daurRoundNumber || 1],
      daurMistakes: [exist?.daurMistakes || 0, [Validators.min(0)]],

      // Maktab Fields
      maktabSubject: [exist?.maktabSubject || 'Nurani Qaida'],
      maktabPageNo: [exist?.maktabPageNo || 1],
      maktabLessonNo: [exist?.maktabLessonNo || 1],

      // Academic / Custom Fields
      subjectName: [exist?.subjectName || 'Tafseer'],
      chapterTopic: [exist?.chapterTopic || ''],
      score: [exist?.score || null],
      totalScore: [exist?.totalScore || 20],

      // Detailed Mistake Breakdown (Optional)
      mistakePageNo: [exist?.mistakePageNo || ''],
      mistakeLineNo: [exist?.mistakeLineNo || ''],
      mistakeWord: [exist?.mistakeWord || ''],

      // Common Evaluation
      grade: [exist?.grade || 'Good'],
      starRating: [exist?.starRating || 5],
      remarks: [exist?.remarks || '']
    });
  }

  setRating(stars: number): void {
    this.form.patchValue({ starRating: stars });
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;

    try {
      const val = this.form.value;
      const record: Partial<StudentDailyProgress> & Record<string, any> = {
        date: this.data.date,
        studentId: this.data.studentId,
        studentName: this.data.studentName,
        courseId: this.data.courseId || '',
        courseName: this.data.courseName || '',
        courseType: this.courseType,
        classId: this.data.classId || '',
        groupId: this.data.groupId || '',
        organizationId: this.data.profile.organizationId || '',
        madrasaId: this.data.profile.madrasaId || '',
        evaluatedByUid: this.data.profile.uid,
        evaluatedByName: this.data.profile.displayName || '',
        evalUnitMode: this.evalUnitMode,
        
        // Form Values
        sabaqSurah: val.sabaqSurah,
        sabaqAyahFrom: val.sabaqAyahFrom,
        sabaqAyahTo: val.sabaqAyahTo,
        sabaqMistakes: Number(val.sabaqMistakes || 0),

        sabqiSurah: val.sabqiSurah,
        sabqiAyahFrom: val.sabqiAyahFrom,
        sabqiAyahTo: val.sabqiAyahTo,
        sabqiJuz: val.sabqiJuz,
        sabqiJuzPortion: val.sabqiJuzPortion,
        sabqiMistakes: Number(val.sabqiMistakes || 0),

        manzilSurah: val.manzilSurah,
        manzilAyahFrom: val.manzilAyahFrom,
        manzilAyahTo: val.manzilAyahTo,
        manzilJuz: val.manzilJuz,
        manzilJuzPortion: val.manzilJuzPortion,
        manzilMistakes: Number(val.manzilMistakes || 0),
        daurJuzFrom: val.daurJuzFrom,
        daurJuzTo: val.daurJuzTo,
        daurRoundNumber: Number(val.daurRoundNumber || 1),
        daurMistakes: Number(val.daurMistakes || 0),

        maktabSubject: val.maktabSubject,
        maktabPageNo: val.maktabPageNo,
        maktabLessonNo: val.maktabLessonNo,

        subjectName: val.subjectName,
        chapterTopic: val.chapterTopic,
        score: val.score !== null ? Number(val.score) : undefined,
        totalScore: val.totalScore !== null ? Number(val.totalScore) : undefined,

        mistakePageNo: val.mistakePageNo,
        mistakeLineNo: val.mistakeLineNo,
        mistakeWord: val.mistakeWord,

        grade: val.grade,
        starRating: val.starRating,
        remarks: val.remarks
      };

      if (this.data.existingRecord?.id) {
        await this.repo.update('studentDailyProgress', this.data.existingRecord.id, record, this.data.profile);
      } else {
        await this.repo.create('studentDailyProgress', record, this.data.profile);
      }

      this.snackBar.open(`Daily progress recorded for ${this.data.studentName}!`, 'Close', { duration: 4000 });
      this.dialogRef.close({ success: true, record });
    } catch (err: any) {
      console.error('[StudentEvaluationDialog] Save error:', err);
      this.snackBar.open('Failed to save evaluation record. Please try again.', 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }

  getSurahMaxAyah(surahInput: string | null | undefined): number {
    if (!surahInput) return 286;
    return getSurahAyahCount(surahInput) || 286;
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
