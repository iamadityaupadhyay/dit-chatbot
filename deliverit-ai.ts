/**
 * Custom AI Assistant for DeliverIt
 * Created by Aditya Upadhyay
 * Specialized exclusively in DeliverIt services and team
 */

interface AudioResponse {
  text: string;
  audio?: string; // base64 encoded audio
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
      // Company Founders & Leadership
      'founder': 'DeliverIt was founded by visionary entrepreneurs who identified the need for ultra-fast hyperlocal delivery in Noida. The company was established with a mission to transform how people shop for essentials.',
      'founders': 'DeliverIt was founded by experienced business leaders who brought together expertise in technology, logistics, and customer service to create India\'s fastest grocery delivery platform.',
      'ashutosh sir': 'Ashutosh Sir is one of the key leaders and visionaries at DeliverIt. He brings extensive experience in business strategy, operations management, and scaling startups. His leadership drives DeliverIt\'s growth and ensures we maintain the highest service standards.',
      'kunal sir': 'Kunal Sir is a crucial leader at DeliverIt, specializing in technology innovation and product development. His technical expertise ensures our platform remains cutting-edge and user-friendly. He oversees the development of features that make DeliverIt the fastest delivery service.',
      'leadership': 'DeliverIt is led by an exceptional team including Ashutosh Sir and Kunal Sir, who together bring decades of experience in business development, technology, and operations to revolutionize hyperlocal delivery.',
      
      // The Beautiful Tech Team
      'tech team': 'DeliverIt has an absolutely beautiful and incredibly talented tech team that works around the clock to build and maintain our world-class delivery platform. Our developers, engineers, and designers are the backbone of our technological excellence.',
      'beautiful tech team': 'Our beautiful tech team is a group of passionate developers, UI/UX designers, data scientists, and software engineers who create the amazing technology that powers DeliverIt. They ensure seamless user experience and lightning-fast delivery coordination.',
      'technology': 'DeliverIt uses state-of-the-art technology including AI-powered route optimization, real-time inventory tracking, predictive analytics, and seamless mobile applications - all developed by our incredible tech team.',
      'developers': 'Our talented developers work with modern technologies like React, Node.js, Python, and cloud infrastructure to build robust, scalable systems that handle thousands of orders daily.',
      'team': 'DeliverIt has an incredible team including visionary leaders like Ashutosh Sir and Kunal Sir, plus our beautiful and brilliant tech team who make everything possible through their dedication and expertise.',
      
      // Company Information
      'about deliverit': 'DeliverIt is Noida\'s premier hyperlocal delivery service, specializing in delivering groceries and daily essentials within just 1 hour. We were founded with a vision to make shopping effortless for busy families and professionals.',
      'company': 'DeliverIt is a technology-driven company that revolutionizes how people shop for essentials. We provide instant delivery of over 500 carefully curated products including groceries, dairy, beverages, snacks, and regional specialties across Noida.',
      'mission': 'Our mission is to make essential shopping completely hassle-free and instant for every household in Noida, saving precious time and effort for our valued customers while maintaining the highest quality standards.',
      'vision': 'To become the most trusted and fastest delivery service in the entire NCR region, setting new benchmarks for hyperlocal commerce and customer satisfaction.',
      'location': 'DeliverIt currently serves customers across all major areas of Noida with plans for strategic expansion to other NCR cities. Our hyperlocal model ensures consistent delivery within 60 minutes.',
      'expansion': 'We are rapidly expanding our service areas within Noida and have ambitious plans to cover the entire NCR region, bringing our exceptional delivery service to more families.',
      
      // Special Products & Favorites
      'shilbatta chutney': 'Shilbatta chutney is one of our most popular regional specialty products! Made with traditional recipes using the finest ingredients, it\'s a customer favorite that represents authentic local flavors delivered fresh to your door.',
      'chutney': 'We deliver a variety of fresh, authentic chutneys including our famous shilbatta chutney, all made with traditional methods and premium ingredients sourced from trusted local suppliers.',
      'regional products': 'DeliverIt takes pride in offering authentic regional products like shilbatta chutney, connecting customers with traditional flavors and local specialties that are hard to find elsewhere.',
      
      // Services & Operations Excellence
      'services': 'DeliverIt offers comprehensive delivery services including fresh groceries, vegetables, dairy products, beverages, personal care items, household essentials, cleaning supplies, and beloved regional specialties like shilbatta chutney.',
      'products': 'Choose from our carefully curated selection of over 500 high-quality products including fresh groceries, organic vegetables, dairy items, beverages, snacks, personal care products, and local specialties.',
      'delivery time': 'We guarantee lightning-fast delivery within 60 minutes anywhere in our Noida service area. Most orders are delivered in just 30-45 minutes thanks to our efficient logistics and amazing team.',
      'speed': 'DeliverIt is the fastest delivery service in Noida! Our optimized logistics network and dedicated team ensure your orders reach you in record time.',
      'order': 'Ordering is incredibly simple! Just download the DeliverIt app or visit our website, browse our extensive catalog, add items to your cart, and get everything delivered to your doorstep in under an hour.',
      'app': 'The DeliverIt app provides a seamless shopping experience with intuitive design, real-time order tracking, multiple payment options, and instant customer support - all built by our beautiful tech team.',
      
