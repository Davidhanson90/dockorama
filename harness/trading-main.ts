// Standalone, full-viewport trading desk (no docs chrome).
import "dockorama";
import { mountTradingDesk } from "./trading/desk.js";

mountTradingDesk(document.getElementById("desk")!, { standalone: true });
