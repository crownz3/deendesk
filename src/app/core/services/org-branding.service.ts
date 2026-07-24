import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap, shareReplay } from 'rxjs/operators';
import { doc, onSnapshot, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { CustomMenuItemConfig, OrganizationBranding } from '../models/domain.model';
import { getDeenDeskFirebaseApp } from './firebase-app';

const DEFAULT_APP_NAME = 'Deen Desk';
const DEFAULT_LOGO_URL = 'assets/images/deendesk-logo.png';
const DEFAULT_SUBTITLE = 'Madrasa Management';

@Injectable({
  providedIn: 'root',
})
export class OrgBrandingService {
  private readonly app = getDeenDeskFirebaseApp();
  private readonly db = getFirestore(this.app);

  readonly activeOrgData$: Observable<{ branding?: OrganizationBranding; customMenu?: CustomMenuItemConfig[] } | null> =
    this.auth.profile$.pipe(
      switchMap((profile) => {
        if (!profile || !profile.organizationId) {
          return of(null);
        }
        const orgId = profile.organizationId;
        const orgRef = doc(this.db, `organizations/${orgId}`);

        return new Observable<{ branding?: OrganizationBranding; customMenu?: CustomMenuItemConfig[] } | null>((subscriber) => {
          const unsubscribe = onSnapshot(
            orgRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data();
                subscriber.next({
                  branding: data['branding'] as OrganizationBranding,
                  customMenu: data['customMenu'] as CustomMenuItemConfig[],
                });
              } else {
                subscriber.next(null);
              }
            },
            (error) => {
              console.error('[OrgBrandingService] Realtime branding error:', error);
              subscriber.next(null);
            }
          );

          return () => unsubscribe();
        });
      }),
      shareReplay(1)
    );

  readonly branding$: Observable<OrganizationBranding | null> = this.activeOrgData$.pipe(
    map((org) => org?.branding || null)
  );

  readonly customMenu$: Observable<CustomMenuItemConfig[] | null> = this.activeOrgData$.pipe(
    map((org) => org?.customMenu || null)
  );

  readonly appName$: Observable<string> = this.branding$.pipe(
    map((b) => (b && b.appName && b.appName.trim() ? b.appName.trim() : DEFAULT_APP_NAME))
  );

  readonly logoUrl$: Observable<string> = this.branding$.pipe(
    map((b) => (b && b.logoUrl && b.logoUrl.trim() ? b.logoUrl.trim() : DEFAULT_LOGO_URL))
  );

  readonly subTitle$: Observable<string> = this.branding$.pipe(
    map((b) => (b && b.subTitle && b.subTitle.trim() ? b.subTitle.trim() : DEFAULT_SUBTITLE))
  );

  constructor(private readonly auth: AuthService) {}

  async saveBrandingAndMenu(
    orgId: string,
    branding: OrganizationBranding,
    customMenu: CustomMenuItemConfig[]
  ): Promise<void> {
    if (!orgId) {
      throw new Error('Organization ID is required to save branding settings.');
    }
    const orgRef = doc(this.db, `organizations/${orgId}`);
    await updateDoc(orgRef, {
      branding,
      customMenu,
      updatedAt: serverTimestamp(),
    });
  }

  async resetBrandingAndMenu(orgId: string): Promise<void> {
    if (!orgId) return;
    const orgRef = doc(this.db, `organizations/${orgId}`);
    await updateDoc(orgRef, {
      branding: {},
      customMenu: [],
      updatedAt: serverTimestamp(),
    });
  }
}
