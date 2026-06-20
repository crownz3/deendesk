import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take } from 'rxjs';
import { PermissionKey } from '../models/domain.model';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data['permission'] as PermissionKey | PermissionKey[] | undefined;

  return auth.profile$.pipe(
    take(1),
    map((profile): boolean | UrlTree => {
      if (!required) {
        return true;
      }

      const permissions = Array.isArray(required) ? required : [required];
      return auth.hasAnyPermission(profile, permissions) ? true : router.createUrlTree(['/dashboard']);
    }),
  );
};
