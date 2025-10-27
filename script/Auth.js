// Fetch auth status and update UI
async function fetchAuth() {
  // If the page is being opened directly via file:// the fetch to the PHP backend will always fail.
  if (window.location.protocol === 'file:') {
    try {
      if (!document.getElementById('memodeck-server-warning')) {
        const warn = document.createElement('div');
        warn.id = 'memodeck-server-warning';
        warn.className = 'alert alert-warning text-center m-0';
        warn.style.borderRadius = '0';
        warn.style.position = 'sticky';
        warn.style.top = '0';
        warn.style.zIndex = '1050';
        warn.textContent = 'This page is opened via file:// and cannot reach the PHP backend. Please open the site via your PHP server, for example: http://localhost/MemoDeck/Memodeck/index.html';
        document.body.insertAdjacentElement('afterbegin', warn);
      }
    } catch (e) { /* ignore DOM errors */ }
    return;
  }

  try {
    // Check if user just logged in
    let justLoggedIn = false;
    try {
      justLoggedIn = sessionStorage.getItem('memodeck_just_logged_in') === '1';
      if (justLoggedIn) {
        sessionStorage.removeItem('memodeck_just_logged_in');
      }
    } catch (e) { /* ignore */ }

    const res = await fetch('http://localhost/MemoDeck/backend/check_auth.php', { credentials: 'include' });

    async function safeJson(response) {
      const ct = response.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) return await response.json();
      const text = await response.text();
      if (!text) return null;
      try { return JSON.parse(text); } catch { return null; }
    }

    const data = await safeJson(res);

    // Determine current page
    const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/');
    const isMainPage = window.location.pathname.includes('Main.html');
    
    if (data && data.authenticated) {
      // Set global auth state first
      window.MemoDeckAuth = true;
      window.MemoDeckUser = data.user || null;
      if (isIndexPage) {
        window.location.replace('/MemoDeck/Memodeck/Main.html');
        return;
      }

      // Only dispatch auth event and update UI for authenticated pages (Main.html, etc.)
      window.dispatchEvent(new CustomEvent('memodeck:auth', { detail: { authenticated: true, user: window.MemoDeckUser } }));
      if (isMainPage) {
        updateNavbarForAuth();
      }
    } else {
      // User is NOT authenticated
      window.MemoDeckAuth = false;
      window.MemoDeckUser = null;
      window.dispatchEvent(new CustomEvent('memodeck:auth', { detail: { authenticated: false } }));
      // If on Main.html and not authenticated, redirect to index.html
      if (isMainPage) {
        window.location.replace('/MemoDeck/Memodeck/index.html');
        return;
      }
    }
  } catch (err) {
    console.error('Auth fetch error', err);
    try {
      if (!document.getElementById('memodeck-server-warning')) {
        const warn = document.createElement('div');
        warn.id = 'memodeck-server-warning';
        warn.className = 'alert alert-warning text-center m-0';
        warn.style.borderRadius = '0';
        warn.style.position = 'sticky';
        warn.style.top = '0';
        warn.style.zIndex = '1050';
        warn.textContent = 'Unable to reach backend at http://localhost/MemoDeck/. Ensure Apache/XAMPP is running and you opened the site via http://localhost/MemoDeck/Memodeck/';
        document.body.insertAdjacentElement('afterbegin', warn);
      }
    } catch (e) { /* ignore DOM errors */ }
  }
}

// Update navbar for authenticated users
function updateNavbarForAuth() {
  const nav = document.querySelector('.navbar-nav');
  if (!nav) return;
  if (document.getElementById('userMenu')) return;
  nav.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach(el => {
    const parentLi = el.closest('li');
    if (parentLi) parentLi.remove();
  });
  const li = document.createElement('li');
  li.className = 'nav-item dropdown';

  li.innerHTML = `
    <a class="nav-link dropdown-toggle" href="#" id="userMenu" role="button" data-bs-toggle="dropdown" aria-expanded="false">
      ${escapeHtml(window.MemoDeckUser ? window.MemoDeckUser.username : 'User')}
    </a>
    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userMenu">
      <li><a class="dropdown-item" href="#">Profile</a></li>
      <li><a class="dropdown-item" href="#" id="logoutBtn">Logout</a></li>
    </ul>
  `;

  nav.appendChild(li);

  // Setup logout handler
  const logoutEl = document.getElementById('logoutBtn');
  if (logoutEl) {
    logoutEl.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('http://localhost/MemoDeck/backend/logout.php', { method: 'POST', credentials: 'include' });
      } catch (err) {
        console.error('Logout error', err);
      }
      window.MemoDeckAuth = false;
      window.MemoDeckUser = null;
      // Redirect to landing page
      window.location.replace('/MemoDeck/Memodeck/index.html');
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"'`]/g, (s) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#x60;' };
    return map[s];
  });
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchAuth);
} else {
  fetchAuth();
}