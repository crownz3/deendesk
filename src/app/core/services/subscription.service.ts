import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, map, of } from 'rxjs';
import { AppUser, OrgSubscription, SubscriptionStatus } from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private readonly collectionName = 'subscriptions';

  constructor(
    private readonly repo: RepositoryService,
    private readonly auth: AuthService
  ) {}

  async fetchAllSubscriptions(): Promise<OrgSubscription[]> {
    const user = await firstValueFrom(this.auth.profile$);
    return firstValueFrom(this.repo.list<OrgSubscription>(this.collectionName, user));
  }

  getSubscriptionByOrg(orgId: string): Observable<OrgSubscription | null> {
    if (!orgId) return of(null);
    return this.repo.get<OrgSubscription>(this.collectionName, orgId).pipe(
      map(sub => sub || this.createDefaultSubscription(orgId))
    );
  }

  createDefaultSubscription(orgId: string, orgName?: string): OrgSubscription {
    const today = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(today.getDate() + 30);

    const nextBilling = new Date(trialEnd);

    return {
      id: orgId,
      organizationId: orgId,
      organizationName: orgName || 'Organization',
      status: 'trial',
      trialStartDate: today.toISOString().split('T')[0],
      trialEndDate: trialEnd.toISOString().split('T')[0],
      nextBillingDate: nextBilling.toISOString().split('T')[0],
      pricing: {
        basePrice: 500,
        pricePerStudent: 10,
        pricePerStaff: 50,
        pricePerCoordinator: 100,
        pricePerIncharge: 100,
        pricePerStageHead: 75,
        pricePerParent: 0,
        customRoleName: 'External Auditor',
        pricePerCustomRole: 150,
        currency: 'INR',
        billingCycle: 'monthly',
        billedRoles: ['student', 'teacher', 'coordinator', 'madrasaIncharge', 'stageHead'],
      },
      limits: {
        maxStudents: 500,
        maxStaff: 50,
        maxMadrasas: 5,
      },
      discountPercentage: 0,
      notes: 'Standard Initial Plan',
    };
  }

  async saveSubscription(orgId: string, subscription: Partial<OrgSubscription>): Promise<void> {
    const currentUser = await firstValueFrom(this.auth.profile$);
    try {
      await this.repo.update(this.collectionName, orgId, subscription, currentUser);
    } catch (e) {
      const fullSub: OrgSubscription = {
        ...this.createDefaultSubscription(orgId),
        ...subscription,
        id: orgId,
        organizationId: orgId,
      };
      await this.repo.create(this.collectionName, fullSub, currentUser, orgId);
    }
  }

  calculateTotalMonthlyCost(
    subscription: OrgSubscription,
    roleCounts: {
      student?: number;
      teacher?: number;
      coordinator?: number;
      madrasaIncharge?: number;
      stageHead?: number;
      parent?: number;
      customRole?: number;
    }
  ): { 
    baseCost: number; 
    studentCost: number; 
    staffCost: number; 
    coordinatorCost: number;
    inchargeCost: number;
    stageHeadCost: number;
    parentCost: number;
    customRoleCost: number;
    subtotal: number; 
    discountAmount: number; 
    total: number 
  } {
    const pricing = subscription.pricing || { 
      basePrice: 500, 
      pricePerStudent: 10, 
      pricePerStaff: 50,
      pricePerCoordinator: 100,
      pricePerIncharge: 100,
      pricePerStageHead: 75,
      pricePerParent: 0,
      pricePerCustomRole: 0
    };

    const baseCost = Number(pricing.basePrice || 0);
    const studentCost = Number(roleCounts.student || 0) * Number(pricing.pricePerStudent || 0);
    const staffCost = Number(roleCounts.teacher || 0) * Number(pricing.pricePerStaff || 0);
    const coordinatorCost = Number(roleCounts.coordinator || 0) * Number(pricing.pricePerCoordinator || 0);
    const inchargeCost = Number(roleCounts.madrasaIncharge || 0) * Number(pricing.pricePerIncharge || 0);
    const stageHeadCost = Number(roleCounts.stageHead || 0) * Number(pricing.pricePerStageHead || 0);
    const parentCost = Number(roleCounts.parent || 0) * Number(pricing.pricePerParent || 0);
    const customRoleCost = Number(roleCounts.customRole || 0) * Number(pricing.pricePerCustomRole || 0);

    const subtotal = baseCost + studentCost + staffCost + coordinatorCost + inchargeCost + stageHeadCost + parentCost + customRoleCost;

    const discount = Number(subscription.discountPercentage || 0);
    const discountAmount = (subtotal * discount) / 100;
    const total = Math.max(0, subtotal - discountAmount);

    return {
      baseCost,
      studentCost,
      staffCost,
      coordinatorCost,
      inchargeCost,
      stageHeadCost,
      parentCost,
      customRoleCost,
      subtotal,
      discountAmount,
      total,
    };
  }

  getDaysRemainingInTrial(subscription: OrgSubscription): number {
    if (subscription.status !== 'trial' || !subscription.trialEndDate) return 0;
    const end = new Date(subscription.trialEndDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((end - now) / (1000 * 3600 * 24));
    return Math.max(0, diffDays);
  }
}
