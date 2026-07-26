import { Component, Input, OnChanges } from '@angular/core';
import { ROLE_LABELS } from '../../../core/constants/defaults';
import { UserRole } from '../../../core/models/domain.model';

@Component({
  selector: 'app-role-badge',
  templateUrl: './role-badge.component.html',
  styleUrls: ['./role-badge.component.scss'],
  standalone: false,
})
export class RoleBadgeComponent implements OnChanges {
  @Input() role: UserRole | string | string[] | undefined;

  badges: { label: string; class: string }[] = [];

  ngOnChanges(): void {
    this.badges = this.getBadges();
  }

  private getBadges(): { label: string; class: string }[] {
    if (!this.role) return [];

    let roles: string[] = [];
    if (Array.isArray(this.role)) {
      roles = [...this.role];
    } else if (typeof this.role === 'string') {
      roles = this.role.split(',').map(r => r.trim());
    }

    if (roles.includes('madrasaIncharge') && !roles.includes('teacher')) {
      roles.push('teacher');
    }

    return roles.map(r => {
      const label = r in ROLE_LABELS
        ? ROLE_LABELS[r as UserRole]
        : (r ? r.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim() : 'User');
      const cssClass = `role-${r}`;
      return { label, class: cssClass };
    });
  }
}
