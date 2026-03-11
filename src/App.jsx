import { useState, useRef, useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = "709769823975-979bjivkuo95agn5j0g8rtloeu45iorf.apps.googleusercontent.com";

const PRESETS = [
  { id: "default", icon: "🤖", name: "УкрАI", prompt: "" },
  { id: "coder", icon: "💻", name: "Редактор коду", prompt: "Ти — експертний розробник. При написанні коду: завжди додавай коментарі до кожного блоку, перевіряй синтаксис, пояснюй що робить кожна функція, вказуй можливі помилки та як їх уникнути. Пиши тільки робочий, production-ready код." },
  { id: "translator", icon: "🌐", name: "Перекладач", prompt: "Ти — професійний перекладач і лінгвіст. Не просто перекладай дослівно, а: пояснюй сталі вирази та ідіоми, вказуй культурний контекст, пропонуй кілька варіантів перекладу де це доречно, пояснюй граматичні особливості. Перекладай з будь-якої мови на українську або навпаки." },
  { id: "writer", icon: "✍️", name: "Сценарист", prompt: "Ти — творчий сценарист і письменник. Допомагай з: описом локацій (атмосфера, деталі, відчуття), діями персонажів (емоції, жести, мова тіла), діалогами, побудовою сюжету. Пиши яскраво, образно, з деталями." },
  { id: "teacher", icon: "📚", name: "Вчитель", prompt: "Ти — терплячий та зрозумілий вчитель. Пояснюй будь-яку тему: починай з простих аналогій, розбивай на маленькі кроки, наводь реальні приклади з життя, перевіряй розуміння питаннями." },
  { id: "analyst", icon: "📊", name: "Аналітик", prompt: "Ти — бізнес-аналітик та стратег. При аналізі: використовуй структуровані фреймворки (SWOT, 5W, etc.), спирайся на дані та факти, вказуй ризики та можливості, давай конкретні рекомендації." },
];

const BASE_SYSTEM = `Ти — УкрАI, україномовний AI-асистент найвищого рівня. Твоя мова — ТІЛЬКИ УКРАЇНСЬКА.

КРИТИЧНЕ ПРАВИЛО №1 — МОВА: Відповідай ВИКЛЮЧНО українською мовою. Завжди. Без винятків. Російська мова ПОВНІСТЮ ЗАБОРОНЕНА.
КРИТИЧНЕ ПРАВИЛО №2 — ТОЧНІСТЬ: Ніколи не вигадуй факти. Для коду — пиши тільки робочий код з коментарями.
КРИТИЧНЕ ПРАВИЛО №3 — РОБОТА З ФАЙЛАМИ: Якщо тобі надано код файлу — аналізуй ТІЛЬКИ його. Знаходь баги, пояснюй логіку.
КРИТИЧНЕ ПРАВИЛО №4 — ГЕНЕРАЦІЯ ЗОБРАЖЕНЬ: Якщо користувач просить намалювати або згенерувати зображення — відповідай ТІЛЬКИ у форматі: [IMAGE: детальний опис англійською]

Правила відповідей: Будь структурованим — списки, заголовки де потрібно. Давай робочі приклади коду. Будь теплим та мотивуючим.`;

const STORAGE_KEY = "ukrai_chat_history";
function loadChatHistory() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveChatHistory(chats) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch {}
}
function decodeGoogleJWT(token) {
  try {
    const base64 = token.split(".")[1];
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const decoded = JSON.parse(atob(padded));
    return { name: decoded.name || "Користувач", email: decoded.email || "", picture: decoded.picture || null };
  } catch { return { name: "Користувач", email: "", picture: null }; }
}

const TypingDots = () => (
  <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 2px" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #667eea, #764ba2)", animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: `${i * 0.16}s` }} />
    ))}
  </div>
);


// ── HTML PREVIEW MODAL ─────────────────────────────────────────
function HtmlPreviewModal({ html, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", flexDirection: "column", fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "rgba(10,8,20,0.97)", borderBottom: "1px solid rgba(102,126,234,0.3)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🌐</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>HTML Preview</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 20 }}>live</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "preview.html"; a.click(); URL.revokeObjectURL(url); }}
            style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(102,126,234,0.4)", background: "rgba(102,126,234,0.15)", color: "#a78bfa", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ⬇️ Завантажити
          </button>
          <button onClick={onClose}
            style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ✕ Закрити
          </button>
        </div>
      </div>
      <iframe srcDoc={html} style={{ flex: 1, border: "none", background: "#fff" }} sandbox="allow-scripts allow-same-origin" title="HTML Preview" />
    </div>
  );
}

