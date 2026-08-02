import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Announcement, AnnouncementPriority, AnnouncementTargetScope, AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AnnouncementDialogComponent } from './announcement-dialog.component';
import { AnnouncementDetailsDialogComponent } from './announcement-details-dialog.component';

@Component({
  selector: 'app-announcements',
  templateUrl: './announcements.page.html',
  styleUrls: ['./announcements.page.scss'],
  standalone: false,
})
export class AnnouncementsPage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly scopeFilter$ = new BehaviorSubject<string>('all');
  readonly priorityFilter$ = new BehaviorSubject<string>('all');

  searchQuery = '';
  scopeFilter = 'all';
  priorityFilter = 'all';

  private refresh$ = new BehaviorSubject<void>(undefined);
  announcements$: Observable<Announcement[]> = of([]);
  filteredAnnouncements$: Observable<Announcement[]> = of([]);

  constructor(
    private auth: AuthService,
    public announcementService: AnnouncementService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.announcements$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.announcementService.listAnnouncements(user);
      }),
      catchError((err) => {
        console.error('Error loading announcements:', err);
        this.snackBar.open('Failed to load announcements', 'Close', { duration: 3000 });
        return of([]);
      })
    );

    this.filteredAnnouncements$ = combineLatest([
      this.announcements$,
      this.searchQuery$,
      this.scopeFilter$,
      this.priorityFilter$
    ]).pipe(
      map(([list, search, scope, priority]) => {
        const query = search.toLowerCase().trim();
        return list.filter((item) => {
          const matchQuery =
            !query ||
            item.title.toLowerCase().includes(query) ||
            item.content.toLowerCase().includes(query) ||
            (item.publishedByName && item.publishedByName.toLowerCase().includes(query));
          const matchScope = scope === 'all' || item.targetScope === scope;
          const matchPriority = priority === 'all' || item.priority === priority;
          return matchQuery && matchScope && matchPriority;
        });
      })
    );
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchQuery$.next(val);
  }

  onScopeChange(val: string) {
    this.scopeFilter = val;
    this.scopeFilter$.next(val);
  }

  onPriorityChange(val: string) {
    this.priorityFilter = val;
    this.priorityFilter$.next(val);
  }

  openAnnouncementDialog(announcement?: Announcement): void {
    const dialogRef = this.dialog.open(AnnouncementDialogComponent, {
      width: '750px',
      maxWidth: '95vw',
      data: { announcement },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.refresh$.next();
      }
    });
  }

  openDetailsDialog(announcement: Announcement): void {
    this.dialog.open(AnnouncementDetailsDialogComponent, {
      width: '650px',
      maxWidth: '95vw',
      data: { announcement },
    });
  }

  async togglePublishStatus(announcement: Announcement): Promise<void> {
    const currentUser = await firstValueFrom(this.profile$);
    if (!currentUser) return;

    const newStatus = !announcement.isPublished;

    try {
      await this.announcementService.updateAnnouncement(
        announcement.id!,
        {
          isPublished: newStatus,
          publishedAt: newStatus ? new Date() : undefined,
        },
        currentUser
      );
      this.snackBar.open(
        newStatus ? 'Announcement published & notifications dispatched!' : 'Announcement un-published',
        'Close',
        { duration: 3000 }
      );
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to update announcement status', 'Close', { duration: 3000 });
    }
  }

  async deleteAnnouncement(announcement: Announcement): Promise<void> {
    if (!confirm(`Are you sure you want to delete announcement "${announcement.title}"?`)) return;

    const currentUser = await firstValueFrom(this.profile$);
    if (!currentUser) return;

    try {
      await this.announcementService.deleteAnnouncement(announcement.id!, currentUser);
      this.snackBar.open('Announcement deleted successfully', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete announcement', 'Close', { duration: 3000 });
    }
  }

  getPriorityBadgeClass(priority: AnnouncementPriority): string {
    switch (priority) {
      case 'urgent':
        return 'badge-urgent';
      case 'important':
        return 'badge-important';
      default:
        return 'badge-normal';
    }
  }

  hasManagePermission(user: AppUser): boolean {
    if (!user) return false;
    if (user.role === 'superAdmin' || user.role === 'organizationAdmin') return true;
    return user.permissions?.includes('manageAnnouncements') || false;
  }
}
