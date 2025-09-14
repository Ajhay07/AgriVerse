/* ========= Safe helpers ========= */
function on(el, type, fn, opts) { if (el && el.addEventListener) el.addEventListener(type, fn, opts || false); } // MDN pattern [1]
function $(id) { return document.getElementById(id); }

/* ========= Yield & Recommendation Popup ========= */
document.addEventListener("DOMContentLoaded", () => {
  // Panel + common elements
  const scfCard = $("scf-card");
  const scfPanel = $("scf-panel");
  const closeScf = $("closeScf");

  // Yield form
  const yieldForm = $("yield-form");
  const predictBtn = $("predictBtn");
  const predictMsg = $("predictMsg");
  const stateInput = $("stateInput");
  const seasonInput = $("seasonInput");
  const cropInput = $("cropInput");
  const areaInput = $("areaInput");
  const areaUnit = $("areaUnit");

  // Recommendation form
  const modeReco = $("mode-reco");
  const modeYield = $("mode-yield");
  const recoForm = $("reco-form");
  const recoState = $("reco-state");
  const recoSeason = $("reco-season");
  const recoCrop = $("reco-crop");
  const recoBtn = $("reco-btn");
  const recoMsg = $("reco-msg");

  // States list
  const INDIAN_STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
    "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
    "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
    "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"
  ];

  function populateSelect(sel, arr, placeholder) {
    if (!sel) return;
    sel.innerHTML = "";
    const o = document.createElement("option");
    o.value = ""; o.textContent = placeholder; o.disabled = true; o.selected = true;
    sel.appendChild(o);
    arr.forEach(v => { const x = document.createElement("option"); x.value = v; x.textContent = v; sel.appendChild(x); });
  }
  populateSelect(stateInput, INDIAN_STATES, "Select State");
  populateSelect(recoState, INDIAN_STATES, "Select State");

  /* Show/Hide modes */
  function styleActive(btn) { if (!btn) return; btn.style.background = "#146ee1"; btn.style.color = "#fff"; btn.style.border = "none"; }
  function styleInactiveBlue(btn) { if (!btn) return; btn.style.background = "#eef6ff"; btn.style.color = "#146ee1"; btn.style.border = "1px solid #146ee1"; }
  function styleActiveGreen(btn) { if (!btn) return; btn.style.background = "#12b76a"; btn.style.color = "#fff"; btn.style.border = "none"; }

  function showReco() {
    if (recoForm) recoForm.style.display = "block";
    if (yieldForm) yieldForm.style.display = "none";
    styleInactiveBlue(modeYield); styleActive(modeReco);
    if (recoMsg) { recoMsg.textContent = ""; recoMsg.style.borderColor = "#146ee1"; recoMsg.style.background = "#eef6ff"; recoMsg.style.color = "#0b4aa2"; }
  }
  function showYield() {
    if (recoForm) recoForm.style.display = "none";
    if (yieldForm) yieldForm.style.display = "block";
    styleInactiveBlue(modeReco); styleActiveGreen(modeYield);
    if (predictMsg) { predictMsg.textContent = ""; predictMsg.style.borderColor = "#12b76a"; predictMsg.style.background = "#ecfdf3"; predictMsg.style.color = "#0a6f47"; }
  }

  function openScf() { if (scfPanel) { scfPanel.style.display = "block"; showYield(); } } // default Yield
  function closeScfPanel() { if (scfPanel) scfPanel.style.display = "none"; }

  on(scfCard, "click", openScf);                                      // safe bind [1]
  on(closeScf, "click", closeScfPanel);
  on(scfPanel, "click", (e) => { if (e.target === scfPanel) closeScfPanel(); });
  on(modeReco, "click", showReco);
  on(modeYield, "click", showYield);

  /* Yield & Revenue predict */
  on(predictBtn, "click", async () => {
    const state = stateInput?.value || "";
    const season = seasonInput?.value || "";
    const crop = (cropInput?.value || "").trim();
    const areaVal = parseFloat(areaInput?.value || "0");
    const unit = areaUnit?.value || "hectare";

    if (!predictMsg) return;
    if (!state || !season || !crop) {
      predictMsg.textContent = "Please select State and Season, and enter Crop.";
      predictMsg.style.color = "crimson"; predictMsg.style.borderColor = "#ffb4b4"; predictMsg.style.background = "#fff5f5";
      return;
    }
    if (!Number.isFinite(areaVal) || areaVal <= 0) {
      predictMsg.textContent = "Please enter a valid Area (> 0).";
      predictMsg.style.color = "crimson"; predictMsg.style.borderColor = "#ffb4b4"; predictMsg.style.background = "#fff5f5";
      return;
    }

    const areaHa = unit === "acre" ? areaVal * 0.4046856422 : areaVal;

    predictMsg.textContent = "Predicting...";
    predictMsg.style.color = "#344054"; predictMsg.style.borderColor = "#d0d5dd"; predictMsg.style.background = "#f8fafc";

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, season, crop })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const yPerHa = data.predicted_yield_kg_per_ha;
      const revPerHa = data.predicted_revenue_rs_per_ha;
      const totalRev = (revPerHa * areaHa).toFixed(2);

      predictMsg.innerHTML =
        `<strong>Predicted Yield:</strong> ${yPerHa} Kg/Ha<br>` +
        `<strong>Predicted Revenue:</strong> Rs. ${revPerHa} per Ha<br>` +
        `<strong>Total Revenue (${areaHa.toFixed(2)} ha):</strong> Rs. ${totalRev}`;
      predictMsg.style.color = "#0a6f47"; predictMsg.style.borderColor = "#12b76a"; predictMsg.style.background = "#ecfdf3";
    } catch (err) {
      predictMsg.textContent = `Error: ${err.message}`;
      predictMsg.style.color = "crimson"; predictMsg.style.borderColor = "#ffb4b4"; predictMsg.style.background = "#fff5f5";
    }
  });

  /* Crop Recommendation */
  on(recoBtn, "click", async () => {
    const state = recoState?.value || "";
    const current_season = recoSeason?.value || "";
    const current_crop = (recoCrop?.value || "").trim();

    if (!recoMsg) return;
    if (!state || !current_season || !current_crop) {
      recoMsg.textContent = "Please select State & Season and enter Current Crop.";
      recoMsg.style.color = "crimson"; recoMsg.style.borderColor = "#ffb4b4"; recoMsg.style.background = "#fff5f5";
      return;
    }

    recoMsg.textContent = "Evaluating...";
    recoMsg.style.color = "#334155"; recoMsg.style.borderColor = "#d0d5dd"; recoMsg.style.background = "#f8fafc";

    try {
      // Phase 1: may return direct recommendation or next_season + weather
      let res = await fetch("http://127.0.0.1:8000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, current_season, current_crop })
      });
      let data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      if (data?.recommended_crop) {
        recoMsg.innerHTML =
          `<strong>Next Season:</strong> ${data.next_season}<br>` +
          `<strong>Recommended Crop:</strong> ${data.recommended_crop}<br>` +
          `<strong>Predicted Yield:</strong> ${data.predicted_yield_kg_per_ha} Kg/Ha`;
        recoMsg.style.color = "#0b4aa2"; recoMsg.style.borderColor = "#146ee1"; recoMsg.style.background = "#eef6ff";
        return;
      }

      const nextSeason = data?.next_season || "Next Season";
      const entered = window.prompt(`Enter candidate crops for ${nextSeason} (comma-separated), e.g., Wheat, Mustard`);
      if (!entered) {
        recoMsg.textContent = "No candidates provided.";
        recoMsg.style.color = "crimson"; recoMsg.style.borderColor = "#ffb4b4"; recoMsg.style.background = "#fff5f5";
        return;
      }
      const candidates = entered.split(",").map(s => s.trim()).filter(Boolean);

      res = await fetch("http://127.0.0.1:8000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, current_season, current_crop, candidates })
      });
      data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      if (data?.recommended_crop) {
        recoMsg.innerHTML =
          `<strong>Next Season:</strong> ${data.next_season}<br>` +
          `<strong>Recommended Crop:</strong> ${data.recommended_crop}<br>` +
          `<strong>Predicted Yield:</strong> ${data.predicted_yield_kg_per_ha} Kg/Ha`;
        recoMsg.style.color = "#0b4aa2"; recoMsg.style.borderColor = "#146ee1"; recoMsg.style.background = "#eef6ff";
      } else {
        throw new Error("No recommendation returned");
      }
    } catch (err) {
      recoMsg.textContent = `Error: ${err.message}`;
      recoMsg.style.color = "crimson"; recoMsg.style.borderColor = "#ffb4b4"; recoMsg.style.background = "#fff5f5";
    }
  });
});

