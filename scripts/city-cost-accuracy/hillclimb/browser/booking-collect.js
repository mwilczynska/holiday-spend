// Booking.com accommodation collector, run inside a logged-in booking.com tab (in-app browser javascript tool).
// Frozen definition (do not change): 2 adults, 1 room, USD, first server-rendered results page (up to 25 cards),
// per-night price = (displayed price + separate taxes) / nights. Property types: hotels (204), guest houses (216),
// B&Bs (208).
//   Main run (one stay window, three queries per city): window.__bkCollect(CITIES, 'main')
//   Window run (3-star only, six stay windows, dev cities): window.__bkCollect(CITIES, 'windows')
// CITIES = [[city, country, cityKey], ...] from research/city-cost-accuracy/hillclimb/panel/booking-todo-*.json.
// Results accumulate in window.__bkOut; export with JSON.stringify(window.__bkOut) + ' '.repeat(200000) and save via
// scripts/city-cost-accuracy/hillclimb/extract-browser-json.mjs. Progress: ({ n: window.__bkOut.length, done: window.__bkDone }).
(() => {
  // Worker-based timer: background tabs throttle setTimeout to about once a minute.
  const w = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>setTimeout(()=>postMessage(e.data.id),e.data.ms)'], { type: 'text/javascript' })));
  const pending = new Map(); let n = 0;
  w.onmessage = e => { const f = pending.get(e.data); pending.delete(e.data); f && f(); };
  const sleep = ms => new Promise(r => { const id = ++n; pending.set(id, r); w.postMessage({ id, ms }); });
  const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i); return +(s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)).toFixed(2); };
  const num = s => s ? Number(s.replace(/[^0-9.]/g, '')) : null;
  async function page(ss, nflt, checkin, checkout) {
    const u = `/searchresults.html?ss=${encodeURIComponent(ss)}&checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1&group_children=0&selected_currency=USD&nflt=${encodeURIComponent(nflt)}`;
    const r = await fetch(u, { credentials: 'include' }); const html = await r.text();
    const d = new DOMParser().parseFromString(html, 'text/html');
    const cards = [...d.querySelectorAll('[data-testid="property-card"]')].map(c => ({
      price: num(c.querySelector('[data-testid="price-and-discounted-price"]')?.textContent),
      tax: num((c.querySelector('[data-testid="taxes-and-charges"]')?.textContent || '').replace(/^\+/, '')),
      taxIncluded: /includes taxes/i.test(c.textContent), unit: c.querySelector('[data-testid="price-for-x-nights"]')?.textContent,
      cur: /US\$/.test(c.querySelector('[data-testid="price-and-discounted-price"]')?.textContent || '') ? 'USD' : 'other' }));
    return { status: r.status, h1: (d.querySelector('h1')?.textContent || '').trim().slice(0, 120),
      found: Number(((d.body?.textContent.match(/([\d,]+) properties found/) || [])[1] || '0').replace(/,/g, '')), cards };
  }
  function stats(p, nights) {
    const ok = p.cards.filter(c => c.cur === 'USD' && c.price > 0 && c.unit && c.unit.includes(`${nights} nights`) && c.unit.includes('2 adults'));
    const night = ok.map(c => (c.price + (c.taxIncluded ? 0 : (c.tax || 0))) / nights);
    return { status: p.status, h1: p.h1, found: p.found, cards: p.cards.length, kept: ok.length, p10: q(night, .1), p25: q(night, .25),
      median: q(night, .5), p75: q(night, .75), taxShareMedian: q(ok.map(c => c.taxIncluded ? 0 : (c.tax || 0) / c.price), .5) };
  }
  const MAIN = [['3star', 'class=3;ht_id=204;ht_id=216;ht_id=208'], ['1-2star', 'class=1;class=2;ht_id=204;ht_id=216;ht_id=208'], ['decent', 'review_score=70;ht_id=204;ht_id=216;ht_id=208']];
  const WINDOWS = [['2026-11-17', '2026-11-19'], ['2026-11-20', '2026-11-22'], ['2027-02-16', '2027-02-18'], ['2027-04-09', '2027-04-11'], ['2027-07-13', '2027-07-15'], ['2027-07-16', '2027-07-18']];
  window.__bkCollect = async function (cities, mode) {
    window.__bkOut = window.__bkOut || []; window.__bkDone = false;
    const done = new Set(window.__bkOut.map(x => x.key));
    for (const [city, country, key] of cities) {
      if (done.has(key)) continue;
      const ss = `${city}, ${country}`;
      const out = { key, city, country, ss, mode, capturedAt: new Date().toISOString() };
      if (mode === 'main') {
        out.checkin = '2027-03-09'; out.checkout = '2027-03-11'; out.classes = {};
        for (const [label, nflt] of MAIN) {
          try { out.classes[label] = stats(await page(ss, nflt, '2027-03-09', '2027-03-11'), 2); } catch (e) { out.classes[label] = { error: String(e) }; }
          await sleep(3000);
        }
      } else {
        out.windows = [];
        for (const [ci, co] of WINDOWS) {
          try { out.windows.push({ checkin: ci, checkout: co, ...stats(await page(ss, MAIN[0][1], ci, co), 2) }); } catch (e) { out.windows.push({ checkin: ci, error: String(e) }); }
          await sleep(3000);
        }
      }
      window.__bkOut.push(out);
    }
    window.__bkDone = true;
  };
  return 'booking collector loaded';
})();
