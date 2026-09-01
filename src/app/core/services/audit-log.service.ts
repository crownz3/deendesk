import { Injectable, Injector } from '@angular/core';
import { collection, doc, setDoc, query, where, orderBy, limit, startAfter, getDocs, Timestamp, QueryDocumentSnapshot, getFirestore } from 'firebase/firestore';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';
import { AuthService } from './auth.service';
import { AuditLog } from '../models/audit-log.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private readonly collectionName = 'auditLogs';
  private readonly firestore = getDeenDeskFirestore();

  private targetLogsCache = new Map<string, { timestamp: number; logs: any[] }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private injector: Injector
  ) {}

  private get authService(): AuthService {
    return this.injector.get(AuthService);
  }

  async logAction(partialLog: Omit<AuditLog, 'organizationId' | 'actorUserId' | 'actorName' | 'actorRole' | 'createdAt' | 'id'>) {
    try {
      const user = await firstValueFrom(this.authService.profile$);
      if (!user) {
        return; // Don't log if no user context
      }

      const logId = doc(collection(this.firestore, this.collectionName)).id;
      const auditLog: AuditLog = {
        id: logId,
        organizationId: user.organizationId || 'SYSTEM',
        actorUserId: user.uid || user.id || '',
        actorName: user.displayName || 'Unknown',
        actorRole: user.role || 'Unknown',
        ...partialLog,
        createdAt: Timestamp.now()
      };

      const cleanAuditLog = Object.entries(auditLog).reduce<Record<string, any>>((acc, [key, val]) => {
        if (val !== undefined) {
          acc[key] = val;
        }
        return acc;
      }, {});

      const docRef = doc(this.firestore, this.collectionName, logId);
      await setDoc(docRef, cleanAuditLog);
      if (partialLog.targetId) {
        this.targetLogsCache.delete(partialLog.targetId);
      }
    } catch (error) {
      console.error('Failed to save audit log', error);
    }
  }

  async getLogsForTarget(targetId: string): Promise<any[]> {
    if (this.targetLogsCache.has(targetId)) {
      const cached = this.targetLogsCache.get(targetId)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.logs;
      }
    }
    const q = query(
      collection(this.firestore, this.collectionName),
      where('targetId', '==', targetId)
    );
    const snap = await getDocs(q);
    const logs = snap.docs.map(doc => doc.data());
    logs.sort((a: any, b: any) => {
      const ta = a['createdAt']?.toMillis?.() || 0;
      const tb = b['createdAt']?.toMillis?.() || 0;
      return tb - ta;
    });
    this.targetLogsCache.set(targetId, { timestamp: Date.now(), logs });
    return logs;
  }

  clearAllCaches(): void {
    this.targetLogsCache.clear();
  }

  async getLogs(filters: any, lastDoc?: QueryDocumentSnapshot<AuditLog>, limitCount: number = 50) {
    const user = await firstValueFrom(this.authService.profile$);
    if (!user) {
      return { logs: [], lastDoc: undefined };
    }

    const auditRef = collection(this.firestore, this.collectionName);
    const queryConstraints: any[] = [];

    // Role-based scoping
    if (user.role !== 'superAdmin' && (user.role as string) !== 'SUPER_ADMIN') {
      if (!user.organizationId) {
         return { logs: [], lastDoc: undefined };
      }
      queryConstraints.push(where('organizationId', '==', user.organizationId));
    } else if (filters.organizationId) {
      queryConstraints.push(where('organizationId', '==', filters.organizationId));
    }

    if (filters.module) {
      queryConstraints.push(where('module', '==', filters.module));
    }
    
    if (filters.actorUserId) {
      queryConstraints.push(where('actorUserId', '==', filters.actorUserId));
    }

    if (filters.status) {
      queryConstraints.push(where('status', '==', filters.status));
    }

    // Default sorting
    queryConstraints.push(orderBy('createdAt', 'desc'));

    if (lastDoc) {
      queryConstraints.push(startAfter(lastDoc));
    }

    queryConstraints.push(limit(limitCount));

    const q = query(auditRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
    
    let filteredLogs = logs;
    if (filters.startDate || filters.endDate) {
       filteredLogs = logs.filter(log => {
         const date = log.createdAt.toDate();
         let isValid = true;
         if (filters.startDate) {
            const start = new Date(filters.startDate);
            start.setHours(0, 0, 0, 0);
            if (date < start) isValid = false;
         }
         if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            if (date > end) isValid = false;
         }
         return isValid;
       });
    }

    return {
      logs: filteredLogs,
      lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined
    };
  }
}
