<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Include your DB connection
require_once 'conn.php';

// Debug logging
error_log("=== OTP Request ===");
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
$isResend = isset($input['resend']) && $input['resend'] === true; // Check if it's a resend request

error_log("Email after trim: '$email'");
error_log("Is Resend: " . ($isResend ? 'true' : 'false'));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Valid email is required',
        'debug' => [
            'received_email' => $email,
            'is_empty' => empty($email),
            'is_valid' => filter_var($email, FILTER_VALIDATE_EMAIL)
        ]
    ]);
    exit;
}

try {
    // Find user - MySQLi version
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? AND is_active = 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        // Still return success to prevent email enumeration
        error_log("User not found or inactive: $email");
        echo json_encode(['status' => 'success', 'message' => 'If your email is registered, an OTP has been sent.']);
        exit;
    }

    $user_id = $user['id'];
    error_log("User found: ID = $user_id");

    // ✅ CHECK IF ACTIVE OTP EXISTS (not used and not expired)
    $stmt = $conn->prepare("
        SELECT id, otp, expires_at 
        FROM password_reset_otp 
        WHERE user_id = ? AND used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $existingOtp = $result->fetch_assoc();
    $stmt->close();

    if ($existingOtp && !$isResend) {
        // Active OTP exists and this is NOT a resend request
        error_log("Active OTP already exists for user: $user_id");
        
        $timeRemaining = strtotime($existingOtp['expires_at']) - time();
        $minutesRemaining = ceil($timeRemaining / 60);
        
        http_response_code(429); // Too Many Requests
        echo json_encode([
            'status' => 'error',
            'message' => "An OTP was already sent. Please check your email or wait $minutesRemaining minutes.",
            'can_resend' => true,
            'expires_in' => $minutesRemaining
        ]);
        exit;
    }

    // If resend request, mark old OTPs as used
    if ($isResend && $existingOtp) {
        error_log("Resend requested - marking old OTP as used");
        $stmt = $conn->prepare("UPDATE password_reset_otp SET used = 1 WHERE user_id = ? AND used = 0");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
    }

    // Generate 6-digit OTP
    $otp = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    $expires_at = date('Y-m-d H:i:s', strtotime('+10 minutes'));
    
    error_log("Generated OTP: $otp (expires: $expires_at)");

    // Save OTP - MySQLi version
    $used = 0;
    $stmt = $conn->prepare("INSERT INTO password_reset_otp (user_id, otp, expires_at, used) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("issi", $user_id, $otp, $expires_at, $used);
    $stmt->execute();
    $stmt->close();
    
    error_log("OTP saved to database");

    // Send email via PHPMailer
    try {
        $mail = new PHPMailer(true);
        
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'batangamer@gmail.com';
        $mail->Password   = 'mgljcggcyvpkxcwf';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        // Recipients
        $mail->setFrom('batangamer@gmail.com', 'MemoDeck');
        $mail->addAddress($email);

        // Content
        $mail->isHTML(true);
        $mail->Subject = 'Your MemoDeck Password Reset Code';
        $mail->Body    = "
            <h2>Password Reset Request</h2>
            <p>Your OTP code is: <strong>$otp</strong></p>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        ";

        $mail->send();
        error_log("Email sent successfully to: $email");
        
        // Success response
        echo json_encode([
            'status' => 'success', 
            'message' => $isResend ? 'New OTP sent to your email.' : 'OTP sent to your email.',
        ]);
        
    } catch (Exception $mailException) {
        // Email failed but OTP is in database
        error_log("Mail Error: " . $mailException->getMessage());
        
        // Still return success (OTP is saved in DB)
        echo json_encode([
            'status' => 'success', 
            'message' => 'OTP generated. Check your email.',
            'mail_debug' => $mailException->getMessage()
        ]);
    }

} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => 'An error occurred. Please try again later.',
        'debug' => $e->getMessage()
    ]);
}
?>