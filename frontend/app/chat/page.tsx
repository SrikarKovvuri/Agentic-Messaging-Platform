/*

this page will read the room from the query params
and then connect to the room with the flask endpoint 

and then this will render that chat component

*/

'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomCode = searchParams.get('room');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');

  //  auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // connect socket

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || !roomCode) return;
    
    const user = session.user;
    let socketInstance: Socket | null = null;
    let listenersSetup = false;
  
    async function connectWithAuth() {
      try {
        const response = await fetch('http://localhost:5000/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: user.provider,
            provider_id: user.providerId,
            email: user.email,
          }),
        });
  
        if (!response.ok) throw new Error('Failed to get JWT token');
  
        const { token } = await response.json();
        if (!token) throw new Error('No token received');
  
        socketInstance = io('http://localhost:5000', {
          auth: { token },
        });
  
        setSocket(socketInstance);
  
        // Set up listeners ONCE when socket is created
        if (!listenersSetup) {
          socketInstance.on('connect', () => {
            console.log('Socket connected with auth!');
            socketInstance?.emit('join_room', { room_code: roomCode });
          });
  
          socketInstance.on('new_message', (data) => {
            setMessages((prev) => [...prev, data]);
          });
  
          socketInstance.on('error', (error) => {
            console.error('Socket error:', error);
          });
  
          socketInstance.on('connect_error', (error) => {
            console.error('Socket connection failed:', error);
          });
  
          listenersSetup = true;
        }
      } catch (error) {
        console.error('Failed to get JWT or connect socket:', error);
      }
    }
  
    connectWithAuth();
  
    return () => {
      if (socketInstance) {
        socketInstance.removeAllListeners(); // Remove all listeners
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, [roomCode, session, status]);

  // send message
  const sendMessage = () => {
    if (!socket || !input.trim()) return;

    socket.emit('send_message', {
      room_code: roomCode,
      message: input,
    });

    setInput('');
  };

  // leave chat and go back to rooms
  const handleLeaveChat = () => {
    if (socket && roomCode) {
      // Emit leave_room event to notify server and other users
      socket.emit('leave_room', {
        room_code: roomCode,
      });
      // Clean up socket connection
      socket.removeAllListeners();
      socket.disconnect();
      setSocket(null);
    }
    // Navigate back to rooms page
    router.push('/rooms');
  };

  if (!roomCode) {
    return <div>Invalid room</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 bg-blue-700 text-white font-bold flex justify-between items-center">
        <span>Room: {roomCode}</span>
        <button
          onClick={handleLeaveChat}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold transition"
        >
          Leave Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => (
          <div key={i}>
            <span className="font-semibold">{msg.user_id}</span>: {msg.message}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 flex gap-2 border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border px-3 py-2 rounded"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
