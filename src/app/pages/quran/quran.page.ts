import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AyahFull, LastReadPosition, QuranBookmark, QuranService, ReciterMeta, SurahMeta } from '../../core/services/quran.service';
import { AudioPlaybackState, QuranAudioService } from '../../core/services/quran-audio.service';
import { ReciterSelectDialogComponent } from './reciter-select-dialog.component';

export type ReaderViewMode = 'full' | 'standard' | 'wbw' | 'arabic';

@Component({
  selector: 'app-quran',
  templateUrl: './quran.page.html',
  styleUrls: ['./quran.page.scss'],
  standalone: false
})
export class QuranPage implements OnInit, OnDestroy {
  @ViewChild('ayahContainer') ayahContainer?: ElementRef;

  activeTab: 'index' | 'reader' | 'bookmarks' = 'index';

  // Surah Index state
  surahList: SurahMeta[] = [];
  filteredSurahs: SurahMeta[] = [];
  searchQuery = '';
  filterType: 'all' | 'makki' | 'madani' = 'all';

  // Reader state
  selectedSurah: SurahMeta | null = null;
  ayahs: AyahFull[] = [];
  isLoadingAyahs = false;
  viewMode: ReaderViewMode = 'full';
  showWbw = true;
  showTranslation = true;
  arabicFontSize = 28;
  transFontSize = 16;

  // Bookmarks & Last Read
  bookmarks: QuranBookmark[] = [];
  lastRead: LastReadPosition | null = null;

  // Audio State
  audioState: AudioPlaybackState = {
    reciter: this.quranService.getReciters()[0],
    surahNumber: 0,
    ayahNumber: 0,
    totalAyahs: 0,
    isPlaying: false,
    isPaused: false,
    isStopped: true,
    isLoading: false,
    playbackSpeed: 1,
    isContinuous: true,
    error: null
  };

  private destroy$ = new Subject<void>();
  private audioSub?: Subscription;

  constructor(
    public quranService: QuranService,
    private quranAudioService: QuranAudioService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private clipboard: Clipboard
  ) {}

  ngOnInit(): void {
    this.surahList = this.quranService.getSurahList();
    this.filteredSurahs = [...this.surahList];

    // Subscribe to bookmarks
    this.quranService.bookmarks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(b => this.bookmarks = b);

    // Subscribe to last read
    this.quranService.lastRead$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lr => this.lastRead = lr);

    // Subscribe to audio state
    this.audioSub = this.quranAudioService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const prevAyah = this.audioState.ayahNumber;
        this.audioState = state;

        // Auto-scroll to active ayah if changed during reader mode
        if (
          this.activeTab === 'reader' &&
          this.selectedSurah?.surahNumber === state.surahNumber &&
          state.ayahNumber > 0 &&
          state.ayahNumber !== prevAyah &&
          (state.isPlaying || state.isLoading)
        ) {
          this.scrollToAyah(state.ayahNumber);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Index Tab Logic ---

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applySurahFilters();
  }

  setFilterType(type: 'all' | 'makki' | 'madani'): void {
    this.filterType = type;
    this.applySurahFilters();
  }

  private applySurahFilters(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredSurahs = this.surahList.filter(s => {
      const matchesType = this.filterType === 'all' || s.revelationPlace.toLowerCase() === this.filterType;
      const matchesQuery = !q || 
        s.chapter.toLowerCase().includes(q) ||
        s.surahNumber.toString() === q ||
        `surah ${s.surahNumber}`.includes(q);
      return matchesType && matchesQuery;
    });
  }

