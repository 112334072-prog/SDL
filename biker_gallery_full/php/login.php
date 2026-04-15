<?php
/* ============================================================
   php/login.php — Biker Gallery
   Handles POST from login.html (root folder).

   login_authentication == '1'     → check users table       → ../home.html
   login_authentication == 'admin' → check admin_login table → admin.php

   Password flow: SHA-256 arrives from JS → verified vs bcrypt(SHA256)
   Lives in php/ subfolder → all jsGo() redirects to root use ../
   ============================================================ */
session_start();
require_once 'db.php';

function jsGo($url) {
    echo "<script>window.location.replace('" . addslashes($url) . "');</script>";
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['login_authentication'])) {
    jsGo('../login.html');
}

$uname     = trim($_POST['username']             ?? '');
$upswd     = trim($_POST['password']             ?? '');
$auth_type = trim($_POST['login_authentication'] ?? '');

if (!$uname || !$upswd) {
    jsGo('../login.html?msg=Username+and+password+are+required');
}

/* ============================================================
   ADMIN LOGIN — checks admin_login table
   ============================================================ */
if ($auth_type === 'admin') {

    $stmt = $conn->prepare(
        "SELECT id, username, password FROM admin_login WHERE username = ? LIMIT 1"
    );
    $stmt->bind_param("s", $uname);
    $stmt->execute();
    $stmt->bind_result($id, $username_db, $password_db);
    $stmt->store_result();
    $found = $stmt->num_rows;

    if ($found === 1) {
        $stmt->fetch();
        $stmt->close();

        if (password_verify($upswd, $password_db)) {
            $_SESSION['admin_id']        = $id;
            $_SESSION['admin_username']  = $username_db;
            $_SESSION['admin_logged_in'] = true;
            $conn->close();
            jsGo('admin.php');
        } else {
            $conn->close();
            jsGo('../login.html?msg=Invalid+admin+username+or+password');
        }
    } else {
        $stmt->close();
        $conn->close();
        jsGo('../login.html?msg=Invalid+admin+username+or+password');
    }

/* ============================================================
   REGULAR USER LOGIN — checks users table
   ============================================================ */
} else {

    $stmt = $conn->prepare(
        "SELECT id, username, password FROM users WHERE username = ? LIMIT 1"
    );
    $stmt->bind_param("s", $uname);
    $stmt->execute();
    $stmt->bind_result($id, $username_db, $password_db);
    $stmt->store_result();
    $found = $stmt->num_rows;

    if ($found === 1) {
        $stmt->fetch();
        $stmt->close();

        if (password_verify($upswd, $password_db)) {
            $_SESSION['user_id']   = $id;
            $_SESSION['username']  = $username_db;
            $_SESSION['logged_in'] = true;
            $conn->close();
            jsGo('../home.html');
        } else {
            $conn->close();
            jsGo('../login.html?msg=Invalid+username+or+password');
        }
    } else {
        $stmt->close();
        $conn->close();
        jsGo('../login.html?msg=Invalid+username+or+password');
    }
}
