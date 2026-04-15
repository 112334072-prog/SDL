/* ── Booking data from sessionStorage ── */
let bookingData = {};
(function () {
  try { bookingData = JSON.parse(sessionStorage.getItem('bikeBooking') || '{}'); } catch(e){}

  if (!bookingData.bike) {
    const p = new URLSearchParams(window.location.search);
    bookingData = {
      bike : p.get('bike')  || '',
      name : p.get('name')  || '',
      phone: p.get('phone') || '',
      date : p.get('date')  || '',
      hours: p.get('hours') || 1,
      rate : p.get('rate')  || 0,
      base : p.get('base')  || 0,
      gst  : p.get('gst')   || 0,
      subtotal: p.get('subtotal') || 0,
      deposit: 2500,
      total: p.get('total') || 0,
    };
  }

  const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
  const hrs = bookingData.hours;

  document.getElementById('sumBike').textContent   = bookingData.bike  || '—';
  document.getElementById('sumName').textContent   = bookingData.name  || '—';
  document.getElementById('sumDate').textContent   = bookingData.date  || '—';
  document.getElementById('sumHours').textContent  = hrs ? hrs + ' hr' + (hrs > 1 ? 's' : '') : '—';
  document.getElementById('sumTime') && (document.getElementById('sumTime').textContent = bookingData.time_display || bookingData.pickup_time || '—');
  const depEl = document.getElementById('sumDeposit');
  if (depEl) depEl.textContent = fmt(bookingData.deposit || 2500);
  document.getElementById('sumTotal').textContent = fmt(bookingData.total || bookingData.deposit || 2500);

  const amtLabel = bookingData.total ? fmt(bookingData.total) : 'Now';
  ['btnAmtCard','btnAmtUpi','btnAmtNb'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = amtLabel;
  });
  const qr = document.getElementById('qrAmt');
  if (qr) qr.textContent = bookingData.total ? fmt(bookingData.total) : '—';
})();

/* ── Tab switching ── */
function switchTab(name) {
  document.querySelectorAll('.method-tab').forEach((t, i) => {
    const panels = ['card','upi','qr','netbanking'];
    t.classList.toggle('active', panels[i] === name);
  });
  document.querySelectorAll('.pay-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel-' + name);
  });
  document.getElementById('errBanner').classList.remove('show');
}

function selectUpi(el, app) {
  document.querySelectorAll('.upi-app-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const hints = { gpay:'yourname@okicici', phonepe:'yourname@ybl',
                  paytm:'yourname@paytm',  bhim:'yourname@upi' };
  document.getElementById('upiId').placeholder = hints[app] || 'yourname@upi';
}

function fmtCard(el) {
  let v = el.value.replace(/\D/g,'').slice(0,16);
  el.value = v.replace(/(.{4})/g,'$1 ').trim();
}
function fmtExp(el) {
  let v = el.value.replace(/\D/g,'').slice(0,4);
  /* Auto-correct month: clamp first digit — if user types 2-9 prepend 0 */
  if (v.length === 1 && parseInt(v[0]) > 1) v = '0' + v;
  /* After 2 digits, clamp month to 01-12 */
  if (v.length >= 2) {
    let m = parseInt(v.slice(0,2));
    if (m < 1)  m = 1;
    if (m > 12) m = 12;
    v = String(m).padStart(2,'0') + v.slice(2);
  }
  if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
  el.value = v;
}
function fmtCardName(el) {
  el.value = el.value.replace(/[^a-zA-Z\s]/g, '');
}

function showErr(msg) {
  const b = document.getElementById('errBanner');
  b.textContent = msg; b.classList.add('show');
}

function genTxn() {
  return 'TXN#BG' + Date.now().toString().slice(-6) +
         Math.random().toString(36).slice(2,5).toUpperCase();
}

/* ── Save booking to DB — stores rental total (without deposit) ── */
async function saveBooking() {
  const payload = {
    bike        : bookingData.bike,
    pickup_time : bookingData.pickup_time || '09:00',
    name        : bookingData.name,
    phone       : bookingData.phone,
    date        : bookingData.date,
    hours       : parseInt(bookingData.hours)    || 1,
    rate        : parseInt(bookingData.rate)     || 0,
    gst         : parseInt(bookingData.gst)      || 0,
    total       : parseInt(bookingData.subtotal || bookingData.total) || 0, /* rental cost only */
  };

  const res = await fetch('php/api_book.php', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(payload)
  });
  return await res.json();
}