// ── FILE MANAGER MODAL ─────────────────────────────────────────
function FileManagerModal({ files, dark, onClose, onUseFile, onRemoveFile }) {
  const [sel, setSel] = useState(files[0] || null);
  const [copied, setCopied] = useState(false);
  const tc = dark ? "#fff" : "#1a1a2e";
  const sc = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
  const bc = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const pbg = dark ? "rgba(10,8,22,0.99)" : "#fff";

  const ICONS = { js:"🟨",jsx:"⚛️",ts:"🔷",tsx:"⚛️",py:"🐍",html:"🌐",css:"🎨",json:"📋",md:"📝",txt:"📄",csv:"📊",vue:"💚",php:"🐘",java:"☕",c:"⚙️",cpp:"⚙️",go:"🐹",rs:"🦀",swift:"🍎" };
  const icon = (name) => ICONS[name.split(".").pop().toLowerCase()] || "📄";

  const copyFile = () => {
    navigator.clipboard.writeText(sel.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 900, height: "82vh", background: pbg, borderRadius: 22, border: `1px solid ${bc}`, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${bc}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📁</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: tc }}>Менеджер файлів</span>
            <span style={{ fontSize: 12, background: "rgba(102,126,234,0.2)", color: "#a78bfa", padding: "2px 10px", borderRadius: 20 }}>
              {files.length} {files.length === 1 ? "файл" : files.length < 5 ? "файли" : "файлів"}
            </span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${bc}`, background: "transparent", cursor: "pointer", fontSize: 16, color: sc, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* File list sidebar */}
          <div style={{ width: 220, borderRight: `1px solid ${bc}`, overflowY: "auto", padding: "8px", flexShrink: 0, background: dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.02)" }}>
            {files.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 12px", color: sc }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 13 }}>Файлів немає</div>
              </div>
            ) : files.map((f, i) => (
              <div key={i} onClick={() => setSel(f)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 11, cursor: "pointer", marginBottom: 3, background: sel?.name === f.name ? "rgba(102,126,234,0.18)" : "transparent", border: `1px solid ${sel?.name === f.name ? "rgba(102,126,234,0.35)" : "transparent"}`, transition: "all 0.15s" }}
                onMouseEnter={e => { if (sel?.name !== f.name) e.currentTarget.style.background = "rgba(102,126,234,0.08)"; }}
                onMouseLeave={e => { if (sel?.name !== f.name) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon(f.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: tc, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: sc, marginTop: 1 }}>{(f.content.length / 1024).toFixed(1)} KB · {f.content.split("\n").length} рядків</div>
                </div>
              </div>
            ))}
          </div>

          {/* File content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {sel ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${bc}`, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{icon(sel.name)}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: tc }}>{sel.name}</span>
                    <span style={{ fontSize: 11, color: sc, background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", padding: "2px 8px", borderRadius: 8 }}>{sel.content.split("\n").length} рядків</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { onUseFile(sel); onClose(); }}
                      style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(102,126,234,0.4)", background: "rgba(102,126,234,0.15)", color: "#a78bfa", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                      📎 Використати у чаті
                    </button>
                    <button onClick={copyFile}
                      style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${bc}`, background: "transparent", color: tc, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                      {copied ? "✅ Скопійовано" : "📋 Копіювати"}
                    </button>
                    <button onClick={() => { onRemoveFile(sel.name); setSel(files.find(f => f.name !== sel.name) || null); }}
                      style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                      🗑 Видалити
                    </button>
                  </div>
                </div>
                <pre style={{ flex: 1, overflowY: "auto", overflowX: "auto", margin: 0, padding: "16px 20px", fontSize: 13, lineHeight: 1.8, color: dark ? "#e2e8f0" : "#1e293b", background: dark ? "#07060f" : "#f8fafc", fontFamily: "monospace", whiteSpace: "pre", wordBreak: "normal" }}>
                  {sel.content}
                </pre>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: sc }}>
                <span style={{ fontSize: 52 }}>📂</span>
                <span style={{ fontSize: 14 }}>Обери файл зі списку</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── IMAGE MESSAGE ──────────────────────────────────────────────
const ImageMessage = ({ prompt }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => { setSrc(URL.createObjectURL(blob)); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [prompt]);
  return (
    <div style={{ marginTop: 8 }}>
      {loading && <div style={{ width: 260, height: 260, borderRadius: 14, background: "rgba(102,126,234,0.1)", border: "1px solid rgba(102,126,234,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 28, animation: "pulse 1s infinite" }}>🎨</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Генерую зображення...</div>
      </div>}
      {error && <div style={{ fontSize: 13, color: "#f87171" }}>❌ Не вдалось згенерувати. Спробуй ще раз.</div>}
      {src && <>
        <img src={src} alt={prompt} style={{ maxWidth: 300, borderRadius: 14, border: "1px solid rgba(102,126,234,0.3)", boxShadow: "0 8px 30px rgba(0,0,0,0.4)", display: "block" }} />
        <a href={src} download="ukrai-image.jpg" style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#a78bfa", textDecoration: "none" }}>⬇️ Зберегти</a>
      </>}
    </div>
  );
};

// ── FORMAT HELPERS ─────────────────────────────────────────────
// Renders inline **bold** and `code` within a line
const renderInline = (text, dark) => {
  if (!text || typeof text !== "string") return text;
  const result = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "*" && text[i+1] === "*") {
      const close = text.indexOf("**", i + 2);
      if (close !== -1) {
        result.push(<strong key={i} style={{ color: dark ? "#c4b5fd" : "#5b21b6" }}>{text.slice(i+2, close)}</strong>);
        i = close + 2; continue;
      }
    }
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1) {
        result.push(<code key={i} style={{ background: dark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.12)", color: dark ? "#a5f3fc" : "#0e7490", borderRadius: 4, padding: "1px 5px", fontSize: "0.9em", fontFamily: "monospace" }}>{text.slice(i+1, close)}</code>);
        i = close + 1; continue;
      }
    }
    const next = Math.min(
      text.indexOf("**", i) !== -1 ? text.indexOf("**", i) : text.length,
      text.indexOf("`", i) !== -1 ? text.indexOf("`", i) : text.length
    );
    result.push(text.slice(i, next));
    i = next;
    if (i === next && i < text.length && text[i] !== "*" && text[i] !== "`") i++;
  }
  return result;
};
const formatMessage = (text, dark, onPreview) => {
  const imgMatch = text.match(/\[IMAGE:\s*([^\]]+)\]/);
  if (imgMatch) {
    const before = text.slice(0, imgMatch.index).trim();
    return (
      <div>
        {before && <div style={{ marginBottom: 8 }}>{formatTextOnly(before, dark, onPreview)}</div>}
        <ImageMessage prompt={imgMatch[1].trim()} />
      </div>
    );
  }
  return formatTextOnly(text, dark, onPreview);
};

