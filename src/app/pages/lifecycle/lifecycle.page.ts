import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { LifecycleService } from '../../core/services/lifecycle.service';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService, EntityRecord } from '../../core/services/repository.service';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-lifecycle',
  templateUrl: './lifecycle.page.html',
  styleUrls: ['./lifecycle.page.scss'],
  standalone: false
})
export class LifecyclePage implements OnInit, OnDestroy {
  loading = true;

  // Filters
  searchQuery = '';
  selectedFilter: 'all' | 'joins' | 'stages' | 'transfers' = 'all';
  organizationFilter = 'all';
  roleFilter = 'all';
  madrasaFilter = 'all';
  actionFilter = 'all';

  // Dropdown Internal Search Strings
  searchOrgText = '';
  searchMadrasaText = '';
  searchRoleText = '';
  searchActionText = '';

  // Pagination
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];

  stats = {
    totalEvents: 0,
    joinsCount: 0,
    promotionsCount: 0,
    dismissalsCount: 0
  };

  allHistoryRecords: any[] = [];
  filteredRecords: any[] = [];
  pagedRecords: any[] = [];

  displayedColumnsHistory: string[] = ['effectiveDate', 'userName', 'personType', 'lifecycleAction', 'reason', 'performedBy'];

  userMap = new Map<string, string>();
  madrasaMap = new Map<string, string>();
  organizationMap = new Map<string, string>();

  organizationOptions: { label: string; value: string }[] = [];
  madrasaOptions: { label: string; value: string }[] = [];

  roleOptions = [
    { label: 'All Roles', value: 'all' },
    { label: 'Student', value: 'student' },
    { label: 'Staff / Teacher', value: 'staff' },
    { label: 'Coordinator', value: 'coordinator' },
    { label: 'Madrasa Incharge', value: 'madrasaincharge' },
    { label: 'Parent', value: 'parent' }
  ];

  actionOptions = [
    { label: 'All Actions', value: 'all' },
    { label: 'Joined', value: 'joined' },
    { label: 'Rejoined', value: 'rejoined' },
    { label: 'Promoted', value: 'promoted' },
    { label: 'Demoted', value: 'demoted' },
    { label: 'Transferred', value: 'transferred' },
    { label: 'Dismissed', value: 'dismissed' },
    { label: 'Relieved', value: 'relieved' }
  ];

  private subscriptions = new Subscription();

  constructor(
    private lifecycleService: LifecycleService,
    private auth: AuthService,
    private repo: RepositoryService
  ) {}

  ngOnInit() {
    this.loadAllLifecycleData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async refreshData() {
    this.repo.clearCache();
    await this.loadAllLifecycleData(true);
  }

  async loadAllLifecycleData(forceRefresh = false) {
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);

      // Populate lookup maps
      const [organizations, users, students, staff, madrasas] = await Promise.all([
        this.repo.getAllOnce<EntityRecord>('organizations', profile, { forceRefresh }).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('users', profile, { forceRefresh }).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('students', profile, { forceRefresh }).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('staff', profile, { forceRefresh }).catch(() => []),
        this.repo.getAllOnce<EntityRecord>('madrasas', profile, { forceRefresh }).catch(() => []),
      ]);

      this.organizationOptions = [
        { label: 'All Organizations', value: 'all' }
      ];
      organizations.forEach(o => {
        const name = String(o['name'] || o.id);
        if (o.id) {
          this.organizationMap.set(String(o.id), name);
          this.organizationOptions.push({ label: name, value: String(o.id) });
        }
      });

      users.forEach(u => {
        const name = String(u['displayName'] || u['name'] || u['email'] || '');
        if (name) {
          if (u.id) this.userMap.set(String(u.id), name);
          if (u['uid']) this.userMap.set(String(u['uid']), name);
        }
      });

      students.forEach(s => {
        const name = String(s['name'] || s['displayName'] || '');
        if (name) {
          if (s.id) this.userMap.set(String(s.id), name);
          if (s['userId']) this.userMap.set(String(s['userId']), name);
          if (s['uid']) this.userMap.set(String(s['uid']), name);
        }
      });

      staff.forEach(st => {
        const name = String(st['name'] || st['displayName'] || '');
        if (name) {
          if (st.id) this.userMap.set(String(st.id), name);
          if (st['userId']) this.userMap.set(String(st['userId']), name);
          if (st['uid']) this.userMap.set(String(st['uid']), name);
        }
      });

      this.madrasaOptions = [
        { label: 'All Madrasas', value: 'all' }
      ];
      madrasas.forEach(m => {
        const name = String(m['name'] || m.id);
        if (m.id) {
          this.madrasaMap.set(String(m.id), name);
          this.madrasaOptions.push({ label: name, value: String(m.id) });
        }
      });

      // Listen to History Records (userLifecycleHistory & promotionHistory merged)
      this.subscriptions.add(
        this.lifecycleService.listLifecycleHistory(profile).subscribe({
          next: async (history) => {
            const [promotionRecords, transferRecords] = await Promise.all([
              this.repo.getAllOnce<EntityRecord>('promotionHistory', profile).catch(() => []),
              this.repo.getAllOnce<EntityRecord>('studentTransfers', profile).catch(() => []),
            ]);
            
            const normalizedPromotions = promotionRecords.map(p => {
              const rawStudent = p['studentName'] || p['userName'] || p['studentId'] || 'Student';
              const resolvedStudent = this.getUserName(rawStudent);
              const resolvedPerformed = this.getUserName(p['createdBy'] || 'System');
              const act = p['action'] === 'promote' ? 'Promoted' : (p['action'] === 'demote' ? 'Demoted' : String(p['action'] || 'Stage Change'));
              return {
                id: p.id,
                userId: p['studentId'] || '',
                madrasaId: p['madrasaId'] || '',
                organizationId: p['organizationId'] || '',
                effectiveDate: p['actionDate'] || p['createdAt'] || new Date().toISOString(),
                userName: resolvedStudent,
                personType: 'student',
                lifecycleAction: act,
                actionClass: act.toLowerCase(),
                reason: `Stage changed from ${p['previousStage'] || 'Initial'} to ${p['newStage'] || '-'}. ${p['reason'] ? 'Reason: ' + p['reason'] : ''}`,
                performedBy: resolvedPerformed,
                actionPerformedByName: resolvedPerformed,
              };
            });

            const normalizedTransfers = transferRecords.map(t => {
              const rawStudent = t['studentName'] || t['userName'] || t['studentId'] || 'Student';
              const resolvedStudent = this.getUserName(rawStudent);
              const resolvedPerformed = this.getUserName(t['createdBy'] || t['actionPerformedBy'] || 'System');
              const act = 'Transferred';
              return {
                id: t.id,
                userId: t['studentId'] || '',
                madrasaId: t['newMadrasaId'] || t['madrasaId'] || '',
                organizationId: t['organizationId'] || '',
                effectiveDate: t['actionDate'] || t['createdAt'] || new Date().toISOString(),
                userName: resolvedStudent,
                personType: 'student',
                lifecycleAction: act,
                actionClass: 'transferred',
                reason: t['reason'] || 'Student academic transfer',
                performedBy: resolvedPerformed,
                actionPerformedByName: resolvedPerformed,
              };
            });

            const normalizedHistory = history.map(h => this.normalizeHistoryItem(h));

            const historyKeys = new Set<string>();
            normalizedHistory.forEach(h => {
              const uKey = String(h.userId || h.userName || '').toLowerCase();
              const actKey = String(h.lifecycleAction || h.actionType || '').toLowerCase();
              const timeMin = Math.floor(this.getMillis(h.effectiveDate) / 60000);
              historyKeys.add(`${uKey}_${actKey}_${timeMin}`);
              if (actKey.includes('promot')) historyKeys.add(`${uKey}_promoted_${timeMin}`);
              if (actKey.includes('transfer')) historyKeys.add(`${uKey}_transferred_${timeMin}`);
            });

            const filteredPromotions = normalizedPromotions.filter(p => {
              const uKey = String(p.userId || p.userName || '').toLowerCase();
              const timeMin = Math.floor(this.getMillis(p.effectiveDate) / 60000);
              return !historyKeys.has(`${uKey}_promoted_${timeMin}`);
            });

            const filteredTransfers = normalizedTransfers.filter(t => {
              const uKey = String(t.userId || t.userName || '').toLowerCase();
              const timeMin = Math.floor(this.getMillis(t.effectiveDate) / 60000);
              return !historyKeys.has(`${uKey}_transferred_${timeMin}`);
            });

            const existingUserKeys = new Set<string>();
            normalizedHistory.forEach(h => {
              if (h.userId) existingUserKeys.add(String(h.userId));
              if (h.userName) existingUserKeys.add(String(h.userName).toLowerCase());
            });

            const synthesizedStudentJoins = students
              .filter(s => {
                const sName = String(s['name'] || s['displayName'] || '').toLowerCase();
                const sId = String(s.id || '');
                const sUserId = String(s['userId'] || '');
                return !existingUserKeys.has(sId) && !existingUserKeys.has(sUserId) && (sName ? !existingUserKeys.has(sName) : true);
              })
              .map(s => {
                const sName = String(s['name'] || s['displayName'] || 'Student');
                const isRejoin = String(s['joinType'] || '').toLowerCase() === 'rejoin';
                const act = isRejoin ? 'Rejoined' : 'Joined';
                return {
                  id: 'syn-s-' + s.id,
                  userId: s.id,
                  madrasaId: s['madrasaId'] || '',
                  organizationId: s['organizationId'] || '',
                  effectiveDate: s['admissionDate'] || s['createdAt'] || new Date().toISOString(),
                  userName: sName,
                  personType: 'student',
                  lifecycleAction: act,
                  actionClass: act.toLowerCase(),
                  reason: isRejoin ? 'Rejoined / Re-enrolled student account' : 'Newly enrolled student account',
                  performedBy: this.getUserName(s['createdBy'] || 'System'),
                  actionPerformedByName: this.getUserName(s['createdBy'] || 'System'),
                };
              });

            const synthesizedStaffJoins = staff
              .filter(st => {
                const stName = String(st['name'] || st['displayName'] || '').toLowerCase();
                const stId = String(st.id || '');
                const stUserId = String(st['userId'] || '');
                return !existingUserKeys.has(stId) && !existingUserKeys.has(stUserId) && (stName ? !existingUserKeys.has(stName) : true);
              })
              .map(st => {
                const stName = String(st['name'] || st['displayName'] || 'Staff');
                const isRejoin = String(st['joinType'] || '').toLowerCase() === 'rejoin';
                const act = isRejoin ? 'Rejoined' : 'Joined';
                return {
                  id: 'syn-st-' + st.id,
                  userId: st.id,
                  madrasaId: st['madrasaId'] || (Array.isArray(st['madrasaIds']) ? st['madrasaIds'][0] : ''),
                  organizationId: st['organizationId'] || '',
                  effectiveDate: st['joiningDate'] || st['createdAt'] || new Date().toISOString(),
                  userName: stName,
                  personType: 'staff',
                  lifecycleAction: act,
                  actionClass: act.toLowerCase(),
                  reason: isRejoin ? 'Rejoined staff member' : 'Newly joined staff member',
                  performedBy: this.getUserName(st['createdBy'] || 'System'),
                  actionPerformedByName: this.getUserName(st['createdBy'] || 'System'),
                };
              });

            // Merge and sort desc by date
            const combined = [...normalizedHistory, ...filteredPromotions, ...filteredTransfers, ...synthesizedStudentJoins, ...synthesizedStaffJoins].sort((a, b) => {
              const timeA = this.getMillis(a.effectiveDate);
              const timeB = this.getMillis(b.effectiveDate);
              return timeB - timeA;
            });

            this.allHistoryRecords = combined;
            this.updateStats();
            this.applyFilter();
            this.loading = false;
          },
          error: (err) => {
            console.warn('[Lifecycle] error loading history', err);
            this.loading = false;
          }
        })
      );

    } catch (e) {
      console.error('[Lifecycle] Initialization error', e);
      this.loading = false;
    }
  }

  // Filter Dropdown Options Search Helpers
  getFilteredOrgOptions(): { label: string; value: string }[] {
    if (!this.searchOrgText.trim()) return this.organizationOptions;
    const q = this.searchOrgText.trim().toLowerCase();
    return this.organizationOptions.filter(o => o.value === 'all' || o.label.toLowerCase().includes(q));
  }

  getFilteredMadrasaOptions(): { label: string; value: string }[] {
    if (!this.searchMadrasaText.trim()) return this.madrasaOptions;
    const q = this.searchMadrasaText.trim().toLowerCase();
    return this.madrasaOptions.filter(m => m.value === 'all' || m.label.toLowerCase().includes(q));
  }

  getFilteredRoleOptions(): { label: string; value: string }[] {
    if (!this.searchRoleText.trim()) return this.roleOptions;
    const q = this.searchRoleText.trim().toLowerCase();
    return this.roleOptions.filter(r => r.value === 'all' || r.label.toLowerCase().includes(q));
  }

  getFilteredActionOptions(): { label: string; value: string }[] {
    if (!this.searchActionText.trim()) return this.actionOptions;
    const q = this.searchActionText.trim().toLowerCase();
    return this.actionOptions.filter(a => a.value === 'all' || a.label.toLowerCase().includes(q));
  }

  setFilter(filter: 'all' | 'joins' | 'stages' | 'transfers') {
    this.selectedFilter = filter;
    this.pageIndex = 0;
    this.applyFilter();
  }

  onFilterChange() {
    this.pageIndex = 0;
    this.applyFilter();
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedFilter = 'all';
    this.organizationFilter = 'all';
    this.roleFilter = 'all';
    this.madrasaFilter = 'all';
    this.actionFilter = 'all';
    this.searchOrgText = '';
    this.searchMadrasaText = '';
    this.searchRoleText = '';
    this.searchActionText = '';
    this.pageIndex = 0;
    this.applyFilter();
  }

  applyFilter() {
    let result = [...this.allHistoryRecords];

    // 1. Category Filter Pill
    if (this.selectedFilter === 'joins') {
      result = result.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes('join') || act.includes('enroll');
      });
    } else if (this.selectedFilter === 'stages') {
      result = result.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes('promot') || act.includes('demot') || act.includes('stage');
      });
    } else if (this.selectedFilter === 'transfers') {
      result = result.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes('transfer') || act.includes('dismiss') || act.includes('reliev') || act.includes('remov') || act.includes('graduat') || act.includes('withdraw');
      });
    }

    // 2. Organization Filter Dropdown
    if (this.organizationFilter !== 'all') {
      result = result.filter(r => String(r.organizationId || '') === this.organizationFilter);
    }

    // 3. Role Filter Dropdown
    if (this.roleFilter !== 'all') {
      result = result.filter(r => String(r.personType || '').toLowerCase() === this.roleFilter.toLowerCase());
    }

    // 4. Madrasa Filter Dropdown
    if (this.madrasaFilter !== 'all') {
      result = result.filter(r => String(r.madrasaId || '') === this.madrasaFilter);
    }

    // 5. Action Filter Dropdown
    if (this.actionFilter !== 'all') {
      result = result.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes(this.actionFilter.toLowerCase());
      });
    }

    // 6. Search Text Input
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(r => 
        String(r.userName || '').toLowerCase().includes(q) ||
        String(r.personType || '').toLowerCase().includes(q) ||
        String(r.lifecycleAction || '').toLowerCase().includes(q) ||
        String(r.actionType || '').toLowerCase().includes(q) ||
        String(r.reason || '').toLowerCase().includes(q) ||
        String(r.performedBy || '').toLowerCase().includes(q)
      );
    }

    this.filteredRecords = result;
    this.updatePagedRecords();
  }

  updatePagedRecords() {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.pagedRecords = this.filteredRecords.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagedRecords();
  }

  private updateStats() {
    this.stats = {
      totalEvents: this.allHistoryRecords.length,
      joinsCount: this.allHistoryRecords.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes('join') || act.includes('enroll');
      }).length,
      promotionsCount: this.allHistoryRecords.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes('promot') || act.includes('demot') || act.includes('stage');
      }).length,
      dismissalsCount: this.allHistoryRecords.filter(r => {
        const act = (String(r.lifecycleAction || '') + ' ' + String(r.actionType || '')).toLowerCase();
        return act.includes('transfer') || act.includes('dismiss') || act.includes('reliev') || act.includes('remov') || act.includes('graduat') || act.includes('withdraw');
      }).length
    };
  }

  getUserName(val: any): string {
    if (!val) return '-';
    const s = String(val).trim();
    if (this.userMap.has(s)) {
      return this.userMap.get(s)!;
    }
    if (s.length > 20 && !s.includes(' ')) {
      return 'User (' + s.slice(0, 6) + '...)';
    }
    return s;
  }

  getMadrasaName(val: any): string {
    if (!val) return '-';
    const s = String(val).trim();
    if (this.madrasaMap.has(s)) {
      return this.madrasaMap.get(s)!;
    }
    if (s.length > 20 && !s.includes(' ')) {
      return 'Madrasa (' + s.slice(0, 6) + '...)';
    }
    return s;
  }

  private normalizeHistoryItem(h: any): any {
    const rawUser = h.userName || h.name || h.snapshot?.name || h.userId || '';
    const resolvedUser = this.getUserName(rawUser);

    const rawPerformed = h.performedBy || h.createdBy || h.actionPerformedByName || '';
    const resolvedPerformed = this.getUserName(rawPerformed);

    let act = String(h.lifecycleAction || h.actionType || 'Updated');
    if (act.toLowerCase() === 'promotion') act = 'Promoted';
    if (act.toLowerCase() === 'demotion') act = 'Demoted';
    if (act.toLowerCase() === 'transfer') act = 'Transferred';

    return {
      ...h,
      effectiveDate: h.effectiveDate || h.createdAt,
      lifecycleAction: act,
      actionClass: act.toLowerCase(),
      userName: resolvedUser,
      performedBy: resolvedPerformed,
      actionPerformedByName: resolvedPerformed,
    };
  }

  getMillis(dateVal: any): number {
    if (!dateVal) return 0;
    if (typeof dateVal.toMillis === 'function') return dateVal.toMillis();
    if (typeof dateVal.getTime === 'function') return dateVal.getTime();
    if (typeof dateVal === 'number') return dateVal;
    return new Date(dateVal).getTime() || 0;
  }

  formatDateVal(dateVal: any): string {
    if (!dateVal) return '-';
    let ms = 0;
    if (typeof dateVal?.toMillis === 'function') ms = dateVal.toMillis();
    else if (typeof dateVal?.getTime === 'function') ms = dateVal.getTime();
    else if (typeof dateVal === 'number') ms = dateVal;
    else ms = new Date(dateVal).getTime();

    if (!ms || isNaN(ms)) return String(dateVal);
    return new Date(ms).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
}
