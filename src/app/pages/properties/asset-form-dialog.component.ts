import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppUser } from '../../core/models/domain.model';
import { PropertyService } from '../../core/services/property.service';

@Component({
  selector: 'app-asset-form-dialog',
  templateUrl: './asset-form-dialog.component.html',
  styleUrls: ['./asset-form-dialog.component.scss'],
  standalone: false
})
export class AssetFormDialogComponent implements OnInit {
  isEditMode = false;
  isSaving = false;

  categories: any[] = [];
  madrasas: any[] = [];
  staff: any[] = [];
  profile: AppUser | null = null;

  // Multi-step forms
  step1Form!: FormGroup; // Basic Details
  step2Form!: FormGroup; // Product Details
  step3Form!: FormGroup; // Purchase & Financial
  step4Form!: FormGroup; // Warranty & Maintenance
  step5Form!: FormGroup; // Responsibility

  // Temporary attachments list
  attachmentsList: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    attachmentType: 'photo' | 'invoice' | 'warranty' | 'manual' | 'receipt' | 'other';
  }> = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly propertyService: PropertyService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<AssetFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.categories = data.categories || [];
    this.madrasas = data.madrasas || [];
    this.staff = data.staff || [];
    this.profile = data.profile || null;
    this.isEditMode = !!data.asset;
  }

  ngOnInit(): void {
    this.initForms();
    if (this.isEditMode) {
      this.populateForm(this.data.asset);
    }
  }

  private initForms(): void {
    const orgId = this.profile?.organizationId || '';
    
    // Step 1: Basic
    this.step1Form = this.fb.group({
      name: ['', Validators.required],
      categoryId: ['', Validators.required],
      assetTypeId: ['other', Validators.required],
      customAssetType: [''],
      organizationId: [orgId, Validators.required],
      madrasaId: ['', Validators.required],
      assetCode: [''],
      barcodeValue: [''],
      description: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unit: ['pcs', Validators.required],
      trackingMode: ['bulk', Validators.required]
    });

    // Step 2: Product details
    this.step2Form = this.fb.group({
      serialNumber: [''],
      brand: [''],
      model: [''],
      manufacturer: [''],
      specifications: [''],
      condition: ['excellent', Validators.required],
      status: ['available', Validators.required],
      location: ['', Validators.required]
    });

    // Step 3: Purchase info
    this.step3Form = this.fb.group({
      purchaseAt: [new Date().toISOString().substring(0, 10), Validators.required],
      purchaseQuantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      purchaseAmount: [0, [Validators.required, Validators.min(0)]],
      vendorName: [''],
      vendorContact: [''],
      invoiceNumber: [''],
      fundingSource: ['general'],
      donorDetails: ['']
    });

    // Step 4: Warranty & Maintenance
    this.step4Form = this.fb.group({
      warrantyAvailable: [false],
      warrantyStartAt: [''],
      warrantyEndAt: [''],
      warrantyProvider: [''],
      maintenanceRequired: [false],
      maintenanceFrequencyDays: [180],
      lastMaintenanceAt: [''],
      nextMaintenanceAt: ['']
    });

    // Step 5: Responsibility
    this.step5Form = this.fb.group({
      responsibleInchargeId: ['', Validators.required],
      assignedAt: [new Date().toISOString().substring(0, 10)],
      notes: ['']
    });

    // Setup financial calculations
    this.step3Form.get('unitPrice')?.valueChanges.subscribe(() => this.calculateTotalAmount());
    this.step3Form.get('purchaseQuantity')?.valueChanges.subscribe(() => this.calculateTotalAmount());

    // Sync quantities
    this.step1Form.get('quantity')?.valueChanges.subscribe(qty => {
      this.step3Form.get('purchaseQuantity')?.setValue(qty, { emitEvent: false });
      this.calculateTotalAmount();
    });
  }

  private calculateTotalAmount(): void {
    const qty = Number(this.step3Form.get('purchaseQuantity')?.value || 0);
    const price = Number(this.step3Form.get('unitPrice')?.value || 0);
    this.step3Form.get('purchaseAmount')?.setValue(qty * price, { emitEvent: false });
  }

  private populateForm(asset: any): void {
    this.step1Form.patchValue({
      name: asset.name,
      categoryId: asset.categoryId,
      assetTypeId: asset.assetTypeId || 'other',
      customAssetType: asset.customAssetType || '',
      organizationId: asset.organizationId,
      madrasaId: asset.madrasaId,
      assetCode: asset.assetCode,
      barcodeValue: asset.barcodeValue || '',
      description: asset.description || '',
      quantity: asset.quantity,
      unit: asset.unit,
      trackingMode: asset.trackingMode
    });

    this.step2Form.patchValue({
      serialNumber: asset.serialNumber || '',
      brand: asset.brand || '',
      model: asset.model || '',
      manufacturer: asset.manufacturer || '',
      specifications: asset.specifications || '',
      condition: asset.condition,
      status: asset.status,
      location: asset.location
    });

    this.step3Form.patchValue({
      purchaseAt: asset.purchaseAt?.toDate ? asset.purchaseAt.toDate().toISOString().substring(0, 10) : '',
      purchaseQuantity: asset.purchaseQuantity,
      unitPrice: asset.unitPrice,
      purchaseAmount: asset.purchaseAmount,
      vendorName: asset.vendorName || '',
      vendorContact: asset.vendorContact || '',
      invoiceNumber: asset.invoiceNumber || '',
      fundingSource: asset.fundingSource || 'general',
      donorDetails: asset.donorDetails || ''
    });

    this.step4Form.patchValue({
      warrantyAvailable: asset.warrantyAvailable || false,
      warrantyStartAt: asset.warrantyStartAt?.toDate ? asset.warrantyStartAt.toDate().toISOString().substring(0, 10) : '',
      warrantyEndAt: asset.warrantyEndAt?.toDate ? asset.warrantyEndAt.toDate().toISOString().substring(0, 10) : '',
      warrantyProvider: asset.warrantyProvider || '',
      maintenanceRequired: asset.maintenanceRequired || false,
      maintenanceFrequencyDays: asset.maintenanceFrequencyDays || 180,
      lastMaintenanceAt: asset.lastMaintenanceAt?.toDate ? asset.lastMaintenanceAt.toDate().toISOString().substring(0, 10) : '',
      nextMaintenanceAt: asset.nextMaintenanceAt?.toDate ? asset.nextMaintenanceAt.toDate().toISOString().substring(0, 10) : ''
    });

    this.step5Form.patchValue({
      responsibleInchargeId: asset.responsibleInchargeId || '',
      assignedAt: asset.assignedAt?.toDate ? asset.assignedAt.toDate().toISOString().substring(0, 10) : '',
      notes: asset.notes || ''
    });
  }

  async onFileSelected(event: any, type: 'photo' | 'invoice' | 'warranty' | 'manual' | 'receipt' | 'other'): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.snackBar.open(`Uploading '${file.name}' to Firebase Storage...`, '', { duration: 3000 });
      const fileUrl = await this.propertyService.uploadAssetFile(file, this.data.asset?.id, this.profile?.organizationId);

      this.attachmentsList.push({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: fileUrl,
        attachmentType: type
      });

      if (type === 'photo') {
        this.step1Form.patchValue({ photoUrl: fileUrl });
      }

      this.snackBar.open(`File '${file.name}' uploaded to Firebase Storage successfully.`, 'OK', { duration: 3000 });
    } catch (err: any) {
      console.error('Failed to upload file to Firebase Storage:', err);
      // Fallback to local DataURL if Storage is offline or unavailable
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl = e.target.result;
        this.attachmentsList.push({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileUrl: dataUrl,
          attachmentType: type
        });
        if (type === 'photo') {
          this.step1Form.patchValue({ photoUrl: dataUrl });
        }
      };
      reader.readAsDataURL(file);
      this.snackBar.open('Attached locally (Firebase Storage fallback)', 'OK', { duration: 4000 });
    }
  }

  removeAttachment(index: number): void {
    this.attachmentsList.splice(index, 1);
  }

  async save(): Promise<void> {
    if (this.step1Form.invalid || this.step2Form.invalid || this.step5Form.invalid) {
      this.snackBar.open('Please fill out all required fields.', 'OK', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    try {
      const assetPayload = {
        ...this.step1Form.value,
        ...this.step2Form.value,
        ...this.step3Form.value,
        ...this.step4Form.value,
        ...this.step5Form.value
      };

      // Convert date strings to unix milliseconds for server transition
      if (assetPayload.purchaseAt) assetPayload.purchaseAt = new Date(assetPayload.purchaseAt).getTime();
      if (assetPayload.warrantyStartAt) assetPayload.warrantyStartAt = new Date(assetPayload.warrantyStartAt).getTime();
      if (assetPayload.warrantyEndAt) assetPayload.warrantyEndAt = new Date(assetPayload.warrantyEndAt).getTime();
      if (assetPayload.lastMaintenanceAt) assetPayload.lastMaintenanceAt = new Date(assetPayload.lastMaintenanceAt).getTime();
      if (assetPayload.nextMaintenanceAt) assetPayload.nextMaintenanceAt = new Date(assetPayload.nextMaintenanceAt).getTime();
      if (assetPayload.assignedAt) assetPayload.assignedAt = new Date(assetPayload.assignedAt).getTime();

      if (this.isEditMode) {
        await this.propertyService.updateAsset(this.data.asset.id, assetPayload);
        this.snackBar.open('Asset updated successfully.', 'OK', { duration: 3000 });
      } else {
        await this.propertyService.createAsset(assetPayload, this.attachmentsList);
        this.snackBar.open('Asset registered successfully.', 'OK', { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(err.message || 'Failed to save asset.', 'OK', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
