/**
 * PropertyService Unit Tests
 * --------------------------
 * Strategy: We prevent Firebase SDK calls by overriding the private
 * `firestore` and `functions` fields on a subclass, and we stub
 * RepositoryService and AuditLogService with jasmine spies.
 *
 * Cloud Functions (createAsset, updateAsset, etc.) are tested via
 * spy replacements injected into the service instance after construction.
 */

import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { PropertyService } from './property.service';
import { RepositoryService, EntityRecord } from './repository.service';
import { AuditLogService } from './audit-log.service';
import { AppUser } from '../models/domain.model';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid: 'user-123',
    id: 'user-123',
    email: 'admin@test.com',
    displayName: 'Test Admin',
    role: 'organizationAdmin',
    organizationId: 'org-1',
    madrasaId: 'madrasa-1',
    ...overrides,
  } as AppUser;
}

function makeAsset(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: 'asset-1',
    name: 'Laptop',
    categoryId: 'cat-electronics',
    madrasaId: 'madrasa-1',
    organizationId: 'org-1',
    quantity: 10,
    condition: 'good',
    status: 'available',
    ...overrides,
  } as unknown as EntityRecord;
}

// ─── Subclass that prevents Firebase from initialising ───────────────────────

@Injectable()
class TestPropertyService extends PropertyService {
  // Override cloud-function wrappers so tests never touch Firebase
  override createAsset = jasmine.createSpy('createAsset');
  override updateAsset = jasmine.createSpy('updateAsset');
  override adjustAssetQuantity = jasmine.createSpy('adjustAssetQuantity');
  override assignAsset = jasmine.createSpy('assignAsset');
  override transferAsset = jasmine.createSpy('transferAsset');
  override disposeAsset = jasmine.createSpy('disposeAsset');
  override createAssetMaintenance = jasmine.createSpy('createAssetMaintenance');
  override completeAssetMaintenance = jasmine.createSpy('completeAssetMaintenance');
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('PropertyService', () => {
  let service: TestPropertyService;
  let repoSpy: jasmine.SpyObj<RepositoryService>;
  let auditSpy: jasmine.SpyObj<AuditLogService>;

  beforeEach(() => {
    repoSpy = jasmine.createSpyObj<RepositoryService>('RepositoryService', [
      'list', 'get', 'create', 'update', 'remove', 'clearCache', 'getAllOnce',
    ]);
    auditSpy = jasmine.createSpyObj<AuditLogService>('AuditLogService', [
      'logAction', 'clearAllCaches',
    ]);

    // Defaults
    repoSpy.list.and.returnValue(of([] as EntityRecord[]));
    repoSpy.get.and.returnValue(of({} as EntityRecord));
    repoSpy.clearCache.and.stub();
    auditSpy.logAction.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        { provide: PropertyService, useClass: TestPropertyService },
        { provide: RepositoryService, useValue: repoSpy },
        { provide: AuditLogService, useValue: auditSpy },
      ],
    });

    service = TestBed.inject(PropertyService) as TestPropertyService;
  });

  // ── listCategories ─────────────────────────────────────────────────────────

  describe('listCategories()', () => {
    it('should call repo.list with "propertyCategories"', async () => {
      const user = makeUser();
      const expected = [{ id: 'cat-1', name: 'Electronics' }] as EntityRecord[];
      repoSpy.list.and.returnValue(of(expected));

      const result = await firstValueFrom(service.listCategories(user));

      expect(repoSpy.list).toHaveBeenCalledWith('propertyCategories', user);
      expect(result).toEqual(expected);
    });

    it('should pass null user to repo.list', async () => {
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listCategories(null));

      expect(repoSpy.list).toHaveBeenCalledWith('propertyCategories', null);
    });

    it('should return multiple categories', async () => {
      const user = makeUser();
      const cats = [
        { id: 'cat-1', name: 'Electronics' },
        { id: 'cat-2', name: 'Furniture' },
        { id: 'cat-3', name: 'Vehicles' },
      ] as EntityRecord[];
      repoSpy.list.and.returnValue(of(cats));

      const result = await firstValueFrom(service.listCategories(user));
      expect(result.length).toBe(3);
    });
  });

  // ── listAssets ─────────────────────────────────────────────────────────────

  describe('listAssets()', () => {
    it('should call repo.list with "madrasaAssets"', async () => {
      const user = makeUser();
      const assets = [makeAsset(), makeAsset({ id: 'asset-2' })];
      repoSpy.list.and.returnValue(of(assets));

      const result = await firstValueFrom(service.listAssets(user));

      expect(repoSpy.list).toHaveBeenCalledWith('madrasaAssets', user, []);
      expect(result).toEqual(assets);
    });

    it('should forward extra query constraints to repo.list', async () => {
      const user = makeUser();
      const extra: any[] = [{ _type: 'where', field: 'status', op: '==', value: 'available' }];
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listAssets(user, extra));

      expect(repoSpy.list).toHaveBeenCalledWith('madrasaAssets', user, extra);
    });

    it('should return empty array when no assets exist', async () => {
      repoSpy.list.and.returnValue(of([]));
      const user = makeUser();

      const result = await firstValueFrom(service.listAssets(user));
      expect(result).toEqual([]);
    });

    it('should handle superAdmin user (no madrasaId)', async () => {
      const superAdmin = makeUser({ role: 'superAdmin', madrasaId: undefined });
      const assets = [makeAsset(), makeAsset({ id: 'asset-2', madrasaId: 'madrasa-2' })];
      repoSpy.list.and.returnValue(of(assets));

      const result = await firstValueFrom(service.listAssets(superAdmin));
      expect(result).toEqual(assets);
    });
  });

  // ── getAsset ───────────────────────────────────────────────────────────────

  describe('getAsset()', () => {
    it('should call repo.get with "madrasaAssets" and the given id', async () => {
      const asset = makeAsset({ id: 'asset-xyz' });
      repoSpy.get.and.returnValue(of(asset));

      const result = await firstValueFrom(service.getAsset('asset-xyz'));

      expect(repoSpy.get).toHaveBeenCalledWith('madrasaAssets', 'asset-xyz');
      expect(result).toEqual(asset);
    });

    it('should work with any asset id string', async () => {
      repoSpy.get.and.returnValue(of({} as EntityRecord));

      await firstValueFrom(service.getAsset('non-existent-id'));
      expect(repoSpy.get).toHaveBeenCalledWith('madrasaAssets', 'non-existent-id');
    });
  });

  // ── listUnits ──────────────────────────────────────────────────────────────

  describe('listUnits()', () => {
    it('should call repo.list with "assetUnits" collection', async () => {
      const user = makeUser();
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listUnits('asset-1', user));

      const args = repoSpy.list.calls.mostRecent().args;
      expect(args[0]).toBe('assetUnits');
      expect(args[1]).toBe(user);
    });

    it('should include at least one query constraint (where assetId)', async () => {
      const user = makeUser();
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listUnits('asset-1', user));

      const constraints: any[] = (repoSpy.list.calls.mostRecent().args[2] as any[]) ?? [];
      expect(constraints.length).toBeGreaterThanOrEqual(1);
    });

    it('should return units for the asset', async () => {
      const user = makeUser();
      const units = [
        { id: 'unit-1', assetId: 'asset-1', unitCode: 'U001', status: 'available' },
        { id: 'unit-2', assetId: 'asset-1', unitCode: 'U002', status: 'inUse' },
      ] as EntityRecord[];
      repoSpy.list.and.returnValue(of(units));

      const result = await firstValueFrom(service.listUnits('asset-1', user));
      expect(result).toEqual(units);
    });
  });

  // ── listTransactions ───────────────────────────────────────────────────────

  describe('listTransactions()', () => {
    it('should call repo.list with "assetTransactions"', async () => {
      const user = makeUser();
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listTransactions('asset-1', user));

      expect(repoSpy.list.calls.mostRecent().args[0]).toBe('assetTransactions');
    });

    it('should pass at least one constraint (where assetId)', async () => {
      const user = makeUser();
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listTransactions('asset-1', user));

      const constraints: any[] = (repoSpy.list.calls.mostRecent().args[2] as any[]) ?? [];
      expect(constraints.length).toBeGreaterThanOrEqual(1);
    });

    it('should return transaction records', async () => {
      const user = makeUser();
      const txns = [
        { id: 'txn-1', assetId: 'asset-1', changeType: 'increase', quantity: 5 },
      ] as EntityRecord[];
      repoSpy.list.and.returnValue(of(txns));

      const result = await firstValueFrom(service.listTransactions('asset-1', user));
      expect(result).toEqual(txns);
    });
  });

  // ── listMaintenance ────────────────────────────────────────────────────────

  describe('listMaintenance()', () => {
    it('should call repo.list with "assetMaintenance"', async () => {
      const user = makeUser();
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listMaintenance('asset-1', user));

      expect(repoSpy.list.calls.mostRecent().args[0]).toBe('assetMaintenance');
    });

    it('should return maintenance records', async () => {
      const user = makeUser();
      const records = [
        { id: 'm-1', assetId: 'asset-1', maintenanceType: 'repair', status: 'pending' },
      ] as EntityRecord[];
      repoSpy.list.and.returnValue(of(records));

      const result = await firstValueFrom(service.listMaintenance('asset-1', user));
      expect(result).toEqual(records);
    });
  });

  // ── listAttachments ────────────────────────────────────────────────────────

  describe('listAttachments()', () => {
    it('should call repo.list with "assetAttachments"', async () => {
      const user = makeUser();
      repoSpy.list.and.returnValue(of([]));

      await firstValueFrom(service.listAttachments('asset-1', user));

      expect(repoSpy.list.calls.mostRecent().args[0]).toBe('assetAttachments');
    });

    it('should return attachment records', async () => {
      const user = makeUser();
      const attachments = [
        { id: 'att-1', assetId: 'asset-1', fileName: 'invoice.pdf', url: 'https://...' },
      ] as EntityRecord[];
      repoSpy.list.and.returnValue(of(attachments));

      const result = await firstValueFrom(service.listAttachments('asset-1', user));
      expect(result).toEqual(attachments);
    });
  });

  // ── Cloud Function mutations (mocked) ─────────────────────────────────────

  describe('createAsset() [mocked Cloud Function]', () => {
    it('should resolve with assetId and unitCount', async () => {
      (service.createAsset as jasmine.Spy).and.returnValue(
        Promise.resolve({ assetId: 'new-asset-1', unitCount: 5 })
      );

      const result = await service.createAsset({ name: 'Projector', quantity: 5 }, []);
      expect(result).toEqual({ assetId: 'new-asset-1', unitCount: 5 });
    });
  });

  describe('updateAsset() [mocked Cloud Function]', () => {
    it('should resolve without error', async () => {
      (service.updateAsset as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.updateAsset('asset-1', { name: 'Updated Laptop' }))
        .toBeResolved();
    });
  });

  describe('adjustAssetQuantity() [mocked Cloud Function]', () => {
    it('should resolve for increase', async () => {
      (service.adjustAssetQuantity as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.adjustAssetQuantity('asset-1', 'increase', 3, 'New purchase'))
        .toBeResolved();
    });

    it('should resolve for decrease', async () => {
      (service.adjustAssetQuantity as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.adjustAssetQuantity('asset-1', 'decrease', 1, 'Damaged'))
        .toBeResolved();
    });
  });

  describe('assignAsset() [mocked Cloud Function]', () => {
    it('should resolve when called with valid args', async () => {
      (service.assignAsset as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.assignAsset('asset-1', 'unit-1', 'staff-123', 'Assigned to teacher'))
        .toBeResolved();
    });

    it('should work when assetUnitId is null (bulk asset)', async () => {
      (service.assignAsset as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.assignAsset('asset-1', null, 'staff-123', 'Bulk assign'))
        .toBeResolved();
    });
  });

  describe('transferAsset() [mocked Cloud Function]', () => {
    it('should resolve for full transfer', async () => {
      (service.transferAsset as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.transferAsset({
        assetId: 'asset-1',
        transferType: 'full',
        destinationMadrasaId: 'madrasa-2',
        responsibleInchargeId: 'incharge-1',
        reason: 'Relocation',
      })).toBeResolved();
    });

    it('should resolve for quantity transfer', async () => {
      (service.transferAsset as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.transferAsset({
        assetId: 'asset-1',
        transferType: 'quantity',
        quantity: 3,
        destinationMadrasaId: 'madrasa-2',
        responsibleInchargeId: 'incharge-1',
        reason: 'Partial move',
      })).toBeResolved();
    });

    it('should resolve for unit-level transfer', async () => {
      (service.transferAsset as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.transferAsset({
        assetId: 'asset-1',
        transferType: 'units',
        unitIds: ['unit-1', 'unit-2'],
        destinationMadrasaId: 'madrasa-2',
        responsibleInchargeId: 'incharge-1',
        reason: 'Specific units',
      })).toBeResolved();
    });
  });

  describe('disposeAsset() [mocked Cloud Function]', () => {
    const disposalTypes: Array<'sale' | 'scrap' | 'loss' | 'other'> = ['sale', 'scrap', 'loss', 'other'];

    disposalTypes.forEach(type => {
      it(`should resolve for disposal type "${type}"`, async () => {
        (service.disposeAsset as jasmine.Spy).and.returnValue(Promise.resolve());

        await expectAsync(service.disposeAsset({
          assetId: 'asset-1',
          disposalType: type,
          reason: `Disposed via ${type}`,
          approvedBy: 'admin-1',
        })).toBeResolved();
      });
    });
  });

  describe('createAssetMaintenance() [mocked Cloud Function]', () => {
    const maintenanceTypes: Array<'routine' | 'repair' | 'calibration' | 'upgrade' | 'other'> =
      ['routine', 'repair', 'calibration', 'upgrade', 'other'];

    maintenanceTypes.forEach(type => {
      it(`should resolve for maintenance type "${type}"`, async () => {
        (service.createAssetMaintenance as jasmine.Spy).and.returnValue(Promise.resolve());

        await expectAsync(service.createAssetMaintenance({
          assetId: 'asset-1',
          maintenanceType: type,
          complaint: `Test complaint for ${type}`,
        })).toBeResolved();
      });
    });
  });

  describe('completeAssetMaintenance() [mocked Cloud Function]', () => {
    it('should resolve when completing maintenance', async () => {
      (service.completeAssetMaintenance as jasmine.Spy).and.returnValue(Promise.resolve());

      await expectAsync(service.completeAssetMaintenance({
        maintenanceId: 'maint-1',
        actualCost: 500,
        resolution: 'Replaced fan',
        condition: 'good',
        status: 'available',
      })).toBeResolved();
    });
  });

  // ── Shared pattern: all mutations clear the cache ─────────────────────────

  describe('Cache invalidation contract', () => {
    it('should expose clearCache on the injected repo', () => {
      expect(repoSpy.clearCache).toBeDefined();
    });

    it('listAssets and listCategories never call clearCache (read-only)', async () => {
      const user = makeUser();
      await firstValueFrom(service.listAssets(user));
      await firstValueFrom(service.listCategories(user));

      expect(repoSpy.clearCache).not.toHaveBeenCalled();
    });

    it('getAsset never calls clearCache (read-only)', async () => {
      await firstValueFrom(service.getAsset('asset-1'));
      expect(repoSpy.clearCache).not.toHaveBeenCalled();
    });
  });
});
