import { Injectable } from '@angular/core';
import {
  CollectionReference,
  DocumentData,
  QueryConstraint,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  getDocs,
  documentId,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { AppUser, ScopedEntity } from '../models/domain.model';
import { getDeenDeskFirebaseApp } from './firebase-app';

export type EntityRecord = Record<string, unknown> & ScopedEntity;

@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());

  list<T extends EntityRecord>(collectionName: string, user: AppUser | null, extra: QueryConstraint[] = []): Observable<T[]> {
    const ref = collection(this.firestore, collectionName) as CollectionReference<DocumentData>;
    const constraints = this.scopeConstraints(collectionName, user);
    const q = query(ref, ...constraints, ...extra, limit(500));
    return new Observable<T[]>((subscriber) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        subscriber.next(snapshot.docs.map((row) => ({ id: row.id, ...row.data() }) as T));
      }, (error) => subscriber.error(error));
      return unsubscribe;
    });
  }

  async create<T extends EntityRecord>(collectionName: string, data: T, currentUser: AppUser | null, id?: string): Promise<string> {
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser?.uid ?? 'system',
      updatedBy: currentUser?.uid ?? 'system',
      status: data.status ?? 'active',
    };

    if (id) {
      await setDoc(doc(this.firestore, `${collectionName}/${id}`), payload);
      return id;
    }

    const created = await addDoc(collection(this.firestore, collectionName), payload);
    return created.id;
  }

  async update<T extends EntityRecord>(collectionName: string, id: string, data: Partial<T>, currentUser: AppUser | null): Promise<void> {
    await updateDoc(doc(this.firestore, `${collectionName}/${id}`), {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.uid ?? 'system',
    });
  }

  async remove(collectionName: string, id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `${collectionName}/${id}`));
  }

  async batchCreate(collectionName: string, rows: EntityRecord[], currentUser: AppUser | null): Promise<number> {
    const batch = writeBatch(this.firestore);
    rows.forEach((row) => {
      const ref = doc(collection(this.firestore, collectionName));
      batch.set(ref, {
        ...row,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid ?? 'system',
        updatedBy: currentUser?.uid ?? 'system',
        status: row.status ?? 'active',
      });
    });
    await batch.commit();
    return rows.length;
  }

  async getAllOnce<T extends EntityRecord>(collectionName: string, user: AppUser | null): Promise<T[]> {
    const ref = collection(this.firestore, collectionName) as CollectionReference<DocumentData>;
    const snapshot = await getDocs(query(ref, ...this.scopeConstraints(collectionName, user), limit(1000)));
    return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }) as T);
  }

  private scopeConstraints(collectionName: string, user: AppUser | null): QueryConstraint[] {
    if (!user || user.status !== 'active') {
      return [where('status', '==', '__no_access__')];
    }

    if (user.role === 'superAdmin') {
      return [];
    }

    if (collectionName === 'notifications') {
      return [where('recipientUserIds', 'array-contains', user.uid)];
    }

    if (collectionName === 'users') {
      if (user.role === 'student' || user.role === 'parent' || user.role === 'teacher') {
        return [where('uid', '==', user.uid)];
      }
      if (user.organizationId) {
        return [where('organizationId', '==', user.organizationId)];
      }
    }

    if (user.role === 'organizationAdmin' && user.organizationId) {
      return [where('organizationId', '==', user.organizationId)];
    }

    if (['coordinator', 'madrasaIncharge', 'teacher'].includes(user.role) && user.madrasaIds.length > 0) {
      return [where('madrasaId', 'in', user.madrasaIds.slice(0, 10))];
    }

    if (user.role === 'student') {
      if (collectionName === 'attendance' && user.studentIds.length > 0) {
        return [where('studentId', 'in', user.studentIds.slice(0, 10))];
      }
      return [where('userId', '==', user.uid)];
    }

    if (user.role === 'parent' && user.linkedStudentIds.length > 0) {
      if (collectionName === 'students') {
        return [where(documentId(), 'in', user.linkedStudentIds.slice(0, 10))];
      }
      return [where('studentId', 'in', user.linkedStudentIds.slice(0, 10))];
    }

    return user.organizationId ? [where('organizationId', '==', user.organizationId)] : [where('status', '==', '__no_access__')];
  }
}
