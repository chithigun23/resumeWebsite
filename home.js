/*
  Chithi Gunatilake — home page behaviour:
  theme toggle, HUD scroll progress + current section, section-to-section nav, footer year.
*/
(function () {
  "use strict";

  var body = document.body;

  /* ---------- theme toggle ---------- */
  var themeBtn = document.getElementById("themeBtn");
  var themeIcon = document.getElementById("themeIcon");

  function paintTheme() {
    var dark = body.getAttribute("data-theme") !== "light";
    themeIcon.setAttribute("href", dark ? "#v3-sun" : "#v3-moon");
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute("content", dark ? "#121315" : "#F4F5F6"); }
  }
  themeBtn.addEventListener("click", function () {
    var next = body.getAttribute("data-theme") === "light" ? "dark" : "light";
    if (next === "dark") { body.removeAttribute("data-theme"); } else { body.setAttribute("data-theme", "light"); }
    try { localStorage.setItem("cg-theme", next); } catch (e) {}
    paintTheme();
  });
  paintTheme();

  /* ---------- HUD ---------- */
  var fill = document.getElementById("hudFill");
  var label = document.getElementById("hudSec");
  var navUp = document.getElementById("navUp");
  var navDown = document.getElementById("navDown");
  var hero = document.getElementById("top");
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var stops = [hero].concat(sections);
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ticking = false;

  function y() { return window.scrollY || window.pageYOffset || 0; }
  function top(el) { return el.getBoundingClientRect().top + y(); }
  function nameOf(el) {
    if (el === hero) { return "Intro"; }
    var h = el.querySelector("h2");
    if (el.id === "contact") { return "Contact"; }
    return h ? h.textContent : el.id;
  }

  function currentIndex() {
    var mid = y() + window.innerHeight * 0.4, idx = 0;
    for (var i = 0; i < stops.length; i++) { if (top(stops[i]) <= mid) { idx = i; } }
    return idx;
  }

  function render() {
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var p = Math.min(1, Math.max(0, y() / max));
    fill.style.width = (p * 100) + "%";
    var i = currentIndex();
    var name = nameOf(stops[i]);
    if (label.textContent !== name) { label.textContent = name; }
    navUp.setAttribute("href", "#" + stops[Math.max(0, i - 1)].id);
    navDown.setAttribute("href", "#" + stops[Math.min(stops.length - 1, i + 1)].id);
    ticking = false;
  }
  function request() { if (!ticking) { ticking = true; window.requestAnimationFrame(render); } }

  function jump(e, dir) {
    e.preventDefault();
    var i = currentIndex();
    var target = dir < 0
      ? (y() - top(stops[i]) > 8 ? stops[i] : stops[Math.max(0, i - 1)])
      : stops[Math.min(stops.length - 1, i + 1)];
    window.scrollTo({ top: target === hero ? 0 : top(target), behavior: reduceMotion ? "auto" : "smooth" });
  }
  navUp.addEventListener("click", function (e) { jump(e, -1); });
  navDown.addEventListener("click", function (e) { jump(e, 1); });

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  render();

  /* ---------- footer year ---------- */
  var year = document.getElementById("year");
  if (year) { year.textContent = String(new Date().getFullYear()); }
})();
