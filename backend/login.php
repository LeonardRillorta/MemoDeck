<?php
include 'conn.php';
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo json_encode(["status" => "error", "message" => "Invalid request method"]);
  exit;
}

$identifier = isset($_POST['email']) ? trim($_POST['email']) : '';
$password = isset($_POST['password']) ? $_POST['password'] : '';

if (empty($identifier) || empty($password)) {
  echo json_encode(["status" => "error", "message" => "Email and password are required"]);
  exit;
}

$stmt = $conn->prepare("SELECT id, username, email, password FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $identifier);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
  echo json_encode(["status" => "error", "message" => "Invalid credentials"]);
  exit;
}

$user = $result->fetch_assoc();

if (!password_verify($password, $user['password'])) {
  echo json_encode(["status" => "error", "message" => "Invalid credentials"]);
  exit;
}

$_SESSION['user'] = [
  'id' => $user['id'],
  'username' => $user['username'],
  'email' => $user['email']
];

// New format (for API compatibility)
$_SESSION['user_id'] = $user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['email'] = $user['email'];

// Update last login
$updateStmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
$updateStmt->bind_param("i", $user['id']);
$updateStmt->execute();
$updateStmt->close();

echo json_encode([
  "status" => "success", 
  "message" => "Logged in", 
  "user" => $_SESSION['user']
]);

$stmt->close();
$conn->close();
?>