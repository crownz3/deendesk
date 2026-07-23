import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { QuranService, ReciterMeta } from './quran.service';

export interface AudioPlaybackState {
  reciter: ReciterMeta;
  surahNumber: number;
  ayahNumber: number;
  totalAyahs: number;
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  isLoading: boolean;
  playbackSpeed: number;
  isContinuous: boolean;
  error?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class QuranAudioService implements OnDestroy {
  private audio = new Audio();
  private selectedReciter: ReciterMeta;

  private stateSubject = new BehaviorSubject<AudioPlaybackState>({
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
  });

  readonly state$: Observable<AudioPlaybackState> = this.stateSubject.asObservable();

  constructor(private quranService: QuranService) {
    this.selectedReciter = this.quranService.getReciters()[0];
    this.setupAudioListeners();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private setupAudioListeners(): void {
    this.audio.addEventListener('play', () => {
      this.updateState({ isPlaying: true, isPaused: false, isStopped: false, isLoading: false, error: null });
    });

    this.audio.addEventListener('pause', () => {
      if (!this.audio.ended && this.audio.currentTime > 0) {
        this.updateState({ isPlaying: false, isPaused: true, isLoading: false });
      }
    });

    this.audio.addEventListener('waiting', () => {
      this.updateState({ isLoading: true });
    });

    this.audio.addEventListener('canplaythrough', () => {
      this.updateState({ isLoading: false });
    });

    this.audio.addEventListener('ended', () => {
      const currentState = this.stateSubject.value;
      if (currentState.isContinuous && currentState.ayahNumber < currentState.totalAyahs) {
        // Auto play next Ayah
        this.playAyah(currentState.surahNumber, currentState.ayahNumber + 1, currentState.totalAyahs, true);
      } else {
        this.updateState({ isPlaying: false, isPaused: false, isStopped: true, isLoading: false });
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Quran audio playback error', e);
      this.updateState({
        isPlaying: false,
        isPaused: false,
        isLoading: false,
        error: 'Failed to load audio for this ayah. Please check network connection.'
      });
    });
  }

  private updateState(partial: Partial<AudioPlaybackState>): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      ...partial
    });
  }

  setReciter(reciter: ReciterMeta): void {
    this.selectedReciter = reciter;
    const current = this.stateSubject.value;
    this.updateState({ reciter });

    // If audio is currently playing or paused, restart current Ayah with new reciter
    if (!current.isStopped && current.surahNumber > 0 && current.ayahNumber > 0) {
      const wasPlaying = current.isPlaying;
      this.playAyah(current.surahNumber, current.ayahNumber, current.totalAyahs, current.isContinuous);
      if (!wasPlaying) {
        this.audio.pause();
      }
    }
  }

  getAudioUrl(surahNumber: number, ayahNumber: number, reciterFolder: string): string {
    const paddedSurah = surahNumber.toString().padStart(3, '0');
    const paddedAyah = ayahNumber.toString().padStart(3, '0');
    return `https://everyayah.com/data/${reciterFolder}/${paddedSurah}${paddedAyah}.mp3`;
  }

  playAyah(surahNumber: number, ayahNumber: number, totalAyahs: number, isContinuous: boolean = false): void {
    const reciter = this.selectedReciter;
    const url = this.getAudioUrl(surahNumber, ayahNumber, reciter.folder);

    this.audio.pause();
    this.audio.src = url;
    this.audio.playbackRate = this.stateSubject.value.playbackSpeed;

    this.updateState({
      reciter,
      surahNumber,
      ayahNumber,
      totalAyahs,
      isPlaying: false,
      isPaused: false,
      isStopped: false,
      isLoading: true,
      isContinuous,
      error: null
    });

    this.audio.play().catch(err => {
      console.error('Audio play error', err);
      this.updateState({
        isPlaying: false,
        isLoading: false,
        error: 'Playback interrupted or blocked by browser.'
      });
    });
  }

  playFromHere(surahNumber: number, startAyah: number, totalAyahs: number): void {
    this.playAyah(surahNumber, startAyah, totalAyahs, true);
  }

  pause(): void {
    this.audio.pause();
  }

  resume(): void {
    if (this.stateSubject.value.isPaused) {
      this.audio.play().catch(err => console.error('Resume playback error', err));
    }
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.updateState({
      isPlaying: false,
      isPaused: false,
      isStopped: true,
      isLoading: false
    });
  }

  nextAyah(): void {
    const st = this.stateSubject.value;
    if (st.surahNumber > 0 && st.ayahNumber < st.totalAyahs) {
      this.playAyah(st.surahNumber, st.ayahNumber + 1, st.totalAyahs, st.isContinuous);
    }
  }

  prevAyah(): void {
    const st = this.stateSubject.value;
    if (st.surahNumber > 0 && st.ayahNumber > 1) {
      this.playAyah(st.surahNumber, st.ayahNumber - 1, st.totalAyahs, st.isContinuous);
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.audio.playbackRate = speed;
    this.updateState({ playbackSpeed: speed });
  }
}
