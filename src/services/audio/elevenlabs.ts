import { AppSettings } from "../../types";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
}

export function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  
  // 1. Strip thinking blocks
  let cleanText = text;
  cleanText = cleanText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleanText = cleanText.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  cleanText = cleanText.replace(/<thinhking>[\s\S]*?<\/thinhking>/gi, "");
  
  // 2. Stripping specific XML-style indicators
  cleanText = cleanText.replace(/<[^>]*>/g, "");
  
  // 3. Strip markdown syntax
  cleanText = cleanText.replace(/```[\s\S]*?```/g, "");
  cleanText = cleanText.replace(/`[^`]*`/g, "");
  cleanText = cleanText.replace(/[*_#~]/g, "");
  
  // 4. Strip bracketted system notes like [Hệ thống: ...]
  cleanText = cleanText.replace(/\[[^\]]*\]/g, "");
  
  // 5. Normalize whitespaces
  cleanText = cleanText.replace(/\s+/g, " ").trim();
  
  return cleanText;
}

class ElevenLabsService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private activeMessageId: string | null = null;
  private isSpeechPlaying = false;
  private listeners: Set<(playing: boolean, activeId: string | null) => void> = new Set();

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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    this.isSpeechPlaying = false;
    this.activeMessageId = null;
    this.notify();
  }

  async getVoices(customApiKey?: string): Promise<ElevenLabsVoice[]> {
    try {
      const headers: Record<string, string> = {};
      if (customApiKey) {
        headers["xi-api-key"] = customApiKey;
      }
      
      const queryParams = customApiKey ? `?apiKey=${encodeURIComponent(customApiKey)}` : "";
      const response = await fetch(`/api/audio/elevenlabs/voices${queryParams}`, {
        headers,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (e: any) {
      console.error("Failed to fetch voices:", e);
      throw e;
    }
  }

  async speak(text: string, messageId: string, settings: AppSettings): Promise<void> {
    // If we're already playing the exact message, clicking is a toggle to STOP
    if (this.isSpeechPlaying && this.activeMessageId === messageId) {
      this.stop();
      return;
    }

    // Stop current playback
    this.stop();

    const textToSpeak = cleanTextForSpeech(text);
    if (!textToSpeak) {
      throw new Error("Không tìm thấy văn bản thoại để đọc (Văn bản chứa toàn thẻ suy nghĩ hoặc hệ thống).");
    }

    try {
      this.activeMessageId = messageId;
      this.isSpeechPlaying = true;
      this.notify();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      const apiKey = settings.elevenLabsApiKey || "";
      if (apiKey) {
        headers["xi-api-key"] = apiKey;
      }

      const response = await fetch("/api/audio/elevenlabs/tts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: textToSpeak,
          voiceId: settings.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM", // Rachel default
          modelId: settings.elevenLabsModelId || "eleven_turbo_v2_5",
          stability: settings.elevenLabsStability ?? 0.5,
          similarityBoost: settings.elevenLabsSimilarityBoost ?? 0.75,
          apiKey: apiKey,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `Lỗi từ server: ${response.status}`);
      }

      const audioBlob = await response.blob();
      this.currentAudioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(this.currentAudioUrl);
      this.currentAudio = audio;
      
      // Handle audio volume according to application settings (scaled 0-100 to 0-1)
      const appVolume = typeof settings.soundVolume === "number" ? settings.soundVolume / 100 : 0.8;
      audio.volume = appVolume;

      audio.onplay = () => {
        this.isSpeechPlaying = true;
        this.notify();
      };

      audio.onended = () => {
        this.stop();
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        this.stop();
      };

      await audio.play();
    } catch (e: any) {
      this.stop();
      console.error("TTS generation/playback failed:", e);
      throw e;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
