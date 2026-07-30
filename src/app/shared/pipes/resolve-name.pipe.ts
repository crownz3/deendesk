import { Pipe, PipeTransform } from '@angular/core';
import { Observable, of } from 'rxjs';
import { NameResolverService, ResolvableType } from '../../core/services/name-resolver.service';
import { map } from 'rxjs/operators';

@Pipe({
  name: 'resolveName',
  standalone: false
})
export class ResolveNamePipe implements PipeTransform {
  constructor(private nameResolver: NameResolverService) {}

  transform(id: string | string[] | null | undefined, type: ResolvableType | null | undefined): Observable<string> {
    if (!id || (Array.isArray(id) && id.length === 0)) return of('-');
    if (!type) return of(Array.isArray(id) ? id.join(', ') : String(id));
    return this.nameResolver.resolveName(id, type).pipe(
      map(name => name && name !== 'Unknown' && name !== 'Unnamed' && name !== 'N/A' ? name : (Array.isArray(id) ? id.join(', ') : String(id)))
    );
  }
}
