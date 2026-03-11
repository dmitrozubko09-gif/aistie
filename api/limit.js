// api/limit.js — перевірка та збільшення ліміту повідомлень
const DAILY_LIMIT = 20;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  const { email, action } = req.body;
  // action = "check" (просто перевірити) або "increment" (перевірити + додати +1)

  if (!email) return res.status(400).json({ error: "No email" });

  const today = new Date().toISOString().split("T")[0]; // "2025-03-11"
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Prefer": "return=representation",
  };

  try {
    // 1. Отримати поточний запис
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_limits?email=eq.${encodeURIComponent(email)}&select=*`,
      { headers }
    );
    const rows = await getRes.json();
    const row = rows[0];

    // 2. Якщо запису немає — створити
    if (!row) {
      if (action === "increment") {
        await fetch(`${SUPABASE_URL}/rest/v1/user_limits`, {
          method: "POST",
          headers,
          body: JSON.stringify({ email, count: 1, reset_date: today }),
        });
      }
      return res.json({ count: action === "increment" ? 1 : 0, limit: DAILY_LIMIT, allowed: true });
    }

    // 3. Якщо дата інша — скинути лічильник
    let count = row.reset_date !== today ? 0 : row.count;

    // 4. Перевірити ліміт
    if (count >= DAILY_LIMIT) {
      return res.json({ count, limit: DAILY_LIMIT, allowed: false });
    }

    // 5. Якщо increment — збільшити
    if (action === "increment") {
      count += 1;
      await fetch(`${SUPABASE_URL}/rest/v1/user_limits?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ count, reset_date: today }),
      });
    }

    return res.json({ count, limit: DAILY_LIMIT, allowed: true });

  } catch (err) {
    // Якщо Supabase недоступний — дозволяємо (щоб не блокувати юзера)
    console.error("Supabase error:", err.message);
    return res.json({ count: 0, limit: DAILY_LIMIT, allowed: true, warning: "limit check failed" });
  }
}
