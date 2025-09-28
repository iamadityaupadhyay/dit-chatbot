import { LiveServerMessage, Session } from '@google/genai';
import { searchProducts, addToCart } from '../lib/productService';

export class MessageHandler {
  private session: Session | null = null;
  private onProductsReceived?: (products: any[]) => void;

  setSession(session: Session): void {
    this.session = session;
  }

  setProductCallback(callback: (products: any[]) => void): void {
    this.onProductsReceived = callback;
  }

  async handleMessage(
    message: LiveServerMessage,
    onTextReceived: (text: string) => void,
    onError: (error: string) => void,
    onProductsReceived?: (products: any[]) => void
  ): Promise<void> {
    console.log("📨 Received message:", JSON.stringify(message, null, 2));
    
    try {
      // Handle tool calls
      if (message.toolCall && message.toolCall.functionCalls) {
        await this.handleToolCalls(message.toolCall.functionCalls);
      }

      // Handle text parts
      const parts = message.serverContent?.modelTurn?.parts || [];
      for (const part of parts) {
        if (part && part.text && typeof part.text === 'string') {
          const text = part.text.trim();
          if (text.length > 0) {
            console.log("📝 Gemini TEXT:", text);
            onTextReceived(text);
          }
        }
      }
    } catch (err: any) {
      console.error("❌ Error in handleMessage:", err);
      onError(err.message || "Unknown error");
    }
  }

  private async handleToolCalls(functionCalls: any[]): Promise<void> {
    if (!functionCalls || !Array.isArray(functionCalls)) {
      console.warn("⚠️ Invalid function calls received:", functionCalls);
      return;
    }

    const functionResponses = [];

    for (const fc of functionCalls) {
      if (!fc || !fc.name || typeof fc.name !== 'string') {
        console.warn("⚠️ Invalid function call:", fc);
        continue;
      }

      console.log(`🔧 Processing tool call: ${fc.name}`, fc.args);
      let result: any;

      try {
        if (fc.name === "search_products") {
          result = await this.handleSearchProducts(fc.args, this.onProductsReceived);
        } else if (fc.name === "add_to_cart") {
          result = await this.handleAddToCart(fc.args);
        } else {
          result = { error: "Unknown tool" };
          console.warn(`⚠️ Unknown tool: ${fc.name}`);
        }

        if (fc.id && fc.name) {
          functionResponses.push({
            id: fc.id,
            name: fc.name,
            response: { result }
          });
        }
      } catch (error: any) {
        console.error(`❌ Error handling ${fc.name}:`, error);
        if (fc.id && fc.name) {
          functionResponses.push({
            id: fc.id,
            name: fc.name,
            response: { result: { error: error.message || "Tool execution failed" } }
          });
        }
      }
    }

    if (functionResponses.length > 0 && this.session) {
      console.log("📤 Sending tool response:", functionResponses);
      this.session.sendToolResponse({ functionResponses });
    }
  }

  private async handleSearchProducts(args: any, onProductsReceived?: (products: any[]) => void): Promise<any> {
    const query = (args?.query as string) || '';
    console.log("🔍 Searching for:", query);
    
    if (!query.trim()) {
      return { products: [], message: "Search query is empty" };
    }

    const products = await searchProducts(query);
    console.log("📦 Raw searchProducts response:", products);
    
    if (products && products.data && products.data.length > 0) {
        console.log("✅ Products found:", products.data[0].product_images);
      const processedProducts = products.data.slice(0, 2).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Math.round(p.base_mrp),
        isAvailable: true,
        image: p.product_images[0]?.path || null
      }));
      
      console.log("✅ Processed products:", processedProducts);
      const availableProducts = processedProducts.filter((p: any) => p.isAvailable);
      
      // Show products in UI
      if (onProductsReceived && availableProducts.length > 0) {
        onProductsReceived(availableProducts);
      }
      
      return { products: availableProducts };
    } else {
      return { products: [], message: `No available products found for "${query}"` };
    }
  }

  private async handleAddToCart(args: any): Promise<any> {
    console.log("🛒 Add to Cart Args:", args);
    
    if (!args?.productId) {
      return { success: false, message: "Product ID is required" };
    }

    const quantity = Math.max(1, Math.floor(Number(args?.quantity) || 1));
    
    try {
      const addResponse = await addToCart(args.productId, quantity);
      console.log("📋 Add to Cart Response:", addResponse);
      
      if (addResponse.status_code === 0 && addResponse.message === "This item is out of stock. please try later") {
        return { success: false, message: "This item is out of stock." };
      } else {
        return { 
          success: true, 
          message: `Added ${args.productName || 'product'} to cart successfully`,
          quantity: quantity
        };
      }
    } catch (err: any) {
      console.error("❌ Add to Cart Error:", err);
      return { 
        success: false, 
        message: `Failed to add ${args.productName || 'product'} to cart: ${err.message}` 
      };
    }
  }
}
