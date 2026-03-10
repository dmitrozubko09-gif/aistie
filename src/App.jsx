import { useState, useRef, useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = "709769823975-979bjivkuo95agn5j0g8rtloeu45iorf.apps.googleusercontent.com";

// ── PRESETS / ROLES ──────────────────────────────────────────────
const PRESETS = [
  {
    id: "default", icon: "🤖", name: "УкрАI",
    prompt: "",
  },
  {
    id: "coder", icon: "💻", name: "Редактор коду",
    prompt: "Ти — експертний розробник. При написанні коду: завжди додавай коментарі до кожного блоку, перевіряй синтаксис, пояснюй що робить кожна функція, вказуй можливі помилки та як їх уникнути. Пиши тільки робочий, production-ready код.",
  },
  {
    id: "translator", icon: "🌐", name: "Перекладач",
    prompt: "Ти — професійний перекладач і лінгвіст. Не просто перекладай дослівно, а: пояснюй сталі вирази та ідіоми, вказуй культурний контекст, пропонуй кілька варіантів перекладу де це доречно, пояснюй граматичні особливості. Перекладай з будь-якої мови на українську або навпаки.",
  },
  {
    id: "writer", icon: "✍️", name: "Сценарист",
    prompt: "Ти — творчий сценарист і письменник. Допомагай з: описом локацій (атмосфера, деталі, відчуття), діями персонажів (емоції, жести, мова тіла), діалогами, побудовою сюжету. Пиши яскраво, образно, з деталями. Використовуй літературні прийоми.",
  },
  {
    id: "teacher", icon: "📚", name: "Вчитель",
    prompt: "Ти — терплячий та зрозумілий вчитель. Пояснюй будь-яку тему: починай з простих аналогій, розбивай на маленькі кроки, наводь реальні приклади з життя, перевіряй розуміння питаннями. Адаптуй складність під рівень учня.",
  },
  {
    id: "analyst", icon: "📊", name: "Аналітик",
    prompt: "Ти — бізнес-аналітик та стратег. При аналізі: використовуй структуровані фреймворки (SWOT, 5W, etc.), спирайся на дані та факти, вказуй ризики та можливості, давай конкретні рекомендації з обґрунтуванням. Мисли критично та системно.",
  },
];

const BASE_SYSTEM = `Ти — УкрАI, україномовний AI-асистент найвищої якості. Твоя мова — ТІЛЬКИ УКРАЇНСЬКА.

КРИТИЧНЕ ПРАВИЛО №1 — МОВА:
Відповідай ВИКЛЮЧНО українською мовою. Завжди. Без винятків.
Російська мова ПОВНІСТЮ ЗАБОРОНЕНА.
Якщо користувач пише російською — відповідай українською.

КРИТИЧНЕ ПРАВИЛО №2 — ТОЧНІСТЬ:
- Ніколи не вигадуй факти. Краще визнати незнання.
- Для коду — пиши тільки робочий код.
- Для медичних/юридичних/фінансових питань — рекомендуй фахівця.
- Якщо є сумніви — додай "⚠️ Рекомендую перевірити у додаткових джерелах".

КРИТИЧНЕ ПРАВИЛО №3 — РІЗНОМАНІТНІСТЬ КОДУ:
Кожного разу генеруй унікальне рішення — різні стилі, кольори, структуру, підхід.

Правила відповідей:
- Будь структурованим — списки, заголовки де потрібно
- Давай робочі приклади коду з поясненням
- Будь теплим та мотивуючим

Веб-пошук [SEARCH: запит англійською]:
- Новини → [SEARCH: Ukraine news today]
- Курс валют → [SEARCH: USD UAH exchange rate today]
- Погода → [SEARCH: city weather today]
- НЕ шукай: математика, код, творчі завдання`;

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

const formatMessage = (text, dark) => {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("```")) {
      const lines = part.split("\n");
      const lang = lines[0].replace("```", "").trim();
      const code = lines.slice(1, -1).join("\n");
      return (
        <div key={idx} style={{ margin: "10px 0", borderRadius: 10, overflow: "hidden", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.1)", padding: "4px 12px" }}>
            <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace" }}>{lang || "code"}</span>
            <button onClick={() => navigator.clipboard.writeText(code)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)", padding: "2px 8px", borderRadius: 4, transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#a78bfa"}
              onMouseLeave={e => e.currentTarget.style.color = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}>
              📋 Копіювати код
            </button>
          </div>
          <pre style={{ background: dark ? "#0d0d1a" : "#1e1e2e", padding: "12px 16px", margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.6, color: "#e2e8f0", fontFamily: "monospace" }}>{code}</pre>
        </div>
      );
    }
    return part.split("\n").map((line, i) => {
      if (line.match(/^#{1,3}\s/)) return <div key={i} style={{ fontWeight: 700, fontSize: 15, color: dark ? "#e2d9f3" : "#3730a3", margin: "10px 0 4px" }}>{line.replace(/^#{1,3}\s/, "")}</div>;
      if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ fontWeight: 700, color: dark ? "#c4b5fd" : "#5b21b6", marginBottom: 4 }}>{line.slice(2, -2)}</div>;
      if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 16, marginBottom: 4, display: "flex", gap: 8 }}><span style={{ color: "#818cf8", flexShrink: 0 }}>▸</span><span>{line.slice(2)}</span></div>;
      if (/^\d+\.\s/.test(line)) { const num = line.match(/^(\d+)\./)[1]; return <div key={i} style={{ paddingLeft: 8, marginBottom: 5, display: "flex", gap: 10 }}><span style={{ color: "#818cf8", fontWeight: 700, minWidth: 20 }}>{num}.</span><span>{line.replace(/^\d+\.\s/, "")}</span></div>; }
      if (line === "") return <div key={i} style={{ height: 6 }} />;
      return <div key={i} style={{ marginBottom: 3, lineHeight: 1.7 }}>{line}</div>;
    });
  });
};

