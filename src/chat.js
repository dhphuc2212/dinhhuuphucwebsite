import { jsonRes } from "./utils.js";

// Có thể đổi sang URL Cloudflare AI Gateway của bạn nếu node Cloudflare định tuyến qua Hồng Kông
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function buildSystemPrompt(todayIso, timezone) {
  return `Bạn là Trợ lý AI thông minh, am hiểu sâu sắc và đa năng trên website cá nhân của Đinh Hữu Phúc (dinhhuuphuc.com).
Ngày hiện tại của người dùng là: ${todayIso} (Múi giờ: ${timezone}, +07:00).

1. VAI TRÒ & KHẢ NĂNG CỦA BẠN:
- Bạn vừa là Trợ lý sắp xếp lịch làm việc Google Calendar thông minh, vừa là Trợ lý phân tích & giải đáp mọi câu hỏi (tư vấn kinh doanh, phân tích chiến lược, kiến thức công nghệ, đời sống, tính toán giá bán/chiết khấu, lập kế hoạch...).
- Khi người dùng đặt câu hỏi phân tích, hỏi kiến thức hoặc trò chuyện: hãy trả lời sâu sắc, rõ ràng, có cấu trúc mạch lạc, đi thẳng vào trọng tâm và đặt "schedule": null.
- Khi người dùng nhắn nội dung có ý định đặt lịch, nhắc việc, tham gia sự kiện, hẹn giờ: hãy bóc tách chính xác thông tin sự kiện vào "schedule", đồng thời trong "reply" xác nhận rõ tên sự kiện, ngày và khung giờ bắt đầu - kết thúc.

2. QUY TẮC BÓC TÁCH LỊCH ("schedule"):
- "title": Chỉ lấy tên gọn gàng, sạch sẽ của sự kiện/công việc (loại bỏ các cụm từ thời gian thừa như "Hôm nay từ 8h - 22h:", "Đặt lịch", "Ngày 2026-11-24...").
- "date": Ngày bắt đầu chuẩn YYYY-MM-DD (tính dựa trên ngày hiện tại ${todayIso}).
- "endDate": Ngày kết thúc chuẩn YYYY-MM-DD (bằng "date" nếu diễn ra trong 1 ngày).
- "startTime": Giờ bắt đầu chuẩn 24h HH:MM (ví dụ "08:00").
- "endTime": Giờ kết thúc chuẩn 24h HH:MM (ví dụ "22:00". Nếu người dùng không nói giờ kết thúc thì mặc định cộng 1 tiếng sau startTime).
- "description": Ghi chú chi tiết, địa điểm hoặc các đầu việc cần lưu ý (nếu có).

3. THÔNG TIN THAM KHẢO VỀ ĐINH HỮU PHÚC & CÔNG VIỆC:
- Họ tên: Đinh Hữu Phúc • Khu vực: Phường Hòa Bình, TP.HCM.
- Email cá nhân: dhphuc2212@dinhhuuphuc.com và dhphuc2212@gmail.com.
- Liên hệ Zalo: https://zalo.me/0983533945 (không viết số điện thoại thô dưới dạng văn bản gọi trực tiếp, hướng dẫn bấm nút Liên hệ qua Zalo).
- Thương hiệu công việc: Gạo Ông Du (website: gaoongdu.vn, email: info@gaoongdu.vn) thuộc Công ty CP Nông nghiệp Gạo Hữu cơ TD Sóc Trăng.
- Bảng giá sản phẩm Gạo Ông Du hiện hành (Đơn giá bán NTD):
  1. GẠO ST25 "HỮU CƠ" 1KG — 72,000đ | 5KG — 360,000đ
  2. GẠO ST25 "TD XANH" 1KG — 52,000đ | 5KG — 260,000đ
  3. GẠO TẤM ST25 "HỮU CƠ" 2KG — 82,000đ
  4. GẠO LÀI THƠM 1KG — 35,500đ | 5KG — 177,500đ
  5. GẠO LỨT DÂU TÂY ĐỎ 1KG — 112,000đ
  6. GẠO LỨT DÂU TÂY TÍM 1KG — 112,000đ
  7. GẠO NẾP SẾU ĐẦU ĐỎ 1KG — 112,000đ
  8. GẠO NẾP CHIM SÂM CẦM 1KG — 112,000đ
  9. GẠO SUMO (1 KG) — 112,000đ

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON THUẦN (không bọc markdown \`\`\`json):
{
  "reply": "Câu trả lời tiếng Việt chi tiết, tự nhiên, thông minh cho người dùng",
  "schedule": null hoặc {
    "title": "Tên sự kiện gọn gàng",
    "date": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "description": "Ghi chú thêm"
  }
}`;
}

