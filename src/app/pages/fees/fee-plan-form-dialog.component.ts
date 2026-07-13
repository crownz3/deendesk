import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AppUser, FeePlan } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { FeeService } from '../../core/services/fee.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';

@Component({
  selector: 'app-fee-plan-form-dialog',
  template: `
    <div class="dialog-header">
      <div class="header-content">
        <div class="icon-container">
          <ion-icon name="wallet-outline"></ion-icon>
        </div>
        <div class="title-group">
          <h2>{{ data.plan ? 'Edit Fee Plan' : 'Create New Fee Plan' }}</h2>
          <p class="subtitle">{{ data.plan ? 'Update existing fee structure' : 'Define a new fee structure to assign to students' }}</p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <form [formGroup]="form" class="fee-plan-form">
        
        <div class="section-title">
          <ion-icon name="document-text-outline"></ion-icon>
          <h3>Basic Details</h3>
        </div>
        
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Fee Title</mat-label>
          <input matInput formControlName="title" placeholder="e.g. Monthly Tuition Fee">
          <mat-icon matPrefix class="prefix-icon">label_outline</mat-icon>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Fee Type</mat-label>
            <mat-select formControlName="feeType">
              <mat-option value="yearly">Yearly Fees</mat-option>
              <mat-option value="monthly">Monthly Fees</mat-option>
              <mat-option value="amalCard">Amal Card Fees</mat-option>
              <mat-option value="admission">Admission Fees</mat-option>
              <mat-option value="exam">Exam Fees</mat-option>
              <mat-option value="transport">Transport Fees</mat-option>
              <mat-option value="custom">Custom Fees</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Amount</mat-label>
            <input matInput type="number" formControlName="amount" placeholder="0">
            <span matPrefix class="currency-prefix">₹&nbsp;</span>
          </mat-form-field>
        </div>

        <div class="section-title">
          <ion-icon name="calendar-outline"></ion-icon>
          <h3>Schedule & Period</h3>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Payment Period</mat-label>
          <mat-select formControlName="paymentPeriod">
            <mat-option value="oneTime">One-Time</mat-option>
            <mat-option value="monthly">Monthly</mat-option>
            <mat-option value="yearly">Yearly</mat-option>
            <mat-option value="customRange">Custom Date Range</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Start Date</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="startDate">
            <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
            <mat-datepicker #startPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End / Due Date</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="endDate">
            <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
            <mat-datepicker #endPicker></mat-datepicker>
          </mat-form-field>
        </div>

        <div class="section-title mt-2">
          <ion-icon name="business-outline"></ion-icon>
          <h3>Applicability Scope</h3>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Applicable Madrasa</mat-label>
            <mat-select formControlName="applicableMadrasaId">
              <mat-option value="">-- All Madrasas --</mat-option>
              <mat-option *ngFor="let m of madrasas" [value]="m.id">{{ m['name'] }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Responsible Staff</mat-label>
            <mat-select formControlName="responsibleStaffId">
              <mat-option value="">-- None --</mat-option>
              <mat-option *ngFor="let s of staff" [value]="s['userId'] || s.id">{{ s['name'] || s['displayName'] }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Applicable Course</mat-label>
            <mat-select formControlName="applicableCourseId">
              <mat-option value="">-- All Courses --</mat-option>
              <mat-option *ngFor="let c of courses" [value]="c.id">{{ c['name'] }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Applicable Class</mat-label>
            <mat-select formControlName="applicableClassId">
              <mat-option value="">-- All Classes --</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{ c['name'] }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Applicable Class Group</mat-label>
          <mat-select formControlName="applicableGroupId">
            <mat-option value="">-- All Groups --</mat-option>
            <mat-option *ngFor="let g of classGroups" [value]="g.id">{{ g['name'] }}</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="section-title mt-2">
          <ion-icon name="options-outline"></ion-icon>
          <h3>Additional Options</h3>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            <mat-option value="active">Active</mat-option>
            <mat-option value="inactive">Inactive</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width notes-field">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="2" placeholder="Optional notes..."></textarea>
        </mat-form-field>

      </form>
    </mat-dialog-content>
    
    <div class="dialog-actions">
      <button mat-button mat-dialog-close class="cancel-btn">Cancel</button>
      <button mat-flat-button color="primary" class="save-btn" [disabled]="!form.valid || saving" (click)="save()">
        <ion-icon name="save-outline" *ngIf="!saving"></ion-icon>
        <mat-spinner diameter="18" *ngIf="saving"></mat-spinner>
        <span>{{ saving ? 'Saving...' : (data.plan ? 'Update Plan' : 'Create Plan') }}</span>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --primary-color: #3b82f6;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 24px 24px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 12px 12px 0 0;
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: rgba(59, 130, 246, 0.1);
      color: var(--primary-color);
      border-radius: 12px;
      font-size: 24px;
    }
    .title-group h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }
    .title-group .subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }
    .close-btn {
      color: #94a3b8;
    }
    mat-dialog-content {
      padding: 24px !important;
      max-height: 65vh;
      overflow-y: auto;
    }
    .fee-plan-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      margin-top: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #e2e8f0;
      color: #475569;
    }
    .section-title ion-icon {
      font-size: 18px;
      color: var(--primary-color);
    }
    .section-title h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .mt-2 {
      margin-top: 16px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-row mat-form-field {
      flex: 1;
    }
    .full-width {
      width: 100%;
    }
    .currency-prefix, .prefix-icon {
      color: #64748b;
      margin-right: 4px;
    }
    .prefix-icon {
      font-size: 20px;
      margin-top: 2px;
    }
    ::ng-deep .fee-plan-form .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
    ::ng-deep .notes-field .mat-mdc-form-field-subscript-wrapper {
      display: block;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 16px 24px;
      gap: 12px;
      border-top: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 0 0 12px 12px;
    }
    .cancel-btn {
      color: #64748b;
      font-weight: 500;
    }
    .save-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 24px;
      border-radius: 8px;
      height: 40px;
      font-weight: 600;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2), 0 2px 4px -1px rgba(59, 130, 246, 0.1);
    }
  `],
  standalone: false,
})
export class FeePlanFormDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;

  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  classGroups: EntityRecord[] = [];
  staff: EntityRecord[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<FeePlanFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan?: EntityRecord },
    private readonly auth: AuthService,
    private readonly feeService: FeeService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {}

  async ngOnInit(): Promise<void> {
    const plan = this.data?.plan;

    this.form = this.fb.group({
      title: [plan?.['title'] || '', Validators.required],
      feeType: [plan?.['feeType'] || 'monthly', Validators.required],
      amount: [plan?.['amount'] || 0, [Validators.required, Validators.min(0)]],
      paymentPeriod: [plan?.['paymentPeriod'] || 'monthly', Validators.required],
      startDate: [plan?.['startDate'] ? new Date(String(plan['startDate'])) : new Date()],
      endDate: [plan?.['endDate'] ? new Date(String(plan['endDate'])) : null],
      applicableMadrasaId: [plan?.['applicableMadrasaId'] || ''],
      applicableCourseId: [plan?.['applicableCourseId'] || ''],
      applicableClassId: [plan?.['applicableClassId'] || ''],
      applicableGroupId: [plan?.['applicableGroupId'] || ''],
      responsibleStaffId: [plan?.['responsibleStaffId'] || ''],
      notes: [plan?.['notes'] || ''],
      status: [plan?.['status'] || 'active'],
    });

    // Load lookup data
    const profile = await firstValueFrom(this.auth.profile$);
    if (profile) {
      this.repo.list<EntityRecord>('madrasas', profile).subscribe((d) => (this.madrasas = d));
      this.repo.list<EntityRecord>('courses', profile).subscribe((d) => (this.courses = d));
      this.repo.list<EntityRecord>('classes', profile).subscribe((d) => (this.classes = d));
      this.repo.list<EntityRecord>('classGroups', profile).subscribe((d) => (this.classGroups = d));
      this.repo.list<EntityRecord>('staff', profile).subscribe((d) => (this.staff = d));
    }
  }

  async save(): Promise<void> {
    if (!this.form.valid) return;
    this.saving = true;

    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const val = this.form.value;

      // Format dates
      const startDate = val.startDate instanceof Date ? val.startDate.toISOString().split('T')[0] : val.startDate || '';
      const endDate = val.endDate instanceof Date ? val.endDate.toISOString().split('T')[0] : val.endDate || '';

      const staffName = this.staff.find(
        (s) => (s['userId'] || s.id) === val.responsibleStaffId
      );

      const rawPayload: any = {
        title: val.title,
        feeType: val.feeType,
        amount: Number(val.amount),
        paymentPeriod: val.paymentPeriod,
        startDate,
        endDate,
        applicableMadrasaId: val.applicableMadrasaId || undefined,
        applicableCourseId: val.applicableCourseId || undefined,
        applicableClassId: val.applicableClassId || undefined,
        applicableGroupId: val.applicableGroupId || undefined,
        responsibleStaffId: val.responsibleStaffId || undefined,
        responsibleStaffName: staffName ? String(staffName['name'] || staffName['displayName'] || '') : undefined,
        notes: val.notes,
        status: val.status,
        organizationId: profile?.organizationId,
        madrasaId: val.applicableMadrasaId || profile?.madrasaId || (profile?.madrasaIds?.[0]) || undefined,
      };

      // Firestore does not support undefined values. Strip them out.
      const payload: Partial<FeePlan> = Object.fromEntries(
        Object.entries(rawPayload).filter(([_, v]) => v !== undefined)
      ) as Partial<FeePlan>;

      if (this.data?.plan?.id) {
        await this.feeService.updateFeePlan(String(this.data.plan.id), payload, profile);
        this.snackBar.open('Fee plan updated.', 'OK', { duration: 3000 });
      } else {
        await this.feeService.createFeePlan(payload, profile);
        this.snackBar.open('Fee plan created.', 'OK', { duration: 3000 });
      }

      this.dialogRef.close(true);
    } catch (err: any) {
      console.error('[Fee Plan Form] Save error:', err);
      this.snackBar.open(err?.message || 'Failed to save.', 'OK', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }
}
