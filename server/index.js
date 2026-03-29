"use strict";

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const app = express();

/** So `req.ip` is the real client behind Render / other reverse proxies. */
if (process.env.RENDER === "true" || process.env.NODE_ENV === "production") {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  app.set("trust proxy", Number.isFinite(hops) && hops >= 0 ? hops : 1);
}
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "..");

/**
 * Upstream Final-chat FastAPI (api_server.py).
 * MODEL_API_URL — e.g. http://127.0.0.1:8765 (no trailing slash). Env overrides `api_url.txt`.
 * MODEL_API_KEY — same secret as Python API_KEY (Bearer + X-API-Key). Env overrides `api_key.txt`.
 */
function loadModelApiUrl() {
  const fromEnv = (process.env.MODEL_API_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const filePath = path.join(ROOT, "api_url.txt");
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const line = (raw.split(/\r?\n/)[0] ?? "").trim();
    return line.replace(/\/$/, "");
  } catch {
    return "";
  }
}

const MODEL_API_URL = loadModelApiUrl();

function loadModelApiKey() {
  const fromEnv = (process.env.MODEL_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  const filePath = path.join(ROOT, "api_key.txt");
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const line = raw.split(/\r?\n/)[0];
    return (line != null ? line : "").trim();
  } catch {
    return "";
  }
}

const MODEL_API_KEY = loadModelApiKey();

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

function modelConfigured() {
  return Boolean(MODEL_API_URL);
}

function modelHeaders() {
  const h = { "Content-Type": "application/json" };
  if (MODEL_API_KEY) {
    h.Authorization = `Bearer ${MODEL_API_KEY}`;
    h["X-API-Key"] = MODEL_API_KEY;
  }
  return h;
}

/**
 * @param {string} pathSuffix e.g. "/v1/health"
 * @param {RequestInit} [init]
 */
async function fetchModel(pathSuffix, init = {}) {
  const url = `${MODEL_API_URL}${pathSuffix}`;
  const headers = { ...modelHeaders(), ...init.headers };
  return fetch(url, { ...init, headers });
}

/**
 * Map browser { message, messages } → FastAPI ChatRequest (prior history + current message).
 * @param {Record<string, unknown>} body
 */
function buildUpstreamChatBody(body) {
  const rawMsg = body.message;
  if (typeof rawMsg !== "string" || !rawMsg.trim()) {
    const err = new Error("Expected JSON body with non-empty string `message`");
    err.statusCode = 400;
    throw err;
  }
  let currentMessage = rawMsg.trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];

  let history = [];
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (
      last &&
      last.role === "user" &&
      typeof last.content === "string"
    ) {
      currentMessage = last.content.trim();
      for (let i = 0; i < messages.length - 1; i++) {
        const m = messages[i];
        if (
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        ) {
          history.push({ role: m.role, content: m.content });
        }
      }
    } else {
      for (const m of messages) {
        if (
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        ) {
          history.push({ role: m.role, content: m.content });
        }
      }
    }
  }

  let sessionId =
    typeof body.session_id === "string" && body.session_id.trim()
      ? body.session_id.trim().slice(0, 128)
      : "fam-default";

  const payload = {
    message: currentMessage,
    session_id: sessionId,
    history,
  };

  if (typeof body.temperature === "number" && !Number.isNaN(body.temperature)) {
    payload.temperature = body.temperature;
  }
  if (typeof body.max_new_tokens === "number" && body.max_new_tokens >= 1) {
    payload.max_new_tokens = body.max_new_tokens;
  }

  return payload;
}

/** Dither background (Vite build): /dist/index.html + hashed files under /assets/ */
app.use(
  "/assets",
  express.static(path.join(ROOT, "dist", "assets"), { index: false })
);
app.use(
  "/dist",
  express.static(path.join(ROOT, "dist"), { index: "index.html" })
);

/** Media assets (logo, fonts, etc.): GET /media/... */
app.use(
  "/media",
  express.static(path.join(ROOT, "media"), {
    index: false,
    fallthrough: true,
  })
);

/** Web UI: index.html, app.js, styles.css */
app.use(express.static(ROOT, { index: "index.html" }));

/**
 * /health calls the upstream model — cap per IP so it can’t be abused as a DoS amplifier.
 * Override: HEALTH_RATE_LIMIT_WINDOW_MS, HEALTH_RATE_LIMIT_MAX.
 */
