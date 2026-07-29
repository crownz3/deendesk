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
  collection,
  getDocs,
  query,
  where,
  limit,
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

  async loginWithEmail(inputEmail: string, password: string): Promise<void> {
    const rawEmail = (inputEmail || '').trim();
    const cleanEmail = rawEmail.toLowerCase();

    // 1. Direct Attempt with input email using multi-strategy password matching (trim, mobile casing)
    try {
      const success = await this.attemptPasswordLogin(cleanEmail, password);
      if (success) return;
    } catch (firstErr: any) {
      throw firstErr;
    }

    // 2. Resolved Auth Email Attempt from Firestore (`users` & `staff` & `students`)
    try {
      const resolvedAuthEmail = await this.resolveAuthEmailFromFirestore(rawEmail);
      if (resolvedAuthEmail && resolvedAuthEmail.toLowerCase() !== cleanEmail) {
        console.log('[AuthService] Trying resolved Auth email from Firestore:', resolvedAuthEmail);
        const successResolved = await this.attemptPasswordLogin(resolvedAuthEmail, password);
        if (successResolved) return;
      }
    } catch (resolveErr) {
      console.warn('[AuthService] Firestore email resolution error:', resolveErr);
    }

    // Final direct call to preserve exact error throwing for LoginPage
    await signInWithEmailAndPassword(this.auth, cleanEmail, password);
  }

  private async attemptPasswordLogin(email: string, rawPassword: string): Promise<boolean> {
    const targetEmail = email.trim().toLowerCase();
    const passwordsToTry = new Set<string>();
    
    const p1 = rawPassword;
    const p2 = rawPassword.trim();
    passwordsToTry.add(p1);
    passwordsToTry.add(p2);

    // Mobile auto-capitalization variation (Toggle first letter casing)
    if (p2.length > 0) {
      const firstChar = p2.charAt(0);
      const isUpper = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
      const toggledFirst = isUpper 
        ? firstChar.toLowerCase() + p2.slice(1)
        : firstChar.toUpperCase() + p2.slice(1);
      passwordsToTry.add(toggledFirst);
    }

    for (const pwd of passwordsToTry) {
      try {
        await signInWithEmailAndPassword(this.auth, targetEmail, pwd);
        return true;
      } catch (err: any) {
        if (err?.code === 'auth/too-many-requests' || err?.code === 'auth/user-disabled') {
          throw err;
        }
      }
    }

    return false;
  }

  private async resolveAuthEmailFromFirestore(identifier: string): Promise<string | null> {
    if (!identifier) return null;
    const searchStr = identifier.trim();
    const searchLower = searchStr.toLowerCase();

    const firestore = getFirestore(this.firebaseApp);
    const usersRef = collection(firestore, 'users');

    // Query 1: search users by email (exact & lower)
    let q = query(usersRef, where('email', '==', searchStr), limit(1));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(usersRef, where('email', '==', searchLower), limit(1));
      snap = await getDocs(q);
    }

    // Query 2: search users by generatedEmail / customEmail / parentEmail
    if (snap.empty) {
      q = query(usersRef, where('generatedEmail', '==', searchLower), limit(1));
      snap = await getDocs(q);
    }
    if (snap.empty) {
      q = query(usersRef, where('parentEmail', '==', searchLower), limit(1));
      snap = await getDocs(q);
    }
    if (snap.empty) {
      q = query(usersRef, where('parentGeneratedEmail', '==', searchLower), limit(1));
      snap = await getDocs(q);
    }

    if (!snap.empty) {
      const docData = snap.docs[0].data();
      const resolved = docData['generatedEmail'] || docData['email'] || docData['authEmail'] || docData['studentEmail'] || docData['parentGeneratedEmail'] || null;
      if (resolved) return String(resolved).trim();
    }

    // Query 3: search `students` collection fallback
    const studentsRef = collection(firestore, 'students');
    let sq = query(studentsRef, where('email', '==', searchLower), limit(1));
    let studentSnap = await getDocs(sq);
    if (studentSnap.empty) {
      sq = query(studentsRef, where('generatedEmail', '==', searchLower), limit(1));
      studentSnap = await getDocs(sq);
    }
    if (studentSnap.empty) {
      sq = query(studentsRef, where('parentEmail', '==', searchLower), limit(1));
      studentSnap = await getDocs(sq);
    }

    if (!studentSnap.empty) {
      const sData = studentSnap.docs[0].data();
      const resolved = sData['generatedEmail'] || sData['email'] || sData['studentEmail'] || sData['parentGeneratedEmail'] || null;
      if (resolved) return String(resolved).trim();
    }

    return null;
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

      // 1. Check if an existing staff record was created for this user (by userId, uid, or email)
      try {
        const staffRef = collection(this.firestore, 'staff');
        let staffQ = query(staffRef, where('userId', '==', firebaseUser.uid), limit(1));
        let staffSnap = await getDocs(staffQ);
        if (staffSnap.empty) {
          staffQ = query(staffRef, where('uid', '==', firebaseUser.uid), limit(1));
          staffSnap = await getDocs(staffQ);
        }
        if (staffSnap.empty) {
          staffQ = query(staffRef, where('email', '==', normalizedEmail), limit(1));
          staffSnap = await getDocs(staffQ);
        }

        if (!staffSnap.empty) {
          const staffDoc = staffSnap.docs[0];
          const staffData = staffDoc.data();
          const staffRole = (staffData['role'] as UserRole) || 'teacher';

          const linkedStaffProfile: AppUser = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: normalizedEmail,
            displayName: staffData['name'] || staffData['displayName'] || firebaseUser.displayName || normalizedEmail.split('@')[0],
            role: staffRole,
            permissions: this.rolePermissionsService.getPermissionsForRole(staffRole),
            status: staffData['status'] || 'active',
            organizationId: staffData['organizationId'] || '',
            madrasaId: staffData['madrasaId'] || '',
            madrasaIds: staffData['madrasaIds'] || [],
            entityId: staffDoc.id,
            entityType: 'staff',
            authProvider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'password',
            lastLoginAt: serverTimestamp(),
          };

          await setDoc(userRef, linkedStaffProfile, { merge: true });
          localStorage.setItem('deendesk.lastProfile', JSON.stringify({
            displayName: linkedStaffProfile.displayName,
            email: linkedStaffProfile.email,
            role: ROLE_LABELS[linkedStaffProfile.role],
          }));
          return linkedStaffProfile;
        }
      } catch (e) {
        console.warn('[Auth] Staff profile lookup failed:', e);
      }

      // 2. Check if an existing profile document was pre-created in Firestore under a different ID by email match
      try {
        const usersQuery = query(collection(this.firestore, 'users'), where('email', '==', normalizedEmail));
        const querySnap = await getDocs(usersQuery);
        if (!querySnap.empty) {
          const existingDoc = querySnap.docs[0];
          const existingData = existingDoc.data() as AppUser;
          const linkedProfile: AppUser = {
            ...existingData,
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: normalizedEmail,
            status: existingData.status || 'active',
            lastLoginAt: serverTimestamp(),
          };
          await setDoc(userRef, linkedProfile, { merge: true });
          localStorage.setItem('deendesk.lastProfile', JSON.stringify({
            displayName: linkedProfile.displayName,
            email: linkedProfile.email,
            role: ROLE_LABELS[linkedProfile.role],
          }));
          return linkedProfile;
        }
      } catch (e) {
        console.warn('[Auth] Email-based profile lookup failed:', e);
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
