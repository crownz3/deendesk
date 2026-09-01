import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  collection,
  query,
  where,
  getFirestore,
  QueryConstraint,
  orderBy
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  AppUser,
  PropertyCategory,
  MadrasaAsset,
  AssetUnit,
  AssetTransaction,
  AssetMaintenance,
  AssetAttachment
} from '../models/domain.model';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { EntityRecord, RepositoryService } from './repository.service';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';
import { AuditLogService } from './audit-log.service';
import { FirebaseUsageTrackerService } from './firebase-usage-tracker.service';

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly firestore = getDeenDeskFirestore();
  private readonly functions = getFunctions(getDeenDeskFirebaseApp());
  private readonly storage = getStorage(getDeenDeskFirebaseApp());

  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService,
    private readonly usageTracker: FirebaseUsageTrackerService
  ) {}

  async uploadAssetFile(file: File, assetId?: string, orgId?: string): Promise<string> {
    const folder = assetId ? `assets/${assetId}` : `assets/general`;
    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `${folder}/${Date.now()}-${cleanName}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    if (file && file.size) {
      this.usageTracker.recordStorage('properties', orgId, 'upload', file.size);
    }
    return getDownloadURL(storageRef);
  }

  // --- Real-time Listeners via Repository Service ---

  listCategories(user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('propertyCategories', user);
  }

  listAssets(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('madrasaAssets', user, extra);
  }

  getAsset(id: string): Observable<EntityRecord> {
    return this.repo.get<EntityRecord>('madrasaAssets', id);
  }

  listUnits(assetId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('assetUnits', user, [
      where('assetId', '==', assetId),
      orderBy('unitCode', 'asc')
    ]);
  }

  listTransactions(assetId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('assetTransactions', user, [
      where('assetId', '==', assetId),
      orderBy('performedAt', 'desc')
    ]);
  }

  listMaintenance(assetId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('assetMaintenance', user, [
      where('assetId', '==', assetId),
      orderBy('createdAt', 'desc')
    ]);
  }

  listAttachments(assetId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('assetAttachments', user, [
      where('assetId', '==', assetId),
      orderBy('uploadedAt', 'desc')
    ]);
  }

  // --- Secure Cloud Callable Functions ---

  async createAsset(
    asset: Partial<MadrasaAsset>,
    attachments: Partial<AssetAttachment>[]
  ): Promise<{ assetId: string; unitCount: number }> {
    const fn = httpsCallable<
      { asset: Partial<MadrasaAsset>; attachments: Partial<AssetAttachment>[] },
      { assetId: string; unitCount: number }
    >(this.functions, 'createAsset');
    const res = await fn({ asset, attachments });
    this.repo.clearCache('madrasaAssets');
    return res.data;
  }

  async updateAsset(assetId: string, assetUpdate: Partial<MadrasaAsset>): Promise<void> {
    const fn = httpsCallable<{ assetId: string; assetUpdate: Partial<MadrasaAsset> }, void>(
      this.functions,
      'updateAsset'
    );
    await fn({ assetId, assetUpdate });
    this.repo.clearCache('madrasaAssets');
  }

  async adjustAssetQuantity(
    assetId: string,
    changeType: 'increase' | 'decrease',
    quantity: number,
    reason: string
  ): Promise<void> {
    const fn = httpsCallable<
      { assetId: string; changeType: 'increase' | 'decrease'; quantity: number; reason: string },
      void
    >(this.functions, 'adjustAssetQuantity');
    await fn({ assetId, changeType, quantity, reason });
    this.repo.clearCache('madrasaAssets');
  }

  async assignAsset(
    assetId: string,
    assetUnitId: string | null,
    responsiblePersonId: string,
    notes: string
  ): Promise<void> {
    const fn = httpsCallable<
      { assetId: string; assetUnitId: string | null; responsiblePersonId: string; notes: string },
      void
    >(this.functions, 'assignAsset');
    await fn({ assetId, assetUnitId, responsiblePersonId, notes });
    this.repo.clearCache('madrasaAssets');
  }

  async transferAsset(payload: {
    assetId: string;
    transferType: 'full' | 'quantity' | 'units';
    quantity?: number;
    unitIds?: string[];
    destinationMadrasaId: string;
    responsibleInchargeId: string;
    reason: string;
    notes?: string;
  }): Promise<void> {
    const fn = httpsCallable<any, void>(this.functions, 'transferAsset');
    await fn(payload);
    this.repo.clearCache('madrasaAssets');
  }

  async disposeAsset(payload: {
    assetId: string;
    disposalType: 'sale' | 'scrap' | 'loss' | 'other';
    quantity?: number;
    unitIds?: string[];
    reason: string;
    saleAmount?: number;
    approvedBy: string;
    notes?: string;
  }): Promise<void> {
    const fn = httpsCallable<any, void>(this.functions, 'disposeAsset');
    await fn(payload);
    this.repo.clearCache('madrasaAssets');
  }

  async createAssetMaintenance(payload: {
    assetId: string;
    assetUnitId?: string;
    maintenanceType: 'routine' | 'repair' | 'calibration' | 'upgrade' | 'other';
    complaint: string;
    scheduledAt?: number;
    serviceProvider?: string;
    serviceProviderContact?: string;
    estimatedCost?: number;
  }): Promise<void> {
    const fn = httpsCallable<any, void>(this.functions, 'createAssetMaintenance');
    await fn(payload);
    this.repo.clearCache('madrasaAssets');
  }

  async completeAssetMaintenance(payload: {
    maintenanceId: string;
    actualCost: number;
    resolution: string;
    condition: 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'unusable';
    status: 'available' | 'inUse';
    nextMaintenanceAt?: number;
    notes?: string;
  }): Promise<void> {
    const fn = httpsCallable<any, void>(this.functions, 'completeAssetMaintenance');
    await fn(payload);
    this.repo.clearCache('madrasaAssets');
  }
}
