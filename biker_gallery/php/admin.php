<?php
/* ============================================================
   admin.php — Biker Gallery Admin Panel
   ============================================================ */
session_start();

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

if (empty($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    echo "<script>window.location.replace('../html/login.html?msg=Please+login+as+admin');</script>";
    exit();
}

require_once 'db.php';

/* ── Schema guard: ensure bookings table has all required columns ── */
$required_cols = ['pickup_date', 'pickup_time', 'hours', 'deposit', 'actual_hours', 'refund_amount', 'returned_at'];
$col_check = $conn->query("SHOW COLUMNS FROM bookings");
$existing_cols = [];
if ($col_check) {
    while ($col = $col_check->fetch_assoc()) {
        $existing_cols[] = $col['Field'];
    }
}
$missing = array_diff($required_cols, $existing_cols);
if (!empty($missing)) {
    echo '<div style="font-family:monospace;background:#1e2130;color:#ff5370;padding:24px;margin:20px;border-radius:10px;border:1px solid #ff5370">';
    echo '<strong>Database Migration Required</strong><br><br>';
    echo 'Missing columns in <code>bookings</code> table: <code>' . implode(', ', $missing) . '</code><br><br>';
    echo 'Please run the migration SQL from <code>php/biker_final.sql</code> in phpMyAdmin &rarr; SQL tab.<br>';
    echo 'Copy and run the <strong>MIGRATION</strong> section at the bottom of that file.';
    echo '</div>';
    exit();
}

$historyLimit = 25;
if (isset($_GET['history_limit'])) {
    $n = (int)$_GET['history_limit'];
    if (in_array($n, [25, 50, 75, 100], true)) $historyLimit = $n;
}

/* ── Handle POST: Mark booking as returned (admin override) ── */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'], $_POST['booking_id'])) {
    $booking_id   = intval($_POST['booking_id']);
    $actual_hours = intval($_POST['actual_hours'] ?? 0);

    if ($_POST['action'] === 'set_available' && $booking_id > 0) {
        /* Fetch booking to compute refund */
        $s = $conn->prepare("SELECT rate, deposit, pickup_date, pickup_time, hours FROM bookings WHERE id=? AND status='active' LIMIT 1");
        $s->bind_param("i", $booking_id);
        $s->execute();
        $res = $s->get_result();
        $booking = $res->fetch_assoc();
        $s->close();

        if ($booking) {
            $rate    = intval($booking['rate']);
            $deposit = intval($booking['deposit'] ?? 2500);

            if ($actual_hours <= 0) {
                $pickup_dt = $booking['pickup_date'] . ' ' . $booking['pickup_time'];
                $elapsed   = (time() - strtotime($pickup_dt)) / 3600;
                $actual_hours = max(1, (int)ceil($elapsed));
            }

            $base_charged  = $rate * $actual_hours;
            $gst_charged   = round($base_charged * 0.18);
            $total_charged = $base_charged + $gst_charged;
            /* Can be negative: means customer owes extra beyond deposit */
            $refund_amount = $deposit - $total_charged;

            $s = $conn->prepare("UPDATE bookings SET status='returned', actual_hours=?, refund_amount=?, returned_at=NOW() WHERE id=? AND status='active'");
            $s->bind_param("iii", $actual_hours, $refund_amount, $booking_id);
            $s->execute();
            $s->close();

            /* Pass return summary to display as popup via session */
            $_SESSION['return_summary'] = [
                'booking_id'    => $booking_id,
                'actual_hours'  => $actual_hours,
                'base_charged'  => $base_charged,
                'gst_charged'   => $gst_charged,
                'total_charged' => $total_charged,
                'deposit'       => $deposit,
                'refund_amount' => $refund_amount,
                'rate'          => $rate,
            ];
        }
    }
    header("Location: admin.php");
    exit();
}

/* Grab return summary from session and clear it */
$returnSummary = null;
if (!empty($_SESSION['return_summary'])) {
    $returnSummary = $_SESSION['return_summary'];
    unset($_SESSION['return_summary']);
}

/* ── Fetch all bikes ── */
$menuBikes = [];
$res = $conn->query("SELECT bike_name FROM menu ORDER BY id");
while ($row = $res->fetch_assoc()) {
    $menuBikes[] = $row['bike_name'];
}

/* ── Current availability ── */
$now = date('Y-m-d H:i:s');
$bikeStatus = [];
foreach ($menuBikes as $bike) { $bikeStatus[$bike] = 'available'; }

$stmt = $conn->prepare("
    SELECT DISTINCT bike_name FROM bookings
    WHERE status = 'active'
      AND (
          pickup_date <= CURRENT_DATE
          OR NOW() >= TIMESTAMP(pickup_date, pickup_time) - INTERVAL 1 HOUR
      )
");
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    if (isset($bikeStatus[$row['bike_name']])) {
        $bikeStatus[$row['bike_name']] = 'booked';
    }
}
$stmt->close();

/* For the dashboard counts, we want to show all active bookings as 'booked' */
$res = $conn->query("SELECT COUNT(*) as cnt FROM bookings WHERE status='active'");
$bookedCount = ($res) ? $res->fetch_assoc()['cnt'] : 0;
$availableCount = count($menuBikes) - $bookedCount;
if ($availableCount < 0) $availableCount = 0;

/* ── Active bookings ── */
$activeBookings = [];
$res = $conn->query("
    SELECT *, DATE_FORMAT(pickup_time, '%h:%i %p') AS pickup_time_fmt
    FROM bookings
    WHERE status='active'
    ORDER BY pickup_date ASC, pickup_time ASC
");
if ($res) while ($row = $res->fetch_assoc()) $activeBookings[] = $row;

/* ── History ── */
$historyBookings = [];
$res = $conn->query("
    SELECT *, DATE_FORMAT(pickup_time, '%h:%i %p') AS pickup_time_fmt
    FROM bookings
    WHERE status='returned'
    ORDER BY booked_at DESC
    LIMIT " . (int)$historyLimit
);
if ($res) while ($row = $res->fetch_assoc()) $historyBookings[] = $row;

/* ── Revenue — only from RETURNED bookings, using actual hours, excludes deposit ── */
$base_total  = 0;
$grand_total = 0;
foreach ($historyBookings as $b) {
    $hrs         = (isset($b['actual_hours']) && intval($b['actual_hours']) > 0)
                   ? intval($b['actual_hours']) : intval($b['hours']);
    $base        = intval($b['rate']) * $hrs;
    $gst         = round($base * 0.18);
    $base_total  += $base;
    $grand_total += $base + $gst;
}
$cgst = round($base_total * 0.09);

/* ── Contact messages ── */
$contactMessages = [];
$cRes = $conn->query("SELECT * FROM contacts ORDER BY created_at DESC LIMIT 50");
if ($cRes) while ($row = $cRes->fetch_assoc()) $contactMessages[] = $row;

$conn->close();

include __DIR__ . '/../admin_panel.html';
