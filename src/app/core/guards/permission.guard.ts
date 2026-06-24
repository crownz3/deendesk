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

  return auth.profile$.pipe(
    take(1),
    map((profile): boolean | UrlTree => {
      console.log('[Madrasa Incharge Profile Validation]', {
        uid: profile?.uid,
        email: profile?.email,
        status: profile?.status,
        organizationId: profile?.organizationId,
        madrasaId: profile?.madrasaId,
        madrasaIds: profile?.madrasaIds,
        permissions: profile?.permissions,
        hasOrganizationId: Boolean(profile?.organizationId),
        hasMadrasaIds: Array.isArray(profile?.madrasaIds) && profile.madrasaIds.length > 0,
        canViewDashboard: profile?.permissions?.includes('viewDashboard'),
        canManageStaff: profile?.permissions?.includes('manageStaff'),
        canManageStudents: profile?.permissions?.includes('manageStudents'),
        canManageParents: profile?.permissions?.includes('manageParents'),
        canManageCourses: profile?.permissions?.includes('manageCourses'),
        canManageClasses: profile?.permissions?.includes('manageClasses'),
        canManageSubjects: profile?.permissions?.includes('manageSubjects'),
        canManageAcademicPlans: profile?.permissions?.includes('manageAcademicPlans'),
      });

      if (profile?.status !== 'active' && profile?.role !== 'superAdmin') {
         console.warn('[Route Permission Failed Reason]', {
          url: state.url,
          role: profile?.role,
          requiredPermission,
          permissionsAny,
          userPermissions: profile?.permissions ?? [],
          reason: 'User profile is not active',
        });
        return router.createUrlTree(['/dashboard']);
      }

      if (roleRequired && profile?.role !== roleRequired) {
        console.warn('[Route Permission Failed Reason]', {
          url: state.url,
          role: profile?.role,
          requiredPermission,
          permissionsAny,
          userPermissions: profile?.permissions ?? [],
          reason: 'Missing required role',
        });
        return router.createUrlTree(['/dashboard']);
      }

      const userPermissions = profile?.permissions ?? [];
      const hasSingle = requiredPermission ? auth.hasAnyPermission(profile, Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]) : true;
      const hasAny = permissionsAny && permissionsAny.length > 0 ? permissionsAny.some(permission => userPermissions.includes(permission)) : true;

      const allowed = hasSingle && hasAny;

      console.log('[Route Guard Debug]', {
        url: state.url,
        role: profile?.role,
        status: profile?.status,
        permissions: profile?.permissions,
        requiredPermission: route.data?.['permission'],
        requiredPermissionsAny: route.data?.['permissionsAny'],
        organizationId: profile?.organizationId,
        madrasaId: profile?.madrasaId,
        madrasaIds: profile?.madrasaIds,
        allowed,
      });

      console.log('[Route Permission Result]', {
        url: state.url,
        role: profile?.role,
        requiredPermission,
        permissionsAny,
        userPermissions: profile?.permissions ?? [],
        hasSingle,
        hasAny,
        allowed,
      });

      if (allowed) {
         return true;
      } else {
        console.warn('[Route Permission Failed Reason]', {
          url: state.url,
          role: profile?.role,
          requiredPermission,
          permissionsAny,
          userPermissions: profile?.permissions ?? [],
          reason: 'No matching permissions',
        });
        return router.createUrlTree(['/dashboard']);
      }
    }),
  );
};
