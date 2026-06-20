import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TableColumn } from '../../../core/models/domain.model';
import { EntityRecord } from '../../../core/services/repository.service';

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  standalone: false,
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() rows: EntityRecord[] = [];
  @Input() emptyTitle = 'No data found';
  @Input() emptyText = 'No records found for the selected filter.';
  @Input() emptyButton?: string;
  @Input() emptyIcon = 'file-tray-outline';
  @Input() showActions = true;
  @Input() allowCredentials = false;
  @Input() allowPromotion = false;

  @Output() edit = new EventEmitter<EntityRecord>();
  @Output() remove = new EventEmitter<EntityRecord>();
  @Output() credentials = new EventEmitter<EntityRecord>();
  @Output() promote = new EventEmitter<EntityRecord>();
  @Output() emptyAction = new EventEmitter<void>();

  get displayedColumns(): string[] {
    return this.showActions ? [...this.columns.map((column) => column.key), 'actions'] : this.columns.map((column) => column.key);
  }

  value(row: EntityRecord, key: string): unknown {
    return row[key];
  }

  text(row: EntityRecord, key: string): string {
    const value = this.value(row, key);
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : '-';
    }
    return value === undefined || value === null || value === '' ? '-' : String(value);
  }

  trackByColumn(_: number, column: TableColumn): string {
    return column.key;
  }

  trackByRow(_: number, row: EntityRecord): string {
    return String(row.id ?? row['uid'] ?? row['email'] ?? JSON.stringify(row));
  }
}