/* ── Success overlay ── */
function showSuccess(txn) {
  const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
  const hrs = bookingData.hours;

  document.getElementById('txnId').textContent   = txn;
  document.getElementById('sd-bike').textContent = bookingData.bike  || '—';
  document.getElementById('sd-name').textContent = bookingData.name  || '—';
  document.getElementById('sd-date').textContent = bookingData.date  || '—';
  if (document.getElementById('sd-time'))
    document.getElementById('sd-time').textContent = bookingData.time_display || bookingData.pickup_time || '—';
  document.getElementById('sd-hours').textContent   = hrs ? hrs + ' hr' + (hrs > 1 ? 's' : '') : '—';
  const sdDep = document.getElementById('sd-deposit');
  if (sdDep) sdDep.textContent = fmt(bookingData.deposit || 2500);

  document.getElementById('successOverlay').classList.add('show');
  sessionStorage.removeItem('bikeBooking');
}

function showFail(msg) {
  document.getElementById('failMsg').textContent = msg || 'Something went wrong. Please try again.';
  document.getElementById('failOverlay').classList.add('show');
}

let pendingMethod = null;
let lastConfirmedMethod = null;
let confirmDefaultText = '';

function setConfirmState(state, opts = {}) {
  const box      = document.querySelector('#confirmOverlay .confirm-box');
  const icon     = document.getElementById('confirmIcon');
  const title    = document.getElementById('confirmTitle');
  const text     = document.getElementById('confirmText');
  const okBtn    = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const actions2 = document.getElementById('confirmActions2');
  if (!box || !icon || !title || !text || !okBtn || !cancelBtn || !actions2) return;

  box.classList.remove('state-processing','state-success','state-fail');
  actions2.style.display = 'none';
  okBtn.style.display = ''; cancelBtn.style.display = '';
  okBtn.disabled = false; cancelBtn.disabled = false;

  if (state === 'confirm') {
    icon.textContent  = '!';
    title.textContent = opts.title || 'Confirm Payment';
    text.textContent  = opts.text  || confirmDefaultText || 'Click OK to proceed.';
  } else if (state === 'processing') {
    box.classList.add('state-processing');
    icon.textContent  = '…';
    title.textContent = 'Processing Payment';
    text.textContent  = 'Please wait…';
    okBtn.disabled = true; cancelBtn.disabled = true;
  } else if (state === 'success') {
    box.classList.add('state-success');
    icon.textContent  = '✓';
    title.textContent = opts.title || 'Booking Successful';
    text.textContent  = opts.text  || 'Your booking has been confirmed.';
    okBtn.style.display = 'none'; cancelBtn.style.display = 'none';
    actions2.style.display = '';
  } else if (state === 'fail') {
    box.classList.add('state-fail');
    icon.textContent  = '✕';
    title.textContent = opts.title || 'Booking Failed';
    text.textContent  = opts.text  || 'Something went wrong. Please try again.';
    okBtn.style.display = 'none'; cancelBtn.style.display = 'none';
    actions2.style.display = '';
  }
}

function showPaymentConfirmation(method) {
  const methodNames = { card:'Credit/Debit Card', upi:'UPI', qr:'QR Code', netbanking:'Net Banking' };
  pendingMethod = method;
  const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
  const text = `Confirm payment via ${methodNames[method] || 'selected method'}?\n\n` +
    `Refundable Deposit: ${fmt(bookingData.deposit || 2500)}\n` +
    `Total Payable: ${fmt(bookingData.total || bookingData.deposit || 2500)}\n\n` +
    `Click OK to proceed with payment.`;
  confirmDefaultText = text;
  const t = document.getElementById('confirmText');
  if (t) t.textContent = text;
  const o = document.getElementById('confirmOverlay');
  if (o) o.classList.add('show');
  setConfirmState('confirm', { text });
}

function closeConfirm() {
  pendingMethod = null;
  const o = document.getElementById('confirmOverlay');
  if (o) o.classList.remove('show');
}

function retryFromConfirm() {
  if (!lastConfirmedMethod) { setConfirmState('confirm'); return; }
  pendingMethod = lastConfirmedMethod;
  setConfirmState('confirm', { text: confirmDefaultText });
}

