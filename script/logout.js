// Handle all logout actions
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar logout
  const sidebarLogout = document.getElementById('sidebarLogout');
  if (sidebarLogout) {
    sidebarLogout.addEventListener('click', handleLogout);
  }
  
  // Nav menu logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

async function handleLogout(e) {
  e.preventDefault();
  try {
    await fetch('http://localhost/MemoDeck/backend/logout.php', {
      method: 'POST',
      credentials: 'include'
    });
    window.location.replace('/MemoDeck/Memodeck/index.html');
  } catch (err) {
    console.error('Logout failed:', err);
  }
}