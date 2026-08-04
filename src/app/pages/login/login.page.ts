import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { collection, getDocs, getFirestore, limit, query, where, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AppUser, UserRole } from '../../core/models/domain.model';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { AuthService } from '../../core/services/auth.service';
import { LoaderService } from '../../core/services/loader.service';
import { AuditLogService } from '../../core/services/audit-log.service';

import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

export interface GlowParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

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

  isDragging = false;
  particles: GlowParticle[] = [];
  private particleIdCounter = 0;
  private lastMoveTime = 0;

  private glowColors = [
    '#ffffff', // Pure Crystal White
    '#f8fafc', // Glossy Platinum
    '#f1f5f9', // Polished Silver
    '#e2e8f0', // Metallic Chrome
    '#e0f2fe', // Ice Diamond Shine
    '#bae6fd', // Glacier Silver Shimmer
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
    private readonly loader: LoaderService,
    private readonly auditLogService: AuditLogService,
  ) {}

  isSwitchingAccount = false;

  ngOnInit(): void {
    const stored = localStorage.getItem('deendesk.lastProfile');
    this.lastProfile = stored ? (JSON.parse(stored) as { displayName: string; email: string; role: string }) : null;
    if (this.lastProfile?.email) {
      this.form.controls.email.setValue(this.lastProfile.email);
    }

    if (this.route.snapshot.queryParamMap.get('status') === 'pending') {
      this.snackBar.open('Your access is pending. Please contact your organization authority.', 'Close', { duration: 6000 });
    }

    // Auto-redirect if already signed in and active
    this.auth.authReady$.subscribe(ready => {
      if (!ready) return;
      this.auth.profile$.subscribe(profile => {
        if (profile?.status === 'active') {
          const nextUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          this.router.navigateByUrl(nextUrl);
        }
      });
    });
  }

  useDifferentAccount(): void {
    this.isSwitchingAccount = true;
    this.form.reset();
  }

  onMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.login-card') || target.closest('button') || target.closest('input') || target.closest('mat-select')) {
      return;
    }
    this.isDragging = true;
    this.spawnGlowParticles(event.clientX, event.clientY, 20, true);
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    const target = event.target as HTMLElement;
    if (target.closest('.login-card')) return;

    const now = performance.now();
    if (now - this.lastMoveTime < 35) return; // Throttle to 30fps max during drag
    this.lastMoveTime = now;

    this.spawnGlowParticles(event.clientX, event.clientY, 2, false);
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const target = touch.target as HTMLElement;
      if (target.closest('.login-card') || target.closest('button') || target.closest('input')) {
        return;
      }
      this.isDragging = true;
      this.spawnGlowParticles(touch.clientX, touch.clientY, 20, true);
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging || event.touches.length === 0) return;
    const touch = event.touches[0];
    const target = touch.target as HTMLElement;
    if (target.closest('.login-card')) return;

    const now = performance.now();
    if (now - this.lastMoveTime < 35) return; // Throttle to 30fps max during drag
    this.lastMoveTime = now;

    this.spawnGlowParticles(touch.clientX, touch.clientY, 2, false);
  }

  private spawnGlowParticles(x: number, y: number, count: number, isSplash: boolean): void {
    for (let i = 0; i < count; i++) {
      const angle = isSplash
        ? (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2)
        : Math.random() * Math.PI * 2;
      const speed = isSplash ? (25 + Math.random() * 55) : (8 + Math.random() * 25);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = isSplash ? (8 + Math.floor(Math.random() * 9)) : (6 + Math.floor(Math.random() * 7));
      const color = this.glowColors[Math.floor(Math.random() * this.glowColors.length)];

      const particle: GlowParticle = {
        id: ++this.particleIdCounter,
        x,
        y,
        vx,
        vy,
        size,
        color,
      };

      this.particles.push(particle);

      // Keep particle array light and fast (max 32 particles total)
      if (this.particles.length > 32) {
        this.particles.splice(0, this.particles.length - 32);
      }

      setTimeout(() => {
        const idx = this.particles.findIndex((p) => p.id === particle.id);
        if (idx !== -1) {
          this.particles.splice(idx, 1);
        }
      }, 600);
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
        await this.auditLogService.logAction({
          module: 'Auth',
          action: 'Login',
          status: 'success',
          message: 'Email/password sign-in successful',
        });

        const nextUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        await this.router.navigateByUrl(nextUrl);
      });
    } catch (err: any) {
      console.error('[LoginPage] Sign in error:', err);
      let msg = 'Failed to sign in. Please verify your credentials.';
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err?.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please try again later.';
      }
      this.snackBar.open(msg, 'Close', { duration: 5000 });

      await this.auditLogService.logAction({
        module: 'Auth',
        action: 'Login',
        status: 'failed',
        message: err?.message || 'Login failed',
      });
    }
  }

  async googleLogin(): Promise<void> {
    try {
      await this.loader.withLoader('Connecting to Google...', async () => {
        await this.auth.loginWithGoogle();
        await this.auditLogService.logAction({
          module: 'Auth',
          action: 'Google Login',
          status: 'success',
          message: 'Google sign-in successful',
        });
        await this.router.navigateByUrl('/dashboard');
      });
    } catch (err: any) {
      console.error('[LoginPage] Google sign in error:', err);
      this.snackBar.open('Google sign in failed. Please try again.', 'Close', { duration: 5000 });
      await this.auditLogService.logAction({
        module: 'Auth',
        action: 'Google Login',
        status: 'failed',
        message: err?.message || 'Google login failed',
      });
    }
  }

  async continue(user?: AppUser | null): Promise<void> {
    const nextUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    await this.router.navigateByUrl(nextUrl);
  }

  async signOutAndSwitch(): Promise<void> {
    await this.auth.logout();
    this.snackBar.open('Signed out. Please enter credentials to sign in.', 'Close', { duration: 3000 });
  }

  async resetPassword(): Promise<void> {
    const emailControl = this.form.controls.email;
    if (!emailControl.value || emailControl.invalid) {
      emailControl.markAsTouched();
      this.snackBar.open('Please enter your valid email address first.', 'Close', { duration: 4000 });
      return;
    }

    try {
      await this.loader.withLoader('Sending password reset link...', async () => {
        await this.auth.sendReset(emailControl.value.trim().toLowerCase());
        this.snackBar.open('Password reset email sent! Check your inbox.', 'Close', { duration: 5000 });
      });
    } catch (err: any) {
      console.error('[LoginPage] Reset password error:', err);
      this.snackBar.open('Failed to send reset email. Verify email address.', 'Close', { duration: 4000 });
    }
  }

  async requestPasswordReset(): Promise<void> {
    const emailControl = this.form.controls.email;
    const email = emailControl.value ? emailControl.value.trim().toLowerCase() : '';

    if (!email) {
      this.snackBar.open('Please enter your email above to request a reset from your admin.', 'Close', { duration: 5000 });
      return;
    }

    this.loading = true;
    try {
      const app = getDeenDeskFirebaseApp();
      const db = getFirestore(app);

      const cleanEmail = email.toLowerCase().trim();

      // 1. Try sending automated Firebase Auth reset email
      try {
        const auth = getAuth(app);
        await sendPasswordResetEmail(auth, email);
      } catch (authErr) {
        console.warn('[LoginPage] Firebase Auth reset email dispatch note:', authErr);
      }

      // 2. Check if active pending request already exists for this email
      const reqRef = collection(db, 'passwordResetRequests');
      let isDuplicate = false;
      try {
        const existingQuery = query(
          reqRef,
          where('email', '==', email),
          where('status', 'in', ['PENDING', 'pending'])
        );
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
          const now = Date.now();
          for (const dSnap of existingSnap.docs) {
            const data = dSnap.data();
            const createdAt = data['createdAt']?.toDate?.()?.getTime() || data['requestedAt']?.toDate?.()?.getTime() || 0;
            // If request is within 2 hours, treat as active duplicate; if older, auto-expire it
            if (now - createdAt < 2 * 60 * 60 * 1000) {
              isDuplicate = true;
              break;
            } else {
              // Auto-expire stale request
              try {
                await updateDoc(doc(db, `passwordResetRequests/${dSnap.id}`), { status: 'EXPIRED', updatedAt: serverTimestamp() });
              } catch (e) {}
            }
          }
        }
      } catch (checkErr) {
        console.warn('[LoginPage] Pending request check note:', checkErr);
      }

      if (isDuplicate) {
        this.snackBar.open('A password reset request is already pending for this email address. Please contact your admin.', 'Close', { duration: 6000 });
        return;
      }

      // 3. Log single password reset request in Firestore
      try {
        const resetPayload: any = {
          email: cleanEmail,
          requesterEmail: cleanEmail,
          status: 'PENDING',
          requestedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        };

        await addDoc(reqRef, resetPayload);
      } catch (dbErr) {
        console.warn('[LoginPage] Firestore reset request log note:', dbErr);
      }

      this.snackBar.open('Password reset request submitted successfully! Check your email or contact your admin.', 'Close', { duration: 6000 });
    } catch (err) {
      console.error('[LoginPage] Request reset error:', err);
      this.snackBar.open('Password reset request submitted successfully! Check your email or contact your admin.', 'Close', { duration: 6000 });
    } finally {
      this.loading = false;
    }
  }
}
