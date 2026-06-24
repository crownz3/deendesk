import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private loadingCount = 0;

  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Loading, please wait...');

  loading$ = this.loadingSubject.asObservable();
  message$ = this.messageSubject.asObservable();

  show(message = 'Loading, please wait...'): void {
    this.loadingCount++;
    this.messageSubject.next(message);
    this.loadingSubject.next(true);
  }

  hide(): void {
    this.loadingCount = Math.max(0, this.loadingCount - 1);

    if (this.loadingCount === 0) {
      this.loadingSubject.next(false);
      this.messageSubject.next('Loading, please wait...');
    }
  }

  setMessage(message: string): void {
    this.messageSubject.next(message);
  }

  reset(): void {
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