  openSurah(surahNumber: number, targetAyah: number = 1): void {
    const surah = this.quranService.getSurahByNumber(surahNumber);
    if (!surah) return;

    this.selectedSurah = surah;
    this.activeTab = 'reader';
    this.isLoadingAyahs = true;

    this.quranService.getSurahAyahs(surahNumber)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ayahs) => {
          this.ayahs = ayahs;
          this.isLoadingAyahs = false;
          this.quranService.saveLastRead(surahNumber, targetAyah, surah.chapter);

          if (targetAyah > 1) {
            setTimeout(() => this.scrollToAyah(targetAyah), 300);
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
        error: (err) => {
          console.error('Failed to load ayahs', err);
          this.isLoadingAyahs = false;
          this.snackBar.open('Failed to load Surah data. Please try again.', 'Close', { duration: 3000 });
        }
      });
  }

  // --- Reader Tab Logic ---

  selectSurahFromDropdown(surahNumber: number): void {
    this.openSurah(surahNumber, 1);
  }

  setViewMode(mode: ReaderViewMode): void {
    this.viewMode = mode;
    if (mode === 'wbw') {
      this.showWbw = true;
      this.showTranslation = true;
    } else if (mode === 'standard') {
      this.showWbw = false;
      this.showTranslation = true;
    } else if (mode === 'arabic') {
      this.showWbw = false;
      this.showTranslation = false;
    } else {
      this.showWbw = true;
      this.showTranslation = true;
    }
  }

  adjustFontSize(target: 'arabic' | 'trans', delta: number): void {
    if (target === 'arabic') {
      this.arabicFontSize = Math.min(48, Math.max(18, this.arabicFontSize + delta));
    } else {
      this.transFontSize = Math.min(28, Math.max(12, this.transFontSize + delta));
    }
  }

  jumpToAyah(ayahNumber: number): void {
    if (this.selectedSurah) {
      this.quranService.saveLastRead(this.selectedSurah.surahNumber, ayahNumber, this.selectedSurah.chapter);
    }
    this.scrollToAyah(ayahNumber);
  }

  scrollToAyah(ayahNumber: number): void {
    const el = document.getElementById(`ayah-${ayahNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // --- Audio Control Logic ---

  playAyah(ayah: AyahFull): void {
    if (!this.selectedSurah) return;
    this.quranAudioService.playAyah(
      this.selectedSurah.surahNumber,
      ayah.ayahNumber,
      this.selectedSurah.verses,
      false
    );
    this.quranService.saveLastRead(this.selectedSurah.surahNumber, ayah.ayahNumber, this.selectedSurah.chapter);
  }

  playFromHere(ayah: AyahFull): void {
    if (!this.selectedSurah) return;
    this.quranAudioService.playFromHere(
      this.selectedSurah.surahNumber,
      ayah.ayahNumber,
      this.selectedSurah.verses
    );
    this.quranService.saveLastRead(this.selectedSurah.surahNumber, ayah.ayahNumber, this.selectedSurah.chapter);
  }

  pauseAudio(): void {
    this.quranAudioService.pause();
  }

  resumeAudio(): void {
    this.quranAudioService.resume();
  }

  stopAudio(): void {
    this.quranAudioService.stop();
  }

  nextAyah(): void {
    this.quranAudioService.nextAyah();
  }

  prevAyah(): void {
    this.quranAudioService.prevAyah();
  }

  setSpeed(speed: number): void {
    this.quranAudioService.setPlaybackSpeed(speed);
  }

  openReciterSelector(): void {
    this.dialog.open(ReciterSelectDialogComponent, {
      width: '680px',
      maxWidth: '92vw',
      panelClass: 'reciter-dialog-panel',
      data: { currentReciterId: this.audioState.reciter.id }
    });
  }

  // --- Ayah Actions: Bookmark, Copy, Share ---

  toggleBookmark(ayah: AyahFull): void {
    if (!this.selectedSurah) return;
    const added = this.quranService.toggleBookmark(ayah, this.selectedSurah.chapter);
    const msg = added ? 'Bookmark added' : 'Bookmark removed';
    this.snackBar.open(msg, 'OK', { duration: 2000 });
  }

  removeBookmark(b: QuranBookmark): void {
    this.quranService.toggleBookmark({
      verseKey: b.verseKey,
      surahNumber: b.surahNumber,
      ayahNumber: b.ayahNumber,
      arabicText: b.textPreview,
      translationText: b.translationPreview,
      words: []
    }, b.surahName);
    this.snackBar.open('Bookmark removed', 'OK', { duration: 2000 });
  }

  copyAyah(ayah: AyahFull): void {
    const surahName = this.selectedSurah?.chapter || '';
    const textToCopy = `[Surah ${this.capitalize(surahName)} ${ayah.verseKey}]\n${ayah.arabicText}\n\nTranslation: ${ayah.translationText}`;
    this.clipboard.copy(textToCopy);
    this.snackBar.open('Ayah copied to clipboard!', 'OK', { duration: 2000 });
  }

  shareAyah(ayah: AyahFull): void {
    const surahName = this.selectedSurah?.chapter || '';
    const shareData = {
      title: `Surah ${this.capitalize(surahName)} (${ayah.verseKey})`,
      text: `${ayah.arabicText}\n\n${ayah.translationText}\n[Quran ${ayah.verseKey}]`
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      this.copyAyah(ayah);
    }
  }

  // --- Helper Methods ---

  capitalize(str: string): string {
    if (!str) return '';
    return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }

  isCurrentAyahPlaying(ayahNumber: number): boolean {
    return (
      this.activeTab === 'reader' &&
      this.selectedSurah?.surahNumber === this.audioState.surahNumber &&
      this.audioState.ayahNumber === ayahNumber &&
      (this.audioState.isPlaying || this.audioState.isLoading)
    );
  }

  getSurahAyahArray(versesCount: number): number[] {
    return Array.from({ length: versesCount }, (_, i) => i + 1);
  }
}
