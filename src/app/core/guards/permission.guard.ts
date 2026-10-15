import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take } from 'rxjs';
import { PermissionKey } from '../models/domain.model';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredPermission = route.data['permission'] as PermissionKey | PermissionKey[] | undefined;
  const permissionsAny = route.data['permissionsAny'] as PermissionKey[] | undefined;
  const roleRequired = route.data['roleRequired'] as string | undefined;
  const rolesAny = route.data['rolesAny'] as string[] | undefined;

  return auth.profile$.pipe(
    take(1),
    map((profile): boolean | UrlTree => {
      if (profile?.status !== 'active' && profile?.role !== 'superAdmin') {
        return router.createUrlTree(['/dashboard']);
      }

      if (roleRequired && profile?.role !== roleRequired) {
        return router.createUrlTree(['/dashboard']);
      }

      if (rolesAny && rolesAny.length > 0 && !auth.hasRole(profile, rolesAny as any)) {
        return router.createUrlTree(['/dashboard']);
      }

      const hasSingle = requiredPermission ? auth.hasAnyPermission(profile, Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]) : true;
      const hasAny = permissionsAny && permissionsAny.length > 0 ? auth.hasAnyPermission(profile, permissionsAny) : true;

      const allowed = hasSingle && hasAny;

      if (allowed) {
         return true;
      } else {
        return router.createUrlTree(['/dashboard']);
      }
    }),
  );
};