async function confirmOk() {
  const method = pendingMethod;
  if (!method) return;
  lastConfirmedMethod = method;
  pendingMethod = null;
  setConfirmState('processing');
  const result = await processPayment(method, { ui:'confirm' });
  if (result && result.ok) {
    setConfirmState('success', { text: result.message });
  } else {
    setConfirmState('fail', { text: (result && result.message) ? result.message : 'Something went wrong. Please try again.' });
  }
}

function confirmGoHome() {
  if (confirm('Are you sure you want to go back to home?\n\nYour booking will be cancelled if payment is not completed.')) {
    window.location.href = 'home.html';
  }
}

/* ── Main process payment ── */
async function processPayment(method, opts = {}) {
  document.getElementById('errBanner').classList.remove('show');
  const inConfirm = opts && opts.ui === 'confirm';

  if (method === 'card') {
    const name = document.getElementById('cardName').value.trim();
    const num  = document.getElementById('cardNum').value.replace(/\s/g,'');
    const exp  = document.getElementById('cardExp').value.trim();
    const cvv  = document.getElementById('cardCvv').value.trim();
    if (!name)                    return fail(inConfirm, 'Missing required fields: Cardholder Name');
    if (!/^[a-zA-Z\s]+$/.test(name)) return fail(inConfirm, 'Cardholder name must contain only letters and spaces.');
    if (num.length !== 16)        return fail(inConfirm, 'Missing/invalid required fields: Card Number');
    if (!/^\d{2}\/\d{2}$/.test(exp)) return fail(inConfirm, 'Missing/invalid required fields: Expiry (MM/YY)');
    /* Validate month 01-12 and year not in past */
    const [expM, expY] = exp.split('/').map(Number);
    const now2 = new Date();
    const curM = now2.getMonth() + 1;
    const curY = now2.getFullYear() % 100;
    if (expM < 1 || expM > 12) return fail(inConfirm, 'Invalid expiry month. Must be 01–12.');
    if (expY < curY || (expY === curY && expM < curM)) return fail(inConfirm, 'Card has expired. Please use a valid card.');
    if (cvv.length !== 3)         return fail(inConfirm, 'Missing/invalid required fields: CVV');
  }
  if (method === 'upi') {
    const id = document.getElementById('upiId').value.trim();
    if (!id || !id.includes('@')) return fail(inConfirm, 'Missing required fields: UPI ID');
  }
  if (method === 'netbanking') {
    const bank = document.getElementById('bankSelect').value;
    const uid  = document.getElementById('nbUserId').value.trim();
    const pass = document.getElementById('nbPass').value;
    if (!bank) return fail(inConfirm, 'Missing required fields: Bank');
    if (!uid)  return fail(inConfirm, 'Missing required fields: Net Banking User ID');
    if (!pass) return fail(inConfirm, 'Missing required fields: Password');
  }

  const btn = document.querySelector('#panel-' + method + ' .btn-pay');
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Processing…'; btn.disabled = true; }

  try {
    const result = await saveBooking();

    if (!result.success) {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
      const msg = result.msg || 'Booking could not be saved. Please try again.';
      if (!inConfirm) showFail(msg);
      return { ok:false, message: msg };
    }

    await new Promise(r => setTimeout(r, 1200));

    const txn = genTxn();
    if (!inConfirm) {
      showSuccess(txn);
      return { ok:true, message:'Booking confirmed.' };
    }

    const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
    const hrs = bookingData.hours;
    const hrsLabel = hrs ? (hrs + ' hr' + (hrs > 1 ? 's' : '')) : '—';
    sessionStorage.removeItem('bikeBooking');
    return {
      ok: true,
      message:
        `Transaction: ${txn}\n\n` +
        `Bike: ${bookingData.bike || '—'}\n` +
        `Customer: ${bookingData.name || '—'}\n` +
        `Date: ${bookingData.date || '—'}\n` +
        `Hours: ${hrsLabel}\n` +
        `Deposit Paid (Refundable): ${fmt(bookingData.deposit || 2500)}`
    };
  } catch (err) {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
    const msg = 'Network error. Please check your connection and try again.';
    if (!inConfirm) showFail(msg);
    return { ok:false, message: msg };
  }
}

function fail(inConfirm, msg) {
  if (!inConfirm) showFail(msg);
  return { ok:false, message: msg };
}