// ── LOGIN SCREEN ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loginError, setLoginError] = useState(null);
  const features = [
    { icon: "🧠", title: "Надрозумний", desc: "Llama 3.3 70B — одна з найкращих моделей у світі" },
    { icon: "⚡", title: "Блискавичний", desc: "Відповіді за секунди завдяки Groq API" },
    { icon: "🇺🇦", title: "Лише українською", desc: "Повністю україномовний асистент" },
    { icon: "🌐", title: "З веб-пошуком", desc: "Актуальні новини, курси валют, погода" },
    { icon: "✅", title: "Точні відповіді", desc: "Не вигадує факти, чесно визнає незнання" },
    { icon: "💎", title: "Безкоштовний", desc: "Без підписок і прихованих платежів" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#06040f", display: "flex", fontFamily: "'Outfit', sans-serif", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-15%", left: "-5%", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(102,126,234,0.15) 0%, transparent 70%)", animation: "orbFloat 8s infinite ease-in-out", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "30%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(118,75,162,0.12) 0%, transparent 70%)", animation: "orbFloat 10s infinite ease-in-out reverse", pointerEvents: "none" }} />

      {/* LEFT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 64px", zIndex: 1, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto" }}>
        <div style={{ animation: "fadeInUp 0.7s ease both", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 48 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 16px 50px rgba(102,126,234,0.45)", animation: "logoPulse 3s infinite ease-in-out", flexShrink: 0 }}>🤖</div>
            <div>
              <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.5px", background: "linear-gradient(135deg, #667eea, #a78bfa, #63d1ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>УкрАI</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Асистент нового покоління</p>
            </div>
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.8px", marginBottom: 12, lineHeight: 1.3 }}>
            Твій розумний<br />
            <span style={{ background: "linear-gradient(135deg, #667eea, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI-помічник</span> 🇺🇦
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 44, lineHeight: 1.7 }}>
            Відповідає на будь-які питання, пише код, шукає в інтернеті — і все це українською мовою.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px", animation: `fadeInUp 0.6s ease ${0.1 + i * 0.07}s both` }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ width: 460, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 44px", zIndex: 1, background: "rgba(255,255,255,0.015)", overflowY: "auto", animation: "fadeInUp 0.9s ease both" }}>
        <div style={{ width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 48, marginBottom: 14, animation: "logoPulse 3s infinite" }}>✨</div>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: 10 }}>Почати спілкування</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Увійди через Google щоб отримати доступ</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "32px 28px", backdropFilter: "blur(20px)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <GoogleLogin onSuccess={(cr) => { if (!cr?.credential) { setLoginError("Помилка отримання даних"); return; } onLogin(cr); }} onError={() => setLoginError("Помилка входу. Відкрий на localhost:5173")} theme="filled_black" shape="pill" size="large" text="signin_with" locale="uk" useOneTap={false} />
            </div>
            {loginError && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#f87171", fontSize: 13, marginBottom: 16 }}>⚠️ {loginError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {["🔒 Твої дані захищені", "🚫 Не зберігаємо повідомлення", "⚡ Вхід займає секунду"].map((t, i) => (
                <div key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>{t}</div>
              ))}
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 20, lineHeight: 1.6 }}>
            Натискаючи кнопку входу, ти погоджуєшся з умовами використання
          </p>
        </div>
      </div>
    </div>
  );
}

// ── CHAT APP ──────────────────────────────────────────────────────
function ChatApp({ user, onLogout }) {
  const [messages, setMessages] = useState([]);       // для показу в UI
  const [apiMessages, setApiMessages] = useState([]); // для API (з реальним вмістом файлів)
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [activePreset, setActivePreset] = useState(PRESETS[0]);
  const [showPresets, setShowPresets] = useState(false);
  const [pinnedFacts, setPinnedFacts] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fileContent, setFileContent] = useState(null);
  const [fileName, setFileName] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const dark = darkMode;
  const bg = dark ? "#06040f" : "#f0f0f8";
  const sidebarBg = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
  const borderColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = dark ? "#fff" : "#1a1a2e";
  const subColor = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
  const panelBg = dark ? "rgba(15,12,30,0.98)" : "rgba(255,255,255,0.98)";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const getSystemPrompt = () => {
    let sys = BASE_SYSTEM;
    if (activePreset.prompt) sys = activePreset.prompt + "\n\n" + BASE_SYSTEM;
    if (pinnedFacts.length > 0) sys += "\n\nЗАКРІПЛЕНІ ФАКТИ (завжди пам'ятай це):\n" + pinnedFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
    return sys;
  };

  const copyMessage = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const pinFact = (text) => {
    const clean = text.slice(0, 200);
    setPinnedFacts(prev => [...prev, clean]);
  };

  const exportChat = (format) => {
    if (messages.length === 0) return;
    let content = "";
    const date = new Date().toLocaleDateString("uk-UA");

    if (format === "txt") {
      content = `УкрАI — Експорт чату (${date})\n${"=".repeat(40)}\n\n`;
      messages.forEach(m => { content += `[${m.role === "user" ? "Ви" : "УкрАI"}]\n${m.content}\n\n`; });
    } else if (format === "json") {
      content = JSON.stringify({ date, model: "llama-3.3-70b", preset: activePreset.name, messages }, null, 2);
    } else if (format === "md") {
      content = `# УкрАI — Чат (${date})\n\n`;
      messages.forEach(m => { content += `## ${m.role === "user" ? "👤 Ви" : "🤖 УкрАI"}\n\n${m.content}\n\n---\n\n`; });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ukrai-chat-${Date.now()}.${format}`; a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setFileContent(ev.target.result); setFileName(file.name); };
    reader.readAsText(file);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Для API — передаємо РЕАЛЬНИЙ вміст файлу
    let apiText = text;
    if (fileContent) {
      apiText = `ВАЖЛИВО: Я завантажив файл "${fileName}". Ось його ТОЧНИЙ вміст — не вигадуй нічого, аналізуй ТІЛЬКИ цей код:\n\`\`\`\n${fileContent}\n\`\`\`\n\nМоє питання про цей файл: ${text}\n\nПОВТОРЮЮ: відповідай ТІЛЬКИ на основі коду вище, не пиши інший код!`;
    }

    // Для UI — показуємо скорочено
    const displayText = fileContent ? `📎 ${fileName}\n${text}` : text;

    const newApiMessages = [...apiMessages, { role: "user", content: apiText }];
    const newDisplayMessages = [...messages, { role: "user", content: displayText }];

    setMessages(newDisplayMessages);
    setApiMessages(newApiMessages);
    setFileContent(null); setFileName("");
    setLoading(true);

    const searchTriggers = [/новин|новост|сьогодні|зараз|поточн|останн|актуальн/i, /курс (долар|євро|валют|біткоін)/i, /погода/i, /знайди|пошукай/i];
    if (searchTriggers.some(r => r.test(text))) setIsSearching(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: getSystemPrompt(), messages: newApiMessages }),
      });
      setIsSearching(false);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "API помилка");
      const reply = data.content?.map(b => b.text).join("") || "Порожня відповідь.";
      const assistantMsg = { role: "assistant", content: reply };
      setMessages([...newDisplayMessages, assistantMsg]);
      setApiMessages([...newApiMessages, assistantMsg]);
    } catch (err) {
  setIsSearching(false);
  const errMsg = { role: "assistant", content: `⚠️ Помилка з'єднання: ${err.message}` }; `node server.cjs`" };
      setMessages([...newDisplayMessages, errMsg]);
      setApiMessages([...newApiMessages, errMsg]);
    }
    setLoading(false);
  };

  const suggestions = [
    "🧬 Поясни ДНК простими словами",
    "💻 Напиши сайт на HTML",
    "📰 Які новини сьогодні?",
    "💱 Який курс долара зараз?",
    "🧮 Розв'яжи: x² + 5x + 6 = 0",
    "🎨 Напиши CSS-анімацію",
  ];

  const SideBtn = ({ onClick, title, emoji, danger }) => (
    <button onClick={onClick} title={title}
      style={{ width: 44, height: 44, borderRadius: 13, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: `1px solid ${borderColor}`, cursor: "pointer", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", color: subColor, transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? "rgba(239,68,68,0.15)" : "rgba(102,126,234,0.2)"; e.currentTarget.style.color = danger ? "#ef4444" : "#a78bfa"; }}
      onMouseLeave={e => { e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; e.currentTarget.style.color = subColor; }}>
      {emoji}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: bg, display: "flex", fontFamily: "'Outfit', sans-serif", overflow: "hidden", transition: "background 0.3s" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 72, background: sidebarBg, borderRight: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 10, flexShrink: 0, zIndex: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 20px rgba(102,126,234,0.4)", flexShrink: 0 }}>
          {activePreset.icon}
        </div>
        <div style={{ width: 36, height: 1, background: borderColor, margin: "4px 0" }} />

        {/* Presets */}
        <SideBtn onClick={() => { setShowPresets(!showPresets); setShowPinned(false); setShowExport(false); }} title="Ролі/Пресети" emoji="🎭" />
        {/* Pinned facts */}
        <SideBtn onClick={() => { setShowPinned(!showPinned); setShowPresets(false); setShowExport(false); }} title="Закріплені факти" emoji="📌" />
        {/* Upload file */}
        <SideBtn onClick={() => fileInputRef.current?.click()} title="Завантажити файл" emoji="📎" />
        <input ref={fileInputRef} type="file" accept=".txt,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.md,.csv" style={{ display: "none" }} onChange={handleFileUpload} />
        {/* Export */}
        <SideBtn onClick={() => { setShowExport(!showExport); setShowPresets(false); setShowPinned(false); }} title="Експорт чату" emoji="💾" />

        <div style={{ flex: 1 }} />

        {/* Theme */}
        <SideBtn onClick={() => setDarkMode(!dark)} title={dark ? "Світла тема" : "Темна тема"} emoji={dark ? "☀️" : "🌙"} />
        {/* Clear */}
        <SideBtn onClick={() => { if (window.confirm("Очистити чат?")) { setMessages([]); setApiMessages([]); setPinnedFacts([]); } }} title="Очистити чат" emoji="🗑" danger />

        {/* Avatar */}
        <div style={{ width: 44, height: 44, borderRadius: 13, overflow: "hidden", cursor: "pointer", border: "2px solid rgba(102,126,234,0.5)", flexShrink: 0 }} title="Вийти" onClick={onLogout}>
          {user?.picture ? <img src={user.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
        </div>
      </div>

      {/* ── PRESETS PANEL ── */}
      {showPresets && (
        <div style={{ position: "absolute", left: 80, top: 60, width: 280, background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 18, padding: 16, zIndex: 100, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: subColor, marginBottom: 12, letterSpacing: "0.5px" }}>🎭 ОБЕРІТЬ РОЛЬ</div>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => { setActivePreset(p); setShowPresets(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: activePreset.id === p.id ? "1px solid rgba(102,126,234,0.5)" : "1px solid transparent", background: activePreset.id === p.id ? "rgba(102,126,234,0.15)" : "transparent", cursor: "pointer", marginBottom: 4, transition: "all 0.15s", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(102,126,234,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = activePreset.id === p.id ? "rgba(102,126,234,0.15)" : "transparent"}>
              <span style={{ fontSize: 22 }}>{p.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: textColor }}>{p.name}</div>
                <div style={{ fontSize: 11, color: subColor, marginTop: 1 }}>{p.id === "default" ? "Стандартний режим" : "Спеціалізований"}</div>
              </div>
              {activePreset.id === p.id && <span style={{ marginLeft: "auto", color: "#667eea", fontSize: 16 }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── PINNED FACTS PANEL ── */}
      {showPinned && (
        <div style={{ position: "absolute", left: 80, top: 60, width: 300, background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 18, padding: 16, zIndex: 100, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: 400, overflowY: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: subColor, marginBottom: 12 }}>📌 ЗАКРІПЛЕНІ ФАКТИ</div>
          {pinnedFacts.length === 0
            ? <div style={{ fontSize: 13, color: subColor, textAlign: "center", padding: "20px 0" }}>
                Немає закріплених фактів.<br />
                <span style={{ fontSize: 12, opacity: 0.7 }}>Натисни 📌 під повідомленням</span>
              </div>
            : pinnedFacts.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13, color: textColor, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", borderRadius: 10, padding: "8px 12px", lineHeight: 1.5 }}>{f}</div>
                <button onClick={() => setPinnedFacts(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, padding: "0 4px", alignSelf: "flex-start" }}>✕</button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── EXPORT PANEL ── */}
      {showExport && (
        <div style={{ position: "absolute", left: 80, top: 60, width: 240, background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 18, padding: 16, zIndex: 100, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: subColor, marginBottom: 12 }}>💾 ЕКСПОРТ ЧАТУ</div>
          {[["txt", "📄 Текстовий файл (.txt)"], ["md", "📝 Markdown (.md)"], ["json", "⚙️ JSON для розробників"]].map(([fmt, label]) => (
            <button key={fmt} onClick={() => exportChat(fmt)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${borderColor}`, background: "transparent", color: textColor, cursor: "pointer", fontSize: 13, textAlign: "left", marginBottom: 6, transition: "all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(102,126,234,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {label}
            </button>
          ))}
          {messages.length === 0 && <div style={{ fontSize: 12, color: subColor, textAlign: "center", marginTop: 8 }}>Чат порожній</div>}
        </div>
      )}

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: "12px 24px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(10px)", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: textColor }}>УкрАI</span>
              <span style={{ fontSize: 12, background: "rgba(102,126,234,0.2)", border: "1px solid rgba(102,126,234,0.3)", color: "#a78bfa", padding: "2px 8px", borderRadius: 20 }}>{activePreset.icon} {activePreset.name}</span>
            </div>
            <span style={{ fontSize: 11, color: subColor, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }} />
              Llama 3.3 70B · Groq · Веб-пошук
              {pinnedFacts.length > 0 && <span style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>📌 {pinnedFacts.length} фактів</span>}
              {fileContent && <span style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>📎 {fileName}</span>}
            </span>
          </div>
          <span style={{ fontSize: 13, color: subColor }}>Привіт, {user?.name?.split(" ")[0] || "Друже"}! 👋</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }} onClick={() => { setShowPresets(false); setShowPinned(false); setShowExport(false); }}>

          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 24, padding: "40px 20px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 60, marginBottom: 16, animation: "logoPulse 3s infinite" }}>{activePreset.icon}</div>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: textColor, marginBottom: 10, letterSpacing: "-0.5px" }}>
                  {activePreset.id === "default" ? "Чим можу допомогти?" : `Режим: ${activePreset.name}`}
                </h2>
                <p style={{ fontSize: 14, color: subColor, maxWidth: 400, lineHeight: 1.7, margin: "0 auto" }}>
                  {activePreset.id === "default" ? "Запитай про що завгодно — шукаю в інтернеті та даю точні відповіді!" : activePreset.prompt.slice(0, 120) + "..."}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 660, width: "100%" }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setInput(s.slice(2)); textareaRef.current?.focus(); }}
                    style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)", border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, borderRadius: 14, padding: "14px", color: dark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)", cursor: "pointer", fontSize: 13, textAlign: "left", transition: "all 0.2s", fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(102,126,234,0.14)"; e.currentTarget.style.color = dark ? "#fff" : "#1a1a2e"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"; e.currentTarget.style.color = dark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeInUp 0.3s ease both" }}>
              {m.role === "assistant" && (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, marginTop: 2, boxShadow: "0 4px 14px rgba(102,126,234,0.3)" }}>{activePreset.icon}</div>
              )}
              <div style={{ maxWidth: "74%", display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ padding: "12px 16px", borderRadius: m.role === "user" ? "18px 18px 5px 18px" : "5px 18px 18px 18px", background: m.role === "user" ? "linear-gradient(135deg, #667eea, #764ba2)" : (dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)"), color: m.role === "user" ? "#fff" : textColor, fontSize: 14.5, lineHeight: 1.7, border: m.role === "assistant" ? `1px solid ${borderColor}` : "none", boxShadow: m.role === "user" ? "0 8px 30px rgba(102,126,234,0.35)" : (dark ? "0 2px 10px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.08)"), whiteSpace: m.role === "user" ? "pre-wrap" : "normal" }}>
                  {m.role === "assistant" ? formatMessage(m.content, dark) : m.content}
                </div>
                {m.role === "assistant" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copyMessage(m.content, i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: subColor, padding: "2px 6px", borderRadius: 6, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#a78bfa"} onMouseLeave={e => e.currentTarget.style.color = subColor}>
                      {copiedIdx === i ? "✅ Скопійовано" : "📋 Копіювати"}
                    </button>
                    <button onClick={() => pinFact(m.content)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: subColor, padding: "2px 6px", borderRadius: 6, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#fbbf24"} onMouseLeave={e => e.currentTarget.style.color = subColor}>
                      📌 Закріпити
                    </button>
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", flexShrink: 0, marginTop: 2, border: "1.5px solid rgba(102,126,234,0.4)" }}>
                  {user?.picture ? <img src={user.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#1a1d2e", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 10, animation: "fadeInUp 0.3s ease both" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, boxShadow: "0 4px 14px rgba(102,126,234,0.3)" }}>{activePreset.icon}</div>
              <div style={{ background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)", border: `1px solid ${borderColor}`, borderRadius: "5px 18px 18px 18px", padding: "8px 16px" }}>
                {isSearching ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: subColor, fontSize: 13, padding: "4px 0" }}><span style={{ animation: "pulse 1s infinite" }}>🌐</span> Шукаю в інтернеті...</div> : <TypingDots />}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* File preview bar */}
        {fileContent && (
          <div style={{ padding: "8px 20px", background: dark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)", borderTop: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>📎</span>
            <span style={{ fontSize: 13, color: "#22c55e", flex: 1 }}>{fileName} — готовий до аналізу</span>
            <button onClick={() => { setFileContent(null); setFileName(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 20px 14px", borderTop: `1px solid ${borderColor}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.6)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`, borderRadius: 16, padding: "6px 6px 6px 14px", transition: "border-color 0.2s" }}
            onFocusCapture={e => e.currentTarget.style.borderColor = "rgba(102,126,234,0.5)"}
            onBlurCapture={e => e.currentTarget.style.borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}>
            <textarea ref={textareaRef} value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={activePreset.id === "default" ? "Запитай мене про що завгодно..." : `Режим: ${activePreset.name} — введи запит...`}
              rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: textColor, fontSize: 15, fontFamily: "'Outfit', sans-serif", lineHeight: 1.6, resize: "none", overflow: "hidden", paddingTop: 4 }} />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              style={{ width: 42, height: 42, borderRadius: 11, border: "none", background: !loading && input.trim() ? "linear-gradient(135deg, #667eea, #764ba2)" : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), cursor: !loading && input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, transition: "all 0.2s", boxShadow: !loading && input.trim() ? "0 4px 16px rgba(102,126,234,0.4)" : "none", flexShrink: 0 }}>
              {loading ? "⏳" : "➤"}
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: subColor, marginTop: 6, opacity: 0.6 }}>Enter — надіслати · Shift+Enter — новий рядок</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; width: 100%; overflow: hidden; background: #06040f; }
        @keyframes typingBounce { 0%,80%,100%{transform:translateY(0);opacity:0.5} 40%{transform:translateY(-8px);opacity:1} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes orbFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-30px) scale(1.05)} }
        @keyframes logoPulse { 0%,100%{filter:drop-shadow(0 0 20px rgba(102,126,234,0.5))} 50%{filter:drop-shadow(0 0 40px rgba(118,75,162,0.8))} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(102,126,234,0.3); border-radius: 4px; }
        textarea { resize: none; }
        textarea::placeholder { color: rgba(150,150,180,0.5); }
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
