import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.profile$.pipe(
    take(1),
    map((profile): boolean | UrlTree => {
      if (!profile) {
        return router.createUrlTree(['/login']);
      }

      if (profile.status !== 'active') {
        return router.createUrlTree(['/login'], { queryParams: { status: 'pending' } });
      }

      return true;
    }),
  );
};
