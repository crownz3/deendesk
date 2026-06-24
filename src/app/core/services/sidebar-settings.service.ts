import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SidebarMode = 'overlay' | 'push' | 'split';

@Injectable({
  providedIn: 'root'
})
export class SidebarSettingsService {
  private readonly STORAGE_KEY = 'deendesk_sidebar_mode';
  private modeSubject = new BehaviorSubject<SidebarMode>(this.getStoredMode());
  
  sidebarMode$ = this.modeSubject.asObservable();

  get currentMode(): SidebarMode {
    return this.modeSubject.value;
  }

  setSidebarMode(mode: SidebarMode): void {
    localStorage.setItem(this.STORAGE_KEY, mode);
    this.modeSubject.next(mode);
  }

  private getStoredMode(): SidebarMode {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'overlay' || stored === 'push' || stored === 'split') {
      return stored as SidebarMode;
    }
    return 'split'; // Default to Split / Fixed Sidebar
  }
}
