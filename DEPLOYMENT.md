# Deployment Guide

## 🚀 Quick Deploy Steps

### 1. Backend on Render

1. **Create PostgreSQL Database:**
   - Go to Render Dashboard → New → PostgreSQL
   - Note the `Internal Database URL`

2. **Create Web Service:**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repo
   - Settings:
     - **Name:** `chatroom-backend` (or your choice)
     - **Environment:** Python 3
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT --timeout 120 app:app`
     - **Plan:** Free tier works for testing

3. **Environment Variables:**
   ```
   DATABASE_URL=<your-postgres-internal-url>
   SECRET_KEY=<generate-a-random-secret-key>
   OPENAI_API_KEY=<your-openai-api-key>
   CORS_ORIGINS=https://your-frontend.vercel.app
   PORT=10000
   ```

4. **Run Database Migrations:**
   - After first deploy, SSH into the service or use Render shell:
   ```bash
   flask db upgrade
   ```

5. **Copy your backend URL** (e.g., `https://chatroom-backend.onrender.com`)

---

### 2. Frontend on Vercel

1. **Import to Vercel:**
   - Go to vercel.com → Add New → Project
   - Import your GitHub repo
   - **Root Directory:** `frontend`

2. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   NEXTAUTH_SECRET=<generate-a-random-secret>
   NEXTAUTH_URL=https://your-frontend.vercel.app
   ```

3. **Deploy!**
   - Click Deploy
   - Wait for build to complete

4. **Update Backend CORS:**
   - Go back to Render
   - Update `CORS_ORIGINS` to include your Vercel URL
   - Redeploy backend

---

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - **Authorized JavaScript origins:** `https://your-frontend.vercel.app`
   - **Authorized redirect URIs:** `https://your-frontend.vercel.app/api/auth/callback/google`
5. Copy Client ID and Secret to Vercel env vars

---

## 🔧 Troubleshooting

### Backend Issues:
- **Database connection:** Make sure `DATABASE_URL` uses internal URL on Render
- **Socket.IO not working:** Check CORS_ORIGINS includes your frontend URL
- **Migrations:** Run `flask db upgrade` after first deploy

### Frontend Issues:
- **API calls failing:** Check `NEXT_PUBLIC_API_URL` is correct
- **OAuth not working:** Verify redirect URIs in Google Console match Vercel URL
- **Socket connection:** Ensure backend URL is correct and CORS allows it

---

## 📝 Post-Deployment Checklist

- [ ] Backend deployed and accessible
- [ ] Database migrations run
- [ ] Frontend deployed and accessible
- [ ] Google OAuth configured
- [ ] Environment variables set correctly
- [ ] CORS configured properly
- [ ] Test creating a room
- [ ] Test joining a room
- [ ] Test sending messages
- [ ] Test @agent functionality

---

## 🐦 Twitter Post Template

```
🚀 Just launched ChatRoom Agent!

A real-time chat app with AI agent capabilities:
✨ Google OAuth auth
💬 Real-time messaging
🤖 AI agent with memory
🎨 Beautiful UI

Built with Next.js, Flask, Socket.IO & LangChain

Try it: [your-vercel-url]

#WebDev #AI #NextJS #Flask #LangChain
```
