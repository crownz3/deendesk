import { Component } from '@angular/core';
import { LoaderService } from '../../../core/services/loader.service';

@Component({
  selector: 'app-global-loader',
  templateUrl: './global-loader.component.html',
  styleUrls: ['./global-loader.component.scss'],
  standalone: false
})
export class GlobalLoaderComponent {
  loading$ = this.loader.loading$;
  message$ = this.loader.message$;

  constructor(public loader: LoaderService) {}

  isAuthOrLogin(message: string | null): boolean {
    if (!message) return false;
    const m = message.toLowerCase();
    return m.includes('authenticat') ||
           m.includes('login') ||
           m.includes('logging') ||
           m.includes('sign') ||
           m.includes('switch') ||
           m.includes('session') ||
           m.includes('secure');
  }

  onBackdropClick(): void {
    const currentMsg = this.loader.getMessage();
    if (this.isAuthOrLogin(currentMsg)) return;
    this.loader.reset();
  }

  dismissLoader(): void {
    const currentMsg = this.loader.getMessage();
    if (this.isAuthOrLogin(currentMsg)) return;
    this.loader.reset();
  }
}
