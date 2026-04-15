/* ============================================================
   js/book.js — Biker Gallery
   Single-slot pickup time booking (no duration selection).
   Customer picks ONE time slot (8 AM – 10 PM).
   Bike becomes unavailable from that time (+ 1hr early buffer)
   until admin marks it available.
   Total = ₹2500 refundable deposit only.
   ============================================================ */

const params  = new URLSearchParams(window.location.search);
const BIKE    = params.get('bike') || 'Honda SP 125';
const RATE    = parseInt(params.get('rate')) || 20;
const DEPOSIT = 2500;

document.getElementById('bikeTagName').textContent = BIKE;
document.getElementById('bikeTagRate').textContent = '₹' + RATE + '/hr';

/* ── Set today as min date ── */
const today = new Date().toISOString().split('T')[0];
document.getElementById('bookDate').min   = today;
document.getElementById('bookDate').value = today;

/* ── State ── */
let selectedHour = null;   /* integer 8–22, null = none */
let blockedHours  = [];
let bookingsInfo  = [];   /* [{pickup_hour, customer_name, note}] */
let currentDate   = today;

/* ── Slot definitions: 8 AM – 10 PM ── */
const ALL_SLOTS = [];
for (let h = 8; h <= 22; h++) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 12 ? 12 : (h <= 12 ? h : h - 12);
  ALL_SLOTS.push({ hour: h, label: h12 + ':00 ' + ampm });
}

/* ── Error helpers ── */
function showFE(id, msg) {
  const e = document.getElementById(id);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function clearFE(id) {
  const e = document.getElementById(id);
  if (e) { e.textContent = ''; e.classList.remove('show'); }
}

/* ── Fetch blocked hours for bike + date ── */
async function fetchBlockedSlots(date) {
  const grid = document.getElementById('slotGrid');
  grid.innerHTML = '<div class="slots-loading">Loading slots…</div>';
  try {
    const res  = await fetch(
      'php/api_availability.php?bike=' + encodeURIComponent(BIKE) + '&date=' + date
    );
    const data = await res.json();
    blockedHours = data.blocked_hours || [];
    bookingsInfo = data.bookings_info || [];
  } catch(e) {
    blockedHours = [];
    console.warn('Slot fetch failed:', e);
  }
  /* Deselect if selected slot became blocked */
  if (selectedHour !== null && blockedHours.includes(selectedHour)) {
    selectedHour = null;
  }
  renderSlots();
  updateSummary();
}

/* ── Build a tooltip/note for a blocked slot ── */
function getBlockedNote(hour) {
  /* Find booking info for the slot or any booking that covers this hour */
  for (const b of bookingsInfo) {
    if (b.pickup_hour === -1) return b.note; /* prior-day carry-over */
    /* This hour is in the buffer or at/after pickup */
    if (hour === b.pickup_hour - 1) return 'Buffer slot — ' + b.note;
    if (hour >= b.pickup_hour)      return b.note;
  }
  return 'Already booked';
}

/* ── Show/hide the "already booked" notice banner above the grid ── */
function updateBookingNotice() {
  let notice = document.getElementById('bookingNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'bookingNotice';
    notice.style.cssText =
      'margin-bottom:10px;padding:9px 13px;border-radius:9px;font-size:12px;font-weight:600;' +
      'background:rgba(255,83,112,.1);border:1px solid rgba(255,83,112,.3);color:#ff5370;display:none;';
    const grid = document.getElementById('slotGrid');
    grid.parentNode.insertBefore(notice, grid);
  }
  if (bookingsInfo.length > 0) {
    const b = bookingsInfo[0];
    if (b.pickup_hour === -1) {
      notice.textContent = 'Note: Bike not yet returned from a previous booking. All slots unavailable.';
    } else {
      /* Use server-formatted times if available, else compute locally */
      /* Use server-provided formatted times (already clamped to min 8 AM) */
      const bufFmt  = b.buffer_time_fmt  || (b.buffer_hour != null ? (() => {
        const bh = b.buffer_hour;
        const ap = bh < 12 ? 'AM' : 'PM';
        const h  = bh === 12 ? 12 : (bh > 12 ? bh - 12 : bh);
        return h + ':00 ' + ap;
      })() : null) || (() => {
        /* Fallback: clamp to min 8 */
        const bh = Math.max(8, b.pickup_hour - 1);
        const ap = bh < 12 ? 'AM' : 'PM';
        const h  = bh === 12 ? 12 : (bh > 12 ? bh - 12 : bh);
        return h + ':00 ' + ap;
      })();
      const pickFmt = b.pickup_time_fmt || (() => {
        const ap = b.pickup_hour < 12 ? 'AM' : 'PM';
        const h  = b.pickup_hour === 12 ? 12 : (b.pickup_hour > 12 ? b.pickup_hour - 12 : b.pickup_hour);
        return h + ':00 ' + ap;
      })();
      notice.textContent =
        'Note: This bike is already booked (pickup: ' + pickFmt +
        '). Slots from ' + bufFmt + ' onward are unavailable until the bike is returned.';
    }
    notice.style.display = '';
  } else {
    notice.style.display = 'none';
  }
}

/* ── Render grid — each button is a standalone single-time pick ── */
function renderSlots() {
  const grid = document.getElementById('slotGrid');
  grid.innerHTML = '';

  updateBookingNotice();

  ALL_SLOTS.forEach(slot => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.textContent = slot.label;
    btn.className   = 'slot-btn';

    const isBlocked  = blockedHours.includes(slot.hour);
    const isSelected = selectedHour === slot.hour;

    if (isBlocked) {
      btn.classList.add('slot-blocked');
      btn.disabled = true;
      btn.title    = getBlockedNote(slot.hour);
    } else if (isSelected) {
      btn.classList.add('slot-selected');
      btn.title = 'Selected pickup time';
    }

    if (!isBlocked) {
      btn.addEventListener('click', () => selectSlot(slot.hour));
    }
    grid.appendChild(btn);
  });
}

