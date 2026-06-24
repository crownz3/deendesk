import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PasswordResetRequest } from '../../core/models/domain.model';

export interface SetTemporaryPasswordDialogData {
  request: PasswordResetRequest;
}

@Component({
  selector: 'app-set-temporary-password-dialog',
  templateUrl: './set-temporary-password-dialog.component.html',
  styleUrls: [], // Can add custom styles if needed, but standard material styling might be enough
  standalone: false
})
export class SetTemporaryPasswordDialogComponent {
  form: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<SetTemporaryPasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SetTemporaryPasswordDialogData
  ) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.password);
    }
  }
}
