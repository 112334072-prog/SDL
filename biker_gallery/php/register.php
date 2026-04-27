<?php
/* ============================================================
   php/register.php — Biker Gallery
   Validates POST → checks duplicates → stores bcrypt(SHA256)
   php/ subfolder → all jsGo() redirects use ../
   ============================================================ */
session_start();
require_once 'db.php';

function jsGo($url) {
    echo "<script>window.location.replace('" . addslashes($url) . "');</script>";
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsGo('../html/register.html');
}

$uname1    = trim($_POST['uname1']    ?? '');
$full_name = trim($_POST['full_name'] ?? '');
$dob       = trim($_POST['dob']       ?? '');
$email     = trim($_POST['email']     ?? '');
$phone     = trim($_POST['phone']     ?? '');
$upswd1    = trim($_POST['upswd1']    ?? '');
$upswd2    = trim($_POST['upswd2']    ?? '');

if (empty($uname1) || empty($full_name) || empty($dob) ||
    empty($email)  || empty($phone)     || empty($upswd1) || empty($upswd2)) {
    jsGo('../html/register.html?msg=All+fields+are+required');
}
if (strlen($uname1) < 4) {
    jsGo('../html/register.html?msg=Username+must+be+at+least+4+characters');
}
if ($upswd1 !== $upswd2) {
    jsGo('../html/register.html?msg=Passwords+do+not+match');
}

/* Check duplicate email */
$stmt = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    jsGo('../html/register.html?msg=Email+already+registered');
}
$stmt->close();

/* Check duplicate username */
$stmt = $conn->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
$stmt->bind_param('s', $uname1);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    jsGo('../html/register.html?msg=Username+already+taken');
}
$stmt->close();

/* Bcrypt the SHA-256 hash received from JS */
$hashed = password_hash($upswd1, PASSWORD_BCRYPT);

$stmt = $conn->prepare(
    'INSERT INTO users (username, full_name, dob, email, phone, password) VALUES (?,?,?,?,?,?)'
);
$stmt->bind_param('ssssss', $uname1, $full_name, $dob, $email, $phone, $hashed);

if ($stmt->execute()) {
    $stmt->close(); $conn->close();
    $_SESSION['username']  = $uname1;
    $_SESSION['logged_in'] = true;
    jsGo('../html/login.html');
} else {
    $stmt->close(); $conn->close();
    jsGo('../html/register.html?msg=Registration+failed.+Please+try+again');
}
