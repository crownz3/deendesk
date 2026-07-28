import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { RepositoryService, EntityRecord } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { AppUser } from '../../core/models/domain.model';

export interface DuplicateGroup {
  id: string;
  reason: 'Similar Email' | 'Identical Name' | 'Same Phone Number';
  matchScore: string;
  primaryUser: EntityRecord;
  duplicateUser: EntityRecord;
}

@Component({
  selector: 'app-duplicate-users',
  templateUrl: './duplicate-users.page.html',
  styleUrls: ['./duplicate-users.page.scss'],
  standalone: false,
})
export class DuplicateUsersPage implements OnInit {
  readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly filterReason$ = new BehaviorSubject<string>('all');

  loading = true;
  totalScannedUsers = 0;

  duplicateGroups$: Observable<DuplicateGroup[]> = combineLatest([
    this.refresh$,
    this.auth.profile$,
    this.searchQuery$,
    this.filterReason$,
  ]).pipe(
    switchMap(([_, profile, searchQuery, filterReason]) => {
      this.loading = true;
      return combineLatest([
        this.repo.list<EntityRecord>('users', profile).pipe(catchError(() => of([]))),
        this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
      ]).pipe(
        map(([users, staffRows]) => {
          const staffMap = new Map<string, EntityRecord>();
          staffRows.forEach((s) => {
            const uid = String(s['userId'] || s['uid'] || s.id || '');
            if (uid) staffMap.set(uid, s);
            const email = String(s['email'] || '').toLowerCase().trim();
            if (email) staffMap.set(email, s);
          });

          const merged = users.map((userRow) => {
            const uid = String(userRow['uid'] || userRow.id || '');
            const email = String(userRow['email'] || '').toLowerCase().trim();
            const staffDoc = (uid ? staffMap.get(uid) : undefined) || (email ? staffMap.get(email) : undefined);
            
            const rawStatus = userRow['status'] || staffDoc?.['status'] || 'active';
            const effectiveStatus = (rawStatus === 'inactive' || rawStatus === 'disabled') ? 'inactive' : 'active';

            if (staffDoc) {
              return {
                ...userRow,
                name: staffDoc['name'] || staffDoc['displayName'] || userRow['name'] || userRow['displayName'],
                displayName: staffDoc['displayName'] || staffDoc['name'] || userRow['displayName'] || userRow['name'],
                mobileNumber: staffDoc['mobileNumber'] || staffDoc['phone'] || userRow['mobileNumber'] || userRow['phone'],
                phone: staffDoc['phone'] || staffDoc['mobileNumber'] || userRow['phone'] || userRow['mobileNumber'],
                status: effectiveStatus,
                role: userRow['role'] || staffDoc['role'],
                staffEntityId: staffDoc.id,
              };
            }
            return {
              ...userRow,
              status: effectiveStatus,
            };
          });

          this.totalScannedUsers = merged.length;
          const groups = this.detectDuplicates(merged);
          this.loading = false;

          let filtered = groups;
          if (filterReason !== 'all') {
            filtered = filtered.filter((g) => g.reason === filterReason);
          }

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(
              (g) =>
                (g.primaryUser['displayName'] || g.primaryUser['name'] || '').toLowerCase().includes(q) ||
                (g.primaryUser['email'] || '').toLowerCase().includes(q) ||
                (g.duplicateUser['displayName'] || g.duplicateUser['name'] || '').toLowerCase().includes(q) ||
                (g.duplicateUser['email'] || '').toLowerCase().includes(q)
            );
          }

          return filtered;
        })
      );
    })
  );

  constructor(
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {}

  refresh(): void {
    this.repo.clearCache();
    this.refresh$.next();
  }

  private detectDuplicates(users: EntityRecord[]): DuplicateGroup[] {
    const normalizeName = (name: string) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizeEmail = (email: string) => (email || '').toLowerCase().trim();

    const isParent = (u: EntityRecord) => {
      const role = String(u['role'] || '');
      const roles = Array.isArray(u['roles']) ? u['roles'].map(String) : [];
      return role === 'parent' || roles.includes('parent');
    };

    const groups: DuplicateGroup[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < users.length; i++) {
      const u1 = users[i];
      if (isParent(u1)) continue;
      const id1 = String(u1['uid'] || u1.id || '');
      if (!id1) continue;

      const name1 = normalizeName(String(u1['displayName'] || u1['name'] || ''));
      const email1 = normalizeEmail(String(u1['email'] || ''));
      const phone1 = String(u1['mobileNumber'] || u1['phone'] || '').trim();

      for (let j = i + 1; j < users.length; j++) {
        const u2 = users[j];
        if (isParent(u2)) continue;
        const id2 = String(u2['uid'] || u2.id || '');
        if (!id2 || id1 === id2) continue;

        const pairKey = [id1, id2].sort().join('::');
        if (seenPairs.has(pairKey)) continue;

        const name2 = normalizeName(String(u2['displayName'] || u2['name'] || ''));
        const email2 = normalizeEmail(String(u2['email'] || ''));
        const phone2 = String(u2['mobileNumber'] || u2['phone'] || '').trim();

        let reason: 'Similar Email' | 'Identical Name' | 'Same Phone Number' | null = null;
        let score = '';

        if (email1 && email2 && this.isSimilarEmail(email1, email2)) {
          reason = 'Similar Email';
          score = email1 === email2 ? '100% Exact Email Match' : '90% Similar Email Typo';
        } else if (name1 && name2 && name1.length >= 3 && name1 === name2) {
          reason = 'Identical Name';
          score = '100% Identical Name';
        } else if (phone1 && phone2 && phone1.length >= 10 && phone1 === phone2) {
          reason = 'Same Phone Number';
          score = '100% Same Phone Number';
        }

        if (reason) {
          seenPairs.add(pairKey);
          groups.push({
            id: pairKey,
            reason,
            matchScore: score,
            primaryUser: u1,
            duplicateUser: u2,
          });
        }
      }
    }

    return groups;
  }

  private isSimilarEmail(e1: string, e2: string): boolean {
    if (e1 === e2) return true;
    const [user1, domain1] = e1.split('@');
    const [user2, domain2] = e2.split('@');
    if (!user1 || !user2 || domain1 !== domain2) return false;
    if (user1.includes(user2) || user2.includes(user1)) return true;

    let diff = 0;
    const maxLen = Math.max(user1.length, user2.length);
    for (let i = 0; i < maxLen; i++) {
      if (user1[i] !== user2[i]) diff++;
    }
    return diff <= 2;
  }

  async deleteAccount(user: EntityRecord): Promise<void> {
    const userId = String(user['uid'] || user.id || '');
    const userName = user['displayName'] || user['name'] || user['email'];

    const confirm = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Delete Duplicate Account',
            message: `Are you sure you want to permanently delete account "${userName}" (${user['email']})? This action cannot be undone.`,
            confirmLabel: 'Permanently Delete',
            isDestructive: true,
          },
        })
        .afterClosed()
    );

    if (!confirm) return;

    try {
      await this.repo.remove('users', userId);
      if (user['staffEntityId']) {
        await this.repo.remove('staff', String(user['staffEntityId'])).catch(() => {});
      }
      this.snackBar.open(`Account "${userName}" deleted successfully!`, 'Close', { duration: 4000 });
      this.refresh();
    } catch (err: any) {
      console.error('[DuplicateUsersPage] Delete failed:', err);
      this.snackBar.open(`Failed to delete account: ${err.message || err}`, 'Close', { duration: 5000 });
    }
  }

  async deactivateAccount(user: EntityRecord): Promise<void> {
    const userId = String(user['uid'] || user.id || '');
    const userName = user['displayName'] || user['name'] || user['email'];

    const confirm = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Deactivate Account',
            message: `Deactivate account "${userName}" (${user['email']})? The account status will be set to inactive.`,
            confirmLabel: 'Deactivate',
            isDestructive: true,
          },
        })
        .afterClosed()
    );

    if (!confirm) return;

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      await this.repo.update('users', userId, { status: 'inactive' }, profile);
      if (user['staffEntityId']) {
        await this.repo.update('staff', String(user['staffEntityId']), { status: 'inactive' }, profile).catch(() => {});
      }
      this.snackBar.open(`Account "${userName}" deactivated!`, 'Close', { duration: 4000 });
      this.refresh();
    } catch (err: any) {
      console.error('[DuplicateUsersPage] Deactivate failed:', err);
      this.snackBar.open(`Failed to deactivate account: ${err.message || err}`, 'Close', { duration: 5000 });
    }
  }
}
