<?php
// studyApi.php - Fixed Study Session & Score Management
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

require_once 'conn.php';

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
        case 'POST':
            if ($action === 'start_session') {
                startStudySession($conn, $user_id);
            } elseif ($action === 'update_progress') {
                updateStudyProgress($conn, $user_id);
            } elseif ($action === 'complete_session') {
                completeStudySession($conn, $user_id);
            } elseif ($action === 'save_quiz_attempt') {
                saveQuizAttempt($conn, $user_id);
            } else {
                throw new Exception('Invalid POST action');
            }
            break;
            
        case 'GET':
            if ($action === 'session_stats' && isset($_GET['deck_id'])) {
                getSessionStats($conn, $user_id, $_GET['deck_id']);
            } elseif ($action === 'get_progress' && isset($_GET['session_id'])) {
                getSessionProgress($conn, $user_id, $_GET['session_id']);
            } else {
                throw new Exception('Invalid GET action');
            }
            break;
            
        default:
            throw new Exception('Method not allowed');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

// Start a new study session
function startStudySession($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['deck_id']) || !isset($data['session_type'])) {
        throw new Exception('Deck ID and session type are required');
    }
    
    $deck_id = (int)$data['deck_id'];
    $session_type = $data['session_type'];
    
    // Validate session type
    if (!in_array($session_type, ['flip', 'quiz'])) {
        throw new Exception('Invalid session type');
    }
    
    // Verify deck ownership
    $sql = "SELECT id FROM decks WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $deck_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        throw new Exception('Deck not found or unauthorized');
    }
    
    // Create new session
    $session_date = date('Y-m-d');
    $started_at = date('Y-m-d H:i:s');
    
    $sql = "INSERT INTO study_sessions 
            (user_id, deck_id, session_type, session_date, started_at) 
            VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iisss", $user_id, $deck_id, $session_type, $session_date, $started_at);
    
    if ($stmt->execute()) {
        $session_id = $conn->insert_id;
        echo json_encode([
            'success' => true, 
            'session_id' => $session_id,
            'session_type' => $session_type,
            'message' => 'Study session started'
        ]);
    } else {
        throw new Exception('Failed to start session');
    }
}

// Update study progress (for flip mode)
function updateStudyProgress($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['session_id']) || !isset($data['card_id'])) {
        throw new Exception('Session ID and card ID are required');
    }
    
    $session_id = (int)$data['session_id'];
    $card_id = (int)$data['card_id'];
    $flipped = isset($data['flipped']) ? (int)$data['flipped'] : 1;
    $time_spent = isset($data['time_spent_seconds']) ? (int)$data['time_spent_seconds'] : 0;
    
    // Verify session ownership
    $sql = "SELECT id FROM study_sessions WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $session_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        throw new Exception('Session not found or unauthorized');
    }
    
    // Insert or update progress
    $sql = "INSERT INTO study_progress 
            (session_id, card_id, flipped, time_spent_seconds) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            flipped = VALUES(flipped), 
            time_spent_seconds = time_spent_seconds + VALUES(time_spent_seconds)";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iiii", $session_id, $card_id, $flipped, $time_spent);
    
    if ($stmt->execute()) {
        // Update session stats
        $sql = "UPDATE study_sessions 
                SET cards_studied = (
                    SELECT COUNT(DISTINCT card_id) 
                    FROM study_progress 
                    WHERE session_id = ?
                ),
                duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $session_id, $session_id);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Progress updated']);
    } else {
        throw new Exception('Failed to update progress');
    }
}

