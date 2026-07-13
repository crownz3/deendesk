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

  transform(id: string | null | undefined, type: ResolvableType | null | undefined): Observable<string> {
    if (!id) return of('-');
    if (!type) return of(String(id));
    return this.nameResolver.resolveName(id, type).pipe(
      map(name => name && name !== 'Unknown' && name !== 'Unnamed' ? name : String(id))
    );
  }
}
