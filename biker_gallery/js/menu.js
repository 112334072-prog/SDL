/* ============================================================
   js/menu.js — Biker Gallery
   Loads availability from DB and updates all bike cards.
   Polls every 30 seconds so chips flip automatically
   1 hour before a booked pickup time.
   ============================================================ */

function filter(cat, el) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.bike-card').forEach(c => {
    c.style.display = (cat === 'all' || c.dataset.cat === cat) ? '' : 'none';
  });
  document.querySelectorAll('.category-heading').forEach(h => {
    h.style.display = (cat === 'all' || h.dataset.catHead === cat) ? '' : 'none';
  });
}

/* Load availability from DB and update all bike cards */
async function loadAvailability() {
  try {
    const res  = await fetch('../php/api_availability.php');
    const data = await res.json();

    document.querySelectorAll('.bike-card').forEach(card => {
      const bikeName = card.querySelector('.bike-name')?.textContent?.trim();
      if (!bikeName) return;

      const status  = data[bikeName] || 'available';
      const chip    = card.querySelector('.avail-chip');
      const bookBtn = card.querySelector('.btn.btn-primary');

      if (status === 'booked') {
        /* Update availability chip */
        if (chip) {
          chip.innerHTML = '<span class="avail-dot unavail-dot"></span>Unavailable';
          chip.classList.add('unavail-chip');
        }
        /* Disable Book Now button */
        if (bookBtn) {
          bookBtn.dataset.originalHref = bookBtn.dataset.originalHref || bookBtn.getAttribute('href') || '';
          bookBtn.removeAttribute('href');
          bookBtn.classList.add('btn-disabled');
          bookBtn.textContent = 'Unavailable';
          bookBtn.style.pointerEvents = 'none';
          bookBtn.style.opacity       = '0.45';
          bookBtn.style.cursor        = 'not-allowed';
          bookBtn.style.background    = '#334155';
        }
        card.style.opacity = '0.75';
      } else {
        /* Restore available state */
        if (chip) {
          chip.innerHTML = '<span class="avail-dot"></span>Available';
          chip.classList.remove('unavail-chip');
        }
        if (bookBtn) {
          const orig = bookBtn.dataset.originalHref;
          if (orig) bookBtn.setAttribute('href', orig);
          bookBtn.classList.remove('btn-disabled');
          bookBtn.textContent         = 'Book Now →';
          bookBtn.style.pointerEvents = '';
          bookBtn.style.opacity       = '';
          bookBtn.style.cursor        = '';
          bookBtn.style.background    = '';
        }
        card.style.opacity = '';
      }
    });
  } catch(e) {
    console.warn('Availability check failed:', e);
  }
}

/* Poll every 30 seconds — chips flip automatically 1 hr before pickup */
document.addEventListener('DOMContentLoaded', () => {
  loadAvailability();
  setInterval(loadAvailability, 30000);
});
