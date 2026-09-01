import { Injectable } from '@angular/core';
import { Observable, combineLatest, of, map, switchMap, catchError } from 'rxjs';
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
} from 'firebase/firestore';
import {
  AppUser,
  FeeAssignment,
  FeePlan,
  FeePayment,
  FeePaymentStatus,
} from '../models/domain.model';
import { EntityRecord, RepositoryService } from './repository.service';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';
import { AuditLogService } from './audit-log.service';

export interface FeeDashboardStats {
  totalAssigned: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  totalPartialPaid: number;
  paidCount: number;
  notPaidCount: number;
  partialPaidCount: number;
}

@Injectable({ providedIn: 'root' })
export class FeeService {
  private readonly firestore = getDeenDeskFirestore();

  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  // ── Fee Plans ──────────────────────────────────────────

  listFeePlans(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('feePlans', user, extra);
  }

  async createFeePlan(data: Partial<FeePlan>, user: AppUser | null): Promise<string> {
    return this.repo.create<EntityRecord>('feePlans', data as EntityRecord, user);
  }

  async updateFeePlan(id: string, data: Partial<FeePlan>, user: AppUser | null): Promise<void> {
    return this.repo.update<EntityRecord>('feePlans', id, data as EntityRecord, user);
  }

  async deleteFeePlan(id: string): Promise<void> {
    return this.repo.remove('feePlans', id);
  }

  // ── Fee Assignments ────────────────────────────────────

  listFeeAssignments(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('feeAssignments', user, extra);
  }

  async createFeeAssignment(data: Partial<FeeAssignment>, user: AppUser | null): Promise<string> {
    return this.repo.create<EntityRecord>('feeAssignments', data as EntityRecord, user);
  }

  async updateFeeAssignment(id: string, data: Partial<FeeAssignment>, user: AppUser | null): Promise<void> {
    return this.repo.update<EntityRecord>('feeAssignments', id, data as EntityRecord, user);
  }

  // ── Fee Payments ───────────────────────────────────────

  listFeePayments(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('feePayments', user, extra);
  }

  async createFeePayment(data: Partial<FeePayment>, user: AppUser | null): Promise<string> {
    return this.repo.create<EntityRecord>('feePayments', data as EntityRecord, user);
  }

  // ── Bulk Assign Fees ───────────────────────────────────

  async assignFeePlanToStudents(
    plan: FeePlan & { id: string },
    students: EntityRecord[],
    user: AppUser | null
  ): Promise<number> {
    const batch = writeBatch(this.firestore);
    let count = 0;

    for (const student of students) {
      const ref = doc(collection(this.firestore, 'feeAssignments'));
      batch.set(ref, {
        feePlanId: plan.id,
        feePlanTitle: plan.title || '',
        studentId: student.id || '',
        studentName: student['name'] || student['displayName'] || '',
        feeType: plan.feeType || 'custom',
        amount: plan.amount || 0,
        paidAmount: 0,
        balanceAmount: plan.amount || 0,
        paymentStatus: 'notPaid' as FeePaymentStatus,
        dueDate: plan.endDate || '',
        organizationId: plan.organizationId || '',
        madrasaId: plan.applicableMadrasaId || student['madrasaId'] || '',
        responsibleStaffId: plan.responsibleStaffId || '',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid ?? 'system',
        updatedBy: user?.uid ?? 'system',
      });
      count++;

      // Firestore batches max 500 ops
      if (count % 450 === 0) {
        await batch.commit();
      }
    }

    if (count % 450 !== 0) {
      await batch.commit();
    }

    // Update plan's assignedCount
    await this.repo.update<EntityRecord>('feePlans', plan.id, {
      assignedCount: count,
    } as EntityRecord, user);

    this.repo.clearCache('feeAssignments');
    this.repo.clearCache('feePlans');

    this.auditLogService.logAction({
      module: 'Fees',
      action: 'Bulk Assign',
      targetId: plan.id,
      targetName: plan.title,
      status: 'success',
      message: `Assigned fee to ${count} students`
    });

    return count;
  }

  // ── Record Payment ─────────────────────────────────────

  async recordPayment(
    assignment: FeeAssignment & { id: string },
    paymentData: Partial<FeePayment>,
    user: AppUser | null
  ): Promise<void> {
    const amountPaid = paymentData.amountPaid || 0;
    const newPaidTotal = (assignment.paidAmount || 0) + amountPaid;
    const newBalance = Math.max(0, (assignment.amount || 0) - newPaidTotal);
    let newStatus: FeePaymentStatus = 'notPaid';
    if (newBalance <= 0) {
      newStatus = 'paid';
    } else if (newPaidTotal > 0) {
      newStatus = 'partialPaid';
    }

    // Create payment record
    await this.repo.create<EntityRecord>('feePayments', {
      ...paymentData,
      feePlanId: assignment.feePlanId,
      feeAssignmentId: assignment.id,
      studentId: assignment.studentId,
      studentName: assignment.studentName || '',
      balanceAfterPayment: newBalance,
      organizationId: assignment.organizationId || '',
      madrasaId: assignment.madrasaId || '',
      responsibleStaffId: paymentData.collectedByStaffId || '',
    } as EntityRecord, user);

    // Update assignment
    await this.repo.update<EntityRecord>('feeAssignments', assignment.id, {
      paidAmount: newPaidTotal,
      balanceAmount: newBalance,
      paymentStatus: newStatus,
      lastPaymentDate: paymentData.paymentDate,
    } as EntityRecord, user);
  }

  // ── Dashboard Stats ────────────────────────────────────

  computeStats(assignments: EntityRecord[]): FeeDashboardStats {
    let totalAssigned = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let paidCount = 0;
    let notPaidCount = 0;
    let partialPaidCount = 0;

    const today = new Date().toISOString().split('T')[0];

    for (const a of assignments) {
      const amount = Number(a['amount']) || 0;
      const paidAmount = Number(a['paidAmount']) || 0;
      const balance = Number(a['balanceAmount']) || 0;
      const status = String(a['paymentStatus'] || 'notPaid');
      const dueDate = String(a['dueDate'] || '');

      totalAssigned += amount;
      totalCollected += paidAmount;
      totalPending += balance;

      if (status === 'paid') {
        paidCount++;
      } else if (status === 'partialPaid') {
        partialPaidCount++;
        if (dueDate && dueDate < today) totalOverdue += balance;
      } else {
        notPaidCount++;
        if (dueDate && dueDate < today) totalOverdue += balance;
      }
    }

    return {
      totalAssigned,
      totalCollected,
      totalPending,
      totalOverdue,
      totalPartialPaid: partialPaidCount,
      paidCount,
      notPaidCount,
      partialPaidCount,
    };
  }
}
