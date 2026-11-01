// Pala on the web: the same three pages as the iPhone app, from the same
// plan.json. Ticks and the theme are kept in this browser's localStorage.

const THEMES = [
  { id: "lavender", name: "薰衣草", dark: false, bg: "#FAF9FD", card: "#FFFFFF", line: "#ECE9F3", ink: "#2B2840", inkSoft: "#8D89A0", accent: "#8C7BE6", breakfast: "#F4B7C6", lunch: "#AE9FF0", snack: "#F6CC8F", dinner: "#92ACF2" },
  { id: "mint", name: "薄荷", dark: false, bg: "#F8FBFA", card: "#FFFFFF", line: "#E5EEEA", ink: "#1F2F29", inkSoft: "#84948D", accent: "#3FB58F", breakfast: "#F5D07A", lunch: "#7ACDB0", snack: "#8CC6EC", dinner: "#F2A291" },
  { id: "peach", name: "蜜桃", dark: false, bg: "#FFFAF7", card: "#FFFFFF", line: "#F2E8E2", ink: "#3A2826", inkSoft: "#A08C88", accent: "#EE8572", breakfast: "#F8C97A", lunch: "#F2A08F", snack: "#8CCFC2", dinner: "#C59BC4" },
  { id: "sea", name: "海盐", dark: false, bg: "#F8FAFE", card: "#FFFFFF", line: "#E6ECF6", ink: "#1E2A42", inkSoft: "#8390A8", accent: "#5D8DEB", breakfast: "#F7CF7E", lunch: "#8FB2F2", snack: "#86D3C9", dinner: "#F2A194" },
  { id: "night", name: "星夜", dark: true, bg: "#16171E", card: "#20222C", line: "#2F3240", ink: "#EEEFF5", inkSoft: "#9497A8", accent: "#A79BF5", breakfast: "#E3BE7E", lunch: "#9C90E8", snack: "#7FCDBE", dinner: "#E69AAF" },
];

const ICON = {
  restaurant: 0xE56C, bag: 0xF1CC, monitoring: 0xF190, palette: 0xE40A, check: 0xE668,
  openInNew: 0xE89E, restart: 0xF053, arrow: 0xE5C8, breakfast: 0xEA54, lunch: 0xEA61,
  snack: 0xE110, dinner: 0xF1F5, grocery: 0xEF97, skillet: 0xF543, cooking: 0xE2B6,
};
const TABS = [
  { title: "今天", icon: "restaurant" },
  { title: "购物", icon: "bag" },
  { title: "营养", icon: "monitoring" },
];
const SECTION_MEAL = { "早餐": "breakfast", "午饭": "lunch", "晚饭": "dinner" };

// MARK: - Storage (wrapped: private windows can refuse it)

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("pala." + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("pala." + key, JSON.stringify(value)); } catch {}
  },
};

// Mon–Thu open on that day; Fri–Sun open on Monday.
const weekday = (new Date().getDay() + 6) % 7;
const state = {
  plan: null,
  tab: store.get("tab", 0),
  day: weekday < 4 ? weekday : 0,
  eaten: new Set(store.get("eaten", [])),
  bought: new Set(store.get("bought", [])),
  theme: THEMES.find(t => t.id === store.get("theme", "lavender")) || THEMES[0],
  themesOpen: false,
  appeared: false,
};

// MARK: - Colour

function hex(c) { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const x = hex(a), y = hex(b);
  return "#" + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, "0")).join("");
}

/** The M3 colour roles, derived from a theme exactly as the iPhone app does. */
function roles(t) {
  const soft = c => mix(c, t.card, t.dark ? 0.78 : 0.8);
  const primary = t.dark ? t.accent : mix(t.accent, t.ink, 0.18);
  return {
    surface: t.bg, card: t.card, line: t.line, ink: t.ink, inkSoft: t.inkSoft,
    outline: t.inkSoft + "b3",
    primary,
    onPrimary: t.dark ? t.bg : t.card,
    pc: mix(t.accent, t.card, t.dark ? 0.7 : 0.82),
    onPc: mix(t.accent, t.ink, t.dark ? 0.5 : 0.62),
    sc: mix(t.accent, t.card, t.dark ? 0.6 : 0.74),
    sCont: mix(t.accent, t.bg, 0.93),
    sHigh: mix(t.accent, t.bg, 0.86),
    meal: id => t[id] || t.snack,
    mealSoft: id => soft(t[id] || t.snack),
    mealInk: id => mix(t[id] || t.snack, t.ink, 0.45),
    soft,
  };
}

