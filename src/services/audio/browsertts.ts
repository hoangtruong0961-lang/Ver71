import { AppSettings } from "../../types";
import { cleanTextForSpeech } from "./elevenlabs";

export interface BrowserVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

class BrowserTtsService {
  private activeMessageId: string | null = null;
  private isSpeechPlaying = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<(playing: boolean, activeId: string | null) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Chrome/Safari sometimes bug out and keep speaking/getting stuck, resetting on init
      window.speechSynthesis.cancel();
    }
  }

  addListener(listener: (playing: boolean, activeId: string | null) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (playing: boolean, activeId: string | null) => void) {
    this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.isSpeechPlaying, this.activeMessageId));
  }

  isPlaying(messageId?: string): boolean {
    if (messageId) {
      return this.isSpeechPlaying && this.activeMessageId === messageId;
    }
    return this.isSpeechPlaying;
  }

  getActiveId(): string | null {
    return this.activeMessageId;
  }

  stop() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeechPlaying = false;
    this.activeMessageId = null;
    this.currentUtterance = null;
    this.notify();
  }

  getVoices(): BrowserVoice[] {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return [];
    }
    // Convert SpeechSynthesisVoice to simple interface to avoid serialization issues
    return window.speechSynthesis.getVoices().map(v => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      default: v.default
    }));
  }

  async speak(text: string, messageId: string, settings: AppSettings, isRetry = false): Promise<void> {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      throw new Error("Trình duyệt của bạn không hỗ trợ công nghệ đọc văn bản (Web Speech API).");
    }

    // If we're already playing the exact message, clicking is a toggle to STOP
    if (!isRetry && this.isSpeechPlaying && this.activeMessageId === messageId) {
      this.stop();
      return;
    }

    // Check if browser was actively speaking before we cancel
    const wasSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;

    // Stop current playback of any speech only if necessary, to avoid immediate cancellation bug on idle states
    if (wasSpeaking) {
      this.stop();
    } else {
      // Clear JS states internally without triggering window.speechSynthesis.cancel() if already idle
      this.isSpeechPlaying = false;
      this.activeMessageId = null;
      this.currentUtterance = null;
    }

    const textToSpeak = cleanTextForSpeech(text);
    if (!textToSpeak) {
      throw new Error("Không tìm thấy văn bản để đọc.");
    }

    try {
      this.activeMessageId = messageId;
      this.isSpeechPlaying = true;
      this.notify();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      this.currentUtterance = utterance;

      // Vol: settings.soundVolume (0-100) -> scale to (0-1)
      const appVolume = typeof settings.soundVolume === "number" ? settings.soundVolume / 100 : 0.8;
      utterance.volume = appVolume;

      // Custom browser TTS rate / pitch settings
      utterance.rate = typeof settings.browserTtsRate === "number" ? settings.browserTtsRate : 1.0;
      utterance.pitch = typeof settings.browserTtsPitch === "number" ? settings.browserTtsPitch : 1.0;

      // Ensure default fallback language is Vietnamese for correct voice processing
      utterance.lang = "vi-VN";

      // Select specific voice if configured
      if (settings?.browserTtsVoice) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === settings.browserTtsVoice || v.name === settings.browserTtsVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        }
      } else {
        // Default: Prefer a Vietnamese voice if the text appears to be Vietnamese or matching settings language preference
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(v => v.lang.startsWith("vi"));
        if (viVoice) {
          utterance.voice = viVoice;
          utterance.lang = viVoice.lang;
        }
      }

      // Prevent browser Garbage Collection bug in Chrome/Safari by keeping a window reference
      if (typeof window !== "undefined") {
        if (!(window as any)._activeUtterances) {
          (window as any)._activeUtterances = [];
        }
        (window as any)._activeUtterances.push(utterance);
      }

      const cleanupUtterance = () => {
        if (typeof window !== "undefined" && (window as any)._activeUtterances) {
          const idx = (window as any)._activeUtterances.indexOf(utterance);
          if (idx !== -1) {
            (window as any)._activeUtterances.splice(idx, 1);
          }
        }
      };

      utterance.onstart = () => {
        this.isSpeechPlaying = true;
        this.notify();
      };

      utterance.onend = () => {
        cleanupUtterance();
        // Ensure we are indeed stopping current message (and haven't started a new one)
        if (this.activeMessageId === messageId) {
          this.stop();
        }
      };

      utterance.onerror = (e: any) => {
        cleanupUtterance();
        const errType = e.error || "unknown";
        
        // Handle Chrome/Safari synthesis-failed engine recovery
        if (errType === "synthesis-failed" && !isRetry && this.activeMessageId === messageId) {
          console.warn("BrowserTTS: Synthesis failed. Performing engine reset and retrying once...");
          window.speechSynthesis.cancel();
          setTimeout(() => {
            window.speechSynthesis.resume();
            this.speak(text, messageId, settings, true).catch(err => {
              console.error("BrowserTTS: Retry speech failed:", err);
            });
          }, 200);
          return;
        }

        console.error(`SpeechSynthesisUtterance error [type: ${errType}]:`, e);
        if (this.activeMessageId === messageId) {
          this.stop();
        }
      };

      // Workaround for Chrome/Safari speech synthesis engine conflicts:
      // If we called cancel() to stop previous speaking, we must wait a short moment (e.g. 150ms)
      // to let Chrome's engine process the cancellation before invoking the next .speak().
      // If we didn't need to cancel anything, we can call .speak() immediately to maintain synchronous user activation on iOS Safari.
      if (wasSpeaking) {
        setTimeout(() => {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        }, 150);
      } else {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      }
    } catch (e: any) {
      if (typeof window !== "undefined" && (window as any)._activeUtterances && this.currentUtterance) {
        const idx = (window as any)._activeUtterances.indexOf(this.currentUtterance);
        if (idx !== -1) {
          (window as any)._activeUtterances.splice(idx, 1);
        }
      }
      this.stop();
      console.error("Browser TTS playback failed:", e);
      throw e;
    }
  }
}

export const browserTtsService = new BrowserTtsService();
