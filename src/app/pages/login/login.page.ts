import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  loading = false;
  lastProfile: { displayName: string; email: string; role: string } | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const stored = localStorage.getItem('deendesk.lastProfile');
    this.lastProfile = stored ? JSON.parse(stored) as { displayName: string; email: string; role: string } : null;

    if (this.route.snapshot.queryParamMap.get('status') === 'pending') {
      this.snackBar.open('Your access is pending. Please contact your organization authority.', 'Close', { duration: 6000 });
    }
  }

  async login(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.loginWithEmail(email, password);
      await this.router.navigateByUrl('/continue');
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    } finally {
      this.loading = false;
    }
  }

  async googleLogin(): Promise<void> {
    this.loading = true;
    try {
      await this.auth.loginWithGoogle();
      await this.router.navigateByUrl('/continue');
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    } finally {
      this.loading = false;
    }
  }

  async resetPassword(): Promise<void> {
    const email = this.form.controls.email.value;
    if (!email) {
      this.snackBar.open('Enter your email first.', 'Close', { duration: 3000 });
      return;
    }

    try {
      await this.auth.sendReset(email);
      this.snackBar.open('Password reset email sent if the account uses a real email address.', 'Close', { duration: 6000 });
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    }
  }

  async continue(profile: AppUser): Promise<void> {
    if (profile.status !== 'active') {
      this.snackBar.open('This account is not active yet.', 'Close', { duration: 5000 });
      return;
    }
    await this.router.navigateByUrl('/dashboard');
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace('Firebase:', '').trim();
  }
}
