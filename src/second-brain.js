import { jsonRes } from "./utils.js";

function getSessionId(request) {
  const headerSid = request.headers.get("X-Session-Id");
  if (headerSid) return headerSid.trim();

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)dhp_gcal_sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function resolveBrainUserEmail(request, env) {
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

function normalizeText(str = "") {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str = "") {
  const stopWords = new Set(["la", "va", "cua", "cho", "ve", "nhung", "cac", "mot", "co", "khong", "toi", "minh", "ban", "ay", "nay", "do", "khi", "nao", "gi", "sao", "nhu", "the", "trong", "ngoai", "tren", "duoi", "voi", "tu", "den", "da", "dang", "se", "duoc", "bi", "hay", "hoac"]);
  return normalizeText(str)
    .split(" ")
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

async function fetchUrlMetadata(rawUrl) {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return null;
  try {
    // Ưu tiên YouTube oEmbed để lấy chính xác tên video & kênh
    if (/youtube\.com|youtu\.be/i.test(rawUrl)) {
      const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
      const res = await fetch(oembed, { cf: { cacheTtl: 3600 } });
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || "",
          snippet: data.author_name ? `Video YouTube từ kênh: ${data.author_name}` : "Video YouTube"
        };
      }
    }

    // Với bài viết/blog công khai: đọc nhanh thẻ <title> và meta description
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DHPSecondBrain/1.0)" }
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const html = (await res.text()).slice(0, 45000);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
    const snippet = descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "";
    return title || snippet ? { title, snippet } : null;
  } catch {
    return null;
  }
}

async function getBrainIndex(email, env) {
  if (!email || !env.AUTH_SESSIONS) return [];
  try {
    const raw = await env.AUTH_SESSIONS.get(`brain_index:${email}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveBrainIndex(email, indexList, env) {
  await env.AUTH_SESSIONS.put(`brain_index:${email}`, JSON.stringify(indexList));
}

export async function saveMemoryEntry(email, payload, env) {
  if (!email || !env.AUTH_SESSIONS) return null;

  const id = "mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const sourceUrl = String(payload.sourceUrl || "").trim().slice(0, 500);
  let title = String(payload.title || "").trim().slice(0, 180);
  let summary = String(payload.summary || payload.content || "").trim().slice(0, 6000);
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : [];

  if (sourceUrl && (!title || summary.length < 40)) {
    const meta = await fetchUrlMetadata(sourceUrl);
    if (meta) {
      if (!title && meta.title) title = meta.title.slice(0, 180);
      if (meta.snippet && !summary.includes(meta.snippet)) {
        summary = summary ? `${summary}\n(${meta.snippet})` : meta.snippet;
      }
    }
  }

  if (!title) {
    title = summary.slice(0, 65) + (summary.length > 65 ? "..." : "");
  }

  const createdAt = new Date().toISOString();
  const fullItem = {
    id,
    title,
    summary,
    tags,
    sourceUrl,
    createdAt
  };

  // Tầng 2: Lưu chi tiết từng bản ghi riêng
  await env.AUTH_SESSIONS.put(`brain_item:${email}:${id}`, JSON.stringify(fullItem));

  // Tầng 1: Cập nhật chỉ mục nhẹ (chỉ lưu tiêu đề + từ khóa để quét siêu nhanh)
  const indexList = await getBrainIndex(email, env);
  const indexEntry = {
    id,
    title,
    tags,
    sourceUrl,
    preview: summary.slice(0, 160),
    createdAt
  };
  await saveBrainIndex(email, [indexEntry, ...indexList], env);

  return fullItem;
}

export async function searchRelevantMemories(email, query, env, limit = 5) {
  if (!email || !env.AUTH_SESSIONS) return [];
  const indexList = await getBrainIndex(email, env);
  if (indexList.length === 0) return [];

  const qNorm = normalizeText(query);
  const qTokens = tokenize(query);

  // Nếu người dùng hỏi tổng quát ("tôi đã lưu gì", "những kiến thức đã dạy") -> lấy các mục mới nhất
  const isGeneralRecall = /da luu|da day|bo nao|ghi nho gi|tat ca|danh sach|hom truoc/i.test(qNorm) && qTokens.length <= 3;

  const scored = indexList.map((item, idx) => {
    const hay = normalizeText(`${item.title} ${(item.tags || []).join(" ")} ${item.preview || ""}`);
    let score = 0;

    if (qNorm && hay.includes(qNorm)) score += 10;
    for (const tk of qTokens) {
      if (hay.includes(tk)) score += 3;
    }
    // Ưu tiên nhẹ các kiến thức mới lưu gần đây
    if (isGeneralRecall) score += Math.max(1, 6 - idx);
    return { item, score };
  });

  const topMatches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (topMatches.length === 0) return [];

  // Chỉ mở đúng các bản ghi chi tiết khớp nhất ở Tầng 2
  const detailed = await Promise.all(
    topMatches.map(async ({ item }) => {
      try {
        const raw = await env.AUTH_SESSIONS.get(`brain_item:${email}:${item.id}`);
        return raw ? JSON.parse(raw) : item;
      } catch {
        return item;
      }
    })
  );

  return detailed.filter(Boolean);
}

export async function handleSecondBrainRoutes(pathname, request, env) {
  if (!pathname.startsWith("/api/brain")) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id"
      }
    });
  }

  const email = await resolveBrainUserEmail(request, env);
  if (!email) {
    return jsonRes({ authenticated: false, items: [], error: "Vui lòng đăng nhập Google để dùng Bộ não thứ 2." }, 200);
  }

  // GET /api/brain -> lấy danh sách chỉ mục
  if (pathname === "/api/brain" && request.method === "GET") {
    const items = await getBrainIndex(email, env);
    return jsonRes({ authenticated: true, email, count: items.length, items });
  }

  // GET /api/brain/item/:id -> xem nội dung đầy đủ 1 ghi nhớ
  const itemMatch = pathname.match(/^\/api\/brain\/item\/([^/]+)$/);
  if (itemMatch && request.method === "GET") {
    const id = decodeURIComponent(itemMatch[1]);
    const raw = await env.AUTH_SESSIONS.get(`brain_item:${email}:${id}`);
    if (!raw) return jsonRes({ error: "Không tìm thấy ghi nhớ." }, 404);
    return jsonRes({ ok: true, item: JSON.parse(raw) });
  }

  // POST /api/brain -> thêm ghi nhớ thủ công từ giao diện
  if (pathname === "/api/brain" && request.method === "POST") {
    try {
      const body = await request.json();
      const content = String(body.summary || body.content || "").trim();
      if (!content && !body.sourceUrl) {
        return jsonRes({ error: "Vui lòng nhập nội dung hoặc đường dẫn cần lưu." }, 400);
      }
      const saved = await saveMemoryEntry(email, body, env);
      return jsonRes({ ok: true, item: saved });
    } catch {
      return jsonRes({ error: "Không thể lưu vào Bộ não thứ 2." }, 500);
    }
  }

  // DELETE /api/brain/item/:id -> xóa 1 ghi nhớ
  if (itemMatch && request.method === "DELETE") {
    const id = decodeURIComponent(itemMatch[1]);
    await env.AUTH_SESSIONS.delete(`brain_item:${email}:${id}`);
    const indexList = await getBrainIndex(email, env);
    const nextList = indexList.filter((it) => it.id !== id);
    await saveBrainIndex(email, nextList, env);
    return jsonRes({ ok: true, id, count: nextList.length });
  }

  return jsonRes({ error: "Method Not Allowed" }, 405);
}
