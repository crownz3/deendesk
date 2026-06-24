import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { AppUser, PasswordResetRequest, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { collection, query, where, limit, getDocs, getFirestore, addDoc, serverTimestamp } from 'firebase/firestore';
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
        map(requests => {
          // Client-side filter to only show assigned or org requests based on role
          const filtered = requests.filter(req => {
            if (profile.role === 'superAdmin') return true;
            if (profile.role === 'organizationAdmin') return req.organizationId === profile.organizationId;
            return req.assignedToUid === profile.uid;
          });
          
          return {
            data: { profile, requests: filtered },
            loading: false
          };
        })
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

  createdAtDate(item: PasswordResetRequest & EntityRecord): Date | string | null {
    const val = item.createdAt as any;
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
            const functions = getFunctions(getDeenDeskFirebaseApp());
            const resetUserTemporaryPassword = httpsCallable(functions, 'resetUserTemporaryPassword');
            
            await resetUserTemporaryPassword({
              requestId: request.id,
              targetUid: request.requesterUid,
              newTemporaryPassword: newPassword
            });
          });
          this.snackBar.open('Temporary password updated successfully.', 'Close', { duration: 3000 });
          request.status = 'COMPLETED';
        } catch (e: any) {
          console.error(e);
          this.snackBar.open(e.message || 'Failed to set temporary password.', 'Close', { duration: 4000 });
        }
      }
    });
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
