import { Component, Input } from '@angular/core';
import { EntityStatus } from '../../../core/models/domain.model';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss'],
  standalone: false,
})
export class StatusBadgeComponent {
  @Input() status: EntityStatus | string | undefined = 'active';
}
