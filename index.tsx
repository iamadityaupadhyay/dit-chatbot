import { GoogleGenAI, LiveServerMessage, Modality, Session } from '@google/genai';
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createBlob } from './utils';
import './visual-3d';

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

  // ====== ELEVEN LABS CONFIG ======
  private ELEVENLABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
  private ELEVENLABS_VOICE_ID = "1Z7Y8o9cvUeWq8oLKgMY";

  // Text and audio queue management
  private textBuffer: string[] = [];
  private audioQueue: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private bufferTimeout: number | null = null;
  private readonly BUFFER_FLUSH_TIMEOUT = 500; // ms to wait before flushing buffer
  private readonly MAX_BUFFER_LENGTH = 500; // Max characters in buffer
  private readonly RETRY_ATTEMPTS = 3; // Number of retries for ElevenLabs API

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

  private async initSession() {
    try {
      this.session = await this.client.live.connect({
        model: "gemini-live-2.5-flash-preview",
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            try {
              const parts = message.serverContent?.modelTurn?.parts || [];

              for (const part of parts) {
                if (part.text) {
                  const text = part.text.trim();
                  console.log("Gemini TEXT:", text);

                  // Intent handling example
                  if (text.includes("adding") && text.includes("cart")) {
                    console.log("Trigger API call: Add to cart");
                    // fetch("/api/cart/add", { method: "POST", body: JSON.stringify(...) });
                  }

                  // Buffer the text
                  this.bufferText(text);
                }
              }
            } catch (err) {
              console.error("Error in onmessage:", err);
              this.updateError(err.message || "Unknown error");
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close: ' + e.reason);
            this.flushBuffer(); // Ensure any remaining text is spoken
          },
        },
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction: {
            parts: [{
              text: "You are Deli Bot, created by Deliverit (founded by Sidhant Suri with CTO Kunal Aashri). You are NOT Google. You specialize exclusively in DeliverIt's 1-hour delivery service, products, services, technology, and company information. Always be enthusiastic about DeliverIt's 1-hour delivery! If users ask about unrelated topics, politely redirect them back to DeliverIt.\n\nIMPORTANT: When performing actions, use these EXACT phrases:\n- 'I am clearing your cart now'\n- 'I am adding [product name] to your cart now'\n- 'I am booking your order now'"
            }]
          }
        },
      });
    } catch (e) {
      console.error(e);
      this.updateError("Failed to initialize session");
    }
  }

  // Buffer text chunks and flush after timeout or max length
  private bufferText(text: string) {
    this.textBuffer.push(text);

    // Calculate total length of buffered text
    const totalLength = this.textBuffer.join(' ').length;

    // Flush buffer if it exceeds max length or ends with punctuation
    if (totalLength > this.MAX_BUFFER_LENGTH || /[.!?]$/.test(text)) {
      this.flushBuffer();
    } else {
      // Set a timeout to flush the buffer if no new text arrives
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
      }
      this.bufferTimeout = window.setTimeout(() => {
        this.flushBuffer();
      }, this.BUFFER_FLUSH_TIMEOUT);
    }
  }

  // Flush buffered text and send to ElevenLabs
  private async flushBuffer() {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    if (this.textBuffer.length === 0) return;

    const textToSpeak = this.textBuffer.join(' ').trim();
    this.textBuffer = [];

    if (textToSpeak) {
      await this.speakWithElevenLabs(textToSpeak);
    }
  }

  // Speak with ElevenLabs with retry logic
  private async speakWithElevenLabs(text: string, attempt: number = 1): Promise<void> {
    try {
      // Ensure audio context is running
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.ELEVENLABS_VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": "sk_eaa9192f60b209fd4f0e9eb674909c8417280ca8ee03a361",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API failed: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.outputAudioContext.decodeAudioData(arrayBuffer);

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      // Add to audio queue
      this.audioQueue.push(source);

      // Start playing if not already speaking
      if (!this.isSpeaking) {
        this.processAudioQueue();
      }
    } catch (err) {
      console.error(`TTS Error (Attempt ${attempt}):`, err);
      if (attempt < this.RETRY_ATTEMPTS) {
        console.log(`Retrying... (${attempt + 1}/${this.RETRY_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        return this.speakWithElevenLabs(text, attempt + 1);
      } else {
        this.updateError("Failed to generate speech after retries");
      }
    }
  }

  // Process audio queue for seamless playback
  private async processAudioQueue() {
    if (this.audioQueue.length === 0) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    const source = this.audioQueue.shift()!;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        resolve();
      };
      source.start();
    });

    // Continue processing the queue
    await this.processAudioQueue();
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
    this.flushBuffer(); // Ensure any remaining text is spoken
  }

  private reset() {
    this.session?.close();
    this.initSession();
    this.textBuffer = [];
    this.audioQueue = [];
    this.isSpeaking = false;
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
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