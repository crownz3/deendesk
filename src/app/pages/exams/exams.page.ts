import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser, Exam, ExamStatus } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ExamService } from '../../core/services/exam.service';
import { ExamDialogComponent } from './exam-dialog.component';
import { ExamMarksDialogComponent } from './exam-marks-dialog.component';
import { ReExamDialogComponent } from './re-exam-dialog.component';
import { ExamReportsDialogComponent } from './exam-reports-dialog.component';

@Component({
  selector: 'app-exams',
  templateUrl: './exams.page.html',
  styleUrls: ['./exams.page.scss'],
  standalone: false
})
export class ExamsPage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly statusFilter$ = new BehaviorSubject<string>('all');
  readonly typeFilter$ = new BehaviorSubject<string>('all');

  searchQuery = '';
  statusFilter = 'all';
  typeFilter = 'all';

  private refresh$ = new BehaviorSubject<void>(undefined);
  exams$: Observable<Exam[]> = of([]);
  filteredExams$: Observable<Exam[]> = of([]);

  constructor(
    private auth: AuthService,
    private examService: ExamService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.exams$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.examService.listExams(user);
      }),
      catchError((err) => {
        console.error('Error loading exams:', err);
        this.snackBar.open('Failed to load exams', 'Close', { duration: 3000 });
        return of([]);
      })
    );

    this.filteredExams$ = combineLatest([
      this.exams$,
      this.searchQuery$,
      this.statusFilter$,
      this.typeFilter$
    ]).pipe(
      map(([list, search, status, type]) => {
        const query = search.toLowerCase().trim();
        return list.filter((item) => {
          const matchQuery =
            !query ||
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.academicYear && item.academicYear.toLowerCase().includes(query)) ||
            (item.targetCourseName && item.targetCourseName.toLowerCase().includes(query)) ||
            (item.targetStage && item.targetStage.toLowerCase().includes(query));
          const matchStatus = status === 'all' || item.status === status;
          const matchType = type === 'all' || item.examType === type;
          return matchQuery && matchStatus && matchType;
        });
      })
    );
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchQuery$.next(val);
  }

  onStatusChange(val: string) {
    this.statusFilter = val;
    this.statusFilter$.next(val);
  }

  onTypeChange(val: string) {
    this.typeFilter = val;
    this.typeFilter$.next(val);
  }

  openExamDialog(exam?: Exam): void {
    const dialogRef = this.dialog.open(ExamDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      data: { exam },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.refresh$.next();
      }
    });
  }

  openMarksDialog(exam: Exam): void {
    this.dialog.open(ExamMarksDialogComponent, {
      width: '950px',
      maxWidth: '98vw',
      data: { exam },
    });
  }

  openReExamDialog(exam: Exam): void {
    this.dialog.open(ReExamDialogComponent, {
      width: '850px',
      maxWidth: '95vw',
      data: { exam },
    });
  }

  openReportsDialog(exam: Exam): void {
    this.dialog.open(ExamReportsDialogComponent, {
      width: '1000px',
      maxWidth: '98vw',
      data: { exam },
    });
  }

  async updateStatus(exam: Exam, newStatus: ExamStatus): Promise<void> {
    const currentUser = await firstValueFrom(this.profile$);
    if (!currentUser) return;

    try {
      await this.examService.updateExamStatus(exam.id!, newStatus, currentUser);
      this.snackBar.open(`Exam status updated to ${newStatus}`, 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to update exam status', 'Close', { duration: 3000 });
    }
  }

  async deleteExam(exam: Exam): Promise<void> {
    if (!confirm(`Are you sure you want to delete exam "${exam.title}"?`)) return;

    const currentUser = await firstValueFrom(this.profile$);
    if (!currentUser) return;

    try {
      await this.examService.deleteExam(exam.id!, currentUser);
      this.snackBar.open('Exam deleted successfully', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete exam', 'Close', { duration: 3000 });
    }
  }

  getStatusBadgeClass(status: ExamStatus): string {
    switch (status) {
      case 'draft':
        return 'badge-secondary';
      case 'scheduled':
        return 'badge-primary';
      case 'in_progress':
        return 'badge-warning';
      case 'evaluating':
        return 'badge-info';
      case 'published':
      case 'completed':
        return 'badge-success';
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }
}
