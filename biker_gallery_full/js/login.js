/* ── Helpers ── */
function showFE(id, msg) {
  const e = document.getElementById(id);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function clearFE(id) {
  const e = document.getElementById(id);
  if (e) { e.textContent = ''; e.classList.remove('show'); }
}

/* ── SHA-256 (Web Crypto API) ── */
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Toggle show/hide password ── */
function togglePw() {
  const inp = document.getElementById('pwField');
  const btn = document.getElementById('pwBtn');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
}

/* ── Show ?msg= server error on redirect ── */
(function () {
  const msg = new URLSearchParams(window.location.search).get('msg');
  if (msg) {
    const el = document.getElementById('errMsg');
    el.textContent = decodeURIComponent(msg.replace(/\+/g, ' '));
    el.classList.add('show');
  }
})();

/* ── Blur-time field validation ── */
document.addEventListener('DOMContentLoaded', function () {
  const uname = document.getElementById('unameField');
  const pw    = document.getElementById('pwField');

  uname.addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v) {
      showFE('errUname', 'Username is required.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else if (v.length < 4) {
      showFE('errUname', 'Username must be at least 4 characters.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else if (!/^[A-Za-z0-9_]+$/.test(v)) {
      showFE('errUname', 'Only letters, numbers and _ allowed.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else {
      clearFE('errUname'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  pw.addEventListener('blur', function () {
    if (!this.value) {
      showFE('errPwd', 'Password is required.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else if (this.value.length < 6) {
      showFE('errPwd', 'Password must be at least 6 characters.');
      this.classList.add('invalid'); this.classList.remove('valid');
    } else {
      clearFE('errPwd'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  pw.addEventListener('input', function () {
    if (this.value.length >= 6) {
      clearFE('errPwd'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });
});

/* ── Validate fields, return true if ok ── */
function validateForm() {
  const uname = document.getElementById('unameField').value.trim();
  const pw    = document.getElementById('pwField').value;
  let ok = true;

  if (!uname || uname.length < 4) {
    showFE('errUname', 'Username must be at least 4 characters.');
    document.getElementById('unameField').classList.add('invalid');
    ok = false;
  }
  if (uname && !/^[A-Za-z0-9_]+$/.test(uname)) {
    showFE('errUname', 'Only letters, numbers and _ allowed.');
    document.getElementById('unameField').classList.add('invalid');
    ok = false;
  }
  if (!pw || pw.length < 6) {
    showFE('errPwd', 'Password must be at least 6 characters.');
    document.getElementById('pwField').classList.add('invalid');
    ok = false;
  }
  return ok;
}

/* ── 👤 Admin float button — logs in as admin ── */
async function adminLogin() {
  if (!validateForm()) return;
  const plainPw = document.getElementById('pwField').value;
  const hashed  = await sha256(plainPw);
  /* Put hash in hidden field — never overwrite visible pw field */
  document.getElementById('hiddenPw').value   = hashed;
  document.getElementById('hiddenAuth').value = 'admin';
  document.loginForm.submit();
}

/* ── Regular Login button submit ── */
async function doLogin(event) {
  event.preventDefault();
  if (!validateForm()) return;
  const plainPw = document.getElementById('pwField').value;
  const hashed  = await sha256(plainPw);
  /* Put hash in hidden field — never overwrite visible pw field */
  document.getElementById('hiddenPw').value   = hashed;
  document.getElementById('hiddenAuth').value = '1';
  event.target.submit();
}