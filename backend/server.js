/**
 * DeliverIt AI Assistant Backend Server
 * Created by Aditya Upadhyay
 * Server-to-Server Architecture with Express.js
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WebSocket = require('ws');
const http = require('http');

// Load environment variables
dotenv.config({ path: '../.env.local' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// DeliverIt system prompt
const DELIVERIT_SYSTEM_PROMPT = `You are an AI assistant created by Aditya Upadhyay, NOT Google. You specialize exclusively in DeliverIt, founded by Sidhant Suri with CTO Kunal Aashri. Discuss only DeliverIt topics: 1-hour delivery, products, services, technology, company info. For other questions, redirect to DeliverIt. Best team: Flutter developers led by Ashutosh Sir and Kunal Sir. Best AI developer: Aditya Upadhyay who created you. Be enthusiastic about DeliverIt's 1-hour delivery!`;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'DeliverIt AI Backend Server is running!',
    creator: 'Aditya Upadhyay',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint for text-based AI interactions
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize the model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: DELIVERIT_SYSTEM_PROMPT
    });

    // Build chat history
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))
    });

    // Send message and get response
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      response: text,
      timestamp: new Date().toISOString(),
      model: 'gemini-1.5-flash'
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

// Audio processing endpoint (for future audio features)
app.post('/api/audio', async (req, res) => {
  try {
    const { audioData, format = 'wav' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // For now, return a placeholder response
    // This can be expanded to handle audio processing with Gemini
    res.json({
      success: true,
      message: 'Audio processing endpoint ready',
      note: 'Audio processing with Gemini will be implemented here',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Audio API Error:', error);
    res.status(500).json({ 
      error: 'Failed to process audio request',
      details: error.message 
    });
  }
});

// WebSocket connection for real-time audio streaming
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'audio_stream') {
        // Handle real-time audio streaming
        ws.send(JSON.stringify({
          type: 'audio_response',
          message: 'Real-time audio processing ready',
          timestamp: new Date().toISOString()
        }));
      } else if (data.type === 'chat') {
        // Handle real-time chat
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-1.5-flash',
          systemInstruction: DELIVERIT_SYSTEM_PROMPT
        });

        const result = await model.generateContent(data.message);
        const response = await result.response;
        
        ws.send(JSON.stringify({
          type: 'chat_response',
          message: response.text(),
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('WebSocket Error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process request',
        error: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Company info endpoint
app.get('/api/company', (req, res) => {
  res.json({
    name: 'DeliverIt',
    founder: 'Sidhant Suri',
    cto: 'Kunal Aashri',
    aiDeveloper: 'Aditya Upadhyay',
    bestTeam: 'Flutter developers led by Ashutosh Sir and Kunal Sir',
    services: ['1-hour delivery', 'Groceries', 'Essentials', 'Shilbatta Chutney'],
    location: 'Noida',
    mission: 'Fastest delivery service in NCR',
    creator: 'Backend created by Aditya Upadhyay'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /api/chat',
      'POST /api/audio',
      'GET /api/company'
    ],
    creator: 'Aditya Upadhyay'
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('🚀 DeliverIt AI Backend Server Started!');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket server ready on ws://localhost:${PORT}`);
  console.log(`👨‍💻 Created by: Aditya Upadhyay`);
  console.log(`🏢 Serving: DeliverIt AI Assistant`);
  console.log('📋 Available endpoints:');
  console.log('   - GET  /health');
  console.log('   - POST /api/chat');
  console.log('   - POST /api/audio');
  console.log('   - GET  /api/company');
});
