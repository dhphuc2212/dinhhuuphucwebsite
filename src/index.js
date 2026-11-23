const GOOGLE_CLIENT_ID = "645926964017-6hqgk9jf1umh6qu1tc6vu0ec5c233pta.apps.googleusercontent.com";
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");
const SIXTY_DAYS_SEC = 60 * 24 * 60 * 60;
const COOKIE_NAME = "dhp_gcal_sid";

function jsonRes(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders
    }
  });
}

function parseCookies(cookieHeader = "") {
  const map = {};
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) map[k] = decodeURIComponent(v);
    }
  });
  return map;
}

function randomId(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const isProdDomain = url.hostname.endsWith("dinhhuuphuc.com");

    if (pathname === "/api/auth/google/start") {
      const remember60 = url.searchParams.get("remember60") === "1";
      const statePayload = btoa(
        JSON.stringify({
          nonce: randomId(12),
          remember60,
          ts: Date.now()
        })
      );

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", CALENDAR_SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("state", statePayload);

      return Response.redirect(authUrl.toString(), 302);
    }

    if (pathname === "/api/auth/google/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const stateRaw = url.searchParams.get("state") || "";

      if (error || !code) {
        return new Response(
          `<!doctype html><html><body><script>
            if (window.opener) {
              window.opener.postMessage({ type: "DHP_GCAL_AUTH_ERROR", error: ${JSON.stringify(error || "missing_code")} }, "*");
              window.close();
            } else {
              window.location.href = "/?gcal_auth=error";
            }
          </script></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } }
        );
      }

      let remember60 = true;
      try {
        const parsedState = JSON.parse(atob(stateRaw));
        remember60 = Boolean(parsedState?.remember60);
      } catch {}

      if (!env.GOOGLE_CLIENT_SECRET) {
        return new Response("Thiếu biến bí mật GOOGLE_CLIENT_SECRET trên Cloudflare Worker.", { status: 500 });
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        return new Response(`Lỗi đổi token Google: ${tokenData.error_description || tokenData.error || tokenRes.status}`, {
          status: 400
        });
      }

      let email = "";
      try {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        if (userRes.ok) {
          const u = await userRes.json();
          email = u.email || "";
        }
      } catch {}

      const maxAgeSec = remember60 ? SIXTY_DAYS_SEC : 24 * 60 * 60;
      const expiresAtMs = Date.now() + maxAgeSec * 1000;
      const expiresIn = Number(tokenData.expires_in) || 3600;
      const sessionId = randomId(24);

      const sessionRecord = {
        refreshToken: tokenData.refresh_token || null,
        accessToken: tokenData.access_token,
        accessExpiresAt: Date.now() + expiresIn * 1000,
        email,
        remember60,
        expiresAtMs
      };

      if (env.AUTH_SESSIONS) {
        await env.AUTH_SESSIONS.put(`sess:${sessionId}`, JSON.stringify(sessionRecord), {
          expirationTtl: maxAgeSec
        });
      }

      const cookieParts = [
        `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
        "Path=/",
        ...(isProdDomain ? ["Domain=.dinhhuuphuc.com"] : []),
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        ...(remember60 ? [`Max-Age=${maxAgeSec}`] : [])
      ];

      return new Response(
        `<!doctype html><html><body><script>
          const payload = {
            type: "DHP_GCAL_AUTH_SUCCESS",
            accessToken: ${JSON.stringify(tokenData.access_token)},
            expiresIn: ${JSON.stringify(expiresIn)},
            email: ${JSON.stringify(email)},
            remember60: ${JSON.stringify(remember60)},
            expiresAtMs: ${JSON.stringify(expiresAtMs)}
          };
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, window.location.origin);
            window.close();
          } else {
            window.location.href = "/";
          }
        </script></body></html>`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Set-Cookie": cookieParts.join("; ")
          }
        }
      );
    }

    if (pathname === "/api/auth/refresh") {
      const cookies = parseCookies(request.headers.get("Cookie") || "");
      const sid = cookies[COOKIE_NAME];
      if (!sid || !env.AUTH_SESSIONS) {
        return jsonRes({ authenticated: false }, 200);
      }

      const rawSess = await env.AUTH_SESSIONS.get(`sess:${sid}`);
      if (!rawSess) {
        return jsonRes({ authenticated: false }, 200);
      }

      const sess = JSON.parse(rawSess);
      if (sess.expiresAtMs && Date.now() > sess.expiresAtMs) {
        await env.AUTH_SESSIONS.delete(`sess:${sid}`);
        return jsonRes({ authenticated: false }, 200);
      }

      if (sess.accessToken && sess.accessExpiresAt && Date.now() < sess.accessExpiresAt - 60000) {
        return jsonRes({
          authenticated: true,
          accessToken: sess.accessToken,
          expiresIn: Math.floor((sess.accessExpiresAt - Date.now()) / 1000),
          email: sess.email || "",
          remember60: Boolean(sess.remember60),
          expiresAtMs: sess.expiresAtMs
        });
      }

      if (!sess.refreshToken || !env.GOOGLE_CLIENT_SECRET) {
        return jsonRes({ authenticated: false }, 200);
      }

      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: sess.refreshToken,
          grant_type: "refresh_token"
        })
      });

      const refreshed = await refreshRes.json();
      if (!refreshRes.ok || !refreshed.access_token) {
        return jsonRes({ authenticated: false }, 200);
      }

      const newExpiresIn = Number(refreshed.expires_in) || 3600;
      sess.accessToken = refreshed.access_token;
      sess.accessExpiresAt = Date.now() + newExpiresIn * 1000;

      const remainingTtl = Math.max(60, Math.floor((sess.expiresAtMs - Date.now()) / 1000));
      await env.AUTH_SESSIONS.put(`sess:${sid}`, JSON.stringify(sess), {
        expirationTtl: remainingTtl
      });

      return jsonRes({
        authenticated: true,
        accessToken: sess.accessToken,
        expiresIn: newExpiresIn,
        email: sess.email || "",
        remember60: Boolean(sess.remember60),
        expiresAtMs: sess.expiresAtMs
      });
    }

    if (pathname === "/api/auth/logout") {
      const cookies = parseCookies(request.headers.get("Cookie") || "");
      const sid = cookies[COOKIE_NAME];
      if (sid && env.AUTH_SESSIONS) {
        await env.AUTH_SESSIONS.delete(`sess:${sid}`);
      }
      const clearCookie = [
        `${COOKIE_NAME}=`,
        "Path=/",
        ...(isProdDomain ? ["Domain=.dinhhuuphuc.com"] : []),
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=0"
      ].join("; ");
      return jsonRes({ ok: true }, 200, { "Set-Cookie": clearCookie });
    }

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
    <p>Nếu bạn chọn <strong>"Duy trì đăng nhập trong 60 ngày"</strong>, phiên làm việc được duy trì tối đa 60 ngày để bạn không phải đăng nhập lại mỗi lần mở máy. Website <strong>không</strong> lưu trữ mật khẩu và không chia sẻ dữ liệu lịch cá nhân của bạn cho bất kỳ bên thứ ba nào.</p>
    <h2>3. Quyền kiểm soát và thu hồi quyền truy cập</h2>
    <p>Bạn có thể nhấn <strong>"Đăng xuất"</strong> ngay trên trang web bất cứ lúc nào hoặc thu hồi quyền truy cập tại <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</p>
    <h2>4. Thông tin liên hệ</h2>
    <p>Liên hệ cá nhân: <a href="mailto:dhphuc2212@dinhhuuphuc.com">dhphuc2212@dinhhuuphuc.com</a> hoặc <a href="mailto:dhphuc2212@gmail.com">dhphuc2212@gmail.com</a> • <a href="/">Quay lại trang chủ</a>.</p>
  </main>
