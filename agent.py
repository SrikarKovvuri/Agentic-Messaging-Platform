from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from models import Message, User, Room
from flask import current_app
import os
import json

# Lazy initialization - only create LLM when needed
_llm = None
_mem_llm = None
memory_info = {}

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
        
        # Skip agent messages to avoid confusion
        if not msg.content.startswith("[Agent]"):
            history.append(f"{username}: {msg.content}")
    
    return history


def run_agent(user_input, room_id=None):
    """Run the agent with user input and room context. Returns the response."""
    try:
        # Get conversation history if room_id is provided
        conversation_history = ""
        if room_id:
            history = get_room_conversation_history(room_id, limit=15)
            if history:
                conversation_history = "\n".join(history[-10:])  # Last 10 messages
                conversation_history = f"\n\nRecent conversation:\n{conversation_history}\n\n"
        
        # Create prompt with context
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", "You are a helpful assistant in a chat room. Be concise and helpful. Use the conversation history to provide context-aware responses. Respond in a casual, funny tone"),
                ("user", "{conversation_history}User asks: {input}"),
            ]
        )
        
        # Create chain with context (lazy load LLM)
        llm = get_llm()
        chain = prompt | llm
        
        # Invoke the chain with conversation history
        response = chain.invoke({
            "input": user_input,
            "conversation_history": conversation_history
        })
        
        # Extract the content from the response
        return response.content
    except Exception as e:
        return f"Error: {str(e)}"

