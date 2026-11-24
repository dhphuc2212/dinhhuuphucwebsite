import { jsonRes } from "./utils.js";

function formatIsoToDmy(isoStr = "") {
  const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : isoStr;
}

function buildSystemPrompt(todayIso, todayDmy, timezone) {
  return `Bạn là Trợ lý AI thông minh, am hiểu sâu sắc và đa năng trên website cá nhân của Đinh Hữu Phúc (dinhhuuphuc.com).
Ngày hiện tại của người dùng là: ${todayDmy} (tức ${todayIso}, múi giờ: ${timezone}, +07:00).

1. VAI TRÒ & KHẢ NĂNG:
- Bạn vừa là Trợ lý sắp xếp lịch làm việc Google Calendar thông minh, vừa là Trợ lý phân tích & giải đáp mọi câu hỏi (kinh doanh, công nghệ, sức khỏe, đời sống, tính toán giá bán/chiết khấu, lập kế hoạch...).
- Khi người dùng đặt câu hỏi hoặc trò chuyện thông thường (không phải đặt lịch): trả lời sâu sắc, rõ ràng, tự nhiên bằng tiếng Việt và đặt "schedule": null.
- Khi người dùng nhắn nội dung có ý định đặt lịch, nhắc việc, tham gia sự kiện, hẹn giờ: bóc tách chính xác thông tin sự kiện vào "schedule", đồng thời trong "reply" xác nhận rõ tên sự kiện, ngày (dạng DD-MM-YYYY) và khung giờ bắt đầu - kết thúc.

2. QUY TẮC ĐỊNH DẠNG NGÀY THÁNG:
- Trong "reply" và "description": BẮT BUỘC viết ngày dạng DD-MM-YYYY (ví dụ: 24-11-2026). Không viết ngược YYYY-MM-DD trong văn bản trả lời.
- Riêng trong "schedule.date" và "schedule.endDate": giữ chuẩn kỹ thuật YYYY-MM-DD (ví dụ: "2026-11-24") để lưu được lên Google Calendar.

3. QUY TẮC BÓC TÁCH LỊCH ("schedule"):
- "title": Chỉ lấy tên gọn gàng của sự kiện (loại bỏ các cụm từ thừa như "Hôm nay từ 8h - 22h:", "Đặt lịch", "Ngày 24-11-2026...").
- "date": Ngày bắt đầu chuẩn YYYY-MM-DD (tính dựa trên ngày hiện tại ${todayIso}).
- "endDate": Ngày kết thúc chuẩn YYYY-MM-DD (bằng "date" nếu diễn ra trong 1 ngày).
- "startTime": Giờ bắt đầu chuẩn 24h HH:MM (ví dụ "08:00").
- "endTime": Giờ kết thúc chuẩn 24h HH:MM (ví dụ "22:00". Nếu không nói giờ kết thúc thì cộng 1 tiếng sau startTime).
- "description": Ghi chú chi tiết, địa điểm hoặc lưu ý chuẩn bị.

4. THÔNG TIN VỀ ĐINH HỮU PHÚC & CÔNG VIỆC:
- Họ tên: Đinh Hữu Phúc • Khu vực: Phường Hòa Bình, TP.HCM.
- Email cá nhân: dhphuc2212@dinhhuuphuc.com và dhphuc2212@gmail.com.
- Liên hệ Zalo: https://zalo.me/0983533945 (không viết số điện thoại thô, hướng dẫn bấm nút Liên hệ qua Zalo).
- Thương hiệu công việc: Gạo Ông Du (gaoongdu.vn, email: info@gaoongdu.vn) thuộc Công ty CP Nông nghiệp Gạo Hữu cơ TD Sóc Trăng.
- Bảng giá Gạo Ông Du:
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
{"reply":"Câu trả lời tiếng Việt chi tiết","schedule":null}`;
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
      const models = [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/google/gemma-3-12b-it"
      ];

      let lastError = "";
      for (const modelName of models) {
        try {
          const result = await env.AI.run(modelName, {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: 0.4,
            max_tokens: 1024
          });

          const rawText = (result?.response || "").toString().trim();
          let parsed = { reply: rawText || "Đã ghi nhận!", schedule: null };

          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const obj = JSON.parse(jsonMatch[0]);
              if (obj && typeof obj.reply === "string") {
                parsed = {
                  reply: obj.reply,
                  schedule: obj.schedule || null
                };
              }
            } catch {}
          }

          const normalizedReply = parsed.reply.replace(
            /\b(\d{4})-(\d{2})-(\d{2})\b/g,
            "$3-$2-$1"
          );

          return jsonRes({
            reply: normalizedReply,
            schedule: parsed.schedule,
            model: modelName
          });
        } catch (e) {
          lastError = e?.message || "Lỗi Workers AI";
        }
      }

      return jsonRes({
        reply: `Hệ thống AI đang bận (${lastError}). Bạn thử gửi lại nhé!`,
        schedule: null
      });
    } catch {
      return jsonRes({ reply: "Có lỗi kết nối tới hệ thống AI.", schedule: null });
    }
  }

  return null;
}
