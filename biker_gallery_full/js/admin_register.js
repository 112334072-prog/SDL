/* ── Helpers ── */
function showFE(id, msg) {
  const e = document.getElementById(id);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function clearFE(id) {
  const e = document.getElementById(id);
  if (e) { e.textContent = ''; e.classList.remove('show'); }
}
function markInvalid(el, errId, msg) {
  showFE(errId, msg);
  el.classList.add('invalid');
  el.classList.remove('valid');
}
function markValid(el, errId) {
  clearFE(errId);
  el.classList.remove('invalid');
  el.classList.add('valid');
}

/* ── SHA-256 (Web Crypto API) — same as login.html ── */
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Toggle show/hide password ── */
function togglePw(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
}

/* ── Show ?msg= server redirect error ── */
(function () {
  const msg = new URLSearchParams(window.location.search).get('msg');
  if (msg) {
    const el = document.getElementById('errMsg');
    el.textContent = decodeURIComponent(msg.replace(/\+/g, ' '));
    el.classList.add('show');
  }
})();

/* ================================================================
   Blur-time live validation
================================================================ */
document.addEventListener('DOMContentLoaded', function () {

  /* ── Username: 4–25 chars, letters / numbers / _ ── */
  const uname = document.getElementById('unameField');
  uname.addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v)
      return markInvalid(this, 'errUname', 'Username is required.');
    if (v.length < 4 || v.length > 25 || !/^[A-Za-z0-9_]+$/.test(v))
      return markInvalid(this, 'errUname',
        'Username must be 4–25 characters (letters, numbers, _ only).');
    markValid(this, 'errUname');
  });
  uname.addEventListener('input', function () {
    if (/^[A-Za-z0-9_]{4,25}$/.test(this.value.trim()))
      markValid(this, 'errUname');
  });

  /* ── Full Name: 2–35 chars, letters + spaces only ── */
  const fname = document.getElementById('fullNameField');
  fname.addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v)
      return markInvalid(this, 'errFullName', 'Full name is required.');
    if (v.length < 2 || v.length > 35 || !/^[A-Za-z\s]+$/.test(v))
      return markInvalid(this, 'errFullName',
        'Name must be 2–35 characters (letters only).');
    markValid(this, 'errFullName');
  });
  fname.addEventListener('input', function () {
    const v = this.value.trim();
    if (v.length >= 2 && v.length <= 35 && /^[A-Za-z\s]+$/.test(v))
      markValid(this, 'errFullName');
  });

  /* ── Email: valid format, max 64 chars ── */
  const email = document.getElementById('emailField');
  email.addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v)
      return markInvalid(this, 'errEmail', 'Email is required.');
    if (v.length > 64 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return markInvalid(this, 'errEmail',
        'Enter a valid email address (max 64 characters).');
    markValid(this, 'errEmail');
  });
  email.addEventListener('input', function () {
    const v = this.value.trim();
    if (v.length <= 64 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      markValid(this, 'errEmail');
  });

  /* ── Phone: exactly 10 digits ── */
  const phone = document.getElementById('phoneField');
  phone.addEventListener('input', function () {
    /* Strip non-digits and cap at 10 */
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
    if (this.value.length === 10) markValid(this, 'errPhone');
    else { this.classList.remove('valid'); this.classList.remove('invalid'); }
  });
  phone.addEventListener('blur', function () {
    if (this.value.length !== 10)
      markInvalid(this, 'errPhone', 'Phone number must be exactly 10 digits.');
    else
      markValid(this, 'errPhone');
  });

  /* ── Password: 6–20 chars ── */
  const pw = document.getElementById('pwField');
  pw.addEventListener('blur', function () {
    if (!this.value)
      return markInvalid(this, 'errPwd', 'Password is required.');
    if (this.value.length < 6 || this.value.length > 20)
      return markInvalid(this, 'errPwd', 'Password must be 6–20 characters.');
    markValid(this, 'errPwd');
  });
  pw.addEventListener('input', function () {
    if (this.value.length >= 6 && this.value.length <= 20)
      markValid(this, 'errPwd');
  });

  /* ── Confirm Password ── */
  const pw2 = document.getElementById('pw2Field');
  pw2.addEventListener('blur', function () {
    if (!this.value)
      return markInvalid(this, 'errPwd2', 'Please confirm your password.');
    if (this.value !== document.getElementById('pwField').value)
      return markInvalid(this, 'errPwd2', 'Passwords do not match.');
    markValid(this, 'errPwd2');
  });
  pw2.addEventListener('input', function () {
    if (this.value === document.getElementById('pwField').value &&
        this.value.length >= 6)
      markValid(this, 'errPwd2');
    else if (this.value.length > 0)
      this.classList.remove('valid');
  });
});

