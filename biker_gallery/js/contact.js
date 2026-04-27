/* ============================================================
   js/contact.js — Biker Gallery
   Contact form: name, phone, email, message — saves to DB.
   ============================================================ */

function showFE(id, msg) {
  const e = document.getElementById(id);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function clearFE(id) {
  const e = document.getElementById(id);
  if (e) { e.textContent = ''; e.classList.remove('show'); }
}

document.addEventListener('DOMContentLoaded', function () {

  /* Name */
  document.getElementById('cName').addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v || v.length < 2) {
      showFE('errCName', 'Name is required (min 2 characters).');
      this.classList.add('invalid');
    } else {
      clearFE('errCName'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  /* Phone */
  document.getElementById('cPhone').addEventListener('blur', function () {
    if (!/^\d{10}$/.test(this.value.trim())) {
      showFE('errCPhone', 'Enter a valid 10-digit phone number.');
      this.classList.add('invalid');
    } else {
      clearFE('errCPhone'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  /* Email */
  document.getElementById('cEmail').addEventListener('blur', function () {
    const v = this.value.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!v) {
      showFE('errCEmail', 'Email address is required.');
      this.classList.add('invalid');
    } else if (!emailRe.test(v)) {
      showFE('errCEmail', 'Enter a valid email address (e.g. name@gmail.com).');
      this.classList.add('invalid');
    } else {
      clearFE('errCEmail'); this.classList.remove('invalid'); this.classList.add('valid');
    }
  });

  /* Message */
  document.getElementById('cMsg').addEventListener('blur', function () {
    if (!this.value.trim()) {
      showFE('errCMsg', 'Message cannot be empty.');
    } else {
      clearFE('errCMsg');
    }
  });
});

async function sendMsg() {
  const name  = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const msg   = document.getElementById('cMsg').value.trim();

  clearFE('errCName'); clearFE('errCPhone'); clearFE('errCEmail');
  clearFE('errCMsg'); clearFE('errSubmit');
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let ok = true;
  if (!name || name.length < 2) { showFE('errCName', 'Name is required (min 2 characters).'); ok = false; }
  if (!/^\d{10}$/.test(phone))  { showFE('errCPhone', 'Enter a valid 10-digit phone number.'); ok = false; }
  if (!email || !emailRe.test(email)) { showFE('errCEmail', 'Enter a valid email address.'); ok = false; }
  if (!msg)  { showFE('errCMsg', 'Message cannot be empty.'); ok = false; }
  if (!ok) return;

  const btn = document.querySelector('.btn.btn-primary');
  const origText = btn.textContent;
  btn.textContent = 'Sending…'; btn.disabled = true;

  try {
    const res  = await fetch('../php/api_contact.php', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ name, phone, email, msg })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('cName').value  = '';
      document.getElementById('cPhone').value = '';
      document.getElementById('cEmail').value = '';
      document.getElementById('cMsg').value   = '';
      ['cName','cPhone','cEmail'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('valid','invalid');
      });
      const s = document.getElementById('successSend');
      s.classList.add('show');
      setTimeout(() => s.classList.remove('show'), 4000);
    } else {
      showFE('errSubmit', data.msg || 'Failed to send. Please try again.');
    }
  } catch(e) {
    showFE('errSubmit', 'Network error. Please check your connection.');
  } finally {
    btn.textContent = origText; btn.disabled = false;
  }
}
