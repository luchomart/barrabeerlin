import { APP_VERSION } from "./config.js";
import { initSupervisorApp } from "./modules/supervisor/supervisorController.js";
import { renderAppVersionBadge } from "./ui/renderer.js";

console.log(`Stock Barra v${APP_VERSION}`);

initSupervisorApp();
renderAppVersionBadge(APP_VERSION);
