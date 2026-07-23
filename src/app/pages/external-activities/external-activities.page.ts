import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser, ExternalActivity, ExternalActivityType } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ExternalActivityService } from '../../core/services/external-activity.service';
import { LoaderService } from '../../core/services/loader.service';
import { ExternalActivityFormDialogComponent } from './external-activity-form-dialog.component';

@Component({
  selector: 'app-external-activities',
  templateUrl: './external-activities.page.html',
  styleUrls: ['./external-activities.page.scss'],
  standalone: false
})
export class ExternalActivitiesPage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  searchQuery = '';
  typeFilter = 'all';
  statusFilter = 'all';
  personTypeFilter = 'all';

  private refresh$ = new BehaviorSubject<void>(undefined);
  activities$: Observable<ExternalActivity[]> = of([]);

  constructor(
    private auth: AuthService,
    private activityService: ExternalActivityService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.activities$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.activityService.listActivities(user);
      }),
      catchError(err => {
        console.error('Error loading external activities:', err);
        this.snackBar.open('Failed to load external activities', 'Close', { duration: 3000 });
        return of([]);
      })
    );
  }

  get filteredActivities$(): Observable<ExternalActivity[]> {
    return this.activities$.pipe(
      map(list => {
        const query = this.searchQuery.toLowerCase().trim();
        return list.filter(item => {
          const matchQuery = !query || 
            item.title.toLowerCase().includes(query) ||
            item.personName.toLowerCase().includes(query) ||
            item.organizationName.toLowerCase().includes(query) ||
            (item.location && item.location.toLowerCase().includes(query));
          const matchType = this.typeFilter === 'all' || item.activityType === this.typeFilter;
          const matchStatus = this.statusFilter === 'all' || item.activityStatus === this.statusFilter;
          const matchPersonType = this.personTypeFilter === 'all' || item.personType === this.personTypeFilter;
          return matchQuery && matchType && matchStatus && matchPersonType;
        });
      })
    );
  }

  get stats$(): Observable<{ total: number; imamCount: number; ustadhCount: number; serviceCount: number; activeCount: number }> {
    return this.activities$.pipe(
      map(list => ({
        total: list.length,
        imamCount: list.filter(a => a.activityType === 'imam').length,
        ustadhCount: list.filter(a => a.activityType === 'outside_ustadh').length,
        serviceCount: list.filter(a => a.activityType === 'inside_madrasa_service').length,
        activeCount: list.filter(a => a.activityStatus === 'active').length,
      }))
    );
  }

  getActivityTypeLabel(type: ExternalActivityType): string {
    switch (type) {
      case 'imam': return 'Imam at Mosque';
      case 'outside_ustadh': return 'Outside Ustadh / Teacher';
      case 'inside_madrasa_service': return 'Inside Madrasa Service';
      case 'part_time_work': return 'Part-time Work';
      case 'community_service': return 'Community / Dawah';
      default: return 'Other';
    }
  }

  async openAddDialog(user: AppUser): Promise<void> {
    const dialogRef = this.dialog.open(ExternalActivityFormDialogComponent, {
      width: '650px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.activityService.createActivity(result, user);
          this.snackBar.open('External activity added successfully', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (error) {
          console.error(error);
          this.snackBar.open('Error adding external activity', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async openEditDialog(activity: ExternalActivity, user: AppUser): Promise<void> {
    const dialogRef = this.dialog.open(ExternalActivityFormDialogComponent, {
      width: '650px',
      data: { activity, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result && activity.id) {
        try {
          this.loader.show();
          await this.activityService.updateActivity(activity.id, result, user);
          this.snackBar.open('External activity updated successfully', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (error) {
          console.error(error);
          this.snackBar.open('Error updating external activity', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async deleteActivity(activity: ExternalActivity, user: AppUser): Promise<void> {
    if (!activity.id || !confirm(`Delete external activity "${activity.title}"?`)) return;
    try {
      this.loader.show();
      await this.activityService.deleteActivity(activity.id, user);
      this.snackBar.open('Activity deleted', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (error) {
      console.error(error);
      this.snackBar.open('Error deleting activity', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }
}
