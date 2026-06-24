import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ROLE_LABELS } from '../../core/constants/defaults';
import { AppUser, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-continue-account',
  templateUrl: './continue-account.page.html',
  styleUrls: ['./continue-account.page.scss'],
  standalone: false,
})
export class ContinueAccountPage {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly authReady$: Observable<boolean> = this.auth.authReady$;
  readonly roleLabels = ROLE_LABELS;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  roleLabel(role: UserRole): string {
    return this.roleLabels[role];
  }

  async continue(profile: AppUser): Promise<void> {
    if (profile.status === 'active') {
      if (profile.mustChangePassword) {
        await this.router.navigateByUrl('/change-password');
      } else {
        await this.router.navigateByUrl('/dashboard');
      }
    }
  }

  async switchAccount(): Promise<void> {
    await this.auth.logout();
  }
}
