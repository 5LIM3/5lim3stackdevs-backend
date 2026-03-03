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
const db = new sqlite3.Database(path.join(__dirname, 'messages.db'), (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('✅ Database connected');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    budget TEXT,
    message TEXT NOT NULL,
    ip TEXT,
    status TEXT DEFAULT 'unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contactLimiter = rateLimit({ windowMs: 15*60*1000, max: 3, message: { success: false, error: 'Too many messages. Wait 15 minutes.' } });
const adminLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { success: false, error: 'Too many login attempts.' } });

const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
  db.get('SELECT * FROM admin_sessions WHERE token = ?', [token], (err, row) => {
    if (err || !row) return res.status(401).json({ success: false, error: 'Invalid session' });
    next();
  });
}

// ── HEALTH CHECK ──
app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, budget, message } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'];
  if (!name || !email || !message) return res.status(400).json({ success: false, error: 'Name, email and message are required.' });
  if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Invalid email address.' });

  db.run(`INSERT INTO messages (name, email, subject, budget, message, ip) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, subject||'No subject', budget||'Not specified', message, ip],
    async (err) => {
      if (err) return res.status(500).json({ success: false, error: 'Failed to save message.' });
      try {
        await transporter.sendMail({
          from: `"5LIM3STACKDEVS Portfolio" <${process.env.EMAIL_USER}>`,
          to: 'alozieanyatonwu@gmail.com',
          subject: `📬 New Contact: ${subject||'Portfolio Inquiry'} — from ${name}`,
          html: `<div style="font-family:monospace;background:#030000;color:#c8a8a8;padding:32px;border:1px solid #4a0000;"><h2 style="color:#ff1a1a;">🔴 New Message — 5LIM3STACKDEVS</h2><p><b style="color:#6a3333;">FROM:</b> <span style="color:#f5e8e8;">${name} &lt;${email}&gt;</span></p><p><b style="color:#6a3333;">SUBJECT:</b> <span style="color:#f5e8e8;">${subject||'—'}</span></p><p><b style="color:#6a3333;">BUDGET:</b> <span style="color:#ff1a1a;">${budget||'Not specified'}</span></p><div style="margin-top:20px;padding:16px;border-left:3px solid #ff1a1a;"><p style="color:#f5e8e8;">${message.replace(/\n/g,'<br/>')}</p></div><a href="mailto:${email}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#ff1a1a;color:#000;text-decoration:none;font-weight:bold;">REPLY →</a></div>`
        });
        await transporter.sendMail({
          from: `"Alozie — 5LIM3STACKDEVS" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `Got your message, ${name.split(' ')[0]}! I'll be in touch soon.`,
          html: `<div style="font-family:monospace;background:#030000;color:#c8a8a8;padding:32px;border:1px solid #4a0000;"><h2 style="color:#ff1a1a;">5LIM3STACKDEVS</h2><p style="color:#6a3333;font-size:0.75rem;letter-spacing:3px;">ANYATONWU ALOZIE JOSIAH</p><p style="margin-top:20px;color:#f5e8e8;">Hey ${name.split(' ')[0]}, thanks for reaching out! I'll get back to you within <strong style="color:#ff1a1a;">24–48 hours</strong>.</p><p style="margin-top:16px;color:#6a3333;font-size:0.8rem;">Think Like a Developer. Defend Like a Hacker.</p></div>`
        });
        res.json({ success: true, message: 'Message sent successfully!' });
      } catch(e) {
        console.error('Email error:', e);
        res.json({ success: true, message: 'Message received!' });
      }
    }
  );
});

app.post('/api/admin/login', adminLimiter, (req, res) => {
  if (req.body.password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ success: false, error: 'Invalid password.' });
  const token = crypto.randomBytes(32).toString('hex');
  db.run('INSERT INTO admin_sessions (token) VALUES (?)', [token], (err) => {
    if (err) return res.status(500).json({ success: false, error: 'Session error.' });
    res.json({ success: true, token });
  });
});

app.get('/api/admin/messages', requireAuth, (req, res) => {
  db.all('SELECT * FROM messages ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: 'DB error.' });
    res.json({ success: true, messages: rows, stats: { total: rows.length, unread: rows.filter(m=>m.status==='unread').length, read: rows.filter(m=>m.status==='read').length } });
  });
});

app.patch('/api/admin/messages/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['read','unread','archived'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status.' });
  db.run('UPDATE messages SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, error: 'DB error.' });
    res.json({ success: true });
  });
});

app.post('/api/admin/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  db.run('DELETE FROM admin_sessions WHERE token = ?', [token], () => res.json({ success: true }));
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/health', (req, res) => res.json({ status: 'online', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n🔴 5LIM3STACKDEVS Backend running on port ${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin\n`);
});
