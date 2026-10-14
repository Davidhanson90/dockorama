import { defineSkin } from "../core.js";
import "../default/skin.js";
import { nimbusCss } from "./css.js";
import { nimbusTemplates } from "./templates.js";

/** Nimbus: soft, airy, pill-shaped. */
export const nimbus = defineSkin("nimbus", { templates: nimbusTemplates, css: nimbusCss });
