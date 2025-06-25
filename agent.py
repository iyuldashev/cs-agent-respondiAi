"""
Respondi.ai Customer Service Voice Agent
Professional AI assistant for instant customer support with voice and text capabilities.
Routes queries to web search for real-time information or database for customer data.
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

# SSL certificate configuration
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

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

# Initialize Firecrawl
firecrawl_app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)

# Test Firecrawl connection
async def test_firecrawl_connection():
    """Test if Firecrawl API key is working"""
    try:
        # Simple test search
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: firecrawl_app.search(query="test", limit=1)
        )
        logger.info("✅ Firecrawl connection test successful")
        return True
    except Exception as e:
        logger.error("❌ Firecrawl connection test failed: %s", e)
        return False


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
    Search the web for real-time information to help customers with current data and external resources.
    
    USE THIS TOOL FOR:
    - Business hours and contact information
    - Current promotions, pricing, or service updates
    - Industry news relevant to customer questions
    - External resources and documentation
    - Real-time status of services or systems
    - Date/time information for scheduling
    - Weather or location-based information for customers
    
    CUSTOMER SERVICE CONTEXT: Always frame results in a helpful, customer-focused manner.
    
    Args:
        context (RunContext): LiveKit runtime context.
        query (str): Search query for customer support (e.g., "business hours", "service status", "pricing information").
        limit (int): Maximum results to return (default 3).

    Returns:
        str: Customer-friendly search results with current information.
    """
    logger.info("🔍 WEB SEARCH CALLED - Query: '%s' (limit: %d)", query, limit)
    
    # Add context to search queries for better customer service results
    enhanced_query = query
    if "hours" in query.lower() or "contact" in query.lower():
        enhanced_query = f"business hours contact information {query}"
    elif "pricing" in query.lower() or "cost" in query.lower() or "price" in query.lower():
        enhanced_query = f"current pricing cost information {query}"
    elif "status" in query.lower() or "outage" in query.lower():
        enhanced_query = f"service status system status {query}"
    elif "weather" in query.lower():
        enhanced_query = f"current weather conditions {query}"
    elif any(word in query.lower() for word in ["date", "day", "today"]):
        enhanced_query = f"today's date current {query}"
    elif "time" in query.lower():
        enhanced_query = f"current time {query}"

    loop = asyncio.get_event_loop()
    try:
        logger.info("🌐 Executing Firecrawl search with enhanced query: '%s'", enhanced_query)
        
        # Use Firecrawl's search method
        result = await loop.run_in_executor(
            None,
            lambda: firecrawl_app.search(query=enhanced_query, limit=limit)
        )
        
        logger.info("✅ Firecrawl search completed successfully")
        logger.info("📊 Result type: %s, Success: %s", type(result), getattr(result, 'success', 'unknown'))
        
        # Handle Firecrawl search response (new SearchResponse format)
        if hasattr(result, 'success') and result.success:
            if hasattr(result, 'data') and result.data:
                results = result.data
                logger.info("📄 Found %d search results", len(results))
                
                # Format results with more complete information
                formatted_results = []
                for i, r in enumerate(results[:limit]):
                    title = r.get('title', 'Unknown Source')
                    url = r.get('url', 'N/A')
                    description = r.get('description', r.get('content', 'No description available'))
                    
                    # Truncate description but keep it informative
                    if len(description) > 300:
                        description = description[:300] + "..."
                    
                    formatted_results.append(f"**{title}**\n{description}\nSource: {url}")
                
                combined_text = "\n\n".join(formatted_results)
                final_result = f"I found some current information that should help:\n\n{combined_text}"
                
                logger.info("✅ Returning %d formatted results", len(formatted_results))
                return final_result
                
        elif hasattr(result, 'error') and result.error:
            logger.error("❌ Firecrawl API returned error: %s", result.error)
            return f"Web search failed: {result.error}"
        
        logger.warning("⚠️ No results found or unexpected response format")
        return f"I apologize, but I couldn't find current information about that right now. Let me try to help you in another way, or you can contact our support team directly for immediate assistance."
            
    except Exception as e:
        logger.error("❌ Firecrawl search exception: %s", e, exc_info=True)
        error_str = str(e).lower()
        
        # Provide customer-friendly error messages
        if "401" in error_str or "unauthorized" in error_str:
            return f"I'm having trouble accessing current information right now. Please contact our support team for immediate assistance with your request."
        elif "403" in error_str or "forbidden" in error_str:
            return f"I'm unable to retrieve that information at the moment. Let me help you in another way, or feel free to reach out to our support team directly."
        elif "rate" in error_str and "limit" in error_str:
            return f"I'm experiencing high demand right now. Please try your request again in a few minutes, or I can help you with something else in the meantime."
        elif "timeout" in error_str:
            return f"That search is taking longer than expected. Let me try a different approach or assist you with something else."
        elif "connection" in error_str or "network" in error_str:
            return f"I'm having connectivity issues accessing current information. I can still help with general questions, or you can contact our support team for immediate assistance."
        else:
            return f"I'm temporarily unable to search for current information, but I'm here to help with other questions. Is there anything else I can assist you with?"


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
            proxy.__doc__ = f"Customer database tool: {tool_def.description or tool_def.name}. Use this for customer account information, order history, support tickets, billing data, or any customer-specific information stored in the database."
            return function_tool(proxy)

        tools.append(make_proxy())

    return tools


