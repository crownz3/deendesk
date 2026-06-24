import { Component, Input, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Observable, of } from 'rxjs';
import { NameResolverService, ResolvableType } from '../../../core/services/name-resolver.service';

@Component({
  selector: 'app-name-with-copy',
  templateUrl: './name-with-copy.component.html',
  styleUrls: ['./name-with-copy.component.scss'],
  standalone: false,
})
export class NameWithCopyComponent implements OnInit {
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
    if (this.fallbackName) {
      this.name$ = of(this.fallbackName);
    } else {
      this.name$ = this.nameResolver.resolveName(this.id, this.type);
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
