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
  @state() addingToCart: Set<string> = new Set();

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
      bottom: 8vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: row;
      gap: 15px;
      padding: 0 20px;
    }
    
    .controls button {
      outline: none;
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(0, 123, 255, 0.8), rgba(40, 167, 69, 0.8));
      width: 70px;
      height: 70px;
      cursor: pointer;
      font-size: 28px;
      padding: 0;
      margin: 0;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
    }
    
    .controls button:hover {
      background: linear-gradient(135deg, rgba(0, 123, 255, 0.9), rgba(40, 167, 69, 0.9));
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }
    
    .controls button[disabled] {
      display: none;
    }
    
    /* Mobile-specific button improvements */
    @media (max-width: 768px) {
      .controls {
        bottom: 5vh;
        gap: 20px;
        padding: 0 15px;
        flex-direction: row;
      }
      
      .controls button {
        width: 85px;
        height: 85px;
        font-size: 32px;
        border-radius: 22px;
        border: 3px solid rgba(255, 255, 255, 0.4);
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.85), rgba(40, 167, 69, 0.85));
        box-shadow: 
          0 8px 25px rgba(0, 0, 0, 0.4),
          0 4px 12px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(15px);
      }
      
      .controls button:active {
        transform: translateY(1px) scale(0.95);
        box-shadow: 
          0 4px 15px rgba(0, 0, 0, 0.5),
          0 2px 8px rgba(0, 0, 0, 0.4);
      }
      
      .controls button:hover {
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.95), rgba(40, 167, 69, 0.95));
      }
    }
    
    /* Extra large mobile screens */
    @media (max-width: 480px) {
      .controls button {
        width: 90px;
        height: 90px;
        font-size: 34px;
      }
    }
    
    .product-overlay {
      position: absolute;
      top: 15px;
      left: 15px;
      right: 15px;
      z-index: 15;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 65vh;
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
      background: rgba(0, 0, 0, 0.3);
      color: white;
      padding: 12px;
      border-radius: 12px;
      text-align: center;
      font-weight: 600;
      font-size: 16px;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 15px;
      padding: 0 5px;
    }
    
    /* Mobile-specific grid improvements */
    @media (max-width: 768px) {
      .product-grid {
        grid-template-columns: 1fr;
        gap: 18px;
        padding: 0 10px;
        max-width: 100%;
      }
    }
    
    @media (max-width: 480px) {
      .product-grid {
        gap: 20px;
        padding: 0 8px;
      }
    }
    
    .product-bubble {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(240, 240, 255, 0.2));
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(25px);
      border: 1.5px solid rgba(255, 255, 255, 0.3);
      transition: all 0.3s ease;
      animation: bubbleIn 0.6s ease-out forwards;
      opacity: 0;
      transform: scale(0.8);
      position: relative;
    }
    
    /* Mobile-specific improvements for product cards */
    @media (max-width: 768px) {
      .product-bubble {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(240, 240, 255, 0.3));
        border-radius: 22px;
        padding: 24px;
        box-shadow: 
          0 12px 40px rgba(0, 0, 0, 0.25),
          0 6px 20px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(30px);
        border: 2px solid rgba(255, 255, 255, 0.4);
        margin-bottom: 8px;
      }
    }
    
    @keyframes bubbleIn {
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    .product-bubble:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(250, 250, 255, 0.3));
      border: 1.5px solid rgba(255, 255, 255, 0.4);
    }
    
    /* Mobile touch feedback */
    @media (max-width: 768px) {
      .product-bubble:active {
        transform: translateY(-2px) scale(0.98);
        box-shadow: 
          0 8px 25px rgba(0, 0, 0, 0.3),
          0 4px 15px rgba(0, 0, 0, 0.25);
      }
    }
    
    .product-name {
      font-size: 16px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
      margin-bottom: 8px;
      line-height: 1.3;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    
    .product-price {
      font-size: 20px;
      font-weight: bold;
      color: rgba(0, 123, 255, 0.9);
      margin-bottom: 10px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    .product-id {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      opacity: 0.8;
    }
    
    .product-image {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      object-fit: cover;
      margin-bottom: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      float: right;
      margin-left: 12px;
      margin-top: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    /* Mobile-specific text improvements */
    @media (max-width: 768px) {
      .product-name {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 10px;
        line-height: 1.4;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
      }
      
      .product-price {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 12px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        color: rgba(0, 123, 255, 1);
      }
      
      .product-id {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }
      
      .product-image {
        width: 60px;
        height: 60px;
        border-radius: 12px;
        border: 2px solid rgba(255, 255, 255, 0.4);
        margin-left: 15px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
    }
    
    @media (max-width: 480px) {
      .product-name {
        font-size: 19px;
        margin-bottom: 12px;
      }
      
      .product-price {
        font-size: 24px;
        margin-bottom: 14px;
      }
      
      .product-image {
        width: 65px;
        height: 65px;
        border-radius: 14px;
      }
    }
    
    .close-products {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .close-products:hover {
      background: rgba(255, 0, 0, 0.8);
    }
    
    .product-actions {
      display: flex;
      gap: 8px;
      margin-top: 15px;
      clear: both;
    }
    
    .select-btn {
      flex: 1;
      background: linear-gradient(135deg, rgba(0, 123, 255, 0.8), rgba(0, 86, 179, 0.8));
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 13px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    .select-btn:hover {
      background: linear-gradient(135deg, rgba(0, 86, 179, 0.9), rgba(0, 61, 130, 0.9));
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .add-cart-btn {
      flex: 1;
      background: linear-gradient(135deg, rgba(40, 167, 69, 0.85), rgba(30, 126, 52, 0.85));
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 13px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    .add-cart-btn:hover {
      background: linear-gradient(135deg, rgba(30, 126, 52, 0.95), rgba(21, 87, 36, 0.95));
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .add-cart-btn:disabled {
      background: linear-gradient(135deg, rgba(108, 117, 125, 0.6), rgba(90, 98, 104, 0.6));
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    /* Mobile-specific button improvements */
    @media (max-width: 768px) {
      .product-actions {
        gap: 10px;
        margin-top: 18px;
        flex-direction: column;
      }
      
      .select-btn, .add-cart-btn {
        padding: 14px 12px;
        font-size: 16px;
        border-radius: 12px;
        font-weight: 700;
        border: 2px solid rgba(255, 255, 255, 0.4);
        box-shadow: 
          0 4px 15px rgba(0, 0, 0, 0.25),
          0 2px 8px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      
      .add-cart-btn {
        background: linear-gradient(135deg, rgba(40, 167, 69, 0.9), rgba(30, 126, 52, 0.9));
      }
      
      .select-btn:active, .add-cart-btn:active {
        transform: translateY(1px) scale(0.98);
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.3),
          0 1px 4px rgba(0, 0, 0, 0.25);
      }
    }
    
    @media (max-width: 480px) {
      .select-btn, .add-cart-btn {
        padding: 16px 14px;
        font-size: 17px;
        border-radius: 14px;
      }
    }
    
    .celebration-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 20vh;
      background: rgba(0, 0, 0, 0.6);
      animation: fadeIn 0.3s ease-out;
      overflow: hidden;
    }
    
    .celebration-card {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 20px 25px;
      border-radius: 18px;
      text-align: center;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
      animation: celebrationBounce 0.6s ease-out;
      max-width: 280px;
      width: auto;
      position: relative;
      z-index: 21;
      border: 2px solid rgba(255, 255, 255, 0.2);
    }
    
    .celebration-icon {
      font-size: 36px;
      margin-bottom: 8px;
      animation: bounce 1s infinite;
    }
    
    .celebration-text {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .celebration-product {
      font-size: 14px;
      opacity: 0.95;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.25);
      padding: 6px 12px;
      border-radius: 10px;
      margin-bottom: 0;
      border: 1px solid rgba(255, 255, 255, 0.3);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    /* Confetti Animation */
    .confetti {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #ff6b6b;
      border-radius: 50%;
      animation: confettiFall 2.5s linear infinite;
    }
    
    .confetti:nth-child(1) { left: 15%; animation-delay: -0.3s; background: #4ecdc4; }
    .confetti:nth-child(2) { left: 25%; animation-delay: -0.6s; background: #45b7d1; }
    .confetti:nth-child(3) { left: 35%; animation-delay: -0.9s; background: #96ceb4; }
    .confetti:nth-child(4) { left: 45%; animation-delay: -1.2s; background: #feca57; }
    .confetti:nth-child(5) { left: 55%; animation-delay: -1.5s; background: #ff9ff3; }
    .confetti:nth-child(6) { left: 65%; animation-delay: -1.8s; background: #54a0ff; }
    .confetti:nth-child(7) { left: 75%; animation-delay: -2.1s; background: #5f27cd; }
    .confetti:nth-child(8) { left: 85%; animation-delay: -2.4s; background: #00d2d3; }
    .confetti:nth-child(9) { left: 20%; animation-delay: -0.7s; background: #ff6348; }
    .confetti:nth-child(10) { left: 30%; animation-delay: -1.0s; background: #2ed573; }
    .confetti:nth-child(11) { left: 40%; animation-delay: -1.3s; background: #ffa502; }
    .confetti:nth-child(12) { left: 50%; animation-delay: -1.6s; background: #3742fa; }
    .confetti:nth-child(13) { left: 60%; animation-delay: -1.9s; background: #ff4757; }
    .confetti:nth-child(14) { left: 70%; animation-delay: -2.2s; background: #7bed9f; }
    .confetti:nth-child(15) { left: 80%; animation-delay: -2.5s; background: #70a1ff; }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes confettiFall {
      0% {
        transform: translateY(-100vh) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
    
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(-10px);
      }
      60% {
        transform: translateY(-5px);
      }
    }
    
    @keyframes celebrationBounce {
      0% { 
        opacity: 0;
        transform: scale(0.3) translateY(-50px);
      }
      50% {
        transform: scale(1.05) translateY(-10px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
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
    
    // Set up cart callback for AI additions
    this.messageHandler.setCartCallback((productName: string, quantity: number) => {
      this.showCelebrationForProduct(productName);
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

ORDERING FLOW: When the user expresses intent to order something (e.g., "I want to order [anything]"), extract the exact product name or keyword from their request. Use the search_products tool with that query to get available products (each with id, name, price, isAvailable). Only consider available products. If products is empty or no available products, say "Sorry, I couldn't find any available products for [query]. What else can I help with?" 

When listing products, use natural conversational patterns:
- For single product: "I found [product name] for [price] rupees."
- For multiple products: "Great! I found these products: [first product name] for [price] rupees, and the second one is [second product name] for [price] rupees, and the third one is [third product name] for [price] rupees." 
- Continue with "and the fourth one is", "and the fifth one is" etc.
- Do NOT use numbered lists like "1.", "2.", "3." in your responses.
- After listing, ask "Which one would you like?"

Wait for the user to specify which one (by name or number). After selection, ask for the quantity (e.g., "How many would you like?"). After getting the quantity, use the add_to_cart tool with the productId, productName, and quantity. ALWAYS include the exact product name when calling add_to_cart. If the tool returns success: false with a message (e.g., "This item is out of stock"), say "Sorry, [product name] is out of stock. Would you like to try another product?" If successful, confirm with "I am adding <phoneme alphabet='ipa' ph='ˈɑːmul'>Amul</phoneme> to your cart now!" for Amul, or "I am adding [product name] to your cart now!" for others.

ADDITIONAL FLOW FOR MORE PRODUCTS: If the user says "more products," "add more," "other products," or similar, reset the current product selection and ask, "Awesome! What other product would you like to order?" Then restart the ordering flow with search_products. Do not reuse previous product IDs unless explicitly requested. After adding an item, always ask, "Would you like to add more items to your cart?"

MANUAL CART ADDITIONS: When you receive a tool response indicating a manual cart addition (source: "manual_ui_action"), acknowledge it warmly and ask if they want to continue shopping. For example: "Perfect! I can see you've added [product name] to your cart. That's ₹[price]. Would you like to add more products or proceed to checkout?"`
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
      
    }
  }

  private async addToCart(product: any, event: Event) {
    event.stopPropagation(); // Prevent product selection when clicking add to cart
    
    // Add loading state
    this.addingToCart.add(product.id);
    this.requestUpdate();
    
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

        // Notify AI about the manual cart addition
        this.notifyAIAboutCartAction(product);

        setTimeout(() => {
          this.showCelebration = false;
          this.requestUpdate();
        }, 3000);
        
        
      } else {
        this.updateError(`Failed to add ${product.name} to cart`);
      }
    } catch (error) {
      console.error("❌ Error adding to cart:", error);
      this.updateError(`Error adding ${product.name} to cart`);
    } finally {
      // Remove loading state
      this.addingToCart.delete(product.id);
      this.requestUpdate();
    }
  }

  private async notifyAIAboutCartAction(product: any) {
    try {
      if (this.session) {
        // Create a synthetic tool response to inform the AI about the manual cart addition
        const toolResponse = {
          functionResponses: [
            {
              id: `manual_cart_${Date.now()}`,
              name: "add_to_cart",
              response: {
                result: {
                  success: true,
                  message: `User manually added ${product.name} to cart`,
                  productName: product.name,
                  productId: product.id,
                  quantity: 1,
                  price: product.price,
                  source: "manual_ui_action"
                }
              }
            }
          ]
        };

        // Send the tool response to inform AI about the manual action
        this.session.sendToolResponse(toolResponse);
        
        
        
        // Give AI a moment to process, then provide acknowledgment
        setTimeout(() => {
          const acknowledgmentText = `Perfect! I can see you've added ${product.name} to your cart manually. That's ₹${product.price}. Would you like to add more products or shall we proceed to checkout?`;
          this.interruptAndBuffer(acknowledgmentText);
        }, 500);
      }
    } catch (error) {
      console.error("❌ Error notifying AI about cart action:", error);
      // Fallback acknowledgment if tool response fails
      const fallbackText = `Great! You've added ${product.name} to your cart. Would you like to continue shopping or proceed with your order?`;
      this.interruptAndBuffer(fallbackText);
    }
  }

  private showCelebrationForProduct(productName: string) {
    console.log('🎉 Showing celebration for product:', productName);
    this.addedProduct = productName;
    this.showCelebration = true;
    this.requestUpdate();

    // Auto-hide celebration after 3 seconds
    setTimeout(() => {
      this.showCelebration = false;
      this.requestUpdate();
    }, 3000);
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
                  <div style="position: relative;">
                    ${product.image ? html`
                      <img class="product-image" src="${product.image}" alt="${product.name}" />
                    ` : ''}
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">₹${product.price}</div>
                  </div>
                  <div class="product-actions">
                    <button class="add-cart-btn" 
                            @click=${(e: Event) => this.addToCart(product, e)}
                            ?disabled=${this.addingToCart.has(product.id)}>
                      ${this.addingToCart.has(product.id) ? '⏳ Adding...' : '🛒 Add to Cart'}
                    </button>
                  </div>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
        
        ${this.showCelebration ? html`
          <div class="celebration-overlay" @click=${this.hideCelebration}>
            <!-- Confetti elements -->
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            <div class="confetti"></div>
            
            <div class="celebration-card">
              <div class="celebration-icon">🎉</div>
              <div class="celebration-text">Added to Cart!</div>
              <div class="celebration-product">${this.addedProduct || 'Product'}</div>
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