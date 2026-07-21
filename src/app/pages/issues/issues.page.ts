import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { IssueService } from '../../core/services/issue.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { IssueFormDialogComponent } from './issue-form-dialog.component';
import { IssueDetailsDialogComponent } from './issue-details-dialog.component';
import { IssueCategoryDialogComponent } from './issue-category-dialog.component';

interface IssuesPageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface IssuesVm {
  profile: AppUser | null;
  issues: any[];
  categories: EntityRecord[];
  madrasas: EntityRecord[];
  staff: EntityRecord[];
  students: EntityRecord[];
  stats: {
    total: number;
    open: number;
    critical: number;
    high: number;
    today: number;
    overdue: number;
    underInvestigation: number;
    resolved: number;
    closed: number;
    reopened: number;
  };
}

@Component({
  selector: 'app-issues',
  templateUrl: './issues.page.html',
  styleUrls: ['./issues.page.scss'],
  standalone: false
})
export class IssuesPage implements OnInit {
  // Filters
  searchQuery = '';
  madrasaFilter = 'all';
  categoryFilter = 'all';
  priorityFilter = 'all';
  statusFilter = 'all';
  startDateFilter = '';
  endDateFilter = '';
  confidentialFilter = 'all';
  overdueOnly = false;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly vm$: Observable<IssuesPageState<IssuesVm>> = this.refresh$.pipe(
    switchMap(() =>
      this.auth.profile$.pipe(
        switchMap(profile => {
          if (!profile) return of({ loading: false, error: 'Please sign in.' } as IssuesPageState<IssuesVm>);

          return combineLatest([
            this.issueService.listIssues(profile).pipe(catchError(() => of([]))),
            this.issueService.listCategories(profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('students', profile).pipe(catchError(() => of([]))),
          ]).pipe(
            map(([allIssues, categories, madrasas, staff, students]) => {
              const issues = this.filterIssuesByPermission(allIssues, profile);
              const stats = this.computeStats(issues);
              return {
                loading: false,
                data: {
                  profile,
                  issues,
                  categories,
                  madrasas,
                  staff,
                  students,
                  stats
                }
              };
            })
          );
        }),
        catchError(err => of({ loading: false, error: err.message || 'Failed to load issues.' } as IssuesPageState<IssuesVm>))
      )
    )
  );

  constructor(
    private readonly auth: AuthService,
    private readonly issueService: IssueService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.refresh$.next();
  }

  refreshData(): void {
    this.repo.clearCache();
    this.refresh$.next();
  }

  filterIssuesByPermission(issues: any[], profile: AppUser): any[] {
    if (profile.role === 'superAdmin' || profile.role === 'organizationAdmin' || profile.permissions?.includes('manageIssues')) {
      return issues;
    }
    return issues.filter(i => 
      i.reportedBy === profile.uid || 
      i.assignedStaffId === profile.uid || 
      i.assignedCoordinatorId === profile.uid || 
      i.assignedMadrasaInchargeId === profile.uid
    );
  }

  computeStats(issues: any[]) {
    let total = 0, open = 0, critical = 0, high = 0, today = 0, overdue = 0, underInvestigation = 0, resolved = 0, closed = 0, reopened = 0;
    const now = new Date();
    const todayStr = now.toDateString();

    for (const i of issues) {
      if (i.isDeleted) continue;
      total++;

      // Priority
      if (i.priority === 'critical') critical++;
      if (i.priority === 'high') high++;

      // Status
      if (['reported', 'acknowledged', 'assigned', 'underInvestigation', 'actionRequired', 'inProgress', 'reopened'].includes(i.status)) {
        open++;
      }
      if (i.status === 'underInvestigation') underInvestigation++;
      if (i.status === 'resolved') resolved++;
      if (i.status === 'closed') closed++;
      if (i.status === 'reopened') reopened++;

      // Today check
      const repDate = i.reportedAt?.toDate ? i.reportedAt.toDate() : new Date(i.reportedAt);
      if (repDate.toDateString() === todayStr) {
        today++;
      }

      // Overdue check
      if (i.dueAt && ['resolved', 'closed', 'rejected', 'duplicate'].indexOf(i.status) === -1) {
        const dueDate = i.dueAt.toDate ? i.dueAt.toDate() : new Date(i.dueAt);
        if (dueDate < now) {
          overdue++;
        }
      }
    }

    return { total, open, critical, high, today, overdue, underInvestigation, resolved, closed, reopened };
  }

  getFilteredIssues(issues: any[]): any[] {
    const now = new Date();
    return issues.filter(i => {
      if (i.isDeleted) return false;

      if (this.searchQuery && !i.title.toLowerCase().includes(this.searchQuery.toLowerCase()) && !i.description.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }
      if (this.madrasaFilter !== 'all' && i.madrasaId !== this.madrasaFilter) {
        return false;
      }
      if (this.categoryFilter !== 'all' && i.categoryId !== this.categoryFilter) {
        return false;
      }
      if (this.priorityFilter !== 'all' && i.priority !== this.priorityFilter) {
        return false;
      }
      if (this.statusFilter !== 'all' && i.status !== this.statusFilter) {
        return false;
      }
      if (this.confidentialFilter !== 'all') {
        const isConf = this.confidentialFilter === 'confidential';
        if (i.confidential !== isConf) return false;
      }

      // Overdue logic
      if (this.overdueOnly) {
        if (!i.dueAt) return false;
        const dueDate = i.dueAt.toDate ? i.dueAt.toDate() : new Date(i.dueAt);
        if (dueDate >= now || ['resolved', 'closed', 'rejected', 'duplicate'].includes(i.status)) return false;
      }

      // Date range filters
      const repDate = i.reportedAt?.toDate ? i.reportedAt.toDate() : new Date(i.reportedAt);
      if (this.startDateFilter && repDate < new Date(this.startDateFilter)) {
        return false;
      }
      if (this.endDateFilter && repDate > new Date(this.endDateFilter)) {
        return false;
      }

      return true;
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.madrasaFilter = 'all';
    this.categoryFilter = 'all';
    this.priorityFilter = 'all';
    this.statusFilter = 'all';
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.confidentialFilter = 'all';
    this.overdueOnly = false;
  }

  isOverdue(issue: any): boolean {
    if (!issue.dueAt) return false;
    if (['resolved', 'closed', 'rejected', 'duplicate'].includes(issue.status)) return false;
    const dueDate = issue.dueAt.toDate ? issue.dueAt.toDate() : new Date(issue.dueAt);
    return dueDate < new Date();
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  }

  // --- Dialog launching ---
  openIssueForm(vm: IssuesVm): void {
    const ref = this.dialog.open(IssueFormDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        categories: vm.categories,
        madrasas: vm.madrasas,
        staff: vm.staff,
        students: vm.students,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.refresh$.next();
    });
  }

  openIssueDetails(vm: IssuesVm, issue: any): void {
    const ref = this.dialog.open(IssueDetailsDialogComponent, {
      width: '950px',
      data: {
        issue,
        profile: vm.profile,
        staff: vm.staff
      }
    });

    ref.afterClosed().subscribe(() => {
      this.refresh$.next();
    });
  }

  openCategoryConfig(vm: IssuesVm): void {
    const ref = this.dialog.open(IssueCategoryDialogComponent, {
      width: '1150px',
      maxWidth: '95vw',
      data: { profile: vm.profile }
    });

    ref.afterClosed().subscribe(() => {
      this.refresh$.next();
    });
  }

  triggerRefresh(): void {
    this.refresh$.next();
  }
}
