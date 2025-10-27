<?php
// card_api.php - Card Management API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();
require_once 'conn.php';

// Check if user is logged in
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
            if ($action === 'deck' && isset($_GET['deck_id'])) {
                getCardsByDeck($conn, $user_id, $_GET['deck_id']);
            } elseif ($action === 'single' && isset($_GET['id'])) {
                getCardById($conn, $user_id, $_GET['id']);
            } else {
                throw new Exception('Invalid GET action');
            }
            break;
            
        case 'POST':
            if ($action === 'create') {
                createCard($conn, $user_id);
            } else {
                throw new Exception('Invalid POST action');
            }
            break;
            
        case 'PUT':
            if ($action === 'update' && isset($_GET['id'])) {
                updateCard($conn, $user_id, $_GET['id']);
            } elseif ($action === 'reorder') {
                reorderCards($conn, $user_id);
            } else {
                throw new Exception('Invalid PUT action');
            }
            break;
            
        case 'DELETE':
            if ($action === 'delete' && isset($_GET['id'])) {
                deleteCard($conn, $user_id, $_GET['id']);
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

// Verify deck ownership
function verifyDeckOwnership($conn, $user_id, $deck_id) {
    $sql = "SELECT id FROM decks WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $deck_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        throw new Exception('Deck not found or unauthorized');
    }
}

// Get all cards for a deck
function getCardsByDeck($conn, $user_id, $deck_id) {
    verifyDeckOwnership($conn, $user_id, $deck_id);
    
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
    
    echo json_encode(['success' => true, 'cards' => $cards]);
}

// Get single card
function getCardById($conn, $user_id, $card_id) {
    $sql = "SELECT c.* FROM cards c
            INNER JOIN decks d ON c.deck_id = d.id
            WHERE c.id = ? AND d.user_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $card_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Card not found or unauthorized');
    }
    
    $card = $result->fetch_assoc();
    $card['id'] = (string)$card['id'];
    $card['deck_id'] = (string)$card['deck_id'];
    $card['position'] = (int)$card['position'];
    $card['times_shown'] = (int)$card['times_shown'];
    $card['times_correct'] = (int)$card['times_correct'];
    
    echo json_encode(['success' => true, 'card' => $card]);
}

// Create new card
function createCard($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['deck_id']) || !isset($data['question']) || !isset($data['answer'])) {
        throw new Exception('Deck ID, question, and answer are required');
    }
    
    $deck_id = (int)$data['deck_id'];
    $question = trim($data['question']);
    $answer = trim($data['answer']);
    
    if (empty($question) || empty($answer)) {
        throw new Exception('Question and answer cannot be empty');
    }
    
    // Verify deck ownership
    verifyDeckOwnership($conn, $user_id, $deck_id);
    
    // Get next position
    $sql = "SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM cards WHERE deck_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $deck_id);
    $stmt->execute();
    $position = $stmt->get_result()->fetch_assoc()['next_position'];
    
    // Insert card
    $sql = "INSERT INTO cards (deck_id, question, answer, position) VALUES (?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("issi", $deck_id, $question, $answer, $position);
    
    if ($stmt->execute()) {
        $card_id = $conn->insert_id;
        
        // Reset deck completion status when new card is added
        $sql = "UPDATE decks SET quiz_completed = 0 WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $deck_id);
        $stmt->execute();
        
        // Get the created card
        getCardById($conn, $user_id, $card_id);
    } else {
        throw new Exception('Failed to create card');
    }
}

// Update card
function updateCard($conn, $user_id, $card_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verify card ownership through deck
    $sql = "SELECT c.deck_id FROM cards c
            INNER JOIN decks d ON c.deck_id = d.id
            WHERE c.id = ? AND d.user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $card_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Card not found or unauthorized');
    }
    
    $deck_id = $result->fetch_assoc()['deck_id'];
    
    $updates = [];
    $types = "";
    $values = [];
    
    if (isset($data['question'])) {
        $updates[] = "question = ?";
        $types .= "s";
        $values[] = trim($data['question']);
    }
    
    if (isset($data['answer'])) {
        $updates[] = "answer = ?";
        $types .= "s";
        $values[] = trim($data['answer']);
    }
    
    if (isset($data['position'])) {
        $updates[] = "position = ?";
        $types .= "i";
        $values[] = (int)$data['position'];
    }
    
    if (empty($updates)) {
        throw new Exception('No fields to update');
    }
    
    $sql = "UPDATE cards SET " . implode(", ", $updates) . " WHERE id = ?";
    $types .= "i";
    $values[] = $card_id;
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    
    if ($stmt->execute()) {
        getCardById($conn, $user_id, $card_id);
    } else {
        throw new Exception('Failed to update card');
    }
}

// Reorder cards
function reorderCards($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['deck_id']) || !isset($data['cards']) || !is_array($data['cards'])) {
        throw new Exception('Deck ID and cards array are required');
    }
    
    $deck_id = (int)$data['deck_id'];   
    verifyDeckOwnership($conn, $user_id, $deck_id);
    
    $conn->begin_transaction();
    
    try {
        foreach ($data['cards'] as $index => $card_id) {
            $sql = "UPDATE cards SET position = ? WHERE id = ? AND deck_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("iii", $index, $card_id, $deck_id);
            $stmt->execute();
        }
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Cards reordered successfully']);
    } catch (Exception $e) {
        $conn->rollback();
        throw new Exception('Failed to reorder cards');
    }
}

// Delete card
function deleteCard($conn, $user_id, $card_id) {
    // Verify card ownership and get deck_id
    $sql = "SELECT c.deck_id, c.position FROM cards c
            INNER JOIN decks d ON c.deck_id = d.id
            WHERE c.id = ? AND d.user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $card_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Card not found or unauthorized');
    }
    
    $row = $result->fetch_assoc();
    $deck_id = $row['deck_id'];
    $position = $row['position'];
    
    $conn->begin_transaction();
    
    try {
        // Delete the card
        $sql = "DELETE FROM cards WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $card_id);
        $stmt->execute();
        
        // Reorder remaining cards
        $sql = "UPDATE cards SET position = position - 1 WHERE deck_id = ? AND position > ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $deck_id, $position);
        $stmt->execute();
        
        // Check if deck is now empty and reset completion status
        $sql = "SELECT COUNT(*) as card_count FROM cards WHERE deck_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $deck_id);
        $stmt->execute();
        $card_count = $stmt->get_result()->fetch_assoc()['card_count'];
        
        if ($card_count == 0) {
            $sql = "UPDATE decks SET best_score = 0, quiz_completed = 0 WHERE id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $deck_id);
            $stmt->execute();
        }
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Card deleted successfully']);
    } catch (Exception $e) {
        $conn->rollback();
        throw new Exception('Failed to delete card');
    }
}
?>