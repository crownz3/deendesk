import { Injectable } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  signInWithCustomToken,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  deleteField,
  doc,
  getFirestore,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, map, shareReplay, switchMap, of, combineLatest, catchError, startWith, timeout } from 'rxjs';
import { ALL_PERMISSIONS, ROLE_LABELS, SUPER_ADMIN_EMAIL } from '../constants/defaults';
import { RolePermissionsService } from './role-permissions.service';
import { AppUser, PermissionKey, UserRole } from '../models/domain.model';
import { getDeenDeskFirebaseApp } from './firebase-app';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseApp = getDeenDeskFirebaseApp();
  private readonly auth = getAuth(this.firebaseApp);
  private readonly firestore = getFirestore(this.firebaseApp);
  private readonly loadingProfileSubject = new BehaviorSubject<boolean>(true);

  readonly authUser$ = new Observable<User | null>((subscriber) => {
    const unsubscribe = onAuthStateChanged(this.auth, (user) => subscriber.next(user), (error) => subscriber.error(error));
    return unsubscribe;
  }).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly profile$: Observable<AppUser | null> = this.authUser$.pipe(
    switchMap((user) => {
      if (!user) {
        return of(null);
      }
      return from(this.resolveProfile(user)).pipe(
        timeout(10000),
        switchMap((resolvedProfile) => {
          if (!resolvedProfile) {
            return of(null);
          }
          const userRef = doc(this.firestore, `users/${user.uid}`);
          return new Observable<AppUser>((subscriber) => {
            const unsubscribe = onSnapshot(userRef, (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data() as AppUser;
                subscriber.next({
                  id: snapshot.id,
                  ...data,
                  email: user.email?.toLowerCase() || data.email,
                  photoURL: data.photoURL || user.photoURL || '',
                });
              } else {
                subscriber.next(resolvedProfile);
              }
            }, (error) => subscriber.error(error));
            return unsubscribe;
          }).pipe(
            switchMap(baseProfile => {
              if (baseProfile?.entityType && baseProfile?.entityId) {
                 const collectionName = baseProfile.entityType === 'staff' ? 'staff' : baseProfile.entityType === 'student' ? 'students' : 'parents';
                 const entityRef = doc(this.firestore, `${collectionName}/${baseProfile.entityId}`);
                 return new Observable<AppUser>((entitySub) => {
                    const unsubEntity = onSnapshot(entityRef, (entitySnap) => {
                       if (entitySnap.exists()) {
                          entitySub.next({ ...baseProfile, ...entitySnap.data(), id: baseProfile.id });
                       } else {
                          entitySub.next(baseProfile);
                       }
                    }, (err) => {
                       console.error('[Auth] Failed to load business entity:', err);
                       entitySub.next(baseProfile);
                    });
                    return unsubEntity;
                 });
              }
              return of(baseProfile);
            }),
            catchError(error => {
              console.error('[Auth] profile$ snapshot failed:', error);
              return of(null);
            })
          );
        }),
        catchError(error => {
          console.error('[Auth] profile$ failed:', error);
          return of(null);
        })
      );
    }),
    map((profile) => {
      this.loadingProfileSubject.next(false);
      return profile;
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly authReady$: Observable<boolean> = combineLatest([this.authUser$, this.profile$]).pipe(
    map(() => true),
    catchError(() => of(true)),
    startWith(false)
  );
  readonly loadingProfile$ = this.loadingProfileSubject.asObservable();

  constructor(
    private readonly router: Router,
    private readonly rolePermissionsService: RolePermissionsService
  ) { }

  async loginWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email.trim().toLowerCase(), password);
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.auth, provider);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    localStorage.removeItem('deendesk.lastProfile');
    await this.router.navigateByUrl('/login');
  }

  async impersonateUser(targetUid: string): Promise<void> {
    const functions = getFunctions(this.firebaseApp);
    const impersonateFn = httpsCallable<{ targetUid: string }, { token: string }>(functions, 'impersonateUser');
    
    try {
      const result = await impersonateFn({ targetUid });
      const customToken = result.data.token;
      
      // Attempt login with custom token
      await signInWithCustomToken(this.auth, customToken);
      
      // Clear any cached profile
      localStorage.removeItem('deendesk.lastProfile');
      
      // Redirect to home/dashboard
      await this.router.navigateByUrl('/');
    } catch (error: any) {
      console.error('[AuthService] Impersonation failed:', error);
      throw new Error(error?.message || 'Failed to login as the specified user.');
    }
  }

  async sendReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email.trim());
  }

  async changeTemporaryPassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) {
      throw new Error('Not logged in');
    }

    console.log('[Password Change Auth Start Debug]', {
      email: user.email,
      uid: user.uid,
    });

    const credential = EmailAuthProvider.credential(user.email, currentPassword.trim());
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword.trim());

    console.log('[Password Change Auth Success Debug]', {
      uid: user.uid,
      email: user.email,
    });

    const userRef = doc(this.firestore, `users/${user.uid}`);
    
    console.log('[Password Change Firestore Update Debug]', {
      path: `users/${user.uid}`,
      patch: {
        mustChangePassword: false,
        temporaryPasswordForAdminView: 'deleteField()',
        passwordChangedAt: 'serverTimestamp',
        updatedAt: 'serverTimestamp',
        updatedBy: user.uid
      }
    });

    try {
      await updateDoc(userRef, {
        mustChangePassword: false,
        temporaryPasswordForAdminView: deleteField(),
        passwordChangedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
    } catch (error: any) {
      console.error('[Password Change Firestore Update Failed]', {
        path: `users/${user.uid}`,
        errorCode: error?.code,
        errorMessage: error?.message,
        error,
      });
      throw new Error('Password changed in Firebase Auth, but profile update failed. Please contact admin.');
    }

    const snap = await getDoc(userRef);
    console.log('[Password Change Profile After Update Debug]', {
      exists: snap.exists(),
      uid: user.uid,
      profile: snap.exists() ? {
        role: snap.data()?.['role'],
        status: snap.data()?.['status'],
        mustChangePassword: snap.data()?.['mustChangePassword'],
        temporaryPasswordForAdminView: snap.data()?.['temporaryPasswordForAdminView'],
        passwordChangedAt: snap.data()?.['passwordChangedAt'],
        organizationId: snap.data()?.['organizationId'],
        madrasaId: snap.data()?.['madrasaId'],
        madrasaIds: snap.data()?.['madrasaIds'],
      } : null
    });

    if (snap.exists()) {
      const data = snap.data();
      if (data['organizationId']) {
        const orgRef = doc(this.firestore, `organizations/${data['organizationId']}`);
        await updateDoc(orgRef, { organizerPassword: deleteField() }).catch(() => { });
      }
    }
  }

  hasPermission(user: AppUser | null | undefined, permission: PermissionKey): boolean {
    if (!user || user.status !== 'active') {
      return false;
    }

    if (user.role === 'superAdmin') {
      return true;
    }

    const rolePermissions = this.rolePermissionsService.getPermissionsForRole(user.role);
    if (rolePermissions.includes(permission)) {
      return true;
    }

    return user.permissions?.includes(permission) ?? false;
  }

  hasAnyPermission(user: AppUser | null | undefined, permissions: PermissionKey[]): boolean {
    return permissions.some((permission) => this.hasPermission(user, permission));
  }

  hasRole(user: AppUser | null | undefined, roles: UserRole[]): boolean {
    return Boolean(user && user.status === 'active' && roles.includes(user.role));
  }

  private async resolveProfile(firebaseUser: User | null): Promise<AppUser | null> {
    if (!firebaseUser || !firebaseUser.email) {
      return null;
    }

    try {
      console.log('[Auth] Auth user changed:', firebaseUser.uid, firebaseUser.email);
      console.log('[Auth] Resolving profile for uid:', firebaseUser.uid);

      await this.rolePermissionsService.loadTemplates();

      this.loadingProfileSubject.next(true);
      const userRef = doc(this.firestore, `users/${firebaseUser.uid}`);
      const snapshot = await getDoc(userRef);
      const normalizedEmail = firebaseUser.email.toLowerCase();

      console.log('[Auth] Profile doc exists:', snapshot.exists());

      if (snapshot.exists()) {
        const profile = { id: snapshot.id, ...(snapshot.data() as AppUser) };
        console.log('[Auth] Profile data:', profile);
        await updateDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          email: normalizedEmail,
          photoURL: profile.photoURL || firebaseUser.photoURL || '',
        });
        localStorage.setItem('deendesk.lastProfile', JSON.stringify({
          displayName: profile.displayName,
          email: profile.email,
          role: ROLE_LABELS[profile.role],
        }));
        return { ...profile, email: normalizedEmail, photoURL: profile.photoURL || firebaseUser.photoURL || '' };
      }

      if (normalizedEmail === SUPER_ADMIN_EMAIL) {
        const superProfile: AppUser = {
          uid: firebaseUser.uid,
          email: normalizedEmail,
          displayName: firebaseUser.displayName || 'Mohamed Ibrahim',
          role: 'superAdmin',
          permissions: ALL_PERMISSIONS,
          status: 'active',
          madrasaIds: [],
          classIds: [],
          subjectIds: [],
          studentIds: [],
          linkedStudentIds: [],
          authProvider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'password',
          photoURL: firebaseUser.photoURL ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(userRef, superProfile);
        return { ...superProfile, id: firebaseUser.uid };
      }

      const pendingProfile: AppUser = {
        uid: firebaseUser.uid,
        email: normalizedEmail,
        displayName: firebaseUser.displayName || normalizedEmail.split('@')[0],
        role: 'student',
        permissions: this.rolePermissionsService.getPermissionsForRole('student'),
        status: 'pending',
        madrasaIds: [],
        classIds: [],
        subjectIds: [],
        studentIds: [],
        linkedStudentIds: [],
        authProvider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'password',
        photoURL: firebaseUser.photoURL ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await setDoc(userRef, pendingProfile);
      await setDoc(doc(this.firestore, `accessRequests/${firebaseUser.uid}`), {
        userId: firebaseUser.uid,
        email: normalizedEmail,
        displayName: pendingProfile.displayName,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { ...pendingProfile, id: firebaseUser.uid };
    } catch (error) {
      console.error('[Auth] Failed to resolve profile:', error);
      return null;
    }
  }
}
