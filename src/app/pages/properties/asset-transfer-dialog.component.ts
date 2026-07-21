import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PropertyService } from '../../core/services/property.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-asset-transfer-dialog',
  templateUrl: './asset-transfer-dialog.component.html',
  standalone: false
})
export class AssetTransferDialogComponent implements OnInit {
  asset: any;
  madrasas: any[] = [];
  filteredMadrasas: any[] = [];
  destStaff: EntityRecord[] = [];
  isSaving = false;

  form!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly propertyService: PropertyService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<AssetTransferDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.asset = data.asset;
    this.madrasas = data.madrasas || [];
    // Destination cannot be source madrasa
    this.filteredMadrasas = this.madrasas.filter(m => m.id !== this.asset.madrasaId);
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      destinationMadrasaId: ['', Validators.required],
      responsibleInchargeId: ['', Validators.required],
      transferType: ['full', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required],
      notes: ['']
    });

    // Handle transferType logic
    this.form.get('transferType')?.valueChanges.subscribe(type => {
      const qtyCtrl = this.form.get('quantity');
      if (type === 'full') {
        qtyCtrl?.setValue(this.asset.availableQuantity);
        qtyCtrl?.disable();
      } else {
        qtyCtrl?.enable();
        qtyCtrl?.setValue(1);
      }
    });

    // Populate full quantity initially
    this.form.get('quantity')?.setValue(this.asset.availableQuantity);
    this.form.get('quantity')?.disable();

    // Load staff for target madrasa when target changes
    this.form.get('destinationMadrasaId')?.valueChanges.subscribe(mId => {
      if (mId) {
        this.loadDestinationStaff(mId);
      }
    });
  }

  private async loadDestinationStaff(madrasaId: string): Promise<void> {
    try {
      // Fetch all staff users and filter by destination madrasaId
      const list = await firstValueFrom(this.repo.list<EntityRecord>('staff', this.data.profile));
      this.destStaff = list.filter((s: EntityRecord) => {
        const mIds = s['madrasaIds'] || [];
        return s['madrasaId'] === madrasaId || (Array.isArray(mIds) && mIds.includes(madrasaId));
      });
      if (this.destStaff.length === 0) {
        // Fallback to all staff if target-specific staff is empty
        this.destStaff = list;
      }
    } catch (err) {
      console.error('Failed to load target staff', err);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.snackBar.open('Please fill out all required transfer details.', 'OK', { duration: 3000 });
      return;
    }

    const payload = {
      assetId: this.asset.id,
      transferType: this.form.get('transferType')?.value,
      quantity: Number(this.form.get('quantity')?.value || this.asset.availableQuantity),
      destinationMadrasaId: this.form.value.destinationMadrasaId,
      responsibleInchargeId: this.form.value.responsibleInchargeId,
      reason: this.form.value.reason,
      notes: this.form.value.notes
    };

    if (payload.quantity > this.asset.availableQuantity) {
      this.snackBar.open('Transfer quantity exceeds available asset count.', 'OK', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    try {
      await this.propertyService.transferAsset(payload);
      this.snackBar.open('Asset transferred successfully.', 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(err.message || 'Failed to transfer asset.', 'OK', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
