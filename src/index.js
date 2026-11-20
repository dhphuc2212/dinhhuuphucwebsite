export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint AI Chatbot Gemini (giấu kín GEMINI_API_KEY ở phía Worker)
    if (url.pathname === "/api/chat") {
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
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const body = await request.json();
        const message = (body.message || "").toString().trim();
        const todayIso = (body.today || new Date().toISOString().slice(0, 10)).toString();
        const timezone = (body.timezone || "Asia/Ho_Chi_Minh").toString();

        if (!message) {
          return new Response(JSON.stringify({ error: "Vui lòng nhập nội dung." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        // [BẠN CẦN ĐIỀN TRÊN CLOUDFLARE]:
        // Vào Cloudflare Dashboard -> Workers & Pages -> dinhhuuphucwebsite -> Settings -> Variables and Secrets
        // Thêm biến bí mật tên là: GEMINI_API_KEY (chọn Encrypt / Secret) và dán API Key từ Google AI Studio vào.
        if (!env.GEMINI_API_KEY) {
          return new Response(
            JSON.stringify({
              reply:
                "Hệ thống AI chưa có GEMINI_API_KEY trên Cloudflare Worker. Bạn hãy thêm biến bí mật GEMINI_API_KEY trong phần Settings -> Variables and Secrets của Worker nhé!",
              schedule: null
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        const systemPrompt = `Bạn là Trợ lý AI thông minh trên website cá nhân của Đinh Hữu Phúc (dinhhuuphuc.com).
Ngày hiện tại của người dùng là: ${todayIso} (Múi giờ: ${timezone}, +07:00).

THÔNG TIN CÁ NHÂN:
- Họ tên: Đinh Hữu Phúc
- Khu vực: Hòa Bình, TP.HCM
- Email: contact@gaoongdu.vn
- Liên hệ Zalo: https://zalo.me/0983533945 (tuyệt đối không viết số điện thoại thô dưới dạng văn bản gọi trực tiếp, luôn hướng dẫn bấm nút Liên hệ qua Zalo).

THÔNG TIN CÔNG VIỆC (Thuộc tab Công việc trên website):
- Thương hiệu: Gạo Ông Du (website: gaoongdu.vn)
- Đơn vị chủ quản: Công ty CP Nông nghiệp Gạo Hữu cơ TD Sóc Trăng
- Bảng giá sản phẩm hiện hành (Đơn giá bán NTD):
  1. GẠO ST25 "HỮU CƠ" 1KG (Trọng lượng đóng gói: 1 KG) — 72,000
  2. GẠO ST25 "HỮU CƠ" 5KG (Trọng lượng đóng gói: 5 KG) — 360,000
  3. GẠO ST25 "TD XANH" 1KG (Trọng lượng đóng gói: 1 KG) — 52,000
  4. GẠO ST25 "TD XANH" 5KG (Trọng lượng đóng gói: 5 KG) — 260,000
  5. GẠO TẤM ST25 "HỮU CƠ" 2KG (Trọng lượng đóng gói: 1 KG) — 82,000
  6. GẠO LÀI THƠM 1KG (Trọng lượng đóng gói: 1 KG) — 35,500
  7. GẠO LÀI THƠM 5KG (Trọng lượng đóng gói: 5 KG) — 177,500
  8. GẠO LỨT DÂU TÂY ĐỎ 1KG (Trọng lượng đóng gói: 1 KG) — 112,000
  9. GẠO LỨT DÂU TÂY TÍM 1KG (Trọng lượng đóng gói: 1 KG) — 112,000
  10. GẠO NẾP SẾU ĐẦU ĐỎ 1KG (Trọng lượng đóng gói: 1 KG) — 112,000
  11. GẠO NẾP CHIM SÂM CẦM 1KG (Trọng lượng đóng gói: 1 KG) — 112,000
  12. GẠO SUMO (Trọng lượng đóng gói: 1 KG) — 112,000

NHIỆM VỤ BÓC TÁCH LỊCH LÀM VIỆC:
- Nếu người dùng nhắn nội dung mang tính sắp xếp, đặt lịch, nhắc việc, hẹn giờ (ví dụ: "Hôm nay 19h họp đại lý", "Ngày mai 9h sáng kiểm kho", "14h30 gặp đối tác"...), hãy bóc tách thông tin sự kiện vào trường "schedule".
- Nếu chỉ là trò chuyện bình thường hoặc hỏi thông tin, đặt "schedule": null.

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON THUẦN (không bọc markdown \`\`\`json):
{
  "reply": "Câu trả lời tiếng Việt tự nhiên, ngắn gọn, lịch sự cho người dùng",
  "schedule": null hoặc {
    "title": "Tiêu đề ngắn gọn của lịch làm việc",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "description": "Ghi chú thêm nếu có"
  }
}`;

const geminiResponse = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    })
  }
);

        const rawResult = await geminiResponse.json();
        if (!geminiResponse.ok || rawResult?.error) {
  const apiErr = rawResult?.error?.message || `HTTP ${geminiResponse.status}`;
  return new Response(
    JSON.stringify({
      reply: `Lỗi từ Gemini API: ${apiErr}`,
      schedule: null
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
        const rawText = rawResult?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        let parsed = {
          reply: "Xin lỗi, mình chưa thể phản hồi lúc này. Bạn thử nhắn lại nhé!",
          schedule: null
        };

        try {
          parsed = JSON.parse(rawText);
        } catch {
          if (rawText) {
            parsed.reply = rawText;
          }
        }

        return new Response(
          JSON.stringify({
            reply: parsed.reply || "Đã ghi nhận!",
            schedule: parsed.schedule || null
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            reply: "Có lỗi kết nối tới Gemini API. Vui lòng thử lại sau.",
            schedule: null
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Phục vụ các file tĩnh (index.html, css/*, js/*, sections/*)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
};
