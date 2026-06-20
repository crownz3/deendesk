import { Component, Input } from '@angular/core';
import { ROLE_LABELS } from '../../../core/constants/defaults';
import { UserRole } from '../../../core/models/domain.model';

@Component({
  selector: 'app-role-badge',
  templateUrl: './role-badge.component.html',
  styleUrls: ['./role-badge.component.scss'],
  standalone: false,
})
export class RoleBadgeComponent {
  @Input() role: UserRole | string | undefined;

  label(): string {
    return this.role && this.role in ROLE_LABELS ? ROLE_LABELS[this.role as UserRole] : String(this.role || 'User');
  }
}
