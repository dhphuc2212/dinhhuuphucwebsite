export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    // 1. Trang Chính sách quyền riêng tư (/privacy)
    if (pathname === "/privacy") {
      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chính sách quyền riêng tư — Đinh Hữu Phúc</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.65; margin: 0; padding: 32px 16px; }
    .card { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04); }
    h1 { font-size: 1.6rem; margin-top: 0; color: #0f766e; }
    h2 { font-size: 1.1rem; margin-top: 24px; color: #1e293b; }
    p, li { color: #334155; font-size: 0.96rem; }
    a { color: #0f766e; text-decoration: none; font-weight: 500; }
    .meta { font-size: 0.85rem; color: #64748b; margin-bottom: 20px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Chính sách quyền riêng tư (Privacy Policy)</h1>
    <div class="meta">Cập nhật lần cuối: 22/11/2026 • Website: dinhhuuphuc.com</div>
    <h2>1. Dữ liệu chúng tôi truy cập</h2>
    <p>Khi bạn chủ động nhấn nút <strong>"Đăng nhập với Google để xem lịch"</strong> trên website <strong>dinhhuuphuc.com</strong>, ứng dụng chỉ yêu cầu các quyền tối thiểu gồm:</p>
    <ul>
      <li><strong>Thông tin hồ sơ cơ bản (Email, Tên hiển thị):</strong> dùng để hiển thị đúng tài khoản Google đang kết nối trên giao diện.</li>
      <li><strong>Google Calendar (calendar.events):</strong> dùng để đọc danh sách sự kiện sắp tới và thêm sự kiện lịch làm việc mới theo yêu cầu trực tiếp của bạn.</li>
    </ul>
    <h2>2. Cách thức lưu trữ và bảo mật</h2>
    <p>Phiên đăng nhập và token truy cập Google Calendar được xử lý trực tiếp trên trình duyệt của bạn. Website <strong>không</strong> lưu trữ mật khẩu, không thu thập hay chia sẻ dữ liệu lịch cá nhân của bạn cho bất kỳ bên thứ ba nào.</p>
    <h2>3. Quyền kiểm soát và thu hồi quyền truy cập</h2>
    <p>Bạn có thể nhấn <strong>"Đăng xuất"</strong> ngay trên trang web bất cứ lúc nào hoặc thu hồi quyền truy cập của <strong>dinhhuuphuc.com</strong> tại trang quản lý bảo mật tài khoản Google (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>).</p>
    <h2>4. Thông tin liên hệ</h2>
    <p>Mọi thắc mắc về quyền riêng tư, vui lòng liên hệ Đinh Hữu Phúc qua email cá nhân: <a href="mailto:dhphuc2212@dinhhuuphuc.com">dhphuc2212@dinhhuuphuc.com</a> hoặc <a href="mailto:dhphuc2212@gmail.com">dhphuc2212@gmail.com</a> • <a href="/">Quay lại trang chủ</a>.</p>
  </main>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    // 2. Trang Điều khoản dịch vụ (/terms)
    if (pathname === "/terms") {
      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Điều khoản dịch vụ — Đinh Hữu Phúc</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.65; margin: 0; padding: 32px 16px; }
    .card { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04); }
    h1 { font-size: 1.6rem; margin-top: 0; color: #0f766e; }
    h2 { font-size: 1.1rem; margin-top: 24px; color: #1e293b; }
    p, li { color: #334155; font-size: 0.96rem; }
    a { color: #0f766e; text-decoration: none; font-weight: 500; }
    .meta { font-size: 0.85rem; color: #64748b; margin-bottom: 20px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Điều khoản dịch vụ (Terms of Service)</h1>
    <div class="meta">Cập nhật lần cuối: 22/11/2026 • Website: dinhhuuphuc.com</div>
    <h2>1. Mục đích sử dụng</h2>
    <p>Website <strong>dinhhuuphuc.com</strong> là trang thông tin cá nhân của Đinh Hữu Phúc, cung cấp thông tin liên hệ, giới thiệu sản phẩm Gạo Ông Du, trò chơi giải trí và công cụ trợ lý AI hỗ trợ sắp xếp lịch làm việc lên Google Calendar cá nhân.</p>
    <h2>2. Trách nhiệm người dùng</h2>
    <ul>
      <li>Người dùng tự chịu trách nhiệm đối với nội dung sự kiện được tạo và lưu vào tài khoản Google Calendar của mình.</li>
      <li>Không sử dụng trợ lý AI hoặc các biểu mẫu trên trang vào mục đích spam, phá hoại hay vi phạm pháp luật.</li>
    </ul>
    <h2>3. Giới hạn trách nhiệm</h2>
    <p>Thông tin gợi ý từ trợ lý AI chỉ mang tính hỗ trợ bóc tách thời gian nhanh; người dùng vui lòng kiểm tra lại tiêu đề, ngày và khung giờ trước khi nhấn xác nhận lưu vào Google Calendar.</p>
    <h2>4. Thông tin liên hệ</h2>
    <p>Liên hệ cá nhân: <a href="mailto:dhphuc2212@dinhhuuphuc.com">dhphuc2212@dinhhuuphuc.com</a> • Liên hệ công việc (Gạo Ông Du): <a href="mailto:info@gaoongdu.vn">info@gaoongdu.vn</a> • <a href="/">Quay lại trang chủ</a>.</p>
  </main>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    // 3. Endpoint kiểm tra danh sách model khả dụng
    if (pathname === "/api/models") {
      if (!env.GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Chưa cấu hình GEMINI_API_KEY trên Worker." }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      try {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          headers: { "x-goog-api-key": env.GEMINI_API_KEY }
        });
        const data = await res.json();
        const available = (data.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m) => ({
            id: (m.name || "").replace(/^models\//, ""),
            displayName: m.displayName || m.name
          }));
        return new Response(
          JSON.stringify({ count: available.length, models: available }, null, 2),
          { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ error: "Không thể lấy danh sách model từ Gemini API." }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Endpoint AI Chatbot Gemini (Ưu tiên Gemini 3.5 Flash-Lite + xoay vòng dòng 3.x)
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

        if (!env.GEMINI_API_KEY) {
          return new Response(
            JSON.stringify({
              reply: "Hệ thống AI chưa có GEMINI_API_KEY trên Cloudflare Worker.",
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
- Email cá nhân: dhphuc2212@dinhhuuphuc.com và dhphuc2212@gmail.com
- Liên hệ Zalo: https://zalo.me/0983533945 (tuyệt đối không viết số điện thoại thô dưới dạng văn bản gọi trực tiếp, luôn hướng dẫn bấm nút Liên hệ qua Zalo).

THÔNG TIN CÔNG VIỆC (Thuộc tab Công việc trên website):
- Thương hiệu: Gạo Ông Du (website: gaoongdu.vn)
- Email công việc: info@gaoongdu.vn
- Đơn vị chủ quản: Công ty CP Nông nghiệp Gạo Hữu cơ TD Sóc Trăng
- Bảng giá sản phẩm hiện hành (Đơn giá bán NTD):
  1. GẠO ST25 "HỮU CƠ" 1KG (1 KG) — 72,000
  2. GẠO ST25 "HỮU CƠ" 5KG (5 KG) — 360,000
  3. GẠO ST25 "TD XANH" 1KG (1 KG) — 52,000
  4. GẠO ST25 "TD XANH" 5KG (5 KG) — 260,000
  5. GẠO TẤM ST25 "HỮU CƠ" 2KG (1 KG) — 82,000
  6. GẠO LÀI THƠM 1KG (1 KG) — 35,500
  7. GẠO LÀI THƠM 5KG (5 KG) — 177,500
  8. GẠO LỨT DÂU TÂY ĐỎ 1KG (1 KG) — 112,000
  9. GẠO LỨT DÂU TÂY TÍM 1KG (1 KG) — 112,000
  10. GẠO NẾP SẾU ĐẦU ĐỎ 1KG (1 KG) — 112,000
  11. GẠO NẾP CHIM SÂM CẦM 1KG (1 KG) — 112,000
  12. GẠO SUMO (1 KG) — 112,000

NHIỆM VỤ BÓC TÁCH LỊCH LÀM VIỆC:
- Nếu người dùng nhắn nội dung mang tính sắp xếp, đặt lịch, nhắc việc, hẹn giờ, hãy bóc tách thông tin sự kiện vào trường "schedule".
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

        // Xoay vòng các model thế hệ 3.x (loại bỏ 2.5 và 2.0)
        const fallbackModels = [
          "gemini-3.5-flash-lite",
          "gemini-3.8-flash",
          "gemini-3.1-flash-lite",
          "gemini-3.5-flash"
        ];

        let lastError = "";
        for (const modelName of fallbackModels) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
              {
                method: "POST",
                signal: AbortSignal.timeout(6000),
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: [{ role: "user", parts: [{ text: message }] }],
                  generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.4
                  }
                })
              }
            );

            const data = await res.json();
            if (!res.ok || data?.error) {
              lastError = data?.error?.message || `HTTP ${res.status}`;
              continue;
            }

            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let parsed = {
              reply: "Xin lỗi, mình chưa thể phản hồi lúc này. Bạn thử nhắn lại nhé!",
              schedule: null
            };
            try {
              parsed = JSON.parse(rawText);
            } catch {
              if (rawText) parsed.reply = rawText;
            }

            return new Response(
              JSON.stringify({
                reply: parsed.reply || "Đã ghi nhận!",
                schedule: parsed.schedule || null,
                model: modelName
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
              }
            );
          } catch (e) {
            lastError = e?.message || "Timeout";
            continue;
          }
        }

        // Fallback cục bộ nếu tất cả model Gemini đang cao điểm: vẫn tự nhận diện giờ để tạo lịch
        const timeMatch = message.match(/\b(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\b/i);
        if (timeMatch) {
          const hour = timeMatch[1].padStart(2, "0");
          const minute = (timeMatch[2] || "00").padStart(2, "0");
          const endHour = String((parseInt(hour, 10) + 1) % 24).padStart(2, "0");
          const isTomorrow = /ngày mai|mai\b/i.test(message);
          const targetDate = new Date(todayIso + "T00:00:00");
          if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1);
          const dateStr = targetDate.toISOString().slice(0, 10);

          return new Response(
            JSON.stringify({
              reply: `Máy chủ Gemini đang cao điểm nên mình tự động bóc tách giúp bạn lịch lúc ${hour}:${minute} ngày ${dateStr}. Bạn kiểm tra và bấm "Lưu vào Google Calendar" bên dưới nhé!`,
              schedule: {
                title: message,
                date: dateStr,
                startTime: `${hour}:${minute}`,
                endTime: `${endHour}:${minute}`,
                description: "Tạo nhanh từ trợ lý website dinhhuuphuc.com"
              }
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            }
          );
        }

        return new Response(
          JSON.stringify({
            reply: `Hệ thống Gemini đang quá tải tạm thời trên tất cả các kênh (${lastError}). Bạn thử gửi lại sau vài giây hoặc nhắn trực tiếp qua Zalo cho Phúc nhé!`,
            schedule: null
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          }
        );
      } catch {
        return new Response(
          JSON.stringify({
            reply: "Có lỗi kết nối tới hệ thống AI. Vui lòng thử lại sau.",
            schedule: null
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          }
        );
      }
    }

    // 5. Phục vụ các file tĩnh (index.html, css/*, js/*, sections/*)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
};
