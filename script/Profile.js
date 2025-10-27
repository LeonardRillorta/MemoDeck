// Profile.js - Complete Profile Management with API
const API_BASE = 'http://localhost/MemoDeck/backend';

// Toast notification helper
function showToast(message, type = 'success') {
  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-triangle'
  };
  
  const colorMap = {
    success: '#10B981',
    error: '#dc2626',
    info: '#3B82F6',
    warning: '#F59E0B'
  };

  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 9999;
    min-width: 300px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    overflow: hidden;
    animation: slideIn 0.3s ease;
  `;
  
  toast.innerHTML = `
    <div style="background: ${colorMap[type]}; color: white; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas ${iconMap[type]}"></i>
        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
      </div>
      <button onclick="this.closest('.custom-toast').remove()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; opacity: 0.8; line-height: 1;">&times;</button>
    </div>
    <div style="padding: 1rem 1.5rem; color: #1e293b;">${message}</div>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Load user profile data from API
async function loadUserProfile() {
  try {
    const response = await fetch(`${API_BASE}/ProfileApi.php?action=profile`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    const user = data.user;
    
    // Update profile display
    document.getElementById('profileName').textContent = user.name || user.username;
    document.getElementById('profileEmail').textContent = user.email;
    
    // Update settings displays
    document.getElementById('displayUsername').textContent = user.username;
    document.getElementById('displayEmail').textContent = user.email;
    
    // Set joined date
    const joinedDate = new Date(user.joined_date || user.created_at);
    const formattedDate = joinedDate.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
    document.getElementById('joinedDate').textContent = formattedDate;
    
  } catch (error) {
    console.error('Failed to load profile:', error);
    showToast('Failed to load profile data', 'error');
  }
}

// Update profile statistics from API
async function updateProfileStats() {
  try {
    const response = await fetch(`${API_BASE}//ProfileApi.php?action=stats`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    const stats = data.stats;
    
    document.getElementById('totalDecks').textContent = stats.total_decks;
    document.getElementById('cardsMastered').textContent = stats.mastered_cards;
    document.getElementById('studyStreak').textContent = `${stats.study_streak} days`;
    
  } catch (error) {
    console.error('Failed to load stats:', error);
    // Set defaults
    document.getElementById('totalDecks').textContent = '0';
    document.getElementById('cardsMastered').textContent = '0';
    document.getElementById('studyStreak').textContent = '0 days';
  }
}

// ============================================
// CHANGE USERNAME
// ============================================
document.getElementById('saveUsernameBtn')?.addEventListener('click', async () => {
  const newUsername = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('usernamePassword').value;
  
  if (!newUsername || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  const btn = document.getElementById('saveUsernameBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
  
  try {
    const response = await fetch(`${API_BASE}/ProfileApi.php?action=update_username`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_username: newUsername,
        password: password
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    // Update display
    document.getElementById('displayUsername').textContent = data.username;
    document.getElementById('profileName').textContent = data.username;
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('changeUsernameModal'));
    modal.hide();
    
    // Reset form
    document.getElementById('changeUsernameForm').reset();
    
    showToast('Username updated successfully!', 'success');
    
  } catch (error) {
    console.error('Failed to update username:', error);
    showToast(error.message || 'Failed to update username', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
  }
});

// ============================================
// CHANGE EMAIL
// ============================================
document.getElementById('saveEmailBtn')?.addEventListener('click', async () => {
  const newEmail = document.getElementById('newEmail').value.trim();
  const password = document.getElementById('emailPassword').value;
  
  if (!newEmail || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  const btn = document.getElementById('saveEmailBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
  
  try {
    const response = await fetch(`${API_BASE}/ProfileApi.php?action=update_email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_email: newEmail,
        password: password
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    // Update display
    document.getElementById('displayEmail').textContent = data.email;
    document.getElementById('profileEmail').textContent = data.email;
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('changeEmailModal'));
    modal.hide();
    
    // Reset form
    document.getElementById('changeEmailForm').reset();
    
    showToast('Email updated successfully!', 'success');
    
  } catch (error) {
    console.error('Failed to update email:', error);
    showToast(error.message || 'Failed to update email', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
  }
});

// ============================================
// CHANGE PASSWORD
// ============================================
document.getElementById('savePasswordBtn')?.addEventListener('click', async () => {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  
  const btn = document.getElementById('savePasswordBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Changing...';
  
  try {
    const response = await fetch(`${API_BASE}/ProfileApi.php?action=update_password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
    modal.hide();
    
    // Reset form
    document.getElementById('changePasswordForm').reset();
    
    showToast('Password changed successfully!', 'success');
    
  } catch (error) {
    console.error('Failed to change password:', error);
    showToast(error.message || 'Failed to change password', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-2"></i>Change Password';
  }
});

// ============================================
// DELETE ACCOUNT
// ============================================
function setupAccountDeletion() {
  const deleteBtn = document.getElementById('deleteAccountBtn');
  if (!deleteBtn) return;
  
  deleteBtn.addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('deleteAccountModal'));
    modal.show();
    
    // Reset confirmation input
    const input = document.getElementById('deleteConfirmInput');
    if (input) input.value = '';
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) confirmBtn.disabled = true;
  });

  // Enable delete button only when "DELETE" is typed
  const confirmInput = document.getElementById('deleteConfirmInput');
  if (confirmInput) {
    confirmInput.addEventListener('input', (e) => {
      const confirmBtn = document.getElementById('confirmDeleteBtn');
      if (confirmBtn) {
        confirmBtn.disabled = e.target.value !== 'DELETE';
      }
    });
  }

  // Handle account deletion
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Deleting...';
      
      try {
        const response = await fetch(`${API_BASE}/ProfileApi.php?action=delete_account`, {
          method: 'POST',
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
          showToast('Account deleted successfully. Goodbye!', 'info');
          
          // Redirect after 2 seconds
          setTimeout(() => {
            window.location.replace('/MemoDeck/Memodeck/index.html');
          }, 2000);
        } else {
          showToast(data.message || 'Failed to delete account', 'error');
          confirmDeleteBtn.disabled = false;
          confirmDeleteBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i>Delete My Account';
        }
      } catch (err) {
        console.error('Delete account error:', err);
        showToast('Failed to delete account. Please try again.', 'error');
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i>Delete My Account';
      }
    });
  }
}

// Setup logout with confirmation
function setupLogout() {
  const logoutBtn = document.getElementById('sidebarLogout');
  if (!logoutBtn) return;
  
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Logout?')) {
      try {
        const response = await fetch(`${API_BASE}/logout.php`, {
          method: 'POST',
          credentials: 'include'
        });
        
        if (response.ok) {
          window.location.replace('/MemoDeck/Memodeck/index.html');
        } else {
          throw new Error('Logout failed');
        }
      } catch (err) {
        console.error('Logout error:', err);
        showToast('Logout failed. Please try again.', 'error');
      }
    }
  });
}

// Initialize everything on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Profile page initializing...');
  
  // Load user data and stats
  loadUserProfile();
  updateProfileStats();
  
  // Setup event listeners
  setupLogout();
  setupAccountDeletion();
  
  console.log('Profile page initialized');
});