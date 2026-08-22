import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take, catchError, of, switchMap, filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AppUser } from '../models/domain.model';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authUser$.pipe(
    switchMap(authUser => {
      if (!authUser) {
        return of(router.createUrlTree(['/login']));
      }

      return auth.loadingProfile$.pipe(
        filter(loading => !loading),
        switchMap(() => auth.profile$),
        take(1),
        map(profile => {
          if (!profile) {
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
        })
      );
    }),
    catchError(() => {
      return of(router.createUrlTree(['/login']));
    })
  );
};
