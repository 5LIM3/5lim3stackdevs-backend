# 5LIM3STACKDEVS — Portfolio Backend

Node.js/Express backend for the 5LIM3STACKDEVS portfolio contact form with SQLite storage, email notifications, rate limiting, and an admin dashboard.

---

## SETUP (Local)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `EMAIL_USER` → your Gmail: `alozieanyatonwu@gmail.com`
- `EMAIL_PASS` → **Gmail App Password** (see below)
- `ADMIN_PASSWORD` → choose a strong password for your dashboard
- `FRONTEND_URL` → your frontend URL (for CORS)

### 3. Get a Gmail App Password
1. Go to **myaccount.google.com**
2. Security → 2-Step Verification (enable if not on)
3. Security → App Passwords
4. Select app: **Mail**, device: **Other** → name it "Portfolio"
5. Copy the 16-character password → paste into `EMAIL_PASS`

### 4. Run locally
```bash
npm run dev
```
Server runs at: `http://localhost:3000`
Admin dashboard: `http://localhost:3000/admin`

---

## DEPLOY TO RENDER

### Step 1 — Push backend to GitHub
```bash
cd portfolio-backend
git init
git add .
git commit -m "5LIM3STACKDEVS backend"
git remote add origin https://github.com/5LIM3/5lim3stackdevs-backend.git
git branch -M main
git push -u origin main
```

### Step 2 — Create Web Service on Render
1. Go to **render.com** → New + → **Web Service**
2. Connect your GitHub repo: `5lim3stackdevs-backend`
3. Settings:
   - **Name:** `5lim3stackdevs-backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add Environment Variables (from your `.env`):
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `ADMIN_PASSWORD`
   - `FRONTEND_URL` → your static site URL
5. Click **Create Web Service**

Render gives you a URL like: `https://5lim3stackdevs-backend.onrender.com`

### Step 3 — Update your frontend
In `script.js`, update this line:
```js
const BACKEND_URL = 'https://5lim3stackdevs-backend.onrender.com';
```

### Step 4 — Deploy frontend
Put `index.html`, `style.css`, `script.js` in your static site repo and push to Render Static Site.

---

## API ENDPOINTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contact` | Submit contact form |
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/messages` | Get all messages |
| PATCH | `/api/admin/messages/:id` | Update message status |
| POST | `/api/admin/logout` | Logout |
| GET | `/api/health` | Health check |
| GET | `/admin` | Admin dashboard UI |

---

## FEATURES
- ✅ Real email notifications to Gmail
- ✅ Auto-reply email to senders
- ✅ SQLite message storage
- ✅ Rate limiting (3 msgs per 15 min per IP)
- ✅ Admin dashboard with inbox, filters, reply
- ✅ JWT-style session tokens
- ✅ Input validation & sanitization
