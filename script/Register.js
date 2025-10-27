// --- Handle registration form submit ---
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Get form values
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Create form data
  const formData = new FormData();
  formData.append('username', username);
  formData.append('email', email);
  formData.append('password', password);
  formData.append('confirmPassword', confirmPassword);

  try {
    const response = await fetch('http://localhost/MemoDeck/backend/register.php', {
      method: 'POST',
      body: formData
    });

    // Parse the JSON body exactly once
    const data = await response.json();

    // If HTTP status indicates failure, surface the message from the server when available
    if (!response.ok) {
      const msg = data && data.message ? data.message : `HTTP error: ${response.status}`;
      throw new Error(msg);
    }

    if (data.status === "success") {
      // Show success message
      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.innerHTML = '<i class="fas fa-check"></i> Success!';
      submitBtn.classList.add('btn-success');
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location = "login.html";
      }, 1500);
    } else {
      // Remove any existing alert to avoid duplicates
      const existing = document.querySelector('#registerForm').previousElementSibling;
      if (existing && existing.classList && existing.classList.contains('alert')) {
        existing.remove();
      }

      // Show error message in a more user-friendly way
      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger mt-3';
      errorDiv.textContent = data.message || 'Registration failed';
      
      const form = document.getElementById('registerForm');
      form.insertAdjacentElement('beforebegin', errorDiv);
      
      // Remove error message after 5 seconds
      setTimeout(() => errorDiv.remove(), 5000);
    }
  } catch (error) {
    console.error('Error:', error);

    // Avoid duplicating alerts: remove previous
    const form = document.getElementById('registerForm');
    const prev = form.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains('alert')) prev.remove();

    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger mt-3';
    errorDiv.textContent = error.message || 'Something went wrong. Please try again later.';
    form.insertAdjacentElement('beforebegin', errorDiv);

    // Remove error message after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
  }
});

// --- Toggle password visibility ---
function togglePassword(fieldId) {
  const passwordField = document.getElementById(fieldId);
  const toggleIcon = document.getElementById(fieldId + '-toggle');
  
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    passwordField.type = 'password';
    toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// --- Password matching validation ---
document.getElementById('confirmPassword').addEventListener('input', function() {
  const password = document.getElementById('password').value;
  const confirmPassword = this.value;
  
  if (password !== confirmPassword) {
    this.setCustomValidity('Passwords do not match');
  } else {
    this.setCustomValidity('');
  }
});

document.getElementById('password').addEventListener('input', function() {
  const confirmPassword = document.getElementById('confirmPassword');
  if (confirmPassword.value) {
    if (this.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity('Passwords do not match');
    } else {
      confirmPassword.setCustomValidity('');
    }
  }
});
