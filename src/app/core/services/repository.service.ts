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
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppUser, ScopedEntity } from '../models/domain.model';
import { getDeenDeskFirebaseApp } from './firebase-app';

export type EntityRecord = Record<string, unknown> & ScopedEntity;

@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());

  list<T extends EntityRecord>(collectionName: string, user: AppUser | null, extra: QueryConstraint[] = [], options?: { roles?: string[] }): Observable<T[]> {
    const ref = collection(this.firestore, collectionName) as CollectionReference<DocumentData>;
    const constraintGroups = this.scopeConstraints(collectionName, user, options);

    console.log('[Repository Query Debug]', {
      collectionName,
      role: user?.role,
      queryGroupCount: constraintGroups.length,
      scopeType: user?.role || 'anonymous'
    });

    if (constraintGroups.length === 0) {
      return of([]);
    }

    const observables = constraintGroups.map((constraints, index) => {
      console.log(`[Firestore Query - Group ${index}] collection=${collectionName}`, constraints);
      const q = query(ref, ...constraints, ...extra, limit(500));
      return new Observable<T[]>((subscriber) => {
        return onSnapshot(q, (snapshot) => {
          subscriber.next(snapshot.docs.map((row) => ({ id: row.id, ...row.data() }) as T));
        }, (error: any) => {
          console.error('[Firestore Query Failed]', {
            collectionName,
            role: user?.role,
            requestedRoles: options?.roles,
            organizationId: user?.organizationId,
            madrasaIds: user?.madrasaIds,
            errorCode: error?.code,
            errorMessage: error?.message,
            error,
          });
          console.warn('[Firestore Permission Debug]', {
            collectionName,
            ruleExpectation: 'Frontend query must match same organization, allowed role, and assigned madrasa scope',
            currentUserRole: user?.role,
            organizationId: user?.organizationId,
            madrasaIds: user?.madrasaIds,
          });
          subscriber.next([]); // Fallback to empty array so other queries succeed
        });
      });
    });

    return combineLatest(observables).pipe(
      map(results => {
        const merged = results.reduce((acc, val) => acc.concat(val), [] as T[]);
        const uniqueMap = new Map<string, T>();
        merged.forEach((item: T) => {
          if (item.id && !uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        });
        const docs = Array.from(uniqueMap.values());
        return this.inMemoryFilter(collectionName, docs, user);
      })
    );
  }

  private normalizeUserPayload(collectionName: string, data: any): any {
    if (!['users', 'coordinators', 'incharges', 'staff', 'students', 'parents'].includes(collectionName)) {
      return data;
    }
    const normalized = { ...data };
    
    if (normalized.role) {
      if (['student', 'STUDENT'].includes(normalized.role)) normalized.role = 'student';
      else if (['parent', 'PARENT'].includes(normalized.role)) normalized.role = 'parent';
      else if (['teacher', 'TEACHER', 'staff', 'STAFF'].includes(normalized.role)) normalized.role = 'teacher';
      else if (['coordinator', 'COORDINATOR'].includes(normalized.role)) normalized.role = 'coordinator';
      else if (['madrasaIncharge', 'MADRASA_INCHARGE', 'madrasaincharge'].includes(normalized.role)) normalized.role = 'madrasaIncharge';
      else if (['organizationAdmin', 'ORGANIZATION_ADMIN', 'organizationadmin'].includes(normalized.role)) normalized.role = 'organizationAdmin';
      else if (['superAdmin', 'SUPER_ADMIN', 'superadmin'].includes(normalized.role)) normalized.role = 'superAdmin';
    }

    if (normalized.permissions === undefined) normalized.permissions = [];
    if (normalized.madrasaIds === undefined) normalized.madrasaIds = [];
    if (normalized.classIds === undefined) normalized.classIds = [];
    if (normalized.subjectIds === undefined) normalized.subjectIds = [];
    if (normalized.teacherIds === undefined) normalized.teacherIds = [];
    if (normalized.linkedStudentIds === undefined) normalized.linkedStudentIds = [];

    return normalized;
  }

  async create<T extends EntityRecord>(collectionName: string, data: T, currentUser: AppUser | null, id?: string): Promise<string> {
    console.log(`[Firestore Write - CREATE] userUid=${currentUser?.uid}, role=${currentUser?.role}, orgId=${currentUser?.organizationId}, permissions=${currentUser?.permissions?.join(',')}, collection=${collectionName}, targetId=${id || 'auto'}, payload=`, data);

    const normalizedData = this.normalizeUserPayload(collectionName, data);

    const payload = {
      ...normalizedData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser?.uid ?? 'system',
      updatedBy: currentUser?.uid ?? 'system',
      status: normalizedData.status ?? 'active',
    };

    if (id) {
      await setDoc(doc(this.firestore, `${collectionName}/${id}`), payload);
      return id;
    }

    const created = await addDoc(collection(this.firestore, collectionName), payload);
    return created.id;
  }

  async update<T extends EntityRecord>(collectionName: string, id: string, data: Partial<T>, currentUser: AppUser | null): Promise<void> {
    console.log(`[Firestore Write - UPDATE] userUid=${currentUser?.uid}, role=${currentUser?.role}, collection=${collectionName}, targetId=${id}, payload=`, data);
    
    const normalizedData = this.normalizeUserPayload(collectionName, data);
    
    await updateDoc(doc(this.firestore, `${collectionName}/${id}`), {
      ...normalizedData,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.uid ?? 'system',
    });
  }

  async remove(collectionName: string, id: string): Promise<void> {
    console.log(`[Firestore Write - DELETE] collection=${collectionName}, targetId=${id}`);
    await deleteDoc(doc(this.firestore, `${collectionName}/${id}`));
  }

  async batchCreate(collectionName: string, rows: EntityRecord[], currentUser: AppUser | null): Promise<number> {
    const batch = writeBatch(this.firestore);
    rows.forEach((row) => {
      const normalizedRow = this.normalizeUserPayload(collectionName, row);
      const ref = doc(collection(this.firestore, collectionName));
      batch.set(ref, {
        ...normalizedRow,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid ?? 'system',
        updatedBy: currentUser?.uid ?? 'system',
        status: normalizedRow.status ?? 'active',
      });
    });
    await batch.commit();
    return rows.length;
  }

  async getAllOnce<T extends EntityRecord>(collectionName: string, user: AppUser | null, options?: { roles?: string[] }, extra: QueryConstraint[] = []): Promise<T[]> {
    const ref = collection(this.firestore, collectionName) as CollectionReference<DocumentData>;
    const constraintGroups = this.scopeConstraints(collectionName, user, options);

    console.log('[Repository Query Debug]', {
      collectionName,
      role: user?.role,
      queryGroupCount: constraintGroups.length,
      scopeType: user?.role || 'anonymous'
    });

    if (constraintGroups.length === 0) {
      return [];
    }

    const promises = constraintGroups.map(constraints => 
      getDocs(query(ref, ...constraints, ...extra, limit(1000)))
    );

    const snapshots = await Promise.all(promises);
    const uniqueMap = new Map<string, T>();
    
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(row => {
        const item = { id: row.id, ...row.data() } as T;
        if (item.id && !uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
    });

    return this.inMemoryFilter(collectionName, Array.from(uniqueMap.values()), user);
  }

  private inMemoryFilter<T extends EntityRecord>(collectionName: string, docs: T[], user: AppUser | null): T[] {
    if (!user) return docs;
    const role = user.role?.toLowerCase() || '';

    if (role === 'superadmin' || role === 'organizationadmin') {
      return docs;
    }

    if (['coordinator', 'madrasaincharge', 'teacher', 'staff'].includes(role)) {
      const allowedMadrasas = user.madrasaIds || [];
      const allowedClasses = user.classIds || [];
      const allowedSubjects = user.subjectIds || [];
      
      return docs.filter(doc => {
        if (collectionName === 'organizations') return true;
        if (collectionName === 'users' && doc.id === user.uid) return true;
        if (collectionName === 'passwordResetRequests' && doc['assignedToUid'] === user.uid) return true;
        if (collectionName === 'notifications') return true;

        if (collectionName === 'madrasas') {
          return allowedMadrasas.includes(doc.id || '');
        }

        if (role === 'teacher' || role === 'staff') {
            if (collectionName === 'classes') {
                if (allowedClasses.includes(doc.id || '')) return true;
                if (Array.isArray(doc['teacherIds']) && doc['teacherIds'].includes(user.uid)) return true;
                return false;
            }
            if (collectionName === 'subjects') {
                if (allowedSubjects.includes(doc.id || '')) return true;
                if (Array.isArray(doc['teacherIds']) && doc['teacherIds'].includes(user.uid)) return true;
                if (doc['classId'] && allowedClasses.includes(String(doc['classId']))) return true;
                return false;
            }
            if (collectionName === 'courses') {
                return false;
            }
            if (collectionName === 'students') {
                if (doc['classId'] && allowedClasses.includes(String(doc['classId']))) return true;
                return false;
            }
            if (collectionName === 'classPlans') {
                if (Array.isArray(doc['assignedStaffIds']) && doc['assignedStaffIds'].includes(user.uid)) return true;
                return false;
            }
            if (collectionName === 'classPlanExceptions') {
                return false;
            }
        }

        let hasMatch = false;
        let checked = false;

        if (doc['madrasaId']) {
          checked = true;
          if (allowedMadrasas.includes(String(doc['madrasaId']))) hasMatch = true;
        }

        if (Array.isArray(doc['madrasaIds'])) {
          checked = true;
          const docMadrasas = doc['madrasaIds'] as string[];
          if (docMadrasas.some(id => allowedMadrasas.includes(id))) hasMatch = true;
        }

        if (!doc['madrasaId'] && !doc['madrasaIds'] && ['courses', 'classes', 'subjects', 'classPlans', 'classPlanExceptions'].includes(collectionName)) {
            // Global academic data check
            if (doc['organizationId'] === user.organizationId) return true;
        }

        if (checked) return hasMatch;

        return true;
      });
    }

    return docs;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private scopeConstraints(collectionName: string, user: AppUser | null, options?: { roles?: string[] }): QueryConstraint[][] {
    console.log('[Scope Rule Comparison Debug]', {
      collectionName,
      currentUser: {
        uid: user?.uid,
        role: user?.role,
        organizationId: user?.organizationId,
        madrasaId: user?.madrasaId,
        madrasaIds: user?.madrasaIds,
        classIds: user?.classIds,
        subjectIds: user?.subjectIds,
        teacherIds: user?.teacherIds,
        permissions: user?.permissions,
      },
      requested: {
        collectionName,
        roles: options?.roles,
      },
      expectedRuleForMadrasaIncharge: {
        users: {
          sameOrgRequired: true,
          allowedRoles: ['teacher', 'staff', 'student', 'parent'],
          requiredScope: 'madrasaId in currentUser.madrasaIds OR madrasaIds array-contains-any currentUser.madrasaIds',
        },
        academicCollections: {
          collections: ['courses', 'classes', 'subjects', 'academicPlans', 'classPlans', 'classPlanExceptions'],
          sameOrgRequired: true,
          requiredScope: 'madrasaId in currentUser.madrasaIds OR madrasaId == empty string for global organization academic data',
        },
      },
    });

    const groups = this._scopeConstraintsImpl(collectionName, user, options);

    console.log('[Built Query Groups Debug]', {
      collectionName,
      role: user?.role,
      requestedRoles: options?.roles,
      queryGroupCount: groups.length,
      queryGroupsSummary: groups.map((group, index) => ({
        index,
        constraintsCount: group.length,
      })),
    });

    if (groups.length === 0) {
      console.warn('[No Query Groups Built]', {
        collectionName,
        role: user?.role,
        requestedRoles: options?.roles,
        organizationId: user?.organizationId,
        madrasaIds: user?.madrasaIds,
      });
    }

    return groups;
  }

  private _scopeConstraintsImpl(collectionName: string, user: AppUser | null, options?: { roles?: string[] }): QueryConstraint[][] {
    if (!user || user.status !== 'active') {
      return [];
    }

    const role = user.role?.toLowerCase() || '';

    if (role === 'superadmin') {
      if (collectionName === 'users' && options?.roles?.length) {
        return options.roles.map(r => [where('role', '==', r)]);
      }
      return [[]]; // No constraints
    }

    if (collectionName === 'notifications') {
      return [[where('recipientUserIds', 'array-contains', user.uid)]];
    }

    if (collectionName === 'passwordResetRequests') {
      if (role === 'organizationadmin' && user.organizationId) {
        return [[where('organizationId', '==', user.organizationId)]];
      }
      return [[where('assignedToUid', '==', user.uid)]];
    }

    if (collectionName === 'organizations') {
      if (['organizationadmin', 'coordinator', 'madrasaincharge', 'teacher', 'staff'].includes(role) && user.organizationId) {
        return [[where(documentId(), '==', user.organizationId)]];
      }
      return [];
    }

    if (role === 'organizationadmin') {
      if (user.organizationId) {
        if (collectionName === 'users' && options?.roles?.length) {
          return options.roles.map(r => [where('organizationId', '==', user.organizationId), where('role', '==', r)]);
        }
        return [[where('organizationId', '==', user.organizationId)]];
      }
      return [];
    }

    if (role === 'coordinator' || role === 'madrasaincharge') {
      const orgId = user.organizationId;
      const madrasaScope = Array.isArray(user.madrasaIds) && user.madrasaIds.length > 0 
        ? user.madrasaIds 
        : (user.madrasaId ? [user.madrasaId] : []);

      if (!orgId || madrasaScope.length === 0) {
        console.warn('[Repository Users Scope Empty]', { role, orgId, madrasaScope });
        return [];
      }

      const madrasaChunks = this.chunkArray(madrasaScope, 9);
      const groups: QueryConstraint[][] = [];

      if (collectionName === 'madrasas') {
        madrasaChunks.forEach(chunk => {
          groups.push([where('organizationId', '==', orgId), where(documentId(), 'in', chunk)]);
        });
        return groups;
      }

      if (collectionName === 'users') {
        const allowedRoles = role === 'coordinator' 
          ? ['madrasaIncharge', 'teacher', 'staff', 'student', 'parent']
          : ['teacher', 'staff', 'student', 'parent'];

        const finalRoles = options?.roles?.length 
          ? options.roles.filter(r => allowedRoles.includes(r))
          : allowedRoles;

        console.log('[Repository Users Scope Debug]', {
          collectionName,
          currentUser: {
            uid: user?.uid,
            role: user?.role,
            organizationId: user?.organizationId,
            madrasaId: user?.madrasaId,
            madrasaIds: user?.madrasaIds,
            permissions: user?.permissions,
          },
          requestedRoles: options?.roles,
          allowedRolesForMadrasaIncharge: ['teacher', 'staff', 'student', 'parent'],
        });

        console.log('[Repository Users Final Roles Debug]', {
          requestedRoles: options?.roles,
          finalRoles,
          blockedRoles: (options?.roles ?? []).filter((role: string) => !finalRoles.includes(role)),
        });

        if (finalRoles.length === 0) {
          return [];
        }

        finalRoles.forEach(targetRole => {
          madrasaScope.forEach(madrasaId => {
            console.log('[Executing Users Query Debug]', {
              collectionName,
              role: targetRole,
              queryType: 'madrasaId',
              organizationId: user?.organizationId,
              madrasaId,
              constraints: ['organizationId ==', 'role ==', 'madrasaId =='],
            });
            groups.push([where('organizationId', '==', orgId), where('role', '==', targetRole), where('madrasaId', '==', madrasaId)]);

            console.log('[Executing Users Query Debug]', {
              collectionName,
              role: targetRole,
              queryType: 'madrasaIds',
              organizationId: user?.organizationId,
              madrasaId,
              constraints: ['organizationId ==', 'role ==', 'madrasaIds array-contains'],
            });
            groups.push([where('organizationId', '==', orgId), where('role', '==', targetRole), where('madrasaIds', 'array-contains', madrasaId)]);
          });
        });
        return groups;
      }

      if (['courses', 'classes', 'subjects', 'academicPlans', 'classPlans', 'classPlanExceptions'].includes(collectionName)) {
        madrasaChunks.forEach(chunk => {
          const values = [...chunk, ''];
          console.log('[Academic Scope]', {
            collectionName,
            role: role,
            values
          });
          groups.push([where('organizationId', '==', orgId), where('madrasaId', 'in', values)]);
        });
        return groups;
      }

      if (collectionName === 'staff' || collectionName === 'reports') {
        madrasaChunks.forEach(chunk => {
          groups.push([where('organizationId', '==', orgId), where('madrasaIds', 'array-contains-any', chunk)]);
          groups.push([where('organizationId', '==', orgId), where('madrasaId', 'in', chunk)]);
        });
        return groups;
      }

      madrasaChunks.forEach(chunk => {
        groups.push([where('organizationId', '==', orgId), where('madrasaId', 'in', chunk)]);
      });
      return groups;
    }

    if (role === 'teacher' || role === 'staff') {
      const orgId = user.organizationId;
      const classIds = user.classIds || [];
      const subjectIds = user.subjectIds || [];
      const classChunks = this.chunkArray(classIds, 10);
      const subjectChunks = this.chunkArray(subjectIds, 10);
      const groups: QueryConstraint[][] = [];

      if (!orgId) return [];

      if (collectionName === 'users') {
        const allowedUserRoles = ['student'];
        console.log('[Users Scope]', {
          role: role,
          allowedUserRoles,
        });
        if (classChunks.length === 0 && subjectChunks.length === 0) return [[where(documentId(), '==', user.uid)]];
        classChunks.forEach(chunk => {
          groups.push([where('organizationId', '==', orgId), where('role', '==', 'student'), where('classId', 'in', chunk)]);
          groups.push([where('organizationId', '==', orgId), where('role', '==', 'student'), where('classIds', 'array-contains-any', chunk)]);
        });
        subjectChunks.forEach(chunk => {
          groups.push([where('organizationId', '==', orgId), where('role', '==', 'student'), where('subjectIds', 'array-contains-any', chunk)]);
        });
        groups.push([where(documentId(), '==', user.uid)]); 
        return groups.length > 0 ? groups : [];
      }

      if (collectionName === 'students' || collectionName === 'attendance') {
        classChunks.forEach(chunk => {
          groups.push([where('organizationId', '==', orgId), where('classId', 'in', chunk)]);
        });
        return groups.length > 0 ? groups : [];
      }

      if (collectionName === 'classes') {
        classChunks.forEach(chunk => {
           groups.push([where('organizationId', '==', orgId), where(documentId(), 'in', chunk)]);
        });
        groups.push([where('organizationId', '==', orgId), where('teacherIds', 'array-contains', user.uid)]);
        return groups;
      }

      if (collectionName === 'subjects') {
        subjectChunks.forEach(chunk => {
           groups.push([where('organizationId', '==', orgId), where(documentId(), 'in', chunk)]);
        });
        groups.push([where('organizationId', '==', orgId), where('teacherIds', 'array-contains', user.uid)]);
        return groups;
      }

      if (collectionName === 'classPlans') {
        return [[where('organizationId', '==', orgId), where('assignedStaffIds', 'array-contains', user.uid)]];
      }

      return [];
    }

    if (role === 'student') {
      if (collectionName === 'attendance' && user.studentIds && user.studentIds.length > 0) {
         const chunks = this.chunkArray(user.studentIds, 10);
         return chunks.map(chunk => [where('studentId', 'in', chunk)]);
      }
      return [[where('userId', '==', user.uid)]];
    }

    if (role === 'parent' && user.linkedStudentIds && user.linkedStudentIds.length > 0) {
      const chunks = this.chunkArray(user.linkedStudentIds, 10);
      if (collectionName === 'students') {
        return chunks.map(chunk => [where(documentId(), 'in', chunk)]);
      }
      return chunks.map(chunk => [where('studentId', 'in', chunk)]);
    }

    return [];
  }
}
