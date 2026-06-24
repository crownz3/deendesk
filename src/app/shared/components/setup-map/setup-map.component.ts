import { Component, Input, OnInit } from '@angular/core';
import { SetupMapStep } from '../../../core/services/setup-map.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-setup-map',
  templateUrl: './setup-map.component.html',
  styleUrls: ['./setup-map.component.scss'],
  standalone: false
})
export class SetupMapComponent implements OnInit {
  @Input() steps: SetupMapStep[] = [];

  isVisible = true;
  private readonly storageKey = 'deendesk_dashboard_setup_map_visible';

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    const storedState = localStorage.getItem(this.storageKey);
    if (storedState !== null) {
      this.isVisible = storedState === 'true';
    }
  }

  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    localStorage.setItem(this.storageKey, String(this.isVisible));
  }

  get completedCount(): number {
    return this.steps.filter(s => s.completed).length;
  }

  get totalCount(): number {
    return this.steps.length;
  }

  get isAllCompleted(): boolean {
    return this.totalCount > 0 && this.completedCount === this.totalCount;
  }

  get firstIncompleteIndex(): number {
    return this.steps.findIndex(s => !s.completed);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
