# ChatRoom Agent

A real-time chat application with AI agent capabilities built with Next.js, Flask, Socket.IO, and LangChain.

## Features

- 🔐 Google OAuth authentication
- 💬 Real-time messaging with Socket.IO
- 🤖 AI agent with room-scoped memory
- 🎨 Modern, responsive UI
- 🚀 Deployed on Vercel (frontend) and Render (backend)

## Tech Stack

**Frontend:**
- Next.js 16
- NextAuth.js
- Socket.IO Client
- Tailwind CSS
- TypeScript

**Backend:**
- Flask
- Flask-SocketIO
- PostgreSQL
- LangChain
- OpenAI GPT-4o-mini

## Deployment

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app`
5. Add environment variables:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `SECRET_KEY` (Flask secret key)
   - `OPENAI_API_KEY` (Your OpenAI API key)
   - `CORS_ORIGINS` (Comma-separated list of allowed origins, e.g., `https://your-app.vercel.app`)

### Frontend (Vercel)

1. Import your GitHub repository to Vercel
2. Set framework preset to Next.js
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` (Your Render backend URL, e.g., `https://your-app.onrender.com`)
   - `GOOGLE_CLIENT_ID` (Google OAuth client ID)
   - `GOOGLE_CLIENT_SECRET` (Google OAuth client secret)
   - `NEXTAUTH_SECRET` (NextAuth secret)
   - `NEXTAUTH_URL` (Your Vercel URL, e.g., `https://your-app.vercel.app`)

## Local Development

1. Clone the repository
2. Backend:
   ```bash
   pip install -r requirements.txt
   python app.py
   ```
3. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Environment Variables

See `.env.example` for required environment variables.
