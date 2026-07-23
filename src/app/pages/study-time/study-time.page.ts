import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser, DutyRosterSlot, StudyTimeLog, StudyTimeSchedule } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { StudyTimeService } from '../../core/services/study-time.service';
import { LoaderService } from '../../core/services/loader.service';
import { StudyTimeScheduleDialogComponent } from './study-time-schedule-dialog.component';
import { StudyTimeLogDialogComponent } from './study-time-log-dialog.component';

@Component({
  selector: 'app-study-time',
  templateUrl: './study-time.page.html',
  styleUrls: ['./study-time.page.scss'],
  standalone: false
})
export class StudyTimePage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  activeTab: 'schedules' | 'roster' | 'logs' = 'schedules';
  searchQuery = '';

  private refresh$ = new BehaviorSubject<void>(undefined);
  schedules$: Observable<StudyTimeSchedule[]> = of([]);
  logs$: Observable<StudyTimeLog[]> = of([]);

  constructor(
    private auth: AuthService,
    private studyTimeService: StudyTimeService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.schedules$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.studyTimeService.listSchedules(user);
      }),
      catchError(err => {
        console.error('Error loading study time schedules:', err);
        return of([]);
      })
    );

    this.logs$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.studyTimeService.listLogs(user);
      }),
      catchError(err => {
        console.error('Error loading study time logs:', err);
        return of([]);
      })
    );
  }

  get stats$(): Observable<{ totalSchedules: number; turnDutyCount: number; fixedDutyCount: number; logsCount: number }> {
    return combineLatest([this.schedules$, this.logs$]).pipe(
      map(([schedules, logs]) => ({
        totalSchedules: schedules.length,
        turnDutyCount: schedules.filter(s => s.dutyType === 'turn_duty_roster').length,
        fixedDutyCount: schedules.filter(s => s.dutyType === 'single_staff').length,
        logsCount: logs.length,
      }))
    );
  }

  getTodayOnDutyStaff(schedule: StudyTimeSchedule): string {
    const todayStr = new Date().toISOString().split('T')[0];
    if (schedule.dutyType === 'turn_duty_roster' && schedule.dutyRoster && schedule.dutyRoster.length > 0) {
      const todaySlot = schedule.dutyRoster.find(r => r.date === todayStr);
      return todaySlot ? todaySlot.staffName : 'Turn Duty Pool (' + schedule.assignedStaffIds.length + ' staff)';
    }
    return 'Fixed Assigned Staff';
  }

  openAddSchedule(user: AppUser): void {
    const dialogRef = this.dialog.open(StudyTimeScheduleDialogComponent, {
      width: '650px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.studyTimeService.createSchedule(result, user);
          this.snackBar.open('Study time schedule created', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to create schedule', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  openEditSchedule(schedule: StudyTimeSchedule, user: AppUser): void {
    const dialogRef = this.dialog.open(StudyTimeScheduleDialogComponent, {
      width: '650px',
      data: { schedule, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result && schedule.id) {
        try {
          this.loader.show();
          await this.studyTimeService.updateSchedule(schedule.id, result, user);
          this.snackBar.open('Schedule updated', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to update schedule', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  openRecordLog(schedule: StudyTimeSchedule, user: AppUser): void {
    const defaultStaff = this.getTodayOnDutyStaff(schedule);
    const dialogRef = this.dialog.open(StudyTimeLogDialogComponent, {
      width: '600px',
      data: { schedule, user, defaultStaffName: defaultStaff }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.studyTimeService.createLog(result, user);
          this.snackBar.open('Supervision log recorded', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to record log', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async deleteSchedule(schedule: StudyTimeSchedule, user: AppUser): Promise<void> {
    if (!schedule.id || !confirm(`Delete schedule "${schedule.title}"?`)) return;
    try {
      this.loader.show();
      await this.studyTimeService.deleteSchedule(schedule.id, user);
      this.snackBar.open('Schedule deleted', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete schedule', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }
}
