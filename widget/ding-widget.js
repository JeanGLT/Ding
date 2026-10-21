// Ding - widget Scriptable pour Citybus HK
// Même identité visuelle que la web app Ding (ambre sur vert nuit, numéros condensés).
// Un tap sur le widget ouvre la web app. Le lien se règle une fois dans le menu du script.
//
// Données : API ETA open data de Citybus (rt.data.gov.hk), gratuite et sans clé.

const BASE = "https://rt.data.gov.hk/v2/transport/citybus";
const DEFAULT_WEBAPP_URL = ""; // optionnel : colle ici le lien GitHub Pages, ou règle-le dans le menu
const DEFAULT_LINES = [
  { route: "37A", dir: "outbound" },
  { route: "90", dir: "outbound" },
  { route: "5X", dir: "outbound" },
  { route: "26", dir: "outbound" },
];

// ---------- Identité visuelle (mêmes valeurs que la web app) ----------
const dyn = (light, dark) => Color.dynamic(new Color(light), new Color(dark));
const C = {
  bg: dyn("#EDF2F0", "#091316"),
  surface: dyn("#FFFFFF", "#122126"),
  ink: dyn("#0E1C20", "#E9F2F0"),
  muted: dyn("#58696E", "#8CA2A7"),
  go: dyn("#0B8F5F", "#3FE0A0"),
  warn: dyn("#B3261E", "#FF8A80"),
  accent: new Color("#FFB61E"),
  onAccent: new Color("#1B1300"),
  onBadge: new Color("#10181B"),
};
const BADGES = ["#FFB41F", "#FF7A59", "#4FC3F7", "#B39DFF", "#6FDB9B", "#FF8DB5"];
const NUM_FONT = "AvenirNextCondensed-Heavy";

function hash(str) {
  let x = 0;
  for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
  return x;
}
function routeColor(route) {
  return new Color(BADGES[hash(route) % 6]);
}
function numFont(size) {
  return new Font(NUM_FONT, size);
}

function makeLogo() {
  const dc = new DrawContext();
  dc.size = new Size(120, 120);
  dc.opaque = false;
  dc.respectScreenScale = true;

  const rr = (x, y, w, h, r) => {
    const p = new Path();
    p.addRoundedRect(new Rect(x, y, w, h), r, r);
    dc.addPath(p);
    dc.fillPath();
  };
  dc.setFillColor(C.accent);
  rr(0, 0, 120, 120, 33);
  dc.setFillColor(C.onAccent);
  rr(24, 39, 66, 54, 13);
  dc.setFillColor(C.accent);
  rr(33, 48, 48, 21, 6);
  dc.fillEllipse(new Rect(38, 75, 10, 10));
  dc.fillEllipse(new Rect(66, 75, 10, 10));

  dc.setStrokeColor(C.onAccent);
  dc.setLineWidth(6);
  const wave = (x0, y0, cx, cy, x1, y1) => {
    const p = new Path();
    p.move(new Point(x0, y0));
    p.addQuadCurve(new Point(x1, y1), new Point(cx, cy));
    dc.addPath(p);
    dc.strokePath();
  };
  wave(90, 19.5, 100, 21, 104.4, 33.9);
  wave(91.5, 7.5, 106, 9.6, 115.5, 32.4);
  return dc.getImage();
}

// ---------- Stockage ----------
const fm = FileManager.local();
const STORE = fm.joinPath(fm.documentsDirectory(), "citybus-lines.json");

function load() {
  let lines = DEFAULT_LINES;
  let url = DEFAULT_WEBAPP_URL;
  if (fm.fileExists(STORE)) {
    try {
      const raw = JSON.parse(fm.readString(STORE));
      if (Array.isArray(raw)) lines = raw; // ancien format
      else {
        lines = raw.lines || DEFAULT_LINES;
        url = raw.url || DEFAULT_WEBAPP_URL;
      }
    } catch (e) {}
  }
  return { lines, url };
}
function save(state) {
  fm.writeString(STORE, JSON.stringify(state));
}
function upsert(lines, line) {
  const out = lines.filter((l) => l.route !== line.route);
  out.push(line);
  return out;
}

async function api(path) {
  const req = new Request(BASE + path);
  req.timeoutInterval = 15;
  const json = await req.loadJSON();
  return json.data;
}

async function notify(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("OK");
  await a.presentAlert();
}

