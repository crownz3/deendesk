import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppUser } from '../../core/models/domain.model';
import { PropertyService } from '../../core/services/property.service';
import { EntityRecord } from '../../core/services/repository.service';

import { AssetMaintenanceDialogComponent } from './asset-maintenance-dialog.component';
import { AssetTransferDialogComponent } from './asset-transfer-dialog.component';

@Component({
  selector: 'app-asset-details-dialog',
  templateUrl: './asset-details-dialog.component.html',
  styleUrls: ['./asset-details-dialog.component.scss'],
  standalone: false
})
export class AssetDetailsDialogComponent implements OnInit {
  asset: any;
  profile: AppUser | null = null;
  staff: EntityRecord[] = [];
  madrasas: EntityRecord[] = [];
  categories: EntityRecord[] = [];

  // Async query lists
  units$!: Observable<EntityRecord[]>;
  transactions$!: Observable<EntityRecord[]>;
  maintenance$!: Observable<EntityRecord[]>;
  attachments$!: Observable<EntityRecord[]>;

  constructor(
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<AssetDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.asset = data.asset;
    this.profile = data.profile || null;
    this.staff = data.staff || [];
    this.madrasas = data.madrasas || [];
    this.categories = data.categories || [];
  }

  ngOnInit(): void {
    this.loadDetails();
  }

  loadDetails(): void {
    this.units$ = this.propertyService.listUnits(this.asset.id, this.profile);
    this.transactions$ = this.propertyService.listTransactions(this.asset.id, this.profile);
    this.maintenance$ = this.propertyService.listMaintenance(this.asset.id, this.profile);
    this.attachments$ = this.propertyService.listAttachments(this.asset.id, this.profile).pipe(
      map((dbList) => {
        const inlineList = Array.isArray(this.asset?.attachments) ? this.asset.attachments : [];
        const combined = [...dbList, ...inlineList];
        const unique = new Map<string, EntityRecord>();
        combined.forEach(att => {
          const key = att['id'] || att['fileUrl'] || att['fileName'];
          if (key && !unique.has(key)) {
            unique.set(key, att as EntityRecord);
          }
        });
        return Array.from(unique.values());
      })
    );
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }

  staffName(id: string): string {
    const s = this.staff.find(row => row.id === id);
    if (!s) return id || 'System';
    return String(s['displayName'] || s['name'] || id);
  }

  madrasaName(id: string): string {
    const m = this.madrasas.find(row => row.id === id);
    return m ? String(m['name']) : id;
  }

  categoryName(id: string): string {
    const c = this.categories.find(row => row.id === id);
    return c ? String(c['name']) : id;
  }

  // --- Handlers from inside Details Modal ---

  openAddMaintenance(): void {
    const ref = this.dialog.open(AssetMaintenanceDialogComponent, {
      width: '600px',
      data: {
        asset: this.asset,
        profile: this.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.loadDetails();
    });
  }

  openTransfer(): void {
    const ref = this.dialog.open(AssetTransferDialogComponent, {
      width: '600px',
      data: {
        asset: this.asset,
        madrasas: this.madrasas,
        profile: this.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.loadDetails();
    });
  }

  async closeMaintenance(maint: any): Promise<void> {
    const ref = this.dialog.open(AssetMaintenanceDialogComponent, {
      width: '600px',
      data: {
        asset: this.asset,
        maintenance: maint,
        profile: this.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) this.loadDetails();
    });
  }
}
