<?php
/* ============================================================
   php/menu.php — Biker Gallery
   Serves the menu page — all bike data loaded from `bikes` DB table.
   ============================================================ */
session_start();
require_once 'db.php';

/* Fetch all bikes ordered by category then id */
$bikes = [];
$res = $conn->query("SELECT * FROM bikes ORDER BY FIELD(category,'125cc','200cc','premium'), id");
if ($res) {
    while ($row = $res->fetch_assoc()) $bikes[] = $row;
}

/* Fetch currently booked bikes */
$bookedBikes = [];
$availRes = $conn->query("
    SELECT DISTINCT bike_name FROM bookings
    WHERE status = 'active'
      AND NOW() >= TIMESTAMP(pickup_date, pickup_time) - INTERVAL 1 HOUR
      AND (
          hours = 0
          OR NOW() < TIMESTAMP(pickup_date, pickup_time) + INTERVAL (hours + 1) HOUR
      )
");
if ($availRes) {
    while ($row = $availRes->fetch_assoc()) $bookedBikes[] = $row['bike_name'];
}
$conn->close();

/* Group by category */
$grouped = ['125cc' => [], '200cc' => [], 'premium' => []];
foreach ($bikes as $b) {
    $grouped[$b['category']][] = $b;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Menu — Biker Gallery</title>
<link rel="stylesheet" href="../css/base.css">
<link rel="stylesheet" href="../css/menu.css">
<style>
.avail-chip.unavail-chip { background:rgba(255,83,112,.18); border-color:rgba(255,83,112,.4); color:#ff7d93; }
.unavail-dot { background:#ff5370 !important; box-shadow:0 0 6px #ff5370 !important; }
</style>
</head>
<body>
<div class="page-bg"></div>

<nav>
  <a class="nav-brand" href="menu.php">BikerGallery</a>
  <ul class="nav-links">
    <li><a href="../html/home.html">Home</a></li>
    <li><a href="menu.php" class="active">Menu</a></li>
    <li><a href="../html/book.html">Book</a></li>
    <li><a href="../html/contact.html">Contact</a></li>
    <li><a href="../html/login.html" class="btn-nav">Logout</a></li>
  </ul>
</nav>

<div class="menu-wrap">
  <div class="menu-header">
    <h1>Our <span>Bike Fleet</span></h1>
    <p>Choose your perfect ride — all bikes fully serviced &amp; ready to go</p>
  </div>

  <div class="filter-row">
    <button class="filter-btn active" onclick="filter('all',this)">All Bikes</button>
    <button class="filter-btn" onclick="filter('125cc',this)">125cc</button>
    <button class="filter-btn" onclick="filter('200cc',this)">200cc</button>
    <button class="filter-btn" onclick="filter('premium',this)">Premium</button>
  </div>

  <div class="bikes-grid" id="grid">

  <?php
  $catLabels = ['125cc' => '125cc', '200cc' => '200cc', 'premium' => 'Premium'];
  foreach ($grouped as $cat => $catBikes):
    if (empty($catBikes)) continue;
    $isPremium = ($cat === 'premium');
  ?>

    <div class="category-heading" data-cat-head="<?= $cat ?>">
      <span <?= $isPremium ? 'class="gold"' : '' ?>><?= htmlspecialchars($catLabels[$cat]) ?></span> Bikes
    </div>

    <?php foreach ($catBikes as $b):
      $bookUrl = '../html/book.html?bike=' . urlencode($b['bike_name']) . '&rate=' . (int)$b['price_hr'];
      $imgSrc  = '../' . htmlspecialchars($b['img_path']);
      $chipClass = $isPremium ? 'cat-chip premium-chip' : 'cat-chip';
    ?>
    <div class="bike-card" data-cat="<?= $cat ?>">
      <div class="bike-img">
        <img src="<?= $imgSrc ?>" alt="<?= htmlspecialchars($b['bike_name']) ?>">
        <?php $isBooked = in_array($b['bike_name'], $bookedBikes); ?>
        <div class="avail-chip <?= $isBooked ? 'unavail-chip' : '' ?>">
          <span class="avail-dot <?= $isBooked ? 'unavail-dot' : '' ?>"></span>
          <?= $isBooked ? 'Unavailable' : 'Available' ?>
        </div>
        <div class="<?= $chipClass ?>"><?= htmlspecialchars($catLabels[$cat]) ?></div>
      </div>
      <div class="bike-body">
        <div class="bike-name"><?= htmlspecialchars($b['bike_name']) ?></div>
        <div class="bike-specs">
          <div class="spec-item">
            <div class="spec-label">Engine</div>
            <div class="spec-val"><?= htmlspecialchars($b['engine']) ?></div>
          </div>
          <div class="spec-item">
            <div class="spec-label">Mileage</div>
            <div class="spec-val"><?= htmlspecialchars($b['mileage']) ?></div>
          </div>
          <div class="spec-item">
            <div class="spec-label">Gearbox</div>
            <div class="spec-val"><?= htmlspecialchars($b['gearbox']) ?></div>
          </div>
          <div class="spec-item">
            <div class="spec-label">Type</div>
            <div class="spec-val"><?= htmlspecialchars($b['type']) ?></div>
          </div>
        </div>
        <div class="bike-price-row">
          <span class="price-main">&#8377;<?= (int)$b['price_hr'] ?></span>
          <span class="price-unit">/hr</span>
          <span class="price-day">&nbsp;&bull;&nbsp;&#8377;<?= (int)$b['price_day'] ?>/day</span>
        </div>
        <a href="<?= $bookUrl ?>" class="btn btn-primary">Book Now &rarr;</a>
      </div>
    </div>
    <?php endforeach; ?>

  <?php endforeach; ?>

  </div><!-- /.bikes-grid -->
</div><!-- /.menu-wrap -->

<footer>&copy; 2026 Biker Gallery &nbsp;&bull;&nbsp; Proprietors: Nithish &amp; Padmasaran &nbsp;&bull;&nbsp; Kanchipuram</footer>

<script src="../js/menu.js"></script>
</body>
</html>
