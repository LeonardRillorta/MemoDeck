// study.js - Complete Fixed Version with Score & Progress Tracking

document.addEventListener('DOMContentLoaded', () => {
    // Remove d-none from back card to enable flipping
    const backCard = document.getElementById('cardBack');
    if (backCard) {
        backCard.classList.remove('d-none');
    }

    // Initialize quiz score globally
    window.quizScore = {
        correct: 0,
        total: 0,
        streak: 0,
        bestStreak: 0
    };

    // Initialize study state
    window.studyState = {
        sessionId: null,
        cardStartTime: null,
        quizResponses: []
    };

    // Study button - START SESSION
    document.getElementById('studyDeckBtn')?.addEventListener('click', async () => {
        if (typeof state === 'undefined' || !state.currentDeck) {
            showToast('Please select a deck first!', 'error');
            return;
        }
        
        if (!state.currentDeck.cards || state.currentDeck.cards.length === 0) {
            showToast('Add some flashcards first!', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/studyApi.php?action=start_session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deck_id: state.currentDeck.id,
                    session_type: state.studyMode
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to start session');
            }
            
            window.studyState.sessionId = data.session_id;
            state.currentCardIndex = 0;
            window.studyState.quizResponses = [];
            resetQuizScore();
             deckDetailModal.hide();
            
            if (state.studyMode === 'flip') {
                displayStudyCard();
            } else {
                displayQuizCard();
            }
            
            studyModal.show();
            document.getElementById('flipCardContainer').style.display = 
                state.studyMode === 'flip' ? 'block' : 'none';
            document.getElementById('quizContainer').style.display = 
                state.studyMode === 'quiz' ? 'block' : 'none';

            // Hide deck detail modal - try multiple methods
            const deckDetailModalEl = document.getElementById('deckDetailModal');
            if (deckDetailModalEl) {
                // Method 1: Try Bootstrap instance
                try {
                    const instance = bootstrap.Modal.getInstance(deckDetailModalEl);
                    if (instance) instance.hide();
                } catch (e) {
                    console.log('Bootstrap instance method failed:', e);
                }
                
                // Method 2: Try global variable if it exists
                if (window.deckDetailModal && typeof window.deckDetailModal.hide === 'function') {
                    window.deckDetailModal.hide();
                } else if (window.modals && window.modals.deckDetail) {
                    window.modals.deckDetail.hide();
                } else {
                    // Method 3: Manual hide
                    deckDetailModalEl.classList.remove('show');
                    deckDetailModalEl.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                }
            }
            
            if (state.studyMode === 'flip') {
                displayStudyCard();
            } else {
                displayQuizCard();
            }
            
            // Show study modal - try multiple methods
            const studyModalEl = document.getElementById('studyModal');
            if (studyModalEl) {
                // Small delay to ensure previous modal is hidden
                setTimeout(() => {
                    try {
                        // Method 1: Try Bootstrap
                        let instance = bootstrap.Modal.getInstance(studyModalEl);
                        if (!instance) {
                            instance = new bootstrap.Modal(studyModalEl);
                        }
                        instance.show();
                    } catch (e) {
                        console.log('Bootstrap show failed:', e);
                        // Method 2: Try global variable
                        if (window.studyModal && typeof window.studyModal.show === 'function') {
                            window.studyModal.show();
                        } else if (window.modals && window.modals.study) {
                            window.modals.study.show();
                        } else {
                            // Method 3: Manual show
                            studyModalEl.classList.add('show');
                            studyModalEl.style.display = 'block';
                            document.body.classList.add('modal-open');
                            const backdrop = document.createElement('div');
                            backdrop.className = 'modal-backdrop fade show';
                            document.body.appendChild(backdrop);
                        }
                    }
                }, 300);
            }
        } catch (error) {
            console.error('Failed to start study session:', error);
            showToast(error.message || 'Failed to start session', 'error');
        }
    });

    // Card flipping with progress tracking
    const flashcard = document.querySelector('.flashcard-study');
    if (flashcard) {
        flashcard.addEventListener('click', async () => {
            flashcard.classList.toggle('flipped');
            
            if (flashcard.classList.contains('flipped') && window.studyState.sessionId) {
                const timeSpent = Math.floor((Date.now() - window.studyState.cardStartTime) / 1000);
                
                try {
                    await fetch(`${API_BASE}/studyApi.php?action=update_progress`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: window.studyState.sessionId,
                            card_id: state.currentDeck.cards[state.currentCardIndex].id,
                            flipped: 1,
                            time_spent_seconds: timeSpent
                        })
                    });
                } catch (error) {
                    console.error('Failed to track progress:', error);
                }
            }
        });
    }

    // Navigation buttons
    document.getElementById('prevCardBtn')?.addEventListener('click', () => {
        if (state.currentCardIndex > 0) {
            state.currentCardIndex--;
            const flashcard = document.querySelector('.flashcard-study');
            if (flashcard) {
                flashcard.classList.remove('flipped');
            }
            displayStudyCard();
        }
    });

    document.getElementById('nextCardBtn')?.addEventListener('click', async () => {
        if (state.currentCardIndex < state.currentDeck.cards.length - 1) {
            state.currentCardIndex++;
            const flashcard = document.querySelector('.flashcard-study');
            if (flashcard) {
                flashcard.classList.remove('flipped');
            }
            displayStudyCard();
        } else {
            try {
                await fetch(`${API_BASE}/studyApi.php?action=complete_session`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },            
                    body: JSON.stringify({
                        session_id: window.studyState.sessionId
                    })
                });
                
                // Use Bootstrap Modal directly
                const studyModalEl = document.getElementById('studyModal');
                const studyModalInstance = bootstrap.Modal.getInstance(studyModalEl);
                if (studyModalInstance) {
                    studyModalInstance.hide();
                }
                
                await loadDecksFromDB();
                await openDeckDetail(state.currentDeck.id);
                showToast('Study session complete! Great work!', 'success');
            } catch (error) {
                console.error('Failed to complete session:', error);
                const studyModalEl = document.getElementById('studyModal');
                const studyModalInstance = bootstrap.Modal.getInstance(studyModalEl);
                if (studyModalInstance) {
                    studyModalInstance.hide();
                }
            }
        }
    });

    // Quiz mode handlers
    const quizInput = document.getElementById('quizInput');
    const submitBtn = document.getElementById('submitBtn');
    const skipBtn = document.getElementById('skipBtn');
    const nextBtn = document.getElementById('nextBtn');

    quizInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !quizInput.disabled) {
            e.preventDefault();
            checkAnswer();
        }
    });

    submitBtn?.addEventListener('click', checkAnswer);
    skipBtn?.addEventListener('click', skipQuestion);
    nextBtn?.addEventListener('click', nextQuestion);
});

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function displayStudyCard() {
    const deck = state.currentDeck;
    const card = deck.cards[state.currentCardIndex];

    if (!card) return;

    window.studyState.cardStartTime = Date.now();

    document.getElementById('studyDeckTitle').textContent = deck.name;
    document.getElementById('cardProgress').textContent = 
        `Card ${state.currentCardIndex + 1} of ${deck.cards.length}`;

    document.getElementById('cardFrontContent').textContent = card.question;
    document.getElementById('cardBackContent').textContent = card.answer;

    const flashcard = document.querySelector('.flashcard-study');
    if (flashcard) {
        flashcard.classList.remove('flipped');
    }

    document.getElementById('prevCardBtn').disabled = state.currentCardIndex === 0;
    document.getElementById('nextCardBtn').disabled = 
        state.currentCardIndex === deck.cards.length - 1;
}

