import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subscription, catchError, combineLatest, map, of, shareReplay, startWith, switchMap, firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan, ClassPlanAttendance, ClassPlanException } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { ClassPlanAttendanceService } from '../../core/services/class-plan-attendance.service';
import { ClassPlanExceptionDialogComponent } from './class-plan-exception-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

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
  classGroups: EntityRecord[];
  exceptions: (EntityRecord & ClassPlanException)[];
  staffDocs: EntityRecord[];
}

@Component({
  selector: 'app-class-plans',
  templateUrl: './class-plans.page.html',
  styleUrls: ['./class-plans.page.scss'],
  standalone: false,
})
export class ClassPlansPage implements OnInit, OnDestroy {
  readonly vm$: Observable<PageState<ClassPlansVm>>;
  
  selectedPlan?: ClassPlan;
  isCreating = false;
  isEditingPlan = false;
  isSidebarCollapsed = false;
  
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
        if (!profile) return of({ loading: false, data: { profile: null, classPlans: [], madrasas: [], courses: [], classes: [], classGroups: [], exceptions: [], staffDocs: [] } });
        
        return combineLatest({
          classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile),
          madrasas: this.repo.list<EntityRecord>('madrasas', profile),
          courses: this.repo.list<EntityRecord>('courses', profile),
          classes: this.repo.list<EntityRecord>('classes', profile),
          classGroups: this.repo.list<EntityRecord>('classGroups', profile),
          exceptions: this.repo.list<EntityRecord & ClassPlanException>('classPlanExceptions', profile),
          staffDocs: this.repo.list<EntityRecord>('staff', profile),
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

  getClassTeachers(plan: ClassPlan, vm: ClassPlansVm | undefined | null): string {
    if (!vm || !vm.classGroups) return 'No Class Staff';
    const groups = vm.classGroups.filter(group => String(group['classId']) === String(plan.classId));
    const staffIds = Array.from(new Set(
      groups.flatMap(group => Array.isArray(group['assignedStaffIds']) ? group['assignedStaffIds'].map(String) : [])
    ));
    const names = staffIds.map(id => {
       const staffDoc = vm.staffDocs.find(staff =>
         [staff.id, staff['uid'], staff['userId'], staff['entityId']].map(value => String(value || '')).includes(id)
       );
       return staffDoc ? (staffDoc['displayName'] || staffDoc['name']) : null;
    }).filter(n => !!n);
    
    return names.length > 0 ? names.join(', ') : 'No Class Staff';
  }

  getPlanExceptions(planId: string | undefined, exceptions: (EntityRecord & ClassPlanException)[] | undefined): (EntityRecord & ClassPlanException)[] {
    if (!planId || !exceptions) return [];
    return exceptions.filter(e => e.classPlanId === planId).sort((a, b) => b.date.localeCompare(a.date));
  }

  selectPlan(plan: ClassPlan): void {
    this.selectedPlan = plan;
    this.isCreating = false;
    this.isEditingPlan = false;
  }

  createNew(): void {
    this.selectedPlan = undefined;
    this.isCreating = true;
    this.isEditingPlan = true;
  }

  onFormSave(savedPlan: ClassPlan): void {
    this.selectedPlan = savedPlan;
    this.isCreating = false;
    this.isEditingPlan = false;
  }

  onFormCancel(): void {
    this.isCreating = false;
    this.isEditingPlan = false;
  }

  openExceptionForm(plan: ClassPlan): void {
    this.dialog.open(ClassPlanExceptionDialogComponent, {
      width: '500px',
      data: { plan }
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
    const actionName = newStatus === 'paused' ? 'Pause' : 'Resume';
    
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: `${actionName} Class Plan`,
        message: `Are you sure you want to ${actionName.toLowerCase()} this class plan?`
      }
    }).afterClosed());

    if (confirmed) {
      await this.loader.withLoader('Updating...', async () => {
        await this.repo.update('classPlans', plan.id!, { status: newStatus }, profile);
      });
    }
  }

  async deletePlan(plan: ClassPlan, profile: AppUser): Promise<void> {
    const confirm = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Class Plan',
        message: 'Are you sure you want to delete this class plan? This cannot be undone.',
        confirmText: 'Delete',
        confirmColor: 'warn'
      }
    }).afterClosed());

    if (confirm) {
      try {
        await this.loader.withLoader('Deleting...', () => this.repo.remove('classPlans', plan.id!));
        this.snackBar.open('Plan deleted successfully', 'Close', { duration: 3000 });
        if (this.selectedPlan?.id === plan.id) {
          this.selectedPlan = undefined;
        }
      } catch (e) {
        this.snackBar.open('Error deleting plan', 'Close', { duration: 3000 });
      }
    }
  }

  async deleteException(exception: EntityRecord & ClassPlanException, profile: AppUser | null | undefined): Promise<void> {
    if (!profile) return;
    const confirm = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Exception',
        message: 'Are you sure you want to delete this exception?',
        confirmText: 'Delete',
        confirmColor: 'warn'
      }
    }).afterClosed());

    if (confirm) {
      try {
        await this.loader.withLoader('Deleting...', () => this.repo.remove('classPlanExceptions', exception.id!));
        this.snackBar.open('Exception deleted successfully', 'Close', { duration: 3000 });
      } catch (e) {
        this.snackBar.open('Error deleting exception', 'Close', { duration: 3000 });
      }
    }
  }

  canManage(profile?: AppUser | null): boolean {
    if (!profile) return false;
    const role = (profile.role || '').toLowerCase();
    return role === 'superadmin' || role === 'organizationadmin' || role === 'coordinator' || role === 'madrasaincharge';
  }
}
