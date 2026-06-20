import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DEFAULT_COURSES, GENERATED_EMAIL_DOMAIN, SUPER_ADMIN_EMAIL } from '../../core/constants/defaults';
import { AuthService } from '../../core/services/auth.service';
import { SeedService } from '../../core/services/seed.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  readonly firebase = environment.firebase;
  readonly superAdminEmail = SUPER_ADMIN_EMAIL;
  readonly generatedEmailDomain = environment.generatedEmailDomain || GENERATED_EMAIL_DOMAIN;
  readonly defaultCourses = DEFAULT_COURSES;
  seeding = false;

  constructor(
    private readonly seedService: SeedService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
  ) {}

  async seedDefaults(): Promise<void> {
    this.seeding = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      await this.seedService.seedDefaults(profile);
      this.snackBar.open('Default courses and permission templates seeded.', 'Close', { duration: 4000 });
    } finally {
      this.seeding = false;
    }
  }
}
