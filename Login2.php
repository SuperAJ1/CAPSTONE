<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require_once 'db_connection.php';

// Read and decode JSON input
$rawInput = file_get_contents("php://input");
$data = json_decode($rawInput, true);

// Validate input
if (!isset($data['username']) || !isset($data['password'])) {
    echo json_encode(["status" => "error", "message" => "Missing username or password"]);
    exit;
}

$username = $data['username'];
$password = $data['password'];

// Query user securely with case-sensitive username check
$sql = "SELECT * FROM accounts WHERE BINARY username = ?";
$stmt = $pdo->prepare($sql);
if (!$stmt) {
    echo json_encode(["status" => "error", "message" => "Failed to prepare statement"]);
    exit;
}

$stmt->execute([$username]);
$user = $stmt->fetch();

// Check password using password_verify() for bcrypt and if account is active
if ($user && password_verify($password, $user['password']) && $user['is_active'] == 1) {
    echo json_encode([
        "status" => "success",
        "message" => "Login successful",
        "username" => $user['username'],
        "role" => $user['role'],
        "id" => $user['id'],
        "created_at" => $user['created_at']
    ]);
} else if ($user && $user['is_active'] == 0) {
    echo json_encode(["status" => "error", "message" => "Account is inactive"]);
} else {
    echo json_encode(["status" => "error", "message" => "Invalid credentials"]);
}

?>