// Complete study session
function completeStudySession($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['session_id'])) {
        throw new Exception('Session ID is required');
    }
    
    $session_id = (int)$data['session_id'];
    
    // Verify session ownership and get session info
    $sql = "SELECT id, session_type, deck_id FROM study_sessions 
            WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $session_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Session not found or unauthorized');
    }
    
    $session = $result->fetch_assoc();
    
    // Mark as completed
    $completed_at = date('Y-m-d H:i:s');
    $sql = "UPDATE study_sessions 
            SET completed = 1, 
                completed_at = ?,
                duration_seconds = TIMESTAMPDIFF(SECOND, started_at, ?)
            WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssi", $completed_at, $completed_at, $session_id);
    
    if ($stmt->execute()) {
        // Update user statistics
        if ($session['session_type'] === 'flip') {
            $sql = "UPDATE user_statistics 
                    SET total_flip_sessions = total_flip_sessions + 1,
                        last_study_date = CURDATE(),
                        study_streak = CASE 
                            WHEN last_study_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
                                THEN study_streak + 1
                            WHEN last_study_date = CURDATE() 
                                THEN study_streak
                            ELSE 1
                        END,
                        longest_streak = GREATEST(longest_streak, 
                            CASE 
                                WHEN last_study_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
                                    THEN study_streak + 1
                                WHEN last_study_date = CURDATE() 
                                    THEN study_streak
                                ELSE 1
                            END
                        )
                    WHERE user_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
        }
        
        // Update deck times_studied
        $sql = "UPDATE decks SET times_studied = times_studied + 1 WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $session['deck_id']);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Session completed']);
    } else {
        throw new Exception('Failed to complete session');
    }
}

// Save quiz attempt with COMPLETE SCORE TRACKING
function saveQuizAttempt($conn, $user_id) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['session_id']) || !isset($data['deck_id']) || 
        !isset($data['score']) || !isset($data['total_questions'])) {
        throw new Exception('Missing required fields');
    }
    
    $session_id = (int)$data['session_id'];
    $deck_id = (int)$data['deck_id'];
    $score = (int)$data['score'];
    $total_questions = (int)$data['total_questions'];
    $best_streak = isset($data['best_streak']) ? (int)$data['best_streak'] : 0;
    $completed = isset($data['completed']) ? (int)$data['completed'] : 1;
    
    // Calculate accuracy
    $accuracy = $total_questions > 0 ? round(($score / $total_questions) * 100, 2) : 0;
    
    // Verify session ownership
    $sql = "SELECT id FROM study_sessions WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $session_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        throw new Exception('Session not found or unauthorized');
    }
    
    // Determine performance level
    $performance_level = 'needs_improvement';
    if ($accuracy >= 90) $performance_level = 'excellent';
    elseif ($accuracy >= 75) $performance_level = 'good';
    elseif ($accuracy >= 60) $performance_level = 'average';
    
    // Start transaction
    $conn->begin_transaction();
    
    try {
        // Insert quiz attempt
        $sql = "INSERT INTO quiz_attempts 
                (session_id, deck_id, user_id, score, total_questions, accuracy, 
                 best_streak, performance_level, completed) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("iiiidissi", $session_id, $deck_id, $user_id, $score, 
                         $total_questions, $accuracy, $best_streak, 
                         $performance_level, $completed);
        $stmt->execute();
        
        $attempt_id = $conn->insert_id;
        
        // Save individual responses
        if (isset($data['responses']) && is_array($data['responses'])) {
            $sql = "INSERT INTO quiz_responses 
                    (attempt_id, card_id, user_answer, correct_answer, 
                     is_correct, skipped, response_time_seconds) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            
            foreach ($data['responses'] as $response) {
                $card_id = (int)$response['card_id'];
                $user_answer = $response['user_answer'] ?? null;
                $correct_answer = $response['correct_answer'];
                $is_correct = (int)($response['is_correct'] ?? 0);
                $skipped = (int)($response['skipped'] ?? 0);
                $response_time = isset($response['response_time_seconds']) 
                    ? (int)$response['response_time_seconds'] : null;
                
                $stmt->bind_param("iissiii", $attempt_id, $card_id, $user_answer, 
                                 $correct_answer, $is_correct, $skipped, $response_time);
                $stmt->execute();
            }
        }
        
        // Update study session
        $sql = "UPDATE study_sessions 
                SET correct_answers = ?, 
                    total_answers = ?, 
                    accuracy = ?,
                    best_streak = ?,
                    completed = 1,
                    completed_at = NOW(),
                    duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("iidii", $score, $total_questions, $accuracy, 
                         $best_streak, $session_id);
        $stmt->execute();
        
        // Update user statistics
        $sql = "UPDATE user_statistics 
                SET total_quizzes_taken = total_quizzes_taken + 1,
                    last_study_date = CURDATE(),
                    average_accuracy = (
                        SELECT AVG(accuracy) 
                        FROM quiz_attempts 
                        WHERE user_id = ? AND completed = 1
                    ),
                    best_quiz_accuracy = GREATEST(
                        COALESCE(best_quiz_accuracy, 0), ?
                    ),
                    study_streak = CASE 
                        WHEN last_study_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
                            THEN study_streak + 1
                        WHEN last_study_date = CURDATE() 
                            THEN study_streak
                        ELSE 1
                    END,
                    longest_streak = GREATEST(longest_streak, 
                        CASE 
                            WHEN last_study_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
                                THEN study_streak + 1
                            WHEN last_study_date = CURDATE() 
                                THEN study_streak
                            ELSE 1
                        END
                    )
                WHERE user_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("idi", $user_id, $accuracy, $user_id);
        $stmt->execute();
        
        // Update deck times_studied
        $sql = "UPDATE decks SET times_studied = times_studied + 1 WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $deck_id);
        $stmt->execute();
        
        $conn->commit();
        
        echo json_encode([
            'success' => true, 
            'attempt_id' => $attempt_id,
            'score' => $score,
            'total_questions' => $total_questions,
            'accuracy' => $accuracy,
            'performance_level' => $performance_level,
            'message' => 'Quiz attempt saved successfully'
        ]);
    } catch (Exception $e) {
        $conn->rollback();
        throw new Exception('Failed to save quiz attempt: ' . $e->getMessage());
    }
}