const healthLimiter = rateLimit({
  windowMs: Math.max(60_000, Number(process.env.HEALTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000),
  limit: Math.max(5, Number(process.env.HEALTH_RATE_LIMIT_MAX) || 120),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many health checks from this address. Please wait before retrying.",
  },
});

/** Health: local proxy + upstream model (GET /v1/health or /health on FastAPI). */
app.get("/health", healthLimiter, async (req, res) => {
  const base = {
    ok: true,
    service: "fam-agent",
    model_configured: modelConfigured(),
  };
  if (!modelConfigured()) {
    return res.json({
      ...base,
      detail: "Set MODEL_API_URL (and MODEL_API_KEY if the API uses one).",
    });
  }
  try {
    let upstream = await fetchModel("/v1/health");
    if (!upstream.ok) {
      upstream = await fetchModel("/health");
    }
    const text = await upstream.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return res.status(upstream.ok ? 200 : upstream.status).json({
      ...base,
      upstream_ok: upstream.ok,
      upstream_status: upstream.status,
      ...(parsed && typeof parsed === "object" ? parsed : { upstream_body: text.slice(0, 500) }),
    });
  } catch (e) {
    return res.status(503).json({
      ...base,
      ok: false,
      upstream_error: String(e.message || e),
    });
  }
});

/**
 * Soft per-IP cap on /api/* (chat, stream, abort, ping).
 * Defaults are intentionally loose — safety net, not a product limit.
 * Override: RATE_LIMIT_WINDOW_MS (ms), RATE_LIMIT_MAX (requests per window per IP).
 */
const apiLimiter = rateLimit({
  windowMs: Math.max(60_000, Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000),
  limit: Math.max(10, Number(process.env.RATE_LIMIT_MAX) || 800),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests from this address. Please wait a few minutes.",
  },
});
app.use("/api", apiLimiter);

/** Same-origin RTT probe for the UI; does not call the upstream model (still /api — uses apiLimiter). */
app.get("/api/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

/** Non-streaming chat → POST /v1/chat */
app.post("/api/chat", async (req, res) => {
  if (!modelConfigured()) {
    return res.status(503).json({
      error: "Model API not configured",
      detail: "Set MODEL_API_URL on the server.",
    });
  }
  let payload;
  try {
    payload = buildUpstreamChatBody(req.body || {});
  } catch (e) {
    const code = e.statusCode || 400;
    return res.status(code).json({ error: e.message });
  }
  try {
    const upstream = await fetchModel("/v1/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "Upstream request failed", detail: String(e.message || e) });
  }
});

/** SSE word stream → POST /v1/chat/stream (pass-through; no buffering). */
app.post("/api/chat/stream", async (req, res) => {
  if (!modelConfigured()) {
    return res.status(503).json({
      error: "Model API not configured",
      detail: "Set MODEL_API_URL on the server.",
    });
  }
  let payload;
  try {
    payload = buildUpstreamChatBody(req.body || {});
  } catch (e) {
    const code = e.statusCode || 400;
    return res.status(code).json({ error: e.message });
  }
  try {
    const upstream = await fetchModel("/v1/chat/stream", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return res.send(text);
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: "Upstream stream failed", detail: String(e.message || e) });
    }
  }
});

/** Cooperative abort → POST /v1/chat/abort */
app.post("/api/chat/abort", async (req, res) => {
  if (!modelConfigured()) {
    return res.status(503).json({ error: "Model API not configured" });
  }
  try {
    const upstream = await fetchModel("/v1/chat/abort", { method: "POST" });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "Upstream abort failed", detail: String(e.message || e) });
  }
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.listen(PORT, () => {
  console.log(`FAM agent — http://localhost:${PORT}`);
  if (modelConfigured()) {
    const urlSrc = (process.env.MODEL_API_URL || "").trim()
      ? "MODEL_API_URL"
      : "api_url.txt";
    console.log(`  Model API: ${MODEL_API_URL} (from ${urlSrc})`);
  } else {
    console.log(
      "  Model API: (not set — set MODEL_API_URL or create api_url.txt)"
    );
  }
  if (MODEL_API_KEY) {
    const keySrc = (process.env.MODEL_API_KEY || "").trim()
      ? "MODEL_API_KEY"
      : "api_key.txt";
    console.log(`  Model API key: from ${keySrc}`);
  }
});
