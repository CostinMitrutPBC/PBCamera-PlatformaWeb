"use strict";

import { isPage } from "./core/utils.js";
import { initGlobalNav } from "./nav/navbar.js";
import { initLogin, initRegister } from "./core/auth.js";
import { initUploadAdmin, initAdmin, initAdminTabs } from "./admin/admin.js";
import { initClient } from "./client/player.js";
import { initChatbot } from "./support/chatbot.js";

(async function boot() {
  await initGlobalNav();

  initChatbot();

  if (isPage("login.html")) initLogin();
  if (isPage("register.html")) initRegister();

  if (isPage("admin.html")) {
    initAdminTabs();
    initUploadAdmin();
    await initAdmin();
  }

  if (isPage("client.html")) initClient();
})();