// Get session statistics for a deck
function getSessionStats($conn, $user_id, $deck_id) {
    $deck_id = (int)$deck_id;
    
    // Verify deck ownership
    $sql = "SELECT id FROM decks WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $deck_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        throw new Exception('Deck not found or unauthorized');
    }
    
    // Get session statistics
    $sql = "SELECT 
                COUNT(*) as total_sessions,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
                AVG(CASE WHEN completed = 1 AND accuracy IS NOT NULL THEN accuracy ELSE NULL END) as avg_accuracy,
                MAX(accuracy) as best_accuracy,
                SUM(duration_seconds) as total_time,
                SUM(cards_studied) as total_cards_studied
            FROM study_sessions
            WHERE user_id = ? AND deck_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $user_id, $deck_id);
    $stmt->execute();
    $stats = $stmt->get_result()->fetch_assoc();
    
    // Get recent sessions
    $sql = "SELECT 
                id, session_type, session_date, accuracy, 
                duration_seconds, cards_studied, completed
            FROM study_sessions
            WHERE user_id = ? AND deck_id = ?
            ORDER BY session_date DESC, created_at DESC
            LIMIT 10";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $user_id, $deck_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $recent_sessions = [];
    while ($row = $result->fetch_assoc()) {
        $recent_sessions[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'total_sessions' => (int)$stats['total_sessions'],
            'completed_sessions' => (int)$stats['completed_sessions'],
            'avg_accuracy' => round((float)$stats['avg_accuracy'], 2),
            'best_accuracy' => round((float)$stats['best_accuracy'], 2),
            'total_time_minutes' => round((int)$stats['total_time'] / 60, 2),
            'total_cards_studied' => (int)$stats['total_cards_studied']
        ],
        'recent_sessions' => $recent_sessions
    ]);
}

// Get current session progress
function getSessionProgress($conn, $user_id, $session_id) {
    $session_id = (int)$session_id;
    
    // Verify session ownership
    $sql = "SELECT 
                ss.*,
                d.name as deck_name,
                (SELECT COUNT(*) FROM cards WHERE deck_id = ss.deck_id) as total_cards
            FROM study_sessions ss
            JOIN decks d ON ss.deck_id = d.id
            WHERE ss.id = ? AND ss.user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $session_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Session not found or unauthorized');
    }
    
    $session = $result->fetch_assoc();
    
    // Get progress details
    $sql = "SELECT 
                COUNT(DISTINCT card_id) as cards_studied,
                SUM(time_spent_seconds) as total_time
            FROM study_progress
            WHERE session_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $session_id);
    $stmt->execute();
    $progress = $stmt->get_result()->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'session' => $session,
        'progress' => [
            'cards_studied' => (int)$progress['cards_studied'],
            'total_cards' => (int)$session['total_cards'],
            'progress_percentage' => $session['total_cards'] > 0 
                ? round(((int)$progress['cards_studied'] / (int)$session['total_cards']) * 100, 2)
                : 0,
            'total_time_seconds' => (int)$progress['total_time']
        ]
    ]);
}
?>