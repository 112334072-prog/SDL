<?php
/* ============================================================
   php/api_contact.php — Biker Gallery
   Saves contact form submissions to the contacts table.
   ============================================================ */
require_once 'db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$data  = json_decode(file_get_contents('php://input'), true);
$name  = trim($data['name']  ?? '');
$phone = trim($data['phone'] ?? '');
$email = trim($data['email'] ?? '');
$msg   = trim($data['msg']   ?? '');

if (!$name || !$phone || !$email || !$msg) {
    echo json_encode(['success' => false, 'msg' => 'All fields are required']);
    exit();
}
if (!preg_match('/^\d{10}$/', $phone)) {
    echo json_encode(['success' => false, 'msg' => 'Invalid phone number']);
    exit();
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'msg' => 'Invalid email address']);
    exit();
}

$stmt = $conn->prepare(
    "INSERT INTO contacts (name, phone, email, message) VALUES (?, ?, ?, ?)"
);
$stmt->bind_param("ssss", $name, $phone, $email, $msg);

if ($stmt->execute()) {
    $stmt->close(); $conn->close();
    echo json_encode(['success' => true, 'msg' => 'Message sent successfully']);
} else {
    $err = $stmt->error;
    $stmt->close(); $conn->close();
    echo json_encode(['success' => false, 'msg' => 'Failed to save: ' . $err]);
}
