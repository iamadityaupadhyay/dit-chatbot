import { GoogleGenAI, LiveServerMessage, Modality, Session, Type } from '@google/genai';
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createBlob } from './utils';
import './visual-3d';
import { MessageHandler } from './handlers/MessageHandler';
import axios from 'axios';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';

  private client: GoogleGenAI;
  private session: Session;
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 16000 });
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 24000 });
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private mediaStream: MediaStream;
  private sourceNode: MediaStreamAudioSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;

  // Track current audio source for interruption
  private currentAudioSource: AudioBufferSourceNode | null = null;

  // ====== MURF AI CONFIG ======
  private MURF_API_KEY = "ap2_10a62c3e-ef81-4e04-996e-191e4fdab276";
  private MURF_VOICE_ID = "en-US-natalie";

  // Text and audio queue management
  private textBuffer: string[] = [];
  private audioQueue: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private bufferTimeout: number | null = null;
  private readonly BUFFER_FLUSH_TIMEOUT = 800; // Increased to 800ms
  private readonly MAX_BUFFER_LENGTH = 500; // Max characters in buffer
  private readonly RETRY_ATTEMPTS = 3; // Number of retries for Murf API
  private recentTexts: Set<string> = new Set(); // For deduplication

  // TTS Configuration
  private USE_SSML = false;

  // Message Handler
  private messageHandler = new MessageHandler();

  // Tools for function calling
  private tools = [
    {
      functionDeclarations: [
        {
          name: "search_products",
          description: "Search for products by name to find matching items for ordering.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: {
                type: Type.STRING,
                description: "The exact product name or keyword to search for."
              }
            },
            required: ["query"]
          }
        },
        {
          name: "add_to_cart",
          description: "Add a specific product to the user's cart with a given quantity.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              productId: {
                type: Type.STRING,
                description: "The unique ID of the product to add."
              },
              quantity: {
                type: Type.NUMBER,
                description: "The quantity of the product to add (must be a positive integer)."
              }
            },
            required: ["productId", "quantity"]
          }
        }
      ]
    }
  ];

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

      // Set the session in the message handler
      this.messageHandler.setSession(this.session);
    } catch (e) {
      console.error(e);
      this.updateError("Failed to initialize session");
    }
  }

  private async interruptAndSpeak(text: string): Promise<void> {
    this.stopCurrentAudio();
    this.audioQueue = [];
    this.textBuffer = [];
    this.isSpeaking = false;
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    await this.speakWithMurf(text);
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

    this.stopCurrentAudio();
    this.audioQueue = [];
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

  private stopCurrentAudio(): void {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        console.warn('Error stopping current audio:', e);
      }
      this.currentAudioSource = null;
    }
    this.isSpeaking = false;
  }

  private async flushBuffer() {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    if (this.textBuffer.length === 0) return;

    const textToSpeak = this.textBuffer.join(' ').trim();
    this.textBuffer = [];

    if (textToSpeak) {
      await this.speakWithMurf(textToSpeak);
    }
  }

  private async speakWithMurf(text: string, attempt: number = 1): Promise<void> {
  const maxRetries = this.RETRY_ATTEMPTS;
  const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s

  try {
    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }

    const processedText = this.USE_SSML ? text : text.replace(/<[^>]*>/g, '');
    console.log(`Murf API Call (Attempt ${attempt}/${maxRetries}): Text length=${processedText.length}, Voice=${this.MURF_VOICE_ID}`);

    const response = await axios({
      method: 'post',
      url: 'https://api.murf.ai/v1/speech/generate',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.MURF_API_KEY,
        "multiNativeLocale": "hi-IN"
      },
      data: JSON.stringify({
        text: processedText,
        voiceId: this.MURF_VOICE_ID,
        model: "GEN2" // Ensure GEN2 model
      })
    });

    console.log("Murf API Raw Response:", JSON.stringify(response.data, null, 2));

    if (response.data.error) {
      throw new Error(`Murf API Error: ${response.data.error.message || response.data.error}`);
    }

    if (!response.data || !response.data.audioFile) {
      throw new Error(`Murf API failed: No audio file in response. Full data: ${JSON.stringify(response.data)}`);
    }

    const audioResponse = await fetch(response.data.audioFile);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status} - ${audioResponse.statusText}`);
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = await this.outputAudioContext.decodeAudioData(arrayBuffer);

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputNode);

    this.audioQueue.push(source);

    if (!this.isSpeaking) {
      this.processAudioQueue();
    }
  } catch (err) {
    console.error(`TTS Error (Attempt ${attempt}/${maxRetries}):`, err);
    if (attempt < maxRetries) {
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.speakWithMurf(text, attempt + 1);
    } else {
      console.warn("Murf failed after retries; falling back to browser TTS");
      this.fallbackToBrowserTTS(text);
    }
  }
}

  private async processAudioQueue() {
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

  private updateStatus(msg: string) {
    this.status = msg;
    this.requestUpdate();
  }

  private updateError(msg: string) {
    this.error = msg;
    this.requestUpdate();
  }

  private async startRecording() {
    if (this.isRecording) return;

    await this.inputAudioContext.resume();
    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateStatus('Microphone access granted.');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(bufferSize, 1, 1);

      this.scriptProcessorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const pcmData = e.inputBuffer.getChannelData(0);
        this.session.sendRealtimeInput({ media: createBlob(pcmData) });
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording...');
    } catch (err) {
      console.error('Mic error:', err);
      this.updateStatus(`Error: ${err.message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.scriptProcessorNode?.disconnect();
    this.sourceNode?.disconnect();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }

    this.updateStatus('Recording stopped.');
    this.flushBuffer();
  }

  private reset() {
    this.stopCurrentAudio();
    this.audioQueue = [];
    this.textBuffer = [];
    this.isSpeaking = false;
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

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
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}>
        </gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}