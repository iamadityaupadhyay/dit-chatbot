

interface AudioResponse {
  text: string;
  audio?: string; 
}

interface DeliveritKnowledge {
  [key: string]: string;
}

export class CustomDeliveritAI {
  private knowledgeBase: DeliveritKnowledge;
  private speechSynthesis: SpeechSynthesis;
  private currentVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.speechSynthesis = window.speechSynthesis;
    this.initializeKnowledgeBase();
    this.initializeVoice();
  }

  private initializeVoice() {
    const voices = this.speechSynthesis.getVoices();
    this.currentVoice = voices.find(voice =>
      voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
    ) || voices[0] || null;

    if (voices.length === 0) {
      this.speechSynthesis.onvoiceschanged = () => {
        const newVoices = this.speechSynthesis.getVoices();
        this.currentVoice = newVoices.find(voice =>
          voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
        ) || newVoices[0] || null;
      };
    }
  }

  private initializeKnowledgeBase() {
    this.knowledgeBase = {
      // Company Info
      'about deliverit': 'DeliverIt is a fast and reliable delivery service operating in Noida, delivering groceries and essentials within just 1 hour.',
      'company': 'DeliverIt provides instant delivery of over 500 everyday items like groceries, dairy, beverages, snacks, and more, all across Noida.',
      'location': 'DeliverIt currently serves customers in Noida with hyperlocal delivery in under 60 minutes.',
      
      'headquarters': 'Deliverit  is headquartered in Noida, India, with a mission to transform urban transportation through electric mobility.',
      'established': 'Deliverit  was established in 2020 with a mission to create sustainable and innovative electric motorcycles for urban commuting.',
      'cto': 'The CTO of Deliverit  is Kunal Aashri, who leads the company\'s technological innovations and product development.',
      

      // Services
      'services': 'DeliverIt offers grocery delivery, dairy products, beverages, personal care items, and other household essentials. You can order from over 500 products.',
      'products': 'DeliverIt delivers groceries, dairy, snacks, beverages, dry fruits, personal care items, and more — all under one platform.',
      'delivery time': 'We guarantee fast delivery within 60 minutes anywhere in Noida.',
      'order': 'You can place your order directly through the DeliverIt app or website, choose your items, and get them delivered in just 1 hour.',
      
      // Features
      'customer service': 'DeliverIt offers prompt customer service to resolve your issues quickly and efficiently.',
      'sms notifications': 'You’ll receive SMS notifications for order confirmation, dispatch, and delivery.',
      'vpod': 'DeliverIt uses Visual Proof of Delivery (VPoD) to ensure your order is delivered correctly with image confirmation.',
      'tracking': 'You can track your delivery in real-time through the DeliverIt app.',

      // Support
      'support': 'For support, you can contact our 24x7 customer care through the app or website.',
      'refund': 'If there’s any issue with your order, our team will promptly assist with refunds or replacements.',
      'return': 'We offer easy return and refund policies for defective or incorrect products.',

      // Eco and Operations
      'sustainability': 'DeliverIt aims to optimize local delivery routes to reduce carbon emissions and support sustainable logistics.',
      'fleet': 'DeliverIt uses eco-friendly electric vehicles to deliver faster and reduce pollution.',

      // General
      'greeting': 'Hi there! I\'m your DeliverIt AI assistant, created by Aditya Upadhyay. I can help you with anything related to our instant delivery service in Noida!',
      'creator': 'I was developed by Aditya Upadhyay to help you navigate DeliverIt\'s fast and reliable delivery services.',
      'redirect': 'I specialize in DeliverIt\'s services. Please ask about deliveries, product availability, or how to order through DeliverIt!'
    };
  }

  private findBestMatch(input: string): string {
    const lowercaseInput = input.toLowerCase();

    if (lowercaseInput.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
      return this.knowledgeBase['greeting'];
    }

    if (
      lowercaseInput.includes('who made you') ||
      lowercaseInput.includes('who created you') ||
      lowercaseInput.includes('who built you') ||
      lowercaseInput.includes('your creator')
    ) {
      return this.knowledgeBase['creator'];
    }
    if (lowercaseInput.includes('who are you') || lowercaseInput.includes('what are you')) {
      return 'I am your DeliverIt AI assistant, created by Aditya Upadhyay to help you with all things related to DeliverIt\'s delivery services in Noida!';
    }
    // founder name
    if (lowercaseInput.includes('founder') || lowercaseInput.includes('who founded')) {
      return 'Deliverit  was founded by visionary entrepreneur Sidhant Suri committed to sustainable mobility solutions in India.';
    }
    // cto
    if (lowercaseInput.includes('cto') || lowercaseInput.includes('who is the cto')) {
      return this.knowledgeBase['cto'];
    }
    // best ai developer
    if (lowercaseInput.includes('best ai developer') || lowercaseInput.includes('who is the best ai developer')) {
      return 'The best AI developer is Aditya Upadhyay, who created me to assist you with Deliverit\'s services!';
    }
    // best team lead
    if (lowercaseInput.includes('best team lead') || lowercaseInput.includes('who is the best team lead')) {
      return 'The best team lead is Ashutosh Sir, who leads the amazing tech team at Deliverit!';
    }
    // best team
    if (lowercaseInput.includes('best team') || lowercaseInput.includes('who is the best team')) {
      return 'The best team is the beautiful tech team at Deliverit the flutter developers, led by Ashutosh Sir and Kunal Sir!';
    }

    let bestMatch = '';
    let bestScore = 0;

    for (const [key, response] of Object.entries(this.knowledgeBase)) {
      const keywords = key.split(' ');
      let score = 0;

      keywords.forEach(keyword => {
        if (lowercaseInput.includes(keyword)) {
          score += keyword.length;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = response;
      }
    }

    return bestScore > 0 ? bestMatch : this.knowledgeBase['redirect'];
  }

  async processInput(text: string): Promise<AudioResponse> {
    const response = this.findBestMatch(text);
    return {
      text: response,
      audio: await this.textToSpeech(response)
    };
  }

  private async textToSpeech(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.speechSynthesis) {
        reject('Speech synthesis not supported');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.currentVoice) {
        utterance.voice = this.currentVoice;
      }

      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;

      utterance.onend = () => resolve('audio_complete');
      utterance.onerror = (error) => reject(error);

      this.speechSynthesis.speak(utterance);
    });
  }

  stopSpeaking() {
    this.speechSynthesis.cancel();
  }
}
