<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once __DIR__ . '/conn.php';

// Debug logging
error_log("=== OTP Verification ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Content-Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));

$rawInput = file_get_contents('php://input');
error_log("Raw Input: " . $rawInput);

if (empty($rawInput)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error', 
        'message' => 'No data received',
        'debug' => [
            'method' => $_SERVER['REQUEST_METHOD'],
            'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'not set'
        ]
    ]);
    exit;
}

$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Invalid JSON: ' . json_last_error_msg(),
        'raw' => $rawInput
    ]);
    exit;
}

error_log("Decoded Input: " . print_r($input, true));

$email = trim($input['email'] ?? '');
$otp = trim($input['otp'] ?? '');

error_log("Email: '$email', OTP: '$otp'");

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($otp) !== 6) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Invalid input',
        'debug' => [
            'email' => $email,
            'email_valid' => filter_var($email, FILTER_VALIDATE_EMAIL),
            'otp' => $otp,
            'otp_length' => strlen($otp)
        ]
    ]);
    exit;
}

try {
    // Get user - MySQLi version
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? AND is_active = 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        error_log("User not found: $email");
        echo json_encode(['status' => 'error', 'message' => 'Invalid email or account not active']);
        exit;
    }

    $user_id = $user['id'];
    error_log("User found: ID = $user_id");

    // Verify OTP - MySQLi version
    $used = 0;
    $stmt = $conn->prepare("
        SELECT id, expires_at, used FROM password_reset_otp
        WHERE user_id = ? AND otp = ? AND used = ?
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->bind_param("isi", $user_id, $otp, $used);
    $stmt->execute();
    $result = $stmt->get_result();
    $record = $result->fetch_assoc();
    $stmt->close();

    if (!$record) {
        error_log("OTP not found or already used");
        echo json_encode(['status' => 'error', 'message' => 'Invalid or expired OTP']);
        exit;
    }

    error_log("OTP record found: ID = " . $record['id'] . ", Expires: " . $record['expires_at']);

    if (strtotime($record['expires_at']) < time()) {
        error_log("OTP expired");
        // Mark as used/expired
        $used = 1;
        $stmt = $conn->prepare("UPDATE password_reset_otp SET used = ? WHERE id = ?");
        $stmt->bind_param("ii", $used, $record['id']);
        $stmt->execute();
        $stmt->close();
        
        echo json_encode(['status' => 'error', 'message' => 'OTP has expired']);
        exit;
    }

    // Mark OTP as used - MySQLi version
    $used = 1;
    $stmt = $conn->prepare("UPDATE password_reset_otp SET used = ? WHERE id = ?");
    $stmt->bind_param("ii", $used, $record['id']);
    $stmt->execute();
    $stmt->close();
    
    error_log("OTP marked as used");

    echo json_encode([
        'status' => 'success',
        'message' => 'OTP verified',
        'redirect' => 'resetpassword.html?user=' . urlencode($email)
    ]);

} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => 'An error occurred',
        'debug' => $e->getMessage()
    ]);
}
?>