'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  user_id: number | string;
  message: string;
  isOwn?: boolean;
  username?: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);

  const roomCode = searchParams.get('room');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'responding' | 'failed'>('idle');

  // Auto-scroll to bottom when new messages arrive or agent status changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus]);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Connect socket
  useEffect(() => {
    // #region agent log
    const logData = {
      timestamp: new Date().toISOString(),
      event: 'useEffect_triggered',
      status,
      hasSession: !!session?.user,
      roomCode,
      hasSocket: !!socketRef.current,
      currentRoom: currentRoomRef.current,
      isConnected,
      isConnecting: isConnectingRef.current
    };
    console.log('[DEBUG] useEffect triggered:', logData);
    // #endregion
    
    if (status !== 'authenticated' || !session?.user || !roomCode) return;
    
    // If already connected to this room, don't reconnect
    if (socketRef.current && currentRoomRef.current === roomCode && isConnected) {
      // #region agent log
      console.log('[DEBUG] Already connected, skipping reconnect');
      // #endregion
      return;
    }
    
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      // #region agent log
      console.log('[DEBUG] Already connecting, skipping');
      // #endregion
      return;
    }
    
    const user = session.user;
  
    async function connectWithAuth() {
      // Mark as connecting
      isConnectingRef.current = true;
      
      // Clean up any existing socket first
      if (socketRef.current) {
        // #region agent log
        console.log('[DEBUG] Cleaning up existing socket before new connection');
        // #endregion
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
  
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        const response = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: user.provider,
            provider_id: user.providerId,
            email: user.email,
            name: user.name,
          }),
        });
  
        if (!response.ok) throw new Error('Failed to get JWT token');
  
        const { token } = await response.json();
        if (!token) throw new Error('No token received');
  
        // #region agent log
        console.log('[DEBUG] Creating socket with ping config (Hypothesis A/C - Render 60s timeout fix)');
        // #endregion
        const socketInstance = io(apiUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true,
          reconnection: true,
          reconnectionAttempts: Infinity,  // Keep trying to reconnect
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          withCredentials: true,
          forceNew: false,
          // Hypothesis A/C: Match server ping settings to keep connection alive through Render's 60s timeout
          timeout: 20000,  // Connection timeout
        });
  
        // Only proceed if we don't already have a connected socket
        if (socketRef.current) {
          socketInstance.disconnect();
          return;
        }

        socketRef.current = socketInstance;
        currentRoomRef.current = roomCode;
        setSocket(socketInstance);
        setMessages([]); // Reset messages when joining a new room

        // #region agent log - track ping/pong activity and shi
        let lastPingTime: number | null = null;
        let pingCount = 0;
        
        // Socket.IO internally handles ping/pong, but we can track the underlying engine
        socketInstance.io.engine?.on('ping', () => {
          pingCount++;
          const now = Date.now();
          const timeSinceLastPing = lastPingTime ? now - lastPingTime : 0;
          console.log('[DEBUG] Ping sent to server', { 
            pingCount, 
            timeSinceLastPing: timeSinceLastPing + 'ms',
            timestamp: new Date().toISOString() 
          });
          lastPingTime = now;
        });
        
        socketInstance.io.engine?.on('pong', () => {
          console.log('[DEBUG] Pong received from server', { 
            pingCount,
            timestamp: new Date().toISOString() 
          });
        });
        // #endregion

        // Set up listeners - these will be cleaned up on disconnect
        socketInstance.on('connect', () => {
          // #region agent log
          console.log('[DEBUG] Socket connected with auth!', { 
            roomCode, 
            socketId: socketInstance.id,
            transport: socketInstance.io.engine?.transport?.name,
            timestamp: new Date().toISOString()
          });
          // #endregion
          setIsConnected(true);
          socketInstance.emit('join_room', { room_code: roomCode });
          isConnectingRef.current = false;
        });

        socketInstance.on('disconnect', (reason) => {
          // #region agent log
          console.log('[DEBUG] Socket disconnected event received:', { 
            reason, 
            roomCode, 
            currentRoom: currentRoomRef.current,
            socketId: socketInstance.id,
            transport: socketInstance.io.engine?.transport?.name || 'unknown',
            timestamp: new Date().toISOString(),
            // Hypothesis A/B: Track if ping/pong was working
            pingCountBeforeDisconnect: pingCount
          });
          // #endregion
          setIsConnected(false);
          isConnectingRef.current = false;
        });
  
        socketInstance.on('new_message', (data: Message) => {
          setMessages((prev) => [...prev, data]);
        });

        // Listen for agent status updates
        socketInstance.on('agent_status', (data: { status: 'idle' | 'thinking' | 'responding' | 'failed', error?: string }) => {
          console.log('[DEBUG] Agent status update:', data);
          setAgentStatus(data.status);
          
          // Auto-reset failed status after 3 seconds
          if (data.status === 'failed') {
            setTimeout(() => setAgentStatus('idle'), 3000);
          }
        });

        socketInstance.on('user_joined', (data) => {
          // #region agent log
          console.log('[DEBUG] User joined event received:', { 
            joinedUserId: data.user_id, 
            joinedUsername: data.username,
            currentRoom: currentRoomRef.current,
            mySocketId: socketInstance.id,
            isConnected,
            timestamp: new Date().toISOString()
          });
          // #endregion
        });

        socketInstance.on('user_left', (data) => {
          // #region agent log
          console.log('[DEBUG] User left:', { leftUserId: data.user_id });
          // #endregion
        });
  
        socketInstance.on('error', (error) => {
          console.error('Socket error:', error);
          isConnectingRef.current = false;
        });
  
        socketInstance.on('connect_error', (error) => {
          console.error('Socket connection failed:', error);
          setIsConnected(false);
          isConnectingRef.current = false;
        });

      } catch (error) {
        console.error('Failed to get JWT or connect socket:', error);
        isConnectingRef.current = false;
      }
    }
  
    connectWithAuth();
  
    return () => {
      isConnectingRef.current = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        currentRoomRef.current = null;
        setSocket(null);
      }
    };
  }, [roomCode, session, status]);

  // Send message
  const sendMessage = () => {
    if (!socket || !input.trim()) return;

    socket.emit('send_message', {
      room_code: roomCode,
      message: input,
    });

    setInput('');
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Leave chat
  const handleLeaveChat = () => {
    isConnectingRef.current = false;
    if (socketRef.current && roomCode) {
      socketRef.current.emit('leave_room', { room_code: roomCode });
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      currentRoomRef.current = null;
    }
    setSocket(null);
    setMessages([]);
    setIsConnected(false);
    router.push('/rooms');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Invalid room</p>
          <button
            onClick={() => router.push('/rooms')}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Go back to rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLeaveChat}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Leave chat"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-900">Room</h1>
                <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 tracking-wider">
                  {roomCode}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <span className="text-xs text-slate-500">
                    {isConnected ? 'Connected' : 'Connecting...'}
                  </span>
                </div>
                {agentStatus !== 'idle' && (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    agentStatus === 'thinking' ? 'bg-violet-100 text-violet-600' :
                    agentStatus === 'responding' ? 'bg-purple-100 text-purple-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      agentStatus === 'thinking' ? 'bg-violet-500 animate-pulse' :
                      agentStatus === 'responding' ? 'bg-purple-500 animate-pulse' :
                      'bg-red-500'
                    }`}></div>
                    {agentStatus === 'thinking' && 'Agent thinking'}
                    {agentStatus === 'responding' && 'Agent responding'}
                    {agentStatus === 'failed' && 'Agent error'}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLeaveChat}
            className="text-sm text-slate-500 hover:text-red-600 font-medium transition-colors hidden sm:block"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-slate-500">No messages yet</p>
              <p className="text-sm text-slate-400 mt-1">Be the first to say something!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => {
                const isOwnMessage = session?.user?.email?.split('@')[0] === msg.user_id?.toString() || 
                                     session?.user?.name?.split(' ')[0].toLowerCase() === msg.user_id?.toString().toLowerCase();
                const isAgentMessage = msg.user_id === 'agent';
                
                return (
                  <div
                    key={i}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div className={`max-w-[80%] sm:max-w-[70%] ${isOwnMessage ? 'order-2' : ''}`}>
                      {!isOwnMessage && (
                        <span className={`text-xs ml-3 mb-1 block ${isAgentMessage ? 'text-violet-500 font-medium' : 'text-slate-500'}`}>
                          {isAgentMessage && (
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                              </svg>
                              {msg.username || 'Agent'}
                            </span>
                          )}
                          {!isAgentMessage && (msg.username || `User ${msg.user_id}`)}
                        </span>
                      )}
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          isOwnMessage
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : isAgentMessage
                              ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-bl-md shadow-md'
                              : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Agent Thinking/Status Indicator */}
              {(agentStatus === 'thinking' || agentStatus === 'responding') && (
                <div className="flex justify-start animate-fade-in">
                  <div className="max-w-[80%] sm:max-w-[70%]">
                    <span className="text-xs text-violet-500 font-medium ml-3 mb-1 block">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                        Agent
                      </span>
                    </span>
                    <div className="px-4 py-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 rounded-bl-md shadow-md">
                      <div className="flex items-center gap-2">
                        {agentStatus === 'thinking' && (
                          <>
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-sm text-white/90">Thinking...</span>
                          </>
                        )}
                        {agentStatus === 'responding' && (
                          <>
                            <svg className="w-4 h-4 text-white/80 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm text-white/90">Responding...</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Agent Failed Indicator */}
              {agentStatus === 'failed' && (
                <div className="flex justify-start animate-fade-in">
                  <div className="max-w-[80%] sm:max-w-[70%]">
                    <span className="text-xs text-red-500 font-medium ml-3 mb-1 block">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                        Agent
                      </span>
                    </span>
                    <div className="px-4 py-3 rounded-2xl bg-red-100 border border-red-200 rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-red-600">Something went wrong. Please try again.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full px-4 py-3 bg-slate-100 border-0 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                placeholder="Type a message..."
                disabled={!isConnected}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
