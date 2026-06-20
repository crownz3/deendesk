import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take } from 'rxjs';
import { UserRole } from '../models/domain.model';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data['roles'] as UserRole[] | undefined;

  return auth.profile$.pipe(
    take(1),
    map((profile): boolean | UrlTree => {
      if (!roles || roles.length === 0) {
        return true;
      }

      return auth.hasRole(profile, roles) ? true : router.createUrlTree(['/dashboard']);
    }),
  );
};
