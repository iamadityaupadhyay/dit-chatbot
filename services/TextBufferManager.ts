export class TextBufferManager {
  private textBuffer: string[] = [];
  private bufferTimeout: number | null = null;
  private lastSpokenText: string | null = null;
  private readonly BUFFER_FLUSH_TIMEOUT = 500; // ms
  private readonly MAX_BUFFER_LENGTH = 500; // characters

  constructor(
    private onFlush: (text: string) => Promise<void>
  ) {}

  addToBuffer(text: string): void {
    console.log("📝 Adding to buffer:", text);
    
    if (text === this.lastSpokenText || this.textBuffer.includes(text)) {
      console.log("📝 Skipping duplicate buffer:", text);
      return;
    }

    this.textBuffer.push(text);
    const totalLength = this.textBuffer.join(' ').length;
    console.log(`📝 Buffer length: ${totalLength}, text ends with punctuation: ${/[.!?]$/.test(text)}`);

    if (totalLength > this.MAX_BUFFER_LENGTH || /[.!?]$/.test(text)) {
      console.log("📝 Flushing buffer immediately");
      this.flushBuffer();
    } else {
      console.log(`📝 Setting flush timeout: ${this.BUFFER_FLUSH_TIMEOUT}ms`);
      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
      }
      this.bufferTimeout = window.setTimeout(() => {
        this.flushBuffer();
      }, this.BUFFER_FLUSH_TIMEOUT);
    }
  }

  async flushBuffer(): Promise<void> {
    console.log("📝 Flushing buffer...");
    
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    if (this.textBuffer.length === 0) {
      console.log("📝 Buffer is empty, nothing to flush");
      return;
    }

    const textToSpeak = this.textBuffer.join(' ').trim();
    console.log("📝 Text to speak:", textToSpeak);
    this.textBuffer = [];
    
    if (textToSpeak && textToSpeak !== this.lastSpokenText) {
      console.log("📝 Calling onFlush callback");
      this.lastSpokenText = textToSpeak;
      await this.onFlush(textToSpeak);
    } else {
      console.log("📝 Skipping flush - duplicate or empty text");
    }
  }

  clearBuffer(): void {
    this.textBuffer = [];
    this.lastSpokenText = null;
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
  }

  getLastSpokenText(): string | null {
    return this.lastSpokenText;
  }

  setLastSpokenText(text: string): void {
    this.lastSpokenText = text;
  }
}
