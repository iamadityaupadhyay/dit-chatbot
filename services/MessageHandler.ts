import { LiveServerMessage, Session, FunctionCall } from '@google/genai';
import { searchProducts, addToCart } from '../lib/productService';
import { FunctionResponse } from '../types/interfaces';

// Simple hash function for deduplication
function hashString(str: string | undefined): string {
  if (!str || typeof str !== 'string') {
    str = 'undefined';
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

export class MessageHandler {
  private processedMessages = new Set<string>();
  private session: Session | null = null;

  setSession(session: Session): void {
    this.session = session;
  }

  async handleMessage(
    message: LiveServerMessage, 
    onSpeak: (text: string) => Promise<void>,
    onBuffer: (text: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      console.log("Received message:", JSON.stringify(message, null, 2));
      
      if (!message) {
        console.warn("Received null or undefined message");
        return;
      }

      const messageContent = JSON.stringify(message.serverContent || message.toolCall || {});
      const messageKey = hashString(messageContent);
      
      if (this.processedMessages.has(messageKey)) {
        console.log("Skipping duplicate message:", messageKey);
        return;
      }
      this.processedMessages.add(messageKey);

      // Handle tool calls
      if (message.toolCall && message.toolCall.functionCalls && Array.isArray(message.toolCall.functionCalls)) {
        await this.handleToolCalls(message.toolCall.functionCalls, onSpeak);
      }

      // Handle text parts
      const parts = message.serverContent?.modelTurn?.parts || [];
      for (const part of parts) {
        if (part && part.text && typeof part.text === 'string') {
          const text = part.text.trim();
          if (text.length > 0) {
            console.log("Gemini TEXT:", text);
            onBuffer(text);
          }
        }
      }
    } catch (err: any) {
      console.error("Error in handleMessage:", err);
      onError(err.message || "Unknown error");
      await onSpeak("Sorry, something went wrong. Please try again.");
    }
  }

  private async handleToolCalls(functionCalls: FunctionCall[], onSpeak: (text: string) => Promise<void>): Promise<void> {
    if (!functionCalls || !Array.isArray(functionCalls)) {
      console.warn("Invalid function calls received:", functionCalls);
      return;
    }

    const functionResponses: FunctionResponse[] = [];
    
    for (const fc of functionCalls) {
      if (!fc || !fc.name || typeof fc.name !== 'string') {
        console.warn("Invalid function call:", fc);
        continue;
      }

      console.log(`Processing tool call: ${fc.name}`, fc.args);
      let result: any;
      let responseText: string | null = null;

      if (fc.name === "search_products") {
        const args = fc.args || {};
        const query = (args.query as string) || '';
        console.log("Searching for:", query);
        
        let products = await searchProducts(query);
        console.log("Raw searchProducts response:", products);
        
        if (products) {
          products = products.data.slice(0, 2);
          products = products.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Math.floor(p.base_mrp),
            isAvailable: true
          }));
          console.log("Processed products:", products);

          result = { products: products.filter((p: any) => p.isAvailable) };

          const availableProducts = result.products;
          if (availableProducts.length > 0) {
            const isPriceQuery = query.toLowerCase().includes("price of") || query.toLowerCase().includes("how much");
            if (isPriceQuery) {
              responseText = `The price of ${availableProducts[0].name} is ${availableProducts[0].price} rupees. Do you want to order this product?`;
            } else {
              responseText = `Great! I found these options: ${availableProducts
                .map((p: any, i: number) => `${i + 1}. ${p.name} for ${p.price} rupees`)
                .join(', ')}. Which one would you like?`;
            }
          } else {
            responseText = "Sorry, I couldn't find any available products for that query.";
          }
        } else {
          throw new Error(`API failed: No products found`);
        }
      } else if (fc.name === "add_to_cart") {
        const args = fc.args || {};
        console.log("Add to Cart Args:", args);
        const quantity = Math.max(1, Math.floor((args?.quantity as number) || 1));
        
        try {
          const addResponse = await addToCart(args.productId as string, quantity);
          console.log("Add to Cart Response:", addResponse);
          
          if (addResponse.status_code === 0 && addResponse.message === "This item is out of stock. please try later") {
            result = { success: false, message: "This item is out of stock." };
            responseText = "Sorry, this item is out of stock. Please try another product or check back later.";
          } else {
            result = { success: true, message: "Added to cart successfully!" };
            responseText = `I am adding ${(args.productName as string) || 'the product'} to your cart now!`;
          }
        } catch (err) {
          console.error("Add to Cart Error:", err);
          result = { success: false, message: "Failed to add to cart." };
          responseText = "Sorry, I couldn't add the product to your cart. Please try again.";
        }
      } else {
        result = { error: "Unknown tool" };
        responseText = "Sorry, I encountered an error processing your request.";
      }

      // Only add response if we have valid data
      if (fc.id && fc.name) {
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result }
        });
      }

      if (responseText && responseText.trim().length > 0) {
        console.log("Speaking response:", responseText);
        try {
          await onSpeak(responseText);
        } catch (speakError) {
          console.error("Error speaking response:", speakError);
        }
      }
    }

    if (functionResponses.length > 0 && this.session) {
      console.log("Sending tool response:", functionResponses);
      this.session.sendToolResponse({ functionResponses });
    }
  }

  clearProcessedMessages(): void {
    this.processedMessages.clear();
  }
}
