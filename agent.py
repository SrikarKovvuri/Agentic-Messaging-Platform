from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from models import Message, User, Room
from flask import current_app

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)


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
        
        # Create chain with context
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

