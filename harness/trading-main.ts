// Standalone, full-viewport trading desk (no docs chrome).
import "flexdock";
import { mountTradingDesk } from "./trading/desk.js";

mountTradingDesk(document.getElementById("desk")!, { standalone: true });