/* ================================================================
   Submit handler:
     1. Validate all fields
     2. SHA-256 hash the plain password
     3. Put the hash in BOTH password fields (PHP checks they match)
     4. POST to php/admin_register.php
================================================================ */
async function doAdminRegister(event) {
  event.preventDefault();

  const unameEl  = document.getElementById('unameField');
  const fnameEl  = document.getElementById('fullNameField');
  const emailEl  = document.getElementById('emailField');
  const phoneEl  = document.getElementById('phoneField');
  const pwEl     = document.getElementById('pwField');
  const pw2El    = document.getElementById('pw2Field');

  const uname = unameEl.value.trim();
  const fname = fnameEl.value.trim();
  const email = emailEl.value.trim();
  const phone = phoneEl.value.trim();
  const pw    = pwEl.value;
  const pw2   = pw2El.value;

  let ok = true;

  /* Username */
  if (!uname || uname.length < 4 || uname.length > 25 ||
      !/^[A-Za-z0-9_]+$/.test(uname)) {
    markInvalid(unameEl, 'errUname',
      'Username must be 4–25 characters (letters, numbers, _ only).');
    ok = false;
  }

  /* Full Name */
  if (!fname || fname.length < 2 || fname.length > 35 ||
      !/^[A-Za-z\s]+$/.test(fname)) {
    markInvalid(fnameEl, 'errFullName',
      'Name must be 2–35 characters (letters only).');
    ok = false;
  }

  /* Email */
  if (!email || email.length > 64 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    markInvalid(emailEl, 'errEmail',
      'Enter a valid email address (max 64 characters).');
    ok = false;
  }

  /* Phone */
  if (phone.length !== 10) {
    markInvalid(phoneEl, 'errPhone',
      'Phone number must be exactly 10 digits.');
    ok = false;
  }

  /* Password */
  if (!pw || pw.length < 6 || pw.length > 20) {
    markInvalid(pwEl, 'errPwd', 'Password must be 6–20 characters.');
    ok = false;
  }

  /* Confirm */
  if (pw !== pw2) {
    markInvalid(pw2El, 'errPwd2', 'Passwords do not match.');
    ok = false;
  }

  if (!ok) return;

  /* ── SHA-256 hash before sending ── */
  const hashed = await sha256(pw);

  /* Use hidden inputs to carry the hash — visible fields are never modified */
  const hiddenPw1 = document.createElement('input');
  hiddenPw1.type  = 'hidden';
  hiddenPw1.name  = 'upswd1';
  hiddenPw1.value = hashed;

  const hiddenPw2 = document.createElement('input');
  hiddenPw2.type  = 'hidden';
  hiddenPw2.name  = 'upswd2';
  hiddenPw2.value = hashed;

  /* Temporarily remove name from visible pw fields so they don't POST */
  pwEl.removeAttribute('name');
  pw2El.removeAttribute('name');

  const frm = event.target;
  frm.appendChild(hiddenPw1);
  frm.appendChild(hiddenPw2);
  frm.submit();
}
