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
import { LoaderService } from '../../core/services/loader.service';

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
  isAvatarLoading = false;
  avatarLoadFailed = false;

  getDefaultAvatar(gender?: string | null): string {
    const normalizedGender = (gender || '').toLowerCase().trim();
    if (normalizedGender === 'male') return '/assets/images/avatars/default-male.png';
    if (normalizedGender === 'female') return '/assets/images/avatars/default-female.png';
    return '/assets/images/avatars/default-neutral.png';
  }

  getAvatarUrl(user: AppUser | null | undefined): string {
    if (user?.photoURL && !this.avatarLoadFailed) {
      return user.photoURL;
    }
    return this.getDefaultAvatar(user?.gender);
  }

  onAvatarLoad(): void {
    this.isAvatarLoading = false;
    this.avatarLoadFailed = false;
  }

  onAvatarError(user?: AppUser | null): void {
    this.isAvatarLoading = false;
    this.avatarLoadFailed = true;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly imageService: ProfileImageService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
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

    try {
      await this.loader.withLoader('Saving profile changes...', async () => {
        await this.repo.update('users', profile.uid, this.form.getRawValue(), profile);
      });
      this.form.markAsPristine();
      this.snackBar.open('Profile updated.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Unable to save changes. Please check the details and try again.', 'Close', { duration: 4000 });
    }
  }

  async upload(event: Event, profile: AppUser): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploading = true;
    try {
      this.isAvatarLoading = true;
      this.avatarLoadFailed = false;

      await this.loader.withLoader('Uploading profile image...', async () => {
        const url = await this.imageService.uploadProfileImage(profile.uid, file);

        const auth = getAuth(getDeenDeskFirebaseApp());
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { photoURL: url });
        }

        await this.repo.update('users', profile.uid, { photoURL: url }, profile);
      });

      this.snackBar.open('Profile image uploaded.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Unable to upload image. Please try a smaller file or check your connection.', 'Close', { duration: 4000 });
    } finally {
      this.uploading = false;
    }
  }
}
