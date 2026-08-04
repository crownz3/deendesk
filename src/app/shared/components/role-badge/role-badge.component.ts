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
  @Input() excludeRole: string | string[] | undefined;

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

    let excludes: string[] = [];
    if (Array.isArray(this.excludeRole)) {
      excludes = [...this.excludeRole];
    } else if (typeof this.excludeRole === 'string') {
      excludes = [this.excludeRole];
    }

    if (excludes.length > 0) {
      roles = roles.filter(r => !excludes.includes(r));
    }

    const uniqueBadges: { label: string; class: string }[] = [];
    const seenLabels = new Set<string>();

    roles.forEach(r => {
      // Exclude redundant 'staff' if more specific staff/teaching roles are present
      if (r.toLowerCase() === 'staff' && roles.some(other => ['teacher', 'ustadh', 'madrasaincharge', 'stagehead', 'coordinator', 'headteacher'].includes(other.toLowerCase()))) {
        return;
      }
      const label = r in ROLE_LABELS
        ? ROLE_LABELS[r as UserRole]
        : (r ? r.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim() : 'User');

      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        uniqueBadges.push({ label, class: `role-${r}` });
      }
    });

    return uniqueBadges;
  }
}