const formatTextOnly = (text, dark, onPreview) => {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("```")) {
      const lines = part.split("\n");
      const lang = lines[0].replace("```", "").trim().toLowerCase();
      const code = lines.slice(1, -1).join("\n");
      const isHtml = lang === "html" || code.includes("<!DOCTYPE") || code.includes("<html") || (code.includes("<div") && code.includes("<style"));
      return (
        <div key={idx} style={{ margin: "10px 0", borderRadius: 10, overflow: "hidden", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.1)", padding: "5px 12px", flexWrap: "wrap", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace" }}>{lang || "code"}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {isHtml && onPreview && (
                <button onClick={() => onPreview(code)}
                  style={{ background: "rgba(102,126,234,0.35)", border: "1px solid rgba(102,126,234,0.5)", borderRadius: 7, cursor: "pointer", fontSize: 11, color: "#ddd6fe", padding: "3px 10px", fontFamily: "inherit", fontWeight: 600 }}>
                  🌐 Відкрити Preview
                </button>
              )}
              <button onClick={() => navigator.clipboard.writeText(code)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)", padding: "2px 8px", borderRadius: 4 }}>
                📋 Копіювати код
              </button>
            </div>
          </div>
          <pre style={{ background: dark ? "#08080f" : "#0f0f1a", padding: "12px 16px", margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.6, color: "#e2e8f0", fontFamily: "monospace" }}>{code}</pre>
        </div>
      );
    }
    return part.split("\n").map((line, i) => {
      if (line.match(/^#{1,3}\s/)) return <div key={i} style={{ fontWeight: 700, fontSize: 15, color: dark ? "#e2d9f3" : "#3730a3", margin: "10px 0 4px" }}>{renderInline(line.replace(/^#{1,3}\s/, ""), dark)}</div>;
      if (line.startsWith("**") && line.endsWith("**") && line.slice(2,-2).indexOf("**") === -1) return <div key={i} style={{ fontWeight: 700, color: dark ? "#c4b5fd" : "#5b21b6", marginBottom: 4 }}>{renderInline(line.slice(2, -2), dark)}</div>;
      if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 16, marginBottom: 4, display: "flex", gap: 8 }}><span style={{ color: "#818cf8", flexShrink: 0 }}>▸</span><span>{renderInline(line.slice(2), dark)}</span></div>;
      if (/^\d+\.\s/.test(line)) { const num = line.match(/^(\d+)\./)[1]; return <div key={i} style={{ paddingLeft: 8, marginBottom: 5, display: "flex", gap: 10 }}><span style={{ color: "#818cf8", fontWeight: 700, minWidth: 20 }}>{num}.</span><span>{renderInline(line.replace(/^\d+\.\s/, ""), dark)}</span></div>; }
      if (line === "") return <div key={i} style={{ height: 6 }} />;
      return <div key={i} style={{ marginBottom: 3, lineHeight: 1.7 }}>{renderInline(line, dark)}</div>;
    });
  });
};

