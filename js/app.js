import { APP_VERSION } from "./config.js";
import { initStockApp } from "./modules/stock/stockController.js";
import { renderAppVersionBadge } from "./ui/renderer.js";

console.log(`Stock Barra v${APP_VERSION}`);

initStockApp();
renderAppVersionBadge(APP_VERSION);
