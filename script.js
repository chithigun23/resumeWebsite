/*
  Chithi Gunatilake — resume site
  Behaviour: hero z-depth recede, scroll progress HUD, section tracking,
  section-to-section nav, reveal-on-scroll, theme toggle.
*/

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hero = document.getElementById("hero");
  var hudFill = document.getElementById("hudFill");
  var hudPct = document.getElementById("hudPct");
  var hudSec = document.getElementById("hudSec");
  var navUp = document.getElementById("navUp");
  var navDown = document.getElementById("navDown");
  var sections = Array.prototype.slice.call(document.querySelectorAll(".section"));

  var vh = window.innerHeight;
  var ticking = false;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function scrollY() { return window.scrollY || window.pageYOffset || 0; }

  /* document-relative top. offsetTop is relative to .deck (a positioned parent),
     so it would omit the 100vh the hero occupies. */
  function absTop(el) { return Math.round(el.getBoundingClientRect().top + scrollY()); }

  /* ---------- the z-depth move: the hero recedes as the deck rises over it ---------- */
  function renderHero() {
    if (reduceMotion) { return; }
    var p = clamp01(scrollY() / vh);
    hero.style.transform = "scale(" + (1 - 0.1 * p) + ")";
    hero.style.opacity = String(1 - 0.6 * p);
    /* once fully covered, drop it out of the compositor and the a11y tree */
    hero.style.visibility = p >= 0.999 ? "hidden" : "visible";
  }

  /* ---------- HUD progress ---------- */
  function renderProgress() {
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - window.innerHeight);
    var p = clamp01(scrollY() / max);

    hudFill.style.width = (p * 100) + "%";
    hudPct.textContent = String(Math.round(p * 100)).padStart(3, "0") + "%";
    navUp.disabled = scrollY() <= 1;
    navDown.disabled = p >= 0.999;
  }

  /* ---------- which section are we in ---------- */
  function renderSectionLabel() {
    var y = scrollY();
    var mid = y + window.innerHeight * 0.4;
    var label = "00 / Index";

    for (var i = 0; i < sections.length; i++) {
      if (absTop(sections[i]) <= mid) {
        label = sections[i].getAttribute("data-label") || label;
      }
    }
    if (y < vh * 0.5) { label = "00 / Index"; }

    if (hudSec.textContent !== label) { hudSec.textContent = label; }
  }

  function onFrame() {
    renderHero();
    renderProgress();
    renderSectionLabel();
    ticking = false;
  }

  function requestRender() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onFrame);
    }
  }

  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", function () { vh = window.innerHeight; requestRender(); });
  requestRender();

  /* ---------- HUD section nav ---------- */
  function stops() {
    /* the hero counts as stop 0, then every section */
    var list = [0];
    sections.forEach(function (s) { list.push(absTop(s)); });
    return list;
  }

  function goTo(top) {
    window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
  }

  navDown.addEventListener("click", function () {
    var y = scrollY();
    var list = stops();
    for (var i = 0; i < list.length; i++) {
      if (list[i] > y + 4) { goTo(list[i]); return; }
    }
    goTo(document.documentElement.scrollHeight);
  });

  navUp.addEventListener("click", function () {
    var y = scrollY();
    var list = stops();
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] < y - 4) { goTo(list[i]); return; }
    }
    goTo(0);
  });

  /* ---------- reveal on scroll ---------- */
  var revealables = Array.prototype.slice.call(document.querySelectorAll(".rv"));

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- theme toggle ---------- */
  var themeBtn = document.getElementById("themeBtn");
  var themeIcon = document.getElementById("themeIcon").querySelector("use");
  var root = document.documentElement;

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

  /* ---------- footer year ---------- */
  var year = document.getElementById("year");
  if (year) { year.textContent = String(new Date().getFullYear()); }
})();
