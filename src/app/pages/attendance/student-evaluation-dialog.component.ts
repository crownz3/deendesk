import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppUser, StudentDailyProgress } from '../../core/models/domain.model';
import { RepositoryService, EntityRecord } from '../../core/services/repository.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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

  surahList: string[] = [
    'Al-Fatiha', 'Al-Baqarah', 'Ali Imran', 'An-Nisa', 'Al-Ma\'idah', 'Al-An\'am', 'Al-A\'raf', 'Al-Anfal', 'At-Tawbah',
    'Yunus', 'Hud', 'Yusuf', 'Ar-Ra\'d', 'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha',
    'Al-Anbiya', 'Al-Hajj', 'Al-Mu\'minun', 'An-Nur', 'Al-Furqan', 'Ash-Shu\'ara', 'An-Naml', 'Al-Qasas', 'Al-Ankabut',
    'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir',
    'Fussilat', 'Ash-Shura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat',
    'Qaf', 'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', 'Al-Waqi\'ah', 'Al-Hadid', 'Al-Mujadila',
    'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', 'Al-Jumu\'ah', 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim',
    'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', 'Al-Ma\'arij', 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah',
    'Al-Insan', 'Al-Mursalat', 'An-Naba', 'An-Nazi\'at', 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq',
    'Al-Buruj', 'At-Tariq', 'Al-A\'la', 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Layl', 'Ad-Duha',
    'Ash-Sharh', 'At-Tin', 'Al-Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat', 'Al-Qari\'ah', 'At-Takathur',
    'Al-Asr', 'Al-Humazah', 'Al-Fil', 'Quraysh', 'Al-Ma\'un', 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr', 'Al-Masad', 'Al-Ikhlas',
    'Al-Falaq', 'An-Nas'
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
      sabqiJuz: [exist?.sabqiJuz || 'Juz 1'],
      sabqiMistakes: [exist?.sabqiMistakes || 0, [Validators.min(0)]],
      manzilJuz: [exist?.manzilJuz || 'Para 1'],
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
      const record: Partial<StudentDailyProgress> = {
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
        
        // Form Values
        sabaqSurah: val.sabaqSurah,
        sabaqAyahFrom: val.sabaqAyahFrom,
        sabaqAyahTo: val.sabaqAyahTo,
        sabaqMistakes: Number(val.sabaqMistakes || 0),
        sabqiJuz: val.sabqiJuz,
        sabqiMistakes: Number(val.sabqiMistakes || 0),
        manzilJuz: val.manzilJuz,
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

  cancel(): void {
    this.dialogRef.close();
  }
}
