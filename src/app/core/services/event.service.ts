import { Injectable } from '@angular/core';
import { Observable, from, map, of } from 'rxjs';
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore,
  QueryConstraint,
  writeBatch,
  serverTimestamp,
  doc,
  orderBy
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  AppUser,
  EventEntity,
  EventParticipant,
  EventAttendance,
  EventScheduleHistory
} from '../models/domain.model';
import { EntityRecord, RepositoryService } from './repository.service';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';
import { AuditLogService } from './audit-log.service';

export function computeEventStatus(e: any): string {
  if (!e) return 'expired';
  const status = (e.status || 'upcoming').toLowerCase();

  if (['completed', 'cancelled', 'postponed', 'preponed'].includes(status)) {
    return status;
  }

  const now = new Date();

  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (typeof d.toDate === 'function') return d.toDate();
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const endDate = parseDate(e.endDate);
  const startDate = parseDate(e.startDate);

  const checkDate = endDate || startDate;

  if (checkDate) {
    if (checkDate.getTime() < now.getTime()) {
      return 'expired';
    }
  }

  return status;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly firestore = getDeenDeskFirestore();
  private readonly functions = getFunctions(getDeenDeskFirebaseApp());

  private memoryCache = new Map<string, { timestamp: number; data: any[] }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  clearCache(keyPrefix?: string) {
    if (keyPrefix) {
      for (const k of Array.from(this.memoryCache.keys())) {
        if (k.startsWith(keyPrefix)) this.memoryCache.delete(k);
      }
    } else {
      this.memoryCache.clear();
    }
  }

  listEvents(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('events', user, extra).pipe(
      map((events) => {
        return events.map((e) => ({
          ...e,
          status: computeEventStatus(e),
        }));
      })
    );
  }

  async createEvent(payload: Partial<EventEntity>): Promise<{ eventId: string }> {
    const fn = httpsCallable<Partial<EventEntity>, { eventId: string }>(
      this.functions,
      'createEventWithParticipants'
    );
    const res = await fn(payload);
    this.repo.clearCache('events');
    this.clearCache();
    return res.data;
  }

  async updateEvent(eventId: string, payload: Partial<EventEntity>): Promise<{ success: boolean }> {
    const fn = httpsCallable<Partial<EventEntity> & { eventId: string }, { success: boolean }>(
      this.functions,
      'updateEvent'
    );
    const res = await fn({ ...payload, eventId });
    this.repo.clearCache('events');
    this.clearCache();
    return res.data;
  }

  async rescheduleEvent(
    eventId: string,
    newStartDate: any,
    newEndDate: any,
    reason: string,
    notifyParticipants?: boolean,
    notifyStaff?: boolean,
    notifyParents?: boolean,
    action?: any
  ): Promise<{ success: boolean }> {
    const payload = {
      eventId,
      newStartDate: typeof newStartDate === 'number' ? new Date(newStartDate).toISOString() : newStartDate,
      newEndDate: typeof newEndDate === 'number' ? new Date(newEndDate).toISOString() : newEndDate,
      reason,
      notifyParticipants,
      notifyStaff,
      notifyParents,
      action
    };
    const fn = httpsCallable<typeof payload, { success: boolean }>(
      this.functions,
      'rescheduleEvent'
    );
    const res = await fn(payload);
    this.repo.clearCache('events');
    this.clearCache();
    return res.data;
  }

  async changeStatus(
    eventId: string,
    status: any,
    reason?: string,
    completionNotes?: string
  ): Promise<{ success: boolean }> {
    const payload = { eventId, status, reason, completionNotes };
    const fn = httpsCallable<typeof payload, { success: boolean }>(
      this.functions,
      'changeEventStatus'
    );
    const res = await fn(payload);
    this.repo.clearCache('events');
    this.clearCache();
    return res.data;
  }

  async syncParticipants(eventId: string): Promise<any> {
    const fn = httpsCallable<{ eventId: string }, any>(
      this.functions,
      'syncEventParticipants'
    );
    const res = await fn({ eventId });
    this.clearCache(`part_${eventId}`);
    return res.data;
  }

  listParticipants(eventId: string, activeOnly = true): Observable<EventParticipant[]> {
    const cacheKey = `part_${eventId}_${activeOnly}`;
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return of(cached.data as EventParticipant[]);
      }
    }
    const ref = collection(this.firestore, 'eventParticipants');
    const q = query(ref, where('eventId', '==', eventId));
    return from(getDocs(q)).pipe(
      map(snap => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventParticipant));
        if (activeOnly) {
          docs = docs.filter(p => p.isActive === true);
        }
        this.memoryCache.set(cacheKey, { timestamp: Date.now(), data: docs });
        return docs;
      })
    );
  }

  listAttendance(eventId: string): Observable<EventAttendance[]> {
    const cacheKey = `att_${eventId}`;
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return of(cached.data as EventAttendance[]);
      }
    }
    const ref = collection(this.firestore, 'eventAttendance');
    const q = query(ref, where('eventId', '==', eventId));
    return from(getDocs(q)).pipe(
      map(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventAttendance));
        this.memoryCache.set(cacheKey, { timestamp: Date.now(), data: docs });
        return docs;
      })
    );
  }

  async saveAttendance(eventId: string, records: Partial<EventAttendance>[], user: AppUser | null): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();
    
    for (const rec of records) {
      const docId = `${eventId}_${rec.participantId}`;
      const attRef = doc(collection(this.firestore, 'eventAttendance'), docId);
      
      batch.set(attRef, {
        ...rec,
        eventId,
        markedBy: user?.displayName || (user as any)?.name || user?.uid || 'system',
        markedAt: now,
        updatedAt: now,
        isActive: true,
        isDeleted: false
      }, { merge: true });

      const pDocId = `${eventId}_${rec.participantType}_${rec.participantId}`;
      const pRef = doc(collection(this.firestore, 'eventParticipants'), pDocId);
      batch.update(pRef, {
        attendanceStatus: rec.status,
        updatedAt: now
      });
    }

    await batch.commit();
    this.clearCache(`att_${eventId}`);
    this.clearCache(`part_${eventId}`);

    await this.auditLogService.logAction({
      module: 'events',
      action: 'Record Attendance',
      targetId: eventId,
      status: 'success',
      message: `Recorded attendance for ${records.length} participants.`
    });
  }

  listScheduleHistory(eventId: string): Observable<EventScheduleHistory[]> {
    const cacheKey = `sched_${eventId}`;
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return of(cached.data as EventScheduleHistory[]);
      }
    }
    const ref = collection(this.firestore, 'eventScheduleHistory');
    const q = query(ref, where('eventId', '==', eventId));
    return from(getDocs(q)).pipe(
      map(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventScheduleHistory));
        const sorted = docs.sort((a, b) => {
          const ta = a.changedAt?.toMillis?.() || 0;
          const tb = b.changedAt?.toMillis?.() || 0;
          return tb - ta;
        });
        this.memoryCache.set(cacheKey, { timestamp: Date.now(), data: sorted });
        return sorted;
      })
    );
  }
}
