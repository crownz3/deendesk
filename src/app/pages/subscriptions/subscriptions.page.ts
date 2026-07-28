import { Component, DestroyRef, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AppUser, OrgSubscription } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService } from '../../core/services/repository.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SubscriptionEditDialogComponent } from './subscription-edit-dialog.component';

export interface RoleCountMap {
  student: number;
  teacher: number;
  coordinator: number;
  madrasaIncharge: number;
  stageHead: number;
  parent: number;
  customRole: number;
}

export interface OrgSubscriptionVM {
  orgId: string;
  orgName: string;
  subscription: OrgSubscription;
  roleCounts: RoleCountMap;
  cost: {
    baseCost: number;
    studentCost: number;
    staffCost: number;
    coordinatorCost: number;
    inchargeCost: number;
    stageHeadCost: number;
    parentCost: number;
    customRoleCost: number;
    subtotal: number;
    discountAmount: number;
    total: number;
  };
  trialDaysLeft: number;
  isExpiringSoon: boolean;
}

@Component({
  selector: 'app-subscriptions',
  templateUrl: './subscriptions.page.html',
  styleUrls: ['./subscriptions.page.scss'],
  standalone: false,
})
export class SubscriptionsPage implements OnInit {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  loading = true;
  orgVMs: OrgSubscriptionVM[] = [];
  myOrgVM: OrgSubscriptionVM | null = null;
  searchTerm = '';
  selectedFilter: 'all' | 'trial' | 'active' | 'expiring' = 'all';