/* ── Select a single slot ── */
function selectSlot(hour) {
  if (blockedHours.includes(hour)) {
    showFE('errSlot', 'That slot is already booked. Please choose another time.');
    return;
  }
  clearFE('errSlot');
  selectedHour = hour;
  renderSlots();
  updateSummary();
}

/* ── Date change ── */
function onDateChange() {
  currentDate  = document.getElementById('bookDate').value;
  selectedHour = null;
  clearFE('errDate');
  clearFE('errSlot');
  fetchBlockedSlots(currentDate);
  updateSummary();
}

/* ── Summary: only date, pickup time, and deposit ── */
function updateSummary() {
  const dateVal = document.getElementById('bookDate').value;

  if (dateVal) {
    const d = new Date(dateVal);
    document.getElementById('sumDate').textContent =
      d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }

  if (selectedHour !== null) {
    const ampm = selectedHour < 12 ? 'AM' : 'PM';
    const h12  = selectedHour === 12 ? 12 : (selectedHour <= 12 ? selectedHour : selectedHour - 12);
    document.getElementById('sumTime').textContent = h12 + ':00 ' + ampm;
  } else {
    document.getElementById('sumTime').textContent = '—';
  }

  document.getElementById('sumDeposit').textContent = '₹' + DEPOSIT.toLocaleString('en-IN');
  document.getElementById('sumTotal').textContent   = '₹' + DEPOSIT.toLocaleString('en-IN');
}

/* ── Validation on blur ── */
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('name').addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v || v.length < 2) {
      showFE('errName', 'Full name is required (min 2 characters).');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else if (!/^[A-Za-z\s]+$/.test(v)) {
      showFE('errName', 'Name must contain only letters and spaces.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else {
      clearFE('errName');
      this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  document.getElementById('phone').addEventListener('blur', function () {
    const v = this.value.trim();
    if (!/^\d{10}$/.test(v)) {
      showFE('errPhone', 'Phone number must be exactly 10 digits.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else {
      clearFE('errPhone');
      this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  document.getElementById('name').addEventListener('input', function () {
    if (this.value.trim().length >= 2 && /^[A-Za-z\s]+$/.test(this.value.trim())) {
      clearFE('errName'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  fetchBlockedSlots(today);
  updateSummary();
});

/* ── Real-time bike availability chip — polls every 60s ── */
async function checkAvailability() {
  try {
    const res    = await fetch('php/api_availability.php');
    const data   = await res.json();
    const status = data[BIKE] || 'available';
    const chip   = document.getElementById('bikeTagAvail');
    if (status === 'booked') {
      if (chip) { chip.textContent = 'Unavailable Now'; chip.classList.add('tag-unavail'); }
    } else {
      if (chip) { chip.textContent = 'Available'; chip.classList.remove('tag-unavail'); }
    }
    /* Also refresh slot grid so blocked hours update automatically */
    const dateVal = document.getElementById('bookDate')?.value;
    if (dateVal) fetchBlockedSlots(dateVal);
  } catch(e) {
    console.warn('Availability check failed:', e);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  checkAvailability();
  setInterval(checkAvailability, 30000); /* re-check every 30 seconds */
});

/* ── Proceed to payment ── */
function goToPayment() {
  const name  = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const date  = document.getElementById('bookDate').value;

  let ok = true;
  clearFE('errName'); clearFE('errPhone'); clearFE('errDate'); clearFE('errSlot');
  const errMsg = document.getElementById('errMsg');
  if (errMsg) errMsg.classList.remove('show');

  if (!name || name.length < 2 || !/^[A-Za-z\s]+$/.test(name)) {
    showFE('errName', 'Please enter your full name (letters only, min 2 characters).');
    ok = false;
  }
  if (!/^\d{10}$/.test(phone)) {
    showFE('errPhone', 'Phone number must be exactly 10 digits.');
    ok = false;
  }
  if (!date) {
    showFE('errDate', 'Please select a pickup date.');
    ok = false;
  }
  if (selectedHour === null) {
    showFE('errSlot', 'Please select a pickup time slot.');
    ok = false;
  }

  if (!ok) return;

  const pickupTime = String(selectedHour).padStart(2, '0') + ':00';
  const ampm = selectedHour < 12 ? 'AM' : 'PM';
  const h12  = selectedHour === 12 ? 12 : (selectedHour <= 12 ? selectedHour : selectedHour - 12);
  const timeDisplay = h12 + ':00 ' + ampm;

  sessionStorage.setItem('bikeBooking', JSON.stringify({
    bike        : BIKE,
    name,
    phone,
    date,
    pickup_time : pickupTime,
    time_display: timeDisplay,
    hours       : 0,       /* no fixed duration — admin will record actual */
    rate        : RATE,
    base        : 0,
    gst         : 0,
    subtotal    : 0,
    deposit     : DEPOSIT,
    total       : DEPOSIT, /* customer pays deposit only upfront */
  }));

  window.location.href = 'payment.html';
}
