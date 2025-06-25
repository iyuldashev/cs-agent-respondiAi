# CS Agent - RespondiAI (Demo)

🚧 **Work in Progress** - This is an early demo version of AI-powered customer support agents with voice interface capabilities.

## Features (Demo)
- Voice-enabled customer support agent
- Real-time audio processing using LiveKit
- Web-based frontend interface
- MCP (Model Context Protocol) integration
- Intelligent query routing between web search and database

## Quick Start
```bash
# Backend
pip install -r requirements.txt
python agent.py

# Frontend (optional)
cd frontend
npm install
npm run dev
```

## Tech Stack
- Python (Backend agent)
- Next.js (Frontend)
- LiveKit (Voice handling)
- MCP Protocol
- Firecrawl (Web search)
- Supabase (Database)

## Configuration
Create a `.env` file with your API keys:
```bash
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
FIRECRAWL_API_KEY=your_firecrawl_api_key
SUPABASE_ACCESS_TOKEN=your_supabase_token
```

---
*This is a demonstration project and not production-ready.*