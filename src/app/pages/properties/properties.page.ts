import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { PropertyService } from '../../core/services/property.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';

import { AssetFormDialogComponent } from './asset-form-dialog.component';
import { AssetDetailsDialogComponent } from './asset-details-dialog.component';
import { AssetTransferDialogComponent } from './asset-transfer-dialog.component';
import { AssetDisposalDialogComponent } from './asset-disposal-dialog.component';
import { AssetMaintenanceDialogComponent } from './asset-maintenance-dialog.component';

interface PropertiesPageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface PropertiesVm {
  profile: AppUser | null;
  assets: any[];
  categories: EntityRecord[];
  madrasas: EntityRecord[];
  staff: EntityRecord[];
  stats: {
    totalAssets: number;
    totalQuantity: number;
    totalPurchaseValue: number;
    available: number;
    inUse: number;
    underMaintenance: number;
    damaged: number;
    missing: number;
    transferred: number;
    disposed: number;
    warrantyExpiringSoon: number;
    maintenanceDue: number;
    overdueMaintenance: number;
  };
}

@Component({
  selector: 'app-properties',
  templateUrl: './properties.page.html',
  styleUrls: ['./properties.page.scss'],
  standalone: false
})
export class PropertiesPage implements OnInit {
  // Filters
  searchQuery = '';
  madrasaFilter = 'all';
  categoryFilter = 'all';
  statusFilter = 'all';
  conditionFilter = 'all';
  responsibleFilter = 'all';
  locationFilter = '';
  warrantyFilter = 'all'; // 'all' | 'valid' | 'expired' | 'expiringSoon'
  maintenanceFilter = 'all'; // 'all' | 'due' | 'overdue'

