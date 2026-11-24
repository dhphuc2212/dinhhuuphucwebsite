import { jsonRes } from "./utils.js";

function getSessionId(request) {
  const headerSid = request.headers.get("X-Session-Id");
  if (headerSid) return headerSid.trim();

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)dhp_gcal_sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function resolveUserEmail(request, env) {
  const sid = getSessionId(request);
  if (!sid || !env.AUTH_SESSIONS) return "";
  try {
    const raw = await env.AUTH_SESSIONS.get(`gcal_session:${sid}`);
    if (!raw) return "";
    const sess = JSON.parse(raw);
    return (sess.email || "").toLowerCase().trim();
  } catch {
    return "";
  }
}

export async function handleChatHistoryRoutes(pathname, request, env) {
  if (pathname !== "/api/chat/history") return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id"
      }
    });
  }

  const email = await resolveUserEmail(request, env);
  if (!email) {
    return jsonRes({ authenticated: false, threads: [] }, 200);
  }

  const kvKey = `chat_history:${email}`;

  if (request.method === "GET") {
    try {
      const raw = await env.AUTH_SESSIONS.get(kvKey);
      const data = raw ? JSON.parse(raw) : { threads: [] };
      return jsonRes({
        authenticated: true,
        email,
        threads: Array.isArray(data.threads) ? data.threads : []
      });
    } catch {
      return jsonRes({ authenticated: true, email, threads: [] });
    }
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const threads = Array.isArray(body.threads) ? body.threads.slice(0, 40) : [];
      const sanitized = threads.map((t) => ({
        id: String(t.id || ""),
        title: String(t.title || "Cuộc trò chuyện mới").slice(0, 120),
        updatedAt: t.updatedAt || new Date().toISOString(),
        messages: Array.isArray(t.messages)
          ? t.messages.slice(-80).map((m) => ({
              role: m.role === "user" ? "user" : "bot",
              text: String(m.text || "").slice(0, 12000),
              schedule: m.schedule || null,
              ts: m.ts || new Date().toISOString()
            }))
          : []
      }));

      await env.AUTH_SESSIONS.put(
        kvKey,
        JSON.stringify({ email, updatedAt: new Date().toISOString(), threads: sanitized })
      );

      return jsonRes({ ok: true, email, count: sanitized.length });
    } catch {
      return jsonRes({ error: "Không thể đồng bộ lịch sử trò chuyện." }, 500);
    }
  }

  return jsonRes({ error: "Method Not Allowed" }, 405);
}
