'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function RoomsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiUrl}/room_code_check`, {
        room_code: roomCode.trim().toUpperCase()
      });
      if (!response.data.exists) {
        setError('Room not found. Check your code and try again.');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      setLoading(false);
      return;
    }
    router.push(`/chat?room=${roomCode.trim().toUpperCase()}`);
    setLoading(false);
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiUrl}/create_room`);
      const newRoomCode = response.data.room_code;
      setCreatedRoomCode(newRoomCode);
      setLoading(false);
    } catch (err) {
      setError('Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 pointer-events-none" />

      {/* Header */}
      <header className="relative bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900">ChatRoom</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-indigo-600">
                    {session?.user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-slate-600">{session?.user?.name}</span>
              </div>
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  router.push('/');
                }}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-md mx-auto">
          {/* Welcome */}
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-slate-500 mt-1">Join an existing room or create a new one</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Join Room Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100 mb-4 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Join a Room</h2>
                <p className="text-sm text-slate-500">Enter a room code to join</p>
              </div>
            </div>
            
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-slate-900 font-semibold tracking-widest placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={loading}
                maxLength={8}
              />
              <button
                type="submit"
                disabled={loading || !roomCode.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Join'
                )}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-sm text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* Create Room Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Create a Room</h2>
                <p className="text-sm text-slate-500">Start a new conversation</p>
              </div>
            </div>
            
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create New Room'
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Room Created Modal */}
      {createdRoomCode && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Room Created!</h3>
              <p className="text-slate-500 mt-1">Share this code with others</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <input
                  value={createdRoomCode}
                  readOnly
                  className="flex-1 bg-transparent font-mono text-xl text-center text-slate-900 font-bold tracking-[0.3em] focus:outline-none"
                />
                <button
                  onClick={handleCopyCode}
                  className={`p-2 rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}
                >
                  {copied ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/chat?room=${createdRoomCode}`)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all"
              >
                Join Room
              </button>
              <button
                onClick={() => setCreatedRoomCode(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
