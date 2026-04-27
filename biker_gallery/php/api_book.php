<?php
/* ============================================================
   php/api_book.php — Biker Gallery
   Single-slot booking: customer picks ONE pickup time.
   Bike becomes unavailable from (pickup - 1hr) until admin
   marks it available. hours=0 stored; admin records actual on return.
   ============================================================ */
require_once 'db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$data        = json_decode(file_get_contents('php://input'), true);
$bike        = trim($data['bike']        ?? '');
$name        = trim($data['name']        ?? '');
$phone       = trim($data['phone']       ?? '');
$date        = trim($data['date']        ?? '');
$pickup_time = trim($data['pickup_time'] ?? '');
$rate        = intval($data['rate']      ?? 0);
$deposit     = 2500;

if (!$bike || !$name || !$phone || !$date || !$pickup_time) {
    echo json_encode(['success' => false, 'msg' => 'Missing required fields']);
    exit();
}

if (!preg_match('/^\d{2}:\d{2}$/', $pickup_time)) {
    echo json_encode(['success' => false, 'msg' => 'Invalid pickup time format']);
    exit();
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    echo json_encode(['success' => false, 'msg' => 'Invalid date format']);
    exit();
}

/* Verify bike exists */
$stmt = $conn->prepare("SELECT id FROM menu WHERE bike_name = ? LIMIT 1");
$stmt->bind_param("s", $bike);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close(); $conn->close();
    echo json_encode(['success' => false, 'msg' => 'Bike not found']);
    exit();
}
$stmt->close();

/*
   Overlap check:
   A single-slot booking blocks from (pickup - 1hr) onward until admin clears.
   For conflict detection: existing booking blocked_from = pickup - 1hr,
   blocked_until = very far future (status='active' = open-ended).
   New booking: new_blocked_from = pickup - 1hr.
   Conflict if any active booking exists for this bike on this date
   whose (pickup - 1hr) overlaps the new slot.
   Simplest rule: if any active booking exists for this bike on this date, reject.
   (One bike = one booking at a time; admin must clear before a new one.)
*/
$pickup_dt     = $date . ' ' . $pickup_time . ':00';
$new_from      = date('Y-m-d H:i:s', strtotime($pickup_dt) - 3600);

$stmt = $conn->prepare("
    SELECT id FROM bookings
    WHERE bike_name = ?
      AND status    = 'active'
      AND pickup_date = ?
    LIMIT 1
");
$stmt->bind_param("ss", $bike, $date);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    echo json_encode(['success' => false, 'msg' => 'Bike is already booked for that date']);
    exit();
}
$stmt->close();

/* Insert — hours=0, gst=0, total=deposit (customer pays deposit only) */
$hours = 0;
$gst   = 0;
$total = $deposit;

$stmt = $conn->prepare(
    "INSERT INTO bookings
       (bike_name, customer_name, phone, pickup_date, pickup_time, hours, rate, gst, total, deposit, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')"
);
$stmt->bind_param("sssssiiiii", $bike, $name, $phone, $date, $pickup_time, $hours, $rate, $gst, $total, $deposit);

if ($stmt->execute()) {
    $booking_id = $stmt->insert_id;
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => true, 'msg' => 'Booking confirmed', 'booking_id' => $booking_id]);
} else {
    $err = $stmt->error;
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'msg' => 'Booking failed: ' . $err]);
}
