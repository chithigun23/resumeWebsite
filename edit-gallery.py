"""
Gallery caption editor.

  python edit-gallery.py          then open http://localhost:8000/_editor

Shows every photo (newest first) with its title and story next to a live preview
of the gallery popup. Save writes gallery/stories.md and rebuilds gallery/images.json
(same as running update-gallery.py). "View gallery" opens the real gallery page,
served from this folder, so you can check it before you commit and push.

Runs only on your computer (127.0.0.1). Stop it with Ctrl+C.
"""
import importlib.util
import json
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location("update_gallery", ROOT / "update-gallery.py")
ug = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ug)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
HEADER = "<!-- One section per photo: '## id | optional title', then the story. -->\n"


def load():
    ug.STORIES.touch()
    ug.rebuild()  # picks up any new photos first
    items = json.loads((ug.GALLERY / "images.json").read_text(encoding="utf-8"))
    return list(reversed(items))  # newest first, same as the gallery


def save(entries):
    known = {p.stem for p in ug.GALLERY.glob("*.jpg")}
    by_id = {e["id"]: e for e in entries if e.get("id") in known}
    old = ug.parse_stories()
    out = [HEADER]
    for pid in sorted(known, key=lambda s: (s.startswith("undated-"), s)):
        e = by_id.get(pid) or old.get(pid) or {"title": "", "story": ""}
        title = " ".join(str(e.get("title", "")).split())
        story = "\n".join(line.rstrip() for line in str(e.get("story", "")).strip().splitlines())
        out.append(f"\n## {pid} | {title}\n" if title else f"\n## {pid} |\n")
        if story:
            out.append(story + "\n")
    ug.STORIES.write_text("".join(out), encoding="utf-8")
    ug.rebuild()


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/_editor", "/_editor/"):
            return self._send(200, EDITOR, "text/html; charset=utf-8")
        if path == "/_api/photos":
            return self._send(200, json.dumps(load()), "application/json")
        if path == "/gallery":  # GitHub Pages serves gallery.html at /gallery
            self.path = "/gallery.html"
        return super().do_GET()

    def do_POST(self):
        if self.path != "/_api/photos":
            return self._send(404, "not found", "text/plain")
        if self.headers.get("Origin") not in (None, f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}"):
            return self._send(403, "forbidden", "text/plain")
        try:
            n = int(self.headers.get("Content-Length", "0"))
            entries = json.loads(self.rfile.read(n).decode("utf-8"))
            save(entries)
            return self._send(200, json.dumps({"ok": True}), "application/json")
        except Exception as e:  # report back to the page
            return self._send(400, json.dumps({"ok": False, "error": str(e)}), "application/json")


