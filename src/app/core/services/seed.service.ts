import { Injectable } from '@angular/core';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { DEFAULT_COURSES, ROLE_PERMISSIONS } from '../constants/defaults';
import { AppUser } from '../models/domain.model';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';

@Injectable({ providedIn: 'root' })
export class SeedService {
  private readonly firestore = getDeenDeskFirestore();

  async seedDefaults(user: AppUser | null): Promise<void> {
    await Promise.all([
      ...Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) =>
        setDoc(doc(this.firestore, `permissionTemplates/${role}`), {
          role,
          permissions,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid ?? 'system',
        }, { merge: true }),
      ),
      ...DEFAULT_COURSES.map((course) =>
        setDoc(doc(this.firestore, `defaultCourses/${course.code}`), {
          ...course,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.uid ?? 'system',
          updatedBy: user?.uid ?? 'system',
        }, { merge: true }),
      ),
    ]);
  }
}
