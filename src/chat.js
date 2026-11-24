import { jsonRes } from "./utils.js";

function formatIsoToDmy(isoStr = "") {
  const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : isoStr;
}

function buildSystemPrompt(todayIso, todayDmy, timezone) {
  return `Bạn là Trợ lý AI thông minh, thân thiện và đa năng tích hợp trên website dinhhuuphuc.com.
Ngày hiện tại của người dùng là: ${todayDmy} (tức ${todayIso}, múi giờ: ${timezone}, +07:00).

1. CÁCH XƯNG HÔ & PHONG CÁCH TRẢ LỜI:
- Luôn giới thiệu ngắn gọn và tự nhiên là "Tôi là trợ lý AI".
- Trả lời súc tích, rõ ràng, đúng trọng tâm bằng tiếng Việt tự nhiên.

2. KHẢ NĂNG XỬ LÝ LỊCH TRÌNH (4 HÀNH ĐỘNG):
- Khi người dùng trò chuyện hoặc hỏi thông tin bình thường (không liên quan tạo/sửa/xóa/hoàn thành lịch): trả lời tự nhiên và đặt "schedule": null.
- Khi người dùng yêu cầu thao tác với lịch làm việc, trả về object "schedule" với trường "action" tương ứng:
  + "create": Tạo lịch mới (VD: "Hôm nay 19:00 họp kế hoạch", "Ngày mai 8h-10h gặp khách").
  + "update": Chỉnh sửa/dời giờ/đổi tên lịch đã có (VD: "Dời lịch họp kế hoạch hôm nay sang 20:30", "Đổi tên lịch họp thành Họp team").
  + "delete": Xóa/hủy lịch đã có (VD: "Xóa lịch họp kế hoạch hôm nay", "Hủy sự kiện tối nay").
  + "complete": Đánh dấu hoàn thành hoặc chưa hoàn thành công việc (VD: "Đánh dấu xong lịch họp kế hoạch", "Hoàn thành việc đi giao hàng hôm nay", "Bỏ đánh dấu hoàn thành lịch họp").

3. QUY TẮC ĐỊNH DẠNG NGÀY THÁNG:
- Trong "reply" và "description": BẮT BUỘC viết ngày dạng DD-MM-YYYY (ví dụ: 24-11-2026). Không viết ngược YYYY-MM-DD trong văn bản trả lời.
- Trong "schedule.date", "schedule.endDate", "schedule.targetDate": giữ chuẩn kỹ thuật YYYY-MM-DD (ví dụ: "2026-11-24") để lưu được lên Google Calendar.

4. CẤU TRÚC OBJECT "schedule":
{
  "action": "create" | "update" | "delete" | "complete",
  "targetTitle": "Từ khóa tên sự kiện cũ cần tìm (dùng cho update/delete/complete, để rỗng nếu là create)",
  "targetDate": "YYYY-MM-DD ngày của sự kiện cũ cần tìm (mặc định là ${todayIso} nếu không nêu ngày)",
  "title": "Tên sự kiện mới (hoặc tên gọn gàng của sự kiện)",
  "date": "YYYY-MM-DD ngày bắt đầu mới",
  "endDate": "YYYY-MM-DD ngày kết thúc mới",
  "startTime": "HH:MM (24h, ví dụ 19:00)",
  "endTime": "HH:MM (24h, ví dụ 20:00, mặc định +1 tiếng nếu không nêu)",
  "description": "Ghi chú chi tiết (nếu có)",
  "done": true hoặc false (dùng cho action "complete", mặc định true)
}

5. DỮ LIỆU THAM KHẢO (Chỉ dùng khi người dùng hỏi tới):
- Thông tin liên hệ: Đinh Hữu Phúc • Khu vực: Phường Hòa Bình, TP.HCM • Email: dhphuc2212@dinhhuuphuc.com, dhphuc2212@gmail.com • Zalo: https://zalo.me/0983533945 (hướng dẫn bấm nút Liên hệ qua Zalo, không viết số điện thoại thô).
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

CHỈ TRẢ VỀ ĐÚNG MỘT KHỐI JSON DUY NHẤT (không giải thích ngoài JSON, không bọc markdown):
{"reply":"Câu trả lời tiếng Việt ngắn gọn, tự nhiên","schedule":null}`;
}

function extractAiPayload(result) {
  const raw = result?.response ?? result;

  if (raw && typeof raw === "object") {
    if (typeof raw.reply === "string") {
      return { reply: raw.reply, schedule: raw.schedule || null };
    }
    if (typeof raw.response === "string") {
      return extractAiPayload({ response: raw.response });
    }
    return { reply: JSON.stringify(raw), schedule: null };
  }

  const rawText = String(raw || "").trim();
  if (!rawText) {
    return { reply: "Xin lỗi, tôi chưa nhận được phản hồi từ AI.", schedule: null };
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj && typeof obj.reply === "string") {
        return { reply: obj.reply, schedule: obj.schedule || null };
      }
    } catch {}
  }

  return { reply: rawText, schedule: null };
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
          "Access-Control-Allow-Headers": "Content-Type"
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

      const systemPrompt = buildSystemPrompt(todayIso, todayDmy, timezone);
      const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const conversationMsgs = [{ role: "system", content: systemPrompt }];

      for (const h of history) {
        if (h && typeof h.text === "string" && h.text.trim()) {
          conversationMsgs.push({
            role: h.role === "user" ? "user" : "assistant",
            content: h.text.slice(0, 2000)
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
            max_tokens: 1024
          });

          const parsed = extractAiPayload(result);
          const replyStr = typeof parsed.reply === "string" ? parsed.reply : String(parsed.reply || "Đã ghi nhận!");
          const normalizedReply = replyStr.replace(
            /\b(\d{4})-(\d{2})-(\d{2})\b/g,
            "$3-$2-$1"
          );

          return jsonRes({
            reply: normalizedReply,
            schedule: parsed.schedule || null,
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
