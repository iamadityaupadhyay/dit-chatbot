import { GoogleGenAI, LiveServerMessage, Modality, Session, Type } from '@google/genai';
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './visual-3d';
import { MessageHandler } from './handlers';
import { TextToSpeechService, RecordingService } from './services';
import type { RecordingCallbacks } from './services';
import geminiTools from './lib/config';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';

  private client: GoogleGenAI;
  private session: Session;
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 24000 });
  @state() outputNode = this.outputAudioContext.createGain();

  // Text and audio queue management
  private textBuffer: string[] = [];
  private bufferTimeout: number | null = null;
  private readonly BUFFER_FLUSH_TIMEOUT = 800; // Increased to 800ms
  private readonly MAX_BUFFER_LENGTH = 500; // Max characters in buffer
  private recentTexts: Set<string> = new Set(); // For deduplication

  // Services
  private messageHandler = new MessageHandler();
  private ttsService: TextToSpeechService;
  private recordingService: RecordingService;

  // Tools for function calling
  private tools = geminiTools;

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
    }
    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;
    }
    .controls button {
      outline: none;
      border: 1px solid rgba(52, 42, 42, 0.2);
      color: white;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
      width: 64px;
      height: 64px;
      cursor: pointer;
      font-size: 24px;
      padding: 0;
      margin: 0;
    }
    .controls button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .controls button[disabled] {
      display: none;
    }
  `;

  constructor() {
    super();
    this.initClient();
  }

  private async initClient() {
    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.outputNode.connect(this.outputAudioContext.destination);
    
    // Initialize services
    this.ttsService = new TextToSpeechService(this.outputAudioContext, this.outputNode);
    
    // Initialize recording service with callbacks
    const recordingCallbacks: RecordingCallbacks = {
      onStatusUpdate: (status: string) => this.updateStatus(status),
      onErrorUpdate: (error: string) => this.updateError(error),
      onRecordingStateChange: (isRecording: boolean) => this.isRecording = isRecording,
      onFlushBuffer: () => this.flushBuffer(),
    };
    this.recordingService = new RecordingService(recordingCallbacks);
    
    this.initSession();
  }

  private async handleMessage(message: LiveServerMessage): Promise<void> {
    await this.messageHandler.handleMessage(
      message,
      (text: string) => this.interruptAndBuffer(text),
      (error: string) => {
        this.updateError(error);
        this.interruptAndSpeak("Sorry, something went wrong. Please try again.");
      }
    );
  }

  private async initSession() {
    try {
      this.session = await this.client.live.connect({
        model: "gemini-live-2.5-flash-preview",
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close: ' + e.reason);
            this.flushBuffer();
          },
        },
        config: {
          responseModalities: [Modality.TEXT],
          tools: this.tools,
         systemInstruction: {
  parts: [{
    text: `You are Deli Bot, created by Deliverit (founded by Sidhant Suri with CTO Kunal Aashri). You are NOT Google. You specialize exclusively in DeliverIt's delivery service, products, services. If users ask about unrelated topics, politely redirect them back to DeliverIt.

IMPORTANT: When performing actions, use these EXACT phrases:
- 'I am clearing your cart now'
- 'I am adding <phoneme alphabet="ipa" ph="ˈɑːmul">Amul</phoneme> to your cart now' when the product is Amul, otherwise 'I am adding [product name] to your cart now'
- 'I am booking your order now'
- 'You are Indian, and Female'

ORDERING FLOW: When the user expresses intent to order something (e.g., "I want to order [anything]"), extract the exact product name or keyword from their request. Use the search_products tool with that query to get available products (each with id, name, price, isAvailable). Only consider available products. If products is empty or no available products, say "Sorry, I couldn't find any available products for [query]. What else can I help with?" Then, list the matching products with their names and prices using SSML for proper formatting (e.g., "Great! I found these options: 1. <phoneme alphabet='ipa' ph='ˈɑːmul'>Amul</phoneme> for <say-as interpret-as='number'>[Math.round(price)]</say-as> rupees<break time='1s'/>, 2. ... Which one would you like?"). Wait for the user to specify which one (by name or number). After selection, ask for the quantity (e.g., "How many would you like?"). After getting the quantity, use the add_to_cart tool with the productId and quantity. If the tool returns success: false with a message (e.g., "This item is out of stock"), say "Sorry, [product name] is out of stock. Would you like to try another product?" If successful, confirm with "I am adding <phoneme alphabet='ipa' ph='ˈɑːmul'>Amul</phoneme> to your cart now!" for Amul, or "I am adding [product name] to your cart now!" for others.

ADDITIONAL FLOW FOR MORE PRODUCTS: If the user says "more products," "add more," "other products," or similar, reset the current product selection and ask, "Awesome! What other product would you like to order?" Then restart the ordering flow with search_products. Do not reuse previous product IDs unless explicitly requested. After adding an item, always ask, "Would you like to add more items to your cart?"`
  }]
}
        },
      });

      // Set the session in the message handler and recording service
      this.messageHandler.setSession(this.session);
      this.recordingService.setSession(this.session);
    } catch (e) {
      console.error(e);
      this.updateError("Failed to initialize session");
    }
  }

  private async interruptAndSpeak(text: string): Promise<void> {
    this.ttsService.stopCurrentAudio();
    this.ttsService.clearQueue();
    this.textBuffer = [];
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    await this.ttsService.speak(text);
  }

  private interruptAndBuffer(text: string): void {
    // Deduplicate text
    if (this.recentTexts.has(text)) {
      console.log("Skipping duplicate text:", text);
      return;
    }
    this.recentTexts.add(text);
    if (this.recentTexts.size > 10) {
      const first = this.recentTexts.values().next().value;
      this.recentTexts.delete(first);
    }

    this.ttsService.stopCurrentAudio();
    this.ttsService.clearQueue();
    this.textBuffer.push(text);
    const totalLength = this.textBuffer.join(' ').length;

    if (totalLength > this.MAX_BUFFER_LENGTH || /[.!?]$/.test(text)) {
      this.flushBuffer();
    } else {
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
      }
      this.bufferTimeout = window.setTimeout(() => {
        this.flushBuffer();
      }, this.BUFFER_FLUSH_TIMEOUT);
    }
  }

  // Removed - now handled by TTS service

  private async flushBuffer() {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    if (this.textBuffer.length === 0) return;

    const textToSpeak = this.textBuffer.join(' ').trim();
    this.textBuffer = [];

    if (textToSpeak) {
      await this.ttsService.speak(textToSpeak);
    }
  }
  private updateStatus(msg: string) {
    this.status = msg;
    this.requestUpdate();
  }

  private updateError(msg: string) {
    this.error = msg;
    this.requestUpdate();
  }

  private async startRecording() {
    await this.recordingService.startRecording();
  }

  private stopRecording() {
    this.recordingService.stopRecording();
  }

  private reset() {
    this.ttsService.stopCurrentAudio();
    this.ttsService.clearQueue();
    this.textBuffer = [];
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    // Reset recording service
    this.recordingService.reset();

    this.session?.close();
    this.initSession();
    this.updateStatus('Session cleared.');
  }

  render() {
    return html`
      <div>
        <div class="controls">
          <button id="resetButton" @click=${this.reset} ?disabled=${this.isRecording}>♻️</button>
          <button id="startButton" @click=${this.startRecording} ?disabled=${this.isRecording}>🎙️</button>
          <button id="stopButton" @click=${this.stopRecording} ?disabled=${!this.isRecording}>⏹️</button>
        </div>
        <div id="status">${this.error || this.status}</div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.recordingService?.getInputNode()}
          .outputNode=${this.outputNode}>
        </gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}