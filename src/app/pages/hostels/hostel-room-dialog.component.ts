import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Hostel, HostelRoom, RoomType, AppUser } from '../../core/models/domain.model';

@Component({
  selector: 'app-hostel-room-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.room ? 'Edit Room' : 'Add Room to ' + data.hostel.hostelName }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Room Number</mat-label>
            <input matInput formControlName="roomNumber" placeholder="e.g. 101 or B-204" />
            <mat-error *ngIf="form.get('roomNumber')?.hasError('required')">Room number is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Floor</mat-label>
            <input matInput type="number" formControlName="floor" placeholder="e.g. 1" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Room Type</mat-label>
            <mat-select formControlName="roomType">
              <mat-option value="single">Single Bed</mat-option>
              <mat-option value="double">Double Sharing</mat-option>
              <mat-option value="group">Group Room (3-6 Beds)</mat-option>
              <mat-option value="dormitory">Dormitory Hall (7+ Beds)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Max Bed Capacity</mat-label>
            <input matInput type="number" formControlName="maxCapacity" />
            <mat-error *ngIf="form.get('maxCapacity')?.hasError('required')">Max capacity is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Optional Reference Room Fee (Can be 0 or Free)</mat-label>
            <input matInput type="number" formControlName="roomFeeOptional" placeholder="e.g. 0 for free hostel, or fee amount" />
            <mat-hint>Hostel accommodation can be free (0) or optional reference fee</mat-hint>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="available">Available</mat-option>
              <mat-option value="full">Full</mat-option>
              <mat-option value="under_maintenance">Under Maintenance</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Room
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
export class HostelRoomDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<HostelRoomDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { room?: HostelRoom; hostel: Hostel; user: AppUser }
  ) {}

  ngOnInit(): void {
    const r = this.data.room;
    this.form = this.fb.group({
      hostelId: [this.data.hostel.id],
      hostelName: [this.data.hostel.hostelName],
      roomNumber: [r?.roomNumber || '', Validators.required],
      floor: [r?.floor || 1, Validators.required],
      roomType: [r?.roomType || 'double', Validators.required],
      maxCapacity: [r?.maxCapacity || 2, [Validators.required, Validators.min(1)]],
      roomFeeOptional: [r?.roomFeeOptional || 0],
      status: [r?.status || 'available', Validators.required],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
