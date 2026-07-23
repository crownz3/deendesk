import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { quranIndex } from '../data/quran-surahs';
import { Reciters } from '../data/quran-reciters';

export interface SurahMeta {
  surahNumber: number;
  chapter: string;
  revelationPlace: string;
  verses: number;
}

export interface ReciterMeta {
  id: string;
  name: string;
  image: string;
  sampleAyah: string;
  folder: string;
}

export interface WordItem {
  wordKey: string; // e.g. "1:1:1"
  wordIndex: number;
  arabic: string;
  translation: string;
}

export interface AyahFull {
  verseKey: string; // e.g. "1:1"
  surahNumber: number;
  ayahNumber: number;
  arabicText: string;
  translationText: string;
  words: WordItem[];
  isBookmarked?: boolean;
}

export interface QuranBookmark {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  textPreview: string;
  translationPreview: string;
  savedAt: number;
}

export interface LastReadPosition {
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuranService {
  private readonly BOOKMARKS_KEY = 'deendesk_quran_bookmarks';
  private readonly LAST_READ_KEY = 'deendesk_quran_last_read';

  private arabicDataCache$: Observable<Record<string, { id: number; verse_key: string; surah: number; ayah: number; text: string }>> | null = null;
  private ayahTranslationCache$: Observable<Record<string, { t: string }>> | null = null;
  private wbwTranslationCache$: Observable<Record<string, { arabic: string; translation: string }>> | null = null;

  private bookmarksSubject = new BehaviorSubject<QuranBookmark[]>(this.loadBookmarksFromStorage());
  readonly bookmarks$ = this.bookmarksSubject.asObservable();

  private lastReadSubject = new BehaviorSubject<LastReadPosition | null>(this.loadLastReadFromStorage());
  readonly lastRead$ = this.lastReadSubject.asObservable();

  constructor(private http: HttpClient) {}

  getSurahList(): SurahMeta[] {
    return quranIndex || [];
  }

  getSurahByNumber(surahNumber: number): SurahMeta | undefined {
    return this.getSurahList().find(s => s.surahNumber === surahNumber);
  }

  getReciters(): ReciterMeta[] {
    return Reciters || [];
  }

  getReciterById(id: string): ReciterMeta {
    const list = this.getReciters();
    return list.find(r => r.id === id) || list[0];
  }

  private loadArabicData(): Observable<Record<string, { id: number; verse_key: string; surah: number; ayah: number; text: string }>> {
    if (!this.arabicDataCache$) {
      this.arabicDataCache$ = this.http.get<Record<string, { id: number; verse_key: string; surah: number; ayah: number; text: string }>>(
        'assets/quran-data/arabic-script-ayah-by-ayah.json'
      ).pipe(
        shareReplay(1),
        catchError(err => {
          console.error('Failed to load Quran Arabic script JSON', err);
          return of({});
        })
      );
    }
    return this.arabicDataCache$;
  }

  private loadAyahTranslations(): Observable<Record<string, { t: string }>> {
    if (!this.ayahTranslationCache$) {
      this.ayahTranslationCache$ = this.http.get<Record<string, { t: string }>>(
        'assets/quran-data/omar-sharif-tamil-ayah-translation.json'
      ).pipe(
        shareReplay(1),
        catchError(err => {
          console.error('Failed to load Quran Ayah Translation JSON', err);
          return of({});
        })
      );
    }
    return this.ayahTranslationCache$;
  }

  private loadWbwTranslations(): Observable<Record<string, { arabic: string; translation: string }>> {
    if (!this.wbwTranslationCache$) {
      this.wbwTranslationCache$ = this.http.get<Record<string, { arabic: string; translation: string }>>(
        'assets/quran-data/omar-sharif-tamil-wbw-translation.json'
      ).pipe(
        shareReplay(1),
        catchError(err => {
          console.error('Failed to load Quran Word-by-Word Translation JSON', err);
          return of({});
        })
      );
    }
    return this.wbwTranslationCache$;
  }

  /**
   * Loads full Ayah data for a specific Surah
   */
  getSurahAyahs(surahNumber: number): Observable<AyahFull[]> {
    const surahMeta = this.getSurahByNumber(surahNumber);
    if (!surahMeta) return of([]);

    return combineLatest([
      this.loadArabicData(),
      this.loadAyahTranslations(),
      this.loadWbwTranslations(),
      this.bookmarks$
    ]).pipe(
      map(([arabicDict, transDict, wbwDict, bookmarks]) => {
        const bookmarkedKeys = new Set(bookmarks.map(b => b.verseKey));
        const ayahs: AyahFull[] = [];

        for (let a = 1; a <= surahMeta.verses; a++) {
          const verseKey = `${surahNumber}:${a}`;
          const arabicObj = arabicDict[verseKey];
          const transObj = transDict[verseKey];

          // Collect word-by-word items for this verse
          const words: WordItem[] = [];
          let w = 1;
          while (wbwDict[`${surahNumber}:${a}:${w}`]) {
            const wKey = `${surahNumber}:${a}:${w}`;
            const item = wbwDict[wKey];
            words.push({
              wordKey: wKey,
              wordIndex: w,
              arabic: item.arabic,
              translation: item.translation
            });
            w++;
          }

          ayahs.push({
            verseKey,
            surahNumber,
            ayahNumber: a,
            arabicText: arabicObj ? arabicObj.text : '',
            translationText: transObj ? transObj.t : '',
            words,
            isBookmarked: bookmarkedKeys.has(verseKey)
          });
        }

        return ayahs;
      })
    );
  }

  // --- Bookmarks Logic ---

  private loadBookmarksFromStorage(): QuranBookmark[] {
    try {
      const raw = localStorage.getItem(this.BOOKMARKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveBookmarksToStorage(bookmarks: QuranBookmark[]): void {
    try {
      localStorage.setItem(this.BOOKMARKS_KEY, JSON.stringify(bookmarks));
      this.bookmarksSubject.next(bookmarks);
    } catch (e) {
      console.error('Failed to save bookmarks to localStorage', e);
    }
  }

  toggleBookmark(ayah: AyahFull, surahName: string): boolean {
    const current = [...this.bookmarksSubject.value];
    const idx = current.findIndex(b => b.verseKey === ayah.verseKey);
    let added = false;

    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.unshift({
        verseKey: ayah.verseKey,
        surahNumber: ayah.surahNumber,
        ayahNumber: ayah.ayahNumber,
        surahName,
        textPreview: ayah.arabicText,
        translationPreview: ayah.translationText,
        savedAt: Date.now()
      });
      added = true;
    }

    this.saveBookmarksToStorage(current);
    return added;
  }

  isBookmarked(verseKey: string): boolean {
    return this.bookmarksSubject.value.some(b => b.verseKey === verseKey);
  }

  // --- Last Read Position Logic ---

  private loadLastReadFromStorage(): LastReadPosition | null {
    try {
      const raw = localStorage.getItem(this.LAST_READ_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveLastRead(surahNumber: number, ayahNumber: number, surahName: string): void {
    const pos: LastReadPosition = {
      surahNumber,
      ayahNumber,
      surahName,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(this.LAST_READ_KEY, JSON.stringify(pos));
      this.lastReadSubject.next(pos);
    } catch (e) {
      console.error('Failed to save last read position', e);
    }
  }
}