// ---------- Prochains passages ----------
async function getEtas(line) {
  const data = await api(`/eta/CTB/${line.stop}/${line.route}`);
  const d = line.dir === "outbound" ? "O" : "I";
  const now = Date.now();
  return data
    .filter((e) => e.dir === d && e.eta)
    .map((e) => Math.floor((new Date(e.eta).getTime() - now) / 60000))
    .sort((a, b) => a - b)
    .slice(0, 3);
}

// ---------- Choix de la ligne, du sens et de l'arrêt ----------
async function stopsFor(route, dir) {
  const routeStops = await api(`/route-stop/CTB/${route}/${dir}`);
  const details = await Promise.all(routeStops.map((s) => api(`/stop/${s.stop}`)));
  return routeStops.map((s, i) => ({
    id: s.stop,
    seq: s.seq,
    name: details[i].name_en,
  }));
}

async function pickStop(route, dir) {
  const stops = await stopsFor(route, dir);
  let chosen = null;
  const table = new UITable();
  table.showSeparators = true;

  const head = new UITableRow();
  head.isHeader = true;
  head.addText(`${route}: tap your stop, then close the list`);
  table.addRow(head);

  const rows = stops.map((s) => {
    const row = new UITableRow();
    row.height = 44;
    const cell = row.addText(`${s.seq}. ${s.name}`);
    cell.widthWeight = 90;
    row.onSelect = () => {
      chosen = s;
      rows.forEach((r, i) => {
        r.backgroundColor = stops[i].id === s.id ? new Color("#FFB61E", 0.3) : null;
      });
      table.reload();
    };
    table.addRow(row);
    return row;
  });

  await table.present();
  return chosen;
}

async function setupLine(routeInput) {
  const route = routeInput.toUpperCase().trim();
  let info = null;
  try {
    info = await api(`/route/CTB/${route}`);
  } catch (e) {}
  if (!info || !info.route) {
    await notify("Route not found", `Citybus ${route} doesn't exist.`);
    return null;
  }

  const a = new Alert();
  a.title = `Citybus ${route}`;
  a.message = "Which direction?";
  a.addAction(`${info.orig_en} → ${info.dest_en}`);
  a.addAction(`${info.dest_en} → ${info.orig_en}`);
  a.addCancelAction("Cancel");
  const i = await a.presentSheet();
  if (i < 0) return null;

  const dir = i === 0 ? "outbound" : "inbound";
  const stop = await pickStop(route, dir);
  if (!stop) return null;
  return { route, dir, stop: stop.id, stopName: stop.name };
}

// ---------- Widget ----------
async function buildWidget(state) {
  const lines = state.lines;
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(10, 12, 8, 12);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  if (state.url) w.url = state.url;

  const family = config.widgetFamily || "medium";
  const small = family === "small";
  const max = { small: 2, medium: 3, large: 6 }[family] || 3;
  const shown = lines.slice(0, max);

  const results = await Promise.all(
    shown.map(async (l) => {
      if (!l.stop) return null;
      try {
        return await getEtas(l);
      } catch (e) {
        return "err";
      }
    })
  );

  // En-tête : logo, nom, heure de mise à jour
  const header = w.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();
  const img = header.addImage(makeLogo());
  img.imageSize = new Size(20, 20);
  header.addSpacer(6);
  const word = header.addText("ding");
  word.font = numFont(19);
  word.textColor = C.ink;
  header.addSpacer();
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong",
  });
  const upd = header.addText(time);
  upd.font = Font.mediumSystemFont(10);
  upd.textColor = C.muted;

  w.addSpacer(6);

  shown.forEach((l, i) => {
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.backgroundColor = C.surface;
    row.cornerRadius = 12;
    row.setPadding(4, 6, 4, 8);
    row.spacing = 8;

    // Pastille de ligne
    const badge = row.addStack();
    badge.backgroundColor = routeColor(l.route);
    badge.cornerRadius = 8;
    badge.size = new Size(small ? 38 : 46, 28);
    badge.centerAlignContent();
    const bt = badge.addText(l.route);
    bt.font = numFont(small ? 19 : 21);
    bt.textColor = C.onBadge;
    bt.minimumScaleFactor = 0.6;
    bt.lineLimit = 1;

    const col = row.addStack();
    col.layoutVertically();

    if (!small) {
      const st = col.addText(l.stopName || "No stop chosen");
      st.font = Font.systemFont(9);
      st.textColor = C.muted;
      st.lineLimit = 1;
    }

    const r = results[i];
    const line = col.addStack();
    line.layoutHorizontally();
    line.bottomAlignContent();
    if (r === null) {
      const t = line.addText("Open the script");
      t.font = Font.boldSystemFont(12);
      t.textColor = C.muted;
    } else if (r === "err") {
      const t = line.addText("Offline");
      t.font = Font.boldSystemFont(12);
      t.textColor = C.warn;
    } else if (r.length === 0) {
      const t = line.addText("No buses");
      t.font = Font.boldSystemFont(12);
      t.textColor = C.muted;
    } else if (r[0] <= 0) {
      const t = line.addText("Arriving");
      t.font = numFont(24);
      t.textColor = C.go;
      if (r.length > 1) {
        line.addSpacer(8);
        const n = line.addText("then " + r.slice(1, 3).map((m) => (m <= 0 ? "now" : m)).join(" · "));
        n.font = numFont(14);
        n.textColor = C.muted;
      }
    } else {
      const big = line.addText(String(r[0]));
      big.font = numFont(small ? 26 : 28);
      big.textColor = r[0] <= 2 ? C.go : C.ink;
      line.addSpacer(3);
      const unit = line.addText("min");
      unit.font = numFont(13);
      unit.textColor = C.muted;
      if (r.length > 1) {
        line.addSpacer(small ? 6 : 10);
        const n = line.addText(r.slice(1, small ? 2 : 3).join(" · "));
        n.font = numFont(small ? 15 : 16);
        n.textColor = C.muted;
      }
    }
    row.addSpacer();

    if (i < shown.length - 1) w.addSpacer(5);
  });

  w.addSpacer();
  return w;
}

