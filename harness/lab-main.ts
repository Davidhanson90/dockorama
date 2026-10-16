// Deterministic page for the end-to-end suite (e2e/own). Not part of the documented site: it only exposes
// the public package API on `window.lab` so tests can build layouts directly and record every event.
import * as dk from "dockorama";
import * as skins from "dockorama/skins";
import { html } from "lit";

const EVENTS = [
  "change", "focus", "viewshow", "viewhide", "beforeclose", "close", "viewremove", "beforemove", "beforeadd", "command",
  "dragstart", "dragover", "drop", "dragcancel", "dirty", "layoutissue", "transfer", "resize", "resizing",
  "float", "dock", "stow", "unstow", "pin", "unpin", "popout", "popin", "collapse", "expand"
] as const;

export interface LabEvent { manager: string; name: string; detail: unknown; cancelable: boolean }
const log: LabEvent[] = [];

function text(id: string, body = `${id} content`): HTMLElement {
  const el = document.createElement("div");
  el.dataset["content"] = id;
  el.style.cssText = "padding:10px";
  el.textContent = body;
  return el;
}

/** The standard layout: Files | (main.ts, notes.md, readme.md over Output, Problems) | Properties. */
function standard(): dk.DockoramaModel {
  return dk.createModel(
    {
      files: { title: "Files", icon: "📁" }, search: { title: "Search" },
      main: { title: "main.ts" }, notes: { title: "notes.md" }, readme: { title: "readme.md" },
      log: { title: "Output" }, problems: { title: "Problems" }, props: { title: "Properties" }
    },
    dk.row([
      dk.stack(["files", "search"]),
      dk.column([dk.docs(["main", "notes", "readme"]), dk.stack(["log", "problems"])], [3, 1]),
      dk.stack(["props"])
    ], [1, 3, 1])
  );
}

function record(m: dk.DockoramaManager, name: string): void {
  for (const e of EVENTS) {
    m.addEventListener(`dockorama-${e}` as keyof HTMLElementEventMap, ((ev: CustomEvent) => {
      const detail = ev.type === "dockorama-change"
        ? { reason: (ev.detail as { reason: string }).reason }
        : JSON.parse(JSON.stringify(ev.detail ?? null, (_k, v) => (v instanceof Element ? `<${v.localName}>` : v)));
      log.push({ manager: name, name: ev.type, detail, cancelable: ev.cancelable });
    }) as EventListener);
  }
}

let counter = 0;
export interface MountOptions {
  model?: dk.DockoramaModel;
  attrs?: Record<string, string>;
  name?: string;
  content?: boolean;
}

function mount(opts: MountOptions = {}): dk.DockoramaManager {
  const stage = document.getElementById("stage")!;
  const m = document.createElement("dockorama-manager") as dk.DockoramaManager;
  const name = opts.name ?? (counter++ === 0 ? "main" : `dock${counter}`);
  m.id = name;
  for (const [k, v] of Object.entries(opts.attrs ?? {})) m.setAttribute(k, v);
  const model = opts.model ?? standard();
  if (opts.content !== false) {
    for (const id of Object.keys(model.views)) {
      const c = text(id);
      c.setAttribute("data-view", id);
      m.append(c);
    }
  }
  record(m, name);
  stage.append(m);
  m.model = model;
  return m;
}

const lab = {
  dk, skins, html, mount, standard, text,
  events: log,
  clearEvents: () => { log.length = 0; },
  dock: (name = "main") => document.getElementById(name) as dk.DockoramaManager
};
export type Lab = typeof lab;
(window as unknown as { lab: Lab }).lab = lab;
(window as unknown as { labReady: boolean }).labReady = true;
