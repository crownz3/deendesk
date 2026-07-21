import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PropertyService } from '../../core/services/property.service';

@Component({
  selector: 'app-asset-disposal-dialog',
  templateUrl: './asset-disposal-dialog.component.html',
  standalone: false
})
export class AssetDisposalDialogComponent implements OnInit {
  asset: any;
  isSaving = false;

  form!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly propertyService: PropertyService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<AssetDisposalDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.asset = data.asset;
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      disposalType: ['scrap', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required],
      saleAmount: [0, [Validators.required, Validators.min(0)]],
      approvedBy: ['', Validators.required],
      notes: [''],
      confirmCheck: [false, Validators.requiredTrue]
    });

    // Handle full vs partial validation
    this.form.get('quantity')?.setValue(this.asset.quantity);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.snackBar.open('Please fill out all disposal parameters and confirm.', 'OK', { duration: 3000 });
      return;
    }

    const payload = {
      assetId: this.asset.id,
      disposalType: this.form.value.disposalType,
      quantity: Number(this.form.value.quantity),
      reason: this.form.value.reason,
      saleAmount: Number(this.form.value.saleAmount || 0),
      approvedBy: this.form.value.approvedBy,
      notes: this.form.value.notes
    };

    if (payload.quantity > this.asset.quantity) {
      this.snackBar.open('Disposal quantity exceeds registered asset quantity.', 'OK', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    try {
      await this.propertyService.disposeAsset(payload);
      this.snackBar.open('Asset disposed successfully.', 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(err.message || 'Failed to dispose asset.', 'OK', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