// ---------- Menu dans l'app ----------
async function askUrl(state) {
  const ask = new Alert();
  ask.title = "Ding app link";
  ask.message = "Paste your web app link (GitHub Pages). Tapping the widget will open it.";
  ask.addTextField("https://username.github.io/Ding/", state.url || "");
  ask.addAction("Save");
  ask.addCancelAction("Cancel");
  const res = await ask.presentAlert();
  if (res !== 0) return;
  const v = ask.textFieldValue(0).trim();
  if (v && !/^https?:\/\//i.test(v)) {
    await notify("Invalid link", "The link must start with https://");
    return;
  }
  state.url = v;
  save(state);
}

async function appMain() {
  const state = load();

  // Lignes sans arrêt : on les configure d'abord
  for (const l of state.lines) {
    if (!l.stop) {
      const done = await setupLine(l.route);
      if (done) state.lines = upsert(state.lines, done);
    }
  }
  save(state);

  // Premier lancement : on demande le lien de la web app
  if (!state.url) await askUrl(state);

  while (true) {
    const a = new Alert();
    a.title = "Ding · Citybus HK";
    a.message =
      state.lines.map((l) => `${l.route} · ${l.stopName || "no stop chosen"}`).join("\n") +
      `\n\nWeb app: ${state.url || "not set"}`;
    a.addAction("Preview widget");
    a.addAction("Add / edit a route");
    a.addAction("Remove a route");
    a.addAction("Web app link");
    a.addAction("Open web app");
    a.addCancelAction("Close");
    const i = await a.presentAlert();

    if (i === 0) {
      const w = await buildWidget(state);
      await w.presentMedium();
    } else if (i === 1) {
      const ask = new Alert();
      ask.title = "Route number";
      ask.addTextField("e.g. 37A", "");
      ask.addAction("Next");
      ask.addCancelAction("Cancel");
      const res = await ask.presentAlert();
      if (res === 0) {
        const value = ask.textFieldValue(0);
        if (value) {
          const done = await setupLine(value);
          if (done) {
            state.lines = upsert(state.lines, done);
            save(state);
          }
        }
      }
    } else if (i === 2) {
      const del = new Alert();
      del.title = "Remove which route?";
      state.lines.forEach((l) => del.addAction(l.route));
      del.addCancelAction("Cancel");
      const k = await del.presentSheet();
      if (k >= 0) {
        state.lines.splice(k, 1);
        save(state);
      }
    } else if (i === 3) {
      await askUrl(state);
    } else if (i === 4) {
      if (state.url) Safari.open(state.url);
      else await notify("Missing link", "Set the web app link first.");
    } else {
      break;
    }
  }
}

// ---------- Point d'entrée ----------
if (config.runsInWidget) {
  const widget = await buildWidget(load());
  Script.setWidget(widget);
} else {
  await appMain();
}
Script.complete();