function applyTheme() {
  const r = roles(state.theme);
  const s = document.documentElement.style;
  const vars = { surface: r.surface, card: r.card, line: r.line, ink: r.ink, "ink-soft": r.inkSoft, outline: r.outline,
    primary: r.primary, "on-primary": r.onPrimary, pc: r.pc, "on-pc": r.onPc, sc: r.sc, "s-cont": r.sCont, "s-high": r.sHigh };
  for (const [k, v] of Object.entries(vars)) s.setProperty("--" + k, v);
  s.colorScheme = state.theme.dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = r.surface;
}

// MARK: - Helpers

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icon = (name, size = 24, fill = false) =>
  `<span class="icon${fill ? " fill" : ""}" style="font-size:${size}px;width:${size}px;height:${size}px" aria-hidden="true">${String.fromCodePoint(ICON[name])}</span>`;
const euro = v => v.toFixed(2).replace(".", ",") + " €";
const byTime = meals => [...meals].sort((a, b) => hour(a) - hour(b));
const hour = m => { const [h, mm = 0] = m.time.split(":").map(Number); return h + mm / 60; };
const isEaten = (m, d) => state.eaten.has(`${d}-${m.id}`);
const eatenKcal = d => state.plan.days[d].meals.filter(m => isEaten(m, d)).reduce((s, m) => s + m.kcal, 0);
const allItems = () => state.plan.shopping.flatMap(s => s.items);
const spent = () => allItems().filter(i => state.bought.has(i.id)).reduce((s, i) => s + i.price, 0);

function progress(v) {
  v = Math.min(Math.max(v, 0), 1);
  if (v >= 1) return `<div class="progress"><i class="a" style="flex:1"></i></div>`;
  return `<div class="progress">${v > 0 ? `<i class="a" style="width:calc(${v * 100}% - 2px)"></i>` : ""}<i class="b"></i></div>`;
}
const stat = (value, label) => `<div><div class="title-m tnum ellipsis">${esc(value)}</div><div class="body-s soft ellipsis">${esc(label)}</div></div>`;
const mealIcon = id => {
  const r = roles(state.theme);
  return `<span class="meal-icon" style="background:${r.mealSoft(id)};color:${r.mealInk(id)}">${icon(ICON[id] ? id : "snack")}</span>`;
};
const sectionHead = (title, trailing) =>
  `<div class="base grow"><span class="title-m grow">${esc(title)}</span>${trailing ? `<span class="body-s soft">${esc(trailing)}</span>` : ""}</div>`;

function appBar(caption, title) {
  const t = state.theme;
  const swatches = state.themesOpen ? `<div class="themes" role="radiogroup" aria-label="配色">${THEMES.map(th => {
    const r = roles(th), on = th.id === t.id;
    return `<button class="swatch" data-theme="${th.id}" role="radio" aria-checked="${on}" aria-label="${th.name}">
      <span class="disc" style="background:${th.card};border-color:${on ? r.primary : th.line};border-width:${on ? 2 : 1}px">
        <i style="background:linear-gradient(${r.primary} 0 55%, transparent 55%), linear-gradient(90deg, ${th.breakfast} 0 25%, ${th.lunch} 25% 50%, ${th.snack} 50% 75%, ${th.dinner} 75%)"></i>
        ${on ? `<span class="check" style="color:${r.onPrimary}">${icon("check", 20)}</span>` : ""}
      </span>
      <span class="label-s" style="color:${on ? "var(--ink)" : "var(--ink-soft)"}">${th.name}</span>
    </button>`;
  }).join("")}</div>` : "";
  return `<header>
    <div class="appbar">
      <div class="grow"><div class="label-m soft">${esc(caption)}</div><h1 class="headline">${esc(title)}</h1></div>
      <button class="icon-btn${state.themesOpen ? " on" : ""}" data-action="themes" aria-label="配色" aria-expanded="${state.themesOpen}">
        <span class="wrap">${icon("palette", 24, state.themesOpen)}</span></button>
    </div>
    ${swatches ? `<div style="margin-top:12px">${swatches}</div>` : ""}
  </header>`;
}

// MARK: - Today

