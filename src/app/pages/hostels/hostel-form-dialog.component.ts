import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Hostel, AppUser } from '../../core/models/domain.model';
import { RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-hostel-form-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.hostel ? 'Edit Hostel Building' : 'Add Hostel Building' }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Hostel Name / Building Block</mat-label>
            <input matInput formControlName="hostelName" placeholder="e.g. Block A - Tajweed Hostel" />
            <mat-error *ngIf="form.get('hostelName')?.hasError('required')">Hostel name is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Gender Scope</mat-label>
            <mat-select formControlName="genderScope">
              <mat-option value="male">Male Students</mat-option>
              <mat-option value="female">Female Students</mat-option>
              <mat-option value="staff">Staff / Quarters</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Hostel Warden / Staff Incharge</mat-label>
            <input matInput formControlName="wardenName" placeholder="e.g. Ustadh Imran" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Total Rooms</mat-label>
            <input matInput type="number" formControlName="totalRooms" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Total Capacity (Beds)</mat-label>
            <input matInput type="number" formControlName="totalCapacity" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Address / Location</mat-label>
            <input matInput formControlName="address" placeholder="e.g. East Campus Block 2" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description / Notes</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="Facility features, rules, etc."></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Hostel Building
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
export class HostelFormDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<HostelFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { hostel?: Hostel; user: AppUser }
  ) {}

  ngOnInit(): void {
    const h = this.data.hostel;
    this.form = this.fb.group({
      hostelName: [h?.hostelName || '', Validators.required],
      genderScope: [h?.genderScope || 'male', Validators.required],
      wardenName: [h?.wardenName || ''],
      totalRooms: [h?.totalRooms || 10, [Validators.required, Validators.min(1)]],
      totalCapacity: [h?.totalCapacity || 30, [Validators.required, Validators.min(1)]],
      address: [h?.address || ''],
      description: [h?.description || ''],
      status: [h?.status || 'active'],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
