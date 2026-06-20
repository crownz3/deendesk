import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { GENERATED_EMAIL_DOMAIN } from '../constants/defaults';

@Injectable({ providedIn: 'root' })
export class CredentialService {
  buildStudentCredentials(name: string, fatherName: string, madrasaId: string, dateOfBirth: string): { studentEmail: string; parentEmail: string; password: string } {
    const base = [
      this.slug(name),
      this.slug(fatherName),
      this.slug(madrasaId),
      dateOfBirth.replace(/\D/g, ''),
    ].filter(Boolean).join('.');
    const domain = environment.generatedEmailDomain || GENERATED_EMAIL_DOMAIN;
    const password = this.createPassword(name, dateOfBirth);

    return {
      studentEmail: `${base}@${domain}`,
      parentEmail: `${base}.parent@${domain}`,
      password,
    };
  }

  createPassword(name: string, dateOfBirth?: string): string {
    const prefix = this.slug(name).slice(0, 4).padEnd(4, 'x');
    const dob = dateOfBirth?.replace(/\D/g, '').slice(-4) || `${Math.floor(1000 + Math.random() * 9000)}`;
    const random = Math.random().toString(36).slice(2, 6);
    return `${prefix[0].toUpperCase()}${prefix.slice(1)}@${dob}${random}`;
  }

  private slug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 40);
  }
}
