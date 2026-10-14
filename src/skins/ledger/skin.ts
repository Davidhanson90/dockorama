import { defineSkin } from "../core.js";
import "../default/skin.js";
import { ledgerCss } from "./css.js";
import { ledgerTemplates } from "./templates.js";

/** Ledger: bold borders, square corners, uppercase labels. */
export const ledger = defineSkin("ledger", { templates: ledgerTemplates, css: ledgerCss });
