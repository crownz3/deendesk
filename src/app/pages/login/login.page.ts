import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { collection, getDocs, getFirestore, limit, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { AppUser, UserRole } from '../../core/models/domain.model';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { AuthService } from '../../core/services/auth.service';
import { LoaderService } from '../../core/services/loader.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly authReady$: Observable<boolean> = this.auth.authReady$;
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  loading = false;
  hidePassword = true;
  lastProfile: { displayName: string; email: string; role: string } | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
    private readonly loader: LoaderService,
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

    try {
      await this.loader.withLoader('Signing you in securely...', async () => {
        const { email, password } = this.form.getRawValue();
        await this.auth.loginWithEmail(email.trim().toLowerCase(), password);
        await this.router.navigateByUrl('/continue');
      });
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    }
  }

  async googleLogin(): Promise<void> {
    try {
      await this.loader.withLoader('Signing you in securely...', async () => {
        await this.auth.loginWithGoogle();
        await this.router.navigateByUrl('/continue');
      });
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    }
  }

  async resetPassword(): Promise<void> {
    const email = this.form.controls.email.value;
    if (!email) {
      this.snackBar.open('Enter your email first.', 'Close', { duration: 3000 });
      return;
    }

    try {
      await this.loader.withLoader('Sending password reset link...', async () => {
        await this.auth.sendReset(email);
      });
      this.snackBar.open('Password reset email sent if the account uses a real email address.', 'Close', { duration: 6000 });
    } catch (error) {
      this.snackBar.open(this.errorMessage(error), 'Close', { duration: 6000 });
    }
  }

  async requestPasswordReset(): Promise<void> {
    const email = this.form.controls.email.value;
    if (!email) {
      this.snackBar.open('Enter your email first.', 'Close', { duration: 3000 });
      return;
    }

    try {
      await this.loader.withLoader('Sending request to admin...', async () => {
        const firestore = getFirestore(getDeenDeskFirebaseApp());
        
        const requestData = {
          requesterEmail: email,
          normalizedEmail: email.toLowerCase().trim(),
          status: 'PENDING',
          source: 'LOGIN_PAGE',
          requestMessage: 'User requested help resetting password.',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: null,
          requesterUid: null,
          requesterName: null,
          requesterRole: null,
          organizationId: null,
          madrasaIds: [],
          assignedToUid: null,
          assignedToRole: null
        };

        await addDoc(collection(firestore, 'passwordResetRequests'), requestData);
      });
      
      this.snackBar.open('If this account exists, your password reset request has been submitted.', 'Close', { duration: 6000 });
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
    if (message.includes('auth/invalid-credential') || message.includes('INVALID_LOGIN_CREDENTIALS')) {
      return 'The current temporary password does not match Firebase Authentication. Please ask admin to reset the temporary password.';
    }
    return message.replace('Firebase:', '').trim();
  }
}
