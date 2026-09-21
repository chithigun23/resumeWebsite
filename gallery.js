/*
  Gallery: loads gallery/images.json, renders a grid, opens a lightbox viewer.
*/
(function () {
  "use strict";

  var grid = document.getElementById("grid");
  var empty = document.getElementById("empty");
  var count = document.getElementById("count");
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCap");
  var images = [];
  var current = 0;
  var lastFocus = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render() {
    if (!images.length) {
      count.textContent = "0 photos";
      empty.hidden = false;
      return;
    }
    count.textContent = images.length + (images.length === 1 ? " photo" : " photos");
    grid.innerHTML = images.map(function (im, i) {
      var t = esc(im.title || "");
      return '<button class="g-item" type="button" data-i="' + i + '" aria-label="View ' + (t || "image " + (i + 1)) + '">' +
        '<img src="' + esc(im.src) + '" alt="' + t + '" loading="lazy" decoding="async">' +
        (t ? '<span class="g-cap">' + t + "</span>" : "") + "</button>";
    }).join("");
  }

  function show(i) {
    current = (i + images.length) % images.length;
    var im = images[current];
    lbImg.src = im.src;
    lbImg.alt = im.title || "";
    lbCap.textContent = (im.title ? im.title + " — " : "") + (current + 1) + " / " + images.length;
  }

  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("lbClose").focus();
  }

  function close() {
    lb.hidden = true;
    lbImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (lastFocus) { lastFocus.focus(); }
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
    .then(function (data) { images = Array.isArray(data) ? data : []; render(); })
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
