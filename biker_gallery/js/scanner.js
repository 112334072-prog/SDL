/* ══════════════════════════════════════════
   Biker Gallery — scanner.js
   Uses Tesseract.js v5 (free browser OCR)
   No API key required · No scan limits
══════════════════════════════════════════ */

class KYCVerifier {
  constructor() {
    this.panData      = null;
    this.dlData       = null;
    this._workerPromise = null;   // single shared promise — prevents double-init
    this._init();
  }

  /* ── Worker: lazy-init, concurrency-safe ── */
  _getWorker() {
    if (!this._workerPromise) {
      this._workerPromise = (async () => {
        // Tesseract.js v5: createWorker(lang) — no OEM arg, no extra options needed
        const w = await Tesseract.createWorker('eng');
        return w;
      })();
    }
    return this._workerPromise;
  }

  _init() {
    document.getElementById('panFile').addEventListener('change', e => this._handle(e, 'pan'));
    document.getElementById('dlFile').addEventListener('change',  e => this._handle(e, 'dl'));
  }

  async _handle(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    if (type === 'pan') this.panData = null;
    else                this.dlData  = null;
    this._resetVerification();
    this._showPreview(file, type);
    await this._scan(file, type);
  }

  _showPreview(file, type) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById(`${type}Preview`).src = e.target.result;
      document.getElementById(`${type}Zone`).classList.add('has-image');
    };
    reader.readAsDataURL(file);
  }

  async _scan(file, type) {
    const chip   = document.getElementById(`${type}Chip`);
    const chipTx = document.getElementById(`${type}ChipText`);
    const result = document.getElementById(`${type}Result`);

    result.className = 'result-card';
    result.innerHTML = '';
    chip.classList.add('visible');
    chipTx.textContent = 'Loading OCR engine…';

    try {
      const worker = await this._getWorker();
      chipTx.textContent = 'Reading document text…';

      // Convert file to dataURL for Tesseract (works reliably across browsers)
      const dataUrl = await this._fileToDataURL(file);

      const { data: { text } } = await worker.recognize(dataUrl);
      chipTx.textContent = 'Extracting fields…';

      const parsed = type === 'pan' ? this._parsePAN(text) : this._parseDL(text);
      if (type === 'pan') this.panData = parsed;
      else                this.dlData  = parsed;

      this._showDocResult(type, parsed, text);
      this._autoFillIfReady();

    } catch (err) {
      console.error('OCR error:', err);
      result.className = 'result-card err visible';
      result.innerHTML = `<div class="rc-title">Scan Failed</div>
        <div>Could not read document. Upload a clear, well-lit photo.</div>
        <div style="font-size:11px;margin-top:4px;opacity:.7">${err.message || err}</div>`;
    } finally {
      chip.classList.remove('visible');
    }
  }

  /* ── File → base64 dataURL ── */
  _fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /* ── PAN Card parser ── */
  _parsePAN(rawText) {
    // Uppercase the whole text so all regex matches work regardless of OCR casing
    const text  = rawText.toUpperCase();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let name = null, dob = null, id = null;

    // PAN number: AAAAA9999A
    const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
    if (panMatch) id = panMatch[1];

    // DOB: prefer labelled, fall back to any DD/MM/YYYY or DD-MM-YYYY
    const dobMatch =
      text.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^0-9]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i) ||
      text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (dobMatch) dob = this._normaliseDate(dobMatch[1]);

    // Name: a line of 2–5 all-caps words, none from the skip list
    const skip = new Set([
      'INCOME','TAX','DEPARTMENT','DEPT','GOVT','GOVERNMENT',
      'INDIA','PERMANENT','ACCOUNT','NUMBER','CARD','SIGNATURE',
      'OF','THE','FORM','FORM16','YOUR'
    ]);
    for (const line of lines) {
      const cleaned = line.replace(/[^A-Z\s]/g, '').trim();
      const words   = cleaned.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 5) continue;
      if (words.some(w => skip.has(w)))          continue;
      if (cleaned.length < 5)                    continue;
      name = cleaned;
      break;
    }

    return { name, dob, id };
  }

  /* ── Driving License parser ── */
  _parseDL(rawText) {
    const text = rawText.toUpperCase();
    let name = null, dob = null, id = null;

    // DL number patterns (Indian): "DL No: TN0220XXXXXXXX" or bare "TN02 XXXX XXXX"
    const dlMatch =
      text.match(/DL\s*(?:NO|NUMBER|NO\.)[.:)]*\s*([A-Z]{2}[\s\-]?\d{2}[\s\-\d]+)/i) ||
      text.match(/\b([A-Z]{2}\d{2}\s?\d{4,}\s?\d*)\b/);
    if (dlMatch) id = dlMatch[1].replace(/\s+/g, ' ').trim();

    // DOB
    const dobMatch =
      text.match(/DOB\s*[:\-.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i) ||
      text.match(/DATE\s*OF\s*BIRTH\s*[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i) ||
      text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (dobMatch) dob = this._normaliseDate(dobMatch[1]);

    // Name: labelled "Name:" or "LName:" lines (DL format varies by state)
    const nameMatch =
      text.match(/(?:^|\n)\s*(?:NAME|L\.?\s*NAME)\s*[:\.]?\s*([A-Z][A-Z\s]{2,})/m);
    if (nameMatch) {
      name = nameMatch[1]
        .replace(/^(S\/O|D\/O|W\/O|C\/O|S\/D\/W\s+OF)\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Fallback: look for a plain all-caps name line (≥2 words, no digits)
    if (!name) {
      const skip = new Set([
        'DRIVING','LICENSE','LICENCE','MOTOR','VEHICLE','TRANSPORT',
        'AUTHORITY','INDIA','GOVT','GOVERNMENT','DEPARTMENT','SIGNATURE','DATE'
      ]);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const cleaned = line.replace(/[^A-Z\s]/g, '').trim();
        const words   = cleaned.split(/\s+/).filter(Boolean);
        if (words.length < 2 || words.length > 5) continue;
        if (words.some(w => skip.has(w)))          continue;
        if (cleaned.length < 5)                    continue;
        name = cleaned;
        break;
      }
    }

    return { name, dob, id };
  }

  /* ── Render result card ── */
  _showDocResult(type, data, rawText) {
    const el    = document.getElementById(`${type}Result`);
    const label = type === 'pan' ? 'PAN Card' : 'Driving License';
    const idKey = type === 'pan' ? 'PAN No' : 'DL No&nbsp;';

    if (data.name || data.dob || data.id) {
      el.className = 'result-card ok visible';
      el.innerHTML = `
        <div class="rc-title">${label} scanned</div>
        ${data.name
          ? `<div class="rc-field">Name&nbsp;&nbsp; : ${data.name}</div>`
          : `<div class="rc-field" style="opacity:.5">Name : not detected</div>`}
        ${data.dob
          ? `<div class="rc-field">DOB&nbsp;&nbsp;&nbsp; : ${data.dob}</div>`
          : `<div class="rc-field" style="opacity:.5">DOB  : not detected</div>`}
        ${data.id
          ? `<div class="rc-field">${idKey} : ${data.id}</div>`
          : ''}`;
    } else {
      el.className = 'result-card warn visible';
      el.innerHTML = `
        <div class="rc-title">Partial Read</div>
        <div>Fields not detected. Try a clearer, well-lit image.</div>
        <details style="margin-top:8px;cursor:pointer">
          <summary style="font-size:11px;opacity:.6">Show raw OCR text</summary>
          <pre style="font-size:10px;margin-top:6px;white-space:pre-wrap;opacity:.5">${rawText.slice(0, 600)}</pre>
        </details>`;
    }
  }

  /* ── Auto-fill form from scanned data ── */
  _autoFillIfReady() {
    // Use whichever doc was just scanned; prefer PAN if both done
    const data = this.panData || this.dlData;
    if (!data) return;

    if (data.name) {
      const nameField = document.getElementById('full_name');
      if (nameField && !nameField.value.trim()) {
        // Capitalise each word (e.g. "RAHUL SHARMA" → "Rahul Sharma")
        nameField.value = data.name
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase())
          .slice(0, 35);
        if (typeof updateCounter === 'function') updateCounter('full_name', 'nameCount', 35);
        if (typeof validateName === 'function')  validateName(nameField);
      }
    }

    if (data.dob) {
      const dobField = document.getElementById('dob');
      if (dobField) {
        try {
          // _normaliseDate always returns DD/MM/YYYY at this point
          const parts = data.dob.split('/');
          if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            const isoDate = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
            dobField.removeAttribute('readonly');
            dobField.value = isoDate;
            dobField.setAttribute('readonly', true);
            if (typeof validateDOB === 'function') validateDOB(dobField);
          }
        } catch (e) {
          console.warn('DOB fill failed:', e);
        }
      }
    }

    const banner = document.getElementById('verificationBanner');
    if (banner) {
      banner.className = 'visible ok';
      banner.innerHTML = `
        <div class="vb-header">
          <span class="vb-icon">✓</span>
          <span>Document scanned — details auto-filled above</span>
        </div>
        <div class="vb-body" style="font-size:13px;color:var(--muted);margin-top:4px;">
          You can edit the fields if anything was misread.
        </div>`;
    }
  }

  _resetVerification() {
    const banner = document.getElementById('verificationBanner');
    if (banner) { banner.className = ''; banner.innerHTML = ''; }
  }

  /* ── Date normalisation: always returns DD/MM/YYYY ── */
  _normaliseDate(s) {
    if (!s) return '';
    // Unify separators
    let d = s.replace(/[.\-]/g, '/').trim();
    // If it came in as YYYY/MM/DD, flip it
    const iso = d.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (iso) d = `${iso[3]}/${iso[2]}/${iso[1]}`;
    return d; // DD/MM/YYYY
  }
}

document.addEventListener('DOMContentLoaded', () => new KYCVerifier());