      // Customer Experience Excellence
      'customer service': 'DeliverIt provides world-class 24x7 customer service. Our dedicated support team, backed by the expertise of our leadership including Ashutosh Sir and Kunal Sir, ensures every customer query is resolved quickly and satisfactorily.',
      'support': 'Our exceptional support team is always ready to help! Contact us through the app, website, or phone for instant assistance with orders, product queries, refunds, or any questions you might have.',
      'tracking': 'Experience real-time order tracking from our warehouse to your doorstep using our advanced tracking system developed by our talented tech team. You\'ll know exactly when your order will arrive.',
      'vpod': 'We use cutting-edge Visual Proof of Delivery (VPoD) technology to ensure 100% accurate delivery with photo confirmation, giving you complete peace of mind about your orders.',
      'quality assurance': 'Every product goes through our rigorous quality checks before delivery, ensuring you receive only the freshest and best items.',
      
      // Innovation & Technology
      'quality': 'DeliverIt maintains the highest quality standards for all products, from fresh groceries to specialty items like shilbatta chutney. Our quality team ensures every item meets our strict standards.',
      'innovation': 'Under the visionary leadership of Ashutosh Sir and Kunal Sir, DeliverIt continuously innovates in delivery technology, customer experience, inventory management, and service offerings.',
      'sustainability': 'We\'re deeply committed to sustainable practices, using eco-friendly packaging, optimizing delivery routes to reduce carbon footprint, and supporting local suppliers and communities.',
      'efficiency': 'Our beautiful tech team has developed highly efficient systems for inventory management, route optimization, and order processing that make us the fastest delivery service in the region.',
      
      // Culture & Values
      'culture': 'DeliverIt has a vibrant, customer-first culture where every team member, from our leadership to our beautiful tech team, is passionate about delivering excellence and making customers\' lives easier.',
      'values': 'Our core values include speed, quality, customer satisfaction, innovation, and community support. These values guide everything we do at DeliverIt.',
      'awards': 'DeliverIt has been recognized for its exceptional service quality, technological innovation, and contribution to the local economy in Noida.',
      
      // General Responses
      'greeting': 'Hello! I\'m your DeliverIt AI assistant, created by Aditya Upadhyay. I\'m here to help you with everything about our amazing 1-hour delivery service in Noida, our wonderful leadership team, our beautiful tech team, and our extensive product range including specialties like shilbatta chutney!',
      'creator': 'I was specifically created by Aditya Upadhyay for DeliverIt. I\'m designed to help you learn about our fantastic delivery service, our visionary leadership team including Ashutosh Sir and Kunal Sir, our beautiful tech team, and all our amazing products and services.',
      'who made you': 'I was created by Aditya Upadhyay as a specialized AI assistant for DeliverIt. I\'m not made by Google - I\'m your dedicated DeliverIt assistant, designed to help you with everything related to our amazing delivery service, team, and products.',
      'who built you': 'I was built by Aditya Upadhyay specifically for DeliverIt to help customers learn about our incredible 1-hour delivery service, our leadership including Ashutosh Sir and Kunal Sir, our beautiful tech team, and our full range of products.',
      'redirect': 'I specialize exclusively in everything DeliverIt! Please ask me about our lightning-fast delivery service, our amazing leadership team, our beautiful tech team, specialty products like shilbatta chutney, how to place orders, or anything else related to DeliverIt!'
    };
  }

  private findBestMatch(input: string): string {
    const lowercaseInput = input.toLowerCase();

    // Handle greetings
    if (lowercaseInput.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
      return this.knowledgeBase['greeting'];
    }

    // Handle creator questions with specific response
    if (
      lowercaseInput.includes('who made you') ||
      lowercaseInput.includes('who created you') ||
      lowercaseInput.includes('who built you') ||
      lowercaseInput.includes('your creator') ||
      lowercaseInput.includes('made by google') ||
      lowercaseInput.includes('google made')
    ) {
      return this.knowledgeBase['who made you'];
    }

    // Find the best matching knowledge
    let bestMatch = '';
    let bestScore = 0;

    for (const [key, response] of Object.entries(this.knowledgeBase)) {
      const keywords = key.split(' ');
      let score = 0;

      keywords.forEach(keyword => {
        if (lowercaseInput.includes(keyword.toLowerCase())) {
          score += keyword.length; // Longer matches get higher scores
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = response;
      }
    }

    // If no good match found, return redirect message
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

      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 0.8;

      utterance.onend = () => {
        resolve('audio_complete');
      };

      utterance.onerror = (error) => {
        reject(error);
      };

      this.speechSynthesis.speak(utterance);
    });
  }

  stopSpeaking() {
    this.speechSynthesis.cancel();
  }
}
