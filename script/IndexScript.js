// Show modal on feature card click when not authenticated; navigate to Main.html when authenticated
function handleFeatureClick(e) {
  e.stopPropagation();
  if (window.MemoDeckAuth) {
    // go to dashboard/features page when logged in
    window.location.href = 'Main.html';
  } else {
    // if not logged in, just scroll to the features section on the landing page
    const target = document.querySelector('#features');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function bindFeatureClicks() {
  document.querySelectorAll('.feature-card').forEach(card => {
    card.removeEventListener('click', handleFeatureClick);
    card.addEventListener('click', handleFeatureClick);
  });
}

bindFeatureClicks();

// update behavior when auth state changes
window.addEventListener('memodeck:auth', (e) => {
  bindFeatureClicks();
});

// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

// Card flip animation
const showcase = document.querySelector('.card-showcase');
if (showcase) {
  let isFlipped = false;

  showcase.addEventListener('click', (e) => {
    e.stopPropagation();
    isFlipped = !isFlipped;
    
    if (isFlipped) {
      showcase.classList.add('flipped');
    } else {
      showcase.classList.remove('flipped');
    }
  });
}