<?php
/* ============================================================
   php/admin_register.php — Biker Gallery
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
    jsGo('../admin_register.html');
}

$uname1    = trim($_POST['uname1']    ?? '');
$full_name = trim($_POST['full_name'] ?? '');
$email     = trim($_POST['email']     ?? '');
$phone     = trim($_POST['phone']     ?? '');
$upswd1    = trim($_POST['upswd1']    ?? '');
$upswd2    = trim($_POST['upswd2']    ?? '');

/* All fields required */
if (empty($uname1) || empty($full_name) || empty($email) ||
    empty($phone)  || empty($upswd1)    || empty($upswd2)) {
    jsGo('../admin_register.html?msg=All+fields+are+required');
}

/* Username length */
if (strlen($uname1) < 4) {
    jsGo('../admin_register.html?msg=Username+must+be+at+least+4+characters');
}

/* Passwords must match */
if ($upswd1 !== $upswd2) {
    jsGo('../admin_register.html?msg=Passwords+do+not+match');
}

/* Check duplicate email in admin_login */
$stmt = $conn->prepare('SELECT id FROM admin_login WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    jsGo('../admin_register.html?msg=Email+already+registered');
}
$stmt->close();

/* Check duplicate username in admin_login */
$stmt = $conn->prepare('SELECT id FROM admin_login WHERE username = ? LIMIT 1');
$stmt->bind_param('s', $uname1);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    jsGo('../admin_register.html?msg=Username+already+taken');
}
$stmt->close();

/* Bcrypt the SHA-256 hash received from JS */
$hashed = password_hash($upswd1, PASSWORD_BCRYPT);

/* INSERT into admin_login */
$stmt = $conn->prepare(
    'INSERT INTO admin_login (full_name, username, email, phone, password) VALUES (?,?,?,?,?)'
);
$stmt->bind_param('sssss', $full_name, $uname1, $email, $phone, $hashed);

if ($stmt->execute()) {
    $stmt->close(); $conn->close();
    $_SESSION['admin_username']  = $uname1;
    $_SESSION['admin_logged_in'] = true;
    jsGo('../login.html');
} else {
    $stmt->close(); $conn->close();
    jsGo('../admin_register.html?msg=Registration+failed.+Please+try+again');
}
