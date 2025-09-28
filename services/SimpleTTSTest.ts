// Simple TTS test to check if the basic functionality works
export class SimpleTTSTest {
  static async testBasicTTS(): Promise<void> {
    console.log("🧪 Testing basic TTS functionality...");
    
    try {
      // Test if we can create audio contexts
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      console.log("✅ Audio context created successfully:", audioContext.state);
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log("✅ Audio context resumed:", audioContext.state);
      }
      
      // Test if we can use the browser's built-in speech synthesis as fallback
      if ('speechSynthesis' in window) {
        console.log("✅ Browser speech synthesis available");
        const utterance = new SpeechSynthesisUtterance("Testing speech synthesis");
        utterance.onstart = () => console.log("🔊 Speech started");
        utterance.onend = () => console.log("🔊 Speech ended");
        utterance.onerror = (e) => console.error("❌ Speech error:", e);
        
        // Test browser TTS
        speechSynthesis.speak(utterance);
      } else {
        console.warn("⚠️ Browser speech synthesis not available");
      }
      
    } catch (error) {
      console.error("❌ TTS test failed:", error);
    }
  }
}

// Auto-run test
if (typeof window !== 'undefined') {
  SimpleTTSTest.testBasicTTS();
}
