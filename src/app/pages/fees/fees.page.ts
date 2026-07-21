import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Observable,
  BehaviorSubject,
  combineLatest,
  of,
  map,
  switchMap,
  startWith,
  catchError,
  scan,
} from 'rxjs';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { FeeService, FeeDashboardStats } from '../../core/services/fee.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { FeePlanFormDialogComponent } from './fee-plan-form-dialog.component';
import { FeePaymentDialogComponent } from './fee-payment-dialog.component';
import { FeeAssignStudentsDialogComponent } from './fee-assign-students-dialog.component';
import { FeePaymentHistoryDialogComponent } from './fee-payment-history-dialog.component';

interface FeesPageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface FeesVm {
  profile: AppUser | null;
  feePlans: EntityRecord[];
  feeAssignments: EntityRecord[];
  feePayments: EntityRecord[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  classGroups: EntityRecord[];
  students: EntityRecord[];
  staff: EntityRecord[];
  stats: FeeDashboardStats;
}

@Component({
  selector: 'app-fees',
  templateUrl: './fees.page.html',
  styleUrls: ['./fees.page.scss'],
  standalone: false,
})
export class FeesPage {
  activeTab = 0;

  // Filter state
  planSearch = '';
  planTypeFilter = 'all';
  planStatusFilter = 'active';

  collectionSearch = '';
  collectionPlanFilter = 'all';
  collectionStatusFilter = 'all';

  duePeriodFilter = 'all';
  duePlanFilter = 'all';
  dueMadrasaFilter = 'all';

