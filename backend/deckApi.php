<?php
// deck_api.php - Deck Management API (FIXED)
error_reporting(E_ALL);
ini_set('display_errors', 0);

session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (!file_exists('conn.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database configuration file not found']);
    exit();
}

require_once 'conn.php';

if (!isset($conn) || $conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$user_id = $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'all') {
                getAllDecks($conn, $user_id);
            } elseif ($action === 'single' && isset($_GET['id'])) {
                getDeckById($conn, $user_id, $_GET['id']);
            } elseif ($action === 'stats') {
                getUserStats($conn, $user_id);
            } else {
                throw new Exception('Invalid GET action');
            }
            break;
            
        case 'POST':
            if ($action === 'create') {
                createDeck($conn, $user_id);
            } else {
                throw new Exception('Invalid POST action');
            }
            break;
            
        case 'PUT':
            if ($action === 'update' && isset($_GET['id'])) {
                updateDeck($conn, $user_id, $_GET['id']);
            } else {
                throw new Exception('Invalid PUT action');
            }
            break;
            
        case 'DELETE':
            if ($action === 'delete' && isset($_GET['id'])) {
                deleteDeck($conn, $user_id, $_GET['id']);
            } else {
                throw new Exception('Invalid DELETE action');
            }
            break;
            
        default:
            throw new Exception('Method not allowed');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

function getAllDecks($conn, $user_id) {
    $sql = "SELECT 
                d.id,
                d.name,
                d.description,
                d.color,
                d.best_score,
                d.last_accuracy,
                d.quiz_completed,
                d.last_completed,
                d.times_studied,
                d.created_at,
                d.updated_at,
                COUNT(c.id) as card_count
            FROM decks d
            LEFT JOIN cards c ON d.id = c.deck_id
            WHERE d.user_id = ?
            GROUP BY d.id
            ORDER BY d.created_at DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $decks = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (string)$row['id'];
        $row['card_count'] = (int)$row['card_count'];
        $row['best_score'] = (int)$row['best_score'];
        $row['times_studied'] = (int)$row['times_studied'];
        $row['quiz_completed'] = (bool)$row['quiz_completed'];
        $decks[] = $row;
    }
    
    echo json_encode(['success' => true, 'decks' => $decks]);
}

function getDeckById($conn, $user_id, $deck_id) {
    $sql = "SELECT * FROM decks WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $deck_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Deck not found');
    }
    
    $deck = $result->fetch_assoc();
    $deck['id'] = (string)$deck['id'];
    $deck['best_score'] = (int)$deck['best_score'];
    $deck['times_studied'] = (int)$deck['times_studied'];
    $deck['quiz_completed'] = (bool)$deck['quiz_completed'];
    
    $sql = "SELECT * FROM cards WHERE deck_id = ? ORDER BY position ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $deck_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $cards = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (string)$row['id'];
        $row['deck_id'] = (string)$row['deck_id'];
        $row['position'] = (int)$row['position'];
        $row['times_shown'] = (int)$row['times_shown'];
        $row['times_correct'] = (int)$row['times_correct'];
        $cards[] = $row;
    }
    
    $deck['cards'] = $cards;
    
    echo json_encode(['success' => true, 'deck' => $deck]);
}

// FIXED: User Statistics Function
function getUserStats($conn, $user_id) {
    // Total decks
    $sql = "SELECT COUNT(*) as total FROM decks WHERE user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $total_decks = $stmt->get_result()->fetch_assoc()['total'];
    
    // Completed decks - FIXED QUERY
    $sql = "SELECT COUNT(*) as completed
            FROM (
                SELECT d.id, d.best_score, COUNT(c.id) as card_count
                FROM decks d
                LEFT JOIN cards c ON d.id = c.deck_id
                WHERE d.user_id = ?
                GROUP BY d.id
                HAVING card_count > 0 AND d.best_score = card_count
            ) as completed_decks";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $completed_decks = $stmt->get_result()->fetch_assoc()['completed'];
    
    // Active decks (has cards but not completed)
    $active_decks = $total_decks - $completed_decks;
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'total_decks' => (int)$total_decks,
            'completed_decks' => (int)$completed_decks,
            'active_decks' => (int)$active_decks
        ]
    ]);
}

function createDeck($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['name']) || empty(trim($data['name']))) {
        throw new Exception('Deck name is required');
    }
    
    $name = trim($data['name']);
    $description = isset($data['description']) ? trim($data['description']) : null;
    $color = isset($data['color']) ? $data['color'] : 'primary';
    
    $sql = "INSERT INTO decks (user_id, name, description, color) VALUES (?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("isss", $user_id, $name, $description, $color);
    
    if ($stmt->execute()) {
        $deck_id = $conn->insert_id;
        getDeckById($conn, $user_id, $deck_id);
    } else {
        throw new Exception('Failed to create deck');
    }
}

function updateDeck($conn, $user_id, $deck_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $sql = "SELECT id FROM decks WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $deck_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        throw new Exception('Deck not found or unauthorized');
    }
    
    $updates = [];
    $types = "";
    $values = [];
    
    if (isset($data['name'])) {
        $updates[] = "name = ?";
        $types .= "s";
        $values[] = trim($data['name']);
    }
    
    if (isset($data['description'])) {
        $updates[] = "description = ?";
        $types .= "s";
        $values[] = trim($data['description']);
    }
    
    if (isset($data['color'])) {
        $updates[] = "color = ?";
        $types .= "s";
        $values[] = $data['color'];
    }
    
    if (isset($data['best_score'])) {
        $updates[] = "best_score = ?";
        $types .= "i";
        $values[] = (int)$data['best_score'];
    }
    
    if (isset($data['last_accuracy'])) {
        $updates[] = "last_accuracy = ?";
        $types .= "i";
        $values[] = (int)$data['last_accuracy'];
    }
    
    if (isset($data['quiz_completed'])) {
        $updates[] = "quiz_completed = ?";
        $types .= "i";
        $values[] = $data['quiz_completed'] ? 1 : 0;
        
        if ($data['quiz_completed']) {
            $updates[] = "last_completed = NOW()";
        }
    }
    
    if (empty($updates)) {
        throw new Exception('No fields to update');
    }
    
    $sql = "UPDATE decks SET " . implode(", ", $updates) . " WHERE id = ? AND user_id = ?";
    $types .= "ii";
    $values[] = $deck_id;
    $values[] = $user_id;
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    
    if ($stmt->execute()) {
        getDeckById($conn, $user_id, $deck_id);
    } else {
        throw new Exception('Failed to update deck');
    }
}

function deleteDeck($conn, $user_id, $deck_id) {
    $sql = "DELETE FROM decks WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $deck_id, $user_id);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(['success' => true, 'message' => 'Deck deleted successfully']);
        } else {
            throw new Exception('Deck not found or unauthorized');
        }
    } else {
        throw new Exception('Failed to delete deck');
    }
}
?>