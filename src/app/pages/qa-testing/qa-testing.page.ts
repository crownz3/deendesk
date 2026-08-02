import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, combineLatest, filter, map, switchMap, takeUntil } from 'rxjs';
import { AppUser, BugPriority, BugSeverity, BugStatus, QaBug, QaDailyReport, QaTestRun } from '../../core/models/domain.model';
import { QaTestingService } from '../../core/services/qa-testing.service';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService } from '../../core/services/repository.service';
import { CsvService } from '../../core/services/csv.service';
import { QaBugFormDialogComponent } from './dialogs/qa-bug-form-dialog.component';
import { QaBugDetailsDialogComponent } from './dialogs/qa-bug-details-dialog.component';
import { QaTestRunDialogComponent } from './dialogs/qa-test-run-dialog.component';

interface QaDashboardMetrics {
  totalBugs: number;
  openBugs: number;
  fixedBugs: number;
  verifiedBugs: number;
  rejectedBugs: number;
  bugsToday: number;
  bugsThisWeek: number;
  criticalBugs: number;
  highBugs: number;
  p1Bugs: number;
}

@Component({
  selector: 'app-qa-testing-page',
  templateUrl: './qa-testing.page.html',
  styleUrls: ['./qa-testing.page.scss'],
  standalone: false,
})
export class QaTestingPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  selectedTabIndex = 0;
  bugs: QaBug[] = [];
  filteredBugs: QaBug[] = [];
  testRuns: QaTestRun[] = [];
  dailyReports: QaDailyReport[] = [];
  developersList: { id: string; name: string }[] = [];

  // Filters
  searchQuery = '';
  filterModule = '';
  filterStatus = '';
  filterSeverity = '';
  filterPriority = '';
  filterDeveloper = '';

  // Metrics
  metrics: QaDashboardMetrics = {
    totalBugs: 0,
    openBugs: 0,
    fixedBugs: 0,
    verifiedBugs: 0,
    rejectedBugs: 0,
    bugsToday: 0,
    bugsThisWeek: 0,
    criticalBugs: 0,
    highBugs: 0,
    p1Bugs: 0,
  };

  // Daily Report Form state
  dailyForm = {
    date: new Date().toISOString().substring(0, 10),
    modulesTested: [] as string[],
    testCasesExecuted: 10,
    passed: 8,
    failed: 2,
    bugsReported: 2,
    bugsVerified: 1,
    pendingBugs: 1,
    testingHours: 6,
    notes: '',
  };
  isSubmittingDaily = false;

  readonly allModulesList: string[] = [
    'Authentication & Session',
    'Organization Management',
    'Madrasa Setup',
    'Users & Roles',
    'Staff Management',
    'Students & Parents',
    'Courses',
    'Classes & Timetable',
    'Attendance Marking',
    'Quran Tracker',
    'Study Time & Homework',
    'Fees & Financials',
    'Events & Competitions',
    'Issues & Helpdesk',
    'Properties & Inventory',
    'Reports & Analytics',
    'CSV Imports',
    'Settings & Profile',
  ];

  readonly statusesList: BugStatus[] = [
    'New',
    'In Progress',
    'Fixed',
    'Ready for Testing',
    'Verified',
    'Reopened',
    'Closed',
    'Rejected',
  ];
  readonly severitiesList: BugSeverity[] = ['Critical', 'High', 'Medium', 'Low'];
  readonly prioritiesList: BugPriority[] = ['P1', 'P2', 'P3', 'P4'];

  constructor(
    private qaService: QaTestingService,
    private auth: AuthService,
    private repo: RepositoryService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private csvService: CsvService
  ) {}

  ngOnInit(): void {
    // Load Users for Developer Assignment
    this.auth.profile$
      .pipe(
        switchMap((user) => this.repo.list<AppUser>('users', user)),
        takeUntil(this.destroy$)
      )
      .subscribe((users: AppUser[]) => {
        this.developersList = (users || [])
          .filter((u) => u.role === 'superAdmin' || u.role === 'organizationAdmin' || u.role === 'teacher')
          .map((u) => ({ id: u.uid || u.id || '', name: u.displayName || u.email || 'User' }));
      });

    // Listen to Bugs (waiting for authenticated user profile)
    this.auth.profile$
      .pipe(
        filter((user): user is AppUser => !!user),
        switchMap((user) => {
          const orgId = user.role === 'superAdmin' ? undefined : user.organizationId;
          return this.qaService.getBugs$(orgId);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((bugs) => {
        this.bugs = bugs;
        this.applyFilters();
        this.calculateMetrics();
      });

    // Listen to Test Runs
    this.auth.profile$
      .pipe(
        filter((user): user is AppUser => !!user),
        switchMap((user) => {
          const orgId = user.role === 'superAdmin' ? undefined : user.organizationId;
          return this.qaService.getTestRuns$(orgId);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((runs) => {
        this.testRuns = runs;
      });

    // Listen to Daily Reports
    this.auth.profile$
      .pipe(
        filter((user): user is AppUser => !!user),
        switchMap((user) => {
          const orgId = user.role === 'superAdmin' ? undefined : user.organizationId;
          return this.qaService.getDailyReports$(orgId);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((reports) => {
        this.dailyReports = reports;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    let result = [...this.bugs];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.bugId.toLowerCase().includes(q) ||
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.module.toLowerCase().includes(q)
      );
    }

    if (this.filterModule) {
      result = result.filter((b) => b.module === this.filterModule);
    }
    if (this.filterStatus) {
      result = result.filter((b) => b.status === this.filterStatus);
    }
    if (this.filterSeverity) {
      result = result.filter((b) => b.severity === this.filterSeverity);
    }
    if (this.filterPriority) {
      result = result.filter((b) => b.priority === this.filterPriority);
    }
    if (this.filterDeveloper) {
      result = result.filter((b) => b.assignedDeveloperId === this.filterDeveloper);
    }

    this.filteredBugs = result;
  }

  calculateMetrics(): void {
    const totalBugs = this.bugs.length;
    const openBugs = this.bugs.filter(
      (b) => b.status === 'New' || b.status === 'In Progress' || b.status === 'Reopened'
    ).length;
    const fixedBugs = this.bugs.filter((b) => b.status === 'Fixed' || b.status === 'Ready for Testing').length;
    const verifiedBugs = this.bugs.filter((b) => b.status === 'Verified' || b.status === 'Closed').length;
    const rejectedBugs = this.bugs.filter((b) => b.status === 'Rejected').length;

    const todayStr = new Date().toISOString().substring(0, 10);
    const bugsToday = this.bugs.filter((b) => {
      const d = b.reportedAt ? new Date((b.reportedAt as any).seconds * 1000).toISOString().substring(0, 10) : '';
      return d === todayStr;
    }).length;

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const bugsThisWeek = this.bugs.filter((b) => {
      const ms = (b.reportedAt as any)?.seconds ? (b.reportedAt as any).seconds * 1000 : 0;
      return ms >= oneWeekAgo;
    }).length;

    const criticalBugs = this.bugs.filter((b) => b.severity === 'Critical').length;
    const highBugs = this.bugs.filter((b) => b.severity === 'High').length;
    const p1Bugs = this.bugs.filter((b) => b.priority === 'P1').length;

    this.metrics = {
      totalBugs,
      openBugs,
      fixedBugs,
      verifiedBugs,
      rejectedBugs,
      bugsToday,
      bugsThisWeek,
      criticalBugs,
      highBugs,
      p1Bugs,
    };
  }

  // Quick Action Dialogs
  openReportBugDialog(): void {
    const dialogRef = this.dialog.open(QaBugFormDialogComponent, {
      width: '90vw',
      maxWidth: '90vw',
      data: {
        modules: this.allModulesList,
        developers: this.developersList,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          const bugId = await this.qaService.createBug(result);
          this.snackBar.open('Bug report submitted successfully!', 'OK', { duration: 3000 });
        } catch (err: any) {
          this.snackBar.open(`Error submitting bug: ${err.message}`, 'Close');
        }
      }
    });
  }

  openBugDetails(bug: QaBug): void {
    this.dialog.open(QaBugDetailsDialogComponent, {
      width: '90vw',
      maxWidth: '90vw',
      data: { bug, canEdit: true },
    });
  }

  openEditBug(bug: QaBug, event?: Event): void {
    if (event) event.stopPropagation();
    if (!bug?.id) return;
    const dialogRef = this.dialog.open(QaBugFormDialogComponent, {
      width: '90vw',
      maxWidth: '90vw',
      data: {
        bug,
        modules: this.allModulesList,
        developers: this.developersList,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && bug.id) {
        try {
          await this.qaService.updateBug(bug.id, result);
          this.snackBar.open('Bug updated successfully', 'OK', { duration: 2500 });
        } catch (err: any) {
          this.snackBar.open(`Error: ${err.message}`, 'Close');
        }
      }
    });
  }

  async quickChangeStatus(bug: QaBug, newStatus: BugStatus, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!bug?.id) return;
    try {
      await this.qaService.changeBugStatus(bug.id, newStatus, bug.status);
      this.snackBar.open(`Status updated to ${newStatus}`, 'OK', { duration: 2500 });
    } catch (err: any) {
      this.snackBar.open(`Failed: ${err.message}`, 'Close');
    }
  }

  openCreateTestRunDialog(): void {
    const dialogRef = this.dialog.open(QaTestRunDialogComponent, {
      width: '550px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.qaService.createTestRun(result);
          this.snackBar.open('Release Test Run launched!', 'OK', { duration: 3000 });
        } catch (err: any) {
          this.snackBar.open(`Error creating Test Run: ${err.message}`, 'Close');
        }
      }
    });
  }

  async toggleModuleStatusInTestRun(run: QaTestRun, modIndex: number, newStatus: 'Passed' | 'Failed' | 'In Progress'): Promise<void> {
    if (!run?.id) return;
    const updatedModules = [...run.modules];
    updatedModules[modIndex].status = newStatus;
    if (newStatus === 'Passed') {
      updatedModules[modIndex].passedCases = updatedModules[modIndex].totalCases;
      updatedModules[modIndex].failedCases = 0;
    } else if (newStatus === 'Failed') {
      updatedModules[modIndex].failedCases = 1;
    }

    try {
      await this.qaService.updateTestRun(run.id, { modules: updatedModules });
    } catch (err: any) {
      this.snackBar.open(`Error updating module: ${err.message}`, 'Close');
    }
  }

  async onSubmitDailyReport(): Promise<void> {
    this.isSubmittingDaily = true;
    try {
      await this.qaService.submitDailyReport(this.dailyForm);
      this.snackBar.open('Daily QA report submitted successfully!', 'OK', { duration: 3000 });
      this.dailyForm.notes = '';
    } catch (err: any) {
      this.snackBar.open(`Error: ${err.message}`, 'Close');
    } finally {
      this.isSubmittingDaily = false;
    }
  }

  toggleDailyModule(mod: string): void {
    const idx = this.dailyForm.modulesTested.indexOf(mod);
    if (idx >= 0) {
      this.dailyForm.modulesTested.splice(idx, 1);
    } else {
      this.dailyForm.modulesTested.push(mod);
    }
  }

  exportBugsCsv(): void {
    if (this.filteredBugs.length === 0) {
      this.snackBar.open('No bugs to export', 'OK', { duration: 2500 });
      return;
    }

    const rows = this.filteredBugs.map((b) => ({
      'Bug ID': b.bugId,
      Title: b.title,
      Module: b.module,
      Feature: b.feature,
      Severity: b.severity,
      Priority: b.priority,
      Type: b.type,
      Status: b.status,
      'Reported By': b.reportedByName,
      'Assigned Dev': b.assignedDeveloperName || 'Unassigned',
      'Steps to Reproduce': b.stepsToReproduce,
      'Expected Result': b.expectedResult,
      'Actual Result': b.actualResult,
      Browser: b.browser,
      OS: b.os,
    }));

    const csvContent = this.csvService.toCsv(rows);
    const filename = `Deendesk_Bugs_Report_${new Date().toISOString().substring(0, 10)}.csv`;
    this.csvService.download(filename, csvContent);
  }
}
