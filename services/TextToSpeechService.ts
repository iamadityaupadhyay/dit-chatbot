import axios from 'axios';

export interface TTSConfig {
  apiKey: string;
  voiceId: string;
  retryAttempts: number;
  useSSML: boolean;
}

export class TextToSpeechService {
  private config: TTSConfig;
  private audioContext: AudioContext;
  private outputNode: GainNode;
  private audioQueue: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private currentAudioSource: AudioBufferSourceNode | null = null;

  constructor(audioContext: AudioContext, outputNode: GainNode, config?: Partial<TTSConfig>) {
    this.audioContext = audioContext;
    this.outputNode = outputNode;
    this.config = {
      apiKey: "ap2_10a62c3e-ef81-4e04-996e-191e4fdab276",
      voiceId: "en-US-natalie",
      retryAttempts: 3,
      useSSML: false,
      ...config
    };
  }

  async speak(text: string, attempt: number = 1): Promise<void> {
    const maxRetries = this.config.retryAttempts;
    const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s

    console.log(`🎵 TTS: Speaking "${text}" (attempt ${attempt}/${maxRetries})`);

    try {
      if (this.audioContext.state === 'suspended') {
        console.log('🎵 Resuming audio context...');
        await this.audioContext.resume();
      }

      const processedText = this.config.useSSML ? text : text.replace(/<[^>]*>/g, '');
      console.log(`🎵 Making Murf API call...`);

      const response = await axios({
        method: 'post',
        url: 'https://api.murf.ai/v1/speech/generate',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
          "multiNativeLocale": "hi-IN"
        },
        data: JSON.stringify({
          text: processedText,
          voiceId: this.config.voiceId,
          model: "GEN2"
        })
      });

      console.log("🎵 Murf API Response:", response.status);

      if (response.data.error) {
        throw new Error(`Murf API Error: ${response.data.error.message || response.data.error}`);
      }

      if (!response.data || !response.data.audioFile) {
        throw new Error(`Murf API failed: No audio file in response`);
      }

      console.log('🎵 Fetching audio file...');
      const audioResponse = await fetch(response.data.audioFile);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status} - ${audioResponse.statusText}`);
      }

      console.log('🎵 Decoding audio data...');
      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      this.audioQueue.push(source);
      console.log(`🎵 Added to queue. Queue length: ${this.audioQueue.length}`);

      if (!this.isSpeaking) {
        this.processAudioQueue();
      }
    } catch (err: any) {
      console.error(`🎵 TTS Error (Attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        console.log(`🎵 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.speak(text, attempt + 1);
      } else {
        console.warn("🎵 Murf failed after retries; falling back to browser TTS");
        this.fallbackToBrowserTTS(text);
      }
    }
  }

  private async processAudioQueue(): Promise<void> {
    console.log(`🔊 Processing audio queue, length: ${this.audioQueue.length}`);
    
    if (this.audioQueue.length === 0) {
      this.isSpeaking = false;
      this.currentAudioSource = null;
      console.log('🔊 Audio queue empty, stopping');
      return;
    }

    this.isSpeaking = true;
    const source = this.audioQueue.shift()!;

    if (this.currentAudioSource && this.currentAudioSource !== source) {
      try {
        console.log('🔊 Stopping previous audio source');
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        console.warn('Error stopping previous audio:', e);
      }
    }

    this.currentAudioSource = source;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        console.log('🔊 Audio playback ended');
        this.currentAudioSource = null;
        resolve();
      };
      
      console.log('🔊 Starting audio playback');
      source.start();
    });

    await this.processAudioQueue();
  }

  private fallbackToBrowserTTS(text: string): void {
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

  stopCurrentAudio(): void {
    console.log('🔊 Stopping all audio');
    
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

  clearQueue(): void {
    console.log('🔊 Clearing audio queue');
    this.audioQueue = [];
  }
}
