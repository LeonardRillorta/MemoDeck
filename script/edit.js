

let editDeckModal, editCardModal;
let currentEditCardId = null;

// Wait for page to fully load
window.addEventListener('load', function() {
    
    setTimeout(function() {
        initializeEdit();
    }, 500);
});

function initializeEdit() {
    
    // Initialize Bootstrap modals
    const editDeckModalEl = document.getElementById('editDeckModal');
    const editCardModalEl = document.getElementById('editCardModal');
    
    if (editDeckModalEl) {
        editDeckModal = new bootstrap.Modal(editDeckModalEl);
    } else {
        console.error('❌ Edit Deck Modal not found! Did you add the HTML?');
        return;
    }
    
    if (editCardModalEl) {
        editCardModal = new bootstrap.Modal(editCardModalEl);
    } else {
        console.error('❌ Edit Card Modal not found! Did you add the HTML?');
        return;
    }
    
    // Attach button listeners
    attachButtonListeners();
    
    // Override renderCards to add edit buttons
    overrideRenderCards();
    
    // Override openDeckDetail to add edit deck button
    overrideOpenDeckDetail();
    
}

// ============================================
// ATTACH BUTTON LISTENERS
// ============================================
function attachButtonListeners() {
    // Update Deck Button
    const updateDeckBtn = document.getElementById('updateDeckBtn');
    if (updateDeckBtn) {
        updateDeckBtn.onclick = updateDeck;
    }
    
    // Update Card Button
    const updateCardBtn = document.getElementById('updateCardBtn');
    if (updateCardBtn) {
        updateCardBtn.onclick = updateCard;
    }
    
    // Clear forms on modal close
    document.getElementById('editCardModal')?.addEventListener('hidden.bs.modal', function() {
        currentEditCardId = null;
        document.getElementById('editCardForm')?.reset();
    });
    
    document.getElementById('editDeckModal')?.addEventListener('hidden.bs.modal', function() {
        document.getElementById('editDeckForm')?.reset();
    });
}

// ============================================
// EDIT DECK FUNCTIONS
// ============================================
window.openEditDeck = async function(deckId) {
    
    if (!deckId) {
        showToast('No deck selected', 'error');
        return;
    }
    
    try {
        // Load deck data
        const response = await fetch(API_ENDPOINTS.decks.single(deckId), {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const deck = data.deck;
        
        // Fill form
        document.getElementById('editDeckName').value = deck.name || '';
        document.getElementById('editDeckDescription').value = deck.description || '';
        
        // Set color
        const colorRadio = document.querySelector(`input[name="editDeckColor"][value="${deck.color || 'primary'}"]`);
        if (colorRadio) {
            colorRadio.checked = true;
        }
        
        // Show modal
        editDeckModal.show();
        
    } catch (error) {
        console.error('Error loading deck:', error);
        showToast('Failed to load deck', 'error');
    }
};

async function updateDeck() {
    
    const name = document.getElementById('editDeckName').value.trim();
    const description = document.getElementById('editDeckDescription').value.trim();
    const color = document.querySelector('input[name="editDeckColor"]:checked')?.value || 'primary';
    
    if (!name) {
        showToast('Please enter a deck name', 'error');
        return;
    }
    
    if (!state.currentDeck) {
        showToast('No deck selected', 'error');
        return;
    }
    
    try {
        const updateBtn = document.getElementById('updateDeckBtn');
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        
        const response = await fetch(API_ENDPOINTS.decks.update(state.currentDeck.id), {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, color })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        editDeckModal.hide();
        await loadDecksFromDB();
        await openDeckDetail(state.currentDeck.id);
        showToast('Deck updated!', 'success');
        
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
        
    } catch (error) {
        console.error('Error updating deck:', error);
        showToast('Failed to update deck', 'error');
        
        const updateBtn = document.getElementById('updateDeckBtn');
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
    }
}

// ============================================
// EDIT CARD FUNCTIONS
// ============================================
window.openEditCard = function(cardId) {
    
    if (!state.currentDeck || !state.currentDeck.cards) {
        showToast('No deck loaded', 'error');
        return;
    }
    
    const card = state.currentDeck.cards.find(c => c.id == cardId);
    
    if (!card) {
        showToast('Card not found', 'error');
        return;
    }
    
    currentEditCardId = cardId;
    
    document.getElementById('editCardQuestion').value = card.question || '';
    document.getElementById('editCardAnswer').value = card.answer || '';
    
    editCardModal.show();
};

async function updateCard() {
    
    const question = document.getElementById('editCardQuestion').value.trim();
    const answer = document.getElementById('editCardAnswer').value.trim();
    
    if (!question || !answer) {
        showToast('Please fill in both fields', 'error');
        return;
    }
    
    if (!currentEditCardId) {
        showToast('No card selected', 'error');
        return;
    }
    
    try {
        const updateBtn = document.getElementById('updateCardBtn');
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        
        const response = await fetch(`${API_BASE}/CardApi.php?action=update&id=${currentEditCardId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, answer })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        editCardModal.hide();
        currentEditCardId = null;
        await openDeckDetail(state.currentDeck.id);
        showToast('Card updated!', 'success');
        
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
        
    } catch (error) {
        console.error('Error updating card:', error);
        showToast('Failed to update card', 'error');
        
        const updateBtn = document.getElementById('updateCardBtn');
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
    }
}

// ============================================
// OVERRIDE RENDER CARDS TO ADD EDIT BUTTON
// ============================================
function overrideRenderCards() {
    
    // Save original if exists
    window._originalRenderCards = window.renderCards;
    
    // New renderCards with edit button
    window.renderCards = function() {
        const cardsContainer = document.getElementById('cardsList');
        
        if (!state.currentDeck || !state.currentDeck.cards || state.currentDeck.cards.length === 0) {
            cardsContainer.innerHTML = '<p class="text-muted text-center py-4">No flashcards yet. Add one to start!</p>';
            return;
        }
        
        cardsContainer.innerHTML = state.currentDeck.cards.map((card) => `
            <div class="card-item">
                <div class="card-item-content">
                    <div class="card-item-question">${escapeHtml(card.question)}</div>
                    <div class="card-item-answer">${escapeHtml(card.answer)}</div>
                </div>
                <div class="card-item-actions">
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="openEditCard('${card.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCard('${card.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    };
    
}

// ============================================
// OVERRIDE OPEN DECK DETAIL TO ADD EDIT BUTTON
// ============================================
function overrideOpenDeckDetail() {
    
    // Save original
    window._originalOpenDeckDetail = window.openDeckDetail;
    
    // New openDeckDetail with edit button
    window.openDeckDetail = async function(deckId) {
        await window._originalOpenDeckDetail(deckId);
        
        setTimeout(function() {
            addEditDeckButton();
        }, 100);
    };
    
}
function addEditDeckButton() {
    // Remove existing button if it exists
    const existingBtn = document.getElementById('editDeckHeaderBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    const modalHeader = document.querySelector('#deckDetailModal .modal-header');
    if (!modalHeader) return;

    // Create the edit button
    const editBtn = document.createElement('button');
    editBtn.id = 'editDeckHeaderBtn';
    editBtn.className = 'btn btn-sm btn-outline-primary ms-2'; // Use ms-2 for margin start
    editBtn.innerHTML = '<i class="fas fa-edit me-1"></i>Edit Deck';
    editBtn.onclick = function() {
        if (state.currentDeck) {
            openEditDeck(state.currentDeck.id);
        }
    };

    modalHeader.appendChild(editBtn);
}

// ============================================
// HELPER FUNCTION
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

