/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

// Backend API configuration
const BACKEND_URL = 'http://localhost:3001';
const WEBSOCKET_URL = 'ws://localhost:3001';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() isConnected = false;

  private websocket: WebSocket | null = null;
  private inputAudioContext = new (window.AudioContext ||
    window.webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    window.webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: MediaStreamAudioSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: white;
      font-family: 'Arial', sans-serif;
      background: rgba(0, 0, 0, 0.5);
      padding: 10px;
      border-radius: 10px;
      margin: 0 20px;
    }

    .connection-status {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 10;
      color: white;
      font-family: 'Arial', sans-serif;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px 15px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #00ff00;
    }

    .status-indicator.disconnected {
      background: #ff0000;
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

      button {
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
        transition: all 0.3s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }
      }

      button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    }
  `;

  constructor() {
    super();
    this.initBackendConnection();
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initBackendConnection() {
    this.initAudio();
    this.outputNode.connect(this.outputAudioContext.destination);
    
    // Check backend health
    await this.checkBackendHealth();
    
    // Initialize WebSocket connection
    this.initWebSocket();
  }

  private async checkBackendHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      
      if (data.status === 'healthy') {
        this.updateStatus('✅ Connected to DeliverIt AI Backend');
        this.isConnected = true;
      } else {
        throw new Error('Backend not healthy');
      }
    } catch (error) {
      this.updateError('❌ Backend server not running. Please start the backend server first.');
      this.isConnected = false;
    }
  }

  private initWebSocket() {
    try {
      this.websocket = new WebSocket(WEBSOCKET_URL);
      
      this.websocket.onopen = () => {
        this.updateStatus('🔗 WebSocket connected to DeliverIt AI');
        this.isConnected = true;
      };

      this.websocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'audio_response') {
            // Handle audio response (placeholder for now)
            this.updateStatus(`🎵 ${data.message}`);
          } else if (data.type === 'chat_response') {
            // Handle text chat response
            this.updateStatus(`🤖 DeliverIt AI: ${data.message.substring(0, 100)}...`);
          } else if (data.type === 'error') {
            this.updateError(`❌ ${data.message}`);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateError('WebSocket connection error');
        this.isConnected = false;
      };

      this.websocket.onclose = () => {
        this.updateStatus('WebSocket connection closed');
        this.isConnected = false;
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            this.initWebSocket();
          }
        }, 3000);
      };
    } catch (error) {
      console.error('WebSocket initialization error:', error);
      this.updateError('Failed to initialize WebSocket connection');
    }
  }

  private async sendChatMessage(message: string) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          history: []
        })
      });

      const data = await response.json();
      
      if (data.success) {
        this.updateStatus(`🤖 DeliverIt AI: ${data.response.substring(0, 100)}...`);
        
        // Use speech synthesis to speak the response
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(data.response);
          utterance.rate = 0.9;
          utterance.pitch = 1.1;
          utterance.volume = 0.8;
          speechSynthesis.speak(utterance);
        }
      } else {
        this.updateError(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Chat API error:', error);
      this.updateError('Failed to send message to DeliverIt AI');
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
    this.error = '';
  }

  private updateError(msg: string) {
    this.error = msg;
    this.status = '';
  }

  private async startRecording() {
    if (this.isRecording || !this.isConnected) {
      return;
    }

    this.inputAudioContext.resume();
    this.updateStatus('🎤 Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('🎤 Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // Send audio data to backend via WebSocket
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({
            type: 'audio_stream',
            data: Array.from(pcmData),
            timestamp: Date.now()
          }));
        }
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording... Talk to DeliverIt AI!');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateError(`❌ Error: ${err.message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('⏹️ Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('⏹️ Recording stopped. Click Start to begin again.');
  }

  private async reset() {
    if (this.websocket) {
      this.websocket.close();
    }
    
    // Reinitialize connection
    setTimeout(() => {
      this.initWebSocket();
      this.updateStatus('🔄 Session cleared. Ready for DeliverIt AI!');
    }, 1000);
  }

  private async testChat() {
    // Test the chat functionality
    await this.sendChatMessage("Hello, tell me about DeliverIt's 1-hour delivery service!");
  }

  render() {
    return html`
      <div>
        <div class="connection-status">
          <div class="status-indicator ${this.isConnected ? '' : 'disconnected'}"></div>
          <span>${this.isConnected ? 'Connected to DeliverIt AI' : 'Disconnected'}</span>
        </div>

        <div class="controls">
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording}
            title="Reset Connection">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="40px"
              viewBox="0 -960 960 960"
              width="40px"
              fill="#ffffff">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>

          <button
            id="testButton"
            @click=${this.testChat}
            ?disabled=${!this.isConnected}
            title="Test DeliverIt AI">
            💬
          </button>

          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording || !this.isConnected}
            title="Start Recording">
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" />
            </svg>
          </button>

          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}
            title="Stop Recording">
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#000000"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="100" height="100" rx="15" />
            </svg>
          </button>
        </div>

        <div id="status">
          ${this.error || this.status || '🚀 DeliverIt AI Assistant - Created by Aditya Upadhyay'}
        </div>
        
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}