function today() {
  const p = state.plan, d = state.day, day = p.days[d], meals = byTime(day.meals);
  const eaten = eatenKcal(d), all = meals.every(m => isEaten(m, d));
  const days = `<div class="segmented" role="tablist">${p.days.map((x, i) => {
    const on = i === d, done = x.meals.every(m => isEaten(m, i));
    return `<button class="label-l${on ? " on" : ""}" data-day="${i}" role="tab" aria-selected="${on}">${on || done ? icon("check", 18) : ""}${x.label}</button>`;
  }).join("")}</div>`;
  const summary = `<section class="filled">
    <div class="label-m on-pc">已吃</div>
    <div class="base" style="gap:6px"><span class="number tnum">${eaten}</span><span class="body-m on-pc grow">/ ${day.kcal} kcal</span>
      <span class="label-l on-pc">${all ? "四餐都吃了" : "还差 " + Math.max(day.kcal - eaten, 0)}</span></div>
    ${progress(all ? 1 : eaten / Math.max(day.kcal, 1))}
    <div class="stats">${stat(day.protein + " g", "蛋白质")}${stat(day.fiber + " g", "膳食纤维")}${stat(day.salt.toFixed(1) + " g", "盐 · 上限 5 g")}</div>
  </section>`;
  const cards = meals.map(m => {
    const done = isEaten(m, d);
    return `<section class="outlined card">
      <div class="card-head">${mealIcon(m.id)}
        <div class="grow"><div class="title-m">${esc(m.title)}</div><div class="body-m soft">${m.time} · ${m.kcal} kcal · 蛋白 ${m.protein} g</div></div>
        <button class="check${done ? " on" : ""}" data-meal="${m.id}" role="checkbox" aria-checked="${done}" aria-label="${done ? m.title + "已吃" : "把" + m.title + "标记为已吃"}">
          <i>${done ? icon("check", 16) : ""}</i></button>
      </div>
      <div class="body-m soft" style="padding-bottom:8px">${esc(m.note)}</div>
      <div class="${done ? "dim" : ""}">${m.items.map(it => `<div class="divider"></div>
        <div class="list-row"><span class="body-l grow ellipsis">${esc(it.name)}</span>
          <span class="label-l">${esc(it.unit)}</span><span class="body-s soft tnum" style="width:44px;text-align:right">${it.grams} g</span></div>`).join("")}</div>
    </section>`;
  }).join("");
  const r = p.recipe;
  const recipe = `<section class="outlined section" style="gap:12px">
    <div class="row" style="gap:16px"><span class="soft">${icon("skillet")}</span>
      <div><div class="title-m">${esc(r.title)}</div><div class="body-m soft">晚饭 · 一锅${esc(r.serves)}</div></div></div>
    ${r.steps.map((s, i) => `<div class="step"><b class="tnum">${i + 1}</b><span class="body-m" style="padding-top:2px">${esc(s)}</span></div>`).join("")}
  </section>`;
  const prep = `<section class="outlined card" style="padding-top:16px">
    <div class="card-head"><span class="soft">${icon("cooking")}</span>${sectionHead("本周只开火 3 次", "共 " + p.prep.reduce((s, x) => s + x.minutes, 0) + " 分钟")}</div>
    ${p.prep.map(x => `<div class="divider"></div><div class="row" style="gap:16px;align-items:flex-start;padding:12px 0">
      <span class="label-l" style="color:var(--primary);width:56px;flex:none">${esc(x.when)}</span>
      <div><div class="body-m">${esc(x.what)}</div><div class="body-s soft">${x.minutes} 分钟</div></div></div>`).join("")}
  </section>`;
  return appBar(`${day.label} · 第 ${d + 1} 天 · 共 ${p.days.length} 天`, "今天") + days + summary + cards + recipe + prep;
}

// MARK: - Shopping

