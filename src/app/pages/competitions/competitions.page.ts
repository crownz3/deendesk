import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser, Competition, CompetitionStatus } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { CompetitionService } from '../../core/services/competition.service';
import { CompetitionDialogComponent } from './competition-dialog.component';
import { CompetitionParticipantsDialogComponent } from './competition-participants-dialog.component';
import { CompetitionExpensesDialogComponent } from './competition-expenses-dialog.component';
import { CompetitionReportsDialogComponent } from './competition-reports-dialog.component';

@Component({
  selector: 'app-competitions',
  templateUrl: './competitions.page.html',
  styleUrls: ['./competitions.page.scss'],
  standalone: false
})
export class CompetitionsPage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  searchQuery = '';
  statusFilter = 'all';
  categoryFilter = 'all';

  private refresh$ = new BehaviorSubject<void>(undefined);
  competitions$: Observable<Competition[]> = of([]);

  constructor(
    private auth: AuthService,
    private competitionService: CompetitionService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.competitions$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.competitionService.listCompetitions(user);
      }),
      catchError((err) => {
        console.error('Error loading competitions:', err);
        this.snackBar.open('Failed to load competitions', 'Close', { duration: 3000 });
        return of([]);
      })
    );
  }

  get filteredCompetitions$(): Observable<Competition[]> {
    return this.competitions$.pipe(
      map((list) => {
        const query = this.searchQuery.toLowerCase().trim();
        return list.filter((item) => {
          const matchQuery =
            !query ||
            item.title.toLowerCase().includes(query) ||
            item.venue.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            (item.targetAudience && item.targetAudience.toLowerCase().includes(query));
          const matchStatus = this.statusFilter === 'all' || item.status === this.statusFilter;
          const matchCategory = this.categoryFilter === 'all' || item.category === this.categoryFilter;
          return matchQuery && matchStatus && matchCategory;
        });
      })
    );
  }

  openCompetitionDialog(competition?: Competition): void {
    const dialogRef = this.dialog.open(CompetitionDialogComponent, {
      width: '850px',
      maxWidth: '95vw',
      data: { competition },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.refresh$.next();
      }
    });
  }

  openParticipantsDialog(competition: Competition): void {
    this.dialog.open(CompetitionParticipantsDialogComponent, {
      width: '950px',
      maxWidth: '98vw',
      data: { competition },
    });
  }

  openExpensesDialog(competition: Competition): void {
    const dialogRef = this.dialog.open(CompetitionExpensesDialogComponent, {
      width: '850px',
      maxWidth: '95vw',
      data: { competition },
    });

    dialogRef.afterClosed().subscribe(() => {
      this.refresh$.next();
    });
  }

  openReportsDialog(competition: Competition): void {
    this.dialog.open(CompetitionReportsDialogComponent, {
      width: '1000px',
      maxWidth: '98vw',
      data: { competition },
    });
  }

  async updateStatus(competition: Competition, status: CompetitionStatus): Promise<void> {
    const currentUser = await firstValueFrom(this.profile$);
    if (!currentUser) return;

    try {
      await this.competitionService.updateCompetition(competition.id!, { status }, currentUser);
      this.snackBar.open(`Competition status updated to ${status}`, 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to update status', 'Close', { duration: 3000 });
    }
  }

  async deleteCompetition(competition: Competition): Promise<void> {
    if (!confirm(`Are you sure you want to delete competition "${competition.title}"?`)) return;

    const currentUser = await firstValueFrom(this.profile$);
    if (!currentUser) return;

    try {
      await this.competitionService.deleteCompetition(competition.id!, currentUser);
      this.snackBar.open('Competition deleted successfully', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete competition', 'Close', { duration: 3000 });
    }
  }

  getStatusBadgeClass(status: CompetitionStatus): string {
    switch (status) {
      case 'upcoming':
        return 'badge-primary';
      case 'ongoing':
        return 'badge-warning';
      case 'completed':
        return 'badge-success';
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }
}
