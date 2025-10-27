    // Get email from URL (passed from OTP verification)
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('user');
    if (!email || !email.includes('@')) {
      alert('Invalid reset request. Redirecting to login...');
      window.location.href = 'login.html';
    } else {
      document.getElementById('email').value = email;
    }

    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (newPassword !== confirmPassword) {
        alert('Passwords do not match!');
        return;
      }

      if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
      }

      try {
        const res = await fetch('/MemoDeck/backend/resetPasswordApi.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, new_password: newPassword })
        });

        const data = await res.json();

        if (data.success) {
          alert('Password updated successfully! Redirecting to login...');
          window.location.href = 'login.html';
        } else {
          alert('Error: ' + (data.message || 'Failed to reset password'));
        }
      } catch (err) {
        console.error(err);
        alert('Network error. Please try again.');
      }
    });

