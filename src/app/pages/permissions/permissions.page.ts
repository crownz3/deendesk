import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, ROLE_ORDER } from '../../core/constants/defaults';
import { PermissionKey, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { RolePermissionsService } from '../../core/services/role-permissions.service';

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.page.html',
  styleUrls: ['./permissions.page.scss'],
  standalone: false,
})
export class PermissionsPage implements OnInit {
  roles: UserRole[] = [];
  currentUserRole?: UserRole;
  readonly permissions = ALL_PERMISSIONS;
  readonly roleLabels = ROLE_LABELS;
  readonly permissionLabels = PERMISSION_LABELS;
  readonly selected: Partial<Record<UserRole, PermissionKey[]>> = {};

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly rolePermissionsService: RolePermissionsService
  ) {}

  ngOnInit() {
    this.auth.profile$.subscribe(profile => {
      this.currentUserRole = profile?.role;
      this.roles = ROLE_ORDER.filter(role => profile?.role === 'superAdmin' || role !== 'superAdmin');
      
      this.roles.forEach(role => {
        this.selected[role] = [...this.rolePermissionsService.getPermissionsForRole(role)];
      });
    });
  }

  checked(role: UserRole, permission: PermissionKey): boolean {
    return this.selected[role]?.includes(permission) ?? false;
  }

  toggle(role: UserRole, permission: PermissionKey, checked: boolean): void {
    if (role === 'superAdmin' || role === this.currentUserRole) {
      return;
    }

    const currentSelected = this.selected[role] ?? [];
    this.selected[role] = checked
      ? Array.from(new Set([...currentSelected, permission]))
      : currentSelected.filter((item) => item !== permission);
  }

  async save(role: UserRole): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    try {
      await this.loader.withLoader('Updating permissions...', async () => {
        await this.rolePermissionsService.saveTemplate(role, this.selected[role] ?? []);
      });
      this.snackBar.open(`${ROLE_LABELS[role]} permissions saved.`, 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Unable to save permissions. Please try again.', 'Close', { duration: 4000 });
    }
  }
}
