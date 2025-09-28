import { createBlob } from '../utils';

export type RecordingCallbacks = {
  onStatusUpdate: (status: string) => void;
  onErrorUpdate: (error: string) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onFlushBuffer: () => void;
};

export class RecordingService {
  private isRecording = false;
  private inputAudioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private inputNode: GainNode;
  private session: any; // Will be set from the main component
  private callbacks: RecordingCallbacks;

  constructor(callbacks: RecordingCallbacks) {
    this.callbacks = callbacks;
    this.inputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.inputNode = this.inputAudioContext.createGain();
  }

  public setSession(session: any) {
    this.session = session;
  }

  public getInputNode(): GainNode {
    return this.inputNode;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) return;

    await this.inputAudioContext.resume();
    this.callbacks.onStatusUpdate('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.callbacks.onStatusUpdate('Microphone access granted.');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(bufferSize, 1, 1);

      this.scriptProcessorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const pcmData = e.inputBuffer.getChannelData(0);
        if (this.session) {
          this.session.sendRealtimeInput({ media: createBlob(pcmData) });
        }
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.callbacks.onRecordingStateChange(true);
      this.callbacks.onStatusUpdate('🔴 Recording...');
    } catch (err) {
      console.error('Mic error:', err);
      this.callbacks.onStatusUpdate(`Error: ${err.message}`);
      this.stopRecording();
    }
  }

  public stopRecording(): void {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.callbacks.onRecordingStateChange(false);
    
    this.scriptProcessorNode?.disconnect();
    this.sourceNode?.disconnect();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }

    this.callbacks.onStatusUpdate('Recording stopped.');
    this.callbacks.onFlushBuffer();
  }

  public reset(): void {
    // Stop any ongoing recording
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clean up audio resources
    this.cleanup();
    
    // Recreate audio context and input node
    this.inputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.inputNode = this.inputAudioContext.createGain();
    
    this.callbacks.onStatusUpdate('Recording service reset.');
  }

  private cleanup(): void {
    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  public dispose(): void {
    this.stopRecording();
    this.cleanup();
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close();
    }
  }
}
