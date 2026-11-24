import { handleAuthRoutes } from "./auth.js";
import { handleChatRoutes } from "./chat.js";
import { handleNotepadRoutes } from "./notepad.js";
import { handleStaticPages } from "./pages.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    // 1. Xử lý xác thực Google Calendar & duy trì phiên 60 ngày
    const authResponse = await handleAuthRoutes(pathname, request, env, url);
    if (authResponse) return authResponse;

    // 2. Xử lý Trợ lý AI & danh sách model
    const chatResponse = await handleChatRoutes(pathname, request, env);
    if (chatResponse) return chatResponse;

    // 3. Xử lý API Notepad Online (/api/notepad/:code)
    const notepadResponse = await handleNotepadRoutes(pathname, request, env);
    if (notepadResponse) return notepadResponse;

    // 4. Xử lý các trang tĩnh (/privacy, /terms)
    const pageResponse = handleStaticPages(pathname);
    if (pageResponse) return pageResponse;

    // 5. Phục vụ file giao diện tĩnh (HTML, CSS, JS)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
};
