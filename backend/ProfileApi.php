<?php
// profile_api.php - User Profile Management API
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
            if ($action === 'profile') {
                getUserProfile($conn, $user_id);
            } elseif ($action === 'stats') {
                getUserStats($conn, $user_id);
            } else {
                throw new Exception('Invalid GET action');
            }
            break;
            
        case 'POST':
            if ($action === 'update_username') {
                updateUsername($conn, $user_id);
            } elseif ($action === 'update_email') {
                updateEmail($conn, $user_id);
            } elseif ($action === 'update_password') {
                updatePassword($conn, $user_id);
            } elseif ($action === 'delete_account') {
                deleteAccount($conn, $user_id);
            } else {
                throw new Exception('Invalid POST action');
            }
            break;
            
        default:
            throw new Exception('Method not allowed');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

// ============================================
// GET USER PROFILE
// ============================================
function getUserProfile($conn, $user_id) {
    $sql = "SELECT 
                u.id,
                u.username,
                u.email,
                u.name,
                u.joined_date,
                u.last_login,
                u.created_at
            FROM users u
            WHERE u.id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('User not found');
    }
    
    $user = $result->fetch_assoc();
    $user['id'] = (int)$user['id'];
    
    echo json_encode([
        'success' => true,
        'user' => $user
    ]);
}

// ============================================
// GET USER STATS
// ============================================
function getUserStats($conn, $user_id) {
    // Get deck stats
    $sql = "SELECT 
                COUNT(*) as total_decks,
                SUM(CASE WHEN quiz_completed = 1 THEN 1 ELSE 0 END) as completed_decks
            FROM decks
            WHERE user_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $deck_stats = $stmt->get_result()->fetch_assoc();
    
    // Get card stats
    $sql = "SELECT 
                COUNT(*) as total_cards,
                SUM(d.best_score) as mastered_cards
            FROM cards c
            INNER JOIN decks d ON c.deck_id = d.id
            WHERE d.user_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $card_stats = $stmt->get_result()->fetch_assoc();
    
    // Get user statistics
    $sql = "SELECT 
                study_streak,
                longest_streak,
                total_study_time,
                total_cards_studied,
                total_quizzes_taken,
                average_accuracy,
                best_quiz_accuracy,
                last_study_date
            FROM user_statistics
            WHERE user_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user_stats = $stmt->get_result()->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'total_decks' => (int)$deck_stats['total_decks'],
            'completed_decks' => (int)$deck_stats['completed_decks'],
            'active_decks' => (int)$deck_stats['total_decks'] - (int)$deck_stats['completed_decks'],
            'total_cards' => (int)$card_stats['total_cards'],
            'mastered_cards' => (int)($card_stats['mastered_cards'] ?? 0),
            'study_streak' => (int)($user_stats['study_streak'] ?? 0),
            'longest_streak' => (int)($user_stats['longest_streak'] ?? 0),
            'total_study_time' => (int)($user_stats['total_study_time'] ?? 0),
            'total_cards_studied' => (int)($user_stats['total_cards_studied'] ?? 0),
            'total_quizzes_taken' => (int)($user_stats['total_quizzes_taken'] ?? 0),
            'average_accuracy' => round((float)($user_stats['average_accuracy'] ?? 0), 2),
            'best_quiz_accuracy' => round((float)($user_stats['best_quiz_accuracy'] ?? 0), 2),
            'last_study_date' => $user_stats['last_study_date']
        ]
    ]);
}

// ============================================
// UPDATE USERNAME
// ============================================
function updateUsername($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['new_username']) || !isset($data['password'])) {
        throw new Exception('Username and password are required');
    }
    
    $new_username = trim($data['new_username']);
    $password = $data['password'];
    
    // Validation
    if (empty($new_username)) {
        throw new Exception('Username cannot be empty');
    }
    
    if (strlen($new_username) < 3 || strlen($new_username) > 50) {
        throw new Exception('Username must be between 3 and 50 characters');
    }
    
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $new_username)) {
        throw new Exception('Username can only contain letters, numbers, and underscores');
    }
    
    // Verify password
    $sql = "SELECT password FROM users WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('User not found');
    }
    
    $user = $result->fetch_assoc();
    
    if (!password_verify($password, $user['password'])) {
        throw new Exception('Incorrect password');
    }
    
    // Check if username already exists
    $sql = "SELECT id FROM users WHERE username = ? AND id != ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $new_username, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows > 0) {
        throw new Exception('Username already taken');
    }
    
    // Update username
    $sql = "UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $new_username, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Username updated successfully',
            'username' => $new_username
        ]);
    } else {
        throw new Exception('Failed to update username');
    }
}

// ============================================
// UPDATE EMAIL
// ============================================
function updateEmail($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['new_email']) || !isset($data['password'])) {
        throw new Exception('Email and password are required');
    }
    
    $new_email = trim($data['new_email']);
    $password = $data['password'];
    
    // Validation
    if (empty($new_email)) {
        throw new Exception('Email cannot be empty');
    }
    
    if (!filter_var($new_email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }
    
    // Verify password
    $sql = "SELECT password FROM users WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('User not found');
    }
    
    $user = $result->fetch_assoc();
    
    if (!password_verify($password, $user['password'])) {
        throw new Exception('Incorrect password');
    }
    
    // Check if email already exists
    $sql = "SELECT id FROM users WHERE email = ? AND id != ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $new_email, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows > 0) {
        throw new Exception('Email already in use');
    }
    
    // Update email
    $sql = "UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $new_email, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Email updated successfully',
            'email' => $new_email
        ]);
    } else {
        throw new Exception('Failed to update email');
    }
}

// ============================================
// UPDATE PASSWORD
// ============================================
function updatePassword($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['current_password']) || !isset($data['new_password'])) {
        throw new Exception('Current and new passwords are required');
    }
    
    $current_password = $data['current_password'];
    $new_password = $data['new_password'];
    $confirm_password = $data['confirm_password'] ?? '';
    
    // Validation
    if (strlen($new_password) < 6) {
        throw new Exception('New password must be at least 6 characters');
    }
    
    if ($new_password !== $confirm_password) {
        throw new Exception('New passwords do not match');
    }
    
    // Verify current password
    $sql = "SELECT password FROM users WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('User not found');
    }
    
    $user = $result->fetch_assoc();
    
    if (!password_verify($current_password, $user['password'])) {
        throw new Exception('Current password is incorrect');
    }
    
    // Hash new password
    $hashed_password = password_hash($new_password, PASSWORD_BCRYPT);
    
    // Update password
    $sql = "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $hashed_password, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Password updated successfully'
        ]);
    } else {
        throw new Exception('Failed to update password');
    }
}

// ============================================
// DELETE ACCOUNT
// ============================================
function deleteAccount($conn, $user_id) {
    // Get user data first
    $sql = "SELECT username, email FROM users WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('User not found');
    }
    
    $user = $result->fetch_assoc();
    
    // Start transaction
    $conn->begin_transaction();
    
    try {
        // Delete user (cascading will handle related data)
        $sql = "DELETE FROM users WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        
        $conn->commit();
        
        // Destroy session
        session_unset();
        session_destroy();
        
        echo json_encode([
            'success' => true,
            'message' => 'Account deleted successfully'
        ]);
    } catch (Exception $e) {
        $conn->rollback();
        throw new Exception('Failed to delete account: ' . $e->getMessage());
    }
}
?>