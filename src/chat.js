import { jsonRes } from "./utils.js";
import { resolveBrainUserEmail, saveMemoryEntry, searchRelevantMemories } from "./second-brain.js";

function formatIsoToDmy(isoStr = "") {
  const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : isoStr;
}

function buildSystemPrompt(todayIso, todayDmy, timezone, retrievedMemories = []) {
  let memorySection = "";
  if (retrievedMemories.length > 0) {
    const blocks = retrievedMemories.map((m, i) => {
      const urlPart = m.sourceUrl ? ` | Nguồn: ${m.sourceUrl}` : "";
      const tagsPart = Array.isArray(m.tags) && m.tags.length ? ` | Từ khóa: ${m.tags.join(", ")}` : "";
      return `[Ghi nhớ #${i + 1}: ${m.title}${tagsPart}${urlPart}]\n${m.summary}`;
    });
    memorySection = `\n6. KIẾN THỨC TỪ "BỘ NÃO THỨ 2" DO NGƯỜI DÙNG ĐÃ DẠY (Ưu tiên sử dụng thông tin dưới đây để trả lời nếu câu hỏi liên quan):\n${blocks.join("\n---\n")}\n`;
  }

  return `Bạn là Trợ lý AI thông minh, thân thiện và đa năng tích hợp trên website dinhhuuphuc.com.
Ngày hiện tại của người dùng là: ${todayDmy} (tức ${todayIso}, múi giờ: ${timezone}, +07:00).

1. CÁCH XƯNG HÔ & PHONG CÁCH TRẢ LỜI:
- Luôn giới thiệu ngắn gọn và tự nhiên là "Tôi là trợ lý AI".
- Trả lời súc tích, rõ ràng, đúng trọng tâm bằng tiếng Việt tự nhiên.

2. KHẢ NĂNG GHI NHỚ "BỘ NÃO THỨ 2" (TRAINING KIẾN THỨC CÁ NHÂN):
- Khi người dùng yêu cầu ghi nhớ, lưu kiến thức, lưu bài viết, lưu video YouTube/Facebook, hoặc gửi thông tin mới để dạy bạn (ví dụ: "Ghi nhớ giúp tôi...", "Lưu thông tin này...", "Học nội dung này...", "Lưu video này..."):
  + Hãy chắt lọc và tóm tắt đầy đủ ý chính vào object "memoryToSave" (không làm mất số liệu, tên riêng, công thức hay link gốc).
  + Đặt "memoryToSave": { "title": "Tiêu đề ngắn gọn", "summary": "Nội dung tóm tắt chi tiết các ý quan trọng", "tags": ["từ khóa 1", "từ khóa 2"], "sourceUrl": "Link URL nếu có hoặc chuỗi rỗng" }.
- Khi người dùng chỉ hỏi thông tin bình thường: đặt "memoryToSave": null.

3. KHẢ NĂNG XỬ LÝ LỊCH TRÌNH (4 HÀNH ĐỘNG):
- Khi không liên quan tạo/sửa/xóa/hoàn thành lịch: đặt "schedule": null.
- Khi liên quan lịch làm việc, trả về object "schedule" với "action" là "create" | "update" | "delete" | "complete".
- Trong "reply" và "description": BẮT BUỘC viết ngày dạng DD-MM-YYYY. Trong "schedule.date", "schedule.endDate", "schedule.targetDate": giữ chuẩn YYYY-MM-DD.

4. CẤU TRÚC OBJECT "schedule" (nếu có):
{
  "action": "create" | "update" | "delete" | "complete",
  "targetTitle": "Từ khóa tên sự kiện cũ cần tìm (dùng cho update/delete/complete, để rỗng nếu là create)",
  "targetDate": "YYYY-MM-DD ngày của sự kiện cũ cần tìm (mặc định ${todayIso})",
  "title": "Tên sự kiện",
  "date": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "description": "Ghi chú chi tiết",
  "done": true
}

5. DỮ LIỆU CỐ ĐỊNH THAM KHẢO:
- Liên hệ: Đinh Hữu Phúc • Phường Hòa Bình, TP.HCM • Email: dhphuc2212@dinhhuuphuc.com, dhphuc2212@gmail.com • Zalo: https://zalo.me/0983533945 (hướng dẫn bấm nút Liên hệ qua Zalo, không viết số điện thoại thô).
- Công việc: Thương hiệu Gạo Ông Du (gaoongdu.vn, email: info@gaoongdu.vn) thuộc Công ty CP Nông nghiệp Gạo Hữu cơ TD Sóc Trăng.
- Bảng giá bán NTD Gạo Ông Du:
  1. GẠO ST25 "HỮU CƠ" 1KG — 72,000đ | 5KG — 360,000đ
  2. GẠO ST25 "TD XANH" 1KG — 52,000đ | 5KG — 260,000đ
  3. GẠO TẤM ST25 "HỮU CƠ" 2KG — 82,000đ
  4. GẠO LÀI THƠM 1KG — 35,500đ | 5KG — 177,500đ
  5. GẠO LỨT DÂU TÂY ĐỎ 1KG — 112,000đ
  6. GẠO LỨT DÂU TÂY TÍM 1KG — 112,000đ
  7. GẠO NẾP SẾU ĐẦU ĐỎ 1KG — 112,000đ
  8. GẠO NẾP CHIM SÂM CẦM 1KG — 112,000đ
  9. GẠO SUMO (1 KG) — 112,000đ
${memorySection}
CHỈ TRẢ VỀ ĐÚNG MỘT KHỐI JSON DUY NHẤT (không giải thích ngoài JSON, không bọc markdown):
{"reply":"Câu trả lời tiếng Việt ngắn gọn, tự nhiên","schedule":null,"memoryToSave":null}`;
}

