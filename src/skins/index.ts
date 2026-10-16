// `dockorama/skins`: the skin API and every built-in skin (importing this does not change the page's skin;
// import `dockorama/skins/<name>` for that, or call `useSkin`).
export {
  activeSkin, clearSkinOverrides, cssFor, defineSkin, extendSkin, overrideSkin, skinNamed, skinNames, templateFor, useSkin,
  type Skin, type SkinContexts, type SkinCss, type SkinKey, type SkinKit, type SkinOutput, type SkinPatch, type SkinScope, type SkinTemplate, type SkinTemplates
} from "./core.js";
export { defaultSkin } from "./default/skin.js";
export { nimbus } from "./nimbus/skin.js";
export { ledger } from "./ledger/skin.js";
export { phosphor } from "./phosphor/skin.js";
