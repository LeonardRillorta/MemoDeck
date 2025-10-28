// dashboard.js - Main Deck Management (Complete with Import/Export - FIXED)
const API_BASE = 'http://localhost/MemoDeck/backend';
const API_ENDPOINTS = {
  decks: {
    all: `${API_BASE}/deckApi.php?action=all`,
    single: (id) => `${API_BASE}/deckApi.php?action=single&id=${id}`,
    create: `${API_BASE}/deckApi.php?action=create`,
    update: (id) => `${API_BASE}/deckApi.php?action=update&id=${id}`,
    delete: (id) => `${API_BASE}/deckApi.php?action=delete&id=${id}`,
    stats: `${API_BASE}/deckApi.php?action=stats`
  },
  cards: {
    create: `${API_BASE}/CardApi.php?action=create`,
    delete: (id) => `${API_BASE}/CardApi.php?action=delete&id=${id}`,
  }
};

// IMPROVED API Helper Function with better error handling
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorMsg;
      } catch (e) {
        errorMsg = response.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    
    const text = await response.text();
    
    if (!text || text.trim() === '') {
      throw new Error('Empty response from server');
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      throw new Error('Invalid JSON response from server');
    }
    
    if (!data.success) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message || 'An error occurred', 'error');
    throw error;
  }
}

// State Management
const state = {
  decks: [],
  currentDeck: null,
  currentCardIndex: 0,
  studyMode: 'flip'
};

// Modal References
const modals = {};

// Toast Notification Helper
function showToast(message, type = 'success') {
  const toastId = 'notification-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  
  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">
          <i class="fas ${icon} me-2"></i>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1050;';
    document.body.appendChild(container);
  }
  
  container.insertAdjacentHTML('beforeend', toastHTML);
  
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
  
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

function getDeckProgress(deck) {
  const total = deck.cards?.length || deck.card_count || 0;
  const best = deck.best_score || deck.bestScore || 0;
  const score = total > 0 ? Math.round((best / total) * 100) : 0;
  const isComplete = total > 0 && best === total;
  return { score, isComplete, best, total };
}

// Load Decks from Database
async function loadDecksFromDB() {
  try {
    const data = await apiRequest(API_ENDPOINTS.decks.all);
    const archivedDecks = JSON.parse(localStorage.getItem('archivedDecks')) || [];
    const archivedIds = archivedDecks.map(d => d.id);

    state.decks = data.decks.filter(d => !archivedIds.includes(d.id));

    renderDecks();
    renderSidebar();
    updateStats();
  } catch (error) {
    console.error('Failed to load decks:', error);
  }
}

// Create Deck
document.getElementById('saveDeckBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('deckName').value.trim();
  const description = document.getElementById('deckDescription').value.trim();
  const color = document.querySelector('input[name="deckColor"]:checked')?.value || 'primary';
  
  if (!name) {
    showToast('Please enter a deck name', 'error');
    return;
  }
  
  try {
    await apiRequest(API_ENDPOINTS.decks.create, {
      method: 'POST',
      body: JSON.stringify({ name, description, color })
    });
    
    document.getElementById('createDeckForm').reset();
    if (modals.createDeck) modals.createDeck.hide();
    await loadDecksFromDB();
    showToast('Deck created successfully!', 'success');
  } catch (error) {
    console.error('Failed to create deck:', error);
  }
});

