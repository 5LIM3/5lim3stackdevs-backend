const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── DATABASE SETUP ──
const db = new Database(path.join(__dirname, 'messages.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    budget TEXT,
    message TEXT NOT NULL,
    ip TEXT,
    status TEXT DEFAULT 'unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── MIDDLEWARE ──
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── RATE LIMITING ──
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: { success: false, error: 'Too many messages sent. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts.' }
});

// ── EMAIL TRANSPORTER ──
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // Gmail App Password
  }
});

// ── HELPER: VALIDATE EMAIL ──
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── HELPER: AUTH MIDDLEWARE ──
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const session = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  next();
}

// ════════════════════════════════
// ── ROUTES ──
// ════════════════════════════════

// ── POST /api/contact ──
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, budget, message } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'];

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email and message are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }
  if (name.length > 100 || message.length > 2000) {
    return res.status(400).json({ success: false, error: 'Input too long.' });
  }

  try {
    // Save to database
    const stmt = db.prepare(`
      INSERT INTO messages (name, email, subject, budget, message, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(name, email, subject || 'No subject', budget || 'Not specified', message, ip);

    // Send email notification to Alozie
    await transporter.sendMail({
      from: `"5LIM3STACKDEVS Portfolio" <${process.env.EMAIL_USER}>`,
      to: 'alozieanyatonwu@gmail.com',
      subject: `📬 New Contact: ${subject || 'Portfolio Inquiry'} — from ${name}`,
      html: `
        <div style="font-family: monospace; background: #030000; color: #c8a8a8; padding: 32px; border: 1px solid #4a0000;">
          <h2 style="color: #ff1a1a; font-size: 1.4rem; margin-bottom: 24px;">
            🔴 New Message — 5LIM3STACKDEVS Portfolio
          </h2>
          <table style="width:100%; border-collapse:collapse;">
            <tr><td style="padding:8px 0; color:#6a3333; width:120px;">NAME</td><td style="color:#f5e8e8;">${name}</td></tr>
            <tr><td style="padding:8px 0; color:#6a3333;">EMAIL</td><td style="color:#f5e8e8;">${email}</td></tr>
            <tr><td style="padding:8px 0; color:#6a3333;">SUBJECT</td><td style="color:#f5e8e8;">${subject || '—'}</td></tr>
            <tr><td style="padding:8px 0; color:#6a3333;">BUDGET</td><td style="color:#ff1a1a; font-weight:bold;">${budget || 'Not specified'}</td></tr>
          </table>
          <div style="margin-top:24px; padding:20px; border:1px solid #2a0000; border-left: 3px solid #ff1a1a;">
            <div style="color:#6a3333; font-size:0.75rem; letter-spacing:3px; margin-bottom:12px;">MESSAGE</div>
            <p style="color:#f5e8e8; line-height:1.8;">${message.replace(/\n/g, '<br/>')}</p>
          </div>
          <div style="margin-top:24px; font-size:0.7rem; color:#6a3333;">
            Received: ${new Date().toLocaleString()} | IP: ${ip}
          </div>
          <a href="mailto:${email}" style="display:inline-block; margin-top:20px; padding:12px 28px; background:#ff1a1a; color:#000; text-decoration:none; font-weight:bold;">
            REPLY TO ${name.toUpperCase()} →
          </a>
        </div>
      `
    });

    // Send auto-reply to sender
    await transporter.sendMail({
      from: `"Alozie — 5LIM3STACKDEVS" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Got your message, ${name.split(' ')[0]}! I'll be in touch soon.`,
      html: `
        <div style="font-family: monospace; background: #030000; color: #c8a8a8; padding: 32px; border: 1px solid #4a0000;">
          <h2 style="color: #ff1a1a;">5LIM3STACKDEVS</h2>
          <p style="color:#6a3333; font-size:0.75rem; letter-spacing:3px; margin:8px 0 24px;">ANYATONWU ALOZIE JOSIAH</p>
          <p style="color:#f5e8e8; line-height:1.8;">Hey ${name.split(' ')[0]},</p>
          <p style="margin-top:16px; line-height:1.8;">Thanks for reaching out! I've received your message and will get back to you within <strong style="color:#ff1a1a;">24–48 hours</strong>.</p>
          <p style="margin-top:16px; line-height:1.8;">In the meantime, feel free to check out my work at <a href="https://www.usdtrewards.co" style="color:#ff1a1a;">usdtrewards.co</a> or connect with me on <a href="https://www.linkedin.com/in/alozie-anyatonwu-b0272a229" style="color:#ff1a1a;">LinkedIn</a>.</p>
          <div style="margin-top:32px; padding-top:20px; border-top:1px solid #2a0000; font-size:0.8rem; color:#6a3333;">
            Think Like a Developer. Defend Like a Hacker.<br/>
            <a href="https://github.com/5LIM3" style="color:#ff1a1a;">GitHub</a> &nbsp;|&nbsp;
            <a href="https://wa.me/2347040951519" style="color:#ff1a1a;">WhatsApp</a>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Message sent successfully!' });

  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message. Please try again or contact via WhatsApp.' });
  }
});

// ── POST /api/admin/login ──
app.post('/api/admin/login', adminLimiter, (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO admin_sessions (token) VALUES (?)').run(token);
  // Clean old sessions (keep last 10)
  db.prepare(`DELETE FROM admin_sessions WHERE token NOT IN (SELECT token FROM admin_sessions ORDER BY created_at DESC LIMIT 10)`).run();
  res.json({ success: true, token });
});

// ── GET /api/admin/messages ──
app.get('/api/admin/messages', requireAuth, (req, res) => {
  const messages = db.prepare(`
    SELECT * FROM messages ORDER BY created_at DESC
  `).all();
  const stats = {
    total: messages.length,
    unread: messages.filter(m => m.status === 'unread').length,
    read: messages.filter(m => m.status === 'read').length,
  };
  res.json({ success: true, messages, stats });
});

// ── PATCH /api/admin/messages/:id ──
app.patch('/api/admin/messages/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  if (!['read', 'unread', 'archived'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status.' });
  }
  db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, id);
  res.json({ success: true });
});

// ── GET /api/admin/logout ──
app.post('/api/admin/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

// ── SERVE ADMIN DASHBOARD ──
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── HEALTH CHECK ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🔴 5LIM3STACKDEVS Backend running on port ${PORT}`);
  console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin\n`);
});