  // KPI Summaries
  totalOrgs = 0;
  activeCount = 0;
  trialCount = 0;
  expiringSoonCount = 0;
  totalMonthlyRevenue = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    public readonly subService: SubscriptionService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    this.profile$.pipe(
      take(1),
      switchMap(currentUser => {
        return combineLatest([
          of(currentUser),
          this.repo.list<{ id?: string; name?: string }>('organizations', currentUser),
          this.repo.list<OrgSubscription>('subscriptions', currentUser),
          this.repo.list<{ id?: string; organizationId?: string }>('students', currentUser),
          this.repo.list<{ id?: string; organizationId?: string }>('staff', currentUser),
          this.repo.list<{ id?: string; organizationId?: string; role?: string }>('users', currentUser),
        ]);
      })
    ).subscribe({
      next: ([profile, orgsRes, subscriptionsRes, studentsRes, staffListRes, usersRes]) => {
        const orgs = orgsRes || [];
        const subscriptions = subscriptionsRes || [];
        const students = studentsRes || [];
        const staffList = staffListRes || [];
        const users = usersRes || [];

        // Build a map of organization IDs
        const orgMap = new Map<string, string>();
        orgs.forEach(o => {
          if (o.id) orgMap.set(o.id, o.name || 'Organization');
        });

        // Collect org IDs from students, staff, users, and subscriptions
        [...students, ...staffList, ...users].forEach(item => {
          if (item.organizationId && !orgMap.has(item.organizationId)) {
            orgMap.set(item.organizationId, `Organization (${item.organizationId.substring(0, 8)})`);
          }
        });

        subscriptions.forEach(s => {
          const key = s.organizationId || s.id;
          if (key && !orgMap.has(key)) {
            orgMap.set(key, s.organizationName || `Organization (${key.substring(0, 8)})`);
          }
        });

        if (profile?.organizationId && !orgMap.has(profile.organizationId)) {
          orgMap.set(profile.organizationId, 'Deendesk Main Organization');
        }

        if (orgMap.size === 0) {
          orgMap.set('main-org', 'Deendesk Main Organization');
        }

        const subMap = new Map<string, OrgSubscription>();
        subscriptions.forEach(s => {
          const key = s.organizationId || s.id;
          if (key) subMap.set(key, s);
        });

        // Build detailed role counts per org
        const roleCountsMap = new Map<string, RoleCountMap>();
        const getCounts = (oId: string): RoleCountMap => {
          if (!roleCountsMap.has(oId)) {
            roleCountsMap.set(oId, {
              student: 0,
              teacher: 0,
              coordinator: 0,
              madrasaIncharge: 0,
              stageHead: 0,
              parent: 0,
              customRole: 0,
            });
          }
          return roleCountsMap.get(oId)!;
        };

        students.forEach(s => {
          const oId = s.organizationId || profile?.organizationId || 'main-org';
          getCounts(oId).student++;
        });

        staffList.forEach(s => {
          const oId = s.organizationId || profile?.organizationId || 'main-org';
          getCounts(oId).teacher++;
        });

        users.forEach(u => {
          const oId = u.organizationId || profile?.organizationId || 'main-org';
          const counts = getCounts(oId);
          const r = (u.role || '').toLowerCase();
          if (r === 'coordinator') counts.coordinator++;
          else if (r === 'madrasaincharge') counts.madrasaIncharge++;
          else if (r === 'stagehead') counts.stageHead++;
          else if (r === 'parent') counts.parent++;
          else if (!['student', 'teacher', 'staff', 'superadmin', 'organizationadmin'].includes(r) && r) {
            counts.customRole++;
          }
        });

        this.orgVMs = Array.from(orgMap.entries()).map(([orgId, name]) => {
          const sub = subMap.get(orgId) || this.subService.createDefaultSubscription(orgId, name);
          sub.organizationName = name;

          const rCounts = roleCountsMap.get(orgId) || {
            student: orgId === profile?.organizationId ? students.length : 0,
            teacher: orgId === profile?.organizationId ? staffList.length : 0,
            coordinator: 0,
            madrasaIncharge: 0,
            stageHead: 0,
            parent: 0,
            customRole: 0,
          };

          const cost = this.subService.calculateTotalMonthlyCost(sub, rCounts);
          const trialDaysLeft = this.subService.getDaysRemainingInTrial(sub);
          const isExpiringSoon = sub.status === 'trial' ? trialDaysLeft <= 3 : sub.status === 'past_due' || sub.status === 'expired';

          return {
            orgId,
            orgName: name,
            subscription: sub,
            roleCounts: rCounts,
            cost,
            trialDaysLeft,
            isExpiringSoon,
          };
        });

        // Calculate KPI Metrics
        this.totalOrgs = this.orgVMs.length;
        this.activeCount = this.orgVMs.filter(v => v.subscription.status === 'active').length;
        this.trialCount = this.orgVMs.filter(v => v.subscription.status === 'trial').length;
        this.expiringSoonCount = this.orgVMs.filter(v => v.isExpiringSoon).length;
        this.totalMonthlyRevenue = this.orgVMs.reduce((sum, v) => sum + v.cost.total, 0);

        // Find current user's organization
        if (profile?.organizationId) {
          this.myOrgVM = this.orgVMs.find(v => v.orgId === profile.organizationId) || this.orgVMs[0] || null;
        } else {
          this.myOrgVM = this.orgVMs[0] || null;
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load subscription data:', err);
        this.loading = false;
        this.snackBar.open('Unable to load subscription data.', 'Close', { duration: 4000 });
      }
    });
  }

  getFilteredVMs(): OrgSubscriptionVM[] {
    let list = this.orgVMs;

    if (this.selectedFilter === 'trial') {
      list = list.filter(v => v.subscription.status === 'trial');
    } else if (this.selectedFilter === 'active') {
      list = list.filter(v => v.subscription.status === 'active');
    } else if (this.selectedFilter === 'expiring') {
      list = list.filter(v => v.isExpiringSoon);
    }

    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(v => 
      v.orgName.toLowerCase().includes(term) || 
      v.subscription.status.toLowerCase().includes(term) ||
      v.orgId.toLowerCase().includes(term)
    );
  }

  configureSubscription(vm: OrgSubscriptionVM): void {
    const dialogRef = this.dialog.open(SubscriptionEditDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { 
        ...vm.subscription, 
        organizationName: vm.orgName,
        roleCounts: vm.roleCounts 
      },
    });

    dialogRef.afterClosed().subscribe(updated => {
      if (updated) {
        this.loadData();
      }
    });
  }
}
