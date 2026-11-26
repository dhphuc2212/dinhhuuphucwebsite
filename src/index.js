import { handleAuthRoutes } from "./auth.js";
import { handleChatRoutes } from "./chat.js";
import { handleChatHistoryRoutes } from "./chat-history.js";
import { handleSecondBrainRoutes } from "./second-brain.js";
import { handleNotepadRoutes } from "./notepad.js";
import { handleStaticPages } from "./pages.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    // 1. Xử lý xác thực Google Calendar & duy trì phiên 60 ngày
    const authResponse = await handleAuthRoutes(pathname, request, env, url);
    if (authResponse) return authResponse;

    // 2. Xử lý Bộ Não Thứ 2 (/api/brain)
    const brainResponse = await handleSecondBrainRoutes(pathname, request, env);
    if (brainResponse) return brainResponse;

    // 3. Xử lý đồng bộ lịch sử chat AI theo tài khoản Google (/api/chat/history)
    const chatHistoryResponse = await handleChatHistoryRoutes(pathname, request, env);
    if (chatHistoryResponse) return chatHistoryResponse;

    // 4. Xử lý Trợ lý AI & danh sách model
    const chatResponse = await handleChatRoutes(pathname, request, env);
    if (chatResponse) return chatResponse;

    // 5. Xử lý API Notepad Online (/api/notepad/:code)
    const notepadResponse = await handleNotepadRoutes(pathname, request, env);
    if (notepadResponse) return notepadResponse;

    // 6. Mở thẳng giao diện Notepad Online khi truy cập /notepad hoặc /notepad/:code
    if (pathname === "/notepad" || pathname.startsWith("/notepad/")) {
      const htmlRes = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
      return new Response(htmlRes.body, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache"
        }
      });
    }

    // 7. Xử lý các trang tĩnh (/privacy, /terms)
    const pageResponse = handleStaticPages(pathname);
    if (pageResponse) return pageResponse;

    // 8. Phục vụ file giao diện tĩnh (HTML, CSS, JS)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
};
