import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { NotificationItem } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface NotificationsVm {
  profile: any;
  notifications: (NotificationItem & EntityRecord)[];
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage {
  readonly vm$ = this.auth.profile$.pipe(
    switchMap((profile) => combineLatest({
      profile: of(profile),
      notifications: this.repo.list<NotificationItem & EntityRecord>('notifications', profile),
    }).pipe(
      map((data): PageState<NotificationsVm> => ({
        data,
        loading: false,
      })),
      startWith({ loading: true } as PageState<NotificationsVm>),
      catchError((err) => {
        console.error(err);
        return of({
          loading: false,
          error: 'Something went wrong while loading this page. Please try again.',
        } as PageState<NotificationsVm>);
      })
    )),
  );

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
  ) {}

  trackById(_: number, item: EntityRecord): string {
    return String(item.id);
  }

  isRead(item: NotificationItem, uid: string | undefined): boolean {
    return Boolean(uid && item.readBy.includes(uid));
  }

  createdAtDate(item: NotificationItem & EntityRecord): Date | string | number | null {
    const val = item.createdAt as any;
    if (val && typeof val.toDate === 'function') {
      return val.toDate();
    }
    return val as Date | string | number | null;
  }

  async markRead(item: NotificationItem & EntityRecord, uid: string | undefined): Promise<void> {
    if (!item.id || !uid) {
      return;
    }

    try {
      await this.loader.withLoader('Marking notification as read...', async () => {
        await this.repo.update('notifications', item.id!, {
          readBy: Array.from(new Set([...item.readBy, uid])),
        }, null);
      });
      this.snackBar.open('Notification marked as read.', 'Close', { duration: 2500 });
    } catch (e) {
      this.snackBar.open('Unable to update notification.', 'Close', { duration: 2500 });
    }
  }
}
