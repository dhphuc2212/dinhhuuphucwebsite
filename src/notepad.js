import { jsonRes } from "./utils.js";

function sanitizeCode(raw = "") {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
}

export async function handleNotepadRoutes(pathname, request, env) {
  const match = pathname.match(/^\/api\/notepad\/([^/]+)$/);
  if (!match) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  const code = sanitizeCode(decodeURIComponent(match[1]));
  if (!code) {
    return jsonRes({ error: "Mã notepad không hợp lệ (chỉ dùng chữ, số, - hoặc _)." }, 400);
  }

  if (!env.AUTH_SESSIONS) {
    return jsonRes({ error: "Chưa cấu hình KV storage." }, 500);
  }

  const kvKey = `notepad:${code}`;

  if (request.method === "GET") {
    try {
      const raw = await env.AUTH_SESSIONS.get(kvKey);
      if (!raw) {
        return jsonRes({
          code,
          title: "",
          content: "",
          updatedAt: null,
          exists: false
        });
      }
      const data = JSON.parse(raw);
      return jsonRes({
        code,
        title: data.title || "",
        content: data.content || "",
        updatedAt: data.updatedAt || null,
        exists: true
      });
    } catch {
      return jsonRes({ error: "Không thể đọc dữ liệu notepad." }, 500);
    }
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await request.json();
      const title = String(body.title || "").slice(0, 160);
      const content = String(body.content || "").slice(0, 200000);
      const updatedAt = new Date().toISOString();

      await env.AUTH_SESSIONS.put(
        kvKey,
        JSON.stringify({ code, title, content, updatedAt })
      );

      return jsonRes({ ok: true, code, updatedAt });
    } catch {
      return jsonRes({ error: "Lỗi khi lưu nội dung notepad." }, 500);
    }
  }

  if (request.method === "DELETE") {
    try {
      await env.AUTH_SESSIONS.delete(kvKey);
      return jsonRes({ ok: true, code });
    } catch {
      return jsonRes({ error: "Không thể xóa notepad." }, 500);
    }
  }

  return jsonRes({ error: "Method Not Allowed" }, 405);
}
