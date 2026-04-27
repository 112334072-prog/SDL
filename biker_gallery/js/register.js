/* ── Show / Hide password ── */
  function togglePwd() {
    const inp = document.getElementById('upswd1');
    const btn = document.getElementById('pwdBtn');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
  }

  /* ── Helpers ── */
  function updateCounter(fieldId, counterId, max) {
    const val = document.getElementById(fieldId).value.length;
    const el  = document.getElementById(counterId);
    if (el) el.textContent = val;
  }

  function setErr(inputEl, msgId, show, msg) {
    const m = document.getElementById(msgId);
    if (show) {
      if (m) { if (msg) m.textContent = msg; m.classList.add('show'); }
    } else {
      if (m) m.classList.remove('show');
    }
  }

  function showErr(msg) {
    const e = document.getElementById('errBanner');
    e.textContent = msg;
    e.classList.add('show');
    e.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  /* ── Field Validators — show error on blur if invalid, clear if valid ── */
  function validateName(el) {
    const v = el.value.trim();
    if (v.length === 0) { setErr(el,'nameErr',false); return true; }
    /* Letters and spaces only — no numbers, no special characters. Min 3 chars. */
    const ok = v.length >= 3 && v.length <= 35 && /^[A-Za-z\s]+$/.test(v);
    setErr(el, 'nameErr', !ok, 'Name must be 3–35 characters (letters and spaces only, no numbers or special characters).');
    return ok;
  }

  function validateUsername(el) {
    const v = el.value.trim();
    if (v.length === 0) { setErr(el,'unameErr',false); return true; }
    /* Letters, numbers AND special characters all allowed. Min 4 chars. */
    const ok = v.length >= 4 && v.length <= 25;
    setErr(el, 'unameErr', !ok, 'Username must be 4–25 characters (any characters allowed).');
    return ok;
  }

  function validateDOB(el) {
    const v = el.value;
    if (!v) { setErr(el,'dobErr',false); return false; }
    const dob   = new Date(v);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    const ok = age >= 18;
    setErr(el, 'dobErr', !ok, 'You must be at least 18 years old.');
    return ok;
  }

  function validateEmail(el) {
    const v = el.value.trim();
    if (v.length === 0)                                          { setErr(el,'emailErr',false); return true; }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 64;
    setErr(el, 'emailErr', !ok, 'Enter a valid email address (max 64 characters).');
    return ok;
  }

  function validatePhone(el) {
    const v = el.value.trim();
    if (v.length === 0)                                          { setErr(el,'phoneErr',false); return true; }
    const ok = /^\d{10}$/.test(v);
    setErr(el, 'phoneErr', !ok, 'Phone number must be exactly 10 digits.');
    return ok;
  }

  function validatePassword(el) {
    const v = el.value;
    if (v.length === 0)                                          { setErr(el,'pwdErr',false);   return true; }
    const ok = v.length >= 6 && v.length <= 20;
    setErr(el, 'pwdErr', !ok, 'Password must be 6–20 characters.');
    return ok;
  }

  function validateConfirmPassword(el) {
    const v   = el.value;
    const pwd = document.getElementById('upswd1').value;
    if (v.length === 0)                                          { setErr(el,'cpwdErr',false);  return true; }
    const ok = v === pwd;
    setErr(el, 'cpwdErr', !ok, 'Passwords do not match.');
    return ok;
  }

  /* ── Max DOB: 18 years ago ── */
  (function setMaxDOB() {
    const dob = document.getElementById('dob');
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    const yyyy = today.getFullYear();
    const mm   = String(today.getMonth() + 1).padStart(2,'0');
    const dd   = String(today.getDate()).padStart(2,'0');
    dob.max = `${yyyy}-${mm}-${dd}`;
  })();

  /* ── Show ?msg= error from register.php ── */
  (function () {
    const msg = new URLSearchParams(window.location.search).get('msg');
    if (msg) {
      const e = document.getElementById('errBanner');
      e.textContent = decodeURIComponent(msg.replace(/\+/g, ' '));
      e.classList.add('show');
    }
  })();

  /* ── SHA-256 helper ── */
  async function sha256(message) {
    const msgBuffer  = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ── Submit ── */
  async function submitForm() {
    document.getElementById('errBanner').classList.remove('show');

    const name    = document.getElementById('full_name');
    const uname   = document.getElementById('uname1');
    const dob     = document.getElementById('dob');
    const email   = document.getElementById('email');
    const phone   = document.getElementById('phone');
    const pwd     = document.getElementById('upswd1');
    const cpwd    = document.getElementById('upswd2');
    const panFile = document.getElementById('panFile');
    const dlFile  = document.getElementById('dlFile');

    // Trigger all validators on submit
    const nameOk  = validateName(name);
    const unameOk = validateUsername(uname);
    const dobOk   = validateDOB(dob);
    const emailOk = validateEmail(email);
    const phoneOk = validatePhone(phone);
    const pwdOk   = validatePassword(pwd);
    const cpwdOk  = validateConfirmPassword(cpwd);

    const docsOk = panFile.files.length > 0 && dlFile.files.length > 0;
    const docsErrEl = document.getElementById('docsErr');
    docsErrEl.style.display = docsOk ? 'none' : 'block';

    if (!name.value.trim())  { setErr(name,  'nameErr',  true, 'Full name is required.');          showErr('Full name is required.');                           return; }
    if (!nameOk)             { showErr('Name must be 3–35 characters (letters and spaces only, no numbers or special characters).'); return; }
    if (!uname.value.trim()) { setErr(uname, 'unameErr', true, 'Username is required.');             showErr('Username is required.');                            return; }
    if (!unameOk)            { showErr('Username must be 4–25 characters.'); return; }
    if (!dob.value)          { setErr(dob,   'dobErr',   true, 'Date of birth is required.');        showErr('Please select your date of birth.');                return; }
    if (!dobOk)              { showErr('You must be at least 18 years old.');                         return; }
    if (!email.value.trim()) { setErr(email, 'emailErr', true, 'Email address is required.');        showErr('Email address is required.');                       return; }
    if (!emailOk)            { showErr('Please enter a valid email address (max 64 chars).');         return; }
    if (!phone.value.trim()) { setErr(phone, 'phoneErr', true, 'Phone number is required.');         showErr('Phone number is required.');                        return; }
    if (!phoneOk)            { showErr('Phone number must be exactly 10 digits.');                    return; }
    if (!pwd.value)          { setErr(pwd,   'pwdErr',   true, 'Password is required.');             showErr('Password is required.');                            return; }
    if (!pwdOk)              { showErr('Password must be 6–20 characters.');                          return; }
    if (!cpwd.value)         { setErr(cpwd,  'cpwdErr',  true, 'Please confirm your password.');     showErr('Please confirm your password.');                    return; }
    if (!cpwdOk)             { showErr('Passwords do not match.');                                    return; }
    if (!docsOk)  { showErr('Please upload both PAN Card and Driving License.'); return; }

    /* SHA-256 hash both passwords before sending */
    const pwdHash = await sha256(pwd.value);

    /* Submit to register.php */
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '../php/register.php';
    form.enctype = 'multipart/form-data';

    const fields = {
      full_name: name.value.trim(),
      uname1:    uname.value.trim(),
      dob:       dob.value,
      email:     email.value.trim(),
      phone:     phone.value.trim(),
      upswd1:    pwdHash,
      upswd2:    pwdHash
    };
    for (const [k, v] of Object.entries(fields)) {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.name = k; inp.value = v;
      form.appendChild(inp);
    }

    document.body.appendChild(form);
    form.submit();
  }