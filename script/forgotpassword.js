    let userEmail = '';
    let countdown = 60; // Increased to 60 seconds
    let countdownInterval = null;

    // Show alert message
    function showAlert(message, type = 'danger') {
      const alertContainer = document.getElementById('alertContainer');
      alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
      `;
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        const alertElement = alertContainer.querySelector('.alert');
        if (alertElement) {
          alertElement.classList.remove('show');
          setTimeout(() => alertContainer.innerHTML = '', 150);
        }
      }, 5000);
    }

    // Countdown timer for resend button
    function startCountdown() {
      clearInterval(countdownInterval);
      countdown = 60;
      document.getElementById('countdown').textContent = `(${countdown}s)`;
      document.getElementById('resendBtn').disabled = true;

      countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          document.getElementById('countdown').textContent = `(${countdown}s)`;
        } else {
          clearInterval(countdownInterval);
          document.getElementById('resendBtn').disabled = false;
          document.getElementById('countdown').textContent = '';
        }
      }, 1000);
    }

       // Resend OTP
async function resendOTP() {
  if (countdown > 0) return;
  
  const resendBtn = document.getElementById('resendBtn');
  resendBtn.disabled = true;

  try {
    const res = await fetch('backend/sendOtp.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: userEmail,
        resend: true  // ✅ Added resend flag
      })
    });

    const data = await res.json();
    
    if (data.status === 'success') {
      showAlert('New OTP sent to your email!', 'success');
      startCountdown();
      
      // Clear OTP inputs
      document.querySelectorAll('.otp-digit').forEach(input => input.value = '');
      document.querySelector('.otp-digit').focus();
    } else {
      showAlert(data.message || 'Failed to resend OTP', 'danger');
      resendBtn.disabled = false;
    }
  } catch (err) {
    console.error('Resend error:', err);
    showAlert('Network error. Please try again.', 'danger');
    resendBtn.disabled = false;
  }
}
    // Auto-focus and navigate OTP fields
    document.querySelectorAll('.otp-digit').forEach((input, index, inputs) => {
      // Move to next input on entry
      input.addEventListener('input', (e) => {
        // Only allow numbers
        input.value = input.value.replace(/[^0-9]/g, '');
        
        if (input.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      // Move to previous input on backspace
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });

      // Handle paste
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
        
        if (pastedData.length === 6) {
          inputs.forEach((inp, i) => {
            inp.value = pastedData[i] || '';
          });
          inputs[5].focus();
        }
      });
    });

    // Step 1: Submit email to send OTP
    document.getElementById('emailForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      userEmail = document.getElementById('email').value.trim();
      
      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        showAlert('Please enter a valid email address', 'danger');
        return;
      }

      const sendOtpBtn = document.getElementById('sendOtpBtn');
      const sendOtpText = document.getElementById('sendOtpText');
      const sendOtpSpinner = document.getElementById('sendOtpSpinner');
      
      // Disable button and show spinner
      sendOtpBtn.disabled = true;
      sendOtpText.textContent = 'Sending...';
      sendOtpSpinner.style.display = 'inline-block';

      try {
        const res = await fetch('/MemoDeck/backend/sendOtp.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail })
        });

        const data = await res.json();
        
        if (data.status === 'success') {
          document.getElementById('email-display').textContent = userEmail;
          document.getElementById('emailForm').style.display = 'none';
          document.getElementById('otpForm').style.display = 'block';
          
          showAlert('OTP sent successfully! Check your email.', 'success');
          startCountdown();
          
          // Focus first OTP input
          document.querySelector('.otp-digit').focus();
        } else {
          showAlert(data.message || 'Failed to send OTP', 'danger');
        }
      } catch (err) {
        console.error('Send OTP error:', err);
        showAlert('Network error. Please check your connection.', 'danger');
      } finally {
        // Re-enable button
        sendOtpBtn.disabled = false;
        sendOtpText.textContent = 'Send OTP';
        sendOtpSpinner.style.display = 'none';
      }
    });

    // Step 2: Submit OTP for verification
    document.getElementById('otpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const otpInputs = document.querySelectorAll('.otp-digit');
      const otp = Array.from(otpInputs).map(input => input.value).join('');

      if (otp.length !== 6) {
        showAlert('Please enter all 6 digits', 'warning');
        return;
      }

      const verifyOtpBtn = document.getElementById('verifyOtpBtn');
      const verifyOtpText = document.getElementById('verifyOtpText');
      const verifyOtpSpinner = document.getElementById('verifyOtpSpinner');
      
      // Disable button and show spinner
      verifyOtpBtn.disabled = true;
      verifyOtpText.textContent = 'Verifying...';
      verifyOtpSpinner.style.display = 'inline-block';

      try {
        const res = await fetch('/MemoDeck/backend/verifyOtp.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, otp: otp })
        });

        const data = await res.json();
        
        if (data.status === 'success') {
          showAlert('OTP verified! Redirecting...', 'success');
          
          // Redirect after 1 second
          setTimeout(() => {
            window.location.href = data.redirect || 'resetpassword.html?email=' + encodeURIComponent(userEmail);
          }, 1000);
        } else {
          showAlert(data.message || 'Invalid OTP. Please try again.', 'danger');
          
          // Clear OTP inputs on error
          otpInputs.forEach(input => input.value = '');
          otpInputs[0].focus();
        }
      } catch (err) {
        console.error('Verify OTP error:', err);
        showAlert('Verification failed. Please try again.', 'danger');
      } finally {
        // Re-enable button
        verifyOtpBtn.disabled = false;
        verifyOtpText.textContent = 'Verify Code';
        verifyOtpSpinner.style.display = 'none';
      }
    });