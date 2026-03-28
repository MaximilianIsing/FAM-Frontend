(function () {
  const landing = document.getElementById("landing");
  if (!landing) return;

  const headline = document.getElementById("landing-headline");
  const connectBtn = document.getElementById("landing-connect");
  const finalText = "Welcome to First Amendment Models";
  const firstStart = finalText.indexOf("First");
  const firstEnd = firstStart + "First".length;
  const amendmentStart = finalText.indexOf("Amendment");
  const amendmentEnd = finalText.length;
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+-";

  /** Stacked headline + full-width line only under the mobile CSS breakpoint. */
  function isMobileLandingViewport() {
    return (
      typeof window.matchMedia !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches
    );
  }

  /** Mobile only: line breaks (0-based indices into `finalText`). */
  const HEADLINE_BREAK_AFTER_INDEX = new Set([9, 15, 25]);
  /** Mobile only: spaces hidden so `<br />` doesn’t leave a gap on the next row. */
  const HEADLINE_HIDE_SPACE_INDEX = new Set([10, 16, 26]);

  function escapeHtmlChar(ch) {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return ch;
  }

  /** Regular space collapses to 0 width inside inline-block; NBSP preserves word gaps. */
  function spaceCharHtml() {
    return "\u00A0";
  }

  function headlineTextMatchesFinal() {
    if (!headline) return false;
    return headline.textContent.replace(/\u00A0/g, " ") === finalText;
  }

  function easeOutCubic(x) {
    const u = Math.min(1, Math.max(0, x));
    return 1 - Math.pow(1 - u, 3);
  }

  /**
   * p only reaches 1 at the end of the wave; a "gap" in p (e.g. 0.72→0.95) is ~tens of ms
   * in real time — useless. Decrypt uses wall-clock ms after each letter's lift finishes.
   */
  const HEADLINE_LIFT_DONE = 0.72;
  /** How long each glyph stays random after it has fully risen (milliseconds). */
  const HEADLINE_DECRYPT_LAG_MS = 220;
  /** Min time between scramble glyph changes (avoids every-frame flicker). */
  const HEADLINE_SCRAMBLE_HOLD_MS = 35;

  function scrambleCharAt(i, elapsedMs) {
    const tick = Math.floor(elapsedMs / HEADLINE_SCRAMBLE_HOLD_MS);
    const h = (i * 2654435761 + tick * 1597334677) >>> 0;
    return charset[h % charset.length];
  }

  function msWhenLiftDone(i, n, durationMs) {
    const t = (2 * HEADLINE_LIFT_DONE + i * 0.55) / n;
    const tClamped = Math.min(1, Math.max(0, t));
    return tClamped * durationMs;
  }

  /** Wall time when every glyph matches `renderHeadlineHtml` “revealed” (no extra tail at full duration). */
  function msWhenAllCharsRevealed(n, durationMs) {
    let maxMs = 0;
    for (let i = 0; i < n; i++) {
      maxMs = Math.max(
        maxMs,
        msWhenLiftDone(i, n, durationMs) + HEADLINE_DECRYPT_LAG_MS
      );
    }
    return maxMs;
  }

  function renderHeadlineHtml(t, elapsedMs, durationMs, exitPhase) {
    const n = finalText.length;
    const exit = exitPhase === true;
    /** Re-encrypt timeline 0→1: multiply glyph opacity — line fades to black over the full duration. */
    const exitFadeMul = exit
      ? Math.min(1, Math.max(0, 1 - elapsedMs / (durationMs * 0.6)))
      : 1;
    let html = "";
    for (let i = 0; i < n; i++) {
      const c = finalText[i];
      const p = Math.max(0, Math.min(1, (t * n - i * 0.55) / 2));
      const liftDoneMs = msWhenLiftDone(i, n, durationMs);
      const revealed = exit
        ? p >= 1
        : t >= 1 || elapsedMs >= liftDoneMs + HEADLINE_DECRYPT_LAG_MS;
      const liftProgress = Math.min(1, p / HEADLINE_LIFT_DONE);
      const vis = easeOutCubic(liftProgress);
      const yPct = (1 - vis) * 100;
      const opacity = revealed ? 1 : p >= HEADLINE_LIFT_DONE ? 1 : vis;
      const opacityOut = opacity * exitFadeMul;

      let cls = "landing__title-char landing__title-char--lift";
      let inner;
      if (revealed) {
        inner = c === " " ? spaceCharHtml() : escapeHtmlChar(c);
        if (i >= firstStart && i < firstEnd) {
          const k = i - firstStart;
          cls +=
            k % 2 === 0
              ? " landing__title-char--first-blue"
              : " landing__title-char--first-white";
        } else if (i >= amendmentStart && i < amendmentEnd) {
          const k = i - amendmentStart;
          cls +=
            k % 2 === 0
              ? " landing__title-char--amd-red"
              : " landing__title-char--amd-white";
        } else {
          cls += " landing__title-char--plain";
        }
      } else {
        inner =
          c === " "
            ? spaceCharHtml()
            : escapeHtmlChar(scrambleCharAt(i, elapsedMs));
        cls += c === " " ? " landing__title-char--plain" : " landing__title-char--pending";
      }

      const mobile = isMobileLandingViewport();
      const hideSpace =
        mobile && c === " " && HEADLINE_HIDE_SPACE_INDEX.has(i);
      const slotClass =
        "landing__title-char-slot" +
        (hideSpace ? " landing__title-char-slot--hidden-space" : "");

      html +=
        '<span class="' +
        slotClass +
        '">' +
        '<span class="' +
        cls +
        '" style="transform:translateY(' +
        yPct +
        "%);opacity:" +
        opacityOut +
        '">' +
        inner +
        "</span></span>";
      if (mobile && HEADLINE_BREAK_AFTER_INDEX.has(i)) {
        html += "<br />";
      }
    }
    return html;
  }

  function setLandingLineWidth() {
    const line = document.querySelector(".landing__line");
    const content = document.querySelector(".landing__content");
    if (!line || !content) return;
    if (isMobileLandingViewport()) {
      line.style.setProperty("--landing-line-width", "100%");
      return;
    }
    /* PC (pre–mobile commit): full headline width — one horizontal line, no per-word cap. */
    const cw = content.clientWidth;
    let w = 0;
    const headlineFinal =
      headline && headlineTextMatchesFinal() && headline.scrollWidth > 0;
    if (headlineFinal) {
      w = headline.scrollWidth;
    } else {
      const measure = document.createElement("span");
      measure.className = "landing__title";
      measure.setAttribute("aria-hidden", "true");
      measure.textContent = finalText;
      measure.style.cssText =
        "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;pointer-events:none;";
      document.body.appendChild(measure);
      w = measure.offsetWidth;
      measure.remove();
    }
    const lineW = Math.min(w, cw);
    line.style.setProperty("--landing-line-width", lineW + "px");
  }

  function transitionToTerminal() {
    landing.classList.add("landing--exit");
    window.setTimeout(function () {
      landing.setAttribute("hidden", "");
      landing.style.display = "none";
      const shell = document.getElementById("fam-terminal");
      if (shell) {
        shell.classList.remove("fam-terminal--hidden");
        shell.removeAttribute("hidden");
      }
      document.documentElement.classList.add("terminal-phase");
      document.body.classList.add("terminal-phase");
      window.dispatchEvent(new Event("fam-landing-done"));
    }, 420);
  }

  function runDecrypt(durationMs) {
    return new Promise(function (resolve) {
      const start = performance.now();
      const n = finalText.length;
      const decryptDoneMs = Math.min(
        durationMs,
        msWhenAllCharsRevealed(n, durationMs)
      );
      function frame() {
        const elapsed = performance.now() - start;
        const t = Math.min(1, elapsed / durationMs);
        headline.innerHTML = renderHeadlineHtml(t, elapsed, durationMs, false);
        if (elapsed >= decryptDoneMs) {
          headline.innerHTML = renderHeadlineHtml(1, durationMs, durationMs, false);
          resolve();
          return;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  const REENCRYPT_MS = 1100;
  /** Black overlay starts this many ms after Connect; finishes before re-encrypt ends. */
  const LANDING_BG_FADE_START_MS = 0;
  const LANDING_BG_FADE_DURATION_MS = 1150;
  /**
   * Linear t = 1 - u keeps the decrypt wave fully “revealed” until ~40% of the timeline, so nothing moves.
   * Steep ease makes t drop fast at the start so glyphs scramble almost as soon as Connect is pressed.
   */
  const REENCRYPT_T_CURVE = 4;

  function reencryptTFromProgress(u) {
    const x = Math.min(1, Math.max(0, u));
    return Math.pow(1 - x, REENCRYPT_T_CURVE);
  }

  /** Dither app uses React state + range (same as slider); parent ramps via postMessage (fam-pixel-size). */
  const DITHER_PIXEL_START = 2;
  const DITHER_PIXEL_END = 16;
  /** Shorter than re-encrypt so pixels climb quickly (3→24 across this window). */
  const DITHER_PIXEL_RAMP_MS = 800;

  function runDitherPixelRamp(rampMs) {
    return new Promise(function (resolve) {
      const iframe = document.querySelector(".landing__dither");
      if (!iframe) {
        resolve();
        return;
      }
      const steps = DITHER_PIXEL_END - DITHER_PIXEL_START;
      const stepMs = rampMs / steps;
      const win = iframe.contentWindow;
      if (!win) {
        setTimeout(resolve, rampMs);
        return;
      }
      for (let p = DITHER_PIXEL_START + 1; p <= DITHER_PIXEL_END; p++) {
        const delay = (p - (DITHER_PIXEL_START + 1)) * stepMs;
        setTimeout(function () {
          win.postMessage({ type: "fam-pixel-size", value: p }, "*");
        }, delay);
      }
      setTimeout(resolve, rampMs);
    });
  }

  function runReencrypt(durationMs) {
    return new Promise(function (resolve) {
      const start = performance.now();
      function paint() {
        const elapsed = performance.now() - start;
        const u = Math.min(1, elapsed / durationMs);
        const t = reencryptTFromProgress(u);
        headline.innerHTML = renderHeadlineHtml(t, elapsed, durationMs, true);
        if (u < 1) {
          requestAnimationFrame(paint);
        } else {
          headline.innerHTML = renderHeadlineHtml(0, durationMs, durationMs, true);
          resolve();
        }
      }
      paint();
    });
  }

  function onResize() {
    setLandingLineWidth();
  }
  window.addEventListener("resize", onResize);

  function refreshHeadlineLayoutIfFinal() {
    if (!headline || !headlineTextMatchesFinal()) return;
    headline.innerHTML = renderHeadlineHtml(1, 3400, 3400, false);
    setLandingLineWidth();
  }
  const mqLandingLayout = window.matchMedia("(max-width: 640px)");
  if (typeof mqLandingLayout.addEventListener === "function") {
    mqLandingLayout.addEventListener("change", refreshHeadlineLayoutIfFinal);
  } else if (typeof mqLandingLayout.addListener === "function") {
    mqLandingLayout.addListener(refreshHeadlineLayoutIfFinal);
  }

  if (connectBtn) {
    connectBtn.addEventListener(
      "click",
      function onConnectClick() {
        connectBtn.removeEventListener("click", onConnectClick);
        connectBtn.classList.add("landing__connect--exiting");
        connectBtn.setAttribute("aria-hidden", "true");
        connectBtn.setAttribute("tabindex", "-1");
        window.setTimeout(function () {
          landing.style.setProperty(
            "--landing-bg-fade-duration",
            LANDING_BG_FADE_DURATION_MS + "ms"
          );
          landing.classList.add("landing--bg-fading");
        }, LANDING_BG_FADE_START_MS);
        Promise.all([
          runReencrypt(REENCRYPT_MS),
          runDitherPixelRamp(DITHER_PIXEL_RAMP_MS),
        ]).then(function () {
          transitionToTerminal();
        });
      }
    );
  }

  document.fonts.ready.then(function () {
    setLandingLineWidth();
    return runDecrypt(3400);
  }).then(function () {
    setLandingLineWidth();
    window.requestAnimationFrame(function () {
      setLandingLineWidth();
    });
    if (!connectBtn) return;
    connectBtn.removeAttribute("aria-hidden");
    connectBtn.classList.add("landing__connect--visible");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      connectBtn.classList.add("landing__connect--entered");
    } else {
      connectBtn.addEventListener("animationend", function onConnectIntroEnd(ev) {
        if (ev.animationName !== "landing-connect-glitch-in") return;
        connectBtn.removeEventListener("animationend", onConnectIntroEnd);
        connectBtn.classList.add("landing__connect--entered");
      });
    }
  });
})();
