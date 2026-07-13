import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ReportFieldMetadata } from '../../../core/models/report.model';

@Component({
  selector: 'app-add-custom-column-dialog',
  template: `
    <h2 mat-dialog-title>Create Custom Column</h2>
    <mat-dialog-content>
      <form [formGroup]="columnForm" class="d-flex flex-column gap-3 pt-2">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Column Name (Label)</mat-label>
          <input matInput formControlName="label" placeholder="e.g. Coordinator Name" required>
          <mat-hint>The header displayed in the report.</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100 mb-0">
          <mat-label>Database Key</mat-label>
          <input matInput formControlName="key" placeholder="e.g. coordinatorName" required>
          <button mat-icon-button matSuffix type="button" (click)="toggleKeys()" matTooltip="Show available keys in database">
            <mat-icon>info</mat-icon>
          </button>
          <mat-hint>The exact field name in the database.</mat-hint>
        </mat-form-field>

        <div class="keys-panel mat-elevation-z2" *ngIf="showKeys">
          <div class="keys-header">
            <span>Available Database Keys</span>
            <button mat-icon-button type="button" (click)="toggleKeys()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="keys-list">
            <button mat-button type="button" class="key-btn" *ngFor="let k of data?.availableKeys" (click)="selectKey(k)" [matTooltip]="'Key: ' + k">
              {{ formatKeyName(k) }}
            </button>
            <div *ngIf="!data?.availableKeys?.length" class="p-2 text-muted">No data available to scan.</div>
          </div>
        </div>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Data Type</mat-label>
          <mat-select formControlName="type">
            <mat-option value="text">Text (Default)</mat-option>
            <mat-option value="number">Number</mat-option>
            <mat-option value="date">Date</mat-option>
            <mat-option value="status">Status Badge</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="columnForm.invalid" (click)="onSave()">Add Column</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .w-100 { width: 100%; }
    .mb-0 { margin-bottom: 0; }
    .gap-3 { gap: 1rem; }
    .pt-2 { padding-top: 0.5rem; }
    .d-flex { display: flex; }
    .flex-column { flex-direction: column; }
    .keys-panel { 
      background: #f8f9fa; 
      border-radius: 6px; 
      margin-top: -8px;
      margin-bottom: 16px;
      max-height: 500px;
      display: flex;
      flex-direction: column;
      border: 1px solid #e0e0e0;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
    }
    .keys-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 8px 0 16px;
      font-size: 12px;
      font-weight: 500;
      color: #666;
      border-bottom: 1px solid #e0e0e0;
    }
    .keys-list {
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .key-btn {
      font-size: 13px;
      line-height: 28px;
      padding: 0 12px;
      min-width: auto;
      background: white;
      border: 1px solid #ccc;
      border-radius: 16px;
      color: #333;
      transition: all 0.2s;
    }
    .key-btn:hover {
      background: #e3f2fd;
      border-color: #2196f3;
      color: #1976d2;
    }
  `],
  standalone: false
})
export class AddCustomColumnDialogComponent {
  public columnForm: FormGroup;
  public showKeys = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddCustomColumnDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.columnForm = this.fb.group({
      label: ['', Validators.required],
      key: ['', Validators.required],
      type: ['text', Validators.required]
    });
  }

  toggleKeys() {
    this.showKeys = !this.showKeys;
  }

  selectKey(key: string) {
    const formattedLabel = this.formatKeyName(key);
    this.columnForm.patchValue({ 
      key: key,
      label: this.columnForm.value.label || formattedLabel
    });
    this.showKeys = false;
  }

  formatKeyName(key: string): string {
    if (!key) return '';
    
    // Convert camelCase to title case
    let name = key.replace(/([A-Z])/g, ' $1');
    name = name.charAt(0).toUpperCase() + name.slice(1);
    
    // Specific cleanup
    name = name.replace(/ Id/g, '');
    name = name.replace(/ Ids/g, '');
    name = name.replace(/ Name Display/g, ' Name');
    
    // Add "Name" to things that were IDs if they don't have it
    if ((key.endsWith('Id') || key.endsWith('Ids')) && !name.includes('Name')) {
      name += ' Name';
    }
    
    // Special cases
    if (name === 'Id') name = 'ID';
    
    return name.trim();
  }

  onSave() {
    if (this.columnForm.valid) {
      const val = this.columnForm.value;
      const newColumn: ReportFieldMetadata = {
        key: val.key.trim(),
        label: val.label.trim(),
        type: val.type as any,
        defaultVisible: true,
        sortable: true,
        filterable: true,
        groupable: true,
        exportable: true
      };
      this.dialogRef.close(newColumn);
    }
  }
}
