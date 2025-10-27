document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const formData = new FormData();
  formData.append('email', email);
  formData.append('password', password);

  try {
    // If opened via file://, do not attempt network requests — show a helpful alert instead
    if (window.location.protocol === 'file:') {
      const existing = document.querySelector('#loginForm').previousElementSibling;
      if (existing && existing.classList && existing.classList.contains('alert')) existing.remove();
      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-warning mt-3';
      errorDiv.textContent = 'This page is opened via file:// and cannot reach the PHP backend. Run the app via your PHP server (e.g. http://localhost/MemoDeck/Memodeck/login.html)';
      document.getElementById('loginForm').insertAdjacentElement('beforebegin', errorDiv);
      setTimeout(() => errorDiv.remove(), 8000);
      return;
    }

    const res = await fetch('http://localhost/MemoDeck/backend/login.php', {
      method: 'POST',
      body: formData,
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

    if (!res.ok || !data || data.status !== 'success') {
      const existing = document.querySelector('#loginForm').previousElementSibling;
      if (existing && existing.classList && existing.classList.contains('alert')) existing.remove();

      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger mt-3';
      errorDiv.textContent = (data && data.message) ? data.message : 'Login failed (server did not return JSON)';
      document.getElementById('loginForm').insertAdjacentElement('beforebegin', errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
      return;
    }

    window.location.replace('/MemoDeck/Memodeck/Main.html');
    
  } catch (err) {
    console.error('Login error', err);
    const existing = document.querySelector('#loginForm').previousElementSibling;
    if (existing && existing.classList && existing.classList.contains('alert')) existing.remove();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger mt-3';
    errorDiv.textContent = 'Network error. Ensure Apache/XAMPP is running and you opened the site via http://localhost/MemoDeck/Memodeck/';
    document.getElementById('loginForm').insertAdjacentElement('beforebegin', errorDiv);
    setTimeout(() => errorDiv.remove(), 8000);
  }
});