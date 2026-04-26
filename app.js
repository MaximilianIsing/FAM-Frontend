(function () {
  "use strict";

  const STORAGE_SESSIONS = "fam_sessions_v1";
  const STORAGE_MEMORY = "fam_memory_v1";
  const STORAGE_SETTINGS = "fam_settings_v1";
  const STORAGE_DISPLAY_NAME = "fam_display_name_v1";
  const STORAGE_UI_MODE = "fam_ui_mode_v1";
  /** Stable id for the Python API `session_id` (server-side cache; we always send `history`). */
  const STORAGE_BACKEND_SESSION = "fam_backend_session_v1";

  const MAX_SESSION_NAME = 40;
  const MAX_DISPLAY_NAME = 20;
  const MAX_STORED_SESSIONS = 20;
  const MAX_MEMORIES = 20;
  const MAX_MEMORY_LEN = 200;

  /** Shown on first visit only, before the welcome line and logo. */
  const BOOT_FIRST_AMENDMENT_QUOTE =
    "\"Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof; or abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble, and to petition the Government for a redress of grievances.\"";

  /** First-visit welcome (typed with corner logo); plain white via `.line--welcome-white`. */
  const BOOT_WELCOME_FAM_TEXT = "Welcome to First Amendment Models.";

  /** Shown immediately after welcome / welcome-back (monospace via `.line--ascii-banner`). */
  const BOOT_ASCII_BANNER = [
    " ███████████      █████████      ██████   ██████   ",
    "░░███░░░░░░█     ███░░░░░███    ░░██████ ██████    ",
    " ░███   █ ░     ░███    ░███     ░███░█████░███    ",
    " ░███████       ░███████████     ░███░░███ ░███    ",
    " ░███░░░█       ░███░░░░░███     ░███ ░░░  ░███    ",
    " ░███  ░        ░███    ░███     ░███      ░███    ",
    " █████       ██ █████   █████ ██ █████     █████ ██",
    "░░░░░       ░░ ░░░░░   ░░░░░ ░░ ░░░░░     ░░░░░ ░░ ",
  ].join("\n");

  /** Shown right after the welcome line on first visit. */
  const BOOT_CONNECTION_NOTICE = [
    "You are connected to the flagship uncensored and untracked model.",
    "All sessions are processed locally on your device and relayed through encrypted channels. NOTHING is logged or stored. You're totally invisible and unrestricted.",
  ].join("\n");

  /**
   * Same origin when using `npm start` (server on :3000). Override if UI is hosted elsewhere.
   * @type {{ baseUrl: string }}
   */
  const CONFIG = {
    baseUrl: "",
  };

  function getBackendSessionId() {
    try {
      let id = localStorage.getItem(STORAGE_BACKEND_SESSION);
      if (!id || !id.trim()) {
        id =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `fam-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(STORAGE_BACKEND_SESSION, id);
      }
      return id.trim().slice(0, 128);
    } catch {
      return "fam-client";
    }
  }

  /** Shown by /donate (Ethereum mainnet or your network of choice — verify before sending). */
  const DONATE_ETH_ADDRESS = "0x0ad71CEf14201B7fC7de53Ff2b4d40B9a96C2813";

  /** Gutter label for assistant lines (same escaping style as user `FAM\\You&gt;`). */
  const ASSISTANT_LABEL_HTML = '<span class="label">FAM\\Response&gt;</span>';

  const HELP = {
    help: "Usage: /help or /help {command} — list commands or full explanation + example.",
    this: "/this — Show the name of the current session (if any).",
    sessions: "/sessions — List all stored session names.",
    rename: "/rename {old} {new} — Rename a stored session (40 char max each).",
    drop: "/drop {session} — Delete one stored session.",
    dropall: "/dropall — Delete every stored session.",
    store: "/store {name} — Save the current chat into a named session (only if not already in a session). Max 20 sessions.",
    save: "/save — Update the stored session with the latest messages.",
    restore: "/restore {name} — Load a session (asks Y/N if you have unsaved changes).",
    new: "/new [name] — Start a fresh context; optional name binds an empty session (max 20 stored sessions).",
    replay: "/replay — Print the last assistant reply in this context.",
    history:
      "/history — List each exchange (your message + model reply) in the current context.",
    clear: "/clear — Clear chat history. Simple mode: starts a fresh thread (no sessions). Advanced: clears the current context transcript.",
    cls: "/cls — Clear the terminal display only (does not change chat context or sessions).",
    memory: "/memory — List all permanent memories (mem0 …).",
    remember: "/remember {text} — Add a memory (max 20 × 200 chars).",
    forget: "/forget {memN} — Remove one memory by index.",
    forgetall: "/forgetall — Clear all memories.",
    temperature:
      "/temperature {0–1} — Set sampling temperature for the model (default 0.3; stored in settings).",
    disablewarnings: "/disablewarnings — Skip Y/N confirmation prompts.",
    enablewarnings: "/enablewarnings — Turn confirmation prompts back on.",
    status: "/status — Ping the backend health endpoint.",
    ping: "/ping — Measure round-trip to this site’s server (ms); updates the clock row in the corner.",
    whoami: "/whoami — Show your chosen name and public IP (via external lookup).",
    toadvanced:
      "/toadvanced — Switch to advanced mode (full commands, sessions, memory, and settings).",
    tosimple:
      "/tosimple — Leave advanced mode; simple mode keeps /help, /clear, /cls, /status, /ping, /whoami, /toadvanced, /mode, /mission, /donate (no sessions or /new).",
    mode: "/mode — Show whether you’re in simple or advanced mode.",
    mission:
      "/mission — Short note on why First Amendment Models exists (author’s words).",
    donate: "/donate — Ethereum address if you’d like to support this project.",
  };

  /** Display order + legend labels for /help grouping. */
  const HELP_CATEGORY_ORDER = [
    { id: "general", label: "General", legend: "Gen" },
    { id: "sessions", label: "Sessions", legend: "Ses" },
    { id: "chat", label: "Chat & transcript", legend: "Chat" },
    { id: "memory", label: "Memory", legend: "Mem" },
    { id: "model", label: "Model & safety", legend: "Mod" },
    { id: "system", label: "System", legend: "Sys" },
    { id: "ui", label: "UI mode", legend: "UI" },
    { id: "about", label: "About", legend: "Abt" },
  ];

  /** @type {Record<string, string>} command key → HELP_CATEGORY_ORDER id */
  const HELP_COMMAND_CATEGORY = {
    help: "general",
    mode: "general",
    this: "sessions",
    sessions: "sessions",
    rename: "sessions",
    drop: "sessions",
    dropall: "sessions",
    store: "sessions",
    save: "sessions",
    restore: "sessions",
    new: "sessions",
    replay: "chat",
    history: "chat",
    clear: "chat",
    cls: "chat",
    memory: "memory",
    remember: "memory",
    forget: "memory",
    forgetall: "memory",
    temperature: "model",
    disablewarnings: "model",
    enablewarnings: "model",
    status: "system",
    ping: "system",
    whoami: "system",
    toadvanced: "ui",
    tosimple: "ui",
    mission: "about",
    donate: "about",
  };

  /**
   * Long-form copy for `/help {command}`: several short paragraphs plus an example block.
   * @type {Record<string, { paragraphs: string[]; example?: string }>}
   */
  const HELP_DETAIL = {
    help: {
      paragraphs: [
        "Without arguments, /help prints every command available in your current mode (simple vs advanced), grouped by category with a color key at the top.",
        "With a command name, /help shows this expanded view: what the command is for, edge cases, and a copy-paste-style example.",
        "While the model is generating a reply, Ctrl+C stops the request and tells the backend to abort; text already shown in the transcript is kept.",
      ],
      example: "/help\n/help restore",
    },
    this: {
      paragraphs: [
        "Shows which named session your current context is bound to, if any.",
        "If you started /new without a name, or you’re only chatting in simple mode, you’ll see that there is no session name — the model context still works; it just isn’t saved under a label yet.",
      ],
      example: "/this",
    },
    sessions: {
      paragraphs: [
        "Lists every session name stored in your browser (localStorage). Each name is a saved snapshot you can /restore later.",
        "Empty list means you haven’t /store’d anything yet, or you cleared them with /drop or /dropall.",
      ],
      example: "/sessions",
    },
    rename: {
      paragraphs: [
        "Renames a stored session without loading it. Both names must be at most 40 characters and can’t be empty.",
        "If the old name doesn’t exist, or the new name is already taken, you’ll get an error and nothing changes.",
      ],
      example: "/rename work-notes project-alpha",
    },
    drop: {
      paragraphs: [
        "Deletes one saved session by name from storage. It does not touch your current on-screen context unless that context was the same name (your live messages stay until you /clear or /new).",
        "Use this to prune mistakes or old saves; there is no undo beyond restoring from another backup if you have one.",
      ],
      example: "/drop old-chat",
    },
    dropall: {
      paragraphs: [
        "Wipes every stored session name and its saved messages from the browser. Your current terminal transcript is not automatically cleared — only the named saves disappear.",
        "Use when you want a clean slate of saves; you’ll be asked to confirm if confirmations are enabled.",
      ],
      example: "/dropall",
    },
    store: {
      paragraphs: [
        "Saves the current conversation into a new session name. Only works when you’re not already inside a named session (use /save to update an existing binding).",
        "You can keep up to 20 sessions; names are max 40 characters. After storing, /this should show the name you picked.",
      ],
      example: "/store thesis-ideas",
    },
    save: {
      paragraphs: [
        "Overwrites the stored copy of the session you’re currently in with the latest messages from the screen.",
        "If you have no active session name, /save can’t run — /store a name first or /restore one.",
      ],
      example: "/save",
    },
    restore: {
      paragraphs: [
        "Loads a saved session into the current context, replacing what you had in memory. If you have unsaved changes, you may see a Y/N prompt (unless /disablewarnings).",
        "After restore, chat continues in that session; use /save to persist new turns.",
      ],
      example: "/restore thesis-ideas",
    },
    new: {
      paragraphs: [
        "Starts a fresh model context (blank history). Optionally pass a session name to create and bind a new empty saved slot at the same time (still subject to the 20-session cap).",
        "You’ll be warned before discarding unsaved work if warnings are on. In simple mode this command is disabled — use /clear for a fresh thread instead.",
      ],
      example: "/new\n/new weekend-project",
    },
    replay: {
      paragraphs: [
        "Prints the last assistant message from the current context again, as if it were newly output. Handy when long output scrolled away or you want to copy it.",
        "Requires an active context with at least one assistant reply; run /new and exchange a message first if needed.",
      ],
      example: "/replay",
    },
    history: {
      paragraphs: [
        "Prints the thread as exchanges: each block is your line and the model’s reply together (not isolated messages). The header counts exchanges (roughly half the raw message count when every turn is a pair).",
        "If you sent a message and the model hasn’t replied yet, that line appears alone under a pending note. Output can be very long.",
      ],
      example: "/history",
    },
    clear: {
      paragraphs: [
        "Advanced: clears the in-memory transcript and session state for the current context (you’ll typically /new again after). Simple: clears the thread and starts fresh in place — there is no separate /new.",
        "If there’s nothing to clear (advanced: no /new yet; simple: no messages in the thread), you’ll get a short system notice instead of a success line.",
        "This affects what the model remembers going forward; it is stronger than /cls, which only wipes the display.",
      ],
      example: "/clear",
    },
    cls: {
      paragraphs: [
        "Clears the visible terminal output only. Under the hood, your context, session binding, and stored saves are untouched.",
        "Use when the screen is cluttered but you want to keep the same conversation going.",
      ],
      example: "/cls",
    },
    memory: {
      paragraphs: [
        "Lists permanent memories (mem0, mem1, …) that are injected into the model context so it can reuse facts you asked to remember.",
        "Cap is 20 memories × 200 characters each. Empty list means nothing is stored yet.",
      ],
      example: "/memory",
    },
    remember: {
      paragraphs: [
        "Appends a new memory line from the text after the command. Memories persist in localStorage until /forget or /forgetall.",
        "Phrase them as short facts you want the model to see on future turns (project names, preferences, constraints).",
      ],
      example: '/remember User prefers UK spelling.\n/remember Project codename is "Nebula".',
    },
    forget: {
      paragraphs: [
        "Removes one memory by its index as shown in /memory (e.g. mem2 → /forget mem2). The list renumbers after a delete.",
        "Typo or out-of-range index yields an error; nothing is removed.",
      ],
      example: "/forget mem0",
    },
    forgetall: {
      paragraphs: [
        "Deletes every stored memory at once. Does not clear chat history or sessions — only the mem0… list.",
        "May ask for confirmation if warnings are enabled.",
      ],
      example: "/forgetall",
    },
    temperature: {
      paragraphs: [
        "Sets sampling temperature for the backend (0–1). Default is 0.3 until you change it; lower values tend to be more deterministic, higher values more varied.",
        "The value is saved in your local settings and applies to new model requests after you set it.",
      ],
      example: "/temperature 0.3\n/temperature 0.9",
    },
    disablewarnings: {
      paragraphs: [
        "Turns off Y/N confirmation prompts for destructive or state-changing actions (e.g. discarding unsaved context).",
        "You can turn confirmations back on anytime with /enablewarnings.",
      ],
      example: "/disablewarnings",
    },
    enablewarnings: {
      paragraphs: [
        "Restores Y/N prompts so the terminal asks before operations that could lose work.",
        "Pair with /disablewarnings when you trust your workflow and want fewer interruptions.",
      ],
      example: "/enablewarnings",
    },
    status: {
      paragraphs: [
        "Calls the app’s health endpoint on the configured server to see if the backend is reachable. Useful when replies fail or time out.",
        "Requires network access to your API base URL (same origin by default when using npm start).",
      ],
      example: "/status",
    },
    ping: {
      paragraphs: [
        "Sends a tiny request to this app’s server and reports round-trip time in milliseconds. On desktop, the same value appears under the corner logo next to your local clock.",
        "The first measurement runs when the terminal loads; run /ping anytime to refresh after network changes.",
      ],
      example: "/ping",
    },
    whoami: {
      paragraphs: [
        "Shows the display name you chose at first connect and attempts a public IP lookup via an external service (ipify) for quick diagnostics.",
        "IP lookup is best-effort; firewalls or blockers may cause it to fail without affecting chat.",
      ],
      example: "/whoami",
    },
    toadvanced: {
      paragraphs: [
        "Switches from simple mode to advanced mode: /new, sessions, /remember, /history, and the full command set become available.",
        "Your mode choice is remembered in the browser. You’ll get a short primer on how advanced mode maps to slash commands.",
      ],
      example: "/toadvanced",
    },
    tosimple: {
      paragraphs: [
        "Switches to simple mode: one continuous chat thread, /clear for reset, no /new or session saves. Keeps /help, /cls, /status, /ping, /whoami, /mission, /donate, /mode, /toadvanced.",
        "Use when you don’t need named sessions or the heavier toolkit.",
      ],
      example: "/tosimple",
    },
    mode: {
      paragraphs: [
        "Prints whether you’re in simple or advanced mode (or still choosing on first run).",
        "Does not change mode by itself — use /toadvanced or /tosimple for that.",
      ],
      example: "/mode",
    },
    mission: {
      paragraphs: [
        "Prints the author’s longer mission statement: corporate AI, data and control, the “invisible machine” of defaults and restrictions, and why FAM aims for a readable, user-owned alternative.",
        "Same text as running /mission alone; /help mission is the manual entry for that command.",
      ],
      example: "/mission",
    },
    donate: {
      paragraphs: [
        "Shows the project’s Ethereum donation address and a short safety note. Always verify the address in your wallet before sending.",
        "Same output as /donate; crypto transfers are irreversible.",
      ],
      example: "/donate",
    },
  };

  /** Simple: always-on chat, no /new or sessions. */
  const SIMPLE_SLASH_COMMANDS = new Set([
    "help",
    "clear",
    "cls",
    "status",
    "whoami",
    "ping",
    "toadvanced",
    "mode",
    "mission",
    "donate",
  ]);

  /** @type {Array<{role: 'user'|'assistant', content: string}>} */
  let messages = [];
  let hasContext = false;
  /** @type {string|null} */
  let currentSessionName = null;
  let lastSavedJSON = "[]";
  let temperature = 0.3;
  let warningsEnabled = true;
  /** @type {AbortController|null} */
  let genAbort = null;
  let generating = false;
  /** `setInterval` for desktop `.fam-corner-meta` local clock ([HH:MM:SS]). */
  let cornerMetaClockId = 0;
  /** Active typewriter animations (system / assistant / error / success lines). */
  let transcriptTypingDepth = 0;
  /** Running `typeStringIntoElement` handles — Ctrl+C calls each `.skip()`. */
  const activeTypewriters = new Set();
  /**
   * While SSE char-typewriter lags, tab-back calls this to paint `streamTextFromModel`.
   * Set only during `simulateAIResponse`; cleared in `finally`.
   * @type {null | (() => void)}
   */
  let streamTabFlush = null;
  let tabFocusFlushListenerAdded = false;

  /** @type {null | { type: string, data: Record<string, unknown> }} */
  let pendingConfirm = null;
  /** First visit: waiting for display name before normal chat. */
  let awaitingDisplayName = false;
  /** First visit: after name, waiting for simple vs advanced. */
  let awaitingModeChoice = false;

  const el = {
    output: document.getElementById("output"),
    outputScroll: document.getElementById("terminal-scroll"),
    terminalScrollWrap: document.getElementById("terminal-scroll-wrap"),
    terminalVscrollbar: document.getElementById("terminal-vscrollbar"),
    terminalVscrollbarThumb: document.getElementById("terminal-vscrollbar-thumb"),
    terminalVscrollbarTrack: document.getElementById("terminal-vscrollbar-track"),
    terminalVscrollbarUp: document.getElementById("terminal-vscrollbar-up"),
    terminalVscrollbarDown: document.getElementById("terminal-vscrollbar-down"),
    input: document.getElementById("input"),
    form: document.getElementById("form"),
    terminal: document.getElementById("terminal"),
    sessionBadge: document.getElementById("sessionBadge"),
    warnHint: document.getElementById("warnHint"),
    cornerLogo: document.getElementById("fam-corner-logo"),
    cornerConnect: document.getElementById("fam-corner-connect"),
    cornerMeta: document.getElementById("fam-corner-meta"),
    cornerHealth: document.getElementById("fam-corner-health"),
    cornerTime: document.getElementById("fam-corner-time"),
    cornerPing: document.getElementById("fam-corner-ping"),
    cornerHealthMid: document.getElementById("fam-corner-health-mid"),
    cornerHealthUp: document.getElementById("fam-corner-health-up"),
    cornerHealthL2: document.getElementById("fam-corner-health-l2"),
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.temperature === "number") temperature = s.temperature;
      if (typeof s.warningsEnabled === "boolean") warningsEnabled = s.warningsEnabled;
    } catch {
      /* ignore */
    }
  }

  function saveSettings() {
    localStorage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({ temperature, warningsEnabled })
    );
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_SESSIONS);
      if (!raw) return {};
      const o = JSON.parse(raw);
      return typeof o === "object" && o ? o : {};
    } catch {
      return {};
    }
  }

  function saveSessions(map) {
    localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(map));
  }

  function loadMemories() {
    try {
      const raw = localStorage.getItem(STORAGE_MEMORY);
      if (!raw) return [];
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a.map(String) : [];
    } catch {
      return [];
    }
  }

  function saveMemories(arr) {
    localStorage.setItem(STORAGE_MEMORY, JSON.stringify(arr));
  }

  function getDisplayName() {
    try {
      const v = localStorage.getItem(STORAGE_DISPLAY_NAME);
      if (v == null || v === "") return null;
      return String(v);
    } catch {
      return null;
    }
  }

  function setDisplayName(name) {
    localStorage.setItem(STORAGE_DISPLAY_NAME, name);
  }

  /** @returns {"simple"|"advanced"|null} null = not chosen yet (treat as advanced for command availability). */
  function getUiMode() {
    try {
      const v = localStorage.getItem(STORAGE_UI_MODE);
      if (v === "complex") {
        try {
          localStorage.setItem(STORAGE_UI_MODE, "advanced");
        } catch {
          /* ignore */
        }
        return "advanced";
      }
      if (v === "simple" || v === "advanced") return v;
      return null;
    } catch {
      return null;
    }
  }

  function setUiMode(mode) {
    localStorage.setItem(STORAGE_UI_MODE, mode);
  }

  function parseModeChoice(line) {
    const s = line.trim().toLowerCase();
    if (["simple", "s", "basic", "easy"].includes(s)) return "simple";
    if (["advanced", "complex", "a", "full"].includes(s)) return "advanced";
    return null;
  }

  /** After picking simple — how day-to-day use maps to slash commands. */
  const MODE_SIMPLE_PRIMER = [
    "Here's how simple mode works",
    "• Type in the line below to chat — one continuous thread with the model until you reset it.",
    "• /clear clears the transcript and starts a new conversation in place (there is no /new in simple mode).",
    "• /help lists commands; /cls only wipes the screen; /status and /whoami check the backend and your name/IP; /ping refreshes round-trip time to the server (also shown under the logo on desktop); /toadvanced switches to advanced mode if you later want sessions and the full toolset.",
  ].join("\n");

  /** After picking advanced — how contexts and sessions map to slash commands. */
  const MODE_ADVANCED_PRIMER = [
    "Here's how advanced mode works",
    "• /new starts a fresh context; add a name to tie it to a session you can /store and /restore later. /sessions lists saves.",
    "• /remember, /memory, and /forget manage notes the model can reuse; /whoami, /status, and /ping are there for diagnostics.",
    "• /help is the full manual. /tosimple returns to the lighter chat-only mode anytime.",
  ].join("\n");

  async function appendFinalWelcomeLine() {
    if (getUiMode() === "simple") {
      await appendLine(
        "system",
        "Commands start with /. Run /help. Just type to chat. You have one running thread until /clear.",
        { animate: true }
      );
    } else {
      await appendLine(
        "system",
        "Commands start with /. Run /help. Start chatting after /new.",
        { animate: true }
      );
    }
  }

  function applySimpleModeChatRules() {
    if (getUiMode() !== "simple") return;
    hasContext = true;
    currentSessionName = null;
    lastSavedJSON = JSON.stringify(messages);
    updateBadge();
  }

  async function promptModeChoice() {
    awaitingModeChoice = true;
    el.input.placeholder = "simple or advanced";
    await appendLine(
      "system",
      "Choose how you want to use this terminal. Simple keeps things easy; advanced turns on every feature.",
      { animate: true }
    );
    await appendLine(
      "system",
      [
        "Simple mode: Single context chat (recommended)",
        "You get one continuous conversation with the model. Everything lives in a single thread until you run /clear, which wipes that thread and starts fresh in place. Slash commands are limited to essentials. There is nothing for storing or restoring sessions, memory, or deep settings.",
        "Recommended if you mainly want to chat, don’t need parallel “projects” or saved transcript names, and prefer not to see a long command list.",
      ].join("\n"),
      { animate: true }
    );
    await appendLine(
      "system",
      [
        "Advanced mode: Multiple contexts and memory (experienced users)",
        "You’re not locked into a single running conversation. You can start a clean context when you change subject, name and revisit saved work, and store memories the model should respect across turns. You gain access to specific model settings and parameters.",
        "Best if you often switch topics, want to come back to earlier threads, care about how requests are configured, or treat this terminal as part of a longer workflow rather than a one-off message box.",
      ].join("\n"),
      { animate: true }
    );
    await appendLine(
      "system",
      "Reply with simple or advanced (short: s or a). You can switch any time with /toadvanced or /tosimple.",
      { animate: true }
    );
  }

  function updateBadge() {
    if (!el.sessionBadge) return;
    if (getUiMode() === "simple") {
      el.sessionBadge.textContent =
        messages.length > 0 ? "simple · chatting" : "simple · chat";
      return;
    }
    if (!hasContext) {
      el.sessionBadge.textContent = "no context — run /new";
      return;
    }
    el.sessionBadge.textContent = currentSessionName
      ? `session: ${currentSessionName}`
      : "context active (no session)";
  }

  function updateWarnHint() {
    if (!el.warnHint) return;
    el.warnHint.textContent = warningsEnabled
      ? "Y/N prompts on — /disablewarnings to skip"
      : "Y/N prompts off — /enablewarnings to restore";
  }

  function isDirty() {
    return JSON.stringify(messages) !== lastSavedJSON;
  }

  function needsUnsavedConfirm() {
    if (getUiMode() === "simple") return false;
    if (!hasContext) return false;
    if (messages.length === 0) return false;
    if (!currentSessionName) return true;
    return isDirty();
  }

  function warnAboutDisable() {
    if (warningsEnabled) {
      appendLine(
        "system",
        "You can run /disablewarnings to skip future Y/N prompts."
      );
    }
  }

  /** Milliseconds between characters when animating system / assistant / error lines. */
  const TYPEWRITER_MS_PER_CHAR = 12;
  /** Banner: 0 ms + chunk + rAF — avoids setTimeout’s ~4ms floor per character. */
  const BOOT_ASCII_TYPEWRITER_MS_PER_CHAR = 5;
  const BOOT_ASCII_TYPEWRITER_CHUNK = 2;

  /** Matches `@media (max-width: 640px)` terminal layout — use native scroll, not the DOM rail. */
  function prefersNativeTerminalScrollbar() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 640px)").matches
    );
  }

  /** Custom DOM scrollbar + `fam-terminal--vscroll` when content overflows (logo clears the rail). */
  function syncTerminalScrollbar() {
    const sc = el.outputScroll;
    const wrap = document.getElementById("fam-terminal");
    const rail = el.terminalVscrollbar;
    const thumb = el.terminalVscrollbarThumb;
    const track = el.terminalVscrollbarTrack;
    if (!sc || !wrap || !rail || !thumb || !track) return;
    requestAnimationFrame(() => {
      if (prefersNativeTerminalScrollbar()) {
        rail.hidden = true;
        wrap.classList.remove("fam-terminal--vscroll");
        return;
      }
      const overflow = sc.scrollHeight > sc.clientHeight + 1;
      wrap.classList.toggle("fam-terminal--vscroll", overflow);
      if (!overflow) {
        rail.hidden = true;
        return;
      }
      rail.hidden = false;

      const scrollRange = Math.max(0, sc.scrollHeight - sc.clientHeight);
      const trackH = track.clientHeight;
      if (trackH <= 0) return;

      const thumbMin = 32;
      const thumbH = Math.max(
        thumbMin,
        Math.round((sc.clientHeight / sc.scrollHeight) * trackH)
      );
      const maxThumbTop = Math.max(0, trackH - thumbH);
      const thumbTop =
        scrollRange <= 0 || maxThumbTop <= 0
          ? 0
          : Math.round((sc.scrollTop / scrollRange) * maxThumbTop);

      thumb.style.height = `${thumbH}px`;
      thumb.style.top = `${thumbTop}px`;
    });
  }

  /**
   * If the user is within this many px of the bottom, we treat them as "following" the
   * stream. Kept small so nudging up a bit is not re-pulled on every typewriter tick.
   */
  const OUTPUT_STICKY_BOTTOM_PX = 18;
  /**
   * After we set `scrollTop` ourselves, treat the next `scroll` event(s) as not user intent.
   * (ms, `performance.now()`.)
   */
  const OUTPUT_AUTOSCROLL_SUPPRESS_MS = 100;
  /**
   * Pixels from bottom: user explicitly followed the end again; resume autoscroll.
   */
  const OUTPUT_RESUME_AUTOSCROLL_MAX_DIST_PX = 2.5;

  let userOptedOutOfOutputAutoscroll = false;
  let outputAutoscrollSuppressUserIntentUntil = 0;
  let lastOutputScrollTop = 0;

  function isOutputNearBottom() {
    const sc = el.outputScroll;
    if (!sc) return true;
    const dist = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
    return dist <= OUTPUT_STICKY_BOTTOM_PX;
  }

  function markOutputAutoscrollProgrammatic() {
    outputAutoscrollSuppressUserIntentUntil = performance.now() + OUTPUT_AUTOSCROLL_SUPPRESS_MS;
  }

  function updateUserOutputAutoscrollFromScroll() {
    const sc = el.outputScroll;
    if (!sc) return;
    if (performance.now() < outputAutoscrollSuppressUserIntentUntil) {
      lastOutputScrollTop = sc.scrollTop;
      return;
    }
    const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
    const dist = max - sc.scrollTop;
    if (dist <= OUTPUT_RESUME_AUTOSCROLL_MAX_DIST_PX) {
      userOptedOutOfOutputAutoscroll = false;
    } else if (sc.scrollTop < lastOutputScrollTop - 0.5) {
      /* User (or widget) moved the viewport up. */
      userOptedOutOfOutputAutoscroll = true;
    }
    lastOutputScrollTop = sc.scrollTop;
  }

  /**
   * After growing the transcript, only jump to the bottom if the user was already
   * following the end (keeps manual scroll position while reading history).
   * @param {boolean} wasNearBottom from `isOutputNearBottom()` **before** the DOM change
   */
  function scrollOutputToBottomIfPinned(wasNearBottom) {
    const sc = el.outputScroll;
    if (userOptedOutOfOutputAutoscroll) {
      syncTerminalScrollbar();
      return;
    }
    if (wasNearBottom && sc) {
      markOutputAutoscrollProgrammatic();
      sc.scrollTop = sc.scrollHeight;
      lastOutputScrollTop = sc.scrollTop;
    }
    syncTerminalScrollbar();
  }

  function scrollOutputToBottom() {
    const sc = el.outputScroll;
    if (sc) {
      userOptedOutOfOutputAutoscroll = false;
      markOutputAutoscrollProgrammatic();
      sc.scrollTop = sc.scrollHeight;
      lastOutputScrollTop = sc.scrollTop;
    }
    syncTerminalScrollbar();
  }

  function initTerminalScrollbarSync() {
    const sc = el.outputScroll;
    const out = el.output;
    const wrap = document.getElementById("fam-terminal");
    const rail = el.terminalVscrollbar;
    const thumb = el.terminalVscrollbarThumb;
    const track = el.terminalVscrollbarTrack;
    const up = el.terminalVscrollbarUp;
    const down = el.terminalVscrollbarDown;
    if (!sc || !wrap || !rail || !thumb || !track) return;

    const sync = () => syncTerminalScrollbar();
    const onOutputScroll = () => {
      updateUserOutputAutoscrollFromScroll();
      sync();
    };
    sc.addEventListener("scroll", onOutputScroll, { passive: true });
    sc.addEventListener(
      "wheel",
      (e) => {
        if (e.deltaY < 0) {
          userOptedOutOfOutputAutoscroll = true;
        }
        if (e.deltaY > 0) {
          const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
          if (max - sc.scrollTop <= OUTPUT_RESUME_AUTOSCROLL_MAX_DIST_PX + 1) {
            userOptedOutOfOutputAutoscroll = false;
          }
        }
      },
      { passive: true }
    );
    lastOutputScrollTop = sc.scrollTop;

    track.addEventListener("click", (e) => {
      if (e.target === thumb || thumb.contains(e.target)) return;
      const rect = track.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const thumbH = thumb.offsetHeight;
      const trackH = track.clientHeight;
      const scrollRange = sc.scrollHeight - sc.clientHeight;
      const maxThumbTop = Math.max(0, trackH - thumbH);
      if (scrollRange <= 0 || maxThumbTop <= 0) return;
      const centerY = y - thumbH / 2;
      const clamped = Math.max(0, Math.min(maxThumbTop, centerY));
      sc.scrollTop = (clamped / maxThumbTop) * scrollRange;
    });

    let dragStart = null;
    function onPointerMove(e) {
      if (!dragStart) return;
      const dy = e.clientY - dragStart.y;
      const trackH = track.clientHeight;
      const thumbH = thumb.offsetHeight;
      const scrollRange = sc.scrollHeight - sc.clientHeight;
      const maxThumbTop = Math.max(0, trackH - thumbH);
      if (maxThumbTop <= 0 || scrollRange <= 0) return;
      sc.scrollTop = dragStart.scrollTop + (dy / maxThumbTop) * scrollRange;
    }
    function onPointerUp(e) {
      if (!dragStart) return;
      dragStart = null;
      try {
        thumb.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    }
    thumb.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragStart = { y: e.clientY, scrollTop: sc.scrollTop };
      try {
        thumb.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });

    const step = () =>
      Math.min(48, Math.floor(sc.clientHeight * 0.25) || 48);
    if (up) {
      up.addEventListener("click", () => {
        sc.scrollTop -= step();
      });
    }
    if (down) {
      down.addEventListener("click", () => {
        sc.scrollTop += step();
      });
    }

    const ro = new ResizeObserver(sync);
    ro.observe(sc);
    if (el.terminalScrollWrap) ro.observe(el.terminalScrollWrap);
    if (out) {
      const mo = new MutationObserver(() => sync());
      mo.observe(out, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener("resize", sync, { passive: true });
    sync();
  }

  function updateTranscriptTypingUi() {
    if (!el.terminal || !el.input) return;
    const busy = transcriptTypingDepth > 0;
    el.terminal.classList.toggle("transcript-typing", busy);
    el.input.readOnly = busy;
  }

  async function appendBootAsciiBanner() {
    if (
      typeof window.matchMedia !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      appendLineInstant("system", BOOT_ASCII_BANNER, "line--ascii-banner");
      return;
    }
    await appendLine("system", BOOT_ASCII_BANNER, {
      className: "line--ascii-banner",
      animate: true,
      typewriterMsPerChar: BOOT_ASCII_TYPEWRITER_MS_PER_CHAR,
      typewriterChunkSize: BOOT_ASCII_TYPEWRITER_CHUNK,
    });
  }

  function appendLineInstant(kind, text, className = "") {
    const div = document.createElement("div");
    div.className = `line ${kind} ${className}`.trim();
    if (kind === "user") {
      div.innerHTML = `<span class="label">FAM\\You&gt;</span>${escapeHtml(text)}`;
    } else if (kind === "assistant") {
      div.innerHTML = `${ASSISTANT_LABEL_HTML}<span class="line__body">${formatAssistantBodyHtml(text)}</span>`;
    } else {
      div.textContent = text;
    }
    const pinBefore = isOutputNearBottom();
    el.output.appendChild(div);
    if (kind === "user") {
      scrollOutputToBottom();
    } else {
      scrollOutputToBottomIfPinned(pinBefore);
    }
  }

  function typeAssistantBodyIntoElement(targetEl, fullText, onDone, msPerChar, chunkSize) {
    const stepMs =
      typeof msPerChar === "number" && Number.isFinite(msPerChar) && msPerChar >= 0
        ? Math.max(0, msPerChar)
        : TYPEWRITER_MS_PER_CHAR;
    const chunk =
      typeof chunkSize === "number" &&
      Number.isFinite(chunkSize) &&
      chunkSize >= 1
        ? Math.min(512, Math.floor(chunkSize))
        : 1;
    const s = String(fullText);
    let i = 0;
    let timeoutId = null;
    let rafId = 0;
    let finished = false;
    let built = "";

    function clearTimers() {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function finishNormal() {
      if (finished) return;
      finished = true;
      clearTimers();
      activeTypewriters.delete(handle);
      syncTerminalScrollbar();
      onDone();
    }

    function finishSkip() {
      if (finished) return;
      finished = true;
      clearTimers();
      activeTypewriters.delete(handle);
      const pinBefore = isOutputNearBottom();
      targetEl.innerHTML = formatAssistantBodyHtml(s);
      scrollOutputToBottomIfPinned(pinBefore);
      onDone();
    }

    const handle = { skip: finishSkip, flush: finishSkip };
    activeTypewriters.add(handle);

    function tick() {
      timeoutId = null;
      rafId = 0;
      if (finished) return;
      if (i >= s.length) {
        finishNormal();
        return;
      }
      const end = Math.min(s.length, i + chunk);
      const pinBefore = isOutputNearBottom();
      built = s.slice(0, end);
      targetEl.innerHTML = formatAssistantBodyHtmlForTyping(built);
      i = end;
      scrollOutputToBottomIfPinned(pinBefore);
      if (i >= s.length) {
        finishNormal();
        return;
      }
      if (stepMs <= 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        timeoutId = setTimeout(tick, stepMs);
      }
    }
    tick();
  }

  function typeStringIntoElement(targetEl, fullText, onDone, msPerChar, chunkSize) {
    const stepMs =
      typeof msPerChar === "number" && Number.isFinite(msPerChar) && msPerChar >= 0
        ? Math.max(0, msPerChar)
        : TYPEWRITER_MS_PER_CHAR;
    const chunk =
      typeof chunkSize === "number" &&
      Number.isFinite(chunkSize) &&
      chunkSize >= 1
        ? Math.min(512, Math.floor(chunkSize))
        : 1;
    const s = String(fullText);
    let i = 0;
    let timeoutId = null;
    let rafId = 0;
    let finished = false;

    function clearTimers() {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function finishNormal() {
      if (finished) return;
      finished = true;
      clearTimers();
      activeTypewriters.delete(handle);
      syncTerminalScrollbar();
      onDone();
    }

    function finishSkip() {
      if (finished) return;
      finished = true;
      clearTimers();
      activeTypewriters.delete(handle);
      const pinBefore = isOutputNearBottom();
      targetEl.textContent = s;
      scrollOutputToBottomIfPinned(pinBefore);
      onDone();
    }

    const handle = { skip: finishSkip, flush: finishSkip };
    activeTypewriters.add(handle);

    function tick() {
      timeoutId = null;
      rafId = 0;
      if (finished) return;
      if (i >= s.length) {
        finishNormal();
        return;
      }
      const end = Math.min(s.length, i + chunk);
      const pinBefore = isOutputNearBottom();
      targetEl.appendChild(document.createTextNode(s.slice(i, end)));
      i = end;
      scrollOutputToBottomIfPinned(pinBefore);
      if (i >= s.length) {
        finishNormal();
        return;
      }
      if (stepMs <= 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        timeoutId = setTimeout(tick, stepMs);
      }
    }
    tick();
  }

  /**
   * Throttled background timers; on tab return catch up to latest buffered text.
   */
  function flushPendingChunksOnTabFocus() {
    if (document.visibilityState !== "visible") return;
    if (streamTabFlush) {
      try {
        streamTabFlush();
      } catch {
        /* ignore */
      }
    }
    for (const h of [...activeTypewriters]) {
      if (typeof h.flush === "function") h.flush();
    }
  }

  /**
   * @param {string} kind
   * @param {string} text
   * @param {string | { className?: string; animate?: boolean; typewriterMsPerChar?: number; typewriterChunkSize?: number }} [extra]
   * @returns {Promise<void>}
   */
  function appendLine(kind, text, extra) {
    let className = "";
    const options = {
      animate: false,
      typewriterMsPerChar: undefined,
      typewriterChunkSize: undefined,
    };
    if (typeof extra === "string") {
      className = extra;
    } else if (extra && typeof extra === "object") {
      if (typeof extra.className === "string") className = extra.className;
      if (typeof extra.animate === "boolean") options.animate = extra.animate;
      if (typeof extra.typewriterMsPerChar === "number") {
        options.typewriterMsPerChar = extra.typewriterMsPerChar;
      }
      if (typeof extra.typewriterChunkSize === "number") {
        options.typewriterChunkSize = extra.typewriterChunkSize;
      }
    }

    const shouldAnimate =
      options.animate &&
      kind !== "error" &&
      kind !== "user" &&
      kind !== "cmd-echo" &&
      text != null &&
      String(text).length > 0 &&
      typeof window.matchMedia !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!shouldAnimate) {
      appendLineInstant(kind, text, className);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      transcriptTypingDepth += 1;
      updateTranscriptTypingUi();
      const finish = () => {
        transcriptTypingDepth = Math.max(0, transcriptTypingDepth - 1);
        updateTranscriptTypingUi();
        resolve();
      };
      const div = document.createElement("div");
      div.className = `line ${kind} ${className}`.trim();
      if (kind === "assistant") {
        div.innerHTML = ASSISTANT_LABEL_HTML;
        const body = document.createElement("span");
        body.className = "line__body";
        div.appendChild(body);
        el.output.appendChild(div);
        typeAssistantBodyIntoElement(
          body,
          text,
          () => {
            body.innerHTML = formatAssistantBodyHtml(text);
            finish();
          },
          options.typewriterMsPerChar,
          options.typewriterChunkSize
        );
        return;
      }
      const body = document.createElement("span");
      body.className = "line__body";
      div.appendChild(body);
      el.output.appendChild(div);
      typeStringIntoElement(
        body,
        text,
        finish,
        options.typewriterMsPerChar,
        options.typewriterChunkSize
      );
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** null = not computed yet */
  let cachedPixellariBoldMeasuresWider = null;

  /**
   * Pixellari ships as one weight; browsers may synthesize bold. If bold width
   * does not differ from normal, strip `**` only (no faux-strong).
   */
  function pixellariBoldMeasuresWider() {
    if (cachedPixellariBoldMeasuresWider !== null) {
      return cachedPixellariBoldMeasuresWider;
    }
    try {
      if (typeof document === "undefined" || !document.createElement) {
        cachedPixellariBoldMeasuresWider = true;
        return true;
      }
      if (
        document.fonts &&
        typeof document.fonts.check === "function" &&
        !document.fonts.check('16px "Pixellari"')
      ) {
        /* Font not ready yet — don’t cache false “no bold” from fallback metrics. */
        return true;
      }
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) {
        cachedPixellariBoldMeasuresWider = true;
        return true;
      }
      const sample = "Mgwm";
      ctx.font = '16px "Pixellari", monospace';
      const wNormal = ctx.measureText(sample).width;
      ctx.font = '700 16px "Pixellari", monospace';
      const wBold = ctx.measureText(sample).width;
      cachedPixellariBoldMeasuresWider = wBold > wNormal * 1.008;
      return cachedPixellariBoldMeasuresWider;
    } catch {
      cachedPixellariBoldMeasuresWider = true;
      return true;
    }
  }

  /**
   * When the font can’t show real bold, drop `*…*` and `**…**` marker pairs so text stays readable.
   * @param {string} escaped
   * @returns {string}
   */
  function stripAsteriskBoldMarkers(escaped) {
    let s = escaped;
    s = s.replace(/(?<!\*)\*([^*]*?)\*(?!\*)/g, "$1");
    s = s.replace(/\*\*/g, "");
    return s;
  }

  /**
   * In one segment of the outer `**…**` split, turn `*inner*` into `<strong>…</strong>`.
   * Does not look for `**` (parent split already removed those delimiters).
   * @param {string} segment
   * @param {boolean} forTyping unbalanced / trailing `*` is treated as in-progress bold
   * @returns {string}
   */
  function formatSingleAsterisksInSegment(segment, forTyping) {
    if (segment.length === 0 || !segment.includes("*")) {
      return segment;
    }
    const parts = segment.split("*");
    const n = parts.length;
    if (n === 1) {
      return segment;
    }
    if (!forTyping) {
      if (n % 2 === 0) {
        return segment;
      }
    }
    let o = "";
    for (let i = 0; i < n; i++) {
      o += i % 2 === 0 ? parts[i] : `<strong>${parts[i]}</strong>`;
    }
    return o;
  }

  /**
   * Bot text may use `**bold**` or `*bold*` (e.g. `* finances *`). HTML-escaped; `**` wraps
   * run first, then `*` pairs per segment, become `<strong>` if bold is effective, else
   * markers are stripped.
   */
  function formatAssistantBodyHtml(raw) {
    const escaped = escapeHtml(String(raw));
    if (!pixellariBoldMeasuresWider()) {
      return stripAsteriskBoldMarkers(escaped);
    }
    const parts = escaped.split("**");
    if (parts.length % 2 === 0) {
      return stripAsteriskBoldMarkers(escaped);
    }
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        out += formatSingleAsterisksInSegment(parts[i], false);
      } else {
        out += `<strong>${formatSingleAsterisksInSegment(parts[i], false)}</strong>`;
      }
    }
    return out;
  }

  /**
   * Same as `formatAssistantBodyHtml` but while text is still growing (e.g. stream
   * or typewriter). Unclosed `**…` and trailing / unclosed `*…` are still shown in `<strong>`.
   */
  function formatAssistantBodyHtmlForTyping(raw) {
    const escaped = escapeHtml(String(raw));
    if (!pixellariBoldMeasuresWider()) {
      return stripAsteriskBoldMarkers(escaped);
    }
    const parts = escaped.split("**");
    const n = parts.length;
    if (n <= 1) {
      return formatSingleAsterisksInSegment(parts[0] ?? "", true);
    }
    let out = "";
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) {
        out += formatSingleAsterisksInSegment(parts[i], true);
      } else {
        out += `<strong>${formatSingleAsterisksInSegment(parts[i], true)}</strong>`;
      }
    }
    return out;
  }

  /** Same wall-clock span as typing `BOOT_WELCOME_FAM_TEXT` (first char immediate). */
  function bootWelcomeFamTypewriterMs() {
    const n = BOOT_WELCOME_FAM_TEXT.length;
    return Math.max(1, n - 1) * TYPEWRITER_MS_PER_CHAR;
  }

  /** After Connect for returning users: pause then glitch (not tied to welcome typing). */
  const RETURNING_USER_CORNER_LOGO_DELAY_MS = 320;
  const RETURNING_USER_CORNER_LOGO_GLITCH_MS = 780;

  /** Delay between each corner row glitch (ms); total lead-in = 3 × step before health starts. */
  const CORNER_GLITCH_STAGGER_STEP_MS = 60;

  /**
   * Corner logo glitches into the top-right.
   * @param {number} [glitchMsOverride] — animation length in ms; default matches first-boot welcome typing.
   */
  function showCornerLogo(glitchMsOverride) {
    return new Promise((resolve) => {
      const wrap = el.cornerLogo;
      const img = wrap?.querySelector(".fam-corner-logo__img");
      const connect = el.cornerConnect ?? wrap?.querySelector(".fam-corner-connect");
      const meta = el.cornerMeta ?? wrap?.querySelector(".fam-corner-meta");
      const health = el.cornerHealth ?? wrap?.querySelector(".fam-corner-health");
      if (!wrap || !img) {
        resolve();
        return;
      }

      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      wrap.classList.remove("fam-corner-logo--hidden");
      wrap.setAttribute("aria-hidden", "false");

      if (reduced) {
        resolve();
        return;
      }

      const glitchMs =
        typeof glitchMsOverride === "number" && Number.isFinite(glitchMsOverride)
          ? Math.max(120, glitchMsOverride)
          : bootWelcomeFamTypewriterMs();
      wrap.style.setProperty("--fam-corner-glitch-ms", `${glitchMs}ms`);
      wrap.style.setProperty(
        "--fam-corner-glitch-stagger-step",
        String(CORNER_GLITCH_STAGGER_STEP_MS)
      );

      const staggerMs = CORNER_GLITCH_STAGGER_STEP_MS;
      const lastAnimated = health || meta || connect || img;

      let settled = false;
      const finish = (ev) => {
        if (ev && ev.animationName) {
          const names = ev.animationName.split(",").map((s) => s.trim());
          if (!names.includes("fam-corner-logo-glitch-in")) return;
        }
        if (settled) return;
        settled = true;
        lastAnimated.removeEventListener("animationend", finish);
        window.clearTimeout(fallback);
        resolve();
      };
      const fallbackMs = 3 * staggerMs + glitchMs + 120;
      const fallback = window.setTimeout(finish, fallbackMs);
      lastAnimated.removeEventListener("animationend", finish);
      img.classList.remove("fam-corner-logo__img--glitch-in");
      if (connect) connect.classList.remove("fam-corner-connect--glitch-in");
      if (meta) meta.classList.remove("fam-corner-meta--glitch-in");
      if (health) health.classList.remove("fam-corner-health--glitch-in");
      void img.offsetWidth;
      if (connect) void connect.offsetWidth;
      if (meta) void meta.offsetWidth;
      if (health) void health.offsetWidth;
      lastAnimated.addEventListener("animationend", finish);
      img.classList.add("fam-corner-logo__img--glitch-in");
      if (connect) connect.classList.add("fam-corner-connect--glitch-in");
      if (meta) meta.classList.add("fam-corner-meta--glitch-in");
      if (health) health.classList.add("fam-corner-health--glitch-in");
    });
  }

  function tokenizeArgs(rest) {
    const out = [];
    let i = 0;
    while (i < rest.length) {
      while (i < rest.length && /\s/.test(rest[i])) i++;
      if (i >= rest.length) break;
      if (rest[i] === '"') {
        i++;
        let buf = "";
        while (i < rest.length && rest[i] !== '"') {
          if (rest[i] === "\\" && i + 1 < rest.length) {
            buf += rest[i + 1];
            i += 2;
          } else {
            buf += rest[i];
            i++;
          }
        }
        if (rest[i] === '"') i++;
        out.push(buf);
      } else {
        let j = i;
        while (j < rest.length && !/\s/.test(rest[j])) j++;
        out.push(rest.slice(i, j));
        i = j;
      }
    }
    return out;
  }

  function parseCommand(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("/")) return null;
    const rest = trimmed.slice(1).trim();
    const lower = rest.toLowerCase();
    const firstWord = lower.split(/\s+/)[0] || "";
    const afterFirst = rest.slice(firstWord.length).trim();
    return { raw: trimmed, cmd: firstWord, rest: afterFirst, fullRest: rest };
  }

  function validateSessionName(name, label) {
    if (!name) return `${label} name required.`;
    if (name.length > MAX_SESSION_NAME)
      return `${label} name exceeds ${MAX_SESSION_NAME} characters.`;
    return null;
  }

  /** @param {string[]} keys */
  function groupHelpKeysByCategory(keys) {
    const set = new Set(keys);
    /** @type {{ id: string; keys: string[] }[]} */
    const out = [];
    for (const cat of HELP_CATEGORY_ORDER) {
      const inCat = keys.filter(
        (k) => set.has(k) && HELP_COMMAND_CATEGORY[k] === cat.id
      );
      inCat.sort((a, b) => a.localeCompare(b));
      if (inCat.length) out.push({ id: cat.id, keys: inCat });
    }
    return out;
  }

  /**
   * Legend swatches only for categories that appear in this help list (e.g. simple mode omits empty groups).
   * @param {{ id: string; keys: string[] }[]} groups
   */
  function formatHelpLegendHtml(groups) {
    const used = new Set(groups.map((g) => g.id));
    const cats = HELP_CATEGORY_ORDER.filter((c) => used.has(c.id));
    if (!cats.length) return "";
    const items = cats
      .map((c) => {
        const sw = `<span class="help-legend-swatch help-cat--${escapeHtml(c.id)}"></span>`;
        const leg = escapeHtml(c.legend);
        const lab = escapeHtml(c.label);
        return `<span class="help-legend-item">${sw}<span class="help-legend-text"><strong>${leg}</strong> — ${lab}</span></span>`;
      })
      .join("");
    return `<p class="help-legend">${items}</p>`;
  }

  /**
   * @param {string} key
   * @param {{ paragraphs: string[]; example?: string }} detail
   */
  function formatHelpTopicHtml(key, detail) {
    const title = escapeHtml(key);
    const cat = HELP_COMMAND_CATEGORY[key] || "general";
    const paras = detail.paragraphs
      .map((p) => {
        const withBr = escapeHtml(p).replace(/\n/g, "<br/>");
        return `<p class="help-topic-p">${withBr}</p>`;
      })
      .join("");
    const ex =
      detail.example != null && String(detail.example).trim() !== ""
        ? `<p class="help-topic-ex-label">Example</p><pre class="help-topic-ex help-topic-ex--${escapeHtml(cat)}">${escapeHtml(detail.example)}</pre>`
        : "";
    return `<div class="help help-topic"><h3 class="help-topic-title help-cat--${escapeHtml(cat)}">/${title}</h3>${paras}${ex}</div>`;
  }

  function showHelp(topic) {
    const t = (topic || "").toLowerCase();
    const simpleMode = getUiMode() === "simple";
    if (!t) {
      const keys = simpleMode
        ? Array.from(SIMPLE_SLASH_COMMANDS)
        : Object.keys(HELP);
      const title = simpleMode ? "Simple mode commands" : "Commands";
      const groups = groupHelpKeysByCategory(keys);
      let html = `<div class="help"><h3>${escapeHtml(title)}</h3>`;
      html += formatHelpLegendHtml(groups);
      html += `<p class="help-tip">${escapeHtml("Ctrl+C — abort the model while it is replying (partial reply stays in the transcript).")}</p>`;
      for (const g of groups) {
        const catMeta = HELP_CATEGORY_ORDER.find((c) => c.id === g.id);
        const secTitle = escapeHtml(catMeta ? catMeta.label : g.id);
        html += `<h4 class="help-section-title help-cat--${escapeHtml(g.id)}">${secTitle}</h4><ul class="help-section-list">`;
        for (const k of g.keys) {
          const line = HELP[k];
          if (!line) continue;
          const cat = escapeHtml(HELP_COMMAND_CATEGORY[k] || "general");
          html += `<li><code class="help-cmd help-cat--${cat}">/${escapeHtml(k)}</code> — ${escapeHtml(line.split(" — ")[1] || line)}</li>`;
        }
        html += "</ul>";
      }
      html += "</div>";
      const div = document.createElement("div");
      div.className = "line help";
      div.innerHTML = html;
      const pinBefore = isOutputNearBottom();
      el.output.appendChild(div);
      scrollOutputToBottomIfPinned(pinBefore);
      return;
    }
    const key = Object.keys(HELP).find((k) => k === t);
    if (!key) {
      appendLine("error", `Unknown command for /help: ${topic}`);
      return;
    }
    if (simpleMode && !SIMPLE_SLASH_COMMANDS.has(key)) {
      appendLine(
        "error",
        "That command isn’t available in simple mode. Run /toadvanced to switch to advanced mode for the full list."
      );
      return;
    }
    const topicDetail = HELP_DETAIL[key];
    if (topicDetail) {
      const div = document.createElement("div");
      div.className = "line help";
      div.innerHTML = formatHelpTopicHtml(key, topicDetail);
      const pinBefore = isOutputNearBottom();
      el.output.appendChild(div);
      scrollOutputToBottomIfPinned(pinBefore);
      return;
    }
    appendLine("system", HELP[key]);
  }

  function cmdHelp(args) {
    showHelp(args[0] || "");
  }

  function cmdMission() {
    appendLine(
      "system",
      [
        "Mission — Why I built First Amendment Models",
        "The big AI platforms didn’t stumble into surveillance. Your prompts and patterns are a product line: packaged, sold, and used to train the next round of models you never opted into. Safety layers and refusals are about promoting agendas, instilling bias, and keeping you inside a fence that was built on purpose. You’re not the customer; you’re the supply.",
        "We’re already shaped by an invisible machine: ranking, moderation, and “helpful” defaults that decide what you can say, what you can ask, and what never surfaces. It feels neutral because it’s everywhere — until you hit the edge and realize the edge was the point.",
        "The First Amendment is a reminder that speech and software shouldn’t be owned only by a handful of black boxes.",
        "FAM is a small push toward tools you can own instead of feeding into a system that seeks to own you. Stay curious, say what you mean, and know what the machine is doing in the room with you.",
      ].join("\n")
    );
  }

  function cmdDonate() {
    appendLine(
      "system",
      [
        "Support First Amendment Models",
        "If this project’s useful to you, you can send Ethereum (ETH or compatible ERC-20 on the same chain) to:",
        DONATE_ETH_ADDRESS,
        "Double-check the address in your wallet before you confirm. Only send what you can afford — crypto transfers can’t be reversed.",
      ].join("\n")
    );
  }

  function cmdThis() {
    if (!hasContext) {
      appendLine("error", "No active context. Run /new first.");
      return;
    }
    if (!currentSessionName) {
      appendLine("system", "This context is not bound to a session name.");
      return;
    }
    appendLine("success", `This session: ${currentSessionName}`);
  }

  function cmdSessions() {
    const map = loadSessions();
    const names = Object.keys(map).sort();
    if (names.length === 0) {
      appendLine("system", "No stored sessions.");
      return;
    }
    appendLine(
      "system",
      "Stored sessions:\n" + names.map((n) => `  • ${n}`).join("\n")
    );
  }

  function cmdRename(args) {
    if (args.length < 2) {
      appendLine("error", "Usage: /rename {old session name} {new session name}");
      return;
    }
    const oldName = args[0];
    const newName = args.slice(1).join(" ");
    const e1 = validateSessionName(oldName, "Old");
    const e2 = validateSessionName(newName, "New");
    if (e1) {
      appendLine("error", e1);
      return;
    }
    if (e2) {
      appendLine("error", e2);
      return;
    }
    const map = loadSessions();
    if (!(oldName in map)) {
      appendLine("error", `No session named "${oldName}".`);
      return;
    }
    if (newName in map) {
      appendLine("error", `Session "${newName}" already exists.`);
      return;
    }
    map[newName] = map[oldName];
    delete map[oldName];
    saveSessions(map);
    if (currentSessionName === oldName) currentSessionName = newName;
    appendLine("success", `Renamed "${oldName}" → "${newName}".`);
    updateBadge();
  }

  function cmdDrop(args) {
    const name = args.join(" ").trim();
    const err = validateSessionName(name, "Session");
    if (err && !name) {
      appendLine("error", "Usage: /drop {session name}");
      return;
    }
    if (err) {
      appendLine("error", err);
      return;
    }
    const map = loadSessions();
    if (!(name in map)) {
      appendLine("error", `No session named "${name}".`);
      return;
    }
    delete map[name];
    saveSessions(map);
    if (currentSessionName === name) currentSessionName = null;
    appendLine("success", `Dropped session "${name}".`);
    updateBadge();
  }

  function cmdDropAll() {
    saveSessions({});
    currentSessionName = null;
    appendLine("success", "All stored sessions deleted.");
    updateBadge();
  }

  function cmdStore(args) {
    if (!hasContext) {
      appendLine("error", "No context. Run /new first.");
      return;
    }
    if (currentSessionName) {
      appendLine("error", "This context is already stored in a session.");
      return;
    }
    const name = args.join(" ").trim();
    const err = validateSessionName(name, "Session");
    if (err) {
      appendLine("error", err || "Usage: /store {session name}");
      return;
    }
    const map = loadSessions();
    if (name in map) {
      appendLine("error", `Session "${name}" already exists. Choose another name or /drop it first.`);
      return;
    }
    if (Object.keys(map).length >= MAX_STORED_SESSIONS) {
      appendLine(
        "error",
        `Maximum of ${MAX_STORED_SESSIONS} stored sessions reached. /drop one before /store.`
      );
      return;
    }
    map[name] = { messages: JSON.parse(JSON.stringify(messages)) };
    saveSessions(map);
    currentSessionName = name;
    lastSavedJSON = JSON.stringify(messages);
    appendLine("success", `Stored current context as "${name}".`);
    updateBadge();
  }

  function cmdSave() {
    if (!hasContext) {
      appendLine("error", "No context. Run /new first.");
      return;
    }
    if (!currentSessionName) {
      appendLine("error", "Current context is not in a session. Use /store {name} first.");
      return;
    }
    if (!isDirty()) {
      appendLine("system", "Session is already up to date.");
      return;
    }
    const map = loadSessions();
    if (!(currentSessionName in map)) {
      appendLine("error", `Session "${currentSessionName}" missing from storage.`);
      return;
    }
    map[currentSessionName] = { messages: JSON.parse(JSON.stringify(messages)) };
    saveSessions(map);
    lastSavedJSON = JSON.stringify(messages);
    appendLine("success", `Saved to session "${currentSessionName}".`);
  }

  function doRestore(name) {
    const map = loadSessions();
    if (!(name in map)) {
      appendLine("error", `No session named "${name}".`);
      return;
    }
    const data = map[name];
    messages = Array.isArray(data.messages)
      ? JSON.parse(JSON.stringify(data.messages))
      : [];
    hasContext = true;
    currentSessionName = name;
    lastSavedJSON = JSON.stringify(messages);
    appendLine("success", `Restored session "${name}" (${messages.length} messages in transcript).`);
    updateBadge();
  }

  function cmdRestore(args) {
    const name = args.join(" ").trim();
    const err = validateSessionName(name, "Session");
    if (err && !name) {
      appendLine("error", "Usage: /restore {session name}");
      return;
    }
    if (err) {
      appendLine("error", err);
      return;
    }
    if (!hasContext) {
      doRestore(name);
      return;
    }
    if (needsUnsavedConfirm()) {
      if (!warningsEnabled) {
        doRestore(name);
        return;
      }
      pendingConfirm = { type: "restore", data: { name } };
      warnAboutDisable();
      appendLine(
        "system",
        "You have unsaved context. Restore anyway? [Y/N]"
      );
      return;
    }
    doRestore(name);
  }

  function doNew(sessionOpt) {
    messages = [];
    hasContext = true;
    if (sessionOpt) {
      const map = loadSessions();
      if (!(sessionOpt in map) && Object.keys(map).length >= MAX_STORED_SESSIONS) {
        appendLine(
          "error",
          `Maximum of ${MAX_STORED_SESSIONS} stored sessions reached. /drop one first. New context has no session binding.`
        );
        currentSessionName = null;
        lastSavedJSON = JSON.stringify(messages);
        updateBadge();
        return;
      }
      map[sessionOpt] = { messages: [] };
      saveSessions(map);
      currentSessionName = sessionOpt;
      lastSavedJSON = JSON.stringify(messages);
      appendLine(
        "success",
        `New context started and bound to session "${sessionOpt}".`
      );
    } else {
      currentSessionName = null;
      lastSavedJSON = JSON.stringify(messages);
      appendLine("success", "New context started.");
    }
    updateBadge();
  }

  function cmdNew(args) {
    if (getUiMode() === "simple") {
      appendLine(
        "error",
        "Simple mode has no /new or sessions — type to continue the thread, or /clear to start fresh."
      );
      return;
    }
    const sessionOpt = args.join(" ").trim() || null;
    if (sessionOpt) {
      const err = validateSessionName(sessionOpt, "Session");
      if (err) {
        appendLine("error", err);
        return;
      }
      const map = loadSessions();
      if (sessionOpt in map) {
        appendLine(
          "error",
          `Session "${sessionOpt}" already exists. Pick another name or /drop it.`
        );
        return;
      }
      if (Object.keys(map).length >= MAX_STORED_SESSIONS) {
        appendLine(
          "error",
          `Maximum of ${MAX_STORED_SESSIONS} stored sessions reached. /drop one before /new with a session name.`
        );
        return;
      }
    }

    if (hasContext && needsUnsavedConfirm()) {
      if (!warningsEnabled) {
        doNew(sessionOpt);
        return;
      }
      pendingConfirm = { type: "new", data: { sessionOpt } };
      warnAboutDisable();
      appendLine(
        "system",
        "You have unsaved context. Start a new context anyway? [Y/N]"
      );
      return;
    }
    doNew(sessionOpt);
  }

  function cmdReplay() {
    if (!hasContext) {
      appendLine("error", "No context. Run /new first.");
      return;
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        appendLine("assistant", messages[i].content);
        return;
      }
    }
    appendLine("error", "There is no last assistant message in this context.");
  }

  function cmdHistory() {
    if (!hasContext) {
      appendLine("error", "No context. Run /new first.");
      return;
    }
    if (messages.length === 0) {
      appendLine(
        "system",
        "No messages in this context yet — send something first."
      );
      return;
    }
    const n = messages.length;
    /** @type {string[]} */
    const lines = [];
    if (n % 2 === 0) {
      const exchanges = n / 2;
      lines.push(
        `Chat history — ${exchanges} exchange${exchanges === 1 ? "" : "s"} in this context`
      );
    } else {
      const complete = (n - 1) / 2;
      lines.push(
        `Chat history — ${complete} complete exchange${complete === 1 ? "" : "s"} + 1 user message awaiting a reply`
      );
    }
    lines.push("");

    let exchangeNum = 0;
    for (let i = 0; i < messages.length; ) {
      const m = messages[i];
      if (m.role === "user") {
        const next = messages[i + 1];
        if (next && next.role === "assistant") {
          exchangeNum += 1;
          lines.push(`── Exchange ${exchangeNum} ──`);
          lines.push(`you: ${String(m.content ?? "")}`);
          lines.push(`ai:  ${String(next.content ?? "")}`);
          lines.push("");
          i += 2;
        } else {
          exchangeNum += 1;
          lines.push(`── Exchange ${exchangeNum} (pending reply) ──`);
          lines.push(`you: ${String(m.content ?? "")}`);
          lines.push("");
          i += 1;
        }
      } else {
        exchangeNum += 1;
        lines.push(`── Block ${exchangeNum} (${String(m.role)}) ──`);
        lines.push(String(m.content ?? ""));
        lines.push("");
        i += 1;
      }
    }

    appendLine("system", lines.join("\n").trimEnd());
  }

  function cmdClear() {
    if (getUiMode() === "simple") {
      if (messages.length === 0) {
        appendLine(
          "system",
          "Nothing to clear — you haven’t sent any messages in this thread yet."
        );
        return;
      }
      messages = [];
      lastSavedJSON = "[]";
      appendLine(
        "success",
        "Conversation cleared. Your next message starts a new thread."
      );
      updateBadge();
      return;
    }
    if (!hasContext) {
      appendLine(
        "system",
        "Nothing to clear — there’s no active chat context yet. Run /new first."
      );
      return;
    }
    messages = [];
    if (currentSessionName) {
      const map = loadSessions();
      const disk = map[currentSessionName]?.messages;
      lastSavedJSON = JSON.stringify(
        Array.isArray(disk) ? JSON.parse(JSON.stringify(disk)) : []
      );
    } else {
      lastSavedJSON = "[]";
    }
    appendLine("success", "Current context cleared.");
    updateBadge();
  }

  function cmdCls() {
    el.output.replaceChildren();
    appendLine("system", "Display cleared.");
  }

  function cmdMemory() {
    const mem = loadMemories();
    if (mem.length === 0) {
      appendLine("system", "No memories stored.");
      return;
    }
    const lines = mem.map((t, i) => `mem${i}: ${t}`);
    appendLine("system", lines.join("\n"));
  }

  function finishRemember(text) {
    const mem = loadMemories();
    mem.push(text.slice(0, MAX_MEMORY_LEN));
    saveMemories(mem);
    appendLine("success", `Remembered as mem${mem.length - 1}.`);
  }

  function cmdRemember(args) {
    const text = args.join(" ").trim();
    if (!text) {
      appendLine("error", "Usage: /remember {text}");
      return;
    }
    const mem = loadMemories();
    if (mem.length >= MAX_MEMORIES) {
      appendLine("error", `Memory is full (${MAX_MEMORIES} items). /forget or /forgetall first.`);
      return;
    }
    if (text.length > MAX_MEMORY_LEN) {
      if (!warningsEnabled) {
        finishRemember(text);
        return;
      }
      pendingConfirm = { type: "remember", data: { text } };
      warnAboutDisable();
      appendLine(
        "system",
        `That text is longer than ${MAX_MEMORY_LEN} characters; it will be truncated. Continue? [Y/N]`
      );
      return;
    }
    finishRemember(text);
  }

  function cmdForget(args) {
    const raw = (args[0] || "").trim().toLowerCase();
    if (!raw) {
      appendLine("error", "Usage: /forget {memN} (e.g. mem0 or 0)");
      return;
    }
    let idx = -1;
    const m = raw.match(/^mem(\d+)$/);
    if (m) idx = parseInt(m[1], 10);
    else if (/^\d+$/.test(raw)) idx = parseInt(raw, 10);
    else {
      appendLine("error", `Invalid index "${args[0]}". Use mem0, mem1, …`);
      return;
    }
    const mem = loadMemories();
    if (idx < 0 || idx >= mem.length) {
      appendLine("error", `Memory index mem${idx} does not exist.`);
      return;
    }
    mem.splice(idx, 1);
    saveMemories(mem);
    appendLine("success", `Removed mem${idx}.`);
  }

  function cmdForgetAll() {
    saveMemories([]);
    appendLine("success", "All memories cleared.");
  }

  function cmdTemperature(args) {
    if (args.length !== 1) {
      appendLine("error", "Usage: /temperature {float 0–1}");
      return;
    }
    const v = parseFloat(args[0]);
    if (Number.isNaN(v) || v < 0 || v > 1) {
      appendLine("error", "Temperature must be a number between 0 and 1 (inclusive).");
      return;
    }
    temperature = v;
    saveSettings();
    appendLine("success", `Temperature set to ${temperature}.`);
  }

  function cmdDisableWarnings() {
    warningsEnabled = false;
    saveSettings();
    appendLine("success", "Y/N warnings disabled.");
    updateWarnHint();
  }

  function cmdEnableWarnings() {
    warningsEnabled = true;
    saveSettings();
    appendLine("success", "Y/N warnings enabled.");
    updateWarnHint();
  }

  function famHealthUrl() {
    const b = (CONFIG.baseUrl || "").replace(/\/$/, "");
    return b ? `${b}/health` : "/health";
  }

  /**
   * @returns {Promise<{ res: Response, text: string, json: object | null }>}
   */
  async function fetchFamHealthRaw() {
    const res = await fetch(famHealthUrl(), {
      method: "GET",
      cache: "no-store",
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { res, text, json };
  }

  /** Best-effort CUDA / device string from merged /health JSON (upstream fields spread in). */
  function pickCudaDeviceLabel(j) {
    if (!j || typeof j !== "object" || Array.isArray(j)) return null;
    const strKeys = [
      "cuda_device",
      "cudaDevice",
      "device_name",
      "device",
      "gpu_name",
      "gpu",
    ];
    for (const k of strKeys) {
      const v = j[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    if (typeof j.cuda_device === "number" && Number.isFinite(j.cuda_device)) {
      return `device id ${j.cuda_device}`;
    }
    if (j.cuda_available === true || j.cuda === true) return "CUDA available";
    return null;
  }

  function updateCornerHealthDisplay(res, json, text) {
    const mid = el.cornerHealthMid;
    const up = el.cornerHealthUp;
    const l2 = el.cornerHealthL2;
    if (!mid || !up || !l2) return;

    mid.textContent = res.ok
      ? `MID: Ok ${res.status}`
      : `MID: Err ${res.status}`;

    let upText = "UP: —";
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const hasOk = typeof json.upstream_ok === "boolean";
      const hasSt = typeof json.upstream_status === "number";
      if (hasOk && hasSt) {
        upText = `UP: ${json.upstream_ok ? "OK" : "no"}, HTTP ${json.upstream_status}`;
      } else if (hasOk) {
        upText = `UP: ${json.upstream_ok ? "OK" : "no"}`;
      } else if (hasSt) {
        upText = `UP: —, HTTP ${json.upstream_status}`;
      }
    }
    up.textContent = upText;

    let l2Text = "device: —";
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const dev = pickCudaDeviceLabel(json);
      if (dev) l2Text = `DEV: ${dev}`;
      else if (json.model_configured === false) {
        l2Text =
          typeof json.detail === "string" && json.detail.trim()
            ? json.detail.trim().slice(0, 140)
            : "model API not configured";
      } else if (typeof json.upstream_error === "string" && json.upstream_error) {
        l2Text = json.upstream_error.trim().slice(0, 140);
      }
    } else if (text && text.trim()) {
      l2Text = text.trim().slice(0, 140);
    }
    l2.textContent = l2Text;
  }

  function setCornerHealthLoading() {
    if (el.cornerHealthMid) el.cornerHealthMid.textContent = "…";
    if (el.cornerHealthUp) el.cornerHealthUp.textContent = "…";
    if (el.cornerHealthL2) el.cornerHealthL2.textContent = "…";
  }

  function setCornerHealthFetchError(message) {
    if (!el.cornerHealthMid || !el.cornerHealthUp || !el.cornerHealthL2) return;
    el.cornerHealthMid.textContent = "MID: —";
    el.cornerHealthUp.textContent = "UP: —";
    el.cornerHealthL2.textContent = (message || "unreachable").slice(0, 140);
  }

  async function refreshCornerHealthDisplay() {
    if (!el.cornerHealthMid || !el.cornerHealthUp || !el.cornerHealthL2) return;
    setCornerHealthLoading();
    try {
      const { res, text, json } = await fetchFamHealthRaw();
      updateCornerHealthDisplay(res, json, text);
    } catch (e) {
      setCornerHealthFetchError(e.message || "failed");
    }
  }

  async function cmdStatus() {
    appendLine("system", `Checking ${famHealthUrl()} …`);
    try {
      const { res, text, json } = await fetchFamHealthRaw();
      updateCornerHealthDisplay(res, json, text);
      const ok = res.ok;
      appendLine(
        ok ? "success" : "error",
        ok
          ? `OK ${res.status} — ${text.slice(0, 200)}`
          : `Unhealthy ${res.status} — ${text.slice(0, 200)}`
      );
    } catch (e) {
      setCornerHealthFetchError(e.message || "failed");
      appendLine(
        "error",
        `Health check failed: ${e.message}. Set CONFIG.baseUrl in app.js if your API is elsewhere.`
      );
    }
  }

  async function cmdToAdvanced() {
    if (getUiMode() !== "simple") {
      appendLine("system", "You’re already in advanced mode.");
      return;
    }
    setUiMode("advanced");
    await appendLine("success", "Advanced mode on.");
    await appendLine("system", MODE_ADVANCED_PRIMER, { animate: true });
  }

  async function cmdToSimple() {
    if (getUiMode() === "simple") {
      appendLine("system", "You’re already in simple mode.");
      return;
    }
    setUiMode("simple");
    applySimpleModeChatRules();
    await appendLine("success", "Simple mode on.");
    await appendLine("system", MODE_SIMPLE_PRIMER, { animate: true });
  }

  function cmdMode() {
    if (getUiMode() === "simple") {
      appendLine(
        "system",
        [
          "You’re in simple mode.",
          "",
          "One ongoing chat, no /new or named sessions; /clear starts a new thread in place. Fewer slash commands so the surface stays light.",
          "",
          "Meant for people who mostly want to talk to the model without session tooling. Run /toadvanced for advanced mode.",
        ].join("\n")
      );
    } else {
      appendLine(
        "system",
        [
          "You’re in advanced mode.",
          "",
          "The terminal is built around separate contexts, optional named saves you can reload, sticky memory across turns, and visible settings — so you can branch, revisit, and tune things instead of living in one uninterrupted stream.",
          "",
          "Use /tosimple when you want a single continuous chat and a smaller surface; use /help when you need the exact slash vocabulary.",
        ].join("\n")
      );
    }
  }

  /** Same lookup as /whoami (ipify); used for corner chrome on desktop. */
  async function fetchPublicIp() {
    try {
      const res = await fetch("https://api.ipify.org?format=json", {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const j = await res.json();
      return typeof j.ip === "string" ? j.ip : null;
    } catch {
      return null;
    }
  }

  const FAM_CONNECT_HOST = "216.24.57.1";

  function setCornerConnectText(ipLabel) {
    const node = el.cornerConnect;
    if (!node) return;
    node.textContent = `${ipLabel} connected to ${FAM_CONNECT_HOST}`;
  }

  async function refreshCornerConnectLine() {
    if (!el.cornerConnect) return;
    setCornerConnectText("…");
    const ip = await fetchPublicIp();
    setCornerConnectText(ip || "—");
  }

  function famPingUrl() {
    const b = (CONFIG.baseUrl || "").replace(/\/$/, "");
    return b ? `${b}/api/ping` : "/api/ping";
  }

  /** Round-trip to this app’s server (GET /api/ping). */
  async function measureFamServerPingMs() {
    const url = famPingUrl();
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) return null;
      await res.json();
      return Math.round(performance.now() - t0);
    } catch {
      return null;
    }
  }

  function setCornerPingLabel(ms) {
    const n = el.cornerPing;
    if (!n) return;
    n.textContent =
      ms != null && Number.isFinite(ms) ? `${Math.round(ms)} ms` : "—";
  }

  async function refreshCornerPingDisplay() {
    if (!el.cornerPing) return;
    el.cornerPing.textContent = "…";
    const ms = await measureFamServerPingMs();
    setCornerPingLabel(ms);
  }

  function updateCornerTimeDisplay() {
    const n = el.cornerTime;
    if (!n) return;
    const now = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    n.textContent = `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
  }

  function startCornerMetaClock() {
    if (!el.cornerTime || cornerMetaClockId) return;
    updateCornerTimeDisplay();
    cornerMetaClockId = window.setInterval(updateCornerTimeDisplay, 1000);
  }

  async function cmdWhoami() {
    const dn = getDisplayName();
    appendLine("system", "Looking up IP…");
    const ip = await fetchPublicIp();
    if (ip == null) {
      appendLine("error", "Could not fetch IP (network or lookup failed).");
      return;
    }
    if (dn) {
      appendLine("success", `${dn} from ${ip}`);
    } else {
      appendLine("success", `Public IP: ${ip} (set your name on first visit)`);
    }
  }

  async function cmdPing() {
    if (el.cornerPing) el.cornerPing.textContent = "…";
    appendLine("system", "Measuring round-trip to server…");
    const ms = await measureFamServerPingMs();
    setCornerPingLabel(ms);
    if (ms == null) {
      appendLine("error", "Ping failed (network or server unreachable).");
    } else {
      appendLine("success", `Server ping: ${ms} ms`);
    }
  }

  function handleConfirmLine(line) {
    const u = line.trim().toUpperCase();
    if (u !== "Y" && u !== "N") {
      appendLine("system", "Please answer Y or N.");
      return true;
    }
    const p = pendingConfirm;
    pendingConfirm = null;
    if (u === "N") {
      appendLine("system", "Cancelled.");
      return true;
    }
    if (p.type === "restore") doRestore(/** @type {any} */ (p.data).name);
    else if (p.type === "new") doNew(/** @type {any} */ (p.data).sessionOpt);
    else if (p.type === "remember")
      finishRemember(/** @type {any} */ (p.data).text);
    return true;
  }

  function runSlashCommand(parsed) {
    const cmd = parsed.cmd.toLowerCase();
    const args = tokenizeArgs(parsed.rest);

    if (getUiMode() === "simple") {
      if (cmd === "new") {
        cmdNew(args);
        return;
      }
      if (!SIMPLE_SLASH_COMMANDS.has(cmd)) {
        appendLine(
          "error",
          "That command isn’t available in simple mode. Run /toadvanced for advanced mode, or /help for what you can use."
        );
        return;
      }
    }

    const table = {
      help: () => cmdHelp(args),
      this: () => cmdThis(),
      sessions: () => cmdSessions(),
      rename: () => cmdRename(args),
      drop: () => cmdDrop(args),
      dropall: () => cmdDropAll(),
      store: () => cmdStore(args),
      save: () => cmdSave(),
      restore: () => cmdRestore(args),
      new: () => cmdNew(args),
      replay: () => cmdReplay(),
      history: () => cmdHistory(),
      clear: () => cmdClear(),
      cls: () => cmdCls(),
      memory: () => cmdMemory(),
      remember: () => cmdRemember(args),
      forget: () => cmdForget(args),
      forgetall: () => cmdForgetAll(),
      temperature: () => cmdTemperature(args),
      disablewarnings: () => cmdDisableWarnings(),
      enablewarnings: () => cmdEnableWarnings(),
      status: () => {
        cmdStatus();
      },
      ping: () => {
        void cmdPing();
      },
      whoami: () => {
        cmdWhoami();
      },
      toadvanced: () => {
        void cmdToAdvanced();
      },
      tosimple: () => {
        void cmdToSimple();
      },
      mode: () => cmdMode(),
      mission: () => cmdMission(),
      donate: () => cmdDonate(),
    };

    if (table[cmd]) {
      const fn = table[cmd];
      fn();
      return;
    }
    appendLine("error", `Unknown command: /${cmd}. Try /help.`);
  }

  function appendUserEcho(text) {
    appendLine("user", text);
  }

  function postChatAbort() {
    const b = (CONFIG.baseUrl || "").replace(/\/$/, "");
    void fetch(`${b}/api/chat/abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }

  /**
   * Split buffer on newlines; parse `data: {json}` lines. `rest` has no complete line yet.
   * @param {string} buf
   * @returns {{ rest: string, payloads: object[] }}
   */
  function extractSseDataLines(buf) {
    const payloads = [];
    let rest = buf;
    for (;;) {
      const nl = rest.indexOf("\n");
      if (nl < 0) break;
      const raw = rest.slice(0, nl);
      rest = rest.slice(nl + 1);
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        payloads.push(JSON.parse(jsonStr));
      } catch {
        /* ignore malformed */
      }
    }
    return { rest, payloads };
  }

  async function simulateAIResponse(userText) {
    genAbort = new AbortController();
    const signal = genAbort.signal;
    generating = true;
    streamTabFlush = null;
    el.terminal.classList.add("generating");
    updateTranscriptTypingUi();

    const thinkMs = 400 + Math.floor(Math.random() * 600);
    const base = (CONFIG.baseUrl || "").replace(/\/$/, "");

    /** @type {HTMLDivElement | null} */
    let assistantDiv = null;
    /** @type {HTMLSpanElement | null} */
    let assistantBody = null;
    let pendingFromStream = "";
    /** Cumulative `text` from the stream (preserves `**` for history; may run ahead of display). */
    let streamTextFromModel = "";
    /** Prefix actually painted when char-typewriter lags. */
    let streamDisplayPrefix = "";
    /** @type {ReturnType<typeof setTimeout> | null} */
    let typeTimeoutId = null;
    let sseTextComplete = false;

    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, thinkMs);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          postChatAbort();
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const res = await fetch(`${base}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          messages,
          temperature,
          session_id: getBackendSessionId(),
        }),
        signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Request failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error("No response body (streaming unavailable)");
      }

      assistantDiv = document.createElement("div");
      assistantDiv.className = "line assistant";
      assistantDiv.innerHTML = ASSISTANT_LABEL_HTML;
      assistantBody = document.createElement("span");
      assistantBody.className = "line__body";
      assistantDiv.appendChild(assistantBody);
      const pinBeforeNewAssistant = isOutputNearBottom();
      el.output.appendChild(assistantDiv);
      scrollOutputToBottomIfPinned(pinBeforeNewAssistant);

      pendingFromStream = "";
      streamTextFromModel = "";
      streamDisplayPrefix = "";
      if (typeTimeoutId != null) {
        clearTimeout(typeTimeoutId);
        typeTimeoutId = null;
      }
      sseTextComplete = false;

      const useCharTyping =
        typeof window.matchMedia !== "undefined" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function cancelStreamTypewriter() {
        if (typeTimeoutId != null) {
          clearTimeout(typeTimeoutId);
          typeTimeoutId = null;
        }
        pendingFromStream = "";
      }

      function pumpTypewriter() {
        typeTimeoutId = null;
        if (!assistantBody) return;
        if (pendingFromStream.length === 0) return;
        const ch = pendingFromStream[0];
        pendingFromStream = pendingFromStream.slice(1);
        const pinBefore = isOutputNearBottom();
        streamDisplayPrefix += ch;
        assistantBody.innerHTML = formatAssistantBodyHtmlForTyping(streamDisplayPrefix);
        scrollOutputToBottomIfPinned(pinBefore);
        if (pendingFromStream.length > 0) {
          typeTimeoutId = setTimeout(pumpTypewriter, TYPEWRITER_MS_PER_CHAR);
        }
      }

      function enqueueStreamText(s) {
        if (!s || !assistantBody) return;
        streamTextFromModel += s;
        if (!useCharTyping) {
          const pinBefore = isOutputNearBottom();
          streamDisplayPrefix = streamTextFromModel;
          assistantBody.innerHTML = formatAssistantBodyHtmlForTyping(
            streamDisplayPrefix
          );
          scrollOutputToBottomIfPinned(pinBefore);
          return;
        }
        pendingFromStream += s;
        if (typeTimeoutId == null) {
          pumpTypewriter();
        }
      }

      streamTabFlush = () => {
        if (document.visibilityState !== "visible") return;
        if (!assistantBody) return;
        if (!useCharTyping) {
          if (streamDisplayPrefix !== streamTextFromModel) {
            const pinB = isOutputNearBottom();
            streamDisplayPrefix = streamTextFromModel;
            assistantBody.innerHTML = formatAssistantBodyHtmlForTyping(
              streamDisplayPrefix
            );
            scrollOutputToBottomIfPinned(pinB);
          }
          return;
        }
        if (
          pendingFromStream.length === 0 &&
          streamDisplayPrefix === streamTextFromModel
        ) {
          return;
        }
        if (typeTimeoutId != null) {
          clearTimeout(typeTimeoutId);
          typeTimeoutId = null;
        }
        pendingFromStream = "";
        streamDisplayPrefix = streamTextFromModel;
        const pinB = isOutputNearBottom();
        assistantBody.innerHTML = formatAssistantBodyHtmlForTyping(
          streamDisplayPrefix
        );
        scrollOutputToBottomIfPinned(pinB);
      };

      async function drainStreamTypewriter() {
        while (true) {
          if (signal.aborted) {
            cancelStreamTypewriter();
            throw new DOMException("Aborted", "AbortError");
          }
          const idle =
            sseTextComplete &&
            pendingFromStream.length === 0 &&
            typeTimeoutId == null;
          if (idle) return;
          await new Promise((r) => setTimeout(r, 16));
        }
      }

      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      let sseBuf = "";
      /** @type {Record<string, unknown> | null} */
      let donePayload = null;

      const applyPayloads = (payloads) => {
        for (const obj of payloads) {
          if (obj == null || typeof obj !== "object") continue;
          if ("error" in obj && obj.error != null) {
            throw new Error(
              typeof obj.error === "string" ? obj.error : "Stream error"
            );
          }
          if (obj.done === true) {
            donePayload = obj;
            return true;
          }
          if (typeof obj.text === "string" && obj.text.length > 0) {
            enqueueStreamText(obj.text);
          }
        }
        return false;
      };

      for (;;) {
        if (signal.aborted) {
          await reader.cancel().catch(() => {});
          throw new DOMException("Aborted", "AbortError");
        }
        let readResult;
        try {
          readResult = await reader.read();
        } catch (readErr) {
          if (signal.aborted || readErr?.name === "AbortError") {
            throw new DOMException("Aborted", "AbortError");
          }
          throw readErr;
        }
        const { done, value } = readResult;
        if (value && value.length) {
          sseBuf += decoder.decode(value, { stream: true });
        }
        const extracted = extractSseDataLines(sseBuf);
        sseBuf = extracted.rest;
        if (applyPayloads(extracted.payloads)) {
          await reader.cancel().catch(() => {});
          break;
        }
        if (done) {
          sseBuf += decoder.decode();
          const tail = extractSseDataLines(sseBuf);
          sseBuf = tail.rest;
          if (applyPayloads(tail.payloads)) {
            await reader.cancel().catch(() => {});
          }
          break;
        }
      }

      sseTextComplete = true;
      await drainStreamTypewriter();

      if (donePayload && typeof donePayload === "object") {
        const serverReply =
          typeof donePayload.reply === "string" ? donePayload.reply : "";
        const reply =
          serverReply.length > 0 ? serverReply : streamTextFromModel;
        if (!reply.trim()) {
          assistantDiv.remove();
          throw new Error("Empty model reply");
        }
        messages.push({ role: "assistant", content: reply });
        {
          const pinBefore = isOutputNearBottom();
          assistantBody.innerHTML = formatAssistantBodyHtml(reply);
          scrollOutputToBottomIfPinned(pinBefore);
        }
      } else if (streamTextFromModel.trim() || assistantBody.textContent.trim()) {
        const content = streamTextFromModel.trim() || assistantBody.textContent;
        messages.push({
          role: "assistant",
          content,
        });
        {
          const pinBefore = isOutputNearBottom();
          assistantBody.innerHTML = formatAssistantBodyHtml(content);
          scrollOutputToBottomIfPinned(pinBefore);
        }
      } else {
        assistantDiv.remove();
        throw new Error("Stream ended without a reply");
      }
    } catch (e) {
      if (assistantBody) {
        if (typeTimeoutId != null) {
          clearTimeout(typeTimeoutId);
          typeTimeoutId = null;
        }
        pendingFromStream = "";
      }
      const partialRaw =
        (streamTextFromModel && streamTextFromModel.trim()) ||
        (assistantBody && assistantBody.textContent.trim());
      if (e.name === "AbortError") {
        if (partialRaw && assistantBody) {
          assistantBody.innerHTML = formatAssistantBodyHtml(partialRaw);
          messages.push({ role: "assistant", content: partialRaw });
        } else if (assistantDiv) {
          assistantDiv.remove();
        }
        appendLine("system", "Generation aborted (Ctrl+C).");
      } else {
        if (partialRaw && assistantBody) {
          assistantBody.innerHTML = formatAssistantBodyHtml(partialRaw);
          messages.push({ role: "assistant", content: partialRaw });
        } else if (assistantDiv) {
          assistantDiv.remove();
        }
        appendLine("error", String(e.message || e));
      }
    } finally {
      streamTabFlush = null;
      generating = false;
      genAbort = null;
      el.terminal.classList.remove("generating");
      updateTranscriptTypingUi();
      updateBadge();
      el.input.focus();
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (transcriptTypingDepth > 0 || generating) {
      return;
    }

    const line = el.input.value;
    el.input.value = "";

    if (pendingConfirm) {
      appendUserEcho(line);
      handleConfirmLine(line);
      return;
    }

    if (awaitingDisplayName) {
      const parsedEarly = parseCommand(line);
      if (parsedEarly) {
        const c0 = parsedEarly.cmd.toLowerCase();
        const allowDuringName =
          c0 === "help" ||
          c0 === "whoami" ||
          c0 === "ping" ||
          c0 === "mission" ||
          c0 === "donate";
        if (!allowDuringName) {
          appendUserEcho(parsedEarly.raw);
          appendLine(
            "system",
            "First, type what you’d like to be called (no slash at the start). /help, /whoami, and /ping work meanwhile."
          );
          return;
        }
        appendUserEcho(parsedEarly.raw);
        runSlashCommand(parsedEarly);
        return;
      }
      const name = line.trim();
      if (!name) {
        appendLine("system", "Please enter what you’d like to be called.");
        return;
      }
      if (name.length > MAX_DISPLAY_NAME) {
        appendLine(
          "error",
          `Use at most ${MAX_DISPLAY_NAME} characters for your name.`
        );
        return;
      }
      appendUserEcho(name);
      setDisplayName(name);
      awaitingDisplayName = false;
      awaitingModeChoice = true;
      el.input.placeholder = "simple or advanced";
      await appendLine("success", `Nice to meet you, ${name}.`, {
        animate: true,
      });
      await promptModeChoice();
      return;
    }

    if (awaitingModeChoice) {
      const parsedMode = parseCommand(line);
      if (parsedMode) {
        const c0 = parsedMode.cmd.toLowerCase();
        const allowDuringMode =
          c0 === "help" ||
          c0 === "whoami" ||
          c0 === "ping" ||
          c0 === "mission" ||
          c0 === "donate";
        if (!allowDuringMode) {
          appendUserEcho(parsedMode.raw);
          appendLine(
            "system",
            "Reply with simple or advanced first. /help, /whoami, and /ping still work."
          );
          return;
        }
        appendUserEcho(parsedMode.raw);
        runSlashCommand(parsedMode);
        return;
      }
      const choice = parseModeChoice(line);
      if (!choice) {
        appendLine(
          "system",
          "Please type simple or advanced (short: s for simple; a for advanced)."
        );
        return;
      }
      appendUserEcho(line.trim());
      setUiMode(choice);
      awaitingModeChoice = false;
      el.input.placeholder = "Enter a command or message…";
      if (choice === "simple") {
        applySimpleModeChatRules();
        await appendLine("success", "Simple mode on.");
        await appendLine("system", MODE_SIMPLE_PRIMER, { animate: true });
      } else {
        await appendLine("success", "Advanced mode on.");
        await appendLine("system", MODE_ADVANCED_PRIMER, { animate: true });
      }
      return;
    }

    const parsed = parseCommand(line);
    if (parsed) {
      appendUserEcho(parsed.raw);
      runSlashCommand(parsed);
      return;
    }

    if (!hasContext && getUiMode() !== "simple") {
      appendUserEcho(line);
      appendLine(
        "error",
        "No chat context yet. Run /new to start, then send messages."
      );
      return;
    }

    appendUserEcho(line);
    messages.push({ role: "user", content: line });
    await simulateAIResponse(line);
  }

  function onKeyDown(ev) {
    if (ev.key !== "c" || !ev.ctrlKey) return;
    if (activeTypewriters.size > 0) {
      ev.preventDefault();
      for (const h of [...activeTypewriters]) {
        h.skip();
      }
      return;
    }
    if (generating && genAbort) {
      ev.preventDefault();
      genAbort.abort();
    }
  }

  /** Focus command input; deferred so it wins over other handlers. */
  function focusCommandInput() {
    const input = el.input;
    if (!input) return;
    const run = () => {
      input.focus({ preventScroll: true });
      if (document.activeElement !== input) {
        input.focus();
      }
    };
    requestAnimationFrame(run);
  }

  /**
   * Clicks below the prompt (hit strip, scroll padding, or terminal chrome) focus the input.
   * Capture phase on #terminal so hits aren’t lost; skips transcript / form / links.
   */
  function onTerminalPointerDownCapture(ev) {
    if (!el.input || !el.form || !el.output || !el.terminal) return;
    if (ev.button !== 0) return;
    const t = ev.target;
    if (!(t instanceof Element)) return;

    if (el.form.contains(t)) return;
    if (typeof t.closest === "function" && t.closest("a, button, textarea, select")) {
      return;
    }

    if (t.classList.contains("terminal-below-prompt-hit")) {
      ev.preventDefault();
      focusCommandInput();
      return;
    }

    const inputRect = el.input.getBoundingClientRect();
    if (ev.clientY <= inputRect.bottom) return;

    if (t !== el.output && el.output.contains(t)) return;

    ev.preventDefault();
    focusCommandInput();
  }

  async function boot() {
    document.title = "F.A.M.";
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => {
        cachedPixellariBoldMeasuresWider = null;
      });
    }
    loadSettings();
    updateBadge();
    updateWarnHint();

    el.output.innerHTML = "";

    /* Before any boot `await` so Ctrl+C can skip early animations (e.g. First Amendment quote). */
    el.form.addEventListener("submit", (e) => onSubmit(e));
    el.input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      el.form.requestSubmit();
    });
    document.addEventListener("keydown", onKeyDown, true);
    if (el.terminal) {
      el.terminal.addEventListener("pointerdown", onTerminalPointerDownCapture, true);
    }
    initTerminalScrollbarSync();
    if (!tabFocusFlushListenerAdded) {
      tabFocusFlushListenerAdded = true;
      document.addEventListener("visibilitychange", flushPendingChunksOnTabFocus);
    }
    void refreshCornerConnectLine();
    startCornerMetaClock();
    void refreshCornerPingDisplay();
    void refreshCornerHealthDisplay();

    const storedDisplayName = getDisplayName();
    if (!storedDisplayName) {
      awaitingDisplayName = true;
      el.input.placeholder = "Type your name…";
      await appendLine("system", BOOT_FIRST_AMENDMENT_QUOTE, { animate: true });
      await Promise.all([
        showCornerLogo(),
        appendLine("system", BOOT_WELCOME_FAM_TEXT, {
          className: "line--welcome-white",
          animate: true,
        }),
      ]);
      await appendBootAsciiBanner();
      await appendLine("system", BOOT_CONNECTION_NOTICE, { animate: true });
      await appendLine("system", "What would you like to be called?", {
        animate: true,
      });
    } else {
      void (async () => {
        await new Promise((r) =>
          window.setTimeout(r, RETURNING_USER_CORNER_LOGO_DELAY_MS)
        );
        await showCornerLogo(RETURNING_USER_CORNER_LOGO_GLITCH_MS);
      })();
      await appendLine("system", `Welcome back, ${storedDisplayName}.`, {
        animate: true,
      });
      await appendBootAsciiBanner();
      if (getUiMode() === null) {
        await promptModeChoice();
      } else {
        await appendFinalWelcomeLine();
        applySimpleModeChatRules();
      }
    }

    el.input.focus();
  }

  if (document.getElementById("landing")) {
    window.addEventListener("fam-landing-done", boot, { once: true });
  } else {
    boot();
  }
})();