</body>
</html>`;
      return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } });
    }

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
    <p>Website <strong>dinhhuuphuc.com</strong> cung cấp thông tin cá nhân, thông tin sản phẩm Gạo Ông Du, mini-game và công cụ trợ lý AI hỗ trợ sắp xếp lịch làm việc lên Google Calendar cá nhân.</p>
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
      return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } });
    }

    if (pathname === "/api/models") {
      if (!env.GEMINI_API_KEY) {
        return jsonRes({ error: "Chưa cấu hình GEMINI_API_KEY trên Worker." }, 400);
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
        return jsonRes({ count: available.length, models: available }, 200);
      } catch {
        return jsonRes({ error: "Không thể lấy danh sách model từ Gemini API." }, 500);
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
                  generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
                })
              }
            );
            const data = await res.json();
            if (!res.ok || data?.error) {
              lastError = data?.error?.message || `HTTP ${res.status}`;
              continue;
            }
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let parsed = { reply: "Xin lỗi, mình chưa thể phản hồi lúc này.", schedule: null };
            try {
              parsed = JSON.parse(rawText);
            } catch {
              if (rawText) parsed.reply = rawText;
            }
            return jsonRes({ reply: parsed.reply || "Đã ghi nhận!", schedule: parsed.schedule || null, model: modelName });
          } catch (e) {
            lastError = e?.message || "Timeout";
          }
        }

        const timeMatch = message.match(/\b(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\b/i);
        if (timeMatch) {
          const hour = timeMatch[1].padStart(2, "0");
          const minute = (timeMatch[2] || "00").padStart(2, "0");
          const endHour = String((parseInt(hour, 10) + 1) % 24).padStart(2, "0");
          const isTomorrow = /ngày mai|mai\b/i.test(message);
          const targetDate = new Date(todayIso + "T00:00:00");
          if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1);
          const dateStr = targetDate.toISOString().slice(0, 10);
          return jsonRes({
            reply: `Đã tự động bóc tách lịch lúc ${hour}:${minute} ngày ${dateStr}. Bạn kiểm tra và bấm lưu vào Google Calendar nhé!`,
            schedule: {
              title: message,
              date: dateStr,
              startTime: `${hour}:${minute}`,
              endTime: `${endHour}:${minute}`,
              description: "Tạo nhanh từ trợ lý dinhhuuphuc.com"
            }
          });
        }

        return jsonRes({
          reply: `Hệ thống Gemini đang bận (${lastError}). Bạn thử gửi lại sau vài giây hoặc nhắn qua Zalo cho Phúc nhé!`,
          schedule: null
        });
      } catch {
        return jsonRes({ reply: "Có lỗi kết nối tới hệ thống AI.", schedule: null });
      }
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
};
