import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, combineLatest, firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppUser, Course, Madrasa } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { StageHeadDialogComponent } from './stage-head-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  standalone: false,
  selector: 'app-stage-heads-page',
  templateUrl: './stage-heads.page.html',
  styleUrls: ['./stage-heads.page.scss'],
})
export class StageHeadsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  currentUser: AppUser | null = null;

  stageHeads: AppUser[] = [];
  filteredHeads: AppUser[] = [];
  allStaffUsers: AppUser[] = [];
  madrasas: Madrasa[] = [];
  courses: Course[] = [];

  // Filter States
  selectedMadrasaFilter = '';
  madrasaFilterSearch = '';
  filteredMadrasasForFilter: Madrasa[] = [];

  selectedCourseFilter = '';
  courseFilterSearch = '';
  filteredCoursesForFilter: Course[] = [];

  selectedGenderFilter = '';
  searchQuery = '';

  // Metrics
  totalLeads = 0;
  maleLeads = 0;
  femaleLeads = 0;
  totalCoursesManaged = 0;

  constructor(
    private repo: RepositoryService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      this.currentUser = await firstValueFrom(this.auth.profile$);
      if (!this.currentUser) return;

      const [users, madrasas, courses] = await Promise.all([
        this.repo.getAllOnce<EntityRecord & AppUser>('users', this.currentUser, undefined, []),
        this.repo.getAllOnce<EntityRecord & Madrasa>('madrasas', this.currentUser),
        this.repo.getAllOnce<EntityRecord & Course>('courses', this.currentUser),
      ]);

      this.madrasas = madrasas;
      this.courses = courses;
      this.filteredMadrasasForFilter = [...madrasas];
      this.filteredCoursesForFilter = [...courses];
      const STAFF_ROLES = ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin', 'superAdmin', 'stageHead'];
      this.allStaffUsers = users.filter(u => STAFF_ROLES.includes(u.role) || (u as any)['entityType'] === 'staff');

      // Filter users who are stage heads or leads
      this.stageHeads = users.filter(u => u.role === 'stageHead' || (u.assignedCourseStages && u.assignedCourseStages.length > 0));

      this.applyFilters();
    } catch (err) {
      console.error('[StageHeadsPage] Error loading data:', err);
      this.snackBar.open('Failed to load Stage Heads data', 'Close', { duration: 4000 });
    } finally {
      this.loading = false;
    }
  }

  filterMadrasaDropdown(): void {
    const q = this.madrasaFilterSearch.toLowerCase().trim();
    if (!q) {
      this.filteredMadrasasForFilter = [...this.madrasas];
    } else {
      this.filteredMadrasasForFilter = this.madrasas.filter(m => m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q)));
    }
  }

  filterCourseDropdown(): void {
    const q = this.courseFilterSearch.toLowerCase().trim();
    if (!q) {
      this.filteredCoursesForFilter = [...this.courses];
    } else {
      this.filteredCoursesForFilter = this.courses.filter(c => c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)));
    }
  }

  applyFilters(): void {
    let result = [...this.stageHeads];

    if (this.selectedMadrasaFilter) {
      result = result.filter(u => u.madrasaIds?.includes(this.selectedMadrasaFilter));
    }

    if (this.selectedCourseFilter) {
      result = result.filter(u => 
        u.assignedCourseIds?.includes(this.selectedCourseFilter) ||
        u.assignedCourseStages?.some(cs => cs.courseId === this.selectedCourseFilter)
      );
    }

    if (this.selectedGenderFilter) {
      result = result.filter(u => (u.genderScope || 'all') === this.selectedGenderFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(u => 
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }

    this.filteredHeads = result;
    this.calculateMetrics();
  }

  calculateMetrics(): void {
    this.totalLeads = this.stageHeads.length;
    this.maleLeads = this.stageHeads.filter(u => u.genderScope === 'male').length;
    this.femaleLeads = this.stageHeads.filter(u => u.genderScope === 'female').length;

    const managedCourseSet = new Set<string>();
    this.stageHeads.forEach(u => {
      u.assignedCourseIds?.forEach(cId => managedCourseSet.add(cId));
      u.assignedCourseStages?.forEach(cs => managedCourseSet.add(cs.courseId));
    });
    this.totalCoursesManaged = managedCourseSet.size;
  }

  openAssignDialog(user?: AppUser): void {
    const dialogRef = this.dialog.open(StageHeadDialogComponent, {
      width: '640px',
      data: {
        user,
        madrasas: this.madrasas,
        courses: this.courses,
        allStaffUsers: this.allStaffUsers,
      },
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.loadData();
      }
    });
  }

  async removeLeadRole(user: AppUser): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Unassign Stage Head Role',
        message: `Are you sure you want to remove Stage Head role from ${user.displayName}? They will revert to standard staff role.`,
        confirmText: 'Unassign',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async confirmed => {
      if (confirmed) {
        try {
          const docId = user.id || user.uid;
          await this.repo.update('users', docId, {
            role: 'teacher',
            assignedCourseIds: [],
            assignedStages: [],
            assignedCourseStages: [],
            genderScope: 'all',
          } as any, this.currentUser);

          if (user.entityId && user.entityType === 'staff') {
            await this.repo.update('staff', user.entityId, {
              role: 'teacher',
              assignedCourseIds: [],
              assignedStages: [],
              assignedCourseStages: [],
              genderScope: 'all',
            } as any, this.currentUser);
          }

          this.snackBar.open('Stage Head role unassigned', 'OK', { duration: 3000 });
          this.loadData();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to unassign role', 'OK', { duration: 4000 });
        }
      }
    });
  }

  getMadrasaNames(madrasaIds?: string[]): string {
    if (!madrasaIds || madrasaIds.length === 0) return 'None';
    if (this.madrasas.length > 0 && madrasaIds.length >= this.madrasas.length) {
      return 'All Madrasas (Organization-wide)';
    }
    return madrasaIds
      .map(id => this.madrasas.find(m => m.id === id)?.name || id)
      .join(', ');
  }

  getCourseName(courseId: string): string {
    return this.courses.find(c => c.id === courseId)?.name || courseId;
  }
}
