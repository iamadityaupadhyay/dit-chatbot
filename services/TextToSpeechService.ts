import axios from 'axios';
import { TextToSpeechConfig, AudioNodes } from '../types/interfaces';

export class TextToSpeechService {
  private config: TextToSpeechConfig;
  private audioContext: AudioContext;
  private audioNodes: AudioNodes;
  private audioQueue: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private currentAudioSource: AudioBufferSourceNode | null = null;

  constructor(audioContext: AudioContext, audioNodes: AudioNodes) {
    this.audioContext = audioContext;
    this.audioNodes = audioNodes;
    this.config = {
      apiKey: "ap2_10a62c3e-ef81-4e04-996e-191e4fdab276",
      voiceId: "en-US-natalie",
      retryAttempts: 3,
      bufferFlushTimeout: 500,
      maxBufferLength: 500
    };
  }

  async speak(text: string, attempt: number = 1): Promise<void> {
    console.log(`🎵 TTS Service: Starting to speak "${text}" (attempt ${attempt})`);
    
    // Try browser TTS as fallback for debugging
    if (attempt === 1) {
      this.speakWithBrowserTTS(text);
    }
    
    try {
      console.log(`🎵 Audio context state: ${this.audioContext.state}`);
      if (this.audioContext.state === 'suspended') {
        console.log("🎵 Resuming audio context...");
        await this.audioContext.resume();
        console.log(`🎵 Audio context resumed, new state: ${this.audioContext.state}`);
      }

      console.log("🎵 Making API call to Murf...");
      const response = await axios({
        method: 'post',
        url: 'https://api.murf.ai/v1/speech/generate',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
          "multiNativeLocale": "hi-IN"
        },
        data: JSON.stringify({
          text: text,
          voiceId: this.config.voiceId
        })
      });

      console.log("🎵 API Response received:", response.status);
      
      if (!response.data || !response.data.audioFile) {
        console.error("🎵 API Response missing audio file:", response.data);
        throw new Error('Murf API failed: No audio file in response');
      }

      console.log("🎵 Fetching audio file:", response.data.audioFile);
      const audioResponse = await fetch(response.data.audioFile);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
      }

      console.log("🎵 Decoding audio data...");
      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      console.log("🎵 Creating audio source and connecting...");
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioNodes.output);

      console.log("🎵 Adding to audio queue...");
      if (!this.audioQueue.some(s => s.buffer === source.buffer)) {
        this.audioQueue.push(source);
      }

      console.log(`🎵 Audio queue length: ${this.audioQueue.length}, isSpeaking: ${this.isSpeaking}`);
      if (!this.isSpeaking) {
        console.log("🎵 Starting audio queue processing...");
        this.processAudioQueue();
      }
    } catch (err) {
      console.error(`TTS Error (Attempt ${attempt}):`, err);
      if (attempt < this.config.retryAttempts) {
        console.log(`Retrying... (${attempt + 1}/${this.config.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.speak(text, attempt + 1);
      } else {
        throw new Error("Failed to generate speech after retries");
      }
    }
  }

  private async processAudioQueue(): Promise<void> {
    console.log(`🔊 Processing audio queue, length: ${this.audioQueue.length}`);
    
    if (this.audioQueue.length === 0) {
      console.log("🔊 Audio queue empty, stopping");
      this.isSpeaking = false;
      this.currentAudioSource = null;
      return;
    }

    this.isSpeaking = true;
    const source = this.audioQueue.shift()!;
    console.log("🔊 Playing next audio source");

    if (this.currentAudioSource && this.currentAudioSource !== source) {
      try {
        console.log("🔊 Stopping previous audio source");
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        console.warn('Error stopping previous audio:', e);
      }
    }

    this.currentAudioSource = source;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        console.log("🔊 Audio playback ended");
        this.currentAudioSource = null;
        resolve();
      };
      
      console.log("🔊 Starting audio playback");
      source.start();
    });

    await this.processAudioQueue();
  }

  stop(): void {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        console.warn('Error stopping current audio:', e);
      }
      this.currentAudioSource = null;
    }
    this.audioQueue = [];
    this.isSpeaking = false;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  private speakWithBrowserTTS(text: string): void {
    console.log("🎵 Using browser TTS as fallback:", text);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => console.log("🔊 Browser TTS started");
      utterance.onend = () => console.log("🔊 Browser TTS ended");
      utterance.onerror = (e) => console.error("❌ Browser TTS error:", e);
      
      speechSynthesis.speak(utterance);
    } else {
      console.warn("⚠️ Browser speech synthesis not available");
    }
  }
}
