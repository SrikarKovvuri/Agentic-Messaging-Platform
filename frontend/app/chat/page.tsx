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
    if (!roomCode || !session) return;

    const s = io('http://localhost:5000');

    setSocket(s);

    s.on('connect', () => {
      s.emit('join_room', {
        room_code: roomCode,
        // later: JWT instead of user_id
      });
    });

    s.on('new_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      s.disconnect();
    };
  }, [roomCode, session]);

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
