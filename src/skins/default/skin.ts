import { defineSkin, setFallbackSkin } from "../core.js";
import { templates } from "./templates.js";

/** The built-in skin: every template, and the base CSS (applied as the manager's own styles). */
export const defaultSkin = defineSkin("default", { templates });
setFallbackSkin(defaultSkin);
