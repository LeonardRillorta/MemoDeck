<?php
// reset-password-api.php - Password reset after OTP verification
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');

if (!file_exists(__DIR__ . '/conn.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database config missing']);
    exit();
}

require_once __DIR__ . '/conn.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');
$new_password = $data['new_password'] ?? '';

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Valid email required']);
    exit();
}

if (strlen($new_password) < 6) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
    exit();
}

try {
    // Check if user exists and is active
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? AND is_active = 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        // Prevent user enumeration — still return success
        echo json_encode(['success' => true, 'message' => 'Password updated']);
        exit();
    }

    $user = $result->fetch_assoc();
    $user_id = $user['id'];

    // Hash new password
    $hashed_password = password_hash($new_password, PASSWORD_BCRYPT);

    // Update password
    $stmt = $conn->prepare("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param("si", $hashed_password, $user_id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Password updated']);
    } else {
        throw new Exception('Update failed');
    }

} catch (Exception $e) {
    error_log("Reset password error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Failed to reset password']);
}