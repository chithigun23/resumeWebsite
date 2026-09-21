/*
  Gallery: loads gallery/images.json (built by update-gallery.py), renders a date-ordered
  mosaic, and opens each photo in a lightbox alongside its story.
*/
(function () {
  "use strict";

  var grid = document.getElementById("grid");
  var empty = document.getElementById("empty");
  var count = document.getElementById("count");
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lbImg");
  var lbCard = document.getElementById("lbCard");
  var lbDate = document.getElementById("lbDate");
  var lbTitle = document.getElementById("lbTitle");
  var lbText = document.getElementById("lbText");
  var lbCount = document.getElementById("lbCount");
  var images = [];
  var current = 0;
  var lastFocus = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) { return ""; }
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }

  function label(im) { return im.title || (im.date ? "Photo from " + fmtDate(im.date) : "Photo"); }

  /* mosaic: each tile's width follows its aspect ratio, so rows fill edge to edge in date order */
  function render() {
    if (!images.length) {
      count.textContent = "0 photos";
      empty.hidden = false;
      return;
    }
    count.textContent = images.length + (images.length === 1 ? " photo" : " photos");
    grid.innerHTML = images.map(function (im, i) {
      var cap = [fmtDate(im.date), im.title].filter(Boolean).join(" · ");
      return '<button class="g-item' + (im.story ? " has-story" : "") + '" type="button" data-i="' + i +
        '" style="--ar:' + (im.w / im.h).toFixed(4) + '" aria-label="View ' + esc(label(im)) + '">' +
        '<img src="' + esc(im.thumb || im.src) + '" width="' + im.w + '" height="' + im.h + '" alt="' + esc(label(im)) +
        '" loading="lazy" decoding="async">' +
        (cap ? '<span class="g-cap">' + esc(cap) + "</span>" : "") + "</button>";
    }).join("");
  }

  function show(i) {
    current = (i + images.length) % images.length;
    var im = images[current];
    lbImg.src = im.src;
    lbImg.alt = label(im);
    lbDate.textContent = fmtDate(im.date);
    lbTitle.textContent = im.title || "";
    lbTitle.hidden = !im.title;
    lbText.innerHTML = im.story
      ? im.story.split(/\r?\n\s*\r?\n/).map(function (para) {
          return "<p>" + esc(para.trim()).replace(/\r?\n/g, "<br>") + "</p>";
        }).join("")
      : "";
    lbCard.classList.toggle("no-story", !im.story && !im.title);
    lbCount.textContent = (current + 1) + " / " + images.length;
    lbCard.scrollTop = 0;
    lbText.scrollTop = 0;
    /* warm the neighbours so next/prev feels instant */
    [current - 1, current + 1].forEach(function (n) {
      var nb = images[(n + images.length) % images.length];
      if (nb) { new Image().src = nb.src; }
    });
    try { history.replaceState(null, "", "#" + im.id); } catch (e) {}
  }

  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    lb.hidden = false;
    lbCard.classList.remove("pop");
    void lbCard.offsetWidth; /* restart the pop-in animation */
    lbCard.classList.add("pop");
    document.body.style.overflow = "hidden";
    document.getElementById("lbClose").focus();
  }

  function close() {
    lb.hidden = true;
    lbImg.removeAttribute("src");
    document.body.style.overflow = "";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (lastFocus) { lastFocus.focus(); }
  }

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) { return; }
    for (var i = 0; i < images.length; i++) {
      if (images[i].id === id) { open(i); return; }
    }
  }

  grid.addEventListener("click", function (e) {
    var b = e.target.closest(".g-item");
    if (b) { open(Number(b.getAttribute("data-i"))); }
  });
  document.getElementById("lbClose").addEventListener("click", close);
  document.getElementById("lbPrev").addEventListener("click", function () { show(current - 1); });
  document.getElementById("lbNext").addEventListener("click", function () { show(current + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) { close(); } });

  document.addEventListener("keydown", function (e) {
    if (lb.hidden) { return; }
    if (e.key === "Escape") { close(); }
    else if (e.key === "ArrowLeft") { show(current - 1); }
    else if (e.key === "ArrowRight") { show(current + 1); }
  });

  /* touch swipe */
  var sx = null;
  lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (sx === null) { return; }
    var dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) { show(current + (dx < 0 ? 1 : -1)); }
  });

  fetch("gallery/images.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.json(); })
    .then(function (data) { images = Array.isArray(data) ? data : []; render(); openFromHash(); })
    .catch(function () { images = []; render(); });

  /* ---------- theme toggle ---------- */
  var root = document.documentElement;
  var themeBtn = document.getElementById("themeBtn");
  var themeIcon = document.getElementById("themeIcon").querySelector("use");

  function paintToggle() {
    var dark = root.getAttribute("data-theme") === "dark";
    themeIcon.setAttribute("href", dark ? "#i-sun" : "#i-moon");
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute("content", dark ? "#0D0E15" : "#F4F5F6"); }
  }
  themeBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("cg-theme", next); } catch (e) {}
    paintToggle();
  });
  paintToggle();
})();
