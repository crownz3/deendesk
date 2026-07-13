import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stats-card',
  templateUrl: './stats-card.component.html',
  styleUrls: ['./stats-card.component.scss'],
  standalone: false,
})
export class StatsCardComponent {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() icon = 'analytics';
  @Input() tone: 'primary' | 'success' | 'warning' | 'danger' | 'purple' = 'primary';
  @Input() helper = '';

  get isTextValue(): boolean {
    return typeof this.value === 'string' && isNaN(Number(this.value));
  }
}