function displayQuizCard() {
    const deck = state.currentDeck;
    const card = deck.cards[state.currentCardIndex];
    
    if (!card) return;

    window.studyState.cardStartTime = Date.now();

    const studyDeckTitle = document.getElementById('studyDeckTitle');
    const cardProgress = document.getElementById('cardProgress');
    
    if (studyDeckTitle) {
        studyDeckTitle.textContent = deck.name;
    }
    
    if (cardProgress) {
        cardProgress.textContent = `Question ${state.currentCardIndex + 1} of ${deck.cards.length}`;
    }

    // Update score display
    displayQuizScore();

    const quizQuestion = document.getElementById('quizQuestion');
    if (!quizQuestion) {
        showToast('Quiz interface error - please try again', 'error');
        return;
    }
    quizQuestion.textContent = card.question;
    
    const quizInput = document.getElementById('quizInput');
    if (quizInput) {
        quizInput.value = '';
        quizInput.disabled = false;
        quizInput.className = 'quiz-input';
        setTimeout(() => quizInput.focus(), 100);
    }

    const quizFeedback = document.getElementById('quizFeedback');
    if (quizFeedback) {
        quizFeedback.classList.remove('show', 'correct', 'incorrect');
    }
    
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) {
        feedbackMessage.innerHTML = '';
    }
    
    const correctAnswer = document.getElementById('correctAnswer');
    if (correctAnswer) {
        correctAnswer.style.display = 'none';
    }
    
    const submitBtn = document.getElementById('submitBtn');
    const nextBtn = document.getElementById('nextBtn');
    const skipBtn = document.getElementById('skipBtn');
    
    if (submitBtn) submitBtn.style.display = 'inline-block';
    if (nextBtn) nextBtn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'inline-block';
}

