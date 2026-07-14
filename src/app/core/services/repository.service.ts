import { Injectable } from '@angular/core';
import {
  CollectionReference,
  DocumentData,
  QueryConstraint,
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getFirestore,
  getDoc,
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
import { AuditLogService } from './audit-log.service';

export type EntityRecord = Record<string, unknown> & ScopedEntity;

@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());

  constructor(private auditLogService: AuditLogService) {}

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

  private normalizeUserPayload(collectionName: string, data: any, isUpdate = false): any {
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

    if (!isUpdate) {
      const isStaffRole = collectionName === 'staff' || normalized.role === 'teacher' || normalized.role === 'staff';
      if (normalized.permissions === undefined) normalized.permissions = [];
      if (normalized.madrasaIds === undefined) normalized.madrasaIds = [];
      if (!isStaffRole && normalized.classIds === undefined) normalized.classIds = [];
      if (!isStaffRole && normalized.subjectIds === undefined) normalized.subjectIds = [];
      if (normalized.linkedStudentIds === undefined) normalized.linkedStudentIds = [];
    }

    return normalized;
  }

  private stripDirectStaffAssignmentFields(collectionName: string, data: any, isUpdate = false): any {
    if (!['courses', 'classes', 'subjects'].includes(collectionName)) {
      return data;
    }

    const normalized = { ...data };
    const directAssignmentFields = [
      'teacherIds',
      'teacherUids',
      'assignedStaffIds',
      'staffIds',
      'teachingCourseIds',
      'teachingClassIds',
      'teachingSubjectIds',
    ];

    directAssignmentFields.forEach((field) => {
      if (isUpdate) {
        normalized[field] = deleteField();
      } else {
        delete normalized[field];
      }
    });

    return normalized;
  }

  private async createDefaultClassGroup(classId: string, classPayload: any, currentUser: AppUser | null): Promise<void> {
    const groupPayload = {
      classId,
      organizationId: classPayload.organizationId || null,
      madrasaId: classPayload.madrasaId || null,
      courseId: classPayload.courseId || null,
      name: 'Section A',
      isDefault: true,
      displayOrder: 1,
      assignedStaffIds: [],
      studentCount: 0,
      capacity: 50,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser?.uid ?? 'system',
      updatedBy: currentUser?.uid ?? 'system',
    };
    await addDoc(collection(this.firestore, 'classGroups'), groupPayload);
  }

  private async getDefaultGroupId(classId: string): Promise<string | undefined> {
    const ref = collection(this.firestore, 'classGroups');
    const q = query(ref, where('classId', '==', classId), where('isDefault', '==', true), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
    const q2 = query(ref, where('classId', '==', classId), limit(1));
    const snapshot2 = await getDocs(q2);
    if (!snapshot2.empty) {
      return snapshot2.docs[0].id;
    }
    return undefined;
  }

  async create<T extends EntityRecord>(collectionName: string, data: T, currentUser: AppUser | null, id?: string, skipAudit?: boolean): Promise<string> {
    console.log(`[Firestore Write - CREATE] userUid=${currentUser?.uid}, role=${currentUser?.role}, orgId=${currentUser?.organizationId}, permissions=${currentUser?.permissions?.join(',')}, collection=${collectionName}, targetId=${id || 'auto'}, payload=`, data);

    const normalizedData = this.stripDirectStaffAssignmentFields(
      collectionName,
      this.normalizeUserPayload(collectionName, data)
    );
    await this.syncTeacherUids(collectionName, normalizedData);

    const payload = {
      ...normalizedData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser?.uid ?? 'system',
      updatedBy: currentUser?.uid ?? 'system',
      status: normalizedData.status ?? 'active',
    };

    if (collectionName === 'classGroups' && payload['name'] && payload['classId']) {
      const q = query(
        collection(this.firestore, 'classGroups'),
        where('classId', '==', payload['classId']),
        where('name', '==', payload['name']),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`A group with the name "${payload['name']}" already exists for this class.`);
      }
    }

    if (collectionName === 'students' && !payload['groupId'] && payload['classId']) {
      const defaultGroupId = await this.getDefaultGroupId(String(payload['classId']));
      if (defaultGroupId) {
        payload['groupId'] = defaultGroupId;
      }
    }

    if (id) {
      await setDoc(doc(this.firestore, `${collectionName}/${id}`), payload);
      if (collectionName === 'classes') {
        await this.createDefaultClassGroup(id, payload, currentUser);
      }
      if (!skipAudit) {
        this.auditLogService.logAction({
          module: collectionName,
          action: 'Create (with ID)',
          targetId: id,
          targetName: String(payload['name'] || payload['displayName'] || payload['email'] || ''),
          status: 'success'
        });
      }
      return id;
    }

    const created = await addDoc(collection(this.firestore, collectionName), payload);
    if (collectionName === 'classes') {
      await this.createDefaultClassGroup(created.id, payload, currentUser);
    }
    if (!skipAudit) {
      this.auditLogService.logAction({
        module: collectionName,
        action: 'Create',
        targetId: created.id,
        targetName: String(payload['name'] || payload['displayName'] || payload['email'] || ''),
        status: 'success'
      });
    }
    return created.id;
  }

  private async syncTeacherUids(collectionName: string, data: any): Promise<void> {
    if (collectionName === 'classGroups') {
      const assignedStaffIds = Array.isArray(data.assignedStaffIds) ? data.assignedStaffIds : [];
      const allStaffIds = [...new Set(assignedStaffIds)].filter(Boolean);
      
      if (allStaffIds.length > 0) {
        const teacherUids: string[] = [];
        for (let i = 0; i < allStaffIds.length; i += 10) {
          const chunk = allStaffIds.slice(i, i + 10);
          const usersQ = query(collection(this.firestore, 'users'), where('entityId', 'in', chunk));
          const snap = await getDocs(usersQ);
          snap.forEach(doc => {
            if (!teacherUids.includes(doc.id)) teacherUids.push(doc.id);
          });
        }
        data.teacherUids = teacherUids;
      } else if (data.assignedStaffIds !== undefined) {
        data.teacherUids = [];
      }
    }
  }

  async update<T extends EntityRecord>(collectionName: string, id: string, data: Partial<T>, currentUser: AppUser | null, skipAudit?: boolean): Promise<void> {
    console.log(`[Firestore Write - UPDATE] userUid=${currentUser?.uid}, role=${currentUser?.role}, collection=${collectionName}, targetId=${id}, payload=`, data);
    
    const normalizedData = this.stripDirectStaffAssignmentFields(
      collectionName,
      this.normalizeUserPayload(collectionName, data, true),
      true
    );
    
    if (collectionName === 'classGroups' && normalizedData['name'] && normalizedData['classId']) {
      const q = query(
        collection(this.firestore, 'classGroups'),
        where('classId', '==', normalizedData['classId']),
        where('name', '==', normalizedData['name']),
        limit(2)
      );
      const snap = await getDocs(q);
      const otherGroup = snap.docs.find(doc => doc.id !== id);
      if (otherGroup) {
        throw new Error(`A group with the name "${normalizedData['name']}" already exists for this class.`);
      }
    }
    
    let originalData: any = null;
    if (!skipAudit) {
      try {
        const docRef = doc(this.firestore, `${collectionName}/${id}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          originalData = snap.data();
        }
      } catch (e) {
        console.error('Failed to fetch original doc for audit log', e);
      }
    }

    await this.syncTeacherUids(collectionName, normalizedData);
    
    await setDoc(doc(this.firestore, `${collectionName}/${id}`), {
      ...normalizedData,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.uid ?? 'system',
    }, { merge: true });

    if (!skipAudit) {
      let message = '';
      if (originalData) {
        message = this.getChangesMessage(originalData, normalizedData);
      }

      this.auditLogService.logAction({
        module: collectionName,
        action: data['status'] === 'disabled' ? 'Deactivate' : 'Update',
        targetId: id,
        targetName: String(data['name'] || data['displayName'] || data['email'] || originalData?.['name'] || originalData?.['displayName'] || originalData?.['email'] || ''),
        status: 'success',
        message: message || undefined
      });
    }
  }

  async remove(collectionName: string, id: string): Promise<void> {
    console.log(`[Firestore Write - DELETE] collection=${collectionName}, targetId=${id}`);
    
    if (collectionName === 'classGroups') {
      const groupDoc = await getDoc(doc(this.firestore, `${collectionName}/${id}`));
      const groupData = groupDoc.data();
      if (groupData) {
        const studentsQ = query(collection(this.firestore, 'students'), where('groupId', '==', id), limit(1));
        const studentsSnap = await getDocs(studentsQ);
        if (!studentsSnap.empty) {
           throw new Error('Cannot delete this group because it contains students. You must first move the students to a different group or class before deleting this one.');
        }
        
        const staffQ = query(collection(this.firestore, 'users'), where('groupIds', 'array-contains', id), limit(1));
        const staffSnap = await getDocs(staffQ);
        if (!staffSnap.empty) {
           throw new Error('Cannot delete this group because it contains staff. You must first unassign them before deleting this one.');
        }

        const groupsQ = query(collection(this.firestore, 'classGroups'), where('classId', '==', groupData['classId']));
        const groupsSnap = await getDocs(groupsQ);
        if (groupsSnap.size <= 1) {
           throw new Error('Cannot delete the last remaining group of a class.');
        }
      }
    }

    if (collectionName === 'classes') {
      const studentsQ = query(collection(this.firestore, 'students'), where('classId', '==', id), limit(1));
      const studentsSnap = await getDocs(studentsQ);
      if (!studentsSnap.empty) {
         throw new Error('Cannot delete this class because it contains students. You must first move the students to a different class before deleting this one.');
      }
      const groupsQ = query(collection(this.firestore, 'classGroups'), where('classId', '==', id), limit(1));
      const groupsSnap = await getDocs(groupsQ);
      if (!groupsSnap.empty) {
         throw new Error('Cannot delete this class because it still has class groups attached.');
      }
    }

    if (collectionName === 'courses') {
      const classesQ = query(collection(this.firestore, 'classes'), where('courseId', '==', id), limit(1));
      const classesSnap = await getDocs(classesQ);
      if (!classesSnap.empty) {
         throw new Error('Cannot delete this course because it has active classes. You must reassign or delete them first.');
      }
    }

    if (collectionName === 'madrasas') {
      const classesQ = query(collection(this.firestore, 'classes'), where('madrasaId', '==', id), limit(1));
      const classesSnap = await getDocs(classesQ);
      if (!classesSnap.empty) {
         throw new Error('Cannot delete this madrasa because it has active classes.');
      }
      const usersQ = query(collection(this.firestore, 'users'), where('madrasaId', '==', id), limit(1));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
         throw new Error('Cannot delete this madrasa because it has users assigned to it. Move them first.');
      }
    }

    if (collectionName === 'organizations') {
      const madrasasQ = query(collection(this.firestore, 'madrasas'), where('organizationId', '==', id), limit(1));
      const madrasasSnap = await getDocs(madrasasQ);
      if (!madrasasSnap.empty) {
         throw new Error('Cannot delete this organization because it has active madrasas.');
      }
    }
    
    await deleteDoc(doc(this.firestore, `${collectionName}/${id}`));

    this.auditLogService.logAction({
      module: collectionName,
      action: 'Delete',
      targetId: id,
      status: 'success'
    });
  }

  async batchCreate(collectionName: string, rows: EntityRecord[], currentUser: AppUser | null): Promise<number> {
    const batch = writeBatch(this.firestore);
    rows.forEach((row) => {
      const normalizedRow = this.normalizeUserPayload(collectionName, row);
      const ref = doc(collection(this.firestore, collectionName));
      const finalPayload = {
        ...normalizedRow,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid ?? 'system',
        updatedBy: currentUser?.uid ?? 'system',
        status: normalizedRow.status ?? 'active',
      };

      // We will not await getDefaultGroupId in a loop for batches to avoid performance issues if it's large.
      // It's assumed the caller for CSV provides groupId, or we resolve it beforehand in the CSV service.
      batch.set(ref, finalPayload);

      if (collectionName === 'classes') {
        const classGroupRef = doc(collection(this.firestore, 'classGroups'));
        batch.set(classGroupRef, {
          classId: ref.id,
          organizationId: finalPayload['organizationId'] || null,
          madrasaId: finalPayload['madrasaId'] || null,
          courseId: finalPayload['courseId'] || null,
          name: 'Section A',
          isDefault: true,
          displayOrder: 1,
          assignedStaffIds: [],
          studentCount: 0,
          capacity: 50,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: currentUser?.uid ?? 'system',
          updatedBy: currentUser?.uid ?? 'system',
        });
      }
    });
    await batch.commit();

    this.auditLogService.logAction({
      module: collectionName,
      action: 'Batch Create',
      status: 'success',
      message: `Created ${rows.length} records`
    });

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
      const allowedMadrasas = Array.isArray(user.madrasaIds) && user.madrasaIds.length > 0 
        ? user.madrasaIds 
        : (user.madrasaId ? [user.madrasaId] : []);
      const allowedClasses = user.classIds || [];
      const allowedSubjects = user.subjectIds || [];
      
      return docs.filter(doc => {
        if (collectionName === 'organizations') return true;
        if (collectionName === 'users' && doc.id === user.uid) return true;
        if (['staff', 'students', 'parents'].includes(collectionName) && doc['userId'] === user.uid) return true;
        if (collectionName === 'passwordResetRequests' && doc['assignedToUid'] === user.uid) return true;
        if (collectionName === 'notifications') return true;

        if (collectionName === 'madrasas') {
          return allowedMadrasas.includes(doc.id || '');
        }

        if (role === 'teacher' || role === 'staff') {
            // For other collections (students, classGroups, courses, classPlans), 
            // rely on the specific Firestore queries made by the frontend (and Firestore rules)
            // instead of hardcoded user arrays, since we no longer sync those arrays.
            if (['students', 'classGroups', 'courses', 'classes', 'classPlans', 'subjects', 'timetableEntries'].includes(collectionName)) {
                return true; 
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

        if (!doc['madrasaId'] && !doc['madrasaIds'] && ['courses', 'classes', 'classGroups', 'subjects', 'classPlans', 'classPlanExceptions'].includes(collectionName)) {
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
          collections: ['courses', 'classes', 'classGroups', 'subjects', 'academicPlans', 'classPlans', 'classPlanExceptions'],
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

      if (['courses', 'classes', 'classGroups', 'subjects', 'academicPlans'].includes(collectionName)) {
        return [[where('organizationId', '==', orgId)]];
      }

      if (['feePlans', 'feeAssignments', 'feePayments'].includes(collectionName)) {
        madrasaChunks.forEach(chunk => {
          groups.push([where('organizationId', '==', orgId), where('madrasaId', 'in', chunk)]);
        });
        return groups;
      }

      if (['classPlans', 'classPlanExceptions'].includes(collectionName)) {
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
      if (!orgId) return [];

      const groups: QueryConstraint[][] = [];

      // For dynamic chained fetching where dashboard provides extra constraints (like documentId() in [...]),
      // we must allow returning an empty base query so the extra constraints can take effect.
      // However, we restrict the base scopes to only what's explicitly assigned.

      if (collectionName === 'users') {
        // Teachers shouldn't query the entire users collection broadly anymore without specific IDs.
        // If extra constraints provide `documentId() in [...]` (e.g. fetching students), we allow it.
        // Otherwise, they can only query themselves.
        return [[where(documentId(), '==', user.uid)]];
      }

      if (collectionName === 'students' || collectionName === 'attendance') {
        // Dashboard will pass where('classId', 'in', classIds) or where('groupId', 'in', groupIds) in extraConstraints.
        // So we return an empty array of groups? Wait, if we return [], list() returns nothing.
        // If we return [[]] (array with one empty group), it will query ALL students, which is bad!
        // But dashboard will provide `extraConstraints`. list() merges extra constraints into every group.
        // If we return [[where('organizationId', '==', orgId)]], it restricts to org, and extraConstraints restrict further.
        return [[where('organizationId', '==', orgId)]];
      }

      if (collectionName === 'classes' || collectionName === 'subjects' || collectionName === 'classGroups' || collectionName === 'classPlans' || collectionName === 'timetableEntries') {
        const allowedMadrasas = Array.isArray(user.madrasaIds) ? user.madrasaIds : [user.madrasaId].filter(Boolean);
        if (allowedMadrasas.length > 0) {
          return [[where('organizationId', '==', orgId), where('madrasaId', 'in', allowedMadrasas)]];
        }
        return [[where('organizationId', '==', orgId)]];
      }

      if (['feePlans', 'feeAssignments', 'feePayments'].includes(collectionName)) {
        // Staff can see fee data scoped to their org; Firestore rules further restrict to responsibleStaffId
        return [[where('organizationId', '==', orgId), where('responsibleStaffId', '==', user.uid)]];
      }

      if (collectionName === 'courses' || collectionName === 'madrasas' || collectionName === 'staff') {
        return [[where('organizationId', '==', orgId)]];
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

  private getChangesMessage(original: any, updated: any): string {
    if (!original || !updated) return '';
    const changes: string[] = [];
    const ignoredKeys = ['updatedAt', 'updatedBy', 'createdAt', 'createdBy'];

    for (const key of Object.keys(updated)) {
      if (ignoredKeys.includes(key)) continue;
      
      const oldVal = original[key];
      const newVal = updated[key];

      let isEqual = false;
      if (oldVal === newVal) {
        isEqual = true;
      } else if (oldVal === undefined || oldVal === null) {
        isEqual = newVal === undefined || newVal === null || newVal === '';
      } else if (newVal === undefined || newVal === null) {
        isEqual = oldVal === undefined || oldVal === null || oldVal === '';
      } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        isEqual = oldVal.length === newVal.length && oldVal.every((v, i) => v === newVal[i]);
      } else if (typeof oldVal === 'object' && typeof newVal === 'object') {
        isEqual = JSON.stringify(oldVal) === JSON.stringify(newVal);
      }

      if (!isEqual) {
        const formatValue = (val: any): string => {
          if (val === null || val === undefined || val === '') return 'empty';
          if (Array.isArray(val)) {
             return val.length ? `[${val.join(', ')}]` : 'empty';
          }
          if (typeof val === 'object') return JSON.stringify(val);
          return `'${String(val)}'`;
        };
        const humanKey = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        changes.push(`${humanKey} changed from ${formatValue(oldVal)} to ${formatValue(newVal)}`);
      }
    }

    return changes.join(', ');
  }
}
