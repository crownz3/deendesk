import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { combineLatest, map, take, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return combineLatest([auth.authUser$, auth.profile$]).pipe(
    take(1),
    map(([authUser, profile]): boolean | UrlTree => {
      if (!authUser) {
        return router.createUrlTree(['/login']);
      }

      if (!profile) {
        console.warn('[Guard] Auth user exists but profile missing');
        return router.createUrlTree(['/login']);
      }

      if (profile.status !== 'active') {
        return router.createUrlTree(['/login'], { queryParams: { status: 'pending' } });
      }

      if (profile.mustChangePassword && state.url !== '/change-password') {
        return router.createUrlTree(['/change-password']);
      }

      if (!profile.mustChangePassword && state.url === '/change-password') {
        return router.createUrlTree(['/dashboard']);
      }

      return true;
    }),
    catchError(error => {
      console.error('[Guard] Guard failed:', error);
      return of(router.createUrlTree(['/login']));
    })
  );
};
