import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LiveServerMessage } from '@google/genai';

// Import services
import { SessionManager } from '../services/SessionManager';
import { AudioManager } from '../services/AudioManager';
import { TextToSpeechService } from '../services/TextToSpeechService';
import { MessageHandler } from '../services/MessageHandler';
import { TextBufferManager } from '../services/TextBufferManager';

// Import components
import './ChatbotControls';
import './ChatbotStatus';
import '../visual-3d';

// Import test (for debugging TTS)
import '../services/SimpleTTSTest';
import './ChatbotControls';
import './ChatbotStatus';
import '../visual-3d';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';

  // Service instances
  private sessionManager: SessionManager;
  private audioManager: AudioManager;
  private ttsService: TextToSpeechService;
  private messageHandler: MessageHandler;
  private textBufferManager: TextBufferManager;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      position: relative;
    }
  `;

  constructor() {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize services
    this.sessionManager = new SessionManager();
    this.audioManager = new AudioManager();
    this.messageHandler = new MessageHandler();

    // Initialize TTS with audio context and nodes
    const audioContexts = this.audioManager.getAudioContexts();
    const audioNodes = this.audioManager.getAudioNodes();
    this.ttsService = new TextToSpeechService(audioContexts.output, audioNodes);

    // Initialize text buffer manager
    this.textBufferManager = new TextBufferManager(
      async (text: string) => {
        await this.handleSpeech(text);
      }
    );

    // Initialize session
    this.initSession();
  }

  private async initSession(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.updateError("Microphone access is not supported in this browser.");
        return;
      }

      const session = await this.sessionManager.initSession(
        () => this.updateStatus('Opened'),
        (message: LiveServerMessage) => this.handleMessage(message),
        (e: ErrorEvent) => this.updateError(e.message),
        (e: CloseEvent) => {
          this.updateStatus('Close: ' + e.reason);
          this.textBufferManager.flushBuffer();
        }
      );

      this.audioManager.setSession(session);
      this.messageHandler.setSession(session);
    } catch (e: any) {
      console.error(e);
      this.updateError("Failed to initialize session");
    }
  }

  private async handleMessage(message: LiveServerMessage): Promise<void> {
    await this.messageHandler.handleMessage(
      message,
      (text: string) => this.handleSpeech(text),
      (text: string) => this.textBufferManager.addToBuffer(text),
      (error: string) => this.updateError(error)
    );
  }

  private async handleSpeech(text: string): Promise<void> {
    console.log("🎤 handleSpeech called with:", text);
    
    const lastSpokenText = this.textBufferManager.getLastSpokenText();
    if (text === lastSpokenText) {
      console.log("Skipping duplicate speech:", text);
      return;
    }

    console.log("🔊 Attempting to speak:", text);
    this.ttsService.stop();
    this.textBufferManager.clearBuffer();
    this.textBufferManager.setLastSpokenText(text);
    
    try {
      console.log("🎵 Calling TTS service...");
      await this.ttsService.speak(text);
      console.log("✅ TTS service completed");
    } catch (error: any) {
      console.error("❌ TTS Error:", error);
      this.updateError(error.message);
    }
  }

  private updateStatus(msg: string): void {
    this.status = msg;
    this.error = '';
    this.requestUpdate();
  }

  private updateError(msg: string): void {
    this.error = msg;
    this.status = '';
    this.requestUpdate();
  }

  private async handleStartRecording(): Promise<void> {
    await this.audioManager.startRecording(
      (status: string) => this.updateStatus(status),
      (error: string) => this.updateError(error)
    );
    this.isRecording = this.audioManager.isRecording();
    this.requestUpdate();
  }

  private handleStopRecording(): void {
    this.audioManager.stopRecording();
    this.isRecording = false;
    this.updateStatus('Recording stopped.');
    this.textBufferManager.flushBuffer();
    this.requestUpdate();
  }

  private handleReset(): void {
    // Stop all services
    this.ttsService.stop();
    this.audioManager.stopRecording();
    this.textBufferManager.clearBuffer();
    this.messageHandler.clearProcessedMessages();

    // Reset states
    this.isRecording = false;

    // Close and reinitialize session
    this.sessionManager.closeSession();
    this.initSession();
    
    this.updateStatus('Session cleared.');
  }

  render() {
    const audioNodes = this.audioManager.getAudioNodes();
    
    return html`
      <div>
        <chatbot-controls
          .isRecording=${this.isRecording}
          @reset=${this.handleReset}
          @start-recording=${this.handleStartRecording}
          @stop-recording=${this.handleStopRecording}
        ></chatbot-controls>
        
        <chatbot-status
          .status=${this.status}
          .error=${this.error}
        ></chatbot-status>
        
        <gdm-live-audio-visuals-3d
          .inputNode=${audioNodes.input}
          .outputNode=${audioNodes.output}>
        </gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}
