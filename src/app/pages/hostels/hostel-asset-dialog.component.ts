import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HostelAsset, HostelAssetCategory, AssetCondition, Hostel, AppUser } from '../../core/models/domain.model';

@Component({
  selector: 'app-hostel-asset-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.asset ? 'Edit Asset' : 'Add Asset to ' + data.hostel.hostelName }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Asset Scope</mat-label>
            <mat-select formControlName="assetScope">
              <mat-option value="room">Room Specific Asset</mat-option>
              <mat-option value="hostel_common">Hostel Common Asset</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width" *ngIf="form.get('assetScope')?.value === 'room'">
            <mat-label>Room Number</mat-label>
            <input matInput formControlName="roomNumber" placeholder="e.g. 101" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Asset Name</mat-label>
            <input matInput formControlName="assetName" placeholder="e.g. Wooden Single Bed, Split AC, Washing Machine" />
            <mat-error *ngIf="form.get('assetName')?.hasError('required')">Asset name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Category</mat-label>
            <mat-select formControlName="assetCategory">
              <mat-option value="furniture">Furniture (Bed, Table, Cupboard)</mat-option>
              <mat-option value="appliance">Appliance (AC, Fan, Cooler, Heater)</mat-option>
              <mat-option value="utility">Utility (Water Dispenser, Machine)</mat-option>
              <mat-option value="fixture">Fixture / Light</mat-option>
              <mat-option value="key">Room/Cupboard Key</mat-option>
              <mat-option value="other">Other</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Quantity</mat-label>
            <input matInput type="number" formControlName="quantity" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Condition</mat-label>
            <mat-select formControlName="condition">
              <mat-option value="excellent">Excellent</mat-option>
              <mat-option value="good">Good</mat-option>
              <mat-option value="fair">Fair</mat-option>
              <mat-option value="needs_repair">Needs Repair</mat-option>
              <mat-option value="damaged">Damaged</mat-option>
              <mat-option value="missing">Missing</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Serial / Tag Number</mat-label>
            <input matInput formControlName="serialNumberTag" placeholder="e.g. HAST-2024-009" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Assigned Occupant Name (Optional)</mat-label>
            <input matInput formControlName="assignedToPersonName" placeholder="e.g. Abdullah Ahmad" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes</mat-label>
            <textarea matInput formControlName="notes" rows="2" placeholder="Asset warranty, maintenance notes, etc."></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Asset
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 0 8px; }
    .form-container { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .form-row { display: flex; gap: 12px; }
    .full-width { width: 100%; }
    .half-width { flex: 1; }
  `],
  standalone: false
})
export class HostelAssetDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<HostelAssetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { asset?: HostelAsset; hostel: Hostel; user: AppUser }
  ) {}

  ngOnInit(): void {
    const a = this.data.asset;
    this.form = this.fb.group({
      hostelId: [this.data.hostel.id],
      hostelName: [this.data.hostel.hostelName],
      roomId: [a?.roomId || ''],
      roomNumber: [a?.roomNumber || ''],
      assetScope: [a?.assetScope || 'room', Validators.required],
      assetName: [a?.assetName || '', Validators.required],
      assetCategory: [a?.assetCategory || 'furniture', Validators.required],
      serialNumberTag: [a?.serialNumberTag || ''],
      quantity: [a?.quantity || 1, [Validators.required, Validators.min(1)]],
      condition: [a?.condition || 'good', Validators.required],
      assignedToPersonName: [a?.assignedToPersonName || ''],
      notes: [a?.notes || ''],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