// Render Decks & Sidebar
function renderDecks() {
  const decksGrid = document.getElementById('decksGrid');
  
  if (state.decks.length === 0) {
    decksGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <h4>No Decks Yet</h4>
        <p>Create your first deck to start learning!</p>
      </div>
    `;
    return;
  }
  
  const sortedDecks = [...state.decks].sort((a, b) => {
    const aProgress = getDeckProgress(a).score;
    const bProgress = getDeckProgress(b).score;
    if (aProgress === bProgress) return a.name.localeCompare(b.name);
    return aProgress - bProgress;
  });
  
  decksGrid.innerHTML = sortedDecks.map(deck => {
    const { score, isComplete, total } = getDeckProgress(deck);
    
    return `
      <div class="deck-card" onclick="openDeckDetail('${deck.id}')">
        <div class="deck-card-header" style="background: linear-gradient(135deg, ${getGradient(deck.color)})">
          <i class="fas fa-layer-group deck-icon"></i>
        </div>
        <div class="deck-card-body">
          <h3 class="deck-card-title">${deck.name}</h3>
          <p class="deck-card-desc">${deck.description || 'No description'}</p>
          
          <div class="deck-card-stats">
            <span class="stat-item">
              <i class="fas fa-layer-group me-2"></i> ${total} cards
            </span>
            <span class="stat-item">
              <i class="fas ${isComplete ? 'fa-check-circle text-success' : 'fa-clock text-muted'} me-2"></i>
              ${isComplete ? '100%' : `${score}%`}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSidebar() {
  const deckList = document.getElementById('deckList');
  if (!deckList) return;

  const archivedDecks = JSON.parse(localStorage.getItem('archivedDecks')) || [];
  const archivedIds = archivedDecks.map(d => d.id);
  const visibleDecks = state.decks.filter(d => !archivedIds.includes(d.id));

  if (visibleDecks.length === 0) {
    deckList.innerHTML = '<p class="text-muted text-center py-4">No decks yet.</p>';
    return;
  }

  deckList.innerHTML = visibleDecks.map(deck => `
    <div class="deck-item" data-deck-id="${deck.id}" onclick="selectDeck('${deck.id}')">
      <i class="fas fa-layer-group me-2"></i> ${deck.name}
    </div>
  `).join('');
}

// Deck & Card Management
async function openDeckDetail(deckId) {
  try {
    const data = await apiRequest(API_ENDPOINTS.decks.single(deckId));
    state.currentDeck = data.deck;
    state.currentCardIndex = 0;
    
    document.getElementById('deckDetailTitle').textContent = state.currentDeck.name;
    document.getElementById('deckDetailDesc').textContent = state.currentDeck.description || 'No description';
    
    const { score, isComplete, best, total } = getDeckProgress(state.currentDeck);
    
    document.getElementById('deckCardCount').textContent = total;
    
    const scoreText = isComplete 
      ? `${best}/${total} (100%)`
      : total > 0 
        ? `${best}/${total} (${score}%)`
        : 'Not completed yet';
        
    document.getElementById('deckMasteredCount').textContent = scoreText;
    
    document.getElementById('deckProgress').style.width = score + '%';
    document.getElementById('deckProgress').textContent = score + '%';
    
    if (isComplete) {
      document.getElementById('deckProgress').classList.add('bg-success');
    } else {
      document.getElementById('deckProgress').classList.remove('bg-success');
    }
    
    renderCards();
    selectDeck(deckId);
    if (modals.deckDetail) modals.deckDetail.show();
  } catch (error) {
    console.error('Failed to load deck:', error);
  }
}

function renderCards() {
  const cardsContainer = document.getElementById('cardsList');
  
  if (!state.currentDeck || !state.currentDeck.cards || state.currentDeck.cards.length === 0) {
    cardsContainer.innerHTML = '<p class="text-muted text-center py-4">No flashcards yet. Add one to start!</p>';
    return;
  }
  
  cardsContainer.innerHTML = state.currentDeck.cards.map((card, index) => `
    <div class="card-item">
      <div class="card-item-content">
        <div class="card-item-question">${card.question}</div>
        <div class="card-item-answer">${card.answer}</div>
      </div>
      <div class="card-item-actions">
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCard('${card.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// Add Card Button
document.getElementById('addCardBtn')?.addEventListener('click', () => {
  document.getElementById('addCardForm').reset();
  if (modals.addCard) modals.addCard.show();
});

// Save Card
document.getElementById('saveCardBtn')?.addEventListener('click', async () => {
  const question = document.getElementById('cardQuestion').value.trim();
  const answer = document.getElementById('cardAnswer').value.trim();
  
  if (!question || !answer) {
    showToast('Please fill in both question and answer', 'error');
    return;
  }
  
  try {
    await apiRequest(API_ENDPOINTS.cards.create, {
      method: 'POST',
      body: JSON.stringify({
        deck_id: state.currentDeck.id,
        question,
        answer
      })
    });
    
    if (modals.addCard) modals.addCard.hide();
    await openDeckDetail(state.currentDeck.id);
    await loadDecksFromDB();
    showToast('Flashcard created successfully!', 'success');
  } catch (error) {
    console.error('Failed to create card:', error);
  }
});

// Delete Card
async function deleteCard(cardId) {
  if (confirm('Delete this card?')) {
    try {
      await apiRequest(API_ENDPOINTS.cards.delete(cardId), {
        method: 'DELETE'
      });
      
      await openDeckDetail(state.currentDeck.id);
      await loadDecksFromDB();
      showToast('Card deleted!', 'success');
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  }
}

// Delete Deck
document.getElementById('deleteDeckBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete this deck? This cannot be undone.')) {
    try {
      await apiRequest(API_ENDPOINTS.decks.delete(state.currentDeck.id), {
        method: 'DELETE'
      });
      
      if (modals.deckDetail) modals.deckDetail.hide();
      await loadDecksFromDB();
      showToast('Deck deleted successfully!', 'success');
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  }
});

// Archive Deck Functionality
document.getElementById('archiveDeckBtn')?.addEventListener('click', async () => {
  const deck = state.currentDeck;
  if (!deck) return;

  deck.archived = true;

  localStorage.setItem('archivedDecks', JSON.stringify(
    [...(JSON.parse(localStorage.getItem('archivedDecks')) || []), deck]
  ));

  state.decks = state.decks.filter(d => d.id !== deck.id);
  renderDecks();
  renderArchivedDecks();
  renderSidebar();

  if (modals.deckDetail) modals.deckDetail.hide();
  showToast('Deck archived successfully!', 'info');
});

function unarchiveDeck(deckId) {
  const archivedDecks = JSON.parse(localStorage.getItem('archivedDecks')) || [];
  const deck = archivedDecks.find(d => d.id === deckId);

  if (!deck) return;

  deck.archived = false;
  state.decks.push(deck);

  const updatedArchived = archivedDecks.filter(d => d.id !== deckId);
  localStorage.setItem('archivedDecks', JSON.stringify(updatedArchived));

  renderDecks();
  renderArchivedDecks();
  showToast('Deck unarchived!', 'success');
  renderSidebar();
}

function renderArchivedDecks() {
  const archivedGrid = document.getElementById('archivedGrid');
  if (!archivedGrid) return;
  
  const archivedDecks = JSON.parse(localStorage.getItem('archivedDecks')) || [];

  if (archivedDecks.length === 0) {
    archivedGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-archive"></i>
        <h4>No Archived Decks</h4>
        <p>Archived decks will appear here.</p>
      </div>
    `;
    return;
  }

  archivedGrid.innerHTML = archivedDecks.map(deck => {
    const { score, isComplete, total } = getDeckProgress(deck);
    return `
      <div class="deck-card">
        <div class="deck-card-header" style="background: linear-gradient(135deg, ${getGradient(deck.color)})">
          <i class="fas fa-box-archive deck-icon"></i>
        </div>
        <div class="deck-card-body">
          <h3 class="deck-card-title">${deck.name}</h3>
          <p class="deck-card-desc">${deck.description || 'No description'}</p>
          <div class="deck-card-stats">
            <span class="stat-item"><i class="fas fa-layer-group me-2"></i>${total} cards</span>
            <span class="stat-item"><i class="fas ${isComplete ? 'fa-check-circle text-success' : 'fa-clock text-muted'} me-2"></i>${isComplete ? '100%' : `${score}%`}</span>
          </div>
          <div class="mt-3 text-end">
            <button class="btn btn-sm btn-outline-primary" onclick="unarchiveDeck('${deck.id}')">
              <i class="fas fa-box-open me-1"></i>Unarchive
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Helpers
function selectDeck(deckId) {
  const deckList = document.querySelectorAll('.deck-item');
  deckList.forEach(item => {
    if (item.dataset.deckId == deckId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

async function updateStats() {
  try {
    const data = await apiRequest(API_ENDPOINTS.decks.stats);
    const stats = data.stats;
    
    if (document.getElementById('totalDecks')) {
      document.getElementById('totalDecks').textContent = stats.total_decks;
    }
    if (document.getElementById('completedDecks')) {
      document.getElementById('completedDecks').textContent = stats.completed_decks;
    }
    if (document.getElementById('activeDecks')) {
      document.getElementById('activeDecks').textContent = stats.active_decks;
    }
  } catch (error) {
    console.error('Failed to update stats:', error);
    if (document.getElementById('totalDecks')) {
      document.getElementById('totalDecks').textContent = '0';
    }
    if (document.getElementById('completedDecks')) {
      document.getElementById('completedDecks').textContent = '0';
    }
    if (document.getElementById('activeDecks')) {
      document.getElementById('activeDecks').textContent = '0';
    }
  }
}

function getGradient(color) {
  const gradients = {
    primary: '#4F46E5, #4338CA',
    secondary: '#10B981, #059669',
    accent: '#F59E0B, #D97706',
    danger: '#EF4444, #DC2626',
    info: '#06B6D4, #0891B2'
  };
  return gradients[color] || gradients.primary;
}

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

// ============================================================
// CSV IMPORT & EXPORT FUNCTIONALITY
// ============================================================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function renderCSVPreview(data) {
  if (data.length === 0) {
    document.getElementById('csvPreview').innerHTML = '<div class="alert alert-warning">No data found in CSV</div>';
    return;
  }
  
  let previewHTML = `
    <h5>Preview (first 5 cards):</h5>
    <div class="table-responsive">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Question</th>
            <th>Answer</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  data.forEach(row => {
    previewHTML += `
      <tr>
        <td>${escapeHtml(row.Question)}</td>
        <td>${escapeHtml(row.Answer)}</td>
      </tr>
    `;
  });
  
  previewHTML += `
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('csvPreview').innerHTML = previewHTML;
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  console.log('File selected:', file.name);
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      console.log('Parse complete:', results);
      
      if (results.errors.length > 0) {
        showToast('CSV parsing error: ' + results.errors[0].message, 'error');
        return;
      }
      
      const headers = results.meta.fields;
      if (!headers.includes('Question') || !headers.includes('Answer')) {
        showToast('CSV must contain "Question" and "Answer" columns', 'error');
        document.getElementById('csvFile').value = '';
        return;
      }
      
      const previewData = results.data.slice(0, 5);
      renderCSVPreview(previewData);
    },
    error: function(error) {
      console.error('Parse error:', error);
      showToast('CSV parsing error: ' + error.message, 'error');
      document.getElementById('csvFile').value = '';
    }
  });
}

async function handleImportDeck() {
  console.log('Import button clicked!');
  
  const fileInput = document.getElementById('csvFile');
  const deckName = document.getElementById('importDeckName').value.trim();
  const deckDescription = document.getElementById('importDeckDescription').value.trim();
  const deckColor = document.querySelector('input[name="importDeckColor"]:checked')?.value || 'primary';
  
  if (!fileInput.files.length) {
    showToast('Please select a CSV file', 'error');
    return;
  }
  
  if (!deckName) {
    showToast('Please enter a deck name', 'error');
    return;
  }
  
  const file = fileInput.files[0];
  console.log('Processing file:', file.name);
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async function(results) {
      console.log('Import parse results:', results);
      
      if (results.errors.length > 0) {
        showToast('CSV parsing error: ' + results.errors[0].message, 'error');
        return;
      }
      
      const headers = results.meta.fields;
      if (!headers.includes('Question') || !headers.includes('Answer')) {
        showToast('CSV must contain "Question" and "Answer" columns', 'error');
        return;
      }
      
      const cards = results.data
        .filter(row => row.Question && row.Answer)
        .map(row => ({
          question: row.Question.trim(),
          answer: row.Answer.trim()
        }));
      
      if (cards.length === 0) {
        showToast('No valid cards found in CSV', 'error');
        return;
      }
      
      console.log('Importing', cards.length, 'cards...');
      
      try { 
        const response = await fetch(`${API_BASE}/importDeckApi.php`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: deckName,
            description: deckDescription,
            color: deckColor,
            cards: cards
          })
        });
        
        const data = await response.json();
        console.log('Import response:', data);
        
        if (!data.success) {
          throw new Error(data.message || 'Import failed');
        }
        
        if (modals.importDeck) modals.importDeck.hide();
        await loadDecksFromDB();
        showToast(data.message, 'success');
      } catch (error) {
        console.error('Import error:', error);
        showToast(error.message || 'Failed to import deck', 'error');
      }
    },
    error: function(error) {
      console.error('Import parse error:', error);
      showToast('CSV parsing error: ' + error.message, 'error');
    }
  });
}

async function handleExportDeck() {
  if (!state.currentDeck) return;
  
  console.log('Exporting deck:', state.currentDeck.name);
  
  try {
    const data = await apiRequest(API_ENDPOINTS.decks.single(state.currentDeck.id));
    const deck = data.deck;
    
    if (!deck.cards || deck.cards.length === 0) {
      showToast('No cards to export', 'error');
      return;
    }
    
    const csvData = [
      ['Question', 'Answer'],
      ...deck.cards.map(card => [card.question, card.answer])
    ];
    
    const csvContent = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${deck.name.replace(/[^a-z0-9]/gi, '_')}_deck.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Deck exported successfully!', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Failed to export deck', 'error');
  }
}

// Mode Toggle
document.getElementById('flipModeBtn')?.addEventListener('click', () => {
  state.studyMode = 'flip';
  document.querySelector('label[for="flipModeBtn"]')?.classList.add('active');
  document.querySelector('label[for="quizModeBtn"]')?.classList.remove('active');
});

document.getElementById('quizModeBtn')?.addEventListener('click', () => {
  state.studyMode = 'quiz';
  document.querySelector('label[for="quizModeBtn"]')?.classList.add('active');
  document.querySelector('label[for="flipModeBtn"]')?.classList.remove('active');
});

// ============================================================
// INITIALIZE - LOAD FROM DB AND SET UP EVENT LISTENERS
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - Initializing...');
  
  // Initialize modals
  modals.createDeck = new bootstrap.Modal(document.getElementById('createDeckModal'));
  modals.deckDetail = new bootstrap.Modal(document.getElementById('deckDetailModal'));
  modals.addCard = new bootstrap.Modal(document.getElementById('addCardModal'));
  modals.study = new bootstrap.Modal(document.getElementById('studyModal'));
  modals.importDeck = new bootstrap.Modal(document.getElementById('importDeckModal'));
  
  // IMMEDIATELY export to window for study.js
  window.deckDetailModal = modals.deckDetail;
  window.studyModal = modals.study;
  window.createDeckModal = modals.createDeck;
  window.addCardModal = modals.addCard;
  window.importDeckModal = modals.importDeck;
  
  console.log('Modals initialized and exported:', {
    deckDetailModal: window.deckDetailModal,
    studyModal: window.studyModal,
    hasHideFunction: typeof window.deckDetailModal?.hide === 'function'
  });
  
  // CSV Import/Export Event Listeners
  const openImportBtn = document.getElementById('openImportBtn');
  if (openImportBtn) {
    console.log('Import button found, attaching listener');
    openImportBtn.addEventListener('click', () => {
      console.log('Open Import button clicked!');
      document.getElementById('importDeckForm').reset();
      document.getElementById('csvPreview').innerHTML = '';
      if (modals.importDeck) modals.importDeck.show();
    });
  } else {
    console.error('Import button NOT found!');
  }
  
  const csvFile = document.getElementById('csvFile');
  if (csvFile) {
    console.log('CSV file input found');
    csvFile.addEventListener('change', handleFileSelect);
  } else {
    console.error('CSV file input NOT found!');
  }
  
  const importDeckBtn = document.getElementById('importDeckBtn');
  if (importDeckBtn) {
    console.log('Import deck button found');
    importDeckBtn.addEventListener('click', handleImportDeck);
  } else {
    console.error('Import deck button NOT found!');
  }
  
  const exportDeckBtn = document.getElementById('exportDeckBtn');
  if (exportDeckBtn) {
    console.log('Export deck button found');
    exportDeckBtn.addEventListener('click', handleExportDeck);
  } else {
    console.error('Export deck button NOT found!');
  }

  // Load data
  await loadDecksFromDB();
  setupLogout();
  renderArchivedDecks();
  
  const welcomeElement = document.getElementById('welcomeName');
  if (welcomeElement) {
    welcomeElement.textContent = 'User';
  }
  
  // Make modals globally accessible for study.js using Bootstrap Modal instances
  const deckDetailModalEl = document.getElementById('deckDetailModal');
  const studyModalEl = document.getElementById('studyModal');
  
  if (deckDetailModalEl) {
    window.deckDetailModal = bootstrap.Modal.getInstance(deckDetailModalEl) || modals.deckDetail;
  }
  
  if (studyModalEl) {
    window.studyModal = bootstrap.Modal.getInstance(studyModalEl) || modals.study;
  }
  
  console.log('Initialization complete!');
  console.log('Global modals set:', { 
    deckDetailModal: window.deckDetailModal, 
    studyModal: window.studyModal,
    hasHide: typeof window.deckDetailModal?.hide === 'function'
  });

  // Initialize Bootstrap tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.map(el => new bootstrap.Tooltip(el));

// Restore button actions for deck detail modal
document.getElementById('exportDeckBtn').addEventListener('click', () => {
  exportDeck(state.currentDeck);
});

document.getElementById('archiveDeckBtn').addEventListener('click', () => {
  archiveDeck(state.currentDeck);
});

document.getElementById('deleteDeckBtn').addEventListener('click', () => {
  deleteDeck(state.currentDeck);
});


});

// Keep global functions for inline onclick
window.openDeckDetail = openDeckDetail;
window.selectDeck = selectDeck;
window.deleteCard = deleteCard;
window.unarchiveDeck = unarchiveDeck;