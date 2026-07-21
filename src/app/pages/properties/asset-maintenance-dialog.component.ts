import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PropertyService } from '../../core/services/property.service';

@Component({
  selector: 'app-asset-maintenance-dialog',
  templateUrl: './asset-maintenance-dialog.component.html',
  standalone: false
})
export class AssetMaintenanceDialogComponent implements OnInit {
  asset: any;
  maintenance: any = null;
  isCloseMode = false;
  isSaving = false;

  form!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly propertyService: PropertyService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<AssetMaintenanceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.asset = data.asset;
    this.maintenance = data.maintenance || null;
    this.isCloseMode = !!this.maintenance;
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    if (this.isCloseMode) {
      this.form = this.fb.group({
        actualCost: [this.maintenance.estimatedCost || 0, [Validators.required, Validators.min(0)]],
        resolution: ['', Validators.required],
        condition: [this.asset.condition || 'good', Validators.required],
        status: ['available', Validators.required],
        nextMaintenanceAt: [''],
        notes: ['']
      });
    } else {
      this.form = this.fb.group({
        maintenanceType: ['repair', Validators.required],
        complaint: ['', Validators.required],
        scheduledAt: [new Date().toISOString().substring(0, 10), Validators.required],
        serviceProvider: [''],
        serviceProviderContact: [''],
        estimatedCost: [0, [Validators.required, Validators.min(0)]]
      });
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.snackBar.open('Please fill out all required fields.', 'OK', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    try {
      if (this.isCloseMode) {
        const payload = {
          maintenanceId: this.maintenance.id,
          actualCost: Number(this.form.value.actualCost),
          resolution: this.form.value.resolution,
          condition: this.form.value.condition,
          status: this.form.value.status,
          nextMaintenanceAt: this.form.value.nextMaintenanceAt ? new Date(this.form.value.nextMaintenanceAt).getTime() : undefined,
          notes: this.form.value.notes
        };
        await this.propertyService.completeAssetMaintenance(payload);
        this.snackBar.open('Maintenance marked as completed.', 'OK', { duration: 3000 });
      } else {
        const payload = {
          assetId: this.asset.id,
          maintenanceType: this.form.value.maintenanceType,
          complaint: this.form.value.complaint,
          scheduledAt: new Date(this.form.value.scheduledAt).getTime(),
          serviceProvider: this.form.value.serviceProvider,
          serviceProviderContact: this.form.value.serviceProviderContact,
          estimatedCost: Number(this.form.value.estimatedCost)
        };
        await this.propertyService.createAssetMaintenance(payload);
        this.snackBar.open('Maintenance scheduled/logged successfully.', 'OK', { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(err.message || 'Failed to process maintenance task.', 'OK', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
