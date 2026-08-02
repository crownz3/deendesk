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

  private resolve() {
    const validFallback = this.fallbackName && this.fallbackName !== '-' && this.fallbackName !== 'Unknown' && this.fallbackName !== 'N/A' ? String(this.fallbackName).trim() : null;
    if (validFallback) {
      this.name$ = of(validFallback);
    } else {
      this.name$ = this.nameResolver.resolveName(this.id, this.type).pipe(
        map(res => {
          if (!res || res === 'Unknown' || res === 'N/A') {
            if (validFallback) return validFallback;
            if (this.id && typeof this.id === 'string' && this.id.length < 15 && this.id !== '-') return this.id;
            return '-';
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
