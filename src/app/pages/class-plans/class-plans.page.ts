import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subscription, catchError, combineLatest, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { AppUser, ClassPlan, ClassPlanAttendance, ClassPlanException } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { ClassPlanAttendanceService } from '../../core/services/class-plan-attendance.service';
import { ClassPlanFormDialogComponent } from './class-plan-form-dialog.component';
import { ClassPlanExceptionDialogComponent } from './class-plan-exception-dialog.component';
import { ClassPlanTimetableDialogComponent } from './class-plan-timetable-dialog.component';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface ClassPlansVm {
  profile: AppUser | null;
  classPlans: ClassPlan[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  exceptions: (EntityRecord & ClassPlanException)[];
}

@Component({
  selector: 'app-class-plans',
  templateUrl: './class-plans.page.html',
  styleUrls: ['./class-plans.page.scss'],
  standalone: false,
})
export class ClassPlansPage implements OnInit, OnDestroy {
  readonly vm$: Observable<PageState<ClassPlansVm>>;
  
  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly attendanceService: ClassPlanAttendanceService,
  ) {
    this.vm$ = this.auth.profile$.pipe(
      switchMap((profile) => {
        if (!profile) return of({ loading: false, data: { profile: null, classPlans: [], madrasas: [], courses: [], classes: [], exceptions: [] } });
        
        return combineLatest({
          classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile),
          madrasas: this.repo.list<EntityRecord>('madrasas', profile),
          courses: this.repo.list<EntityRecord>('courses', profile),
          classes: this.repo.list<EntityRecord>('classes', profile),
          exceptions: this.repo.list<EntityRecord & ClassPlanException>('classPlanExceptions', profile),
        }).pipe(
          map((data): PageState<ClassPlansVm> => ({
            data: { profile, ...data },
            loading: false,
          })),
          startWith({ loading: true } as PageState<ClassPlansVm>),
          catchError((err) => {
            console.error(err);
            return of({
              loading: false,
              error: 'Something went wrong while loading this page. Please try again.',
            } as PageState<ClassPlansVm>);
          })
        );
      }),
      shareReplay(1)
    );
  }

  ngOnInit() {}
  ngOnDestroy() {}

  nameOf(rows: EntityRecord[], id: string): string {
    return String(rows.find((row) => row.id === id)?.['name'] ?? id);
  }

  getPlanExceptions(planId: string, exceptions: (EntityRecord & ClassPlanException)[]): (EntityRecord & ClassPlanException)[] {
    return exceptions?.filter(e => e.classPlanId === planId) || [];
  }

  openForm(plan?: ClassPlan): void {
    this.dialog.open(ClassPlanFormDialogComponent, {
      width: '600px',
      data: { plan }
    });
  }

  openExceptionForm(plan: ClassPlan): void {
    this.dialog.open(ClassPlanExceptionDialogComponent, {
      width: '500px',
      data: { plan }
    });
  }

  openTimetable(plan: ClassPlan, profile?: AppUser | null): void {
    this.dialog.open(ClassPlanTimetableDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      data: { plan, canManage: this.canManage(profile) }
    });
  }

  async generateAttendance(plan: ClassPlan, profile: AppUser): Promise<void> {
    await this.loader.withLoader('Generating attendance...', async () => {
      try {
        const today = new Date();
        await this.attendanceService.generateAttendanceForPlanDate(plan, today, profile);
        this.snackBar.open('Attendance generation triggered.', 'Close', { duration: 3000 });
      } catch (err) {
        this.snackBar.open('Error generating attendance.', 'Close', { duration: 3000 });
      }
    });
  }

  async toggleStatus(plan: ClassPlan, profile: AppUser): Promise<void> {
    const newStatus = plan.status === 'active' ? 'paused' : 'active';
    await this.loader.withLoader('Updating...', async () => {
      await this.repo.update('classPlans', plan.id!, { status: newStatus }, profile);
    });
  }

  async deletePlan(plan: ClassPlan, profile: AppUser): Promise<void> {
    if (confirm('Are you sure you want to delete this class plan?')) {
      await this.loader.withLoader('Deleting...', async () => {
        await this.repo.remove('classPlans', plan.id!);
      });
    }
  }

  canManage(profile?: AppUser | null): boolean {
    if (!profile) return false;
    const role = (profile.role || '').toLowerCase();
    return role === 'superadmin' || role === 'organizationadmin' || role === 'coordinator' || role === 'madrasaincharge';
  }
}
