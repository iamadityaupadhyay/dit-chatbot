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
    const delay = Math.pow(2, attempt - 1) * 1000;
    try {
      if (this.audioContext.state === 'suspended') {
        
        await this.audioContext.resume();
      }

      const processedText = this.config.useSSML ? text : text.replace(/<[^>]*>/g, '');
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
          model: "gen2",
          modelVersion: "latest"  
        })
      });

      if (response.data.error) {
        throw new Error(`Murf API Error: ${response.data.error.message || response.data.error}`);
      }

      if (!response.data || !response.data.audioFile) {
        throw new Error(`Murf API failed: No audio file in response`);
      }
      const audioResponse = await fetch(response.data.audioFile);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status} - ${audioResponse.statusText}`);
      }

      
      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      this.audioQueue.push(source);
      

      if (!this.isSpeaking) {
        this.processAudioQueue();
      }
    } catch (err: any) {
      console.error(`🎵 TTS Error (Attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.speak(text, attempt + 1);
      } else {
        console.warn("🎵 Murf failed after retries; falling back to browser TTS");
        this.fallbackToBrowserTTS(text);
      }
    }
  }

  private async processAudioQueue(): Promise<void> {
    
    
    if (this.audioQueue.length === 0) {
      this.isSpeaking = false;
      this.currentAudioSource = null;
      
      return;
    }

    this.isSpeaking = true;
    const source = this.audioQueue.shift()!;

    if (this.currentAudioSource && this.currentAudioSource !== source) {
      try {
        
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        console.warn('Error stopping previous audio:', e);
      }
    }

    this.currentAudioSource = source;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        
        this.currentAudioSource = null;
        resolve();
      };
      
      
      source.start();
    });

    await this.processAudioQueue();
  }

  private fallbackToBrowserTTS(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => 
      utterance.onend = () => 
      utterance.onerror = (e) => console.error("❌ Browser TTS error:", e);
      
      speechSynthesis.speak(utterance);
    } else {
      console.warn("⚠️ Browser speech synthesis not available");
    }
  }

  stopCurrentAudio(): void {
    
    
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
    
    this.audioQueue = [];
  }
}