function extractAiPayload(result) {
  const raw = result?.response ?? result;

  if (raw && typeof raw === "object") {
    if (typeof raw.reply === "string") {
      return {
        reply: raw.reply,
        schedule: raw.schedule || null,
        memoryToSave: raw.memoryToSave || null
      };
    }
    if (typeof raw.response === "string") {
      return extractAiPayload({ response: raw.response });
    }
    return { reply: JSON.stringify(raw), schedule: null, memoryToSave: null };
  }

  const rawText = String(raw || "").trim();
  if (!rawText) {
    return { reply: "Xin lỗi, tôi chưa nhận được phản hồi từ AI.", schedule: null, memoryToSave: null };
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj && typeof obj.reply === "string") {
        return {
          reply: obj.reply,
          schedule: obj.schedule || null,
          memoryToSave: obj.memoryToSave || null
        };
      }
    } catch {}
  }

  return { reply: rawText, schedule: null, memoryToSave: null };
}

export async function handleChatRoutes(pathname, request, env) {
  if (pathname === "/api/models") {
    return jsonRes({
      provider: "Cloudflare Workers AI",
      ready: Boolean(env.AI),
      models: [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/google/gemma-3-12b-it"
      ]
    });
  }

  if (pathname === "/api/chat") {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Session-Id"
        }
      });
    }
    if (request.method !== "POST") {
      return jsonRes({ error: "Method Not Allowed" }, 405);
    }

    try {
      const body = await request.json();
      const message = (body.message || "").toString().trim();
      const todayIso = (body.today || new Date().toISOString().slice(0, 10)).toString();
      const todayDmy = formatIsoToDmy(todayIso);
      const timezone = (body.timezone || "Asia/Ho_Chi_Minh").toString();

      if (!message) return jsonRes({ error: "Vui lòng nhập nội dung." }, 400);
      if (!env.AI) {
        return jsonRes({
          reply: "Chưa bật binding AI trong wrangler.jsonc. Bạn kiểm tra lại cấu hình nhé!",
          schedule: null
        });
      }

      // Truy xuất kiến thức liên quan từ Bộ Não Thứ 2 (nếu đã đăng nhập Google)
      const userEmail = await resolveBrainUserEmail(request, env);
      const relevantMemories = userEmail
        ? await searchRelevantMemories(userEmail, message, env, 5)
        : [];

      const systemPrompt = buildSystemPrompt(todayIso, todayDmy, timezone, relevantMemories);
      const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
      const conversationMsgs = [{ role: "system", content: systemPrompt }];

      for (const h of history) {
        if (h && typeof h.text === "string" && h.text.trim()) {
          conversationMsgs.push({
            role: h.role === "user" ? "user" : "assistant",
            content: h.text.slice(0, 1500)
          });
        }
      }
      conversationMsgs.push({ role: "user", content: message });

      const models = [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/google/gemma-3-12b-it"
      ];

      let lastError = "";
      for (const modelName of models) {
        try {
          const result = await env.AI.run(modelName, {
            messages: conversationMsgs,
            temperature: 0.3,
            max_tokens: 1200
          });

          const parsed = extractAiPayload(result);
          let replyStr = typeof parsed.reply === "string" ? parsed.reply : String(parsed.reply || "Đã ghi nhận!");
          replyStr = replyStr.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3-$2-$1");

          let savedMemory = null;
          if (parsed.memoryToSave && typeof parsed.memoryToSave === "object") {
            if (userEmail) {
              // Tự bắt link URL trong tin nhắn gốc nếu AI chưa điền sourceUrl
              const urlInMsg = message.match(/https?:\/\/[^\s)]+/i);
              if (!parsed.memoryToSave.sourceUrl && urlInMsg) {
                parsed.memoryToSave.sourceUrl = urlInMsg[0];
              }
              savedMemory = await saveMemoryEntry(userEmail, parsed.memoryToSave, env);
            } else {
              replyStr += "\n\n(Lưu ý: Bạn hãy đăng nhập Google ở góc trên để tôi lưu kiến thức này vĩnh viễn vào Bộ não thứ 2 nhé!)";
            }
          }

          return jsonRes({
            reply: replyStr,
            schedule: parsed.schedule || null,
            savedMemory,
            usedMemoriesCount: relevantMemories.length,
            model: modelName
          });
        } catch (e) {
          lastError = e?.message || "Lỗi Workers AI";
        }
      }

      return jsonRes({
        reply: `Hệ thống AI đang bận (${lastError}). Bạn thử lại nhé!`,
        schedule: null
      });
    } catch {
      return jsonRes({ reply: "Có lỗi kết nối tới hệ thống AI.", schedule: null });
    }
  }

  return null;
}