  paymentSearch = '';

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly vm$: Observable<FeesPageState<FeesVm>> = this.refresh$.pipe(
    switchMap(() =>
      this.auth.profile$.pipe(
        switchMap((profile) => {
          if (!profile) return of({ loading: false, error: 'Please sign in.' } as FeesPageState<FeesVm>);

          return combineLatest([
            this.feeService.listFeePlans(profile).pipe(catchError(() => of([]))),
            this.feeService.listFeeAssignments(profile).pipe(catchError(() => of([]))),
            this.feeService.listFeePayments(profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('courses', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('students', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
          ]).pipe(
            map(([feePlans, feeAssignments, feePayments, madrasas, courses, classes, classGroups, students, staff]) => {
              const stats = this.feeService.computeStats(feeAssignments);
              return {
                data: {
                  profile,
                  feePlans,
                  feeAssignments,
                  feePayments,
                  madrasas,
                  courses,
                  classes,
                  classGroups,
                  students,
                  staff,
                  stats,
                },
                loading: false,
              } as FeesPageState<FeesVm>;
            }),
            startWith({ loading: true } as FeesPageState<FeesVm>),
            catchError((err) => {
              console.error('[Fees] Page load failed:', err);
              return of({
                loading: false,
                error: 'Something went wrong while loading fees data.',
              } as FeesPageState<FeesVm>);
            })
          );
        })
      )
    ),
    scan(
      (acc: FeesPageState<FeesVm>, curr: FeesPageState<FeesVm>) => ({
        ...curr,
        data: curr.data || (curr.loading && acc.data ? acc.data : undefined),
      }),
      { loading: true } as FeesPageState<FeesVm>
    )
  );

  constructor(
    private readonly auth: AuthService,
    private readonly feeService: FeeService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {}

  refreshData(): void {
    this.repo.clearCache();
    this.refresh$.next();
  }

  trackById(_: number, item: EntityRecord): string {
    return item.id || '';
  }

  // ── Filter Methods ──

  filteredPlans(plans: EntityRecord[]): EntityRecord[] {
    let result = plans;
    if (this.planSearch) {
      const q = this.planSearch.toLowerCase();
      result = result.filter((p) =>
        (p['title']?.toString().toLowerCase() || '').includes(q)
      );
    }
    if (this.planTypeFilter !== 'all') {
      result = result.filter((p) => p['feeType'] === this.planTypeFilter);
    }
    if (this.planStatusFilter !== 'all') {
      result = result.filter(
        (p) => (p['status'] || 'active') === this.planStatusFilter
      );
    }
    return result;
  }

  filteredAssignments(assignments: EntityRecord[]): EntityRecord[] {
    let result = assignments;
    if (this.collectionSearch) {
      const q = this.collectionSearch.toLowerCase();
      result = result.filter((a) =>
        (a['studentName']?.toString().toLowerCase() || '').includes(q)
      );
    }
    if (this.collectionPlanFilter !== 'all') {
      result = result.filter(
        (a) => a['feePlanId'] === this.collectionPlanFilter
      );
    }
    if (this.collectionStatusFilter !== 'all') {
      result = result.filter(
        (a) => a['paymentStatus'] === this.collectionStatusFilter
      );
    }
    return result;
  }

  filteredDueAssignments(assignments: EntityRecord[]): EntityRecord[] {
    let result = assignments.filter(
      (a) => a['paymentStatus'] !== 'paid'
    );

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (this.duePeriodFilter === 'currentMonth') {
      result = result.filter((a) => {
        const due = new Date(String(a['dueDate']));
        return due.getMonth() === currentMonth && due.getFullYear() === currentYear;
      });
    } else if (this.duePeriodFilter === 'lastMonth') {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      result = result.filter((a) => {
        const due = new Date(String(a['dueDate']));
        return due.getMonth() === lastMonth && due.getFullYear() === lastMonthYear;
      });
    } else if (this.duePeriodFilter === 'overdue') {
      const todayStr = today.toISOString().split('T')[0];
      result = result.filter((a) => String(a['dueDate']) < todayStr);
    }

    if (this.duePlanFilter !== 'all') {
      result = result.filter((a) => a['feePlanId'] === this.duePlanFilter);
    }
    if (this.dueMadrasaFilter !== 'all') {
      result = result.filter((a) => a['madrasaId'] === this.dueMadrasaFilter);
    }

    return result;
  }

  filteredPayments(payments: EntityRecord[]): EntityRecord[] {
    if (!this.paymentSearch) return payments;
    const q = this.paymentSearch.toLowerCase();
    return payments.filter(
      (p) =>
        (p['studentName']?.toString().toLowerCase() || '').includes(q) ||
        (p['receiptNumber']?.toString().toLowerCase() || '').includes(q)
    );
  }

  isOverdue(assignment: EntityRecord): boolean {
    const dueDate = String(assignment['dueDate'] || '');
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today && assignment['paymentStatus'] !== 'paid';
  }

  // ── Label Helpers ──

  feeTypeLabel(type: string | unknown): string {
    const labels: Record<string, string> = {
      yearly: 'Yearly',
      monthly: 'Monthly',
      amalCard: 'Amal Card',
      admission: 'Admission',
      exam: 'Exam',
      transport: 'Transport',
      custom: 'Custom',
    };
    return labels[String(type)] || String(type);
  }

  periodLabel(period: string | unknown): string {
    const labels: Record<string, string> = {
      oneTime: 'One-Time',
      monthly: 'Monthly',
      yearly: 'Yearly',
      customRange: 'Custom Range',
    };
    return labels[String(period)] || String(period);
  }

  paymentStatusLabel(status: string | unknown): string {
    const labels: Record<string, string> = {
      paid: 'Paid',
      notPaid: 'Not Paid',
      partialPaid: 'Partial',
    };
    return labels[String(status)] || String(status);
  }

  paymentMethodLabel(method: string | unknown): string {
    const labels: Record<string, string> = {
      cash: 'Cash',
      bankTransfer: 'Bank Transfer',
      upi: 'UPI',
      cheque: 'Cheque',
      online: 'Online',
      other: 'Other',
    };
    return labels[String(method)] || String(method);
  }

  // ── Actions ──

  openFeePlanForm(plan?: EntityRecord): void {
    const dialogRef = this.dialog.open(FeePlanFormDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { plan },
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.refresh$.next();
    });
  }

  editFeePlan(plan: EntityRecord): void {
    this.openFeePlanForm(plan);
  }

  async deleteFeePlan(plan: EntityRecord): Promise<void> {
    const confirmed = await this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete Fee Plan',
          message: `Are you sure you want to delete "${plan['title']}"? This will also remove all related assignments.`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
        },
      })
      .afterClosed()
      .toPromise();

    if (!confirmed) return;

    await this.loader.withLoader('Deleting fee plan...', async () => {
      await this.feeService.deleteFeePlan(String(plan.id));
      this.snackBar.open('Fee plan deleted.', 'OK', { duration: 3000 });
      this.refresh$.next();
    });
  }

  openAssignStudents(plan: EntityRecord): void {
    const dialogRef = this.dialog.open(FeeAssignStudentsDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { plan },
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.refresh$.next();
    });
  }

  openPaymentDialog(assignment: EntityRecord): void {
    const dialogRef = this.dialog.open(FeePaymentDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: { assignment },
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.refresh$.next();
    });
  }

  viewPaymentHistory(assignment: EntityRecord): void {
    this.dialog.open(FeePaymentHistoryDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { assignment },
      autoFocus: false,
    });
  }
}