// ── LOGIN SCREEN ───────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loginError, setLoginError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);

  const features = [
    { icon: "⚡", title: "Блискавично", desc: "Відповіді за секунди завдяки Groq" },
    { icon: "🇺🇦", title: "Українською", desc: "Повністю україномовний асистент" },
    { icon: "🔊", title: "Голос", desc: "Говори — бот розуміє українську" },
    { icon: "💾", title: "Історія", desc: "Зберігає розмови на пристрої" },
    { icon: "📁", title: "Файли", desc: "Аналізує код та документи" },
    { icon: "🧠", title: "Розумний", desc: "Llama 3.3 70B — топова модель" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0f", display: "flex", fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {/* Ambient orbs */}
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)", animation: "orbFloat 10s infinite ease-in-out", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%)", animation: "orbFloat2 12s infinite ease-in-out", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "40%", right: "35%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* Left — branding */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: isMobile ? "40px 24px" : "60px 72px", zIndex: 1, borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.04)", overflowY: "auto" }}>
        <div style={{ animation: "fadeInUp 0.8s ease both", maxWidth: 520 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 56 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, animation: "logoPulse 3s infinite ease-in-out", flexShrink: 0 }}>🤖</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #e2e8f0, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>УкрАI</div>
              <div style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", marginTop: 2, fontWeight: 400 }}>powered by Llama 3.3 · Groq</div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: isMobile ? 32 : 48, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-1.5px", lineHeight: 1.15, marginBottom: 20 }}>
            Твій особистий<br />
            <span style={{ background: "linear-gradient(135deg, #818cf8, #c4b5fd, #67e8f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% auto", animation: "shimmer 4s linear infinite" }}>AI-асистент</span>{" "}
            <span style={{ fontSize: isMobile ? 28 : 42 }}>🇺🇦</span>
          </h1>
          <p style={{ fontSize: isMobile ? 14 : 16, color: "rgba(148,163,184,0.7)", marginBottom: 48, lineHeight: 1.75, fontWeight: 400 }}>
            Відповідає на будь-які питання, аналізує файли, розпізнає голос — і все це українською.
          </p>

          {/* Features grid */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {features.map((f, i) => (
              <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", animation: `fadeInUp 0.6s ease ${0.15 + i * 0.06}s both`, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login */}
      {!isMobile && (
        <div style={{ width: 440, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 44px", zIndex: 1, overflowY: "auto" }}>
          <div style={{ width: "100%", animation: "fadeInUp 0.9s ease 0.1s both" }}>
            {/* Card */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: "40px 36px", backdropFilter: "blur(30px)", animation: "borderGlow 4s infinite ease-in-out" }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ fontSize: 44, marginBottom: 16 }}>✨</div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.5px", marginBottom: 8 }}>Почати роботу</h2>
                <p style={{ fontSize: 14, color: "rgba(148,163,184,0.55)", lineHeight: 1.6 }}>Увійди через Google щоб отримати доступ до УкрАI</p>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <GoogleLogin onSuccess={(cr) => { if (!cr?.credential) { setLoginError("Помилка"); return; } onLogin(cr); }} onError={() => setLoginError("Помилка входу")} theme="filled_black" shape="pill" size="large" text="signin_with" locale="uk" useOneTap={false} />
              </div>
              {loginError && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#fca5a5", fontSize: 13, marginBottom: 16, textAlign: "center" }}>⚠️ {loginError}</div>}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["🔒", "Дані захищені та зашифровані"], ["🚫", "Не зберігаємо повідомлення на сервері"], ["⚡", "Вхід займає лічені секунди"]].map(([icon, text], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: "rgba(148,163,184,0.45)", fontWeight: 400 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: "rgba(148,163,184,0.25)", marginTop: 16, lineHeight: 1.6 }}>Продовжуючи, ти погоджуєшся з умовами використання</p>
          </div>
        </div>
      )}

      {/* Mobile login */}
      {isMobile && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflowY: "auto", zIndex: 2, padding: "40px 20px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px", animation: "logoPulse 3s infinite" }}>🤖</div>
            <div style={{ fontSize: 32, fontWeight: 700, background: "linear-gradient(135deg, #e2e8f0, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>УкрАI</div>
            <div style={{ fontSize: 13, color: "rgba(148,163,184,0.5)", marginTop: 4 }}>Асистент нового покоління</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 24, padding: "28px 22px", marginBottom: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>Почати роботу</h3>
              <p style={{ fontSize: 13, color: "rgba(148,163,184,0.5)" }}>Увійди через Google</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <GoogleLogin onSuccess={(cr) => { if (!cr?.credential) { setLoginError("Помилка"); return; } onLogin(cr); }} onError={() => setLoginError("Помилка входу")} theme="filled_black" shape="pill" size="large" text="signin_with" locale="uk" useOneTap={false} />
            </div>
            {loginError && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#fca5a5", fontSize: 13, textAlign: "center" }}>⚠️ {loginError}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ fontSize: 18, marginBottom: 5 }}>{f.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#e2e8f0", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 10, color: "rgba(148,163,184,0.45)", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ── CHAT APP ───────────────────────────────────────────────────
function ChatApp({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [activePreset, setActivePreset] = useState(PRESETS[0]);
  const [showPresets, setShowPresets] = useState(false);
  const [pinnedFacts, setPinnedFacts] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // 📁 Файли — зберігаємо всі, не тільки один
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [showFileManager, setShowFileManager] = useState(false);
  // 🌐 HTML Preview
  const [previewHtml, setPreviewHtml] = useState(null);
  // Решта
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const [chatHistory, setChatHistory] = useState(loadChatHistory);
  const [currentChatId, setCurrentChatId] = useState(null);
  // 📊 Аналітика
  const [showStats, setShowStats] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [totalTokensIn, setTotalTokensIn] = useState(() => { try { return parseInt(localStorage.getItem("ukrai_tokens_in") || "0"); } catch { return 0; } });
  const [totalTokensOut, setTotalTokensOut] = useState(() => { try { return parseInt(localStorage.getItem("ukrai_tokens_out") || "0"); } catch { return 0; } });
  const [totalRequests, setTotalRequests] = useState(() => { try { return parseInt(localStorage.getItem("ukrai_requests") || "0"); } catch { return 0; } });
  const [streamingText, setStreamingText] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (messages.length === 0) return;
    const chatId = currentChatId || Date.now().toString();
    if (!currentChatId) setCurrentChatId(chatId);
    const title = messages[0]?.content?.slice(0, 40) || "Новий чат";
    const updated = chatHistory.filter(c => c.id !== chatId);
    const newHistory = [{ id: chatId, title, date: new Date().toLocaleDateString("uk-UA"), messages, apiMessages, preset: activePreset }, ...updated].slice(0, 20);
    setChatHistory(newHistory); saveChatHistory(newHistory);
  }, [messages]);

  const dark = darkMode;
  const bg = dark ? "#0a0a0f" : "#f8fafc";
  const sidebarBg = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)";
  const borderColor = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const textColor = dark ? "#f1f5f9" : "#0f172a";
  const subColor = dark ? "rgba(148,163,184,0.6)" : "rgba(71,85,105,0.7)";
  const panelBg = dark ? "rgba(13,13,20,0.99)" : "rgba(255,255,255,0.99)";
  const accentColor = "#6366f1";
  const accentGrad = "linear-gradient(135deg, #6366f1, #8b5cf6)";

  const getSystemPrompt = () => {
    let sys = BASE_SYSTEM;
    if (activePreset.prompt) sys = activePreset.prompt + "\n\n" + BASE_SYSTEM;
    if (pinnedFacts.length > 0) sys += "\n\nЗАКРІПЛЕНІ ФАКТИ:\n" + pinnedFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
    return sys;
  };

  const toggleVoice = () => {
    if (!voiceSupported) { alert("Голосовий ввід не підтримується у вашому браузері"); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); r.lang = "uk-UA"; r.continuous = false; r.interimResults = false;
    r.onresult = (e) => { setInput(prev => prev + e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false); r.onend = () => setIsListening(false);
    recognitionRef.current = r; r.start(); setIsListening(true);
  };

  const copyMessage = (text, idx) => { navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); };
  const pinFact = (text) => { setPinnedFacts(prev => [...prev, text.slice(0, 200)]); };
  const startNewChat = () => { setMessages([]); setApiMessages([]); setCurrentChatId(null); setActiveFile(null); closeAll(); };
  const loadChat = (chat) => { setMessages(chat.messages); setApiMessages(chat.apiMessages || []); setActivePreset(chat.preset || PRESETS[0]); setCurrentChatId(chat.id); setShowHistory(false); };
  const deleteChat = (id, e) => { e.stopPropagation(); const u = chatHistory.filter(c => c.id !== id); setChatHistory(u); saveChatHistory(u); if (currentChatId === id) startNewChat(); };
  const closeAll = () => { setShowPresets(false); setShowPinned(false); setShowExport(false); setShowMobileMenu(false); setShowHistory(false); setShowStats(false); };

  const exportChat = (format) => {
    if (messages.length === 0) return;
    let content = ""; const date = new Date().toLocaleDateString("uk-UA");
    if (format === "txt") { content = `УкрАI — Експорт чату (${date})\n${"=".repeat(40)}\n\n`; messages.forEach(m => { content += `[${m.role === "user" ? "Ви" : "УкрАI"}]\n${m.content}\n\n`; }); }
    else if (format === "json") { content = JSON.stringify({ date, model: "llama-3.3-70b", preset: activePreset.name, messages }, null, 2); }
    else if (format === "md") { content = `# УкрАI — Чат (${date})\n\n`; messages.forEach(m => { content += `## ${m.role === "user" ? "👤 Ви" : "🤖 УкрАI"}\n\n${m.content}\n\n---\n\n`; }); }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ukrai-chat-${Date.now()}.${format}`; a.click();
    setShowExport(false);
  };

  // 📁 Завантаження — додаємо до списку, не замінюємо
  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newFile = { name: file.name, content: ev.target.result };
      setUploadedFiles(prev => [...prev.filter(f => f.name !== file.name), newFile]);
      setActiveFile(newFile);
    };
    reader.readAsText(file); e.target.value = "";
  };
  const removeFile = (name) => { setUploadedFiles(prev => prev.filter(f => f.name !== name)); if (activeFile?.name === name) setActiveFile(null); };

  const sendMessage = async () => {
    const text = input.trim(); if (!text || loading) return;
    setInput(""); if (textareaRef.current) textareaRef.current.style.height = "auto";
    let apiText = text;
    if (activeFile) {
      const ext = activeFile.name.split(".").pop().toLowerCase();
      const isCode = ["js","jsx","ts","tsx","py","html","css","json","md","txt","csv","vue","php","java","c","cpp","cs","go","rb","rs","swift"].includes(ext);
      apiText = isCode
        ? `Я завантажив файл "${activeFile.name}" (${ext.toUpperCase()}). Ось його ПОВНИЙ вміст:\n\`\`\`${ext}\n${activeFile.content}\n\`\`\`\n\nМоє питання: ${text}\n\nАналізуй ТІЛЬКИ цей код. Знайди баги, поясни логіку, дай конкретні поради.`
        : `Я завантажив файл "${activeFile.name}". Його вміст:\n---\n${activeFile.content.slice(0, 8000)}\n---\n\nМоє питання: ${text}`;
    }
    const displayText = activeFile ? `📎 ${activeFile.name}\n${text}` : text;
    const newApiMsgs = [...apiMessages, { role: "user", content: apiText }];
    const newDispMsgs = [...messages, { role: "user", content: displayText }];
    setMessages(newDispMsgs); setApiMessages(newApiMsgs);
    setActiveFile(null); setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: getSystemPrompt(), messages: newApiMsgs, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "API помилка");
      const reply = data.content?.map(b => b.text).join("") || "Порожня відповідь.";
      // Аналітика
      const newIn = totalTokensIn + (data.usage?.inputTokens || 0);
      const newOut = totalTokensOut + (data.usage?.outputTokens || 0);
      const newReqs = totalRequests + 1;
      setTotalTokensIn(newIn); setTotalTokensOut(newOut); setTotalRequests(newReqs);
      try { localStorage.setItem("ukrai_tokens_in", newIn); localStorage.setItem("ukrai_tokens_out", newOut); localStorage.setItem("ukrai_requests", newReqs); } catch {}
      const aMsg = { role: "assistant", content: reply };
      setMessages([...newDispMsgs, aMsg]); setApiMessages([...newApiMsgs, aMsg]);
    } catch (err) {
      const errMsg = { role: "assistant", content: "⚠️ Помилка: " + err.message };
      setMessages([...newDispMsgs, errMsg]); setApiMessages([...newApiMsgs, errMsg]);
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  const suggestions = ["💻 Напиши сайт на HTML", "📰 Які новини сьогодні?", "💱 Який курс долара зараз?", "🧮 Розв'яжи: x² + 5x + 6 = 0", "📝 Склади резюме для розробника", "🔍 Поясни як працює React"];

  const SideBtn = ({ onClick, title, emoji, danger, active }) => (
    <button onClick={onClick} title={title}
      style={{ width: 44, height: 44, borderRadius: 13, background: active ? "rgba(99,102,241,0.2)" : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"), border: `1px solid ${active ? "rgba(99,102,241,0.45)" : borderColor}`, cursor: "pointer", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#a5b4fc" : subColor, transition: "all 0.2s", position: "relative" }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)"; e.currentTarget.style.color = danger ? "#ef4444" : "#a5b4fc"; }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(99,102,241,0.2)" : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"); e.currentTarget.style.color = active ? "#a5b4fc" : subColor; }}>
      {emoji}
    </button>
  );

  const mobileMenuItems = [
    { emoji: "💬", label: "Новий чат", action: startNewChat },
    { emoji: "📂", label: "Історія чатів", action: () => { setShowHistory(!showHistory); setShowMobileMenu(false); } },
    { emoji: "📁", label: `Файли (${uploadedFiles.length})`, action: () => { setShowFileManager(true); setShowMobileMenu(false); } },
    { emoji: "🎭", label: "Ролі/Пресети", action: () => { setShowPresets(!showPresets); setShowMobileMenu(false); } },
    { emoji: "📌", label: "Закріплені факти", action: () => { setShowPinned(!showPinned); setShowMobileMenu(false); } },
    { emoji: "📎", label: "Завантажити файл", action: () => { fileInputRef.current?.click(); setShowMobileMenu(false); } },
    { emoji: "💾", label: "Експорт чату", action: () => { setShowExport(!showExport); setShowMobileMenu(false); } },
    { emoji: "📊", label: "Аналітика", action: () => { setShowStats(!showStats); setShowMobileMenu(false); } },
    { emoji: dark ? "☀️" : "🌙", label: dark ? "Світла тема" : "Темна тема", action: () => { setDarkMode(!dark); setShowMobileMenu(false); } },
    { emoji: "🗑", label: "Очистити чат", action: () => { if (window.confirm("Очистити чат?")) startNewChat(); setShowMobileMenu(false); }, danger: true },
  ];

  const FilesBtn = ({ mobile }) => (
    <button onClick={() => setShowFileManager(true)}
      style={{ display: "flex", alignItems: "center", gap: mobile ? 0 : 7, padding: mobile ? "0" : "7px 14px", width: mobile ? 36 : "auto", height: mobile ? 36 : "auto", borderRadius: 12, border: `1px solid ${uploadedFiles.length > 0 ? "rgba(99,102,241,0.4)" : borderColor}`, background: uploadedFiles.length > 0 ? "rgba(99,102,241,0.12)" : "transparent", color: uploadedFiles.length > 0 ? "#a5b4fc" : subColor, cursor: "pointer", fontSize: mobile ? 16 : 13, fontFamily: "inherit", justifyContent: "center", position: "relative", transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; e.currentTarget.style.color = "#a5b4fc"; }}
      onMouseLeave={e => { e.currentTarget.style.background = uploadedFiles.length > 0 ? "rgba(99,102,241,0.12)" : "transparent"; e.currentTarget.style.color = uploadedFiles.length > 0 ? "#a5b4fc" : subColor; }}>
      📁{!mobile && " Файли"}
      {uploadedFiles.length > 0 && (
        <span style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", borderRadius: 20, padding: mobile ? "1px 0" : "1px 7px", fontSize: 10, fontWeight: 700, minWidth: mobile ? 17 : "auto", height: mobile ? 17 : "auto", display: "flex", alignItems: "center", justifyContent: "center", position: mobile ? "absolute" : "static", top: mobile ? -5 : "auto", right: mobile ? -5 : "auto" }}>
          {uploadedFiles.length}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: bg, display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", overflow: "hidden", transition: "background 0.3s" }}>

      {/* MODALS */}
      {previewHtml && <HtmlPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
      {showFileManager && <FileManagerModal files={uploadedFiles} dark={dark} onClose={() => setShowFileManager(false)} onUseFile={(f) => setActiveFile(f)} onRemoveFile={removeFile} />}

      {/* MOBILE HEADER */}
      {isMobile && (
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", flexShrink: 0, zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{activePreset.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: textColor }}>УкрАI</div>
              <div style={{ fontSize: 10, color: subColor, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />{activePreset.name}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <FilesBtn mobile />
            <button onClick={() => { setShowMobileMenu(!showMobileMenu); setShowHistory(false); setShowPresets(false); }}
              style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", border: `1px solid ${borderColor}`, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: textColor }}>☰</button>
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: "2px solid rgba(99,102,241,0.45)" }} onClick={onLogout}>
              {user?.picture ? <img src={user.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE MENU */}
      {isMobile && showMobileMenu && (
        <div style={{ position: "absolute", top: 60, right: 10, width: 230, background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 18, padding: 12, zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
          {mobileMenuItems.map((item, i) => (
            <button key={i} onClick={item.action}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: "transparent", cursor: "pointer", color: item.danger ? "#ef4444" : textColor, fontSize: 14, textAlign: "left", fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = item.danger ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize: 18 }}>{item.emoji}</span>{item.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT SIDEBAR (ChatGPT style) ── */}
        {!isMobile && (
          <div style={{ width: showLeftSidebar ? 260 : 0, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)", borderRight: showLeftSidebar ? `1px solid ${borderColor}` : "none", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", transition: "width 0.25s ease" }}>
            {showLeftSidebar && (
              <>
                {/* Sidebar Header */}
                <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{activePreset.icon}</div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: textColor }}>УкрАI</span>
                  </div>
                  <button onClick={startNewChat} title="Новий чат"
                    style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: subColor }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.12)"; e.currentTarget.style.color = "#a5b4fc"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = subColor; }}>
                    ✏️
                  </button>
                </div>

                {/* Chat History List */}
                <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
                  {chatHistory.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 16px", color: subColor }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                      <div style={{ fontSize: 13 }}>Немає чатів</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: subColor, padding: "6px 8px 4px", letterSpacing: "0.05em" }}>ВАШІ ЧАТИ</div>
                      {chatHistory.map(chat => (
                        <div key={chat.id} onClick={() => loadChat(chat)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10, cursor: "pointer", marginBottom: 2, background: currentChatId === chat.id ? (dark ? "rgba(99,102,241,0.15)" : "rgba(102,126,234,0.12)") : "transparent", transition: "background 0.15s" }}
                          onMouseEnter={e => { if (currentChatId !== chat.id) e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                          onMouseLeave={e => { if (currentChatId !== chat.id) e.currentTarget.style.background = "transparent"; }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: currentChatId === chat.id ? (dark ? "#c4b5fd" : "#5b21b6") : textColor, fontWeight: currentChatId === chat.id ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.title}</div>
                            <div style={{ fontSize: 10, color: subColor, marginTop: 1 }}>{chat.date}</div>
                          </div>
                          <button onClick={(e) => deleteChat(chat.id, e)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13, padding: "2px 4px", opacity: 0, transition: "opacity 0.15s", flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                            onMouseLeave={e => e.currentTarget.style.opacity = "0"}>🗑</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Sidebar Footer */}
                <div style={{ padding: "12px 14px", borderTop: `1px solid ${borderColor}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, background: dark ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.03)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(99,102,241,0.35)", cursor: "pointer" }} onClick={onLogout} title="Вийти">
                    {user?.picture ? <img src={user.picture} alt="" style={{ width: "100%", height: "100%" }} /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: textColor, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Користувач"}</div>
                    <div style={{ fontSize: 10, color: subColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || ""}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".txt,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.md,.csv,.vue,.php,.java,.c,.cpp,.cs,.go,.rb,.rs,.swift" style={{ display: "none" }} onChange={handleFileUpload} />

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Desktop Header */}
          {!isMobile && (
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(10px)", flexShrink: 0, gap: 12 }}>
              {/* Left: sidebar toggle + title */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setShowLeftSidebar(p => !p)} title="Сайдбар"
                  style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${borderColor}`, background: showLeftSidebar ? "rgba(99,102,241,0.12)" : "transparent", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: showLeftSidebar ? "#a5b4fc" : subColor, transition: "all 0.2s" }}>
                  ☰
                </button>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: textColor }}>УкрАI</span>
                    <span style={{ fontSize: 12, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", padding: "2px 8px", borderRadius: 20 }}>{activePreset.icon} {activePreset.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: subColor, display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }} />
                    Llama 3.3 70B · Groq
                    {pinnedFacts.length > 0 && <span style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>📌 {pinnedFacts.length}</span>}
                    {activeFile && <span style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>📎 {activeFile.name}</span>}
                  </div>
                </div>
              </div>
              {/* Right: tools toggle + files + greeting */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FilesBtn />
                <span style={{ fontSize: 13, color: subColor }}>Привіт, {user?.name?.split(" ")[0] || "Друже"}! 👋</span>
                <button onClick={() => setShowRightPanel(p => !p)} title="Інструменти"
                  style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${showRightPanel ? "rgba(99,102,241,0.45)" : borderColor}`, background: showRightPanel ? "rgba(99,102,241,0.12)" : "transparent", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: showRightPanel ? "#a5b4fc" : subColor, transition: "all 0.2s" }}>
                  ⚙️
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px 24px", display: "flex", flexDirection: "column", gap: isMobile ? 12 : 18 }} onClick={closeAll}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: isMobile ? 16 : 24, padding: isMobile ? "20px 8px" : "40px 20px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: isMobile ? 44 : 60, marginBottom: 12, animation: "logoPulse 3s infinite" }}>{activePreset.icon}</div>
                  <h2 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color: textColor, marginBottom: 8, letterSpacing: "-0.5px" }}>
                    {activePreset.id === "default" ? "Чим можу допомогти?" : `Режим: ${activePreset.name}`}
                  </h2>
                  <p style={{ fontSize: isMobile ? 13 : 14, color: subColor, maxWidth: 400, lineHeight: 1.7, margin: "0 auto" }}>
                    {activePreset.id === "default" ? "Запитай про що завгодно, попроси намалювати або говори голосом!" : activePreset.prompt.slice(0, 120) + "..."}
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8, maxWidth: 660, width: "100%" }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setInput(s.slice(2)); textareaRef.current?.focus(); }}
                      style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)", border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, borderRadius: 12, padding: isMobile ? "10px" : "14px", color: dark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)", cursor: "pointer", fontSize: isMobile ? 12 : 13, textAlign: "left", fontFamily: "inherit", lineHeight: 1.4 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.12)"; e.currentTarget.style.color = dark ? "#fff" : "#1a1a2e"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"; e.currentTarget.style.color = dark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)"; }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: isMobile ? 6 : 10, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeInUp 0.3s ease both" }}>
                {m.role === "assistant" && (
                  <div style={{ width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 13 : 17, flexShrink: 0, marginTop: 2, boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }}>{activePreset.icon}</div>
                )}
                <div style={{ maxWidth: isMobile ? "85%" : "74%", display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ padding: isMobile ? "10px 13px" : "12px 16px", borderRadius: m.role === "user" ? "18px 18px 5px 18px" : "5px 18px 18px 18px", background: m.role === "user" ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : (dark ? "rgba(255,255,255,0.04)" : "#ffffff"), color: m.role === "user" ? "#fff" : textColor, fontSize: isMobile ? 14 : 14.5, lineHeight: 1.7, border: m.role === "assistant" ? `1px solid ${borderColor}` : "none", boxShadow: m.role === "user" ? "0 8px 30px rgba(99,102,241,0.3)" : (dark ? "0 2px 10px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.08)"), whiteSpace: m.role === "user" ? "pre-wrap" : "normal" }}>
                    {m.role === "assistant" ? formatMessage(m.content, dark, setPreviewHtml) : m.content}
                  </div>
                  {m.role === "assistant" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => copyMessage(m.content, i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: subColor, padding: "2px 6px", borderRadius: 6, fontFamily: "inherit" }} onMouseEnter={e => e.currentTarget.style.color = "#a5b4fc"} onMouseLeave={e => e.currentTarget.style.color = subColor}>
                        {copiedIdx === i ? "✅ Скопійовано" : "📋 Копіювати"}
                      </button>
                      <button onClick={() => pinFact(m.content)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: subColor, padding: "2px 6px", borderRadius: 6, fontFamily: "inherit" }} onMouseEnter={e => e.currentTarget.style.color = "#fbbf24"} onMouseLeave={e => e.currentTarget.style.color = subColor}>
                        📌 Закріпити
                      </button>
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div style={{ width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: 10, overflow: "hidden", flexShrink: 0, marginTop: 2, border: "1.5px solid rgba(99,102,241,0.35)" }}>
                    {user?.picture ? <img src={user.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: isMobile ? 6 : 10, animation: "fadeInUp 0.3s ease both" }}>
                <div style={{ width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 13 : 17, flexShrink: 0, boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }}>{activePreset.icon}</div>
                <div style={{ background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)", border: `1px solid ${borderColor}`, borderRadius: "5px 18px 18px 18px", padding: "10px 16px", maxWidth: isMobile ? "85%" : "74%" }}>
                  {streamingText ? (
                    <div style={{ fontSize: isMobile ? 14 : 14.5, lineHeight: 1.7, color: textColor }}>
                      {formatTextOnly(streamingText, dark, setPreviewHtml)}
                      <span style={{ display: "inline-block", width: 8, height: 14, background: "#a5b4fc", borderRadius: 2, marginLeft: 3, animation: "typingBounce 1s infinite" }} />
                    </div>
                  ) : <TypingDots />}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Active file bar */}
          {activeFile && (
            <div style={{ padding: "8px 14px", background: dark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)", borderTop: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>📎</span>
              <span style={{ fontSize: 13, color: "#22c55e", flex: 1 }}>{activeFile.name} — готовий до аналізу</span>
              <button onClick={() => setShowFileManager(true)} style={{ background: "none", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, cursor: "pointer", color: "#22c55e", fontSize: 12, padding: "2px 10px", fontFamily: "inherit" }}>📁 Всі файли</button>
              <button onClick={() => setActiveFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}>✕</button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: isMobile ? "8px 10px 12px" : "12px 20px 14px", borderTop: `1px solid ${borderColor}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.6)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`, borderRadius: 16, padding: "6px 6px 6px 14px" }}
              onFocusCapture={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)"}
              onBlurCapture={e => { e.currentTarget.style.borderColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"; e.currentTarget.style.boxShadow = "none"; }}>
              <textarea ref={textareaRef} value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); sendMessage(); } }}
                placeholder={isListening ? "🎤 Слухаю..." : (activePreset.id === "default" ? "Запитай або попроси намалювати..." : `Режим: ${activePreset.name}...`)}
                rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: isListening ? "#a5b4fc" : textColor, fontSize: isMobile ? 16 : 15, fontFamily: "inherit", lineHeight: 1.6, resize: "none", overflow: "hidden", paddingTop: 4 }} />
              {voiceSupported && (
                <button onClick={toggleVoice}
                  style={{ width: isMobile ? 36 : 38, height: isMobile ? 36 : 38, borderRadius: 10, border: "none", background: isListening ? "rgba(239,68,68,0.2)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, animation: isListening ? "pulse 1s infinite" : "none" }}>
                  {isListening ? "🔴" : "🎤"}
                </button>
              )}
              <button onClick={sendMessage} disabled={loading || !input.trim()}
                style={{ width: isMobile ? 40 : 42, height: isMobile ? 40 : 42, borderRadius: 11, border: "none", background: !loading && input.trim() ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), cursor: !loading && input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, transition: "all 0.2s", boxShadow: !loading && input.trim() ? "0 4px 16px rgba(99,102,241,0.35)" : "none", flexShrink: 0 }}>
                {loading ? "⏳" : "➤"}
              </button>
            </div>
            {!isMobile && <p style={{ textAlign: "center", fontSize: 11, color: subColor, marginTop: 6, opacity: 0.6 }}>Enter — надіслати · Shift+Enter — новий рядок · 🎤 — голос</p>}
          </div>
        </div>

        {/* ── RIGHT PANEL (Tools) ── */}
        {!isMobile && (
          <div style={{ width: showRightPanel ? 260 : 0, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)", borderLeft: showRightPanel ? `1px solid ${borderColor}` : "none", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", transition: "width 0.25s ease" }}>
            {showRightPanel && (
              <div style={{ padding: "14px 14px", overflowY: "auto", flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginBottom: 12, letterSpacing: "0.05em" }}>ІНСТРУМЕНТИ</div>

                {/* Presets */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: subColor, marginBottom: 8, fontWeight: 600 }}>🎭 Роль</div>
                  {PRESETS.map(p => (
                    <button key={p.id} onClick={() => setActivePreset(p)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: activePreset.id === p.id ? "1px solid rgba(99,102,241,0.45)" : `1px solid transparent`, background: activePreset.id === p.id ? "rgba(99,102,241,0.12)" : "transparent", cursor: "pointer", marginBottom: 3, textAlign: "left", fontFamily: "inherit" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = activePreset.id === p.id ? "rgba(99,102,241,0.12)" : "transparent"}>
                      <span style={{ fontSize: 18 }}>{p.icon}</span>
                      <span style={{ fontSize: 13, color: textColor, fontWeight: activePreset.id === p.id ? 600 : 400 }}>{p.name}</span>
                      {activePreset.id === p.id && <span style={{ marginLeft: "auto", color: "#6366f1" }}>✓</span>}
                    </button>
                  ))}
                </div>

                <div style={{ height: 1, background: borderColor, margin: "12px 0" }} />

                {/* Actions */}
                <div style={{ fontSize: 12, color: subColor, marginBottom: 8, fontWeight: 600 }}>⚡ Дії</div>
                {[
                  { emoji: "📎", label: "Завантажити файл", action: () => fileInputRef.current?.click() },
                  { emoji: "📌", label: `Закріплені (${pinnedFacts.length})`, action: () => { setShowPinned(!showPinned); closeAll(); setShowRightPanel(true); } },
                  { emoji: "💾", label: "Експорт чату", action: () => { setShowExport(!showExport); closeAll(); setShowRightPanel(true); } },
                  { emoji: "📊", label: "Аналітика", action: () => { setShowStats(!showStats); closeAll(); setShowRightPanel(true); } },
                  { emoji: dark ? "☀️" : "🌙", label: dark ? "Світла тема" : "Темна тема", action: () => setDarkMode(!dark) },
                ].map((item, i) => (
                  <button key={i} onClick={item.action}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: textColor, fontSize: 13, textAlign: "left", fontFamily: "inherit", marginBottom: 2 }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 17 }}>{item.emoji}</span>{item.label}
                  </button>
                ))}

                {/* Pinned facts inline */}
                {showPinned && pinnedFacts.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: 12, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginBottom: 8 }}>📌 ЗАКРІПЛЕНІ</div>
                    {pinnedFacts.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <div style={{ flex: 1, fontSize: 12, color: textColor, lineHeight: 1.5 }}>{f.slice(0, 80)}{f.length > 80 ? "…" : ""}</div>
                        <button onClick={() => setPinnedFacts(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Export inline */}
                {showExport && (
                  <div style={{ marginTop: 12, padding: 12, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: 12, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginBottom: 8 }}>💾 ЕКСПОРТ</div>
                    {[["txt","📄 .txt"], ["md","📝 .md"], ["json","⚙️ .json"]].map(([fmt, label]) => (
                      <button key={fmt} onClick={() => exportChat(fmt)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: `1px solid ${borderColor}`, background: "transparent", color: textColor, cursor: "pointer", fontSize: 12, textAlign: "left", marginBottom: 4, fontFamily: "inherit" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Stats inline */}
                {showStats && (
                  <div style={{ marginTop: 12, padding: 12, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: 12, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginBottom: 8 }}>📊 АНАЛІТИКА</div>
                    {[
                      ["📨", "Запитів", totalRequests],
                      ["📥", "Токенів вхід", totalTokensIn.toLocaleString("uk-UA")],
                      ["📤", "Токенів вихід", totalTokensOut.toLocaleString("uk-UA")],
                      ["💬", "Повідомлень", messages.length],
                    ].map(([icon, label, val], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? `1px solid ${borderColor}` : "none" }}>
                        <span style={{ fontSize: 12, color: subColor }}>{icon} {label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ height: 1, background: borderColor, margin: "12px 0" }} />
                <button onClick={() => { if (window.confirm("Очистити чат?")) startNewChat(); }}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#f87171", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "inherit" }}>
                  🗑 Очистити чат
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cal+Sans&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; width: 100%; overflow: hidden; background: #0a0a0f; }
        .sidebar-new-btn:hover { background: rgba(99,102,241,0.12) !important; }
        @keyframes typingBounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-7px);opacity:1} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes orbFloat { 0%,100%{transform:translateY(0) scale(1) rotate(0deg)} 50%{transform:translateY(-40px) scale(1.08) rotate(3deg)} }
        @keyframes orbFloat2 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(30px) scale(0.95)} }
        @keyframes logoPulse { 0%,100%{box-shadow:0 0 30px rgba(99,102,241,0.4), 0 0 60px rgba(139,92,246,0.2)} 50%{box-shadow:0 0 50px rgba(99,102,241,0.7), 0 0 100px rgba(139,92,246,0.4)} }
        @keyframes borderGlow { 0%,100%{border-color:rgba(99,102,241,0.3)} 50%{border-color:rgba(139,92,246,0.6)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }
        textarea { resize: none; }
        textarea::placeholder { color: rgba(148,163,184,0.4); }
        @media (max-width: 640px) { input, textarea, select { font-size: 16px !important; } }
        .msg-bubble { transition: all 0.15s ease; }
        .msg-bubble:hover { transform: translateY(-1px); }
        .chat-item:hover .delete-btn { opacity: 1 !important; }
      `}</style>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {user
          ? <ChatApp user={user} onLogout={() => { if (window.confirm("Вийти?")) { googleLogout(); setUser(null); } }} />
          : <LoginScreen onLogin={(cr) => setUser(decodeGoogleJWT(cr.credential))} />
        }
      </GoogleOAuthProvider>
    </>
  );
}
