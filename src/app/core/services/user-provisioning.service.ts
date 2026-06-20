import { Injectable } from '@angular/core';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut as secondarySignOut,
} from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { permissionsForRole } from '../constants/defaults';
import { AppUser, GeneratedCredential, PermissionKey, UserRole } from '../models/domain.model';
import { CredentialService } from './credential.service';
import { getDeenDeskFirebaseApp } from './firebase-app';

export interface ProvisionUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  organizationId?: string;
  madrasaIds?: string[];
  classIds?: string[];
  subjectIds?: string[];
  studentIds?: string[];
  linkedStudentIds?: string[];
  permissions?: PermissionKey[];
  authProvider?: 'password' | 'generated';
}

@Injectable({ providedIn: 'root' })
export class UserProvisioningService {
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());
  private readonly secondaryApp: FirebaseApp;

  constructor(
    private readonly credentials: CredentialService,
  ) {
    this.secondaryApp = getApps().some((app) => app.name === 'deendesk-user-provisioner')
      ? getApp('deendesk-user-provisioner')
      : initializeApp(environment.firebase, 'deendesk-user-provisioner');
  }

  async createAccess(input: ProvisionUserInput, creator: AppUser | null): Promise<GeneratedCredential> {
    const secondaryAuth = getAuth(this.secondaryApp);
    const created = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim().toLowerCase(), input.password);
    await secondarySignOut(secondaryAuth);

    const profile: AppUser = {
      uid: created.user.uid,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName,
      role: input.role,
      permissions: permissionsForRole(input.role, input.permissions),
      status: 'active',
      organizationId: input.organizationId,
      madrasaIds: input.madrasaIds ?? [],
      classIds: input.classIds ?? [],
      subjectIds: input.subjectIds ?? [],
      studentIds: input.studentIds ?? [],
      linkedStudentIds: input.linkedStudentIds ?? [],
      authProvider: input.authProvider ?? 'password',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: creator?.uid ?? 'system',
      updatedBy: creator?.uid ?? 'system',
    };

    await setDoc(doc(this.firestore, `users/${created.user.uid}`), profile);

    return {
      uid: created.user.uid,
      label: input.displayName,
      email: profile.email,
      password: input.password,
      role: input.role,
    };
  }

  async createStudentAndParent(input: {
    studentName: string;
    fatherName: string;
    dateOfBirth: string;
    madrasaId: string;
    organizationId?: string;
    studentEmail?: string;
    parentName?: string;
    courseId?: string;
    classId?: string;
    stage?: string;
    level?: string;
  }, creator: AppUser | null): Promise<GeneratedCredential[]> {
    const generated = this.credentials.buildStudentCredentials(input.studentName, input.fatherName, input.madrasaId, input.dateOfBirth);
    const password = generated.password;
    const studentCredential = await this.createAccess({
      email: input.studentEmail || generated.studentEmail,
      password,
      displayName: input.studentName,
      role: 'student',
      organizationId: input.organizationId,
      madrasaIds: [input.madrasaId],
      authProvider: input.studentEmail ? 'password' : 'generated',
    }, creator);

    const parentCredential = await this.createAccess({
      email: generated.parentEmail,
      password,
      displayName: input.parentName || `${input.fatherName} Parent`,
      role: 'parent',
      organizationId: input.organizationId,
      madrasaIds: [input.madrasaId],
      linkedStudentIds: [],
      authProvider: 'generated',
    }, creator);

    return [studentCredential, parentCredential];
  }
}
