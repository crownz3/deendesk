import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ReportFieldMetadata } from '../../../core/models/report.model';

@Component({
  selector: 'app-report-filter-builder',
  standalone: false,
  template: `
    <div class="filter-builder">
      <div class="filter-item" *ngFor="let filter of filters; let i = index">
        <div class="filter-item-header">
          <span>Filter {{ i + 1 }}</span>
          <button mat-icon-button color="warn" (click)="removeFilter(i)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>

        <mat-form-field appearance="outline">
          <mat-select [(value)]="filter.fieldKey" (selectionChange)="onFieldChange(i)" placeholder="Field">
            <mat-option *ngFor="let field of availableFields" [value]="field.key">
              {{field.label}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-select [(value)]="filter.operator" placeholder="Operator">
            <mat-option value="equals">Equals</mat-option>
            <mat-option value="contains">Contains</mat-option>
            <mat-option value="greaterThan">Greater Than</mat-option>
            <mat-option value="lessThan">Less Than</mat-option>
            <mat-option value="between">Between</mat-option>
            <mat-option value="isEmpty">Is Empty</mat-option>
            <mat-option value="isNotEmpty">Is Not Empty</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" *ngIf="filter.operator !== 'between' && filter.operator !== 'isEmpty' && filter.operator !== 'isNotEmpty'">
          <input matInput [type]="filter.fieldKey === 'month' ? 'month' : 'text'" [(ngModel)]="filter.value1" [placeholder]="filter.fieldKey === 'month' ? 'Select Month & Year' : 'Value'">
        </mat-form-field>
        
        <mat-form-field appearance="outline" *ngIf="filter.operator === 'between'">
          <input matInput [type]="filter.fieldKey === 'month' ? 'month' : 'text'" [(ngModel)]="filter.value1" placeholder="Min Value">
        </mat-form-field>
        <mat-form-field appearance="outline" *ngIf="filter.operator === 'between'">
          <input matInput [type]="filter.fieldKey === 'month' ? 'month' : 'text'" [(ngModel)]="filter.value2" placeholder="Max Value">
        </mat-form-field>
      </div>

      <div class="filter-actions">
        <button mat-stroked-button color="primary" class="w-full" (click)="addFilter()">
          <mat-icon>add</mat-icon> Add Filter
        </button>
        <button mat-flat-button color="primary" class="w-full" (click)="applyFilters()">
          Apply Filters
        </button>
      </div>
    </div>
  `,
  styles: [`
    .filter-builder { display: flex; flex-direction: column; gap: 16px; }
    .filter-item { 
      display: flex; 
      flex-direction: column; 
      background: var(--ion-color-step-50, #f8f9fa);
      padding: 16px;
      border-radius: 8px;
    }
    .filter-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      margin-top: -8px;
      margin-right: -8px;
    }
    .filter-item-header span {
      font-weight: 600;
      font-size: 14px;
      color: var(--ion-color-step-600, #666);
    }
    mat-form-field { 
      width: 100%; 
      margin-bottom: -1em; 
    }
    mat-form-field:last-child {
      margin-bottom: -1.25em;
    }
    .filter-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .w-full { width: 100%; }
  `]
})
export class ReportFilterBuilderComponent {
  @Input() availableFields: ReportFieldMetadata[] = [];
  @Input() set currentFilters(val: any) {
    if (Array.isArray(val)) {
      this.filters = val.map(f => ({ ...f }));
    } else {
      this.filters = [];
    }
  }
  @Output() filtersApplied = new EventEmitter<any[]>();

  public filters: any[] = [];

  addFilter() {
    this.filters.push({ fieldKey: '', operator: 'equals', value1: '', value2: '' });
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
  }

  onFieldChange(index: number) {
    this.filters[index].operator = 'equals';
    this.filters[index].value1 = '';
    this.filters[index].value2 = '';
  }

  applyFilters() {
    this.filtersApplied.emit(this.filters);
  }
}