function shop() {
  const p = state.plan, count = state.bought.size, total = allItems().length, s = spent();
  const summary = `<section class="filled">
    <div class="label-m on-pc">合计</div>
    <div class="base"><span class="number tnum grow">${euro(p.totalEur)}</span><span class="label-l on-pc">比原清单省 ${euro(p.originalEur - p.totalEur)}</span></div>
    ${progress(count / Math.max(total, 1))}
    <div class="stats">${stat(`${count}/${total}`, "已买")}${stat(euro(s), "已花")}${stat(euro(p.totalEur - s), "还要")}</div>
  </section>`;
  const sections = p.shopping.map(sec => {
    const items = [...sec.items.filter(i => !state.bought.has(i.id)), ...sec.items.filter(i => state.bought.has(i.id))];
    const left = sec.items.filter(i => !state.bought.has(i.id)).length;
    return `<section class="outlined card" style="padding-top:16px">
      <div class="card-head">${mealIcon(SECTION_MEAL[sec.title] || "snack")}${sectionHead(sec.title, left === 0 ? "都买齐了" : `还差 ${left} 件`)}</div>
      ${items.map(it => {
        const done = state.bought.has(it.id);
        const usage = "每天 " + it.perDay + (it.left > 0 ? ` · 剩 ${it.left} g` : "");
        return `<div class="divider"></div><div class="shop-row${done ? " bought" : ""}">
          <button class="hit" data-item="${it.id}" role="checkbox" aria-checked="${done}" aria-label="${esc(it.zh)}，${esc(it.qty)}，${euro(it.price)}">
            <span class="check${done ? " on" : ""}" style="margin-left:-11px"><i>${done ? icon("check", 16) : ""}</i></span>
            <span class="row fade grow" style="gap:12px">
              <span class="thumb">${it.image ? `<img src="img/${it.image}.jpg" alt="" loading="lazy">` : icon("grocery")}</span>
              <span class="grow">
                <span class="row"><span class="body-l name ellipsis">${esc(it.zh)}</span>${it.tag && !done ? `<span class="tag label-s">${esc(it.tag)}</span>` : ""}</span>
                <span class="body-s soft ellipsis" style="display:block">${esc(usage)}</span>
                ${it.role.length ? `<span class="body-s soft ellipsis" style="display:block">${it.role.map(r => `${r.label} ${r.pct}%`).join(" · ")}</span>` : ""}
              </span>
              <span style="text-align:right;flex:none"><span class="label-l tnum" style="display:block">${euro(it.price)}</span><span class="body-s soft">${esc(it.qty)}</span></span>
            </span>
          </button>
          <a class="link state" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="在 S-kaupat 打开 ${esc(it.zh)}">${icon("openInNew", 20)}</a>
        </div>`;
      }).join("")}
    </section>`;
  }).join("");
  const footer = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:4px">
    ${count ? `<button class="outlined-btn label-l state" data-action="reset">${icon("restart", 18)}清空勾选</button>` : ""}
    <div class="body-s soft basis">${esc(p.basis)}</div></div>`;
  return appBar("S-market · 4 天", "购物清单") + summary + sections + footer;
}

// MARK: - Nutrition

function inBand(r) { return r.value >= r.lo && (r.hi == null || r.value <= r.hi); }

function rangeRow(r) {
  const rl = roles(state.theme);
  const max = Math.max(r.value, r.hi ?? r.lo * 1.6) * 1.15;
  const lo = r.lo / max * 100, hi = (r.hi ?? max) / max * 100, x = (state.appeared ? r.value : r.lo) / max * 100;
  const val = (Number.isInteger(r.value) ? r.value : r.value.toFixed(1)) + " " + r.unit;
  const target = r.hi != null ? (r.lo === 0 ? `建议 < ${r.hi}` : `建议 ${r.lo}–${r.hi}`) : `建议 ≥ ${r.lo}`;
  const ok = inBand(r);
  return `<div>
    <div class="base"><span class="body-l grow">${esc(r.label)}</span>
      <span class="label-l tnum" style="color:${ok ? "var(--ink)" : mix(rl.meal("dinner"), state.theme.ink, 0.35)}">${val}</span>
      <span class="body-s soft" style="width:84px;text-align:right">${target}</span></div>
    <div class="range-track"><i class="t"></i>
      <i class="band" style="left:${lo}%;width:${Math.max(hi - lo, 1)}%;background:${mix(rl.primary, rl.card, 0.62)}"></i>
      <i class="m" style="left:calc(${x}% - 2px);background:${ok ? rl.primary : rl.meal("dinner")}"></i></div>
  </div>`;
}

const rows = (items, fn) => items.map((x, i) => (i ? `<div class="divider" style="margin:12px 0"></div>` : "") + fn(x)).join("");
const card = (title, trailing, body) => `<section class="outlined section">${sectionHead(title, trailing)}<div>${body}</div></section>`;

function nutrition() {
  const p = state.plan, n = p.nutrition, rl = roles(state.theme);
  const ranges = [...n.macros, ...n.groups];
  const met = ranges.filter(inBand).length + n.micros.filter(m => m.pct >= 100).length;
  const all = ranges.length + n.micros.length;
  const summary = `<section class="filled">
    <div class="label-m on-pc">在建议范围内</div>
    <div class="base" style="gap:6px"><span class="number tnum">${met}</span><span class="body-m on-pc">/ ${all} 项</span></div>
    ${progress(met / all)}
    <div class="stats">${stat(String(p.kcal), "kcal")}${stat(p.protein + " g", "蛋白质")}${stat(p.fiber + " g", "纤维")}${stat(p.salt.toFixed(1) + " g", "盐")}</div>
  </section>`;
  const total = Math.max(p.plate.reduce((s, x) => s + x.grams, 0), 1);
  const colors = [rl.primary, mix(rl.primary, rl.card, 0.45), mix(rl.primary, rl.card, 0.72)];
  const plate = card("餐盘模型", "按每天克数", `
    <div class="blockbar">${p.plate.map((x, i) => `<i style="flex:${state.appeared ? x.grams : 1};background:${colors[i]};transition:flex .6s cubic-bezier(.2,0,0,1)"></i>`).join("")}</div>
    <div class="row" style="gap:12px;align-items:flex-start;margin-top:16px">${p.plate.map((x, i) => `<div class="grow">
      <div class="row" style="gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:${colors[i]}"></i><span class="body-s soft">${esc(x.label)}</span></div>
      <div class="title-l tnum">${Math.round(x.grams / total * 100)}%</div>
      <div class="body-s soft">建议 ${x.rec}%</div><div class="body-s soft tnum">${x.grams} g / 天</div></div>`).join("")}</div>`);
  const micros = `<div class="micros">${n.micros.map(m => `<div class="micro">
    <div class="label-l tnum">${m.pct}%</div><div class="body-s soft ellipsis">${esc(m.label)}</div>
    <div class="bar"><i style="width:${state.appeared ? Math.min(m.pct, 100) : 0}%;background:${m.pct >= 100 ? rl.primary : rl.meal("dinner")};transition:width .6s cubic-bezier(.2,0,0,1)"></i></div></div>`).join("")}</div>`;
  const fixes = rows(n.fixes, f => `<div>
    <div class="row" style="gap:8px"><span class="label-l" style="width:64px;flex:none">${esc(f.title)}</span>
      <span class="body-m soft" style="text-decoration:line-through">${esc(f.from)}</span><span class="soft">${icon("arrow", 16)}</span>
      <span class="body-m" style="font-weight:500">${esc(f.to)}</span></div>
    <div class="body-s soft" style="padding-left:72px">${esc(f.why)}</div></div>`);
  return appBar("芬兰 2024 成人建议 · 4 天平均", "营养") + summary + plate
    + card("能量来源", "占总能量", rows(n.macros, rangeRow))
    + card("食物组", "每天", rows(n.groups, rangeRow))
    + card("微量营养素", "占推荐摄入量", micros)
    + card("比原方案修正", "", fixes)
    + `<div class="body-s soft basis">${esc(p.basis)}</div>`;
}

// MARK: - Render and events

function render(animate = false) {
  applyTheme();
  const page = document.getElementById("page");
  page.innerHTML = [today, shop, nutrition][state.tab]();
  if (animate) { page.classList.remove("fade-in"); void page.offsetWidth; page.classList.add("fade-in"); }
  document.getElementById("nav").innerHTML = `<div class="inner">${TABS.map((t, i) => {
    const on = i === state.tab;
    return `<button class="${on ? "on" : ""}" data-tab="${i}" aria-current="${on ? "page" : "false"}">
      <span class="ind">${icon(t.icon, 24, on)}</span><span class="label-m">${t.title}</span></button>`;
  }).join("")}</div>`;
  if (state.tab === 2 && !state.appeared) requestAnimationFrame(() => setTimeout(() => { state.appeared = true; render(); }, 80));
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-tab],[data-day],[data-meal],[data-item],[data-theme],[data-action]");
  if (!el) return;
  const d = el.dataset;
  if (d.tab != null) {
    const tab = +d.tab;
    if (tab === state.tab) return;
    state.tab = tab; state.themesOpen = false; store.set("tab", tab);
    if (tab !== 2) state.appeared = false;
    render(true); window.scrollTo(0, 0);
  } else if (d.day != null) {
    state.day = +d.day; render();
  } else if (d.meal) {
    const key = `${state.day}-${d.meal}`;
    state.eaten.has(key) ? state.eaten.delete(key) : state.eaten.add(key);
    store.set("eaten", [...state.eaten]); render();
    navigator.vibrate?.(10);
  } else if (d.item) {
    state.bought.has(d.item) ? state.bought.delete(d.item) : state.bought.add(d.item);
    store.set("bought", [...state.bought]); render();
  } else if (d.theme) {
    state.theme = THEMES.find(t => t.id === d.theme); store.set("theme", d.theme);
    state.themesOpen = false; render();
  } else if (d.action === "themes") {
    state.themesOpen = !state.themesOpen; render();
  } else if (d.action === "reset") {
    state.bought.clear(); store.set("bought", []); render();
  }
});

fetch("plan.json").then(r => r.json()).then(plan => { state.plan = plan; render(); });
