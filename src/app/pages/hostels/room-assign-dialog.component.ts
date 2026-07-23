import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HostelOccupant, HostelRoom, AppUser } from '../../core/models/domain.model';
import { RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-room-assign-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Assign Occupant to Room {{ data.room.roomNumber }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <ion-icon name="close-outline"></ion-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="form-container">
        
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Occupant Type</mat-label>
            <mat-select formControlName="personType" (selectionChange)="onPersonTypeChange()">
              <mat-option value="student">Student</mat-option>
              <mat-option value="staff">Staff Member</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Bed Number / Slot</mat-label>
            <input matInput formControlName="bedNumber" placeholder="e.g. Bed A1" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Select Person</mat-label>
            <mat-select formControlName="personId" (selectionChange)="onPersonSelect($event.value)">
              <mat-option *ngFor="let p of peopleList" [value]="p.id">
                {{ p.name }} ({{ p.sub }})
              </mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('personId')?.hasError('required')">Person selection is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Check-In Date</mat-label>
            <input matInput type="date" formControlName="checkInDate" />
            <mat-error *ngIf="form.get('checkInDate')?.hasError('required')">Check-in date is required</mat-error>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Assign Occupant
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
export class RoomAssignDialogComponent implements OnInit {
  form!: FormGroup;
  peopleList: Array<{ id: string; name: string; sub: string }> = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<RoomAssignDialogComponent>,
    private repo: RepositoryService,
    @Inject(MAT_DIALOG_DATA) public data: { room: HostelRoom; user: AppUser }
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      personType: ['student', Validators.required],
      personId: ['', Validators.required],
      personName: ['', Validators.required],
      bedNumber: ['Bed ' + (this.data.room.currentOccupancy + 1)],
      checkInDate: [today, Validators.required],
    });

    this.onPersonTypeChange();
  }

  onPersonTypeChange(): void {
    const type = this.form.get('personType')?.value;
    const collectionName = type === 'student' ? 'students' : 'staff';
    this.repo.list<any>(collectionName, this.data.user).subscribe(list => {
      this.peopleList = list.map(item => ({
        id: item.id || '',
        name: item.fullName || item.name || item.displayName || item.email || 'Unnamed',
        sub: item.rollNumber || item.employeeId || item.gender || type
      }));
    });
  }

  onPersonSelect(id: string): void {
    const selected = this.peopleList.find(p => p.id === id);
    if (selected) {
      this.form.patchValue({ personName: selected.name });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
