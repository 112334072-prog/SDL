<?php
/* ============================================================
   php/api_availability.php — Biker Gallery
   TIME-BASED AVAILABILITY ENGINE + DEPOSIT RETURN SYSTEM

   GET  ?bike=<n>&date=<YYYY-MM-DD>
        → Returns blocked time slots and bookings for that bike/date

   GET  (no params)
        → All bikes with current real-time status

   POST { action:'set_available', booking_id:<id>, actual_hours:<n> }
        → Admin: marks booking 'returned', calculates refund
          Returns hours_used, total_charged, deposit, refund_amount

   AVAILABILITY WINDOW per booking:
     blocked_from  = pickup_time - 1 HOUR (early buffer)
     blocked_until = pickup_time + hours + 1 HOUR (post-rental buffer)
     Admin override (set_available) releases bike immediately.
   ============================================================ */
require_once 'db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

/* ── Admin override: mark booking as returned + compute refund ── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input      = json_decode(file_get_contents('php://input'), true) ?? [];
    $action     = trim($input['action']       ?? $_POST['action']       ?? '');
    $booking_id = intval($input['booking_id'] ?? $_POST['booking_id']   ?? 0);
    $actual_hours = intval($input['actual_hours'] ?? $_POST['actual_hours'] ?? 0);

    if ($action === 'set_available' && $booking_id > 0) {
        /* Fetch booking details to compute refund */
        $stmt = $conn->prepare(
            "SELECT rate, gst, total, deposit, hours, pickup_date, pickup_time FROM bookings WHERE id=? AND status='active' LIMIT 1"
        );
        $stmt->bind_param("i", $booking_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $booking = $res->fetch_assoc();
        $stmt->close();

        if (!$booking) {
            $conn->close();
            echo json_encode(['success' => false, 'msg' => 'Booking not found or already returned']);
            exit();
        }

        $rate    = intval($booking['rate']);
        $deposit = intval($booking['deposit'] ?? 2500);

        /* If actual_hours not supplied, compute from NOW vs pickup_time */
        if ($actual_hours <= 0) {
            $pickup_dt = $booking['pickup_date'] . ' ' . $booking['pickup_time'];
            $elapsed   = (time() - strtotime($pickup_dt)) / 3600;
            $actual_hours = max(1, ceil($elapsed));
        }

        $base_charged  = $rate * $actual_hours;
        $gst_charged   = round($base_charged * 0.18);
        $total_charged = $base_charged + $gst_charged;
        $refund_amount = $deposit - $total_charged; /* negative = customer owes extra */

        /* Update booking */
        $stmt = $conn->prepare(
            "UPDATE bookings SET status='returned', actual_hours=?, refund_amount=?, returned_at=NOW()
             WHERE id=? AND status='active'"
        );
        $stmt->bind_param("iii", $actual_hours, $refund_amount, $booking_id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        $conn->close();

        echo json_encode([
            'success'       => $affected > 0,
            'msg'           => $affected > 0 ? 'Booking marked as returned' : 'Update failed',
            'actual_hours'  => $actual_hours,
            'rate_per_hour' => $rate,
            'base_charged'  => $base_charged,
            'gst_charged'   => $gst_charged,
            'total_charged' => $total_charged,
            'deposit'       => $deposit,
            'refund_amount' => $refund_amount,
        ]);
        exit();
    }

    echo json_encode(['success' => false, 'msg' => 'Invalid request']);
    exit();
}

