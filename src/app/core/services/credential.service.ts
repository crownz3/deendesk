import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { GENERATED_EMAIL_DOMAIN } from '../constants/defaults';

@Injectable({ providedIn: 'root' })
export class CredentialService {
  buildStudentCredentials(name: string, fatherName: string, madrasaId: string, dateOfBirth: string, madrasaCode?: string): { studentEmail: string; parentEmail: string; password: string, base: string } {
    const firstName = name.trim().split(' ')[0] || 'student';
    const baseName = this.slug(firstName).replace(/\./g, '');
    const scopeCode = this.slug(madrasaCode || madrasaId || 'dd').replace(/\./g, '').slice(0, 4);
    
    let suffix = `${Math.floor(1000 + Math.random() * 9000)}`;
    if (dateOfBirth) {
      const parts = dateOfBirth.split('-');
      if (parts.length === 3) {
        suffix = `${parts[2]}${parts[1]}`; // DDMM
      } else {
        const digits = dateOfBirth.replace(/\D/g, '');
        if (digits.length >= 4) {
          suffix = digits.slice(-4);
        }
      }
    }

    const base = `${baseName}.${scopeCode}.${suffix}`;
    const domain = environment.generatedEmailDomain || GENERATED_EMAIL_DOMAIN;
    const password = this.createPassword(name, dateOfBirth);

    return {
      studentEmail: `${base}@${domain}`,
      parentEmail: `${base}.parent@${domain}`,
      password,
      base
    };
  }
  
  getShortLoginEmail(base: string, type: 'student' | 'parent', counter?: number): string {
    const domain = environment.generatedEmailDomain || GENERATED_EMAIL_DOMAIN;
    const counterSuffix = counter ? `.${counter}` : '';
    if (type === 'parent') {
      return `${base}.parent${counterSuffix}@${domain}`;
    }
    return `${base}${counterSuffix}@${domain}`;
  }

  createPassword(name: string, dateOfBirth?: string): string {
    const prefix = this.slug(name).slice(0, 4).padEnd(4, 'x');
    const dob = dateOfBirth?.replace(/\D/g, '').slice(-4) || `${Math.floor(1000 + Math.random() * 9000)}`;
    const random = Math.random().toString(36).slice(2, 6);
    return `${prefix[0].toUpperCase()}${prefix.slice(1)}@${dob}${random}`;
  }

  getCredentialStatus(user: any, fallbackPassword?: string): { status: string; display: string } {
    if (!user) {
      return { status: 'LOGIN_NOT_CREATED', display: 'Login not created' };
    }
    if (user.mustChangePassword === true) {
      const display = user.temporaryPasswordForAdminView || fallbackPassword || 'Temporary password pending';
      return { status: 'TEMP_PASSWORD_PENDING', display };
    }
    return { status: 'PASSWORD_CHANGED', display: 'Password changed' };
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
