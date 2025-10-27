<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost'); // Safer than *
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$servername = "localhost";
$username = "root";
$password = ""; 
$dbname = "memodeck";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}


if (!isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit();
}

$user_id = $_SESSION['user']['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
    exit();
}

if (empty($data['name']) || empty($data['cards']) || !is_array($data['cards'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields: name and cards array']);
    exit();
}

$deck_name = trim($data['name']);
$deck_description = isset($data['description']) ? trim($data['description']) : '';
$deck_color = isset($data['color']) ? $data['color'] : 'primary';
$cards = $data['cards'];

if (count($cards) === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'At least one card is required']);
    exit();
}

try {
    $conn->begin_transaction();
    $stmt = $conn->prepare("INSERT INTO decks (user_id, name, description, color) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isss", $user_id, $deck_name, $deck_description, $deck_color);
    if (!$stmt->execute()) {
        throw new Exception('Failed to create deck');
    }
    $deck_id = $conn->insert_id;
    $stmt->close();

    $success_count = 0;
    $fail_count = 0;
    $stmt = $conn->prepare("INSERT INTO cards (deck_id, question, answer, position) VALUES (?, ?, ?, ?)");
    foreach ($cards as $index => $card) {
        if (empty($card['question']) || empty($card['answer'])) {
            $fail_count++;
            continue;
        }
        $question = trim($card['question']);
        $answer = trim($card['answer']);
        $position = $index;
        $stmt->bind_param("issi", $deck_id, $question, $answer, $position);
        if ($stmt->execute()) {
            $success_count++;
        } else {
            $fail_count++;
        }
    }
    $stmt->close();

    if ($success_count === 0) {
        $conn->rollback();
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No cards could be imported']);
        exit();
    }

    $conn->commit();

    $stmt = $conn->prepare("SELECT d.*, (SELECT COUNT(*) FROM cards WHERE deck_id = d.id) as card_count FROM decks d WHERE d.id = ?");
    $stmt->bind_param("i", $deck_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $deck = $result->fetch_assoc();
    $stmt->close();

    echo json_encode([
        'success' => true,
        'message' => "Deck imported successfully with {$success_count} cards" . ($fail_count > 0 ? " ({$fail_count} failed)" : ""),
        'deck' => $deck,
        'stats' => [
            'total_cards' => count($cards),
            'success_count' => $success_count,
            'fail_count' => $fail_count
        ]
    ]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Import failed: ' . $e->getMessage()]);
}
$conn->close();
?>