/* ── GET: single bike + date → blocked hours ── */
if (isset($_GET['bike'], $_GET['date'])) {
    $bike = trim($_GET['bike']);
    $date = trim($_GET['date']);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        echo json_encode(['error' => 'Invalid date format']);
        exit();
    }

    $stmt = $conn->prepare("
        SELECT
            pickup_time,
            hours,
            id,
            customer_name,
            phone,
            TIMESTAMP(pickup_date, pickup_time) - INTERVAL 1 HOUR AS blocked_from,
            CASE WHEN hours = 0 THEN NULL
                 ELSE TIMESTAMP(pickup_date, pickup_time) + INTERVAL (hours+1) HOUR
            END AS blocked_until
        FROM bookings
        WHERE bike_name = ?
          AND status    = 'active'
          AND pickup_date = ?
        ORDER BY pickup_time
    ");
    $stmt->bind_param("ss", $bike, $date);
    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    $stmt->close();

    /*
       SMART BLOCKING LOGIC:
       - If a booking exists on this date: block only (pickup_hour - 1) and pickup_hour onward
         (1-hr early buffer + the booked slot itself and all later slots = unavailable until admin clears)
       - Slots BEFORE (pickup_hour - 1) remain AVAILABLE for new customers
       - If bike is still out from a PREVIOUS date (not returned): block the entire date
       - bookings_info passed to frontend so UI can show "already booked at X:XX PM" note
    */
    $blockedHours  = [];
    $bookings_info = [];  /* [{pickup_hour, customer_name}] for note display */

    /* Check if bike is still out from a prior date */
    $chkStmt = $conn->prepare(
        "SELECT id, customer_name, pickup_time FROM bookings
          WHERE bike_name=? AND status='active' AND pickup_date < ? LIMIT 1"
    );
    $chkStmt->bind_param("ss", $bike, $date);
    $chkStmt->execute();
    $chkRes = $chkStmt->get_result();
    $priorRow = $chkRes->fetch_assoc();
    $chkStmt->close();

    if ($priorRow) {
        /* Bike still out from a prior day — block entire requested date */
        for ($h = 8; $h <= 22; $h++) $blockedHours[] = $h;
        $bookings_info[] = [
            'pickup_hour'   => -1,
            'customer_name' => $priorRow['customer_name'],
            'note'          => 'Bike not yet returned from previous booking'
        ];
    } elseif (!empty($rows)) {
        foreach ($rows as $row) {
            $pickupHour = (int)substr($row['pickup_time'], 0, 2);
            $bufferHour = max(8, $pickupHour - 1);  /* 1-hr early buffer, min 8 AM */

            /* Block from buffer hour onward for the rest of the day */
            for ($h = $bufferHour; $h <= 22; $h++) $blockedHours[] = $h;

            $pickupTime  = date('g:i A', strtotime('2000-01-01 ' . $row['pickup_time']));
            /* Use bufferHour (already clamped to min 8) so we never show 7:00 AM */
            $bufferTime  = date('g:i A', mktime(0, 0, 0, 1, 1, 2000) + $bufferHour * 3600);
            $bookings_info[] = [
                'pickup_hour'     => $pickupHour,
                'buffer_hour'     => $bufferHour,
                'customer_name'   => $row['customer_name'],
                'pickup_time_fmt' => $pickupTime,
                'buffer_time_fmt' => $bufferTime,
                'note'            => 'Bike booked (pickup: ' . $pickupTime . '). Unavailable from ' . $bufferTime . ' onward.'
            ];
        }
    }
    $blockedHours = array_values(array_unique($blockedHours));

    $conn->close();
    echo json_encode([
        'bike'          => $bike,
        'date'          => $date,
        'blocked_hours' => $blockedHours,
        'bookings_info' => $bookings_info,
        'bookings'      => $rows
    ]);
    exit();
}

/* ── GET (no params): all bikes → current real-time status ── */
$now = date('Y-m-d H:i:s');

$result = $conn->query("SELECT bike_name FROM menu ORDER BY id");
$bikes  = [];
while ($row = $result->fetch_assoc()) {
    $bikes[$row['bike_name']] = 'available';
}

/*
   Open-ended booking (hours=0): bike is booked from (pickup - 1hr) until admin returns it.
   No upper time bound — purely status='active'.
   Legacy fixed-hour bookings (hours>0): keep original window check too.
*/
/*
   Mark bike as booked if:
   - Booking is active
   - NOW is at or after (pickup_datetime - 1 hour)  [buffer window started]
   - AND either hours=0 (open-ended, no return time) OR still within fixed window
*/
$stmt = $conn->prepare("
    SELECT DISTINCT bike_name
    FROM bookings
    WHERE status = 'active'
      AND NOW() >= TIMESTAMP(pickup_date, pickup_time) - INTERVAL 1 HOUR
      AND (
          hours = 0
          OR NOW() < TIMESTAMP(pickup_date, pickup_time) + INTERVAL (hours + 1) HOUR
      )
");
/* No params needed — uses MySQL NOW() directly for timezone consistency */
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    if (isset($bikes[$row['bike_name']])) {
        $bikes[$row['bike_name']] = 'booked';
    }
}
$stmt->close();
$conn->close();

echo json_encode($bikes);
