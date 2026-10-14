import { defineSkin } from "../core.js";
import "../default/skin.js";
import { phosphorCss } from "./css.js";
import { phosphorTemplates } from "./templates.js";

/** Phosphor: retro terminal, monospace green on black. */
export const phosphor = defineSkin("phosphor", { templates: phosphorTemplates, css: phosphorCss });
