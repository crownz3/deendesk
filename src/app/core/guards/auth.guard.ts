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
            console.warn('[Guard] Auth user exists but profile missing for email:', authUser.email, 'uid:', authUser.uid);
            return router.createUrlTree(['/login']);
          }

          if (profile.status !== 'active') {
            return router.createUrlTree(['/login'], { queryParams: { status: 'pending' } });
          }

          if (state.url === '/dashboard' || state.url === '/change-password') {
            console.log('[Post Password Change Guard Debug]', {
              uid: profile?.uid,
              email: profile?.email,
              role: profile?.role,
              status: profile?.status,
              mustChangePassword: profile?.mustChangePassword,
              organizationId: profile?.organizationId,
              madrasaId: profile?.madrasaId,
              madrasaIds: profile?.madrasaIds,
              permissions: profile?.permissions,
            });
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
    catchError(error => {
      console.error('[Guard] Guard failed:', error);
      return of(router.createUrlTree(['/login']));
    })
  );
};
