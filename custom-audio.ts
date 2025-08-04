/**
 * Custom Live Audio Chat Component
 * Created by Aditya Upadhyay - Independent of Google services
 */

import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {CustomDeliveritAI} from './deliverit-ai';
import './visual-3d';

// Simple speech recognition interface
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    webkitAudioContext: typeof AudioContext;
  }
}

@customElement('custom-live-audio')
export class CustomLiveAudio extends LitElement {
  @state() isListening = false;
  @state() status = 'Ready to start conversation';
  @state() error = '';
  @state() lastTranscript = '';
  @state() lastResponse = '';

  private customAI: CustomDeliveritAI;
  private recognition: SpeechRecognition | null = null;
  private inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();

  static styles = css`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      font-family: 'Arial', sans-serif;
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .header {
      position: absolute;
      top: 20px;
      text-align: center;
      z-index: 10;
    }

    .header h1 {
      margin: 0;
      font-size: 2.5rem;
      font-weight: bold;
      background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      margin: 10px 0 0 0;
      font-size: 1.1rem;
      opacity: 0.8;
    }

    .visual-container {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 5;
      
    }

    .controls {
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 20px;
      z-index: 10;
    }

    .main-button {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.3);
      background: linear-gradient(45deg, #4ecdc4, #44a08d);
      color: white;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .main-button.listening {
      background: linear-gradient(45deg, #ff4757, #ff3838);
    }

    .main-button:hover {
      transform: scale(1.1);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }

    .status {
      text-align: center;
      padding: 15px 30px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 25px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-width: 80%;
    }

    .status h3 {
      margin: 0 0 10px 0;
      font-size: 1.2rem;
    }

    .status p {
      margin: 5px 0;
      opacity: 0.9;
    }

    .transcript {
      background: rgba(76, 175, 80, 0.2);
      border-left: 4px solid #4caf50;
    }

    .response {
      background: rgba(33, 150, 243, 0.2);
      border-left: 4px solid #2196f3;
    }

    .error {
      background: rgba(244, 67, 54, 0.2);
      border-left: 4px solid #f44336;
    }

    .listening-indicator {
      position: absolute;
      top: -10px;
      right: -10px;
      width: 20px;
      height: 20px;
      background: #ff4757;
      border-radius: 50%;
      animation: pulse 1s infinite;
    }

    .listening-indicator.hidden {
      display: none;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
      100% { transform: scale(1); opacity: 1; }
    }

    .secondary-buttons {
      display: flex;
      gap: 15px;
    }

    .secondary-button {
      padding: 10px 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    }

    .secondary-button:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }
  `;

  constructor() {
    super();
    this.customAI = new CustomDeliveritAI();
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.status = '🎤 Listening... Speak now!';
        this.error = '';
      };

      this.recognition.onresult = async (event: SpeechRecognitionEvent) => {
        const result = event.results[0];
        if (result.isFinal) {
          const transcript = result[0].transcript;
          this.lastTranscript = transcript;
          this.status = '🤔 Processing your question...';
          
          try {
            const response = await this.customAI.processInput(transcript);
            this.lastResponse = response.text;
            this.status = '✅ Response ready!';
          } catch (error) {
            this.error = `Error processing response: ${error}`;
            this.status = 'Error occurred';
          }
        }
      };

      this.recognition.onerror = (event) => {
        this.error = `Speech recognition error: ${event.error}`;
        this.isListening = false;
        this.status = 'Ready to start conversation';
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (!this.lastResponse && !this.error) {
          this.status = 'Ready to start conversation';
        }
      };
    } else {
      this.error = 'Speech recognition not supported in this browser';
    }
  }

  private toggleListening() {
    if (!this.recognition) {
      this.error = 'Speech recognition not available';
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.customAI.stopSpeaking();
    } else {
      this.lastTranscript = '';
      this.lastResponse = '';
      this.error = '';
      this.recognition.start();
    }
  }

  private stopAll() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.customAI.stopSpeaking();
    this.isListening = false;
    this.status = 'Ready to start conversation';
  }

  private reset() {
    this.stopAll();
    this.lastTranscript = '';
    this.lastResponse = '';
    this.error = '';
    this.status = 'Session cleared - Ready to start';
  }

  render() {
    return html`
      <div class="container">
        <div class="header">
          <h1>Deliverit AI Assistant</h1>
          <p>Created by Aditya Upadhyay • Specialized in Deliverit </p>
        </div>

        <div class="visual-container">
          <gdm-live-audio-visuals-3d 
            .inputNode=${this.inputNode}
            .outputNode=${this.outputNode}>
          </gdm-live-audio-visuals-3d>
        </div>

        <div class="controls">
          ${this.lastTranscript ? html`
            <div class="status transcript">
              <h3>You said:</h3>
              <p>"${this.lastTranscript}"</p>
            </div>
          ` : ''}

          ${this.lastResponse ? html`
            <div class="status response">
              <h3>Deliverit AI:</h3>
              <p>${this.lastResponse}</p>
            </div>
          ` : ''}

          ${this.error ? html`
            <div class="status error">
              <h3>Error:</h3>
              <p>${this.error}</p>
            </div>
          ` : ''}

          <div class="status">
            <p>${this.status}</p>
          </div>

          <button 
            class="main-button ${this.isListening ? 'listening' : ''}" 
            @click=${this.toggleListening}
            title=${this.isListening ? 'Stop Listening' : 'Start Listening'}>
            ${this.isListening ? '⏹️' : '🎤'}
            <div class="listening-indicator ${this.isListening ? '' : 'hidden'}"></div>
          </button>

          <div class="secondary-buttons">
            <button class="secondary-button" @click=${this.stopAll}>
              Stop All
            </button>
            <button class="secondary-button" @click=${this.reset}>
              Reset
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'custom-live-audio': CustomLiveAudio;
  }
}
