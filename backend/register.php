<?php
include 'conn.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
  $user = trim($_POST['username']);
  $email = trim($_POST['email']);
  $pass = $_POST['password'];
  $confirm = $_POST['confirmPassword'];

  if ($pass !== $confirm) {
    echo json_encode(["status" => "error", "message" => "Passwords do not match!"]);
    exit;
  }

  $check = $conn->prepare("SELECT * FROM users WHERE email = ? OR username = ?");
  $check->bind_param("ss", $email, $user);
  $check->execute();
  $result = $check->get_result();

  if ($result->num_rows > 0) {
    echo json_encode(["status" => "error", "message" => "Username or Email already exists!"]);
  } else {
    $hashed = password_hash($pass, PASSWORD_BCRYPT);
    $stmt = $conn->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $user, $email, $hashed);

    if ($stmt->execute()) {
      echo json_encode(["status" => "success", "message" => "Registration successful! You can now log in."]);
    } else {
      echo json_encode(["status" => "error", "message" => "Error: Could not register user."]);
    }
    $stmt->close();
  }

  $check->close();
}
$conn->close();
?>