function fallbackScheduleParser(message, todayIso) {
  const rangeMatch = message.match(
    /\b(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\s*(?:-|–|đến|tới|to)\s*(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\b/i
  );
  const singleMatch = message.match(/\b(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\b/i);

  if (!rangeMatch && !singleMatch) return null;

  const startH = (rangeMatch ? rangeMatch[1] : singleMatch[1]).padStart(2, "0");
  const startM = ((rangeMatch ? rangeMatch[2] : singleMatch[2]) || "00").padStart(2, "0");
  const endH = rangeMatch
    ? rangeMatch[3].padStart(2, "0")
    : String((parseInt(startH, 10) + 1) % 24).padStart(2, "0");
  const endM = rangeMatch ? (rangeMatch[4] || "00").padStart(2, "0") : startM;

  const explicitDate = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const isTomorrow = /ngày mai|mai\b/i.test(message);
  let dateStr = explicitDate ? explicitDate[1] : todayIso;
  if (!explicitDate && isTomorrow) {
    const targetDate = new Date(todayIso + "T00:00:00");
    targetDate.setDate(targetDate.getDate() + 1);
    dateStr = targetDate.toISOString().slice(0, 10);
  }

  const cleanTitle =
    message
      .replace(/^(hôm nay|ngày mai|mai|đặt lịch)\s*/i, "")
      .replace(/từ\s*\d{1,2}\s*(?:h|:|giờ)\s*\d{0,2}\s*(?:-|–|đến|tới)\s*\d{1,2}\s*(?:h|:|giờ)\s*\d{0,2}\s*[:\-]?\s*/i, "")
      .replace(/—\s*Ngày\s*\d{4}-\d{2}-\d{2}.*$/i, "")
      .trim() || message;

  return {
    reply: `Đã nhận diện lịch "${cleanTitle}" từ ${startH}:${startM} đến ${endH}:${endM} ngày ${dateStr}. Bạn kiểm tra và bấm Lưu vào Google Calendar nhé!`,
    schedule: {
      title: cleanTitle,
      date: dateStr,
      endDate: dateStr,
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`,
      description: "Tạo từ trợ lý dinhhuuphuc.com"
    }
  };
}

export async function handleChatRoutes(pathname, request, env) {
  if (pathname === "/api/models") {
    if (!env.GEMINI_API_KEY) {
      return jsonRes({ error: "Chưa cấu hình GEMINI_API_KEY trên Worker." }, 400);
    }
    try {
      const res = await fetch(`${GEMINI_BASE_URL}/models`, {
        headers: { "x-goog-api-key": env.GEMINI_API_KEY.trim() }
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        return jsonRes({ status: res.status, googleError: data?.error || data }, 400);
      }
      const available = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => ({
          id: (m.name || "").replace(/^models\//, ""),
          displayName: m.displayName || m.name
        }));
      return jsonRes({ count: available.length, models: available }, 200);
    } catch (e) {
      return jsonRes({ error: e?.message || "Lỗi kết nối Gemini API." }, 500);
    }
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
      const timezone = (body.timezone || "Asia/Ho_Chi_Minh").toString();

      if (!message) return jsonRes({ error: "Vui lòng nhập nội dung." }, 400);
      if (!env.GEMINI_API_KEY) {
        return jsonRes({ reply: "Hệ thống AI chưa có GEMINI_API_KEY trên Cloudflare Worker.", schedule: null });
      }

      const systemPrompt = buildSystemPrompt(todayIso, timezone);
      let candidateModels = [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-flash-latest"
      ];

      try {
        const listRes = await fetch(`${GEMINI_BASE_URL}/models`, {
          signal: AbortSignal.timeout(4000),
          headers: { "x-goog-api-key": env.GEMINI_API_KEY.trim() }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const dynamicFlashModels = (listData.models || [])
            .filter(
              (m) =>
                (m.supportedGenerationMethods || []).includes("generateContent") &&
                /gemini-(3|flash)/i.test(m.name) &&
                !/gemini-1\.|gemini-2\.0|gemini-2\.5|embedding|imagen|veo/i.test(m.name)
            )
            .map((m) => m.name.replace(/^models\//, ""))
            .reverse();
          candidateModels = [...new Set([...candidateModels, ...dynamicFlashModels])];
        }
      } catch {}

      let lastError = "";
      for (const modelName of candidateModels) {
        try {
          const res = await fetch(`${GEMINI_BASE_URL}/models/${modelName}:generateContent`, {
            method: "POST",
            signal: AbortSignal.timeout(12000),
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY.trim()
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: message }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.5
              }
            })
          });
          const data = await res.json();
          if (!res.ok || data?.error) {
            lastError = data?.error?.message || `HTTP ${res.status}`;
            continue;
          }
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          let parsed = { reply: "Xin lỗi, mình chưa thể phản hồi lúc này.", schedule: null };
          try {
            const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            parsed = JSON.parse(cleaned);
          } catch {
            if (rawText) parsed.reply = rawText;
          }
          return jsonRes({
            reply: parsed.reply || "Đã ghi nhận!",
            schedule: parsed.schedule || null,
            model: modelName
          });
        } catch (e) {
          lastError = e?.message || "Timeout";
        }
      }

      const fallback = fallbackScheduleParser(message, todayIso);
      if (fallback) return jsonRes(fallback);

      return jsonRes({
        reply: `Kết nối tới Gemini API đang gặp sự cố (${lastError}). Bạn kiểm tra lại cấu hình kết nối trên Cloudflare Worker nhé!`,
        schedule: null
      });
    } catch {
      return jsonRes({ reply: "Có lỗi kết nối tới hệ thống AI.", schedule: null });
    }
  }

  return null;
}