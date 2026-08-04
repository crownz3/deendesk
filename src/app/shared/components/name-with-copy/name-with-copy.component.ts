import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { NameResolverService, ResolvableType } from '../../../core/services/name-resolver.service';

@Component({
  selector: 'app-name-with-copy',
  templateUrl: './name-with-copy.component.html',
  styleUrls: ['./name-with-copy.component.scss'],
  standalone: false,
})
export class NameWithCopyComponent implements OnInit, OnChanges {
  @Input() id?: any;
  @Input() type!: ResolvableType;
  @Input() fallbackName?: any;
  @Input() hideIcon = false;
  @Input() label?: string;

  name$!: Observable<string>;

  constructor(
    private nameResolver: NameResolverService,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.resolve();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['id'] || changes['fallbackName'] || changes['type']) {
      this.resolve();
    }
  }

  private isRawId(val: string): boolean {
    if (!val) return false;
    const s = String(val).trim();
    const parts = s.split(',').map(p => p.trim());
    return parts.every(p => /^[a-zA-Z0-9_-]{15,}$/.test(p));
  }

  private resolve() {
    const rawFallback = this.fallbackName && this.fallbackName !== '-' && this.fallbackName !== 'Unknown' && this.fallbackName !== 'N/A' ? String(this.fallbackName).trim() : null;
    const validFallback = rawFallback && !this.isRawId(rawFallback) ? rawFallback : null;

    if (validFallback) {
      this.name$ = of(validFallback);
    } else {
      this.name$ = this.nameResolver.resolveName(this.id, this.type).pipe(
        map(res => {
          if (!res || res === 'Unknown' || res === 'N/A' || this.isRawId(res)) {
            if (validFallback) return validFallback;
            return 'N/A';
          }
          return res;
        })
      );
    }
  }

  copyId(event: MouseEvent) {
    event.stopPropagation();
    if (!this.id || this.id === '-') return;
    
    const success = this.clipboard.copy(this.id);
    if (success) {
      this.snackBar.open('ID copied', 'Close', { duration: 2000 });
    } else {
      this.snackBar.open('Failed to copy ID', 'Close', { duration: 2000 });
    }
  }
}
