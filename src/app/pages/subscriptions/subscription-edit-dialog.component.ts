import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OrgSubscription, SubscriptionStatus } from '../../core/models/domain.model';
import { SubscriptionService } from '../../core/services/subscription.service';
import { LoaderService } from '../../core/services/loader.service';

export interface DialogOrgSubscriptionData extends OrgSubscription {
  roleCounts?: {
    student: number;
    teacher: number;
    coordinator: number;
    madrasaIncharge: number;
    stageHead: number;
    parent: number;
    customRole: number;
  };
}

@Component({
  selector: 'app-subscription-edit-dialog',
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-title-box">
          <span class="header-badge"><ion-icon name="options-outline"></ion-icon> PLAN & ROLE PRICING</span>
          <h2 mat-dialog-title>{{ data.organizationName || data.organizationId }}</h2>
        </div>
        <button mat-icon-button mat-dialog-close aria-label="Close" class="close-btn">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Organization Role Breakdown Summary -->
        <div class="role-summary-banner" *ngIf="data.roleCounts">
          <div class="banner-title"><ion-icon name="people-outline"></ion-icon> Detected Organization Users & Roles:</div>
          <div class="role-pills-wrap">
            <span class="role-chip student">🎓 Students: <strong>{{ data.roleCounts.student }}</strong></span>
            <span class="role-chip teacher">👨‍🏫 Teachers: <strong>{{ data.roleCounts.teacher }}</strong></span>
            <span class="role-chip coord">🔀 Coordinators: <strong>{{ data.roleCounts.coordinator }}</strong></span>
            <span class="role-chip incharge">🏫 Incharges: <strong>{{ data.roleCounts.madrasaIncharge }}</strong></span>
            <span class="role-chip stage">⭐ Stage Heads: <strong>{{ data.roleCounts.stageHead }}</strong></span>
            <span class="role-chip parent">👨‍👩‍👧 Parents: <strong>{{ data.roleCounts.parent }}</strong></span>
          </div>
        </div>

        <form [formGroup]="form" class="subscription-form">
          <!-- Status & Trial Dates -->
          <div class="section-title">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>Subscription Status & Trial Period</span>
          </div>

          <div class="form-grid-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Subscription Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="trial">Trial Period</mat-option>
                <mat-option value="active">Active Subscription</mat-option>
                <mat-option value="past_due">Past Due (Payment Pending)</mat-option>
                <mat-option value="expired">Expired</mat-option>
                <mat-option value="suspended">Suspended</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Discount Percentage (%)</mat-label>
              <input matInput type="number" formControlName="discountPercentage" min="0" max="100" />
            </mat-form-field>
          </div>

          <div class="form-grid-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Trial Start Date</mat-label>
              <input matInput type="date" formControlName="trialStartDate" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Trial End Date</mat-label>
              <input matInput type="date" formControlName="trialEndDate" />
            </mat-form-field>
          </div>

          <div class="form-grid-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Next Payment Due Date</mat-label>
              <input matInput type="date" formControlName="nextBillingDate" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Currency</mat-label>
              <mat-select formControlName="currency">
                <mat-option value="INR">INR (₹)</mat-option>
                <mat-option value="USD">USD ($)</mat-option>
                <mat-option value="SAR">SAR (﷼)</mat-option>
                <mat-option value="AED">AED (د.إ)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Custom Pricing Engine & Role Rates -->
          <div class="section-title">
            <ion-icon name="cash-outline"></ion-icon>
            <span>Role-Based Pricing Rates</span>
          </div>

          <div class="form-grid-1">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Base Platform Monthly Fee</mat-label>
              <input matInput type="number" formControlName="basePrice" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>
          </div>

          <div class="form-grid-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Rate Per Student ({{ data.roleCounts?.student || 0 }} Active)</mat-label>
              <input matInput type="number" formControlName="pricePerStudent" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Rate Per Teacher/Staff ({{ data.roleCounts?.teacher || 0 }} Active)</mat-label>
              <input matInput type="number" formControlName="pricePerStaff" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>
          </div>

          <div class="form-grid-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Rate Per Coordinator ({{ data.roleCounts?.coordinator || 0 }} Active)</mat-label>
              <input matInput type="number" formControlName="pricePerCoordinator" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Rate Per Incharge ({{ data.roleCounts?.madrasaIncharge || 0 }} Active)</mat-label>
              <input matInput type="number" formControlName="pricePerIncharge" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>
          </div>

          <div class="form-grid-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Rate Per Stage Head ({{ data.roleCounts?.stageHead || 0 }} Active)</mat-label>
              <input matInput type="number" formControlName="pricePerStageHead" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Rate Per Parent ({{ data.roleCounts?.parent || 0 }} Active)</mat-label>
              <input matInput type="number" formControlName="pricePerParent" min="0" />
              <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
            </mat-form-field>
          </div>

          <!-- Custom Role Pricing Card -->
          <div class="custom-role-box">
            <div class="box-header">
              <ion-icon name="create-outline"></ion-icon>
              <span>Custom Role Pricing Configuration</span>
            </div>
            <div class="form-grid-2">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Custom Role Title (e.g. Inspector)</mat-label>
                <input matInput formControlName="customRoleName" placeholder="Role title..." />
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Custom Role Fee / Month</mat-label>
                <input matInput type="number" formControlName="pricePerCustomRole" min="0" />
                <span matPrefix>{{ form.get('currency')?.value === 'INR' ? '₹' : '$' }}&nbsp;</span>
              </mat-form-field>
            </div>
          </div>

          <!-- Resource Limits -->
          <div class="section-title">
            <ion-icon name="options-outline"></ion-icon>
            <span>Organization Capacity Limits</span>
          </div>

          <div class="form-grid-3">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Max Allowed Students</mat-label>
              <input matInput type="number" formControlName="maxStudents" min="1" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Max Allowed Staff</mat-label>
              <input matInput type="number" formControlName="maxStaff" min="1" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Max Allowed Madrasas</mat-label>
              <input matInput type="number" formControlName="maxMadrasas" min="1" />
            </mat-form-field>
          </div>

          <!-- Notes -->
          <div class="form-grid-1">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Billing Agreement Notes / Terms</mat-label>
              <textarea matInput formControlName="notes" rows="2" placeholder="e.g. Approved special discount rate"></textarea>
            </mat-form-field>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button mat-dialog-close class="cancel-btn">Cancel</button>
        <button mat-flat-button color="primary" class="save-btn" [disabled]="saving" (click)="save()">
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      box-sizing: border-box;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      box-sizing: border-box;
      gap: 12px;

      .header-title-box {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 800;
          color: #2563eb;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.35;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
      }

      .close-btn {
        flex-shrink: 0;
        margin-top: -4px;
        margin-right: -4px;
      }
    }

    .dialog-content {
      padding: 20px !important;
      margin: 0 !important;
      max-height: 70vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .role-summary-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;

      .banner-title {
        font-size: 12px;
        font-weight: 700;
        color: #1e40af;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .role-pills-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .role-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;

          strong { color: #0f172a; font-weight: 800; }

          &.student { border-color: #93c5fd; color: #1e3a8a; }
          &.teacher { border-color: #ddd6fe; color: #5b21b6; }
          &.coord { border-color: #fef08a; color: #854d0e; }
          &.incharge { border-color: #fed7aa; color: #9a3412; }
          &.stage { border-color: #fbcfe8; color: #9d174d; }
          &.parent { border-color: #bbf7d0; color: #166534; }
        }
      }
    }

    .subscription-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 10px;
      font-size: 13px;
      font-weight: 800;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      ion-icon { font-size: 18px; }

      &:first-child {
        margin-top: 0;
      }
    }

    .form-grid-1 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .w-full {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .custom-role-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 14px;
      margin: 8px 0 12px;

      .box-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
        font-size: 12px;
        font-weight: 700;
        color: #334155;
        ion-icon { color: #2563eb; font-size: 16px; }
      }
    }

    .dialog-actions {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      box-sizing: border-box;

      .cancel-btn {
        font-weight: 600;
        color: #64748b;
      }

      .save-btn {
        font-weight: 700;
        padding: 0 20px;
        border-radius: 10px;
      }
    }

    @media (max-width: 600px) {
      .dialog-header {
        padding: 12px 14px;
        .header-title-box h2 { font-size: 14px; }
      }

      .dialog-content {
        padding: 14px 12px !important;
        max-height: 65vh;
      }

      .form-grid-2, .form-grid-3 {
        grid-template-columns: 1fr;
      }

      .dialog-actions {
        padding: 10px 12px;
        flex-direction: column-reverse;
        button {
          width: 100%;
          margin: 0 !important;
        }
      }
    }
  `],
  standalone: false,
})
export class SubscriptionEditDialogComponent {
  readonly form: FormGroup;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<SubscriptionEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogOrgSubscriptionData,
    private readonly subService: SubscriptionService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {
    const pricing = data.pricing || { 
      basePrice: 500, 
      pricePerStudent: 10, 
      pricePerStaff: 50, 
      pricePerCoordinator: 100, 
      pricePerIncharge: 100,
      pricePerStageHead: 75,
      pricePerParent: 0,
      customRoleName: '', 
      pricePerCustomRole: 0,
      currency: 'INR', 
      billingCycle: 'monthly' 
    };
    const limits = data.limits || { maxStudents: 500, maxStaff: 50, maxMadrasas: 5 };

    this.form = this.fb.group({
      status: [data.status || 'trial', Validators.required],
      discountPercentage: [data.discountPercentage || 0, [Validators.min(0), Validators.max(100)]],
      trialStartDate: [data.trialStartDate || ''],
      trialEndDate: [data.trialEndDate || ''],
      nextBillingDate: [data.nextBillingDate || ''],
      currency: [pricing.currency || 'INR'],
      basePrice: [pricing.basePrice ?? 500, [Validators.required, Validators.min(0)]],
      pricePerStudent: [pricing.pricePerStudent ?? 10, [Validators.min(0)]],
      pricePerStaff: [pricing.pricePerStaff ?? 50, [Validators.min(0)]],
      pricePerCoordinator: [pricing.pricePerCoordinator ?? 100, [Validators.min(0)]],
      pricePerIncharge: [pricing.pricePerIncharge ?? 100, [Validators.min(0)]],
      pricePerStageHead: [pricing.pricePerStageHead ?? 75, [Validators.min(0)]],
      pricePerParent: [pricing.pricePerParent ?? 0, [Validators.min(0)]],
      customRoleName: [pricing.customRoleName || ''],
      pricePerCustomRole: [pricing.pricePerCustomRole ?? 0, [Validators.min(0)]],
      maxStudents: [limits.maxStudents ?? 500, [Validators.min(1)]],
      maxStaff: [limits.maxStaff ?? 50, [Validators.min(1)]],
      maxMadrasas: [limits.maxMadrasas ?? 5, [Validators.min(1)]],
      notes: [data.notes || ''],
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    try {
      const val = this.form.value;
      const updatedSub: Partial<OrgSubscription> = {
        organizationId: this.data.organizationId,
        organizationName: this.data.organizationName,
        status: val.status as SubscriptionStatus,
        discountPercentage: val.discountPercentage,
        trialStartDate: val.trialStartDate,
        trialEndDate: val.trialEndDate,
        nextBillingDate: val.nextBillingDate,
        notes: val.notes,
        pricing: {
          basePrice: val.basePrice,
          pricePerStudent: val.pricePerStudent,
          pricePerStaff: val.pricePerStaff,
          pricePerCoordinator: val.pricePerCoordinator,
          pricePerIncharge: val.pricePerIncharge,
          pricePerStageHead: val.pricePerStageHead,
          pricePerParent: val.pricePerParent,
          customRoleName: val.customRoleName,
          pricePerCustomRole: val.pricePerCustomRole,
          currency: val.currency,
          billingCycle: 'monthly',
        },
        limits: {
          maxStudents: val.maxStudents,
          maxStaff: val.maxStaff,
          maxMadrasas: val.maxMadrasas,
        },
      };

      await this.loader.withLoader('Saving subscription settings...', async () => {
        await this.subService.saveSubscription(this.data.organizationId, updatedSub);
      });

      this.snackBar.open('Subscription configuration saved!', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e) {
      this.snackBar.open('Failed to save subscription details.', 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }
}
