from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from models import Message, User, Room
from flask import current_app
import os
import json
from agent_tools import web_search_tool
from langgraph.prebuilt import create_react_agent
_llm = None
_mem_llm = None
memory_info = {}
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from s3_utils import convert_object_key_to_url

def get_mem_llm():
    """Get or create the memory extraction LLM instance."""
    global _mem_llm
    if _mem_llm is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        _mem_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, api_key=api_key)
    return _mem_llm

def memory_decider(room_id, message):
    """
    Decide whether message or parts of message should be used for memory and stores info.
    Returns the extracted memory dict or None if nothing worth remembering.
    """
    try:
        mem_llm = get_mem_llm()
        memory_prompt = ChatPromptTemplate.from_template("""
        You are a memory extraction system.

        Extract ONLY stable, long-term information worth remembering.
        Do NOT infer or guess.
        If nothing qualifies, return exactly: null

        Rules:
        - Memory must be explicitly stated
        - Memory must remain valid beyond this conversation
        - Ignore jokes, opinions, hypotheticals, and short-term plans
        - Output JSON only, no markdown formatting

        Allowed memory types:
        - decision
        - preference
        - goal
        - fact
        - constraint

        Return format (or null):
        {{
        "type": "...",
        "key": "...",
        "value": "..."
        }}

        Message:
        {message}
        """)

        chain = memory_prompt | mem_llm
        response = chain.invoke({"message": message})
        
        # Check if response is null
        content = response.content.strip()
        if content.lower() == "null" or not content:
            return None
        
        # Parse JSON response
        try:
            # Remove markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
            
            memory = json.loads(content)
            
            # Validate structure
            if not isinstance(memory, dict):
                return None
            
            # Check required fields
            if "type" not in memory or "key" not in memory or "value" not in memory:
                return None
            
            # Validate memory type
            allowed_types = ("decision", "preference", "goal", "fact", "constraint")
            if memory.get("type") not in allowed_types:
                return None
            
            # Store memory for this room
            if room_id not in memory_info:
                memory_info[room_id] = []
            
            memory_info[room_id].append(memory)
            
            return memory
            
        except json.JSONDecodeError:
            # If JSON parsing fails, return None
            return None
            
    except Exception as e:
        # Log error but don't crash
        print(f"Error in memory_decider: {e}")
        return None

def get_room_memories(room_id):
    """Get stored memories for a room."""
    return memory_info.get(room_id, [])
        
def get_llm():
    """Get or create the LLM instance. Lazy initialization to avoid errors on import."""
    global _llm
    if _llm is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        _llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=api_key)
    return _llm


def get_room_conversation_history(room_id, limit=20):
    """Get recent messages from a room for context."""
    messages = Message.query.filter_by(room_id=room_id)\
        .order_by(Message.timestamp.desc())\
        .limit(limit)\
        .all()
    
    # Reverse to get chronological order
    messages.reverse()
    
    history = []
    for msg in messages:
        # Get username
        user = User.query.get(msg.user_id)
        username = user.username if user else f"User {msg.user_id}"
        if msg.content.startswith("[Agent]"):
            continue

        multimodal_format = {}
        if msg.image_url:
            image_url = convert_object_key_to_url(msg.image_url)
            multimodal_format["type"] = "image"
            multimodal_format["image_url"] = {"url": image_url}
        else:
            multimodal_format["type"] = "text"
            multimodal_format["content"] = "User: " + username + ": " + msg.content
      
        history.append(multimodal_format)

    return history

def run_agent(user_input, room_id=None):
    try:
        llm = get_llm()
        tools = [web_search_tool]
        agent_executor = create_react_agent(llm, tools)

        messages = []

        # 1️ System message
        messages.append(
            SystemMessage(
                content=(
                    "You are a helpful assistant in a chat room. "
                    "Be concise and helpful. Use conversation history for context. "
                    "Respond in a casual, funny tone. "
                    "You have access to web search tools - use them when needed."
                )
            )
        )

        # 2 Add conversation history properly (structured)
        if room_id:
            history = get_room_conversation_history(room_id, limit=10)

            for msg in history:
                if msg["type"] == "text":
                    messages.append(
                        HumanMessage(
                            content=msg["content"]
                        )
                    )

                elif msg["type"] == "image":
                    messages.append(
                        HumanMessage(
                            content=[
                                {
                                    "type": "image_url",
                                    "image_url": msg["image_url"]
                                }
                            ]
                        )
                    )

        # 3 Add current user input (text only for now)
        messages.append(
            HumanMessage(content=user_input)
        )

        # 4️ Invoke agent
        response = agent_executor.invoke({
            "messages": messages
        })

        return response["messages"][-1].content

    except Exception as e:
        return f"Error: {str(e)}"