  groupByCategory = false;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly vm$: Observable<PropertiesPageState<PropertiesVm>> = this.refresh$.pipe(
    switchMap(() =>
      this.auth.profile$.pipe(
        switchMap(profile => {
          if (!profile) return of({ loading: false, error: 'Please sign in.' } as PropertiesPageState<PropertiesVm>);

          return combineLatest([
            this.propertyService.listAssets(profile).pipe(catchError(() => of([]))),
            this.propertyService.listCategories(profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
          ]).pipe(
            map(([assets, categories, madrasas, staff]) => {
              const stats = this.computeStats(assets);
              return {
                loading: false,
                data: {
                  profile,
                  assets,
                  categories,
                  madrasas,
                  staff,
                  stats
                }
              };
            })
          );
        }),
        catchError(err => of({ loading: false, error: err.message || 'Failed to load assets.' } as PropertiesPageState<PropertiesVm>))
      )
    )
  );

  constructor(
    private readonly auth: AuthService,
    private readonly propertyService: PropertyService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {}

  refreshData(): void {
    this.repo.clearCache();
    this.refresh$.next();
  }

  ngOnInit(): void {
    this.refresh$.next();
  }

  triggerRefresh(): void {
    this.refresh$.next();
  }

  computeStats(assets: any[]) {
    let totalAssets = 0;
    let totalQuantity = 0;
    let totalPurchaseValue = 0;
    let available = 0;
    let inUse = 0;
    let underMaintenance = 0;
    let damaged = 0;
    let missing = 0;
    let transferred = 0;
    let disposed = 0;
    let warrantyExpiringSoon = 0;
    let maintenanceDue = 0;
    let overdueMaintenance = 0;

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const a of assets) {
      if (a.isDeleted) continue;
      totalAssets++;
      totalQuantity += Number(a.quantity || 1);
      totalPurchaseValue += Number(a.purchaseAmount || 0);

      // Status
      if (a.status === 'available') available++;
      if (a.status === 'inUse') inUse++;
      if (a.status === 'underMaintenance') underMaintenance++;
      if (a.status === 'damaged') damaged++;
      if (a.status === 'missing') missing++;
      if (a.status === 'transferred') transferred++;
      if (a.status === 'disposed') disposed++;

      // Warranty expiring checking
      if (a.warrantyEndAt) {
        const warrantyDate = a.warrantyEndAt.toDate ? a.warrantyEndAt.toDate() : new Date(a.warrantyEndAt);
        if (warrantyDate > now && warrantyDate <= thirtyDaysLater) {
          warrantyExpiringSoon++;
        }
      }

      // Maintenance checking
      if (a.nextMaintenanceAt && a.status !== 'underMaintenance' && a.status !== 'disposed') {
        const nextMaint = a.nextMaintenanceAt.toDate ? a.nextMaintenanceAt.toDate() : new Date(a.nextMaintenanceAt);
        if (nextMaint < now) {
          overdueMaintenance++;
        } else if (nextMaint <= sevenDaysLater) {
          maintenanceDue++;
        }
      }
    }

    return {
      totalAssets,
      totalQuantity,
      totalPurchaseValue,
      available,
      inUse,
      underMaintenance,
      damaged,
      missing,
      transferred,
      disposed,
      warrantyExpiringSoon,
      maintenanceDue,
      overdueMaintenance
    };
  }

  getFilteredAssets(assets: any[]): any[] {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return assets.filter(a => {
      if (a.isDeleted) return false;

      // Text search
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchesName = a.name?.toLowerCase().includes(q);
        const matchesCode = a.assetCode?.toLowerCase().includes(q);
        const matchesBrand = a.brand?.toLowerCase().includes(q);
        const matchesModel = a.model?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesBrand && !matchesModel) return false;
      }

      // Dropdown filters
      if (this.madrasaFilter !== 'all' && a.madrasaId !== this.madrasaFilter) return false;
      if (this.categoryFilter !== 'all' && a.categoryId !== this.categoryFilter) return false;
      if (this.statusFilter !== 'all' && a.status !== this.statusFilter) return false;
      if (this.conditionFilter !== 'all' && a.condition !== this.conditionFilter) return false;
      if (this.responsibleFilter !== 'all' && a.responsibleInchargeId !== this.responsibleFilter) return false;
      
      if (this.locationFilter && !a.location?.toLowerCase().includes(this.locationFilter.toLowerCase())) return false;

      // Warranty filters
      if (this.warrantyFilter !== 'all' && a.warrantyEndAt) {
        const wDate = a.warrantyEndAt.toDate ? a.warrantyEndAt.toDate() : new Date(a.warrantyEndAt);
        if (this.warrantyFilter === 'valid' && wDate < now) return false;
        if (this.warrantyFilter === 'expired' && wDate >= now) return false;
        if (this.warrantyFilter === 'expiringSoon' && (wDate < now || wDate > thirtyDaysLater)) return false;
      }

      // Maintenance filters
      if (this.maintenanceFilter !== 'all' && a.nextMaintenanceAt) {
        const nMaint = a.nextMaintenanceAt.toDate ? a.nextMaintenanceAt.toDate() : new Date(a.nextMaintenanceAt);
        if (this.maintenanceFilter === 'due' && (nMaint < now || nMaint > sevenDaysLater)) return false;
        if (this.maintenanceFilter === 'overdue' && nMaint >= now) return false;
      }

      return true;
    });
  }

  getGroupedAssets(assets: any[], categories: EntityRecord[]): { categoryName: string; assets: any[] }[] {
    const filtered = this.getFilteredAssets(assets);
    const groups: Record<string, any[]> = {};

    for (const a of filtered) {
      const cat = categories.find(c => c.id === a.categoryId);
      const catName = cat ? String(cat['name']) : 'Other';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(a);
    }

    return Object.keys(groups).map(name => ({
      categoryName: name,
      assets: groups[name]
    }));
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.madrasaFilter = 'all';
    this.categoryFilter = 'all';
    this.statusFilter = 'all';
    this.conditionFilter = 'all';
    this.responsibleFilter = 'all';
    this.locationFilter = '';
    this.warrantyFilter = 'all';
    this.maintenanceFilter = 'all';
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }

  nameOf(rows: EntityRecord[], id: string): string {
    return String(rows.find(row => row.id === id)?.['name'] || id);
  }

  staffName(rows: EntityRecord[], id: string): string {
    const s = rows.find(row => row.id === id);
    if (!s) return id;
    return String(s['displayName'] || s['name'] || id);
  }

  // --- Modals opening ---

  openAddAssetDialog(vm: PropertiesVm): void {
    const ref = this.dialog.open(AssetFormDialogComponent, {
      width: '90vw',
      maxWidth: '90vw',
      disableClose: true,
      data: {
        categories: vm.categories,
        madrasas: vm.madrasas,
        staff: vm.staff,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.triggerRefresh();
    });
  }

  openEditAssetDialog(vm: PropertiesVm, asset: any): void {
    const ref = this.dialog.open(AssetFormDialogComponent, {
      width: '90vw',
      maxWidth: '90vw',
      disableClose: true,
      data: {
        asset,
        categories: vm.categories,
        madrasas: vm.madrasas,
        staff: vm.staff,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.triggerRefresh();
    });
  }

  openAssetDetails(vm: PropertiesVm, asset: any): void {
    const ref = this.dialog.open(AssetDetailsDialogComponent, {
      width: '950px',
      data: {
        asset,
        profile: vm.profile,
        staff: vm.staff,
        madrasas: vm.madrasas,
        categories: vm.categories
      }
    });

    ref.afterClosed().subscribe(() => {
      this.triggerRefresh();
    });
  }

  openTransferAsset(vm: PropertiesVm, asset: any): void {
    const ref = this.dialog.open(AssetTransferDialogComponent, {
      width: '600px',
      data: {
        asset,
        madrasas: vm.madrasas,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.triggerRefresh();
    });
  }

  openDisposeAsset(vm: PropertiesVm, asset: any): void {
    const ref = this.dialog.open(AssetDisposalDialogComponent, {
      width: '600px',
      data: {
        asset,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.triggerRefresh();
    });
  }

  openMaintenanceDialog(vm: PropertiesVm, asset: any): void {
    const ref = this.dialog.open(AssetMaintenanceDialogComponent, {
      width: '650px',
      data: {
        asset,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.triggerRefresh();
    });
  }
}
