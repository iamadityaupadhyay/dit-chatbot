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
  @state() products: any[] = [];
  @state() showProducts = false;
  @state() showCelebration = false;
  @state() addedProduct = '';

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
      background: rgba(186, 50, 50, 0.1);
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
    
    .product-overlay {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      z-index: 15;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 60vh;
      overflow-y: auto;
      animation: slideDown 0.5s ease-out;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .product-header {
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 15px;
      border-radius: 15px;
      text-align: center;
      font-weight: bold;
      font-size: 18px;
      backdrop-filter: blur(15px);
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
    }
    
    .product-bubble {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(240, 240, 255, 0.75));
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(15px);
      border: 2px solid rgba(255, 255, 255, 0.4);
      transition: all 0.3s ease;
      animation: bubbleIn 0.6s ease-out forwards;
      opacity: 0;
      transform: scale(0.8);
    }
    
    @keyframes bubbleIn {
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    .product-bubble:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(250, 250, 255, 0.85));
    }
    
    .product-name {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    
    .product-price {
      font-size: 20px;
      font-weight: bold;
      color: #007bff;
      margin-bottom: 10px;
    }
    
    .product-id {
      font-size: 12px;
      color: #666;
      opacity: 0.8;
    }
    
    .product-image {
      width: 60px;
      height: 60px;
      border-radius: 10px;
      object-fit: cover;
      margin-bottom: 10px;
      border: 2px solid rgba(0, 123, 255, 0.2);
    }
    
    .close-products {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .close-products:hover {
      background: rgba(255, 0, 0, 1);
    }
    
    .product-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    .select-btn {
      flex: 1;
      background: linear-gradient(135deg, #007bff, #0056b3);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
    }
    
    .select-btn:hover {
      background: linear-gradient(135deg, #0056b3, #003d82);
      transform: translateY(-2px);
    }
    
    .add-cart-btn {
      flex: 1;
      background: linear-gradient(135deg, #28a745, #1e7e34);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
    }
    
    .add-cart-btn:hover {
      background: linear-gradient(135deg, #1e7e34, #155724);
      transform: translateY(-2px);
    }
    
    .add-cart-btn:disabled {
      background: linear-gradient(135deg, #6c757d, #5a6268);
      cursor: not-allowed;
      transform: none;
    }
    
    .celebration-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      animation: fadeIn 0.3s ease-out;
    }
    
    .celebration-card {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 30px;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3);
      animation: celebrationBounce 0.6s ease-out;
      max-width: 400px;
      width: 90%;
    }
    
    .celebration-icon {
      font-size: 60px;
      margin-bottom: 20px;
      animation: spin 0.8s ease-in-out;
    }
    
    .celebration-text {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .celebration-product {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 20px;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes celebrationBounce {
      0% { 
        opacity: 0;
        transform: scale(0.3) translateY(-50px);
      }
      50% {
        transform: scale(1.1) translateY(-10px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
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
    
    // Set up product display callback
    this.messageHandler.setProductCallback((products: any[]) => {
      this.showProductList(products);
    });
    
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

  public showProductList(products: any[]) {
    this.products = products;
    this.showProducts = true;
    this.requestUpdate();
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
      if (this.showProducts) {
        this.hideProductList();
      }
    }, 30000);
  }

  public hideProductList() {
    this.showProducts = false;
    this.products = [];
    this.requestUpdate();
  }

  private selectProduct(product: any) {
    // Hide the product list
    this.hideProductList();
    
    // Send product selection to the AI
    if (this.session) {
      const message = `I want to select "${product.name}" which costs ${product.price} rupees. The product ID is ${product.id}.`;
      // TODO: Send product selection to AI
      console.log("Product selected:", product);
    }
  }

  private async addToCart(product: any, event: Event) {
    event.stopPropagation(); // Prevent product selection when clicking add to cart
    
    try {
      // Import the addToCart function dynamically
      const { addToCart } = await import('./lib/productService');
      
      // Add to cart with quantity 1
      const response = await addToCart(product.id, 1);
      
      if (response && response.message=="success") {
        // Show celebration
        this.addedProduct = product.name;
        this.showCelebration = true;
        this.requestUpdate();

        setTimeout(() => {
          this.showCelebration = false;
          this.requestUpdate();
        }, 3000);
        
        console.log("✅ Product added to cart successfully:", product.name);
      } else {
        this.updateError(`Failed to add ${product.name} to cart`);
      }
    } catch (error) {
      console.error("❌ Error adding to cart:", error);
      this.updateError(`Error adding ${product.name} to cart`);
    }
  }

  private hideCelebration() {
    this.showCelebration = false;
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
        ${this.showProducts ? html`
          <div class="product-overlay">
            <button class="close-products" @click=${this.hideProductList}>×</button>
            <div class="product-header">
              🛒 Available Products (${this.products.length})
            </div>
            <div class="product-grid">
              ${this.products.map((product, index) => html`
                <div class="product-bubble" 
                     style="animation-delay: ${index * 0.1}s">
                  ${product.image ? html`
                    <img class="product-image" src="${product.image}" alt="${product.name}" />
                  ` : ''}
                  <div class="product-name">${product.name}</div>
                  <div class="product-price">₹${product.price}</div>
                  <div class="product-actions">
                    <button class="add-cart-btn" @click=${(e: Event) => this.addToCart(product, e)}>
                      🛒 Add to Cart
                    </button>
                  </div>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
        
        ${this.showCelebration ? html`
          <div class="celebration-overlay" @click=${this.hideCelebration}>
            <div class="celebration-card">
              <div class="celebration-icon">🎉</div>
              <div class="celebration-text">Added to Cart!</div>
              <div class="celebration-product">${this.addedProduct}</div>
              <div>Tap anywhere to continue</div>
            </div>
          </div>
        ` : ''}
        
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