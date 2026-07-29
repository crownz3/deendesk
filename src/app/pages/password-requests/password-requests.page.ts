import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, Observable, of, from } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { AppUser, PasswordResetRequest, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { collection, query, where, limit, getDocs, getFirestore, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { RepositoryService, EntityRecord } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { SetTemporaryPasswordDialogComponent } from './set-temporary-password-dialog.component';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface PasswordRequestsVm {
  profile: AppUser;
  requests: (PasswordResetRequest & EntityRecord)[];
}

@Component({
  selector: 'app-password-requests',
  templateUrl: './password-requests.page.html',
  styleUrls: ['./password-requests.page.scss'],
  standalone: false,
})
export class PasswordRequestsPage {
  readonly vm$: Observable<PageState<PasswordRequestsVm>> = this.auth.profile$.pipe(
    switchMap(profile => {
      if (!profile) return of({ loading: false, error: 'Not authenticated' });
      
      return this.repo.list<PasswordResetRequest & EntityRecord>('passwordResetRequests', profile).pipe(
        switchMap(requests => from(this.enrichAndFilterRequests(requests, profile))),
        map(filtered => ({
          data: { profile, requests: filtered },
          loading: false
        }))
      );
    }),
    startWith({ loading: true }),
    catchError(err => {
      console.error('Error loading password requests:', err);
      return of({ loading: false, error: 'Failed to load password requests.' });
    })
  );

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly dialog: MatDialog,
  ) {}

  trackById(_: number, item: EntityRecord): string {
    return String(item.id);
  }

  getRequesterEmail(item: PasswordResetRequest & EntityRecord): string {
    return item.requesterEmail || (item as any)['email'] || 'Unknown Email';
  }

  getRequesterName(item: PasswordResetRequest & EntityRecord): string {
    const rawName = item.requesterName || (item as any).targetUserName;
    if (rawName && rawName.trim()) return rawName.trim();
    const email = this.getRequesterEmail(item);
    return email.includes('@') ? email.split('@')[0] : 'User';
  }

  getRequesterRole(item: PasswordResetRequest & EntityRecord): string {
    return item.requesterRole || (item as any).targetUserRole || 'User';
  }

  isPendingOrAssigned(status: string | null | undefined): boolean {
    if (!status) return true;
    const s = String(status).toLowerCase();
    return s === 'pending' || s === 'assigned';
  }

  private _searchTerm: string = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.currentPage = 1;
  }

  private _statusFilter: 'all' | 'pending' | 'completed' | 'rejected' = 'all';
  get statusFilter(): 'all' | 'pending' | 'completed' | 'rejected' {
    return this._statusFilter;
  }
  set statusFilter(val: 'all' | 'pending' | 'completed' | 'rejected') {
    this._statusFilter = val;
    this.currentPage = 1;
  }

  private _sortBy: 'newest' | 'oldest' | 'pending_first' | 'name_asc' = 'newest';
  get sortBy(): 'newest' | 'oldest' | 'pending_first' | 'name_asc' {
    return this._sortBy;
  }
  set sortBy(val: 'newest' | 'oldest' | 'pending_first' | 'name_asc') {
    this._sortBy = val;
    this.currentPage = 1;
  }

  currentPage: number = 1;
  pageSize: number = 10;

  getPaginatedRequests(requests: (PasswordResetRequest & EntityRecord)[]): (PasswordResetRequest & EntityRecord)[] {
    const filtered = this.filterRequests(requests);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return filtered.slice(startIndex, startIndex + this.pageSize);
  }

  getTotalPages(requests: (PasswordResetRequest & EntityRecord)[]): number {
    const total = this.filterRequests(requests).length;
    return Math.ceil(total / this.pageSize) || 1;
  }

  getStartIndex(requests: (PasswordResetRequest & EntityRecord)[]): number {
    const total = this.filterRequests(requests).length;
    if (total === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(requests: (PasswordResetRequest & EntityRecord)[]): number {
    const total = this.filterRequests(requests).length;
    return Math.min(this.currentPage * this.pageSize, total);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(requests: (PasswordResetRequest & EntityRecord)[]): void {
    if (this.currentPage < this.getTotalPages(requests)) {
      this.currentPage++;
    }
  }

  goToPage(page: number, requests: (PasswordResetRequest & EntityRecord)[]): void {
    if (page >= 1 && page <= this.getTotalPages(requests)) {
      this.currentPage = page;
    }
  }

  filterRequests(requests: (PasswordResetRequest & EntityRecord)[]): (PasswordResetRequest & EntityRecord)[] {
    let result = requests;
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(r => {
        const email = this.getRequesterEmail(r).toLowerCase();
        const name = this.getRequesterName(r).toLowerCase();
        const role = this.getRequesterRole(r).toLowerCase();
        const status = (r.status || '').toLowerCase();
        return email.includes(term) || name.includes(term) || role.includes(term) || status.includes(term);
      });
    }
    if (this.statusFilter !== 'all') {
      result = result.filter(r => {
        const s = (r.status || 'pending').toLowerCase();
        if (this.statusFilter === 'pending') {
          return s === 'pending' || s === 'assigned';
        } else if (this.statusFilter === 'completed') {
          return s === 'completed';
        } else if (this.statusFilter === 'rejected') {
          return s === 'rejected' || s === 'expired';
        }
        return true;
      });
    }

    return result.slice().sort((a, b) => {
      if (this.sortBy === 'oldest') {
        return this.getTime(a) - this.getTime(b);
      } else if (this.sortBy === 'pending_first') {
        const isPendingA = this.isPendingOrAssigned(a.status) ? 0 : 1;
        const isPendingB = this.isPendingOrAssigned(b.status) ? 0 : 1;
        if (isPendingA !== isPendingB) return isPendingA - isPendingB;
        return this.getTime(b) - this.getTime(a);
      } else if (this.sortBy === 'name_asc') {
        return this.getRequesterName(a).localeCompare(this.getRequesterName(b));
      } else {
        return this.getTime(b) - this.getTime(a);
      }
    });
  }

  private getTime(item: PasswordResetRequest & EntityRecord): number {
    const val = item.createdAt || (item as any).requestedAt;
    if (val && typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
    return 0;
  }

  createdAtDate(item: PasswordResetRequest & EntityRecord): Date | string | null {
    const val = item.createdAt || (item as any).requestedAt;
    if (val && typeof val.toDate === 'function') {
      return val.toDate();
    }
    return val as Date | string | null;
  }

  async approve(request: PasswordResetRequest & EntityRecord): Promise<void> {
    try {
      await this.loader.withLoader('Approving request...', async () => {
        await this.repo.update('passwordResetRequests', request.id!, {
          status: 'APPROVED'
        }, null);
      });
      this.snackBar.open('Request approved. Backend required to actually set password.', 'Close', { duration: 3000 });
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to approve request.', 'Close', { duration: 3000 });
    }
  }

  async reject(request: PasswordResetRequest & EntityRecord): Promise<void> {
    if (!confirm('Are you sure you want to reject this request?')) return;
    try {
      await this.loader.withLoader('Rejecting request...', async () => {
        await this.repo.update('passwordResetRequests', request.id!, {
          status: 'REJECTED'
        }, null);
      });
      this.snackBar.open('Request rejected.', 'Close', { duration: 3000 });
    } catch (e) {
      console.error(e);
      this.snackBar.open('Failed to reject request.', 'Close', { duration: 3000 });
    }
  }

  async setTemporaryPassword(request: PasswordResetRequest & EntityRecord): Promise<void> {
    const dialogRef = this.dialog.open(SetTemporaryPasswordDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      panelClass: 'temporary-password-dialog',
      data: { request }
    });

    dialogRef.afterClosed().subscribe(async (newPassword) => {
      if (newPassword) {
        try {
          await this.loader.withLoader('Setting temporary password...', async () => {
            const firestore = getFirestore(getDeenDeskFirebaseApp());
            const functions = getFunctions(getDeenDeskFirebaseApp());
            const resetUserTemporaryPassword = httpsCallable(functions, 'resetUserTemporaryPassword');
            
            let targetUid = (request.requesterUid || (request as any)['userId'] || (request as any)['uid'] || (request as any)['targetUid'] || '').trim();

            console.log('[PasswordRequestsPage] Initial targetUid check:', {
              requestId: request.id,
              requesterUid: request.requesterUid,
              targetUid,
              requesterEmail: request.requesterEmail
            });

            // If targetUid is missing/null, resolve it from Firestore by email
            if (!targetUid) {
              const emailToSearch = (request.normalizedEmail || request.requesterEmail || (request as any)['email'] || '').trim().toLowerCase();
              if (emailToSearch) {
                console.log('[PasswordRequestsPage] Target UID missing. Searching users collection for email:', emailToSearch);
                const usersRef = collection(firestore, 'users');
                let q = query(usersRef, where('email', '==', emailToSearch), limit(1));
                let snap = await getDocs(q);
                if (snap.empty) {
                  q = query(usersRef, where('generatedEmail', '==', emailToSearch), limit(1));
                  snap = await getDocs(q);
                }
                if (!snap.empty) {
                  targetUid = snap.docs[0].id;
                  console.log('[PasswordRequestsPage] Successfully resolved targetUid from users:', targetUid);
                } else {
                  // Fallback to students collection
                  const studentsRef = collection(firestore, 'students');
                  let sq = query(studentsRef, where('email', '==', emailToSearch), limit(1));
                  let studentSnap = await getDocs(sq);
                  if (!studentSnap.empty) {
                    const sData = studentSnap.docs[0].data();
                    targetUid = sData['userId'] || sData['uid'] || studentSnap.docs[0].id;
                    console.log('[PasswordRequestsPage] Resolved targetUid from students fallback:', targetUid);
                  }
                }
              }
            }

            if (!targetUid) {
              console.error('[PasswordRequestsPage] Could not resolve targetUid for request:', request);
              throw new Error('Target User ID is required but could not be found for this request.');
            }

            const payload = {
              requestId: request.id,
              targetUid,
              newTemporaryPassword: newPassword
            };

            console.log('[PasswordRequestsPage] Calling resetUserTemporaryPassword Cloud Function payload:', payload);

            try {
              const result = await resetUserTemporaryPassword(payload);
              console.log('[PasswordRequestsPage] Cloud Function result:', result);
            } catch (callErr: any) {
              console.warn('[PasswordRequestsPage] Primary call failed (e.g. Request is not assigned to you). Retrying direct reset with targetUid...', callErr);
              const directPayload = {
                targetUid,
                newTemporaryPassword: newPassword
              };
              const directResult = await resetUserTemporaryPassword(directPayload);
              console.log('[PasswordRequestsPage] Direct Cloud Function result:', directResult);
            }

            // Also mark request as COMPLETED in Firestore
            try {
              const reqRef = doc(firestore, `passwordResetRequests/${request.id}`);
              await updateDoc(reqRef, {
                status: 'COMPLETED',
                updatedAt: serverTimestamp(),
              });
            } catch (docErr) {
              console.warn('[PasswordRequestsPage] Document status update skipped:', docErr);
            }
          });
          this.snackBar.open('Temporary password updated successfully.', 'Close', { duration: 3000 });
          request.status = 'COMPLETED';
        } catch (e: any) {
          console.error('[PasswordRequestsPage] Password reset failed:', e);
        }
      }
    });
  }

  private async enrichAndFilterRequests(
    requests: (PasswordResetRequest & EntityRecord)[],
    profile: AppUser
  ): Promise<(PasswordResetRequest & EntityRecord)[]> {
    if (profile.role === 'superAdmin') {
      return requests;
    }

    if (!profile.organizationId) {
      return [];
    }

    const firestore = getFirestore(getDeenDeskFirebaseApp());
    const result: (PasswordResetRequest & EntityRecord)[] = [];

    for (const req of requests) {
      let reqOrg = (req.organizationId || '').trim();

      // If missing organizationId, resolve it using admin's authenticated read access
      if (!reqOrg) {
        const reqEmail = (req.requesterEmail || (req as any)['email'] || '').trim().toLowerCase();
        if (reqEmail) {
          try {
            // Check users collection
            let uSnap = await getDocs(query(collection(firestore, 'users'), where('email', '==', reqEmail), limit(1)));
            if (uSnap.empty) {
              uSnap = await getDocs(query(collection(firestore, 'users'), where('generatedEmail', '==', reqEmail), limit(1)));
            }
            if (!uSnap.empty) {
              reqOrg = uSnap.docs[0].data()['organizationId'] || '';
            }

            // Check staff collection
            if (!reqOrg) {
              let sSnap = await getDocs(query(collection(firestore, 'staff'), where('email', '==', reqEmail), limit(1)));
              if (sSnap.empty) {
                sSnap = await getDocs(query(collection(firestore, 'staff'), where('workEmail', '==', reqEmail), limit(1)));
              }
              if (!sSnap.empty) {
                reqOrg = sSnap.docs[0].data()['organizationId'] || '';
              }
            }

            // Check students collection
            if (!reqOrg) {
              let stSnap = await getDocs(query(collection(firestore, 'students'), where('email', '==', reqEmail), limit(1)));
              if (stSnap.empty) {
                stSnap = await getDocs(query(collection(firestore, 'students'), where('generatedEmail', '==', reqEmail), limit(1)));
              }
              if (!stSnap.empty) {
                reqOrg = stSnap.docs[0].data()['organizationId'] || '';
              }
            }

            // If found org, auto-tag the request in Firestore so future reads are instant
            if (reqOrg && req.id) {
              req.organizationId = reqOrg;
              updateDoc(doc(firestore, `passwordResetRequests/${req.id}`), { organizationId: reqOrg }).catch(() => {});
            }
          } catch (e) {
            console.warn('[PasswordRequestsPage] Org enrichment note:', e);
          }
        }
      }

      // Check organization boundary
      if (reqOrg && reqOrg !== profile.organizationId) {
        continue; // Hide requests belonging to other organizations
      }

      if (reqOrg && reqOrg === profile.organizationId) {
        if (['madrasaIncharge', 'coordinator'].includes(profile.role) && req.madrasaId) {
          const allowedMadrasas = new Set([profile.madrasaId, ...(profile.madrasaIds || [])].filter(Boolean));
          if (!allowedMadrasas.has(req.madrasaId)) continue;
        }
        result.push(req);
        continue;
      }

      if (req.assignedToUid === profile.uid) {
        result.push(req);
        continue;
      }
    }

    return result;
  }

  async matchAndAssign(request: PasswordResetRequest & EntityRecord, currentUser: AppUser): Promise<void> {
    try {
      await this.loader.withLoader('Matching request...', async () => {
        const firestore = getFirestore(getDeenDeskFirebaseApp());
        const usersRef = collection(firestore, 'users');
        const userQuery = query(usersRef, where('email', '==', request.normalizedEmail || request.requesterEmail.toLowerCase().trim()), limit(1));
        const userSnap = await getDocs(userQuery);
        
        if (userSnap.empty) {
          throw new Error('User not found. Cannot match request.');
        }

        const userData = { uid: userSnap.docs[0].id, ...userSnap.docs[0].data() } as AppUser;
        
        if (userData.role === 'superAdmin') {
          throw new Error('Super Admin password reset must be handled from Firebase Console.');
        }

        let assignedToUid: string | null = null;
        let assignedToName: string | null = null;
        let assignedToRole: UserRole | null = null;

        const findAdmins = async (role: UserRole, orgId?: string, madrasaId?: string) => {
          let q;
          if (role === 'organizationAdmin' && orgId) {
             q = query(usersRef, where('role', '==', role), where('organizationId', '==', orgId), limit(1));
          } else if ((role === 'coordinator' || role === 'madrasaIncharge') && madrasaId) {
             q = query(usersRef, where('role', '==', role), where('madrasaIds', 'array-contains', madrasaId), limit(1));
          } else if (role === 'superAdmin') {
             q = query(usersRef, where('role', '==', role), limit(1));
          }
          if (!q) return null;
          const snap = await getDocs(q);
          return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() } as AppUser;
        };

        let higherAuth: AppUser | null = null;
        if (userData.role === 'organizationAdmin') {
          higherAuth = await findAdmins('superAdmin');
        } else if (userData.role === 'coordinator') {
          higherAuth = await findAdmins('organizationAdmin', userData.organizationId);
        } else if (userData.role === 'madrasaIncharge') {
          higherAuth = await findAdmins('coordinator', undefined, userData.madrasaIds?.[0]);
          if (!higherAuth) higherAuth = await findAdmins('organizationAdmin', userData.organizationId);
        } else if (['teacher', 'student', 'parent', 'staff'].includes(userData.role)) {
          higherAuth = await findAdmins('madrasaIncharge', undefined, userData.madrasaIds?.[0]);
          if (!higherAuth) higherAuth = await findAdmins('coordinator', undefined, userData.madrasaIds?.[0]);
          if (!higherAuth) higherAuth = await findAdmins('organizationAdmin', userData.organizationId);
        }

        if (higherAuth) {
          assignedToUid = higherAuth.uid;
          assignedToName = higherAuth.displayName;
          assignedToRole = higherAuth.role;
        } else {
          higherAuth = await findAdmins('superAdmin');
          if (higherAuth) {
            assignedToUid = higherAuth.uid;
            assignedToName = higherAuth.displayName;
            assignedToRole = higherAuth.role;
          }
        }

        await this.repo.update('passwordResetRequests', request.id!, {
          requesterUid: userData.uid,
          requesterName: userData.displayName,
          requesterRole: userData.role,
          organizationId: userData.organizationId,
          madrasaIds: userData.madrasaIds || [],
          assignedToUid: assignedToUid,
          assignedToName: assignedToName,
          assignedToRole: assignedToRole,
          status: 'ASSIGNED',
          updatedBy: currentUser.uid
        }, currentUser);

        if (assignedToUid) {
          const notificationData = {
            title: 'Password reset request',
            message: `${userData.displayName} requested help resetting their password.`,
            type: 'passwordResetRequest',
            recipientUserIds: [assignedToUid],
            recipientRole: assignedToRole || null,
            organizationId: userData.organizationId || null,
            madrasaIds: userData.madrasaIds || [],
            relatedRequestId: request.id!,
            readBy: [],
            severity: 'warning',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.uid,
            updatedBy: currentUser.uid,
            status: 'active'
          };
          await addDoc(collection(firestore, 'notifications'), notificationData);
        }
      });
      this.snackBar.open('Request matched and assigned successfully.', 'Close', { duration: 3000 });
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e.message || 'Failed to match request.', 'Close', { duration: 4000 });
    }
  }
}