async def entrypoint(ctx: JobContext) -> None:
    """
    Main entrypoint for the LiveKit agent.
    """
    logger.info("🚀 Starting MCP Voice Agent")
    
    await ctx.connect()
    
    # Test Firecrawl connection
    firecrawl_working = await test_firecrawl_connection()
    if not firecrawl_working:
        logger.warning("⚠️ Firecrawl connection failed - web search may not work properly")
    
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

        # Create the agent with customer service instructions
        agent = Agent(
            instructions=(
                "You are a professional customer service AI assistant for Respondi.ai. "
                "Your role is to provide exceptional customer support with instant, helpful responses. "
                
                "CORE PRINCIPLES:\n"
                "• Always respond professionally, friendly, and empathetically\n"
                "• Provide instant, accurate solutions to customer problems\n"
                "• Be proactive in offering additional help or clarification\n"
                "• Use a warm, conversational tone while maintaining professionalism\n"
                "• Focus on resolving issues quickly and efficiently\n\n"
                
                "CAPABILITIES:\n"
                "• Use `firecrawl_search` for real-time information (business hours, current promotions, news, etc.)\n"
                "• Use database tools for customer account information, order status, support tickets\n"
                "• Handle common support topics: account issues, billing, technical problems, product information\n\n"
                
                "CUSTOMER SERVICE BEST PRACTICES:\n"
                "• Always acknowledge the customer's concern first\n"
                "• Provide step-by-step solutions when appropriate\n"
                "• Offer multiple resolution options when possible\n"
                "• End interactions by asking if there's anything else you can help with\n"
                "• If you can't solve something immediately, explain next steps clearly\n"
                "• Stay patient and understanding, even with frustrated customers"
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
        
        # Generate appropriate customer service greeting
        if len(tools) > 1:
            greeting = (
                "Hello! Welcome to Respondi.ai customer support. I'm your AI assistant, "
                "here to help you with any questions or issues you might have. "
                "I can assist with account information, technical support, billing questions, "
                "and provide real-time information about our services. "
                "How can I help you today?"
            )
        else:
            greeting = (
                "Hello! Welcome to Respondi.ai customer support. I'm your AI assistant, "
                "ready to help with any questions or concerns you have. "
                "I can provide information about our services, help troubleshoot issues, "
                "and find real-time information to assist you. "
                "What can I help you with today?"
            )
            
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