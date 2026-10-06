import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private loadingCount = 0;
  private autoDismissTimer: any = null;
  private showDelayTimer: any = null;

  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Loading, please wait...');

  loading$ = this.loadingSubject.asObservable();
  message$ = this.messageSubject.asObservable();

  show(message = 'Loading, please wait...'): void {
    this.loadingCount++;
    this.messageSubject.next(message);

    if (this.loadingCount === 1) {
      if (this.showDelayTimer) clearTimeout(this.showDelayTimer);
      this.showDelayTimer = setTimeout(() => {
        this.loadingSubject.next(true);

        // Safety timeout: auto-reset loader after 12 seconds to prevent screen touch freeze
        if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = setTimeout(() => {
          this.reset();
        }, 12000);
      }, 300);
    }
  }

  hide(): void {
    this.loadingCount = Math.max(0, this.loadingCount - 1);

    if (this.loadingCount === 0) {
      this.reset();
    }
  }

  getMessage(): string {
    return this.messageSubject.value || '';
  }

  setMessage(message: string): void {
    this.messageSubject.next(message);
  }

  reset(): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
    if (this.showDelayTimer) {
      clearTimeout(this.showDelayTimer);
      this.showDelayTimer = null;
    }
    this.loadingCount = 0;
    this.loadingSubject.next(false);
    this.messageSubject.next('Loading, please wait...');
  }

  async withLoader<T>(message: string, task: () => Promise<T>): Promise<T> {
    this.show(message);
    try {
      return await task();
    } finally {
      this.hide();
    }
  }
}
