# ⚡ Quick Deploy Checklist

## Backend (Render) - 5 minutes

1. **Push to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Create Render Account** → render.com

3. **Create PostgreSQL:**
   - New → PostgreSQL
   - Copy Internal Database URL

4. **Create Web Service:**
   - New → Web Service
   - Connect GitHub repo
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT --timeout 120 app:app`
   - **Env Vars:**
     - `DATABASE_URL` = (your postgres internal URL)
     - `SECRET_KEY` = (click Generate)
     - `OPENAI_API_KEY` = (your key)
     - `CORS_ORIGINS` = (leave blank for now, add after frontend deploy)

5. **After deploy, run migrations:**
   - Render Shell → `flask db upgrade`

6. **Copy backend URL** → `https://your-app.onrender.com`

---

## Frontend (Vercel) - 3 minutes

1. **Go to vercel.com** → Import Project

2. **Settings:**
   - Root Directory: `frontend`
   - Framework: Next.js (auto-detected)

3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.onrender.com`
   - `GOOGLE_CLIENT_ID` = (from Google Console)
   - `GOOGLE_CLIENT_SECRET` = (from Google Console)
   - `NEXTAUTH_SECRET` = (click Generate)
   - `NEXTAUTH_URL` = (will be auto-filled after deploy)

4. **Deploy!**

5. **Update Google OAuth:**
   - Add `https://your-app.vercel.app/api/auth/callback/google` to authorized redirects

6. **Update Backend CORS:**
   - Go back to Render
   - Update `CORS_ORIGINS` = `https://your-app.vercel.app`
   - Redeploy backend

---

## 🎉 Done!

Your app should be live! Test it and share on Twitter! 🐦
