<?php
// progress.php - Fixed and secure version
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Credentials: true');

if (!isset($_SESSION['user']['id']) || !is_numeric($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit();
}

require_once 'conn.php';
$user_id = (int)$_SESSION['user']['id'];

$summary = [
    'totalDecks' => 0,
    'totalCards' => 0,
    'masteredCards' => 0,
    'completedDecks' => 0,
    'streak' => 0,
    'totalStudyTime' => 0,
    'averageAccuracy' => 0
];

// Total decks
$stmt = $conn->prepare("SELECT COUNT(*) FROM decks WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$summary['totalDecks'] = $stmt->get_result()->fetch_row()[0];

// Total cards
$stmt = $conn->prepare("SELECT COUNT(*) FROM cards c JOIN decks d ON c.deck_id = d.id WHERE d.user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$summary['totalCards'] = (int)$stmt->get_result()->fetch_row()[0];

// Mastered cards: use card_performance or quiz logic?
// Since you don't use card_performance in UI, stick to best_score per deck,
// but only count a card as "mastered" if the user ever got it right in a perfect run?
// For now, keep your logic but clarify: "masteredCards = sum of best_score across decks"
// This is NOT actual mastered cards, but max correct in best quiz per deck.

$stmt = $conn->prepare("SELECT SUM(best_score) FROM decks WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$mastered = $stmt->get_result()->fetch_row()[0];
$summary['masteredCards'] = (int)($mastered ?? 0);

// Completed decks: decks where best_score == total cards in deck
$stmt = $conn->prepare("
    SELECT COUNT(*)
    FROM decks d
    WHERE d.user_id = ?
    AND d.best_score = (
        SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id
    )
    AND EXISTS (SELECT 1 FROM cards c WHERE c.deck_id = d.id)
");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$summary['completedDecks'] = $stmt->get_result()->fetch_row()[0];

// User stats
$stmt = $conn->prepare("SELECT study_streak, total_study_time, average_accuracy FROM user_statistics WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$stats = $stmt->get_result()->fetch_assoc();
if ($stats) {
    $summary['streak'] = (int)$stats['study_streak'];
    $summary['totalStudyTime'] = (int)$stats['total_study_time'];
    $summary['averageAccuracy'] = $stats['average_accuracy'] !== null ? round((float)$stats['average_accuracy'], 2) : 0;
}

// Decks with progress
$stmt = $conn->prepare("
    SELECT 
        d.id, d.name, d.color, d.best_score,
        COUNT(c.id) as total_cards,
        CASE 
            WHEN COUNT(c.id) > 0 THEN ROUND((d.best_score / COUNT(c.id)) * 100)
            ELSE 0 
        END as progress,
        CASE 
            WHEN COUNT(c.id) > 0 AND d.best_score = COUNT(c.id) THEN 'Completed'
            WHEN d.times_studied > 0 THEN 'In Progress'
            ELSE 'Not Started'
        END as status
    FROM decks d
    LEFT JOIN cards c ON d.id = c.deck_id
    WHERE d.user_id = ?
    GROUP BY d.id, d.name, d.color, d.best_score, d.times_studied
    ORDER BY 
        CASE WHEN COUNT(c.id) > 0 AND d.best_score = COUNT(c.id) THEN 1 ELSE 0 END DESC,
        d.name
");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$decks = [];
while ($deck = $result->fetch_assoc()) {
    $decks[] = [
        'id' => (int)$deck['id'],
        'name' => htmlspecialchars($deck['name']),
        'color' => $deck['color'] ?? 'primary',
        'totalCards' => (int)$deck['total_cards'],
        'bestScore' => (int)$deck['best_score'],
        'progressPercentage' => (int)$deck['progress'],
        'status' => $deck['status']
    ];
}

// Weekly study data
$weekly = [];
for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $weekly[$date] = [
        'dayName' => date('D', strtotime($date)),
        'minutes' => 0
    ];
}

$stmt = $conn->prepare("
    SELECT DATE(session_date) as date, SUM(duration_seconds) as seconds
    FROM study_sessions
    WHERE user_id = ? AND completed = 1
    AND session_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(session_date)
");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $date = $row['date'];
    if (isset($weekly[$date])) {
        $weekly[$date]['minutes'] = max(0, round(((int)$row['seconds']) / 60));
    }
}

echo json_encode([
    'success' => true,
    'data' => [
        'summary' => $summary,
        'decks' => $decks,
        'weekly' => array_values($weekly)
    ]
]);
?>