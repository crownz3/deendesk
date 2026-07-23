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
  searchQuery = '';
  statusFilter = 'all';
  typeFilter = 'all';

  private refresh$ = new BehaviorSubject<void>(undefined);
  exams$: Observable<Exam[]> = of([]);

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
  }

  get filteredExams$(): Observable<Exam[]> {
    return this.exams$.pipe(
      map((list) => {
        const query = this.searchQuery.toLowerCase().trim();
        return list.filter((item) => {
          const matchQuery =
            !query ||
            item.title.toLowerCase().includes(query) ||
            item.academicYear.toLowerCase().includes(query) ||
            (item.targetCourseName && item.targetCourseName.toLowerCase().includes(query)) ||
            (item.targetStage && item.targetStage.toLowerCase().includes(query));
          const matchStatus = this.statusFilter === 'all' || item.status === this.statusFilter;
          const matchType = this.typeFilter === 'all' || item.examType === this.typeFilter;
          return matchQuery && matchStatus && matchType;
        });
      })
    );
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
