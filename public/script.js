// ── CURSOR ──
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top = my + 'px';
});

function animateRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px';
  ring.style.top = ry + 'px';
  requestAnimationFrame(animateRing);
}
animateRing();

// ── SCROLL REVEAL ──
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.12 });
reveals.forEach(el => observer.observe(el));

// ── COUNTER ANIMATION ──
const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = +e.target.dataset.count;
      const suffix = e.target.dataset.suffix || '';
      let count = 0;
      const step = target / 60;
      const interval = setInterval(() => {
        count += step;
        if (count >= target) {
          e.target.textContent = target + suffix;
          clearInterval(interval);
        } else {
          e.target.textContent = Math.floor(count) + suffix;
        }
      }, 20);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
counters.forEach(el => counterObserver.observe(el));

// ── ACTIVE NAV ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 100) current = s.id;
  });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? 'var(--red)' : '';
  });
});

// ── NAVBAR SCROLL STYLE ──
window.addEventListener('scroll', () => {
  const nav = document.querySelector('nav');
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(3,0,0,0.98)';
    nav.style.boxShadow = '0 2px 20px rgba(255,26,26,0.1)';
  } else {
    nav.style.background = 'rgba(3,0,0,0.9)';
    nav.style.boxShadow = '';
  }
});

// ── CONTACT FORM — REAL BACKEND ──

// ⚠️ UPDATE THIS URL after deploying your backend to Render
// e.g. 'https://5lim3stackdevs-backend.onrender.com'
const BACKEND_URL = 'https://fivelim3stackdevs-backend.onrender.com';

async function handleSubmit(btn) {
  const form = btn.closest('.contact-form') || document.querySelector('.contact-form');

  const inputs = form.querySelectorAll('.form-input, .form-textarea');
  const name    = inputs[0]?.value?.trim();
  const email   = inputs[1]?.value?.trim();
  const subject = inputs[2]?.value?.trim();
  const budget  = inputs[3]?.value?.trim();
  const message = inputs[4]?.value?.trim();

  // Basic client-side validation
  if (!name || !email || !message) {
    showFormFeedback(btn, 'Please fill in Name, Email & Message.', 'error');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormFeedback(btn, 'Please enter a valid email address.', 'error');
    return;
  }

  // Loading state
  btn.textContent = 'Sending...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  try {
    const res = await fetch(`${BACKEND_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, budget, message })
    });

    const data = await res.json();

    if (data.success) {
      showFormFeedback(btn, '✓ Message sent! I\'ll reply within 24hrs.', 'success');
      // Clear form
      inputs.forEach(i => i.value = '');
    } else {
      showFormFeedback(btn, data.error || 'Something went wrong. Try WhatsApp instead.', 'error');
    }
  } catch (err) {
    showFormFeedback(btn, 'Connection error. Please reach out via WhatsApp.', 'error');
  }
}

function showFormFeedback(btn, message, type) {
  btn.textContent = message;
  btn.disabled = false;
  btn.style.opacity = '1';

  if (type === 'success') {
    btn.style.background = '#00aa44';
    btn.style.boxShadow = '0 0 20px rgba(0,170,68,0.4)';
  } else {
    btn.style.background = '#880000';
    btn.style.boxShadow = '0 0 20px rgba(136,0,0,0.4)';
  }

  setTimeout(() => {
    btn.textContent = 'Send Message →';
    btn.style.background = '';
    btn.style.boxShadow = '';
  }, 4000);
}
