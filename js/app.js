// NavaAuto — personal repair-info app. Hash router + views, no build step.
(() => {
  const $app = document.getElementById('app');
  const $crumb = document.getElementById('crumb');
  const $back = document.getElementById('backBtn');
  const $viewer = document.getElementById('viewer');
  const S = () => Store.state;

  let LIBRARY = [];

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat(undefined, { style: 'currency', currency: S().settings.currency || 'USD', maximumFractionDigits: 0 }).format(n);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const vehicleName = v => `${v.year} ${v.make} ${v.model}${v.engine ? ' ' + v.engine : ''}`;
  const findVehicle = id => S().vehicles.find(v => v.id === id);
  const key = (vid, rid) => vid + ':' + rid;
  const go = h => { location.hash = h; };
  const dots = n => '●'.repeat(n) + '○'.repeat(5 - n);

  function setChrome(crumb, backTo) {
    $crumb.textContent = crumb || '';
    $back.hidden = !backTo;
    $back.onclick = () => go(backTo);
    window.scrollTo(0, 0);
  }

  function matches(repair, v) {
    const a = repair.appliesTo;
    if (a === '*') return true;
    if (!a || norm(a.make) !== norm(v.make)) return false;
    if (a.models && !a.models.some(m => norm(m) === norm(v.model))) return false;
    if (a.years && (v.year < a.years[0] || v.year > a.years[1])) return false;
    if (a.engine && a.engine.length) {
      const e = norm(v.engine);
      if (!e || !a.engine.some(x => e.includes(norm(x)))) return false;
    }
    return true;
  }

  // Vehicle-specific repairs win; generic ones fill in the gaps (by title).
  function repairsFor(v) {
    const specific = LIBRARY.filter(r => r.appliesTo !== '*' && matches(r, v));
    const titles = specific.map(r => norm(r.title));
    const generic = LIBRARY.filter(r => r.appliesTo === '*' && !titles.some(t => t.startsWith(norm(r.title))));
    const custom = S().custom.filter(r => r.vid === v.id);
    return [...custom, ...specific, ...generic];
  }

  function findRepair(v, rid) { return repairsFor(v).find(r => r.id === rid); }

  function estimate(r) {
    const { laborRate, partsMarkup } = S().settings;
    const labor = (r.laborHours || 0) * laborRate;
    const [lo, hi] = r.partsCost || [0, 0];
    const m = 1 + (partsMarkup || 0) / 100;
    return { labor, diyLo: lo, diyHi: hi, shopLo: labor + lo * m, shopHi: labor + hi * m };
  }

  function youtubeUrl(v, r) {
    const q = `${v.year} ${v.make} ${v.model} ${(v.engine || '').replace(/\(.*?\)/g, '')} ${r.youtube || r.title}`.replace(/\s+/g, ' ').trim();
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }

  function ytId(url) {
    const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
    return m && m[1];
  }

  // ---------- views ----------
  function viewGarage() {
    setChrome('', null);
    const vs = S().vehicles;
    $app.innerHTML = `
      <h1>Garage</h1>
      <div class="grid">
        ${vs.map(v => `
          <a class="card vehicle" href="#/v/${v.id}">
            <div class="v-year">${esc(v.year)}</div>
            <div class="v-name">${esc(v.make)} ${esc(v.model)}</div>
            <div class="muted">${esc(v.engine || 'Engine not set')}</div>
            ${v.nickname ? `<div class="pill">${esc(v.nickname)}</div>` : ''}
          </a>`).join('')}
        <a class="card add" href="#/add">+ Add vehicle</a>
      </div>`;
  }

  function viewAdd() {
    setChrome('Add vehicle', '#/');
    const thisYear = new Date().getFullYear() + 1;
    const years = Array.from({ length: thisYear - 1980 }, (_, i) => thisYear - i);
    $app.innerHTML = `
      <h1>Add vehicle</h1>
      <form id="addForm" class="card form">
        <label>VIN (optional — fills the rest)
          <div class="row"><input id="vin" maxlength="17" placeholder="17-character VIN" autocapitalize="characters">
          <button type="button" id="vinBtn" class="btn">Decode</button></div>
        </label>
        <label>Year
          <select id="year" required><option value="">Select year</option>${years.map(y => `<option>${y}</option>`).join('')}</select>
        </label>
        <label>Make
          <input id="make" list="makes" required placeholder="e.g. Infiniti" autocomplete="off">
          <datalist id="makes">${VPIC.COMMON_MAKES.map(m => `<option value="${m}">`).join('')}</datalist>
        </label>
        <label>Model <span id="modelStatus" class="muted small"></span>
          <input id="model" list="models" required placeholder="Select year + make first" autocomplete="off">
          <datalist id="models"></datalist>
        </label>
        <label>Engine / trim
          <input id="engine" placeholder="e.g. 3.0t, Red Sport 400, 2.0t">
        </label>
        <label>Nickname (optional)<input id="nickname"></label>
        <label>Current mileage (optional)<input id="mileage" inputmode="numeric"></label>
        <button class="btn primary" type="submit">Save vehicle</button>
      </form>`;

    const f = id => document.getElementById(id);
    async function loadModels() {
      const y = f('year').value, m = f('make').value.trim();
      if (!y || !m) return;
      f('modelStatus').textContent = 'loading…';
      try {
        const list = await VPIC.models(m, y);
        f('models').innerHTML = list.map(x => `<option value="${esc(x)}">`).join('');
        f('modelStatus').textContent = list.length ? `${list.length} models` : 'none found — type it in';
      } catch {
        f('modelStatus').textContent = 'offline — type the model in';
      }
    }
    f('year').onchange = loadModels;
    f('make').onchange = loadModels;
    f('vinBtn').onclick = async () => {
      const vin = f('vin').value.trim();
      if (vin.length !== 17) return alert('A VIN is 17 characters.');
      f('vinBtn').textContent = '…';
      try {
        const d = await VPIC.decodeVin(vin);
        if (d.year) f('year').value = d.year;
        if (d.make) f('make').value = d.make;
        if (d.model) f('model').value = d.model;
        f('engine').value = [d.engine, d.trim].filter(Boolean).join(' ');
        loadModels();
      } catch { alert('Could not decode VIN (offline?).'); }
      f('vinBtn').textContent = 'Decode';
    };
    f('addForm').onsubmit = e => {
      e.preventDefault();
      const v = {
        id: Store.uid('v'), year: +f('year').value, make: f('make').value.trim().toUpperCase(),
        model: f('model').value.trim(), engine: f('engine').value.trim(),
        nickname: f('nickname').value.trim(), mileage: f('mileage').value.trim()
      };
      S().vehicles.push(v); Store.save(); go('#/v/' + v.id);
    };
  }

  function viewVehicle(vid) {
    const v = findVehicle(vid);
    if (!v) return go('#/');
    setChrome(`${v.year} ${v.model}`, '#/');
    const all = repairsFor(v);
    const cats = [...new Set(all.map(r => r.category))].sort();
    const specificCount = all.filter(r => r.appliesTo !== '*').length;
    $app.innerHTML = `
      <div class="vhead">
        <div>
          <h1>${esc(vehicleName(v))}</h1>
          <div class="muted">${specificCount} vehicle-specific · ${all.length - specificCount} generic · shop rate ${money(S().settings.laborRate)}/hr</div>
        </div>
        <div class="actions">
          <a class="btn" href="#/v/${vid}/recalls">Recalls</a>
          <a class="btn" href="#/v/${vid}/log">Job log</a>
          <a class="btn" href="#/v/${vid}/new">+ Custom repair</a>
          <button class="btn danger" id="delV">Remove</button>
        </div>
      </div>
      <input id="q" class="search" type="search" placeholder="Search repairs (e.g. plugs, brakes, coolant)">
      <div class="chips" id="chips">
        <button class="chip on" data-c="">All</button>
        ${cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div id="list" class="list"></div>`;

    let cat = '';
    const render = () => {
      const q = norm(document.getElementById('q').value);
      const rows = all.filter(r => (!cat || r.category === cat) && (!q || norm(r.title + r.category + (r.parts || []).join('')).includes(q)));
      document.getElementById('list').innerHTML = rows.map(r => {
        const e = estimate(r);
        const prog = S().progress[key(vid, r.id)] || [];
        const done = prog.filter(Boolean).length;
        return `
          <a class="card repair" href="#/v/${vid}/r/${encodeURIComponent(r.id)}">
            <div class="r-main">
              <div class="r-title">${esc(r.title)}</div>
              <div class="muted small">${esc(r.category)} · difficulty ${dots(r.difficulty || 1)}
                ${r.appliesTo === '*' ? '<span class="tag generic">generic</span>' : ''}
                ${r.vid ? '<span class="tag custom">custom</span>' : ''}
                ${done ? `<span class="tag">${done}/${r.steps.length} steps</span>` : ''}</div>
            </div>
            <div class="r-cost">
              <div class="hours">${r.laborHours ?? '—'} hr</div>
              <div class="small">Shop ≈ ${money(e.shopLo)}–${money(e.shopHi)}</div>
              <div class="small muted">DIY ≈ ${money(e.diyLo)}–${money(e.diyHi)}</div>
            </div>
          </a>`;
      }).join('') || '<p class="muted">No repairs match.</p>';
    };
    document.getElementById('q').oninput = render;
    document.getElementById('chips').onclick = e => {
      const b = e.target.closest('.chip'); if (!b) return;
      cat = b.dataset.c;
      document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
      render();
    };
    document.getElementById('delV').onclick = () => {
      if (!confirm(`Remove ${vehicleName(v)} from your garage?`)) return;
      S().vehicles = S().vehicles.filter(x => x.id !== vid); Store.save(); go('#/');
    };
    render();
  }

  async function viewRepair(vid, rid) {
    const v = findVehicle(vid);
    const r = v && findRepair(v, rid);
    if (!r) return go('#/v/' + vid);
    const k = key(vid, rid);
    setChrome(r.title, '#/v/' + vid);
    const e = estimate(r);
    const prog = S().progress[k] || [];
    const vids = S().videos[k] || [];
    const unverified = (r.specs || []).some(s => s.verify);

    $app.innerHTML = `
      <h1>${esc(r.title)}</h1>
      <div class="muted">${esc(vehicleName(v))} · ${esc(r.category)}
        ${r.appliesTo === '*' ? '<span class="tag generic">generic procedure</span>' : ''}</div>

      <div class="stats">
        <div class="stat"><div class="label">Labor (est.)</div><div class="big">${r.laborHours ?? '—'} hr</div>${r.laborNote ? `<div class="small muted">${esc(r.laborNote)}</div>` : ''}</div>
        <div class="stat"><div class="label">Shop price (est.)</div><div class="big">${money(e.shopLo)}–${money(e.shopHi)}</div><div class="small muted">${money(e.labor)} labor + parts w/ ${S().settings.partsMarkup}% markup</div></div>
        <div class="stat"><div class="label">DIY parts</div><div class="big">${money(e.diyLo)}–${money(e.diyHi)}</div></div>
        <div class="stat"><div class="label">Difficulty</div><div class="big">${dots(r.difficulty || 1)}</div></div>
      </div>
      ${r.interval ? `<p class="small"><b>Interval:</b> ${esc(r.interval)}</p>` : ''}

      ${(r.warnings || []).length ? `<div class="warn">${r.warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join('')}</div>` : ''}

      <div class="two">
        <section class="card"><h3>Parts</h3><ul>${(r.parts || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">None</li>'}</ul></section>
        <section class="card"><h3>Tools</h3><ul>${(r.tools || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">None</li>'}</ul></section>
      </div>

      ${(r.specs || []).length ? `
      <section class="card"><h3>Specs</h3>
        ${unverified ? '<p class="small warn-text">Specs flagged “verify” are reference values — confirm them in the factory service manual before torquing anything.</p>' : ''}
        <table class="specs">${r.specs.map(s => `<tr><td>${esc(s.label)}</td><td>${esc(s.value)} ${s.verify ? '<span class="tag verify">verify</span>' : ''}</td></tr>`).join('')}</table>
      </section>` : ''}

      <section class="card">
        <div class="sec-head"><h3>Steps</h3><button class="btn small" id="resetSteps">Reset</button></div>
        <ol class="steps">
          ${r.steps.map((s, i) => `
            <li class="${prog[i] ? 'done' : ''}">
              <label><input type="checkbox" data-i="${i}" ${prog[i] ? 'checked' : ''}><span>${esc(s.text)}</span></label>
              ${s.tip ? `<div class="small muted">${esc(s.tip)}</div>` : ''}
            </li>`).join('')}
        </ol>
      </section>

      <section class="card">
        <div class="sec-head"><h3>Diagrams & documents</h3>
          <label class="btn small">+ Add photo/PDF<input type="file" id="fileIn" accept="image/*,application/pdf" multiple hidden></label></div>
        <p class="small muted">Add pages from your service manual, screenshots, or photos you take during the job. Stored only on this device.</p>
        <div id="files" class="thumbs"></div>
      </section>

      <section class="card">
        <div class="sec-head"><h3>Videos</h3>
          <a class="btn small primary" target="_blank" rel="noopener" href="${youtubeUrl(v, r)}">Search YouTube ↗</a></div>
        <div id="vids" class="vids">
          ${vids.map((x, i) => {
            const id = ytId(x.url);
            return `<div class="vid">
              ${id ? `<a target="_blank" rel="noopener" href="${esc(x.url)}"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt=""></a>` : ''}
              <div><a target="_blank" rel="noopener" href="${esc(x.url)}">${esc(x.title || x.url)}</a>
              <button class="link danger" data-del="${i}">remove</button></div></div>`;
          }).join('')}
        </div>
        <form id="vidForm" class="row">
          <input id="vidUrl" type="url" placeholder="Paste a YouTube link you found helpful" required>
          <input id="vidTitle" placeholder="Label (optional)">
          <button class="btn">Save</button>
        </form>
      </section>

      <section class="card">
        <h3>My notes</h3>
        <textarea id="notes" rows="4" placeholder="Part numbers you used, gotchas, torque you actually used…">${esc(S().notes[k] || '')}</textarea>
      </section>

      <div class="actions">
        <a class="btn primary" href="#/v/${vid}/log?rid=${encodeURIComponent(rid)}">Log this job</a>
        ${r.vid ? `<a class="btn" href="#/v/${vid}/r/${encodeURIComponent(rid)}/edit">Edit</a><button class="btn danger" id="delR">Delete</button>` : `<button class="btn" id="dupR">Copy as custom &amp; edit</button>`}
      </div>`;

    // steps
    $app.querySelector('.steps').onchange = ev => {
      const i = +ev.target.dataset.i;
      const p = S().progress[k] || (S().progress[k] = []);
      p[i] = ev.target.checked; Store.save();
      ev.target.closest('li').classList.toggle('done', ev.target.checked);
    };
    document.getElementById('resetSteps').onclick = () => { delete S().progress[k]; Store.save(); viewRepair(vid, rid); };

    // notes
    let t; document.getElementById('notes').oninput = ev => {
      clearTimeout(t); t = setTimeout(() => { S().notes[k] = ev.target.value; Store.save(); }, 400);
    };

    // videos
    document.getElementById('vidForm').onsubmit = ev => {
      ev.preventDefault();
      (S().videos[k] || (S().videos[k] = [])).push({ url: document.getElementById('vidUrl').value.trim(), title: document.getElementById('vidTitle').value.trim() });
      Store.save(); viewRepair(vid, rid);
    };
    document.getElementById('vids').onclick = ev => {
      const d = ev.target.dataset.del; if (d === undefined) return;
      S().videos[k].splice(+d, 1); Store.save(); viewRepair(vid, rid);
    };

    // custom repair actions
    const del = document.getElementById('delR');
    if (del) del.onclick = () => {
      if (!confirm('Delete this custom repair?')) return;
      S().custom = S().custom.filter(x => x.id !== rid); Store.save(); go('#/v/' + vid);
    };
    const dup = document.getElementById('dupR');
    if (dup) dup.onclick = () => {
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = Store.uid('c'); copy.vid = vid; copy.appliesTo = { custom: true }; copy.title = r.title + ' (my version)';
      S().custom.push(copy); Store.save(); go(`#/v/${vid}/r/${copy.id}/edit`);
    };

    // attachments
    document.getElementById('fileIn').onchange = async ev => {
      for (const file of ev.target.files) await Store.files.add(k, file);
      renderFiles(k);
    };
    renderFiles(k);
  }

  async function renderFiles(k) {
    const box = document.getElementById('files'); if (!box) return;
    let list = [];
    try { list = await Store.files.list(k); } catch { box.innerHTML = '<p class="muted small">File storage unavailable in this browser.</p>'; return; }
    box.innerHTML = list.map(f => {
      const url = URL.createObjectURL(f.blob);
      return `<div class="thumb" data-id="${f.id}">
        ${f.type.startsWith('image/') ? `<img src="${url}" alt="${esc(f.name)}">` : `<div class="pdf">PDF</div>`}
        <div class="small ellip">${esc(f.name)}</div>
        <button class="link danger" data-rm="${f.id}">remove</button></div>`;
    }).join('') || '<p class="muted small">No diagrams yet.</p>';
    box.onclick = async ev => {
      if (ev.target.dataset.rm) {
        if (confirm('Remove this file?')) { await Store.files.remove(ev.target.dataset.rm); renderFiles(k); }
        return;
      }
      const th = ev.target.closest('.thumb'); if (!th) return;
      const f = list.find(x => x.id === th.dataset.id);
      openViewer(f);
    };
  }

  function openViewer(f) {
    const url = URL.createObjectURL(f.blob);
    if (!f.type.startsWith('image/')) { window.open(url, '_blank'); return; }
    $viewer.innerHTML = `<button class="close">✕</button><div class="zoom"><img src="${url}" alt=""></div>`;
    $viewer.hidden = false;
    $viewer.querySelector('.close').onclick = () => { $viewer.hidden = true; $viewer.innerHTML = ''; };
  }

  function viewEdit(vid, rid) {
    const v = findVehicle(vid); if (!v) return go('#/');
    const existing = rid && S().custom.find(x => x.id === rid);
    const r = existing || { title: '', category: 'General', laborHours: 1, difficulty: 2, partsCost: [0, 0], parts: [], tools: [], specs: [], warnings: [], steps: [], youtube: '' };
    setChrome(existing ? 'Edit repair' : 'New repair', existing ? `#/v/${vid}/r/${rid}` : `#/v/${vid}`);
    const lines = a => (a || []).join('\n');
    $app.innerHTML = `
      <h1>${existing ? 'Edit' : 'New'} custom repair</h1>
      <p class="muted">${esc(vehicleName(v))} — one item per line in the list fields.</p>
      <form id="ef" class="card form">
        <label>Title<input id="title" required value="${esc(r.title)}"></label>
        <div class="row">
          <label>Category<input id="category" value="${esc(r.category)}"></label>
          <label>Labor hours<input id="hours" type="number" step="0.1" min="0" value="${r.laborHours}"></label>
          <label>Difficulty (1–5)<input id="diff" type="number" min="1" max="5" value="${r.difficulty}"></label>
        </div>
        <div class="row">
          <label>Parts cost low<input id="plo" type="number" min="0" value="${r.partsCost[0]}"></label>
          <label>Parts cost high<input id="phi" type="number" min="0" value="${r.partsCost[1]}"></label>
        </div>
        <label>Steps<textarea id="steps" rows="8">${esc(r.steps.map(s => s.text).join('\n'))}</textarea></label>
        <label>Parts<textarea id="parts" rows="3">${esc(lines(r.parts))}</textarea></label>
        <label>Tools<textarea id="tools" rows="3">${esc(lines(r.tools))}</textarea></label>
        <label>Specs (format: Label: value)<textarea id="specs" rows="3">${esc(r.specs.map(s => `${s.label}: ${s.value}`).join('\n'))}</textarea></label>
        <label>Warnings<textarea id="warnings" rows="2">${esc(lines(r.warnings))}</textarea></label>
        <label>YouTube search words<input id="yt" value="${esc(r.youtube || '')}" placeholder="e.g. valve cover gasket"></label>
        <button class="btn primary">Save</button>
      </form>`;
    const val = id => document.getElementById(id).value;
    const split = id => val(id).split('\n').map(s => s.trim()).filter(Boolean);
    document.getElementById('ef').onsubmit = e => {
      e.preventDefault();
      const out = Object.assign(existing || { id: Store.uid('c'), vid, appliesTo: { custom: true } }, {
        title: val('title').trim(), category: val('category').trim() || 'General',
        laborHours: +val('hours') || 0, difficulty: Math.min(5, Math.max(1, +val('diff') || 1)),
        partsCost: [+val('plo') || 0, +val('phi') || 0],
        steps: split('steps').map(text => ({ text })), parts: split('parts'), tools: split('tools'),
        specs: split('specs').map(l => { const i = l.indexOf(':'); return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: 'Note', value: l }; }),
        warnings: split('warnings'), youtube: val('yt').trim()
      });
      if (!existing) S().custom.push(out);
      Store.save(); go(`#/v/${vid}/r/${out.id}`);
    };
  }

  function viewLog(vid, params) {
    const v = findVehicle(vid); if (!v) return go('#/');
    setChrome('Job log', '#/v/' + vid);
    const all = repairsFor(v);
    const pre = params.get('rid');
    const rows = S().log.filter(l => l.vid === vid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = rows.reduce((s, l) => s + (+l.cost || 0), 0);
    const saved = rows.reduce((s, l) => { const r = all.find(x => x.id === l.rid); return s + (r ? Math.max(0, estimate(r).shopLo - (+l.cost || 0)) : 0); }, 0);
    $app.innerHTML = `
      <h1>Job log</h1>
      <p class="muted">${esc(vehicleName(v))} · spent ${money(total)} · saved ≈ ${money(saved)} vs. shop</p>
      <form id="lf" class="card form">
        <div class="row">
          <label>Repair<select id="lr">${all.map(r => `<option value="${esc(r.id)}" ${r.id === pre ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label>
          <label>Date<input id="ld" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
        </div>
        <div class="row">
          <label>Mileage<input id="lm" inputmode="numeric" value="${esc(v.mileage || '')}"></label>
          <label>What you spent<input id="lc" type="number" min="0" step="0.01"></label>
        </div>
        <label>Notes<input id="ln" placeholder="Brands, part numbers, anything to remember"></label>
        <button class="btn primary">Add entry</button>
      </form>
      <div class="list">
        ${rows.map(l => `<div class="card logrow">
          <div><b>${esc(l.title)}</b><div class="small muted">${esc(l.date)} · ${l.miles ? esc(l.miles) + ' mi' : 'no mileage'}${l.notes ? ' · ' + esc(l.notes) : ''}</div></div>
          <div class="r-cost">${l.cost ? money(+l.cost) : ''}<button class="link danger" data-rm="${l.id}">remove</button></div>
        </div>`).join('') || '<p class="muted">No jobs logged yet.</p>'}
      </div>`;
    const val = id => document.getElementById(id).value;
    document.getElementById('lf').onsubmit = e => {
      e.preventDefault();
      const r = all.find(x => x.id === val('lr'));
      S().log.push({ id: Store.uid('l'), vid, rid: r.id, title: r.title, date: val('ld'), miles: val('lm'), cost: val('lc'), notes: val('ln') });
      if (val('lm') && (+val('lm') > (+v.mileage || 0))) v.mileage = val('lm');
      Store.save(); viewLog(vid, new URLSearchParams());
    };
    $app.querySelector('.list').onclick = e => {
      const id = e.target.dataset.rm; if (!id || !confirm('Remove entry?')) return;
      S().log = S().log.filter(l => l.id !== id); Store.save(); viewLog(vid, new URLSearchParams());
    };
  }

  async function viewRecalls(vid) {
    const v = findVehicle(vid); if (!v) return go('#/');
    setChrome('Recalls', '#/v/' + vid);
    const nhtsa = `https://www.nhtsa.gov/vehicle/${v.year}/${encodeURIComponent(v.make)}/${encodeURIComponent(v.model)}`;
    $app.innerHTML = `<h1>Recalls</h1><p class="muted">${esc(vehicleName(v))} · source: NHTSA</p><div id="rc" class="list"><p class="muted">Loading…</p></div>
      <p><a class="btn" target="_blank" rel="noopener" href="${nhtsa}">Open on NHTSA.gov ↗</a></p>`;
    try {
      const list = await VPIC.recalls(v.make, v.model, v.year);
      document.getElementById('rc').innerHTML = list.map(x => `
        <div class="card"><b>${esc(x.Component)}</b> <span class="tag">${esc(x.NHTSACampaignNumber)}</span>
          <div class="small muted">${esc(x.ReportReceivedDate || '')}</div>
          <p>${esc(x.Summary)}</p>
          ${x.Remedy ? `<p class="small"><b>Remedy:</b> ${esc(x.Remedy)}</p>` : ''}
        </div>`).join('') || '<p>No recalls found for this vehicle.</p>';
    } catch {
      document.getElementById('rc').innerHTML = '<p class="muted">Could not load recalls (offline?). Use the NHTSA link below.</p>';
    }
  }

  function viewSettings() {
    setChrome('Settings', '#/');
    const st = S().settings;
    $app.innerHTML = `
      <h1>Settings</h1>
      <form id="sf" class="card form">
        <label>Shop labor rate (per hour)<input id="rate" type="number" min="0" value="${st.laborRate}"></label>
        <label>Shop parts markup (%)<input id="markup" type="number" min="0" value="${st.partsMarkup}"></label>
        <label>Currency<input id="cur" maxlength="3" value="${esc(st.currency)}"></label>
        <button class="btn primary">Save</button>
      </form>
      <section class="card">
        <h3>Backup</h3>
        <p class="small muted">Exports your garage, notes, videos, custom repairs, job log and diagram files to a single file.</p>
        <div class="actions">
          <button class="btn" id="exp">Export backup</button>
          <label class="btn">Import backup<input type="file" id="imp" accept="application/json" hidden></label>
        </div>
      </section>
      <section class="card">
        <h3>About the data</h3>
        <p class="small">Labor hours are approximate estimates, not licensed labor-guide numbers — use them to sanity-check a quote. Specs marked <span class="tag verify">verify</span> must be confirmed in the factory service manual. Year/make/model lists and recalls come from NHTSA's free public API.</p>
      </section>`;
    document.getElementById('sf').onsubmit = e => {
      e.preventDefault();
      st.laborRate = +document.getElementById('rate').value || 0;
      st.partsMarkup = +document.getElementById('markup').value || 0;
      st.currency = (document.getElementById('cur').value || 'USD').toUpperCase();
      Store.save(); alert('Saved');
    };
    document.getElementById('exp').onclick = async () => {
      let files = [];
      try {
        files = await Promise.all((await Store.files.all()).map(async f => ({ ...f, blob: await blobToDataUrl(f.blob) })));
      } catch {}
      const blob = new Blob([JSON.stringify({ app: 'navaauto', state: S(), files })], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `navaauto-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    };
    document.getElementById('imp').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'navaauto') throw new Error('not a NavaAuto backup');
        if (!confirm('Replace current data with this backup?')) return;
        Store.replace(data.state);
        for (const f of data.files || []) await Store.files.put({ ...f, blob: await (await fetch(f.blob)).blob() });
        alert('Backup restored'); go('#/');
      } catch (err) { alert('Import failed: ' + err.message); }
    };
  }

  const blobToDataUrl = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

  // ---------- router ----------
  function route() {
    const [path, qs] = location.hash.replace(/^#/, '').split('?');
    const params = new URLSearchParams(qs || '');
    const p = path.split('/').filter(Boolean).map(decodeURIComponent);
    if (!p.length) return viewGarage();
    if (p[0] === 'add') return viewAdd();
    if (p[0] === 'settings') return viewSettings();
    if (p[0] === 'v' && p[1]) {
      if (!p[2]) return viewVehicle(p[1]);
      if (p[2] === 'new') return viewEdit(p[1]);
      if (p[2] === 'log') return viewLog(p[1], params);
      if (p[2] === 'recalls') return viewRecalls(p[1]);
      if (p[2] === 'r' && p[3]) return p[4] === 'edit' ? viewEdit(p[1], p[3]) : viewRepair(p[1], p[3]);
    }
    go('#/');
  }

  async function init() {
    try {
      LIBRARY = (await (await fetch('data/repairs.json')).json()).repairs;
    } catch (e) {
      $app.innerHTML = '<p>Could not load the repair library.</p>';
      console.error(e);
    }
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
