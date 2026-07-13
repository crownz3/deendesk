import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ReportFieldMetadata } from '../../../core/models/report.model';

@Component({
  selector: 'app-report-filter-builder',
  standalone: false,
  template: `
    <div class="filter-builder">
      <div class="filter-item" *ngFor="let filter of filters; let i = index">
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
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" *ngIf="filter.operator !== 'between'">
          <input matInput [(ngModel)]="filter.value1" placeholder="Value">
        </mat-form-field>
        
        <mat-form-field appearance="outline" *ngIf="filter.operator === 'between'">
          <input matInput [(ngModel)]="filter.value1" placeholder="Min Value">
        </mat-form-field>
        <mat-form-field appearance="outline" *ngIf="filter.operator === 'between'">
          <input matInput [(ngModel)]="filter.value2" placeholder="Max Value">
        </mat-form-field>

        <button mat-icon-button color="warn" (click)="removeFilter(i)">
          <mat-icon>delete</mat-icon>
        </button>
      </div>

      <button mat-stroked-button color="primary" (click)="addFilter()">
        <mat-icon>add</mat-icon> Add Filter
      </button>
      <button mat-flat-button color="primary" style="margin-left: 8px;" (click)="applyFilters()">
        Apply Filters
      </button>
    </div>
  `,
  styles: [`
    .filter-builder { display: flex; flex-direction: column; gap: 8px; }
    .filter-item { display: flex; gap: 8px; align-items: center; }
    mat-form-field { margin-bottom: -1.25em; width: 100%; }
  `]
})
export class ReportFilterBuilderComponent {
  @Input() availableFields: ReportFieldMetadata[] = [];
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
