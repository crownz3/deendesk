import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, ROLE_ORDER, ROLE_PERMISSIONS } from '../../core/constants/defaults';
import { PermissionKey, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.page.html',
  styleUrls: ['./permissions.page.scss'],
  standalone: false,
})
export class PermissionsPage {
  readonly roles = ROLE_ORDER;
  readonly permissions = ALL_PERMISSIONS;
  readonly roleLabels = ROLE_LABELS;
  readonly permissionLabels = PERMISSION_LABELS;
  readonly selected: Record<UserRole, PermissionKey[]> = {
    superAdmin: [...ROLE_PERMISSIONS.superAdmin],
    organizationAdmin: [...ROLE_PERMISSIONS.organizationAdmin],
    coordinator: [...ROLE_PERMISSIONS.coordinator],
    madrasaIncharge: [...ROLE_PERMISSIONS.madrasaIncharge],
    teacher: [...ROLE_PERMISSIONS.teacher],
    student: [...ROLE_PERMISSIONS.student],
    parent: [...ROLE_PERMISSIONS.parent],
  };

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
  ) {}

  checked(role: UserRole, permission: PermissionKey): boolean {
    return this.selected[role].includes(permission);
  }

  toggle(role: UserRole, permission: PermissionKey, checked: boolean): void {
    if (role === 'superAdmin') {
      return;
    }

    this.selected[role] = checked
      ? Array.from(new Set([...this.selected[role], permission]))
      : this.selected[role].filter((item) => item !== permission);
  }

  async save(role: UserRole): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    await this.repo.create('permissionTemplates', {
      role,
      permissions: this.selected[role],
      status: 'active',
    }, profile, role);
    this.snackBar.open(`${ROLE_LABELS[role]} permissions saved.`, 'Close', { duration: 3000 });
  }
}
