'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/');
    return null;
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    // TODO: Verify room exists before joining
    router.push(`/chat?room=${roomCode.trim().toUpperCase()}`);
    setLoading(false);
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/rooms/create', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to create room');

      const data = await response.json();
      const newRoomCode = data.room_code;

      router.push(`/chat?room=${newRoomCode}`);
    } catch (err) {
      setError('Failed to create room. Make sure backend is running.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      {/* Header */}
      <div className="bg-blue-900 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">ChatRoom</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, <span className="font-semibold">{session?.user?.name}</span></span>
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                router.push('/');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">Join or Create a Room</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
              {error}
            </div>
          )}

          {/* Join Room Section */}
          <form onSubmit={handleJoinRoom} className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">Join Existing Room</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter room code (e.g., ABC123)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !roomCode.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Create Room Section */}
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
          >
            {loading ? 'Creating...' : 'Create New Room'}
          </button>

          <p className="text-gray-600 text-center mt-6 text-sm">
            Create a new room to get a unique code you can share with others
          </p>
        </div>
      </div>
    </div>
  );
}
