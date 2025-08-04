# DeliverIt AI Backend Server

A secure Node.js/Express backend server for the DeliverIt AI Assistant, created by Aditya Upadhyay.

## Features

- **Secure API Key Management**: Google Gemini API key stored server-side
- **RESTful API**: Clean endpoints for chat, audio, and company information
- **WebSocket Support**: Real-time communication for audio streaming
- **CORS Configured**: Proper cross-origin resource sharing
- **Error Handling**: Comprehensive error handling and logging
- **DeliverIt Focused**: Specialized in DeliverIt company information

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy your Gemini API key from the main `.env.local` file
   - Update the `.env` file with your API key:
```
GEMINI_API_KEY=your_actual_api_key_here
```

4. Start the server:
```bash
npm start
```

## API Endpoints

### Health Check
- **GET** `/health`
- Returns server status and information

### Chat API
- **POST** `/api/chat`
- Body: `{ "message": "your message", "history": [] }`
- Returns AI response from DeliverIt assistant

### Audio API
- **POST** `/api/audio`
- Body: `{ "audioData": "base64_audio_data", "format": "wav" }`
- For future audio processing features

### Company Info
- **GET** `/api/company`
- Returns DeliverIt company information

## WebSocket

Connect to `ws://localhost:3001` for real-time features:
- Audio streaming
- Real-time chat
- Live updates

## Security Features

- API key protection (server-side only)
- CORS configuration
- Request size limits
- Error handling
- Rate limiting ready

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

## Created By

**Aditya Upadhyay** - AI Developer  
Backend architecture for DeliverIt AI Assistant

## DeliverIt Team

- **Founder**: Sidhant Suri
- **CTO**: Kunal Aashri
- **Best Team**: Flutter developers led by Ashutosh Sir and Kunal Sir
- **AI Developer**: Aditya Upadhyay

## Next Steps

1. Start the backend server
2. Update frontend to use backend endpoints
3. Move API key to backend environment
4. Test secure communication
