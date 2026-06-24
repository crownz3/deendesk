import { Injectable } from '@angular/core';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, from, map, shareReplay, of, catchError } from 'rxjs';
import { getDeenDeskFirebaseApp } from './firebase-app';

export type ResolvableType =
  | 'organization'
  | 'madrasa'
  | 'user'
  | 'course'
  | 'class'
  | 'subject'
  | 'student'
  | 'parent'
  | 'staff'
  | 'teacher'
  | 'coordinator'
  | 'incharge';

@Injectable({ providedIn: 'root' })
export class NameResolverService {
  private readonly firestore = getFirestore(getDeenDeskFirebaseApp());
  private cache = new Map<string, Observable<string>>();

  resolveName(id: string | undefined | null, type: ResolvableType): Observable<string> {
    if (!id) {
      return of('N/A');
    }

    const cacheKey = `${type}_${id}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const collectionName = this.getCollectionName(type);
    
    // Some types like "createdBy" / "user" might map to users.
    const request$ = from(getDoc(doc(this.firestore, `${collectionName}/${id}`))).pipe(
      map(snapshot => {
        if (!snapshot.exists()) {
          return 'Unknown';
        }
        const data = snapshot.data();
        
        // Try to construct a readable name based on common fields
        let name = data['name'] || data['displayName'] || data['title'];
        
        if (!name && collectionName === 'users') {
           name = data['email'];
        }

        return name || 'Unnamed';
      }),
      catchError(() => of('Unknown')),
      shareReplay(1)
    );

    this.cache.set(cacheKey, request$);
    return request$;
  }

  private getCollectionName(type: ResolvableType): string {
    switch (type) {
      case 'organization': return 'organizations';
      case 'madrasa': return 'madrasas';
      case 'user':
      case 'staff':
      case 'teacher':
      case 'coordinator':
      case 'incharge':
        return 'users';
      case 'course': return 'courses';
      case 'class': return 'classes';
      case 'subject': return 'subjects';
      case 'student': return 'students';
      case 'parent': return 'users'; // or parents if that's a separate collection? Wait, let's check domain model. Parent is its own interface, but are they stored in 'users' or 'parents'?
      // Wait, let's just fall back to type + 's' if not specifically handled.
      default: return `${type}s`;
    }
  }
}
