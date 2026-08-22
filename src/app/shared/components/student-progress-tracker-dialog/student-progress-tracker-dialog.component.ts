import { Component, Inject, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Chart, registerables } from 'chart.js';
import { DEFAULT_STAGES_BY_COURSE_TYPE } from '../../../core/constants/defaults';
import { EntityRecord } from '../../../core/services/repository.service';

Chart.register(...registerables);

export interface StudentProgressTrackerDialogData {
  student: EntityRecord;
}

export interface CourseProgressDetail {
  courseName: string;
  courseType: string;
  currentStage: string;
  completedStagesCount: number;
  totalStagesCount: number;
  progressPercent: number;
  stagesList: string[];
}

export interface TrajectoryEvent {
  date: string;
  type: 'promotion' | 'demotion' | 'stage_update' | 'enrollment';
  title: string;
  fromStage: string;
  toStage: string;
  conductedBy: string;
  notes: string;
}

export interface HifzRangeMastery {
  juzNumber: number;
  surahName: string;
  ayahRange: string;
  status: 'strong' | 'moderate' | 'weak';
  scorePercent: number;
  lastTestedDate: string;
  mistakesCount: number;
  teacherNotes: string;
}

@Component({
  selector: 'app-student-progress-tracker-dialog',
  templateUrl: './student-progress-tracker-dialog.component.html',
  styleUrls: ['./student-progress-tracker-dialog.component.scss'],
  standalone: false,
})
export class StudentProgressTrackerDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  student: EntityRecord;
  activeTab: 'overview' | 'courses' | 'trajectory' | 'analytics' | 'hifz-analytics' = 'overview';

  @ViewChild('attendanceCanvas') attendanceCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('skillsCanvas') skillsCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hifzDoughnutCanvas') hifzDoughnutCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hifzBarCanvas') hifzBarCanvas?: ElementRef<HTMLCanvasElement>;

  private attendanceChart?: Chart;
  private skillsChart?: Chart;
  private hifzDoughnutChart?: Chart;
  private hifzBarChart?: Chart;

  // Metrics
  overallProgressPercent = 0;
  attendancePercent = 94;
  quizScorePercent = 88;
  totalPromotionsCount = 3;
  totalDemotionsCount = 0;

  courseDetails: CourseProgressDetail[] = [];
  trajectoryEvents: TrajectoryEvent[] = [];
  monthlyAttendance: { month: string; percent: number }[] = [];
  hifzRanges: HifzRangeMastery[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StudentProgressTrackerDialogData,
    public dialogRef: MatDialogRef<StudentProgressTrackerDialogComponent>
  ) {
    this.student = data.student || {};
  }

  ngOnInit(): void {
    this.buildCourseProgressDetails();
    this.buildTrajectoryEvents();
    this.buildMonthlyAttendance();
    this.buildHifzRanges();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  setTab(tab: 'overview' | 'courses' | 'trajectory' | 'analytics' | 'hifz-analytics'): void {
    this.activeTab = tab;
    if (['analytics', 'overview', 'hifz-analytics'].includes(tab)) {
      setTimeout(() => {
        this.initCharts();
      }, 100);
    }
  }

  get strongHifzRangesCount(): number {
    return this.hifzRanges.filter(r => r.status === 'strong').length;
  }

  get moderateHifzRangesCount(): number {
    return this.hifzRanges.filter(r => r.status === 'moderate').length;
  }

  get weakHifzRangesCount(): number {
    return this.hifzRanges.filter(r => r.status === 'weak').length;
  }

  private initCharts(): void {
    this.destroyCharts();

    // 1. Attendance Line Chart
    if (this.attendanceCanvas && this.attendanceCanvas.nativeElement) {
      const ctx = this.attendanceCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.attendanceChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            datasets: [{
              label: 'Monthly Attendance %',
              data: [96, 92, 98, 94, 95, 97],
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#0284c7',
              pointRadius: 5,
              pointHoverRadius: 7
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `Attendance: ${ctx.raw}%`
                }
              }
            },
            scales: {
              y: {
                min: 80,
                max: 100,
                ticks: {
                  callback: (val) => `${val}%`
                }
              }
            }
          }
        });
      }
    }

    // 2. Skills Radar / Bar Chart
    if (this.skillsCanvas && this.skillsCanvas.nativeElement) {
      const ctx = this.skillsCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.skillsChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Tajweed & Fluency', 'Quran Revision', 'Hadith & Sunnah', 'Fiqh Assessment', 'Academic Grade', 'Discipline & Morals'],
            datasets: [{
              label: 'Press & Competency Score %',
              data: [95, 88, 92, 90, 94, 96],
              backgroundColor: [
                'rgba(2, 132, 199, 0.85)',
                'rgba(14, 165, 233, 0.85)',
                'rgba(16, 185, 129, 0.85)',
                'rgba(139, 92, 246, 0.85)',
                'rgba(245, 158, 11, 0.85)',
                'rgba(236, 72, 153, 0.85)'
              ],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `Score: ${ctx.raw}%`
                }
              }
            },
            scales: {
              x: {
                min: 0,
                max: 100,
                ticks: {
                  callback: (val) => `${val}%`
                }
              }
            }
          }
        });
      }
    }

    // 3. Hifz Range Doughnut Chart (Strong vs Moderate vs Weak Ratio)
    if (this.hifzDoughnutCanvas && this.hifzDoughnutCanvas.nativeElement) {
      const ctx = this.hifzDoughnutCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.hifzDoughnutChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Strong / Mutqan', 'Moderate / Revision', 'Weak / Focus Needed'],
            datasets: [{
              data: [this.strongHifzRangesCount, this.moderateHifzRangesCount, this.weakHifzRangesCount],
              backgroundColor: ['#16a34a', '#f59e0b', '#dc2626'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, padding: 14 }
              }
            }
          }
        });
      }
    }

    // 4. Hifz Juz Strength Bar Chart
    if (this.hifzBarCanvas && this.hifzBarCanvas.nativeElement) {
      const ctx = this.hifzBarCanvas.nativeElement.getContext('2d');
      if (ctx) {
        const topRanges = this.hifzRanges.slice(0, 10);
        this.hifzBarChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: topRanges.map(r => `Juz ${r.juzNumber}`),
            datasets: [{
              label: 'Fluency Score %',
              data: topRanges.map(r => r.scorePercent),
              backgroundColor: topRanges.map(r => r.status === 'strong' ? '#16a34a' : (r.status === 'moderate' ? '#f59e0b' : '#dc2626')),
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `Fluency: ${ctx.raw}%`
                }
              }
            },
            scales: {
              y: {
                min: 50,
                max: 100,
                ticks: {
                  callback: (val) => `${val}%`
                }
              }
            }
          }
        });
      }
    }
  }

  private destroyCharts(): void {
    if (this.attendanceChart) {
      this.attendanceChart.destroy();
      this.attendanceChart = undefined;
    }
    if (this.skillsChart) {
      this.skillsChart.destroy();
      this.skillsChart = undefined;
    }
    if (this.hifzDoughnutChart) {
      this.hifzDoughnutChart.destroy();
      this.hifzDoughnutChart = undefined;
    }
    if (this.hifzBarChart) {
      this.hifzBarChart.destroy();
      this.hifzBarChart = undefined;
    }
  }

  private buildHifzRanges(): void {
    this.hifzRanges = [
      { juzNumber: 1, surahName: 'Al-Baqarah', ayahRange: 'Ayah 1 - 141', status: 'strong', scorePercent: 98, lastTestedDate: '2026-08-15', mistakesCount: 0, teacherNotes: 'Perfect fluency and tajweed.' },
      { juzNumber: 2, surahName: 'Al-Baqarah', ayahRange: 'Ayah 142 - 252', status: 'strong', scorePercent: 95, lastTestedDate: '2026-08-12', mistakesCount: 1, teacherNotes: 'Excellent recitation, minor ghunnah pause.' },
      { juzNumber: 3, surahName: 'Al-Baqarah & Ali Imran', ayahRange: 'Ayah 253 - Ali Imran 92', status: 'strong', scorePercent: 92, lastTestedDate: '2026-08-08', mistakesCount: 1, teacherNotes: 'Very clear makharij.' },
      { juzNumber: 4, surahName: 'Ali Imran & An-Nisa', ayahRange: 'Ayah 93 - An-Nisa 23', status: 'strong', scorePercent: 94, lastTestedDate: '2026-08-02', mistakesCount: 0, teacherNotes: 'Strong memorization.' },
      { juzNumber: 5, surahName: 'An-Nisa', ayahRange: 'Ayah 24 - 147', status: 'moderate', scorePercent: 84, lastTestedDate: '2026-07-28', mistakesCount: 3, teacherNotes: 'Requires light Sabqi revision on Ayah 80-100.' },
      { juzNumber: 6, surahName: 'An-Nisa & Al-Maidah', ayahRange: 'Ayah 148 - Al-Maidah 81', status: 'moderate', scorePercent: 82, lastTestedDate: '2026-07-20', mistakesCount: 3, teacherNotes: 'Needs focus on waqf & ibtida.' },
      { juzNumber: 7, surahName: 'Al-Maidah & Al-Anam', ayahRange: 'Ayah 82 - Al-Anam 110', status: 'strong', scorePercent: 91, lastTestedDate: '2026-07-14', mistakesCount: 1, teacherNotes: 'Good pace and confidence.' },
      { juzNumber: 8, surahName: 'Al-Anam & Al-Araf', ayahRange: 'Ayah 111 - Al-Araf 87', status: 'strong', scorePercent: 90, lastTestedDate: '2026-07-05', mistakesCount: 1, teacherNotes: 'Solid recitation.' },
      { juzNumber: 9, surahName: 'Al-Araf & Al-Anfal', ayahRange: 'Ayah 88 - Al-Anfal 40', status: 'moderate', scorePercent: 86, lastTestedDate: '2026-06-25', mistakesCount: 2, teacherNotes: 'Slight hesitate on mutashabihat.' },
      { juzNumber: 10, surahName: 'Al-Anfal & At-Tawbah', ayahRange: 'Ayah 41 - At-Tawbah 92', status: 'strong', scorePercent: 93, lastTestedDate: '2026-06-18', mistakesCount: 0, teacherNotes: 'High precision.' },
      { juzNumber: 11, surahName: 'At-Tawbah & Yunus', ayahRange: 'Ayah 93 - Yunus 109', status: 'weak', scorePercent: 68, lastTestedDate: '2026-08-18', mistakesCount: 5, teacherNotes: '🔴 WEAK FOCUS AREA: Surah Yunus Ayah 1-50 needs 3x daily repeat.' },
      { juzNumber: 12, surahName: 'Hud & Yusuf', ayahRange: 'Ayah 6 - Yusuf 52', status: 'weak', scorePercent: 64, lastTestedDate: '2026-08-19', mistakesCount: 6, teacherNotes: '🔴 WEAK FOCUS AREA: Surah Yusuf Ayah 1-52 assigned for Manzil practice.' },
      { juzNumber: 13, surahName: 'Yusuf & Ibrahim', ayahRange: 'Ayah 53 - Ibrahim 52', status: 'moderate', scorePercent: 85, lastTestedDate: '2026-08-01', mistakesCount: 2, teacherNotes: 'Improving well.' },
      { juzNumber: 14, surahName: 'Al-Hijr & An-Nahl', ayahRange: 'Ayah 1 - An-Nahl 128', status: 'strong', scorePercent: 92, lastTestedDate: '2026-08-10', mistakesCount: 1, teacherNotes: 'Passed latest promotion exam.' },
      { juzNumber: 15, surahName: 'Al-Isra & Al-Kahf', ayahRange: 'Ayah 1 - Al-Kahf 74', status: 'strong', scorePercent: 89, lastTestedDate: '2026-08-20', mistakesCount: 1, teacherNotes: 'Currently being completed.' },
      { juzNumber: 30, surahName: 'Juz Amma (Al-Naba - An-Nas)', ayahRange: 'All Surahs', status: 'strong', scorePercent: 100, lastTestedDate: '2026-08-01', mistakesCount: 0, teacherNotes: '100% Perfect Mutqan.' }
    ];
  }

  get studentName(): string {
    return this.student['displayName'] || this.student['name'] || this.student['studentName'] || 'Student';
  }

  get studentCode(): string {
    return this.student['code'] || this.student['rollNumber'] || this.student['studentId'] || this.student.id || 'N/A';
  }

  get studentGender(): string {
    return this.student['gender'] ? String(this.student['gender']).toLowerCase() : 'male';
  }

  get studentStatus(): string {
    return this.student['status'] || this.student['state'] || 'Active';
  }

  get mainCourseName(): string {
    return this.student['courseName'] || this.student['course'] || 'Islamic & Hifz Studies';
  }

  get currentStageName(): string {
    return this.student['stage'] || this.student['currentStage'] || 'Juz 15 (Hifz Stage 15)';
  }

  get madrasaName(): string {
    return this.student['madrasaName'] || this.student['madrasa'] || 'Deendesk Central Campus';
  }

  get className(): string {
    return this.student['className'] || this.student['class'] || 'Grade 5 / Group A';
  }

  private buildCourseProgressDetails(): void {
    const rawCourse = String(this.student['courseName'] || this.student['course'] || 'Hifz').toLowerCase();
    
    // Course 1: Hifz / Quranic Studies
    const hifzStages = DEFAULT_STAGES_BY_COURSE_TYPE['Hifz / Memorization'] || [];
    const currentHifzIdx = 14; // Juz 15
    const hifzPercent = Math.round(((currentHifzIdx + 1) / hifzStages.length) * 100);

    this.courseDetails.push({
      courseName: 'Tahfeez-ul-Quran (Hifz)',
      courseType: 'Hifz / Memorization',
      currentStage: hifzStages[currentHifzIdx] || 'Juz 15',
      completedStagesCount: currentHifzIdx + 1,
      totalStagesCount: hifzStages.length,
      progressPercent: hifzPercent,
      stagesList: hifzStages
    });

    // Course 2: Islamic Studies / Alim Course
    const alimStages = DEFAULT_STAGES_BY_COURSE_TYPE['Alim / Islamic Studies'] || [];
    const currentAlimIdx = 2; // Year 3
    const alimPercent = Math.round(((currentAlimIdx + 1) / alimStages.length) * 100);

    this.courseDetails.push({
      courseName: 'Alimiyyah & Islamic Sciences',
      courseType: 'Alim / Islamic Studies',
      currentStage: alimStages[currentAlimIdx] || 'Year 3 (Third Year)',
      completedStagesCount: currentAlimIdx + 1,
      totalStagesCount: alimStages.length,
      progressPercent: alimPercent,
      stagesList: alimStages
    });

    // Course 3: Primary Academic Curriculum
    const primaryStages = DEFAULT_STAGES_BY_COURSE_TYPE['Primary Education'] || [];
    const currentPrimaryIdx = 4; // Grade 5
    const primaryPercent = Math.round(((currentPrimaryIdx + 1) / primaryStages.length) * 100);

    this.courseDetails.push({
      courseName: 'Standard Primary Academic',
      courseType: 'Primary Education',
      currentStage: primaryStages[currentPrimaryIdx] || 'Grade 5 (Standard V)',
      completedStagesCount: currentPrimaryIdx + 1,
      totalStagesCount: primaryStages.length,
      progressPercent: primaryPercent,
      stagesList: primaryStages
    });

    // Overall average
    const totalPerc = this.courseDetails.reduce((sum, c) => sum + c.progressPercent, 0);
    this.overallProgressPercent = Math.round(totalPerc / this.courseDetails.length);
  }

  private buildTrajectoryEvents(): void {
    this.trajectoryEvents = [
      {
        date: '2026-08-10',
        type: 'promotion',
        title: 'Promoted to Juz 15 (Hifz Stage 15)',
        fromStage: 'Juz 14',
        toStage: 'Juz 15',
        conductedBy: 'Ustadh Hafiz Ahmed',
        notes: 'Passed oral evaluation with 95% fluency and tajweed excellence.'
      },
      {
        date: '2026-05-18',
        type: 'promotion',
        title: 'Advanced to Alim Year 3',
        fromStage: 'Year 2 (Second Year)',
        toStage: 'Year 3 (Third Year)',
        conductedBy: 'Maulana Usama',
        notes: 'Completed Fiqh and Hadith exams with Distinction.'
      },
      {
        date: '2026-02-04',
        type: 'stage_update',
        title: 'Promoted to Grade 5 Primary Academic',
        fromStage: 'Grade 4',
        toStage: 'Grade 5',
        conductedBy: 'Academic Supervisor',
        notes: 'Annual examination results: 92% aggregate.'
      },
      {
        date: '2025-06-15',
        type: 'enrollment',
        title: 'Initial Admission & Enrollment',
        fromStage: 'N/A',
        toStage: 'Juz 1 / Grade 1',
        conductedBy: 'Madrasa Administration',
        notes: 'Enrolled into Tahfeez and Academic Dual Program.'
      }
    ];
  }

  private buildMonthlyAttendance(): void {
    this.monthlyAttendance = [
      { month: 'Mar', percent: 96 },
      { month: 'Apr', percent: 92 },
      { month: 'May', percent: 98 },
      { month: 'Jun', percent: 94 },
      { month: 'Jul', percent: 95 },
      { month: 'Aug', percent: 97 }
    ];
  }

  close(): void {
    this.dialogRef.close();
  }
}
