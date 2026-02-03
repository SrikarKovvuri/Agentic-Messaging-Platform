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


  // Remove lines 35-37 (the comment lines)

// Replace lines 39-111 with:

useEffect(() => {
  // Wait for auth to complete before connecting
  if (status !== 'authenticated' || !session?.user || !roomCode) return;
  const user = session.user;
  let socketInstance: Socket | null = null;

  async function connectWithAuth() {
    try {
      // Step 1: Exchange NextAuth session for Flask JWT
      const response = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: user.provider,
          provider_id: user.providerId,
          email: user.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get JWT token');
      }

      const data = await response.json();
      const jwtToken = data.token;

      if (!jwtToken) {
        throw new Error('No token received from server');
      }

      // Step 2: Connect to Socket.IO WITH the token
      socketInstance = io('http://localhost:5000', {
        auth: {
          token: jwtToken,
        },
      });

      setSocket(socketInstance);

      socketInstance.on('connect', () => {
        console.log('Socket connected with auth!');
        socketInstance?.emit('join_room', {
          room_code: roomCode,
        });
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

    } catch (error) {
      console.error('Failed to get JWT or connect socket:', error);
    }
  }

  connectWithAuth();

  // Cleanup function
  return () => {
    if (socketInstance) {
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

  if (!roomCode) {
    return <div>Invalid room</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 bg-blue-700 text-white font-bold">
        Room: {roomCode}
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