EDITOR = r"""<!doctype html>
<html lang="en-AU" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gallery captions</title>
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/gallery.css">
<style>
  body { background: var(--bg); color: var(--ink); }
  .ed { display: grid; grid-template-columns: 340px minmax(0, 1fr); height: 100vh; }
  .list { overflow-y: auto; border-right: 1px solid var(--line); }
  .list-head { position: sticky; top: 0; z-index: 2; background: var(--bg); padding: 16px; border-bottom: 1px solid var(--line); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .list-head h1 { font-size: 16px; margin-right: auto; }
  .row { display: flex; gap: 12px; align-items: center; width: 100%; padding: 10px 16px; border-bottom: 1px solid var(--line-soft); text-align: left; min-height: 72px; }
  .row:hover { background: var(--panel); }
  .row.on { background: var(--panel); box-shadow: inset 3px 0 0 var(--volt); }
  .row img { width: 56px; height: 56px; object-fit: cover; flex: 0 0 auto; }
  .row b { display: block; font-size: 14px; font-weight: 600; line-height: 1.3; }
  .row span { display: block; font-size: 13px; color: var(--ink-3); }
  .row .empty { font-style: italic; }
  .main { overflow-y: auto; padding: 24px 32px 40px; display: flex; flex-direction: column; gap: 20px; }
  .fields { display: grid; gap: 14px; max-width: 760px; }
  label { font-size: 14px; color: var(--ink-2); display: grid; gap: 6px; }
  input, textarea { font: inherit; font-size: 16px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); padding: 10px 12px; }
  textarea { min-height: 120px; resize: vertical; line-height: 1.6; }
  input:focus, textarea:focus { outline: 2px solid var(--volt); outline-offset: 0; }
  .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .btn { font-size: 14px; padding: 0 16px; min-height: 40px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); display: inline-flex; align-items: center; cursor: pointer; }
  .btn.primary { background: var(--volt); border-color: var(--volt); color: var(--volt-ink); font-weight: 700; }
  .btn:disabled { opacity: .45; cursor: default; }
  .status { font-size: 14px; color: var(--ink-3); }
  .hint { font-size: 13px; color: var(--ink-3); }
  .preview-wrap { padding: 24px; background: color-mix(in srgb, var(--ink) 4%, var(--bg)); border: 1px dashed var(--line); display: flex; justify-content: center; }
  .preview-wrap .lb-card { width: 100%; max-width: 1000px; max-height: 620px; animation: none; }
  .preview-wrap .lb-fig img { max-height: 620px; }
  .preview-wrap .lb-card.portrait { grid-template-columns: minmax(0, 340px) 300px; width: auto; }
  .preview-wrap .lb-card.portrait .lb-fig img { width: 100%; height: auto; }
  .tag-sm { font-size: 12px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .12em; }
</style>
</head>
<body>
<div class="ed">
  <aside class="list">
    <div class="list-head">
      <h1>Gallery captions</h1>
      <button class="btn primary" id="save" type="button" disabled>Save</button>
      <a class="btn" href="/gallery" target="_blank" rel="noopener">View gallery</a>
    </div>
    <div id="rows"></div>
  </aside>
  <main class="main">
    <div class="bar"><span class="status" id="status">Loading…</span></div>
    <div class="fields">
      <label>Title <input id="title" type="text" placeholder="Leave empty for no title"></label>
      <label>Story <textarea id="story" placeholder="What's happening in this photo? A blank line starts a new paragraph."></textarea></label>
      <p class="hint">Changes show in the preview straight away. Save writes stories.md and images.json. Ctrl+S also saves.</p>
    </div>
    <p class="tag-sm">Preview — how the gallery popup will look</p>
    <div class="preview-wrap">
      <div class="lb-card" id="card">
        <figure class="lb-fig"><img id="pimg" alt=""></figure>
        <aside class="lb-story">
          <p class="lb-date mono" id="pdate"></p>
          <h2 class="lb-title" id="ptitle"></h2>
          <div class="lb-text" id="ptext"></div>
          <p class="lb-count mono" id="pcount"></p>
        </aside>
      </div>
    </div>
  </main>
</div>
<script>
(function () {
  var photos = [], cur = 0, dirty = false;
  var $ = function (id) { return document.getElementById(id); };
  function fmt(iso) {
    if (!iso) return "";
    var p = iso.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  function setDirty(v) { dirty = v; $("save").disabled = !v; $("status").textContent = v ? "Unsaved changes" : "All changes saved"; }
  function rowHtml(p, i) {
    var t = p.title ? p.title.replace(/</g, "&lt;") : '<span class="empty">No title</span>';
    return '<button class="row' + (i === cur ? " on" : "") + '" type="button" data-i="' + i + '">' +
      '<img src="/' + p.thumb + '" alt="" loading="lazy"><div><b>' + t + '</b><span>' + fmt(p.date) +
      (p.story ? "" : " · no story") + "</span></div></button>";
  }
  function renderList() { $("rows").innerHTML = photos.map(rowHtml).join(""); }
  function renderPreview() {
    var p = photos[cur];
    $("pimg").src = "/" + p.src;
    $("pdate").textContent = fmt(p.date);
    $("ptitle").textContent = p.title || "";
    $("ptitle").hidden = !p.title;
    $("ptext").innerHTML = "";
    (p.story || "").split(/\n\s*\n/).forEach(function (para) {
      if (!para.trim()) return;
      var el = document.createElement("p");
      para.trim().split("\n").forEach(function (line, k) { if (k) el.appendChild(document.createElement("br")); el.appendChild(document.createTextNode(line)); });
      $("ptext").appendChild(el);
    });
    $("pcount").textContent = (cur + 1) + " / " + photos.length;
    var card = $("card");
    card.classList.toggle("no-story", !p.story && !p.title);
    card.classList.toggle("portrait", p.h > p.w);
  }
  function select(i) {
    cur = i;
    $("title").value = photos[i].title || "";
    $("story").value = photos[i].story || "";
    renderList(); renderPreview();
    var on = document.querySelector(".row.on"); if (on) on.scrollIntoView({ block: "nearest" });
  }
  $("rows").addEventListener("click", function (e) { var b = e.target.closest(".row"); if (b) select(+b.getAttribute("data-i")); });
  $("title").addEventListener("input", function () { photos[cur].title = this.value; setDirty(true); renderPreview(); renderList(); });
  $("story").addEventListener("input", function () { photos[cur].story = this.value; setDirty(true); renderPreview(); renderList(); });
  function save() {
    if (!dirty) return;
    $("status").textContent = "Saving…";
    fetch("/_api/photos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(photos.map(function (p) { return { id: p.id, title: p.title, story: p.story }; })) })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r.ok) setDirty(false); else $("status").textContent = "Save failed: " + r.error; })
      .catch(function (e) { $("status").textContent = "Save failed: " + e; });
  }
  $("save").addEventListener("click", save);
  $("title").addEventListener("keydown", function (e) { if (e.key === "ArrowDown" && e.altKey) { select(Math.min(photos.length - 1, cur + 1)); } });
  window.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  fetch("/_api/photos").then(function (r) { return r.json(); }).then(function (d) {
    photos = d; if (!photos.length) { $("status").textContent = "No photos yet. Run update-gallery.py with a photos folder first."; return; }
    select(0); setDirty(false);
  });
})();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(ROOT)))
    url = f"http://localhost:{PORT}/_editor"
    print(f"Gallery caption editor running at {url}  (Ctrl+C to stop)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
