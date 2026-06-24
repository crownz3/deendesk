import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoaderService } from '../../core/services/loader.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.scss'],
  standalone: false,
})
export class ChangePasswordPage implements OnInit, OnDestroy {
  readonly form = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/)
    ]],
    confirmPassword: ['', Validators.required],
  });
  loading = false;
  hideCurrent = true;
  hideNew = true;
  hideConfirm = true;
  userEmail = 'Unknown email';
  private emailSub?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
  ) { }

  ngOnInit() {
    this.emailSub = combineLatest([this.auth.authUser$, this.auth.profile$]).subscribe(([authUser, profile]) => {
      this.userEmail = authUser?.email || profile?.email || 'Unknown email';
    });
  }

  ngOnDestroy() {
    this.emailSub?.unsubscribe();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  async changeMail(): Promise<void> {
    await this.auth.logout();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();

    if (newPassword !== confirmPassword) {
      this.snackBar.open('New passwords do not match.', 'Close', { duration: 4000 });
      return;
    }

    try {
      await this.loader.withLoader('Changing your password securely...', async () => {
        await this.auth.changeTemporaryPassword(currentPassword!, newPassword!);
      });
      this.snackBar.open('Password changed successfully. Please login/use your new password from now on.', 'Close', { duration: 5000 });
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    }
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('auth/invalid-credential') || message.includes('INVALID_LOGIN_CREDENTIALS')) {
      return 'The current temporary password does not match Firebase Authentication. Please ask admin to reset the temporary password.';
    }
    return message.replace('Firebase:', '').trim();
  }
}
