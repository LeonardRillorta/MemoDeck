// Progress.js - FIXED: Uses real backend API
const API_URL = 'http://localhost/MemoDeck/backend/progressApi.php';

let pieChart = null;
let lineChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProgressFromAPI();
    setupLogout();

    document.getElementById('refreshProgress')?.addEventListener('click', loadProgressFromAPI);
    document.getElementById('downloadReport')?.addEventListener('click', downloadCSV);
});

function setupLogout() {
    const logoutBtn = document.getElementById('sidebarLogout');
    if (!logoutBtn) return;
    
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Logout?')) {
            try {
                const response = await fetch('http://localhost/MemoDeck/backend/logout.php', {
                    method: 'POST',
                    credentials: 'include'
                });
                if (response.ok) {
                    window.location.replace('/MemoDeck/Memodeck/index.html');
                } else {
                    alert('Logout failed');
                }
            } catch (err) {
                console.error('Logout error:', err);
                alert('Logout failed. Please try again.');
            }
        }
    });
}

async function loadProgressFromAPI() {
    try {
        const response = await fetch(API_URL, {
            credentials: 'include'
        });

        if (response.status === 401) {
            window.location.href = '/MemoDeck/Memodeck/index.html';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            renderProgressFromData(result.data);
        } else {
            showError(result.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showError('Failed to load progress data. Check console.');
    }
}

function renderProgressFromData(data) {
    // Update summary
    document.getElementById('p_totalDecks').textContent = data.summary.totalDecks;
    document.getElementById('p_totalCards').textContent = data.summary.totalCards;
    document.getElementById('p_masteredCards').textContent = data.summary.masteredCards;
    document.getElementById('p_completedDecks').textContent = data.summary.completedDecks;
    document.getElementById('p_streak').textContent = data.summary.streak + ' days';

    // Render decks table
    const tbody = document.querySelector('#progressTable tbody');
    tbody.innerHTML = '';

    if (data.decks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No decks yet. <a href="Main.html">Create one!</a></td></tr>`;
        renderCharts(data.summary, data.weekly);
        return;
    }

    data.decks.forEach(deck => {
        const statusClass = deck.status === 'Completed' ? 'success' : 
                           deck.status === 'In Progress' ? 'warning' : 'secondary';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(deck.name)}</strong></td>
            <td>${deck.totalCards}</td>
            <td>${deck.bestScore}</td>
            <td>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar ${deck.status === 'Completed' ? 'bg-success' : ''}" 
                         style="width: ${deck.progressPercentage}%">
                        ${deck.progressPercentage}%
                    </div>
                </div>
            </td>
            <td><span class="badge bg-${statusClass}">${deck.status}</span></td>
        `;
        tbody.appendChild(row);
    });

    renderCharts(data.summary, data.weekly);
}

function renderCharts(summary, weekly) {
    // Pie Chart
    const pieCtx = document.getElementById('completionPie');
    if (pieCtx) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Mastered', 'Remaining'],
                datasets: [{
                    data: [
                        summary.masteredCards,
                        Math.max(0, summary.totalCards - summary.masteredCards)
                    ],
                    backgroundColor: ['#10B981', '#E5E7EB']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Line Chart
    const lineCtx = document.getElementById('weeklyStudy');
    if (lineCtx) {
        if (lineChart) lineChart.destroy();
        lineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: weekly.map(d => d.dayName),
                datasets: [{
                    label: 'Minutes',
                    data: weekly.map(d => d.minutes),
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79,70,229,0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>'"`]/g, s => ({
        '&': '&amp;',
        '<': '<',
        '>': '>',
        '"': '&quot;',
        "'": '&#39;'
    })[s]);
}

function downloadCSV() {
    const table = document.getElementById('progressTable');
    let csv = 'Deck Name,Total Cards,Best Score,Progress,Status\n';
    
    table.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 5) {
            csv += `"${cells[0].textContent.trim()}",`;
            csv += `${cells[1].textContent},`;
            csv += `${cells[2].textContent},`;
            csv += `${cells[3].textContent.trim()},`;
            csv += `"${cells[4].textContent}"\n`;
        }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progress-report.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function showError(message) {
    const tbody = document.querySelector('#progressTable tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center text-danger py-4">
                Error: ${message}
                <button class="btn btn-sm btn-primary mt-2" onclick="loadProgressFromAPI()">Retry</button>
            </td>
        </tr>
    `;
}