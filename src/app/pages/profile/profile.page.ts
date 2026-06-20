import { Component, DestroyRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { ProfileImageService } from '../../core/services/profile-image.service';
import { RepositoryService } from '../../core/services/repository.service';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { getAuth, updateProfile } from 'firebase/auth';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    phone: [''],
  });
  uploading = false;
  isProfileImageLoading = false;
  imageLoadFailed = false;

  getDefaultAvatar(gender?: string | null): string {
    const normalizedGender = (gender || '').toLowerCase();
    if (normalizedGender === 'male') return 'assets/images/avatars/default-male.png';
    if (normalizedGender === 'female') return 'assets/images/avatars/default-female.png';
    return 'assets/images/avatars/default-neutral.png';
  }

  shouldShowFirebaseImage(profile: AppUser | null): boolean {
    return !!profile?.photoURL && !this.imageLoadFailed;
  }

  onProfileImageLoad(): void {
    this.isProfileImageLoading = false;
    this.imageLoadFailed = false;
  }

  onProfileImageError(): void {
    this.isProfileImageLoading = false;
    this.imageLoadFailed = true;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly imageService: ProfileImageService,
    private readonly snackBar: MatSnackBar,
    destroyRef: DestroyRef,
  ) {
    this.profile$.pipe(takeUntilDestroyed(destroyRef)).subscribe((profile) => {
      if (profile && !this.form.dirty) {
        this.form.patchValue({
          displayName: profile.displayName,
          phone: profile.phone ?? '',
        }, { emitEvent: false });
      }
    });
  }

  async save(profile: AppUser): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    await this.repo.update('users', profile.uid, this.form.getRawValue(), profile);
    this.form.markAsPristine();
    this.snackBar.open('Profile updated.', 'Close', { duration: 3000 });
  }

  async upload(event: Event, profile: AppUser): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploading = true;
    try {
      this.isProfileImageLoading = true;
      this.imageLoadFailed = false;
      const url = await this.imageService.uploadProfileImage(profile.uid, file);

      const auth = getAuth(getDeenDeskFirebaseApp());
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
      }

      await this.repo.update('users', profile.uid, { photoURL: url }, profile);
      this.snackBar.open('Profile image uploaded.', 'Close', { duration: 3000 });
    } finally {
      this.uploading = false;
    }
  }
}
