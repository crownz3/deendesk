import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  collection,
  query,
  where,
  orderBy,
  getFirestore,
  QueryConstraint,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AppUser } from '../models/domain.model';
import { EntityRecord, RepositoryService } from './repository.service';
import { getDeenDeskFirebaseApp } from './firebase-app';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class LifecycleService {
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());
  private readonly functions = getFunctions(getDeenDeskFirebaseApp());

  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  // ─── Real-time Listeners ────────────────────────────────────────────────

  listRecords(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('lifecycleRecords', user, extra);
  }

  getRecord(id: string): Observable<EntityRecord> {
    return this.repo.get<EntityRecord>('lifecycleRecords', id);
  }

  listApprovals(lifecycleRecordId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('lifecycleApprovals', user, [
      where('lifecycleRecordId', '==', lifecycleRecordId),
      orderBy('level', 'asc'),
    ]);
  }

  listClearances(lifecycleRecordId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('lifecycleClearances', user, [
      where('lifecycleRecordId', '==', lifecycleRecordId),
      orderBy('department', 'asc'),
    ]);
  }

  listAttachments(lifecycleRecordId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('lifecycleAttachments', user, [
      where('lifecycleRecordId', '==', lifecycleRecordId),
      orderBy('uploadedAt', 'desc'),
    ]);
  }

  listHistoryForUser(userId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('userLifecycleHistory', user, [
      where('userId', '==', userId),
      orderBy('effectiveDate', 'desc'),
    ]);
  }

  listServicePeriodsForUser(userId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('userServicePeriods', user, [
      where('userId', '==', userId),
      orderBy('joiningAt', 'desc'),
    ]);
  }

  listRejoinRequests(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('rejoinRequests', user, extra);
  }

  listLifecycleHistory(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('userLifecycleHistory', user, extra);
  }

  // ─── Cloud Function Wrappers ────────────────────────────────────────────

  async dismissStudent(payload: {
    userId: string;
    madrasaId: string;
    reasonCode: string;
    reasonText: string;
    effectiveDateMs: number;
    lastStudyDateMs?: number;
    rejoinEligible: boolean;
    rejoinWaitingDays?: number;
    requiresApproval: boolean;
    requiresClearance: boolean;
    notes?: string;
    notifyParent?: boolean;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'dismissStudent');
    const res = await fn(payload);
    return res.data;
  }

  async relieveStaff(payload: {
    userId: string;
    madrasaId: string;
    reasonCode: string;
    reasonText: string;
    effectiveDateMs: number;
    lastWorkingDateMs?: number;
    rehireEligible: boolean;
    requiresApproval: boolean;
    requiresClearance: boolean;
    replacementStaffId?: string;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'relieveStaff');
    const res = await fn(payload);
    return res.data;
  }

  async suspendUser(payload: {
    userId: string;
    reasonText: string;
    effectiveDateMs: number;
    expectedReturnDateMs?: number;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'suspendUser');
    const res = await fn(payload);
    return res.data;
  }

  async reactivateUser(payload: {
    userId: string;
    reasonText: string;
    effectiveDateMs: number;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'reactivateUser');
    const res = await fn(payload);
    return res.data;
  }

  async transferUser(payload: {
    userId: string;
    personType: string;
    fromMadrasaId: string;
    toMadrasaId: string;
    toCourseId?: string;
    toClassId?: string;
    toClassGroupId?: string;
    toRole?: string;
    reasonText: string;
    effectiveDateMs: number;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'transferUser');
    const res = await fn(payload);
    return res.data;
  }

  async graduateStudent(payload: {
    userId: string;
    madrasaId: string;
    reasonText?: string;
    effectiveDateMs: number;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'graduateStudent');
    const res = await fn(payload);
    return res.data;
  }

  async completeStudentCourse(payload: {
    userId: string;
    madrasaId: string;
    reasonText?: string;
    effectiveDateMs: number;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'completeStudentCourse');
    const res = await fn(payload);
    return res.data;
  }

  async withdrawStudent(payload: {
    userId: string;
    madrasaId: string;
    reasonCode: string;
    reasonText: string;
    effectiveDateMs: number;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'withdrawStudent');
    const res = await fn(payload);
    return res.data;
  }

  async archiveUser(payload: {
    userId: string;
    reasonText: string;
    notes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'archiveUser');
    const res = await fn(payload);
    return res.data;
  }

  async approveLifecycleAction(payload: {
    lifecycleRecordId: string;
    remarks: string;
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, void>(this.functions, 'approveLifecycleAction');
    await fn(payload);
  }

  async rejectLifecycleAction(payload: {
    lifecycleRecordId: string;
    rejectionReason: string;
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, void>(this.functions, 'rejectLifecycleAction');
    await fn(payload);
  }

  async updateClearanceItem(payload: {
    clearanceId: string;
    lifecycleRecordId: string;
    status: 'cleared' | 'waived' | 'rejected';
    remarks?: string;
    pendingAmount?: number;
    assetIds?: string[];
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, void>(this.functions, 'updateClearanceItem');
    await fn(payload);
  }

  async overrideClearance(payload: {
    lifecycleRecordId: string;
    overrideReason: string;
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, void>(this.functions, 'overrideClearance');
    await fn(payload);
  }

  async submitRejoinRequest(payload: {
    previousUserId: string;
    personType: string;
    requestedMadrasaId: string;
    requestedCourseId?: string;
    requestedClassId?: string;
    requestedClassGroupId?: string;
    requestedRole?: string;
    reasonForReturn: string;
    requestedStartDateMs: number;
  }): Promise<{ requestId: string }> {
    const fn = httpsCallable<typeof payload, { requestId: string }>(this.functions, 'submitRejoinRequest');
    const res = await fn(payload);
    return res.data;
  }

  async approveRejoinRequest(payload: {
    requestId: string;
    reviewNotes?: string;
  }): Promise<{ recordId: string }> {
    const fn = httpsCallable<typeof payload, { recordId: string }>(this.functions, 'approveRejoinRequest');
    const res = await fn(payload);
    return res.data;
  }

  async rejectRejoinRequest(payload: {
    requestId: string;
    reviewNotes: string;
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, void>(this.functions, 'rejectRejoinRequest');
    await fn(payload);
  }
}
