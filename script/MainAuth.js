// MainAuth.js - Direct authentication for Main.html
// This runs BEFORE the page renders to prevent any flash

(async function() {
  // Block rendering until auth is verified
  document.body.style.visibility = 'hidden';

  try {
    const res = await fetch('http://localhost/MemoDeck/backend/check_auth.php', { 
      credentials: 'include' 
    });

    async function safeJson(response) {
      const ct = response.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) return await response.json();
      const text = await response.text();
      if (!text) return null;
      try { return JSON.parse(text); } catch { return null; }
    }

    const data = await safeJson(res);

    if (!data || !data.authenticated) {
      // Not authenticated - redirect to index immediately
      window.location.replace('/MemoDeck/Memodeck/index.html');
      return;
    }

    // Authenticated - set global state
    window.MemoDeckAuth = true;
    window.MemoDeckUser = data.user || null;

    // Update navbar with user info
    updateMainNavbar();

    // Show the page now that auth is confirmed
    document.body.style.visibility = 'visible';

    // Dispatch auth event for other scripts
    window.dispatchEvent(new CustomEvent('memodeck:auth', { 
      detail: { authenticated: true, user: window.MemoDeckUser } 
    }));

  } catch (err) {
    console.error('Auth check failed:', err);
    // On error, redirect to index
    window.location.replace('/MemoDeck/Memodeck/index.html');
  }
})();

// Update navbar for authenticated user on Main.html
function updateMainNavbar() {
  const nav = document.querySelector('.navbar-nav');
  if (!nav) return;

  // Remove login/signup buttons
  nav.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach(el => {
    const parentLi = el.closest('li');
    if (parentLi) parentLi.remove();
  });

  // Check if user menu already exists
  if (document.getElementById('userMenu')) return;

  // Add user dropdown
  const li = document.createElement('li');
  li.className = 'nav-item dropdown';

  const username = window.MemoDeckUser?.username || 'User';

  li.innerHTML = `
    <a class="nav-link dropdown-toggle" href="#" id="userMenu" role="button" data-bs-toggle="dropdown" aria-expanded="false">
      ${escapeHtml(username)}
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
        await fetch('http://localhost/MemoDeck/backend/logout.php', { 
          method: 'POST', 
          credentials: 'include' 
        });
      } catch (err) {
        console.error('Logout error', err);
      }
      // Clear auth state and redirect
      window.MemoDeckAuth = false;
      window.MemoDeckUser = null;
      window.location.replace('/MemoDeck/Memodeck/index.html');
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"'`]/g, (s) => {
    const map = { 
      '&': '&amp;', 
      '<': '&lt;', 
      '>': '&gt;', 
      '"': '&quot;', 
      "'": '&#39;', 
      '`': '&#x60;' 
    };
    return map[s];
  });
}

// Update username in welcome message
function populateUserInfo() {
  const welcomeEl = document.getElementById('welcomeName');
  if (welcomeEl && window.MemoDeckUser) {
    welcomeEl.textContent = window.MemoDeckUser.username;
  }
}

// Run after DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', populateUserInfo);
} else {
  populateUserInfo();
}