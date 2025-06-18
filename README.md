# MCP Voice Agent

A voice-enabled personal assistant that combines web search capabilities with personal database access through MCP (Model Context Protocol). The agent can intelligently route queries between Firecrawl web search and Supabase database operations.

## Features

- **Voice Interface**: Real-time speech-to-text and text-to-speech using LiveKit
- **Intelligent Routing**: Automatically routes queries to appropriate data sources
- **Web Search**: Current events, news, and general information via Firecrawl
- **Personal Database**: Tasks, notes, contacts, and personal data via Supabase MCP
- **Multi-tool Integration**: Seamlessly combines multiple data sources

## Prerequisites

- Python 3.8+
- Node.js (for Supabase MCP server)
- LiveKit account and credentials
- Firecrawl API key
- Supabase access token

## Installation

1. Clone the repository:
```bash
git clone https://github.com/iyuldashev/mcp-voice-agent.git
cd mcp-voice-agent
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with your credentials:
```bash
# LiveKit Configuration
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Firecrawl API Key
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Supabase Access Token
SUPABASE_ACCESS_TOKEN=your_supabase_token
```

## Configuration

### LiveKit Setup
1. Sign up at [LiveKit Cloud](https://cloud.livekit.io)
2. Create a new project
3. Copy your URL, API Key, and API Secret to `.env`

### Firecrawl Setup
1. Get your API key from [Firecrawl](https://firecrawl.dev)
2. Add it to your `.env` file

### Supabase Setup
1. Create a Supabase project
2. Generate an access token
3. Add it to your `.env` file

## Usage

Run the voice agent:
```bash
python agent.py
```

The agent will:
- Connect to LiveKit for voice processing
- Initialize Supabase MCP server for database access
- Start listening for voice commands

## Query Routing

The agent automatically routes queries based on context:

**Database Queries** (Supabase):
- "Show me my tasks"
- "Add a new contact"
- "What are my recent expenses?"
- "Update my notes"

**Web Search** (Firecrawl):
- "What's the weather today?"
- "Latest news about AI"
- "Current stock prices"
- "What happened in the world today?"

## Architecture

```
Voice Input → LiveKit STT → OpenAI LLM → Tool Selection → Data Source
                                           ↓
                                      Firecrawl (Web) / Supabase (Database)
                                           ↓
                                      Response → LiveKit TTS → Voice Output
```

## Tools Available

### Web Search
- `firecrawl_search`: Search the web for current information

### Database Operations (via Supabase MCP)
- `list_tables`: View available database tables
- `query_database`: Execute SQL queries
- `insert_data`: Add new records
- `update_data`: Modify existing records
- And more based on your Supabase setup

## Error Handling

The agent includes comprehensive error handling:
- SSL certificate issues are automatically resolved
- Fallback to web-search-only mode if database is unavailable
- Detailed logging for troubleshooting
- User-friendly error messages

## Development

### Adding New Tools
1. Create a new function decorated with `@function_tool`
2. Add it to the tools list in `entrypoint()`
3. Update the agent instructions if needed

### Modifying Query Routing
Edit the agent instructions in `entrypoint()` to change how queries are routed between tools.

## Troubleshooting

### Common Issues

**SSL Certificate Errors**:
- The code includes comprehensive SSL fixes
- Certificates are automatically configured

**Database Connection Failed**:
- Check your `SUPABASE_ACCESS_TOKEN`
- Ensure Node.js is installed for MCP server
- Agent will fallback to web-search-only mode

**Voice Issues**:
- Verify LiveKit credentials
- Check microphone permissions
- Ensure stable internet connection

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Open an issue on GitHub
- Check the logs for detailed error information
- Ensure all environment variables are properly set