function displayQuizScore() {
    const existingScore = document.querySelector('.quiz-score');
    if (existingScore) {
        existingScore.remove();
    }
    
    const streakHTML = window.quizScore.streak >= 3 
        ? `<span class="quiz-streak">🔥 ${window.quizScore.streak}</span>` 
        : '';
    
    const scoreHTML = `
        <div class="quiz-score">
            Score: <strong>${window.quizScore.correct}/${window.quizScore.total}</strong>
            ${streakHTML}
        </div>
    `;
    
    const studyHeader = document.querySelector('.study-header');
    if (studyHeader) {
        studyHeader.insertAdjacentHTML('beforeend', scoreHTML);
    }
}

// ============================================
// QUIZ FUNCTIONS
// ============================================

function checkAnswer() {
    const userAnswer = document.getElementById('quizInput').value.trim();
    const card = state.currentDeck.cards[state.currentCardIndex];
    const correctAnswer = card.answer;
    
    if (!userAnswer) {
        showToast('Please enter an answer', 'error');
        return;
    }

    const timeSpent = Math.floor((Date.now() - window.studyState.cardStartTime) / 1000);
    const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    // UPDATE SCORE
    window.quizScore.total++;
    if (isCorrect) {
        window.quizScore.correct++;
        window.quizScore.streak++;
        if (window.quizScore.streak > window.quizScore.bestStreak) {
            window.quizScore.bestStreak = window.quizScore.streak;
        }
    } else {
        window.quizScore.streak = 0;
    }
    
    const accuracy = Math.round((window.quizScore.correct / window.quizScore.total) * 100);
    
    // Store response
    window.studyState.quizResponses.push({
        card_id: card.id,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect ? 1 : 0,
        skipped: 0,
        response_time_seconds: timeSpent
    });
    
    // Update UI
    const feedback = document.getElementById('quizFeedback');
    const input = document.getElementById('quizInput');
    
    input.disabled = true;
    document.getElementById('submitBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'inline-block';
    document.getElementById('skipBtn').style.display = 'none';
    
    if (isCorrect) {
        input.classList.add('correct');
        feedback.classList.add('show', 'correct');
        
        let feedbackText = '<strong>✓ Correct!</strong>';
        if (window.quizScore.streak >= 3) {
            feedbackText += ` 🔥 ${window.quizScore.streak} streak`;
        }
        feedbackText += `<div style="margin-top: 8px; opacity: 0.7;">Accuracy: ${accuracy}%</div>`;
        document.getElementById('feedbackMessage').innerHTML = feedbackText;
    } else {
        input.classList.add('incorrect');
        feedback.classList.add('show', 'incorrect');
        document.getElementById('feedbackMessage').innerHTML = 
            `<strong>✗ Incorrect</strong>
             <div style="margin-top: 8px; opacity: 0.7;">Accuracy: ${accuracy}%</div>`;
        document.getElementById('correctAnswer').style.display = 'block';
        document.getElementById('correctAnswer').innerHTML = 
            `Correct answer: <strong>${correctAnswer}</strong>`;
    }
    
    displayQuizScore();
}

function skipQuestion() {
    const card = state.currentDeck.cards[state.currentCardIndex];
    
    window.studyState.quizResponses.push({
        card_id: card.id,
        user_answer: null,
        correct_answer: card.answer,
        is_correct: 0,
        skipped: 1,
        response_time_seconds: Math.floor((Date.now() - window.studyState.cardStartTime) / 1000)
    });
    
    window.quizScore.total++;
    window.quizScore.streak = 0;
    
    if (state.currentCardIndex < state.currentDeck.cards.length - 1) {
        state.currentCardIndex++;
        displayQuizCard();
    } else {
        showQuizSummary();
    }
}

function nextQuestion() {
    if (state.currentCardIndex < state.currentDeck.cards.length - 1) {
        state.currentCardIndex++;
        displayQuizCard();
    } else {
        showQuizSummary();
    }
}

async function showQuizSummary() {
    const accuracy = window.quizScore.total > 0 
        ? Math.round((window.quizScore.correct / window.quizScore.total) * 100) 
        : 0;
    
    // Save quiz results
    try {
        await fetch(`${API_BASE}/studyApi.php?action=save_quiz_attempt`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: window.studyState.sessionId,
                deck_id: state.currentDeck.id,
                score: window.quizScore.correct,
                total_questions: window.quizScore.total,
                best_streak: window.quizScore.bestStreak,
                completed: 1,
                responses: window.studyState.quizResponses
            })
        });
        
        // Update deck stats
        const newBestScore = Math.max(state.currentDeck.best_score || 0, window.quizScore.correct);
        const isComplete = window.quizScore.correct === state.currentDeck.cards.length;
        
        await fetch(`${API_BASE}/deckApi.php?action=update&id=${state.currentDeck.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                best_score: newBestScore,
                last_accuracy: accuracy,
                quiz_completed: isComplete ? 1 : 0
            })
        });
    } catch (error) {
        console.error('Failed to save quiz:', error);
    }
    
    // Determine performance
    let performanceIcon, performanceText;
    
    if (accuracy >= 90) {
        performanceIcon = '🏆';
        performanceText = 'Outstanding!';
    } else if (accuracy >= 75) {
        performanceIcon = '🌟';
        performanceText = 'Great Job!';
    } else if (accuracy >= 60) {
        performanceIcon = '👍';
        performanceText = 'Good Effort!';
    } else {
        performanceIcon = '📚';
        performanceText = 'Keep Practicing!';
    }
    
    const summaryHtml = `
        <div class="quiz-summary">
            <div class="summary-header">
                <div class="summary-icon">${performanceIcon}</div>
                <h2>${performanceText}</h2>
                <p>You've completed the quiz</p>
            </div>
            
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-value">${window.quizScore.correct}</div>
                    <div class="stat-label">Correct</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-value">${accuracy}%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-value">${window.quizScore.total}</div>
                    <div class="stat-label">Total</div>
                </div>
                
                ${window.quizScore.bestStreak >= 3 ? `
                <div class="stat-item">
                    <div class="stat-value">${window.quizScore.bestStreak}</div>
                    <div class="stat-label">Best Streak</div>
                </div>
                ` : ''}
            </div>
            
            <div class="summary-actions">
                <button class="btn btn-primary btn-lg" onclick="finishQuiz()">
                    <i class="fas fa-check me-1"></i>Continue
                </button>
                <button class="btn btn-outline-primary btn-lg" onclick="retakeQuiz()">
                    <i class="fas fa-redo me-1"></i>Retake Quiz
                </button>
            </div>
        </div>
    `;
    
    document.querySelector('.quiz-container').innerHTML = summaryHtml;
}

async function finishQuiz() {
    // Use Bootstrap Modal directly
    const studyModalEl = document.getElementById('studyModal');
    const studyModalInstance = bootstrap.Modal.getInstance(studyModalEl);
    if (studyModalInstance) {
        studyModalInstance.hide();
    }
    
    await loadDecksFromDB();
    await openDeckDetail(state.currentDeck.id);
    resetQuizScore();
}

async function retakeQuiz() {
    state.currentCardIndex = 0;
    window.studyState.quizResponses = [];
    resetQuizScore();
    
    try {
        const response = await fetch(`${API_BASE}/studyApi.php?action=start_session`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deck_id: state.currentDeck.id,
                session_type: 'quiz'
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to start quiz');
        }
        
        window.studyState.sessionId = data.session_id;
        
        const studyModalBody = document.querySelector('#studyModal .modal-body');
        
        if (!studyModalBody) {
            throw new Error('Study modal body not found');
        }
        
        studyModalBody.innerHTML = `
            <div class="study-header">
                <div class="study-title">
                    <h4 id="studyDeckTitle">${state.currentDeck.name}</h4>
                    <p id="cardProgress" class="card-progress">Question 1 of ${state.currentDeck.cards.length}</p>
                </div>
            </div>
            
            <div id="quizContainer" class="quiz-container" style="display: block;">
                <div class="quiz-card">
                    <h3 id="quizQuestion" class="quiz-question">Loading...</h3>
                    <input type="text" id="quizInput" class="quiz-input" placeholder="Type your answer..." autocomplete="off">
                    <div id="quizFeedback" class="quiz-feedback">
                        <p id="feedbackMessage"></p>
                        <p id="correctAnswer" style="display: none;"></p>
                    </div>
                    <div class="quiz-actions">
                        <button id="submitBtn" class="btn btn-primary">
                            <i class="fas fa-check me-2"></i>Submit
                        </button>
                        <button id="nextBtn" class="btn btn-primary" style="display: none;">
                            <i class="fas fa-arrow-right me-2"></i>Next
                        </button>
                        <button id="skipBtn" class="btn btn-outline-secondary">
                            <i class="fas fa-forward me-2"></i>Skip
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const submitBtn = document.getElementById('submitBtn');
        const skipBtn = document.getElementById('skipBtn');
        const nextBtn = document.getElementById('nextBtn');
        const quizInput = document.getElementById('quizInput');
        
        if (!submitBtn || !skipBtn || !nextBtn || !quizInput) {
            throw new Error('Quiz elements not properly created');
        }
        
        submitBtn.addEventListener('click', checkAnswer);
        skipBtn.addEventListener('click', skipQuestion);
        nextBtn.addEventListener('click', nextQuestion);
        
        quizInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !quizInput.disabled) {
                e.preventDefault();
                checkAnswer();
            }
        });
        
        displayQuizCard();
        showToast('Quiz restarted! Good luck!', 'success');
        
    } catch (error) {
        console.error('Failed to restart quiz:', error);
        showToast(error.message || 'Failed to restart quiz', 'error');
        
        try {
            const studyModalEl = document.getElementById('studyModal');
            const studyModalInstance = bootstrap.Modal.getInstance(studyModalEl);
            if (studyModalInstance) {
                studyModalInstance.hide();
            }
            await openDeckDetail(state.currentDeck.id);
        } catch (fallbackError) {
            console.error('Fallback failed:', fallbackError);
        }
    }
}

function resetQuizScore() {
    window.quizScore = {
        correct: 0,
        total: 0,
        streak: 0,
        bestStreak: 0
    };
}   