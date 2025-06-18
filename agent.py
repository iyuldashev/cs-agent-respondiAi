"""
MCP voice agent that routes queries either to Firecrawl web search or to Supabase via MCP.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
from typing import Any, Callable, List, Optional
import ssl
import certifi
import urllib.parse

import inspect
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from pydantic_ai.mcp import MCPServerStdio

# COMPREHENSIVE SSL FIX
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Multiple SSL context fixes
ssl._create_default_https_context = ssl._create_unverified_context

# Set certificate bundle
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

# Configure SSL context
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import assemblyai, openai

# ------------------------------------------------------------------------------
# Configuration & Logging
# ------------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
SUPABASE_TOKEN = os.getenv("SUPABASE_ACCESS_TOKEN")
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY") 
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

if not FIRECRAWL_API_KEY:
    logger.error("FIRECRAWL_API_KEY is not set in environment.")
    raise EnvironmentError("Please set FIRECRAWL_API_KEY env var.")

if not SUPABASE_TOKEN:
    logger.error("SUPABASE_ACCESS_TOKEN is not set in environment.")
    raise EnvironmentError("Please set SUPABASE_ACCESS_TOKEN env var.")

if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
    logger.warning("LiveKit credentials not fully configured.")
    logger.warning("Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET")
    logger.warning("You can get these from https://cloud.livekit.io")

# Initialize Firecrawl with SSL context
firecrawl_app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)


def _py_type(schema: dict) -> Any:
    """Convert JSON schema types into Python typing annotations."""
    t = schema.get("type")
    mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "object": dict,
    }

    if isinstance(t, list):
        if "array" in t:
            return List[_py_type(schema.get("items", {}))]
        t = t[0]

    if isinstance(t, str) and t in mapping:
        return mapping[t]
    if t == "array":
        return List[_py_type(schema.get("items", {}))]

    return Any


@function_tool
async def firecrawl_search(
    context: RunContext,
    query: str,
    limit: int = 3
) -> str:
    """
    Search the web via Firecrawl. Use this for current events, news, external information, or anything not in the personal database.

    Args:
        context (RunContext): LiveKit runtime context.
        query (str): Search query string.
        limit (int): Maximum pages to crawl (default 3 for faster response).

    Returns:
        str: Search results from the web.
    """
    # Properly encode the query for URL
    encoded_query = urllib.parse.quote(query)
    
    logger.info("🔍 Searching web for: %s", query)

    loop = asyncio.get_event_loop()
    try:
        # Try to use Firecrawl's search endpoint if available
        # Otherwise, use crawl with Google search URL
        result = await loop.run_in_executor(
            None,
            lambda: firecrawl_app.search(query, {"limit": limit})
            if hasattr(firecrawl_app, 'search')
            else firecrawl_app.crawl_url(
                f"https://www.google.com/search?q={encoded_query}",
                {
                    "limit": limit,
                    "scrapeOptions": {
                        "formats": ["markdown", "text"],
                        "onlyMainContent": True
                    }
                }
            )
        )
        
        logger.info("✅ Firecrawl returned results")
        
        # Handle different response formats
        if isinstance(result, dict) and 'data' in result:
            # Handle search API response
            results = result.get('data', [])
            if results:
                combined_text = "\n\n".join([
                    f"**Source {i+1}: {r.get('title', 'Unknown')}**\n{r.get('content', r.get('text', ''))[:500]}..."
                    for i, r in enumerate(results[:3])
                ])
                return f"Web search results for '{query}':\n\n{combined_text}"
        elif isinstance(result, list):
            # Handle crawl response
            if result:
                combined_text = "\n\n".join([
                    f"**Result {i+1}:**\n{page.get('markdown', page.get('content', ''))[:500]}..."
                    for i, page in enumerate(result[:3])
                ])
                return f"Web search results for '{query}':\n\n{combined_text}"
        
        return f"No web results found for '{query}'"
            
    except Exception as e:
        logger.error("❌ Firecrawl search failed: %s", e, exc_info=True)
        # Provide a more helpful error message
        if "401" in str(e) or "unauthorized" in str(e).lower():
            return f"Web search failed: Invalid API key. Please check your FIRECRAWL_API_KEY."
        elif "rate limit" in str(e).lower():
            return f"Web search failed: Rate limit exceeded. Please try again later."
        else:
            return f"Web search temporarily unavailable. Error: {str(e)}"


async def build_livekit_tools(server: MCPServerStdio) -> List[Callable]:
    """
    Build LiveKit tools from a Supabase MCP server.
    """
    tools: List[Callable] = []
    
    try:
        all_tools = await server.list_tools()
        logger.info("🔧 Found %d MCP tools", len(all_tools))
    except Exception as e:
        logger.error("❌ Failed to list MCP tools: %s", e)
        return tools

    for td in all_tools:
        if td.name == "deploy_edge_function":
            logger.warning("⚠️ Skipping tool %s", td.name)
            continue

        schema = copy.deepcopy(td.parameters_json_schema)
        
        # Handle list_tables special case
        if td.name == "list_tables":
            props = schema.setdefault("properties", {})
            props["schemas"] = {
                "type": ["array", "null"],
                "items": {"type": "string"},
                "default": []
            }
            schema["required"] = [r for r in schema.get("required", []) if r != "schemas"]

        props = schema.get("properties", {})
        required = set(schema.get("required", []))

        def make_proxy(
            tool_def=td,
            _props=props,
            _required=required,
            _schema=schema
        ) -> Callable:
            async def proxy(context: RunContext, **kwargs):
                # Convert None → [] for array params
                for k, v in list(kwargs.items()):
                    if k in _props and ((_props[k].get("type") == "array"
                         or "array" in (_props[k].get("type") or []))
                            and v is None):
                        kwargs[k] = []

                logger.info("🔍 Using Supabase tool: %s with args: %s", tool_def.name, kwargs)
                
                try:
                    response = await server.call_tool(tool_def.name, arguments=kwargs or None)
                    
                    # Handle different response types
                    if isinstance(response, list):
                        return response
                    elif isinstance(response, dict):
                        return response
                    elif hasattr(response, "content") and response.content:
                        # Handle MCP response format
                        if len(response.content) > 0 and hasattr(response.content[0], "text"):
                            text = response.content[0].text
                            try:
                                # Try to parse as JSON
                                return json.loads(text)
                            except json.JSONDecodeError:
                                # Return as plain text if not JSON
                                return text
                    
                    # Return raw response if nothing else works
                    return str(response)
                    
                except Exception as e:
                    logger.error("❌ Supabase tool %s failed: %s", tool_def.name, e, exc_info=True)
                    return f"Database query failed: {str(e)}"

            # Build signature from schema
            params = [
                inspect.Parameter("context", inspect.Parameter.POSITIONAL_OR_KEYWORD, annotation=RunContext)
            ]
            ann = {"context": RunContext}

            for name, ps in _props.items():
                default = ps.get("default", inspect._empty if name in required else None)
                params.append(
                    inspect.Parameter(
                        name,
                        inspect.Parameter.KEYWORD_ONLY,
                        annotation=_py_type(ps),
                        default=default,
                    )
                )
                ann[name] = _py_type(ps)

            proxy.__signature__ = inspect.Signature(params)
            proxy.__annotations__ = ann
            proxy.__name__ = tool_def.name
            proxy.__doc__ = f"Database tool: {tool_def.description or tool_def.name}. Use this for personal data, tasks, notes, or any information stored in the database."
            return function_tool(proxy)

        tools.append(make_proxy())

    return tools


async def entrypoint(ctx: JobContext) -> None:
    """
    Main entrypoint for the LiveKit agent.
    """
    logger.info("🚀 Starting MCP Voice Agent")
    
    await ctx.connect()
    
    # Initialize Supabase MCP server with proper error handling
    server = None
    try:
        server = MCPServerStdio(
            "npx",
            args=["-y", "@supabase/mcp-server-supabase@latest", "--access-token", SUPABASE_TOKEN],
        )
        await server.__aenter__()
        logger.info("✅ Successfully connected to Supabase MCP server")
        
        # Test the connection
        try:
            test_tools = await server.list_tools()
            logger.info("✅ Supabase connection verified - found %d tools", len(test_tools))
        except Exception as e:
            logger.error("❌ Failed to verify Supabase connection: %s", e)
            
    except Exception as e:
        logger.error("❌ Failed to initialize Supabase MCP server: %s", e, exc_info=True)

    try:
        # Build all tools (Supabase + Firecrawl)
        if server:
            supabase_tools = await build_livekit_tools(server)
            tools = [firecrawl_search] + supabase_tools
            logger.info("🛠️ Loaded %d total tools (%d Supabase + 1 Firecrawl)", 
                       len(tools), len(supabase_tools))
        else:
            # If Supabase fails, still provide web search
            tools = [firecrawl_search]
            logger.warning("⚠️ Running with only Firecrawl search (Supabase unavailable)")

        # Create the agent with clear instructions
        agent = Agent(
            instructions=(
                "You are a helpful personal assistant with access to both web search and personal database. "
                "IMPORTANT ROUTING RULES:\n"
                "- For personal data (tasks, notes, contacts, expenses, books, etc.) → Use Supabase database tools\n"
                "- For current events, news, general information, weather, etc. → Use firecrawl_search\n"
                "- If user asks about 'my tasks' or 'my data' → Always check the database first\n"
                "- If user asks about current events or external facts → Use web search\n"
                "- Always be specific about which source you're using (database vs web)\n"
                "- When querying the database, start with list_tables to see what data is available\n"
                "- If a tool fails, explain the issue clearly and suggest alternatives"
            ),
            tools=tools,
        )

        # Create session
        session = AgentSession(
            stt=assemblyai.STT(),
            llm=openai.LLM(model="gpt-4o"),
            tts=openai.TTS(voice="ash"),
        )

        logger.info("🎤 Starting agent session")
        await session.start(agent=agent, room=ctx.room)
        
        # Generate appropriate greeting based on available tools
        if len(tools) > 1:
            greeting = "Hello! I'm your personal assistant. I can help you with your personal data from the database or search the web for current information. What can I help you with?"
        else:
            greeting = "Hello! I'm your assistant. I can search the web for information. Note: Database access is currently unavailable. What can I help you with?"
            
        await session.generate_reply(instructions=greeting)

        # Keep the session alive
        try:
            while True:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("👋 Session cancelled, shutting down.")

    finally:
        if server:
            try:
                await server.__aexit__(None, None, None)
            except Exception as e:
                logger.error("Error closing MCP server: %s", e)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))