/* ========= Weather Dashboard (Open‑Meteo) ========= */
(() => {
  const OM_BASE = "https://api.open-meteo.com/v1/forecast";
  const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

  const card = $("weather-card");
  const panel = $("weather-panel");
  const closeBtn = $("closeWeather");
  const qInput = $("weather-query");
  const btnSearch = $("weather-search");
  const btnLocate = $("weather-locate");
  const msg = $("weather-msg");

  const el = (id) => $(id);

  function openPanel() {
    if (!panel) return;
    panel.style.display = "block";
    if (msg) msg.textContent = "";
    if (qInput && !qInput.value.trim()) qInput.value = "Chennai, IN";
  }
  function closePanel() { if (panel) panel.style.display = "none"; }

  on(card, "click", openPanel);
  on(closeBtn, "click", closePanel);
  on(panel, "click", (e) => { if (e.target === panel) closePanel(); });

  function buildForecastUrl(lat, lon, timezone) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid coordinates");
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: timezone || "auto",
      hourly: "temperature_2m,relative_humidity_2m,precipitation,soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm",
      daily: "temperature_2m_max",
      forecast_days: "7"
    });
    return `${OM_BASE}?${params.toString()}`;
  } // Open‑Meteo docs for parameters. [3]

  // Geocoding with variants and optional country filter
  function buildGeocodeUrl(q, cc) {
    const p = new URLSearchParams({ name: q, count: "10", language: "en", format: "json" });
    if (cc && /^[A-Za-z]{2}$/.test(cc)) p.set("countryCode", cc.toUpperCase());
    const url = `${GEOCODE}?${p.toString()}`;
    console.log("Geocode URL:", url); // debug
    return url;
  } // Geocoding API supports name, count, countryCode. [4]

  async function geocodeCandidates(rawInput) {
    const raw = (rawInput || "").trim();
    if (!raw) throw new Error("Enter a place name");

    const normalized = raw.replace(/\s*,\s*/g, ", ").replace(/\s{2,}/g, " ").trim();
    const parts = normalized.split(",").map(s => s.trim()).filter(Boolean);
    const place = parts || "";
    const region = parts[5] || "";
    let cc = ""; if (/^[A-Za-z]{2}$/.test(region)) cc = region.toUpperCase();

    const variants = [];
    if (cc) variants.push({ q: place, cc });
    variants.push({ q: normalized, cc: "" });
    variants.push({ q: place, cc: "" });
    if (/^delhi$/i.test(place)) variants.push({ q: "New Delhi", cc });
    if (/^mumbai$/i.test(place)) variants.push({ q: "Bombay", cc });
    if (/^chennai$/i.test(place)) variants.push({ q: "Madras", cc });
    if (/village|taluk|tehsil|district/i.test(place)) {
      variants.push({ q: place.replace(/\b(village|taluk|tehsil|district)\b/ig, "").trim(), cc });
    }
    if (parts.length >= 3) variants.push({ q: `${place}, ${parts}`, cc: "" });

    const seen = new Set();
    const queue = variants
      .map(v => ({ q: String(v.q || "").trim(), cc: String(v.cc || "").trim() }))
      .filter(v => v.q.length > 0)
      .filter(v => { const k = `${v.q.toLowerCase()}|${v.cc.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });

    let candidates = null;
    for (const v of queue) {
      const url = buildGeocodeUrl(v.q, v.cc);
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.results?.length) {
        candidates = data.results.map(r => ({
          lat: Number(r.latitude),
          lon: Number(r.longitude),
          pop: Number(r.population) || 0,
          label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", ")
        })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
        if (candidates.length) break;
      }
    }

    if (!candidates || !candidates.length) {
      if (!cc && /^[A-Za-z\s]+$/.test(place)) {
        const retryUrl = buildGeocodeUrl(place, "IN");
        const res = await fetch(retryUrl);
        if (res.ok) {
          const data = await res.json();
          if (data?.results?.length) {
            candidates = data.results.map(r => ({
              lat: Number(r.latitude),
              lon: Number(r.longitude),
              pop: Number(r.population) || 0,
              label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", ")
            })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
          }
        }
      }
    }

    if (!candidates || !candidates.length) throw new Error("Location not found");
    return candidates;
  } // Open‑Meteo geocoding is global. [4]

  async function fetchForecast(lat, lon) {
    const url = buildForecastUrl(lat, lon, "auto");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather failed: ${res.status}`);
    return res.json();
  }

  function renderCurrent(data, label) {
    const h = data.hourly;
    const idx = h.time.length - 1;
    const ts = new Date(h.time[idx]);
    const fmt = ts.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

    el("weather-place").textContent = label;
    el("weather-now-temp").textContent = `Temp: ${Math.round(h.temperature_2m[idx])}°C`;
    el("weather-now-hum").textContent = `Humidity: ${h.relative_humidity_2m[idx]}%`;
    el("weather-now-rain").textContent = `Precipitation: ${h.precipitation[idx]} mm`;
    el("weather-now-soil0").textContent = `Soil Temp 0 cm: ${h.soil_temperature_0cm?.[idx] ?? "—"}°C`;
    el("weather-now-soil6").textContent = `Soil Temp 6 cm: ${h.soil_temperature_6cm?.[idx] ?? "—"}°C`;
    el("weather-now-sm0").textContent = `Soil Moist 0–1 cm: ${h.soil_moisture_0_to_1cm?.[idx] ?? "—"} m³/m³`;
    el("weather-now-sm1").textContent = `Soil Moist 1–3 cm: ${h.soil_moisture_1_to_3cm?.[idx] ?? "—"} m³/m³`;
    el("weather-temp-big").textContent = `${Math.round(h.temperature_2m[idx])}°C`;
    el("weather-time").textContent = fmt;
  }

  function renderDaily(data) {
    const wrap = el("weather-daily"); if (!wrap) return;
    wrap.innerHTML = "";
    const t = data.daily;
    for (let i = 0; i < Math.min(7, t.time.length); i++) {
      const d = new Date(t.time[i]);
      const div = document.createElement("div");
      div.style.cssText = "border:1px solid #e5e7eb; border-radius:10px; padding:10px; background:#f8fafc; text-align:center;";
      div.innerHTML = `
        <div style="font-weight:700; color:#0f172a; margin-bottom:4px;">${d.toLocaleDateString(undefined,{weekday:"short"})}</div>
        <div style="color:#0f766e; font-size:18px; font-weight:700;">${Math.round(t.temperature_2m_max[i])}°C</div>
        <div style="color:#475467; font-size:12px;">Max</div>
      `;
      wrap.appendChild(div);
    }
  }

  function renderHourly(data) {
    const wrap = el("weather-hourly"); if (!wrap) return;
    wrap.innerHTML = "";
    const h = data.hourly;
    const nowIdx = h.time.length - 1;
    const start = Math.max(0, nowIdx - 1);
    const end = Math.min(h.time.length, start + 24);
    for (let i = start; i < end; i += 3) {
      const d = new Date(h.time[i]);
      const div = document.createElement("div");
      div.style.cssText = "border:1px solid #e5e7eb; border-radius:10px; padding:10px; background:#ffffff; text-align:center;";
      div.innerHTML = `
        <div style="font-weight:700; color:#0f172a; margin-bottom:4px;">${d.toLocaleTimeString(undefined,{hour:"2-digit"})}</div>
        <div style="color:#0f766e; font-size:18px; font-weight:700;">${Math.round(h.temperature_2m[i])}°C</div>
        <div style="color:#334155; font-size:12px;">RH ${h.relative_humidity_2m[i]}%</div>
        <div style="color:#475467; font-size:12px;">Rain ${h.precipitation[i]} mm</div>
      `;
      wrap.appendChild(div);
    }
  }

  // Simple chooser UI for ambiguous places
  let chooserWrap = null;
  function ensureChooser() {
    if (chooserWrap) return chooserWrap;
    chooserWrap = document.createElement("div");
    chooserWrap.id = "weather-choices";
    chooserWrap.style.cssText = "margin:8px 0; display:none; gap:8px; flex-wrap:wrap;";
    const anchor = panel?.querySelector("#weather-current")?.parentElement || panel;
    anchor?.insertBefore(chooserWrap, anchor.firstChild?.nextSibling || null);
    return chooserWrap;
  }

  async function chooseAndForecast(rawInput) {
    const chooser = ensureChooser();
    chooser.style.display = "none";
    chooser.innerHTML = "";

    try {
      const candidates = await geocodeCandidates(rawInput);
      candidates.sort((a, b) => b.pop - a.pop);
      const top = candidates.slice(0, 5);

      if (top.length === 1) {
        const c = top;
        const data = await fetchForecast(c.lat, c.lon);
        renderCurrent(data, c.label); renderDaily(data); renderHourly(data);
        if (msg) msg.textContent = "";
        return;
      }

      chooser.style.display = "flex";
      top.forEach(c => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = `${c.label}${c.pop ? ` (pop ${c.pop.toLocaleString()})` : ""}`;
        chip.style.cssText = "padding:6px 10px; border:1px solid #d0d5dd; background:#fff; border-radius:999px; cursor:pointer; font-size:12px;";
        chip.addEventListener("click", async () => {
          try {
            if (msg) { msg.style.color = "#334155"; msg.textContent = "Loading..."; }
            const data = await fetchForecast(c.lat, c.lon);
            renderCurrent(data, c.label); renderDaily(data); renderHourly(data);
            if (msg) msg.textContent = "";
            chooser.style.display = "none";
          } catch (e) { if (msg) { msg.style.color = "#dc2626"; msg.textContent = e.message; } }
        });
        chooser.appendChild(chip);
      });

      if (msg) { msg.style.color = "#334155"; msg.textContent = "Multiple matches found. Please pick one."; }
    } catch (e) {
      if (msg) { msg.style.color = "#dc2626"; msg.textContent = e.message; }
    }
  }

  on(btnSearch, "click", () => {
    if (!qInput) return;
    if (msg) { msg.style.color = "#334155"; msg.textContent = "Searching..."; }
    chooseAndForecast(qInput.value.trim());
  });

  on(btnLocate, "click", () => {
    if (!navigator.geolocation) { if (msg) { msg.style.color = "#dc2626"; msg.textContent = "Geolocation not available"; } return; }
    if (msg) { msg.style.color = "#334155"; msg.textContent = "Locating..."; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = Number(pos.coords.latitude), lon = Number(pos.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid geolocation coordinates");
        const data = await fetchForecast(lat, lon);
        const label = `My Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
        renderCurrent(data, label); renderDaily(data); renderHourly(data);
        if (msg) msg.textContent = "";
        const chooser = ensureChooser(); chooser.style.display = "none";
      } catch (e) { if (msg) { msg.style.color = "#dc2626"; msg.textContent = e.message; } }
    }, (err) => { if (msg) { msg.style.color = "#dc2626"; msg.textContent = err.message; } }, { enableHighAccuracy: true, timeout: 10000 });
  });

  // Preload Berlin on first open so panel isn't empty
  on(card, "click", async () => {
    const placeEl = $("weather-place");
    if (!placeEl || placeEl.textContent !== "—") return;
    try {
      const data = await fetchForecast(52.52, 13.41);
      renderCurrent(data, "Berlin, DE"); renderDaily(data); renderHourly(data);
    } catch {}
  });
})();
