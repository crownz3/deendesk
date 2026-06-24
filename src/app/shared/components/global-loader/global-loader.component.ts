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

  constructor(private loader: LoaderService) {}
}
