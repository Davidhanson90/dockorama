export interface Example { id: string; code: string; height?: number; openCode?: boolean }
export interface Page {
  slug: string;
  title: string;
  section: string;
  body: string;
  examples?: Example[];
  after?: (el: HTMLElement, lib: typeof import("flexdock")) => void;
}

const ex = (id: string) => `<div data-example="${id}"></div>`;

// Shared snippet: most examples build a manager the same way.
const SETUP = `const dock = document.createElement("flexdock-manager");
host.append(dock);
const view = (id, html) => dock.insertAdjacentHTML("beforeend", '<div class="v" data-view="' + id + '">' + html + "</div>");`;

const basic = `${SETUP}
view("files", "<h3>Project</h3><ul><li>src/</li><li>tests/</li><li>package.json</li></ul>");
view("main", "<h3>main.ts</h3><p class='muted'>Drag this tab around, or drag the splitters.</p>");
view("notes", "<h3>notes.md</h3><p>Second document.</p>");
view("log", "<span class='muted'>Build finished in 1.2s</span>");

dock.model = createModel(
  {
    files: { title: "Project", icon: "📁" },
    main: { title: "main.ts" },
    notes: { title: "notes.md" },
    log: { title: "Output" }
  },
  row([stack(["files"]), column([docs(["main", "notes"]), stack(["log"])], [3, 1])], [1, 4])
);`;

const pagesList: Page[] = [];
const add = (p: Page) => pagesList.push(p);

add({
  slug: "", title: "Overview", section: "Introduction",
  body: `<section class="hero">
    <div>
      <h1>Docking layouts,<br>done properly.</h1>
      <p class="lead">flexdock is a dependency-light web component for IDE-style workspaces: split panes, tabbed groups,
      document areas, floating windows and auto-hiding drawers — rearranged by drag and drop or keyboard, with undo, persistence and themes built in.</p>
      <div class="cta"><a class="primary" href="#/start">Get started</a><a class="secondary" href="#/examples/ide">See examples</a></div>
    </div>
  </section>
  ${ex("hero")}
  <div class="grid">
    <a class="card" href="#/guide/drag-drop"><b>Drag &amp; drop docking</b><span>Drop targets on every group and the outer edges, with live previews.</span></a>
    <a class="card" href="#/guide/windows"><b>Floating windows</b><span>Move, resize and snap to a grid. Several at once.</span></a>
    <a class="card" href="#/guide/drawers"><b>Auto-hide drawers</b><span>Stow views to the edges; they slide out on demand.</span></a>
    <a class="card" href="#/guide/undo"><b>Undo / redo</b><span>Every layout change is undoable, out of the box.</span></a>
    <a class="card" href="#/guide/persistence"><b>Persistence &amp; workspaces</b><span>Save to localStorage, switch named layouts.</span></a>
    <a class="card" href="#/guide/palette"><b>Command palette</b><span><span class="kbd">Ctrl</span> + <span class="kbd">.</span> to jump to any view.</span></a>
    <a class="card" href="#/guide/popout"><b>Pop-out windows</b><span>Move a view into its own browser window.</span></a>
    <a class="card" href="#/guide/minimap"><b>Layout minimap</b><span>A live overview you can click to navigate.</span></a>
    <a class="card" href="#/guide/a11y"><b>Accessible &amp; RTL</b><span>ARIA roles, keyboard everywhere, right-to-left.</span></a>
    <a class="card" href="#/playground"><b>Themeable</b><span>Light, dark, auto, and CSS custom properties.</span></a>
    <a class="card" href="#/guide/frameworks"><b>Any framework</b><span>Plain HTML, React, Vue, Angular, Svelte.</span></a>
    <a class="card" href="#/guide/model"><b>Plain JSON model</b><span>Immutable, serialisable, diff-friendly.</span></a>
  </div>`,
  examples: [{ id: "hero", height: 460, code: `${SETUP}
view("files", "<h3>Explorer</h3><ul><li>📁 src</li><li>📁 tests</li><li>📄 README.md</li></ul>");
view("app", "<h3>app.ts</h3><p class='muted'>Try dragging tabs onto the targets, stowing a panel with the drawer icon, or double-clicking a title.</p>");
view("theme", "<h3>theme.css</h3>");
view("outline", "<h3>Outline</h3><ul><li>class App</li><li>render()</li></ul>");
view("terminal", "<span class='muted'>$ npm test<br>✓ 128 passed</span>");
view("problems", "<span class='muted'>No problems</span>");
dock.model = createModel(
  {
    files: { title: "Explorer" }, app: { title: "app.ts" }, theme: { title: "theme.css" },
    outline: { title: "Outline" }, terminal: { title: "Terminal" }, problems: { title: "Problems" }
  },
  row([stack(["files"]), column([docs(["app", "theme"]), stack(["terminal", "problems"])], [3, 1.3]), stack(["outline"])], [1, 3.2, 1])
);` }]
});

add({
  slug: "start", title: "Getting started", section: "Introduction",
  body: `<h1>Getting started</h1>
  <p class="lead">Install the package, put your content inside <code>&lt;flexdock-manager&gt;</code>, and describe the layout as a model.</p>
  <pre><code>npm install flexdock</code></pre>
  <h2>1. Content</h2>
  <p>Each child element with a <code>data-view</code> attribute is a view. Content stays in your DOM (light DOM), so your CSS and framework keep owning it.</p>
  <h2>2. Model</h2>
  <p>The model registers views once (<code>views</code>) and places them by id in a tree of <code>split</code> and <code>stack</code> nodes.
  The <code>row</code>, <code>column</code>, <code>stack</code> and <code>docs</code> helpers build that tree.</p>
  ${ex("basic")}
  <p class="note">Examples on this site use a tiny <code>view(id, html)</code> helper to add content, and <code>button()</code> / <code>log()</code> to drive the demo toolbar.</p>
  <h2>3. Listen</h2>
  <p>Every change fires <code>flexdock-change</code> with the new model and a reason — save it, sync it, or ignore it.</p>`,
  examples: [{ id: "basic", code: basic, openCode: true }]
});

add({
  slug: "guide/model", title: "Layout model", section: "Guides",
  body: `<h1>Layout model</h1>
  <p class="lead">One plain JSON object describes everything: which views exist and where each one lives.</p>
  <table><tr><th>Key</th><th>Meaning</th></tr>
  <tr><td><code>views</code></td><td>Registry: <code>{ title, icon?, caps?, lazy?, hint? }</code> per view id.</td></tr>
  <tr><td><code>root</code></td><td>The main tree: <code>split</code> nodes (<code>axis</code>, <code>children</code>, <code>weights</code>) and <code>stack</code> nodes (<code>views</code>, <code>current</code>, <code>docs?</code>).</td></tr>
  <tr><td><code>windows</code></td><td>Floating windows, each <code>{ key, box: {x,y,w,h}, tree }</code>.</td></tr>
  <tr><td><code>drawers</code></td><td>Auto-hidden views by side: <code>start</code>, <code>end</code>, <code>top</code>, <code>bottom</code>.</td></tr>
  <tr><td><code>parked</code></td><td>Closed views that can be revealed again.</td></tr>
  <tr><td><code>focus</code>, <code>zoom</code></td><td>The active view and the zoomed (maximised) view.</td></tr></table>
  <p>The model is immutable: the element replaces it on every change. All operations are also exported as pure functions
  (<code>place</code>, <code>detach</code>, <code>stow</code>, <code>dismiss</code>, …) so you can transform layouts on a server or in tests.</p>
  ${ex("model")}`,
  examples: [{ id: "model", height: 380, code: `${basic}
const out = document.createElement("pre");
out.style.cssText = "position:absolute;right:8px;bottom:8px;max-width:45%;max-height:60%;overflow:auto;margin:0;font-size:11px;opacity:.92;border-radius:8px;z-index:100";
host.append(out);
const show = () => { out.textContent = JSON.stringify(dock.model.root, null, 1); };
dock.addEventListener("flexdock-change", show);
show();` }]
});

add({
  slug: "guide/splits", title: "Splits & sizing", section: "Guides",
  body: `<h1>Splits &amp; sizing</h1>
  <p class="lead">Splits lay children side by side (<code>row</code>) or top to bottom (<code>column</code>). Sizes are relative <code>weights</code>.</p>
  <p>Drag a gutter to resize; neighbours never shrink below 48px. Gutters are focusable separators: use the arrow keys, <span class="kbd">Home</span> and <span class="kbd">End</span>.
  Nested splits along the same axis are flattened automatically, and splits with a single child collapse.</p>
  ${ex("splits")}`,
  examples: [{ id: "splits", code: `${SETUP}
["a", "b", "c", "d", "e"].forEach((id) => view(id, "<div class='kpi'><b>" + id.toUpperCase() + "</b><small>weight</small></div>"));
dock.model = createModel(
  Object.fromEntries(["a", "b", "c", "d", "e"].map((id) => [id, { title: "Pane " + id.toUpperCase() }])),
  row([stack(["a"]), column([stack(["b"]), row([stack(["c"]), stack(["d"])])], [1, 2]), stack(["e"])], [1, 3, 1])
);
button("Equalise", () => {
  const m = dock.snapshot();
  m.root.weights = m.root.weights.map(() => 1);
  dock.restore(m);
});
dock.addEventListener("flexdock-change", (e) => e.detail.reason === "resize" && log("weights " + JSON.stringify(e.detail.model.root.weights.map((w) => +w.toFixed(2)))));` }]
});

add({
  slug: "guide/tabs", title: "Tabs & documents", section: "Guides",
  body: `<h1>Tabs &amp; documents</h1>
  <p class="lead">A stack with one view shows a title bar; with several it shows tabs. A <code>docs</code> stack is an editor-style document area.</p>
  <ul><li>Click a tab to select it; drag along the strip to reorder; drag away to float or dock elsewhere.</li>
  <li>Document tabs have close buttons, close on middle-click, and the area stays even when empty.</li>
  <li>When tabs overflow, the strip scrolls: use the mouse wheel or trackpad over it, or the ‹ › buttons that appear at its ends.
  The selected tab is always scrolled into view.</li>
  <li>The <b>⋯</b> menu lists every tab in the group, so hidden tabs are one click away.</li></ul>
  ${ex("tabs")}`,
  examples: [{ id: "tabs", code: `${SETUP}
const names = ["index.html", "styles.css", "app.ts", "router.ts", "store.ts", "api.ts", "utils.ts", "README.md"];
names.forEach((n, i) => view("d" + i, "<h3>" + n + "</h3><p class='muted'>Document " + (i + 1) + "</p>"));
view("props", "<h3>Properties</h3>");
view("history", "<h3>History</h3>");
dock.model = createModel(
  Object.assign(Object.fromEntries(names.map((n, i) => ["d" + i, { title: n }])), {
    props: { title: "Properties" }, history: { title: "History" }
  }),
  row([docs(names.map((_, i) => "d" + i)), stack(["props", "history"])], [3, 1])
);
let n = names.length;
button("New document", () => dock.addView("d" + n, { title: "untitled-" + n++ + ".ts" }));
dock.addEventListener("flexdock-change", (e) => log(e.detail.reason));` }]
});

add({
  slug: "guide/windows", title: "Floating windows", section: "Guides",
  body: `<h1>Floating windows</h1>
  <p class="lead">Drag a title bar or tab and drop it anywhere that is not a target to float it. Windows can be moved, resized, stacked and docked back.</p>
  <ul><li>Drag a window's title bar to move it — the drop targets appear so you can dock it again.</li>
  <li>Resize with the corner grip. Set <code>snap</code> (px) to snap position and size to a grid.</li>
  <li>Clicking a window brings it to the front. Use <code>detach(id, box)</code> to float programmatically.</li></ul>
  ${ex("windows")}`,
  examples: [{ id: "windows", height: 460, code: `${SETUP}
dock.snap = 20;
view("canvas", "<h3>Canvas</h3><p class='muted'>Windows snap to a 20px grid.</p>");
view("layers", "<h3>Layers</h3><ul><li>Header</li><li>Hero</li><li>Footer</li></ul>");
view("colors", "<h3>Colours</h3><p>🟣 🔵 🟢 🟡</p>");
view("info", "<h3>Info</h3>");
dock.model = createModel(
  { canvas: { title: "Canvas" }, layers: { title: "Layers" }, colors: { title: "Colours" }, info: { title: "Info" } },
  row([docs(["canvas"]), stack(["info"])], [4, 1]),
  { windows: [
    { key: "w1", box: { x: 60, y: 60, w: 240, h: 200 }, tree: stack(["layers"]) },
    { key: "w2", box: { x: 340, y: 140, w: 220, h: 160 }, tree: stack(["colors"]) }
  ] }
);
button("Float Info", () => dock.detach("info", { x: 420, y: 40, w: 260, h: 180 }));
button("Toggle snap", () => { dock.snap = dock.snap ? 0 : 20; log("snap " + dock.snap); });` }]
});

add({
  slug: "guide/drawers", title: "Auto-hide drawers", section: "Guides",
  body: `<h1>Auto-hide drawers</h1>
  <p class="lead">Stow a view to an edge with the drawer button (or <span class="kbd">Alt</span>+<span class="kbd">H</span>). It becomes a label on the edge rail and slides out when you hover or click it.</p>
  <ul><li>The side is chosen from the view's position, or pass one to <code>stow(id, side)</code>. Sides are logical: <code>start</code>/<code>end</code> flip in RTL.</li>
  <li>The flyout closes on <span class="kbd">Esc</span> or when you click elsewhere. The pin button keeps it open in the layout again.</li>
  <li>Views in floating windows and document areas cannot be stowed.</li></ul>
  ${ex("drawers")}`,
  examples: [{ id: "drawers", code: `${SETUP}
view("toolbox", "<h3>Toolbox</h3><ul><li>Button</li><li>Input</li><li>Slider</li></ul>");
view("design", "<h3>Designer</h3><p class='muted'>Hover the labels on the edges.</p>");
view("server", "<h3>Server explorer</h3>");
view("errors", "<h3>Error list</h3><span class='muted'>0 errors</span>");
view("output", "<h3>Output</h3>");
dock.model = createModel(
  { toolbox: { title: "Toolbox" }, design: { title: "Designer" }, server: { title: "Servers" }, errors: { title: "Errors" }, output: { title: "Output" } },
  row([docs(["design"]), stack(["output"])], [3, 1]),
  { drawers: { start: ["toolbox", "server"], end: [], top: [], bottom: ["errors"] } }
);
button("Stow Output", () => dock.stow("output"));` }]
});

add({
  slug: "guide/zoom", title: "Zoom (maximise)", section: "Guides",
  body: `<h1>Zoom</h1>
  <p class="lead">Zoom fills the whole component with one group. Use the zoom button, double-click a title bar, or <span class="kbd">Alt</span>+<span class="kbd">Z</span>; <span class="kbd">Esc</span> restores.</p>
  ${ex("zoom")}`,
  examples: [{ id: "zoom", code: `${basic}
button("Zoom Output", () => dock.toggleZoom("log"));
dock.addEventListener("flexdock-change", (e) => e.detail.reason === "zoom" && log("zoom → " + (e.detail.model.zoom ?? "none")));` }]
});

add({
  slug: "guide/drag-drop", title: "Drag & drop docking", section: "Guides",
  body: `<h1>Drag &amp; drop docking</h1>
  <p class="lead">Start dragging a title bar or tab. Targets appear over the group under the pointer and at the outer edges.</p>
  <table><tr><th>Target</th><th>Result</th></tr>
  <tr><td>Centre</td><td>Join the group as a tab.</td></tr>
  <tr><td>Arrows around the centre</td><td>Split the group and put the view on that side.</td></tr>
  <tr><td>Outer edge arrows</td><td>Dock along the whole edge of the layout.</td></tr>
  <tr><td>A splitter (gutter) between groups</td><td>Insert the view as a new group between the two neighbours.</td></tr>
  <tr><td>Centre of an empty document area</td><td>Open the view there as a document.</td></tr>
  <tr><td>Anywhere else</td><td>Float in a new window.</td></tr></table>
  <p>A translucent preview shows where the view will land. Press <span class="kbd">Esc</span> at any point to cancel: the layout goes back exactly as it was
  (including live tab reordering and window moves) and <code>flexdock-dragcancel</code> fires. Use <code>flexdock-beforemove</code> to veto a move
  (its <code>zone</code> is <code>"between"</code> for gutter drops). The same moves are available in code: <code>dropBetween(id, path, after)</code> and <code>dropIntoDocs(id, path)</code>.
  Pointer events are used throughout, so touch and pen work too.</p>
  ${ex("dnd")}`,
  examples: [{ id: "dnd", height: 460, code: `${SETUP}
const colours = { red: "#ef4444", amber: "#f59e0b", green: "#22c55e", blue: "#3b82f6", violet: "#8b5cf6" };
Object.entries(colours).forEach(([id, c]) => view(id, "<div class='kpi'><b style='color:" + c + "'>●</b><small>" + id + "</small></div>"));
dock.model = createModel(
  Object.fromEntries(Object.keys(colours).map((id) => [id, { title: id[0].toUpperCase() + id.slice(1) }])),
  row([stack(["red", "amber"]), column([stack(["green"]), stack(["blue"])]), stack(["violet"])])
);
dock.addEventListener("flexdock-beforemove", (e) => {
  if (e.detail.id === "violet" && e.detail.zone === "into") { e.preventDefault(); log("Violet refuses to share a group"); }
});
dock.addEventListener("flexdock-change", (e) => log(e.detail.reason));` }]
});

add({
  slug: "guide/keyboard", title: "Keyboard", section: "Guides",
  body: `<h1>Keyboard</h1>
  <p class="lead">Everything you can do with a pointer has a key. Shortcuts work while focus is inside the manager.</p>
  <table><tr><th>Keys</th><th>Action</th></tr>
  <tr><td><span class="kbd">Ctrl</span> + <span class="kbd">.</span></td><td>Open the "go to view" palette</td></tr>
  <tr><td><span class="kbd">Alt</span> + arrows</td><td>Focus the neighbouring group in that direction</td></tr>
  <tr><td><span class="kbd">Alt</span> + <span class="kbd">Shift</span> + arrows</td><td>Split the focused view off to that side</td></tr>
  <tr><td><span class="kbd">Alt</span> + <span class="kbd">PgUp</span>/<span class="kbd">PgDn</span></td><td>Previous / next tab in the group</td></tr>
  <tr><td><span class="kbd">Alt</span> + <span class="kbd">Z</span></td><td>Zoom / restore</td></tr>
  <tr><td><span class="kbd">Alt</span> + <span class="kbd">H</span></td><td>Stow to an edge drawer</td></tr>
  <tr><td><span class="kbd">Alt</span> + <span class="kbd">F</span></td><td>Float in a window</td></tr>
  <tr><td><span class="kbd">Alt</span> + <span class="kbd">Backspace</span></td><td>Close the focused view</td></tr>
  <tr><td><span class="kbd">Ctrl</span> + <span class="kbd">Alt</span> + <span class="kbd">Z</span> / <span class="kbd">Y</span></td><td>Undo / redo layout changes</td></tr>
  <tr><td><span class="kbd">Esc</span></td><td>Close drawer, menu or palette; leave zoom</td></tr>
  <tr><td>Arrows / <span class="kbd">Home</span> / <span class="kbd">End</span> on a gutter</td><td>Resize</td></tr></table>
  ${ex("keys")}`,
  examples: [{ id: "keys", code: `${basic}
dock.addEventListener("flexdock-focus", (e) => log("focus " + e.detail.id));
dock.addEventListener("flexdock-change", (e) => log(e.detail.reason));
button("Focus main.ts", () => { dock.activate("main"); dock.shadowRoot.querySelector('[role="tab"][aria-selected="true"]').focus(); });` }]
});

add({
  slug: "guide/a11y", title: "Accessibility & RTL", section: "Guides",
  body: `<h1>Accessibility &amp; RTL</h1>
  <p class="lead">Groups are labelled regions, tab strips are ARIA tablists, gutters are separators with values, windows are dialogs, and changes are announced through a polite live region.</p>
  <p>Right-to-left: put <code>dir="rtl"</code> on the element or a parent. Rows mirror, <code>start</code>/<code>end</code> drawers swap sides, and keyboard resizing follows the visual direction.</p>
  ${ex("rtl")}`,
  examples: [{ id: "rtl", code: `${SETUP}
dock.dir = "rtl";
view("inbox", "<h3>صندوق الوارد</h3><p>Inbox</p>");
view("msg", "<h3>رسالة</h3><p>Message</p>");
view("people", "<h3>جهات الاتصال</h3>");
dock.model = createModel(
  { inbox: { title: "الوارد" }, msg: { title: "رسالة" }, people: { title: "جهات الاتصال" } },
  row([stack(["inbox"]), docs(["msg"])], [1, 2]),
  { drawers: { start: [], end: ["people"], top: [], bottom: [] } }
);
button("Toggle direction", () => { dock.dir = dock.dir === "rtl" ? "ltr" : "rtl"; dock.requestUpdate(); });` }]
});

add({
  slug: "guide/events", title: "Events", section: "Guides",
  body: `<h1>Events</h1>
  <table><tr><th>Event</th><th>Detail</th><th>When</th></tr>
  <tr><td><code>flexdock-change</code></td><td><code>{ model, reason }</code></td><td>After every layout change</td></tr>
  <tr><td><code>flexdock-focus</code></td><td><code>{ id, previous }</code></td><td>The active view changed</td></tr>
  <tr><td><code>flexdock-viewshow</code></td><td><code>{ id }</code></td><td>A view is shown for the first time</td></tr>
  <tr><td><code>flexdock-beforeclose</code></td><td><code>{ id }</code></td><td>Before closing; <code>preventDefault()</code> to keep it</td></tr>
  <tr><td><code>flexdock-beforemove</code></td><td><code>{ id, target?, zone }</code></td><td>Before a dock/move; cancellable (<code>zone</code> may be <code>"between"</code>)</td></tr>
  <tr><td><code>flexdock-dragcancel</code></td><td><code>{ id }</code></td><td>A drag was cancelled (Esc or pointer cancel); layout restored</td></tr></table>
  ${ex("events")}`,
  examples: [{ id: "events", code: `${basic}
for (const type of ["flexdock-change", "flexdock-focus", "flexdock-viewshow", "flexdock-beforeclose", "flexdock-beforemove"]) {
  dock.addEventListener(type, (e) => log(type + " " + JSON.stringify(e.detail.reason ?? e.detail.id ?? e.detail)));
}
dock.addEventListener("flexdock-beforeclose", (e) => {
  if (e.detail.id === "main" && !confirm("Close main.ts?")) e.preventDefault();
});` }]
});

add({
  slug: "guide/persistence", title: "Persistence & workspaces", section: "Guides",
  body: `<h1>Persistence &amp; workspaces</h1>
  <p class="lead">Set <code>storageKey</code> and the layout is saved to localStorage after every change and restored on the next load.</p>
  <p>For named layouts, <code>Workspaces</code> stores snapshots you can switch between. Snapshots are plain JSON — send them to your server too.</p>
  ${ex("persist")}`,
  examples: [{ id: "persist", code: `${SETUP}
dock.storageKey = "flexdock-demo-persist";
["chart", "orders", "news", "chat"].forEach((id) => view(id, "<h3>" + id + "</h3>"));
const views = { chart: { title: "Chart" }, orders: { title: "Orders" }, news: { title: "News" }, chat: { title: "Chat" } };
const presets = {
  Analysis: row([stack(["chart"]), column([stack(["orders"]), stack(["news", "chat"])])], [2, 1]),
  Trading: column([row([stack(["orders"]), stack(["chart"])]), stack(["news", "chat"])], [3, 1]),
  Focus: row([stack(["chart", "orders", "news", "chat"])])
};
dock.model = createModel(views, presets.Analysis);
log(dock.restored ? "Restored your last layout from localStorage" : "Fresh layout");
const ws = new Workspaces("flexdock-demo-workspaces");
for (const name of Object.keys(presets)) button(name, () => dock.restore(createModel(views, presets[name])));
button("Save as ‘Mine’", () => { ws.save("Mine", dock.snapshot()); log("saved: " + ws.names().join(", ")); });
button("Load ‘Mine’", () => { const m = ws.load("Mine"); m ? dock.restore(m) : log("nothing saved yet"); });` }]
});

add({
  slug: "guide/undo", title: "Undo & redo", section: "Guides",
  body: `<h1>Undo &amp; redo</h1>
  <p class="lead">Every structural change (move, float, stow, close, resize…) is recorded. Call <code>undo()</code> / <code>redo()</code> or press <span class="kbd">Ctrl</span>+<span class="kbd">Alt</span>+<span class="kbd">Z</span> / <span class="kbd">Y</span>. Selecting tabs and focusing are not recorded.</p>
  ${ex("undo")}`,
  examples: [{ id: "undo", code: `${basic}
const u = button("Undo", () => dock.undo());
const r = button("Redo", () => dock.redo());
const sync = () => { u.disabled = !dock.canUndo; r.disabled = !dock.canRedo; };
dock.addEventListener("flexdock-change", (e) => { sync(); log(e.detail.reason); });
sync();` }]
});

add({
  slug: "guide/popout", title: "Pop-out windows", section: "Guides",
  body: `<h1>Pop-out windows</h1>
  <p class="lead">Move a view's content into its own browser window — great for second monitors. Choose “Open in new browser window” from the ⋯ menu, or call <code>popOut(id)</code>.</p>
  <p>The content element itself moves (state is kept). Closing the browser window, or “Bring back”, returns it. Popup blockers apply: call it from a user gesture.</p>
  ${ex("popout")}`,
  examples: [{ id: "popout", code: `${basic}
button("Pop out Output", () => log(dock.popOut("log") ? "opened" : "blocked"));` }]
});

add({
  slug: "guide/palette", title: "Command palette", section: "Guides",
  body: `<h1>Command palette</h1>
  <p class="lead">Press <span class="kbd">Ctrl</span>+<span class="kbd">.</span> (or call <code>openPalette()</code>) to search every view — docked, floating, stowed or closed — plus layout commands.</p>
  ${ex("palette")}`,
  examples: [{ id: "palette", code: `${basic}
dock.dismiss("notes");
button("Open palette", () => dock.openPalette());` }]
});

add({
  slug: "guide/minimap", title: "Layout minimap", section: "Guides",
  body: `<h1>Layout minimap</h1>
  <p class="lead"><code>&lt;flexdock-minimap for="id"&gt;</code> renders a live miniature of a manager's layout, including floating windows. Click a block to reveal that view.</p>
  ${ex("minimap")}`,
  examples: [{ id: "minimap", code: `${basic}
dock.id = "mini-demo";
const map = document.createElement("flexdock-minimap");
map.setAttribute("for", "mini-demo");
map.style.cssText = "position:absolute;right:12px;bottom:12px;z-index:100;width:180px;height:110px;box-shadow:0 6px 20px rgb(0 0 0/.2);border-radius:8px";
host.append(map);` }]
});

add({
  slug: "guide/lazy", title: "Lazy content", section: "Guides",
  body: `<h1>Lazy content</h1>
  <p class="lead"><code>flexdock-viewshow</code> fires the first time a view becomes visible — create expensive content (charts, editors, iframes) only then.</p>
  ${ex("lazy")}`,
  examples: [{ id: "lazy", code: `${SETUP}
const ids = ["one", "two", "three", "four"];
ids.forEach((id) => view(id, "<span class='muted'>not loaded</span>"));
dock.addEventListener("flexdock-viewshow", (e) => {
  const el = dock.querySelector('[data-view="' + e.detail.id + '"]');
  el.innerHTML = "<h3>Loaded " + e.detail.id + "</h3><p>at " + new Date().toLocaleTimeString() + "</p>";
  log("loaded " + e.detail.id);
});
dock.model = createModel(
  Object.fromEntries(ids.map((id) => [id, { title: "Tab " + id, lazy: true }])),
  stack(ids)
);` }]
});

add({
  slug: "guide/caps", title: "Permissions", section: "Guides",
  body: `<h1>Permissions</h1>
  <p class="lead">Per-view <code>caps</code> switch off what users may do. Everything is allowed by default.</p>
  <table><tr><th>Cap</th><th>When <code>false</code></th></tr>
  <tr><td><code>dismiss</code></td><td>No close button; cannot be closed</td></tr>
  <tr><td><code>hide</code></td><td>Cannot be stowed to a drawer</td></tr>
  <tr><td><code>float</code></td><td>Cannot float in a window</td></tr>
  <tr><td><code>move</code></td><td>Cannot be dragged or re-docked</td></tr>
  <tr><td><code>zoom</code> / <code>popout</code></td><td>No zoom / pop-out</td></tr>
  <tr><td><code>docsOnly: true</code></td><td>May only live in a document area</td></tr>
  <tr><td><code>inert: true</code></td><td>Content is shown but not interactive</td></tr></table>
  ${ex("caps")}`,
  examples: [{ id: "caps", code: `${SETUP}
view("fixed", "<h3>Navigation</h3><p class='muted'>Cannot be moved or closed.</p>");
view("doc", "<h3>Report.docx</h3><p class='muted'>Documents only.</p>");
view("preview", "<h3>Preview</h3><button>Not clickable</button>");
dock.model = createModel(
  {
    fixed: { title: "Navigation", caps: { move: false, dismiss: false, hide: false, float: false } },
    doc: { title: "Report.docx", caps: { docsOnly: true } },
    preview: { title: "Preview (read only)", caps: { inert: true } }
  },
  row([stack(["fixed"]), docs(["doc"]), stack(["preview"])], [1, 2, 1])
);` }]
});

add({
  slug: "guide/i18n", title: "Labels & i18n", section: "Guides",
  body: `<h1>Labels &amp; i18n</h1>
  <p class="lead">All button labels, tooltips and announcements come from <code>labels</code>. Pass any subset to translate or rename them.</p>
  ${ex("i18n")}`,
  examples: [{ id: "i18n", code: `${basic}
const fr = { dismiss: "Fermer", zoom: "Agrandir", unzoom: "Restaurer", stow: "Masquer automatiquement", more: "Plus d’actions",
  float: "Détacher", popout: "Ouvrir dans une fenêtre", palette: "Aller à la vue", palettePlaceholder: "Rechercher…" };
button("Français", () => { dock.labels = fr; });
button("English", () => { dock.labels = {}; });` }]
});

const fwDemo = (id: string) => `<div class="demo"><div class="stage" style="height:340px" data-fw="${id}"></div></div>`;
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
add({
  slug: "guide/frameworks", title: "Frameworks", section: "Guides",
  body: `<h1>Frameworks</h1>
  <p class="lead">flexdock is a standard custom element, and ships thin, typed wrappers as optional subpath exports:
  <code>flexdock/react</code>, <code>flexdock/vue</code>, <code>flexdock/angular</code> and <code>flexdock/svelte</code>.
  Each framework is an <em>optional</em> peer dependency, so nothing extra is installed unless you use it. Every demo below is live.</p>
  <h2>React</h2>
  <pre><code>${esc(`import { FlexdockLayout } from "flexdock/react";

export function Workspace() {
  const [model, setModel] = useState(initialModel);
  const dock = useRef<FlexdockManager>(null); // dock.current.undo(), .detach(id) …
  return (
    <FlexdockLayout ref={dock} model={model} theme="auto"
      onLayoutChange={(d) => setModel(d.model)}
      onBeforeClose={(e) => { if (unsaved) e.preventDefault(); }}>
      <Explorer data-view="files" />
      <Editor data-view="main" />
    </FlexdockLayout>
  );
}`)}</code></pre>
  ${fwDemo("react")}
  <p>Props: <code>model, theme, snap, storageKey, keepEmpty, labels, className, style</code>. Callbacks:
  <code>onLayoutChange, onViewFocus, onViewShow, onBeforeClose, onBeforeMove, onDragCancel</code>.</p>
  <h2>Vue 3</h2>
  <pre><code>${esc(`<script setup lang="ts">
import { FlexdockLayout } from "flexdock/vue";
const model = ref(initialModel);
</script>

<template>
  <FlexdockLayout v-model:model="model" theme="auto" @layout-change="(d) => console.log(d.reason)">
    <FileTree data-view="files" />
    <Editor data-view="main" />
  </FlexdockLayout>
</template>`)}</code></pre>
  ${fwDemo("vue")}
  <p>Emits <code>layout-change, update:model, view-focus, view-show, before-close, before-move, drag-cancel</code>; exposes <code>element</code>.
  No <code>isCustomElement</code> setting is needed when you use the wrapper.</p>
  <h2>Angular</h2>
  <pre><code>${esc(`import { FlexdockLayoutComponent } from "flexdock/angular";

@Component({
  selector: "app-workspace",
  imports: [FlexdockLayoutComponent],
  template: \`
    <flexdock-layout [model]="model()" theme="auto" (layoutChange)="model.set($event.model)">
      <app-explorer data-view="files" />
      <app-editor data-view="main" />
    </flexdock-layout>\`
})
export class Workspace {
  model = signal(initialModel);
}`)}</code></pre>
  ${fwDemo("angular")}
  <p>Standalone component, shipped partially compiled (works with the Angular CLI's linker, AOT and zoneless apps).
  Inputs: <code>model, theme, snap, storageKey, keepEmpty, labels</code>. Outputs: <code>layoutChange, viewFocus, viewShow, beforeClose, beforeMove, dragCancel</code>.
  The element is available as <code>element</code>.</p>
  <h2>Svelte</h2>
  <pre><code>${esc(`<script>
  import { flexdock } from "flexdock/svelte";
  let model = $state(initialModel);
</script>

<flexdock-manager use:flexdock={{ model, on: { change: (d) => (model = d.model) } }}>
  <FileTree data-view="files" />
</flexdock-manager>`)}</code></pre>
  ${fwDemo("svelte")}
  <p>The action has no Svelte import, so it also works as a plain helper: <code>flexdock(el, options)</code> returns <code>{ update, destroy }</code>.</p>
  <h2>Plain HTML / Lit</h2>
  <pre><code>${esc(`<flexdock-manager id="dock"></flexdock-manager>
<script type="module">
  import "flexdock";
  dock.model = createModel(views, tree);
  dock.addEventListener("flexdock-change", (e) => save(e.detail.model));
</script>`)}</code></pre>`,
  after: (el) => {
    void import("./frameworks.js").then((fw) => {
      const run: Record<string, (h: HTMLElement) => Promise<void>> = { react: fw.mountReact, vue: fw.mountVue, angular: fw.mountAngular, svelte: fw.mountSvelte };
      for (const stage of Array.from(el.querySelectorAll<HTMLElement>("[data-fw]"))) {
        void run[stage.dataset["fw"]!]?.(stage).catch((err: unknown) => { stage.textContent = `Demo failed to load: ${String(err)}`; });
      }
    });
  }
});

add({
  slug: "guide/gutter-drop", title: "Gutter & empty-area drops", section: "Guides",
  body: `<h1>Gutter &amp; empty-area drops</h1>
  <p class="lead">Drag a tab onto the splitter between two groups to slot it in between them. Close every document, then drag a panel
  to the centre of the empty document area to open it there. Press <span class="kbd">Esc</span> during any drag to cancel.</p>
  ${ex("gutter")}`,
  examples: [{ id: "gutter", height: 460, code: `${SETUP}
["one", "two", "three", "four"].forEach((id) => view(id, "<h3>Panel " + id + "</h3><p class='muted'>Drag my tab onto a splitter.</p>"));
view("doc", "<h3>draft.md</h3><p>Close me to get an empty document area.</p>");
dock.model = createModel(
  { one: { title: "One" }, two: { title: "Two" }, three: { title: "Three" }, four: { title: "Four" }, doc: { title: "draft.md" } },
  row([stack(["one", "two"]), docs(["doc"]), stack(["three", "four"])], [1, 2, 1])
);
dock.addEventListener("flexdock-change", (e) => log(e.detail.reason));
dock.addEventListener("flexdock-dragcancel", (e) => log("drag cancelled: " + e.detail.id));` }]
});

// ---------------------------------------------------------------- examples
const exampleDefs: Array<[string, string, string, string, number?]> = [];
const exPage = (slug: string, title: string, lead: string, code: string, height = 560) =>
  add({ slug: `examples/${slug}`, title, section: "Examples", body: `<h1>${title}</h1><p class="lead">${lead}</p>${ex(slug)}`, examples: [{ id: slug, code, height }] });
void exampleDefs;

exPage("ide", "Code editor (IDE)", "A classic development environment: explorer, editor documents, outline, terminal and problems — with auto-hidden tools on the edges.", `${SETUP}
view("explorer", "<h3>EXPLORER</h3><ul><li>📁 src<ul><li>📄 app.ts</li><li>📄 router.ts</li><li>📄 store.ts</li></ul></li><li>📁 test</li><li>📄 package.json</li></ul>");
view("app", "<div class='v mono'>import { createApp } from './core';\\nimport { router } from './router';\\n\\nconst app = createApp({\\n  router,\\n  debug: false,\\n});\\n\\napp.mount('#root');</div>");
view("router", "<div class='v mono'>export const router = [\\n  { path: '/', page: 'home' },\\n  { path: '/about', page: 'about' },\\n];</div>");
view("store", "<div class='v mono'>export const store = new Map();</div>");
view("outline", "<h3>OUTLINE</h3><ul><li>ƒ createApp</li><li>◆ app</li></ul>");
view("terminal", "<div class='v mono'>$ npm run dev\\n  ready in 312 ms\\n  ➜ Local: http://localhost:5173/</div>");
view("problems", "<span class='muted'>No problems detected.</span>");
view("git", "<h3>SOURCE CONTROL</h3><p class='muted'>2 changes</p>");
view("search", "<h3>SEARCH</h3><input placeholder='Search' style='width:100%'>");
view("debug", "<h3>RUN AND DEBUG</h3>");
dock.model = createModel(
  {
    explorer: { title: "Explorer", icon: "🗂" }, app: { title: "app.ts" }, router: { title: "router.ts" }, store: { title: "store.ts" },
    outline: { title: "Outline" }, terminal: { title: "Terminal" }, problems: { title: "Problems" },
    git: { title: "Source control" }, search: { title: "Search" }, debug: { title: "Run & debug" }
  },
  row([stack(["explorer"]), column([docs(["app", "router", "store"]), stack(["terminal", "problems"])], [3, 1.2]), stack(["outline"])], [1, 3.5, 1]),
  { drawers: { start: ["search", "git", "debug"], end: [], top: [], bottom: [] } }
);
button("Undo", () => dock.undo());
button("Palette (Ctrl+.)", () => dock.openPalette());`);

exPage("dashboard", "Analytics dashboard", "A re-arrangeable KPI dashboard. Drag tiles to build your own view; it is remembered in localStorage.", `${SETUP}
dock.storageKey = "flexdock-example-dashboard";
const kpi = (v, l, d) => "<div class='kpi'><b>" + v + "</b><small>" + l + " <span class='" + (d[0] === "+" ? "up" : "down") + "'>" + d + "</span></small></div>";
view("rev", kpi("$1.28M", "Revenue", "+8.2%"));
view("users", kpi("48,210", "Active users", "+3.1%"));
view("churn", kpi("2.4%", "Churn", "-0.3%"));
view("nps", kpi("61", "NPS", "+4"));
view("trend", "<h3>Weekly revenue</h3><div class='bars'>" + [40, 55, 48, 70, 66, 82, 90, 76, 88, 95, 84, 100].map((h) => "<i style='height:" + h + "%'></i>").join("") + "</div>");
view("regions", "<h3>By region</h3><table><tr><th>Region</th><th>Revenue</th></tr><tr><td>North</td><td>$412k</td></tr><tr><td>South</td><td>$298k</td></tr><tr><td>East</td><td>$331k</td></tr><tr><td>West</td><td>$239k</td></tr></table>");
view("feed", "<h3>Activity</h3><ul><li>New enterprise deal — Fernhill Co.</li><li>Release 4.2 shipped</li><li>Campaign ‘Autumn’ started</li></ul>");
dock.model = createModel(
  { rev: { title: "Revenue" }, users: { title: "Users" }, churn: { title: "Churn" }, nps: { title: "NPS" },
    trend: { title: "Trend" }, regions: { title: "Regions" }, feed: { title: "Activity" } },
  column([row([stack(["rev"]), stack(["users"]), stack(["churn"]), stack(["nps"])]), row([stack(["trend"]), column([stack(["regions"]), stack(["feed"])])], [2, 1])], [1, 3])
);
button("Reset", () => { localStorage.removeItem(dock.storageKey); location.reload(); });`);

exPage("trading", "Trading desk", "A dense trading workspace: watchlist, chart, order book, blotter and news, in a dark theme with a floating order ticket.", `${SETUP}
dock.theme = "dark";
dock.setAttribute("data-fixed-theme", "");
const rows = [["AURX", 182.4, 1.2], ["BLNT", 61.07, -0.8], ["CRVO", 12.33, 4.1], ["DELM", 940.1, 0.3], ["EKKO", 77.5, -2.2]];
view("watch", "<table><tr><th>Sym</th><th>Last</th><th>Chg</th></tr>" + rows.map((r) => "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td class='" + (r[2] > 0 ? "up" : "down") + "'>" + r[2] + "%</td></tr>").join("") + "</table>");
view("chart", "<h3>AURX · 5m</h3><div class='bars'>" + Array.from({ length: 40 }, (_, i) => "<i style='height:" + (40 + Math.round(30 * Math.sin(i / 4) + i)) + "%'></i>").join("") + "</div>");
view("book", "<table><tr><th>Bid</th><th>Size</th><th>Ask</th><th>Size</th></tr>" + [0, 1, 2, 3, 4, 5].map((i) => "<tr><td class='up'>" + (182.3 - i * 0.05).toFixed(2) + "</td><td>" + (100 * (i + 1)) + "</td><td class='down'>" + (182.45 + i * 0.05).toFixed(2) + "</td><td>" + (90 * (i + 2)) + "</td></tr>").join("") + "</table>");
view("blotter", "<table><tr><th>Time</th><th>Side</th><th>Sym</th><th>Qty</th><th>Px</th></tr><tr><td>14:02</td><td class='up'>BUY</td><td>AURX</td><td>500</td><td>182.20</td></tr><tr><td>13:47</td><td class='down'>SELL</td><td>EKKO</td><td>1,200</td><td>78.10</td></tr></table>");
view("news", "<ul><li>Central bank holds rates steady</li><li>AURX beats estimates</li><li>Oil slips on supply data</li></ul>");
view("ticket", "<h3>New order</h3><p>AURX · Limit 182.30 · Qty 100</p><button>Buy</button> <button>Sell</button>");
dock.model = createModel(
  { watch: { title: "Watchlist" }, chart: { title: "Chart" }, book: { title: "Order book" }, blotter: { title: "Blotter" },
    news: { title: "News" }, ticket: { title: "Order ticket", caps: { hide: false } } },
  row([stack(["watch"]), column([stack(["chart"]), stack(["blotter", "news"])], [2, 1]), stack(["book"])], [1, 3, 1.2]),
  { windows: [{ key: "ticket", box: { x: 380, y: 70, w: 260, h: 170 }, tree: stack(["ticket"]) }] }
);`);

exPage("email", "Email client", "Folders, message list and reading pane — open messages as documents, pop them out to read side by side.", `${SETUP}
view("folders", "<ul style='list-style:none;padding:0'><li><b>Inbox</b> (3)</li><li>Starred</li><li>Sent</li><li>Drafts</li><li>Archive</li></ul>");
const mails = [["Priya", "Quarterly planning", true], ["Tom", "Lunch on Friday?", true], ["Build bot", "Nightly build passed", false], ["Ana", "Design review notes", true]];
view("list", mails.map((m, i) => "<div class='mail" + (m[2] ? " unread" : "") + "' data-mail='" + i + "'><b>" + m[0] + "</b><span>" + m[1] + "</span></div>").join(""));
view("m0", "<h3>Quarterly planning</h3><p>Hi all, the planning doc is ready for comments.</p>");
view("calendar", "<h3>Today</h3><ul><li>10:00 Stand-up</li><li>14:00 Design review</li></ul>");
view("contacts", "<h3>Contacts</h3><ul><li>Priya</li><li>Tom</li><li>Ana</li></ul>");
dock.model = createModel(
  { folders: { title: "Folders" }, list: { title: "Inbox" }, m0: { title: "Quarterly planning" }, calendar: { title: "Calendar" }, contacts: { title: "Contacts" } },
  row([stack(["folders"]), stack(["list"]), docs(["m0"])], [0.8, 1.4, 2.6]),
  { drawers: { start: [], end: ["calendar", "contacts"], top: [], bottom: [] } }
);
dock.querySelector('[data-view="list"]').addEventListener("click", (e) => {
  const item = e.target.closest("[data-mail]");
  if (!item) return;
  const i = item.dataset.mail, id = "m" + i;
  if (!dock.querySelector('[data-view="' + id + '"]')) view(id, "<h3>" + mails[i][1] + "</h3><p>From " + mails[i][0] + "</p>");
  if (!dock.model.views[id]) dock.addView(id, { title: mails[i][1] }); else dock.reveal(id);
});`);

exPage("notebook", "Data notebook", "Notebook cells as documents, with a variables inspector, a plot window and a console split below.", `${SETUP}
view("cell1", "<div class='v mono'>In [1]: df = load('sales.csv')\\nIn [2]: df.groupby('region').sum()</div>");
view("cell2", "<div class='v mono'>In [3]: model = fit(df, target='units')</div>");
view("vars", "<table><tr><th>Name</th><th>Type</th></tr><tr><td>df</td><td>Frame 2,431×8</td></tr><tr><td>model</td><td>Regressor</td></tr></table>");
view("plot", "<h3>units by month</h3><div class='bars'>" + [3, 5, 4, 7, 9, 8, 11, 10, 12].map((h) => "<i style='height:" + h * 8 + "%'></i>").join("") + "</div>");
view("console", "<div class='v mono'>>>> r2 = 0.87</div>");
dock.model = createModel(
  { cell1: { title: "analysis.nb" }, cell2: { title: "model.nb" }, vars: { title: "Variables" }, plot: { title: "Plot" }, console: { title: "Console" } },
  column([row([docs(["cell1", "cell2"]), stack(["vars"])], [3, 1]), stack(["console"])], [3, 1]),
  { windows: [{ key: "plot", box: { x: 420, y: 110, w: 320, h: 220 }, tree: stack(["plot"]) }] }
);`);

exPage("design", "Design tool", "A canvas surrounded by layers, assets and inspector panels — with RTL-safe drawers and a minimap.", `${SETUP}
dock.id = "design-dock";
view("canvas", "<div class='kpi'><b>🖼</b><small>Artboard 1 · 1440×900</small></div>");
view("layers", "<ul><li>Frame / Hero</li><li>Text / Title</li><li>Button / Primary</li></ul>");
view("assets", "<ul><li>Logo.svg</li><li>Photo-1.jpg</li><li>Icons</li></ul>");
view("inspect", "<table><tr><td>W</td><td>320</td></tr><tr><td>H</td><td>48</td></tr><tr><td>Radius</td><td>12</td></tr><tr><td>Fill</td><td>#5B5BD6</td></tr></table>");
view("comments", "<p>Ana: tighten the spacing?</p>");
dock.model = createModel(
  { canvas: { title: "Canvas", caps: { dismiss: false } }, layers: { title: "Layers" }, assets: { title: "Assets" }, inspect: { title: "Inspector" }, comments: { title: "Comments" } },
  row([stack(["layers", "assets"]), docs(["canvas"]), stack(["inspect"])], [1, 4, 1.2]),
  { drawers: { start: [], end: ["comments"], top: [], bottom: [] } }
);
const map = document.createElement("flexdock-minimap");
map.setAttribute("for", "design-dock");
map.style.cssText = "position:absolute;left:12px;bottom:12px;z-index:100;box-shadow:0 6px 20px rgb(0 0 0/.2);border-radius:8px";
host.append(map);`);

exPage("ops", "Operations console", "Monitoring wall: alerts, service map, logs and metrics, with presets for incident and overview modes.", `${SETUP}
view("alerts", "<ul><li class='down'>● api-gateway p99 &gt; 800ms</li><li class='up'>● payments recovered</li></ul>");
view("map", "<div class='kpi'><b>12 / 13</b><small>services healthy</small></div>");
view("logs", "<div class='v mono'>12:01:22 INFO  deploy finished\\n12:01:40 WARN  retrying upstream\\n12:02:03 ERROR timeout (gateway)</div>");
view("cpu", "<h3>CPU</h3><div class='bars'>" + [30, 42, 38, 55, 61, 48, 70, 66].map((h) => "<i style='height:" + h + "%'></i>").join("") + "</div>");
view("runbook", "<h3>Runbook</h3><ol><li>Check gateway pods</li><li>Scale to 6</li><li>Post status update</li></ol>");
const views = { alerts: { title: "Alerts" }, map: { title: "Service map" }, logs: { title: "Logs" }, cpu: { title: "CPU" }, runbook: { title: "Runbook" } };
const overview = column([row([stack(["map"]), stack(["cpu"])]), row([stack(["alerts"]), stack(["logs"])], [1, 2])]);
const incident = row([column([stack(["alerts"]), stack(["runbook"])]), column([stack(["logs"]), stack(["cpu", "map"])], [2, 1])], [1, 2]);
dock.model = createModel(views, overview, { parked: ["runbook"] });
button("Overview", () => dock.restore(createModel(views, overview, { parked: ["runbook"] })));
button("Incident mode", () => dock.restore(createModel(views, incident)));`);

exPage("kitchen-sink", "Everything at once", "All features enabled: documents, tabs, drawers on every side, floating windows, snap grid, persistence and a minimap.", `${SETUP}
dock.id = "sink"; dock.snap = 10;
const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
ids.forEach((id, n) => view(id, "<h3>View " + id.toUpperCase() + "</h3><p class='muted'>#" + (n + 1) + "</p>"));
dock.model = createModel(
  Object.fromEntries(ids.map((id) => [id, { title: "View " + id.toUpperCase() }])),
  row([stack(["a", "b"]), column([docs(["c", "d"]), stack(["e"])]), stack(["f"])], [1, 3, 1]),
  { drawers: { start: ["g"], end: ["h"], top: [], bottom: ["i"] }, windows: [{ key: "w", box: { x: 300, y: 80, w: 240, h: 160 }, tree: stack(["j"]) }] }
);
const map = document.createElement("flexdock-minimap");
map.setAttribute("for", "sink");
map.style.cssText = "position:absolute;right:16px;bottom:44px;z-index:100;border-radius:8px;box-shadow:0 6px 20px rgb(0 0 0/.2)";
host.append(map);
button("Undo", () => dock.undo()); button("Redo", () => dock.redo()); button("Palette", () => dock.openPalette());`);

// ---------------------------------------------------------------- theming playground
const vars: Array<[string, string, string]> = [
  ["--fd-accent", "#5b5bd6", "Accent"], ["--fd-canvas", "#eef0f4", "Canvas"], ["--fd-surface", "#ffffff", "Surface"],
  ["--fd-surface-2", "#f6f7f9", "Bars"], ["--fd-ink", "#1d2230", "Text"], ["--fd-ink-soft", "#626a7d", "Soft text"], ["--fd-line", "#dfe2e9", "Lines"]
];
add({
  slug: "playground", title: "Theming playground", section: "Reference",
  body: `<h1>Theming playground</h1>
  <p class="lead">flexdock is styled with <code>--fd-*</code> custom properties and <code>::part()</code>. Tweak them live, then copy the CSS.</p>
  <div class="play"><div id="controls">
    ${vars.map(([v, d, l]) => `<label>${l}<input type="color" data-var="${v}" value="${d}"></label>`).join("")}
    <label>Radius <input type="range" min="0" max="16" value="8" data-var="--fd-radius" data-unit="px"></label>
    <label>Gutter <input type="range" min="2" max="14" value="6" data-var="--fd-gutter" data-unit="px"></label>
    <label>Bar height <input type="range" min="26" max="48" value="34" data-var="--fd-bar-height" data-unit="px"></label>
    <label>Font size <input type="range" min="11" max="16" value="13" data-var="--fd-font-size" data-unit="px"></label>
    <label>Preset <select id="preset"><option>Default</option><option>Dark</option><option>Ocean</option><option>Forest</option><option>Sunset</option></select></label>
  </div><div>${ex("play")}</div></div>
  <h2>Your CSS</h2><pre><code id="css"></code></pre>
  <h2>Parts</h2>
  <p><code>frame</code>, <code>main</code>, <code>split</code>, <code>gutter</code>, <code>group</code> (+ <code>docs</code>), <code>bar</code>, <code>tab</code> (+ <code>tab-current</code>), <code>tab-close</code>,
  <code>action</code> (+ <code>stow</code>/<code>zoom</code>/<code>more</code>/<code>close</code>/<code>unstow</code>), <code>body</code>, <code>rail</code>, <code>rail-item</code>, <code>drawer</code>, <code>window</code>, <code>grip</code>,
  <code>overlay</code>, <code>preview</code>, <code>target</code>, <code>ghost</code>, <code>menu</code>, <code>palette</code>.</p>
  <pre><code>flexdock-manager::part(tab-current) { font-weight: 700; }
flexdock-manager::part(gutter) { background: repeating-linear-gradient(45deg, #0001 0 2px, transparent 2px 6px); }</code></pre>`,
  examples: [{ id: "play", height: 440, code: basic }],
  after: (el) => {
    const dock = el.querySelector("flexdock-manager") as HTMLElement & { theme: string };
    dock.setAttribute("data-fixed-theme", "");
    const css = el.querySelector("#css")!;
    const presets: Record<string, Record<string, string>> = {
      Default: {}, Dark: { theme: "dark" },
      Ocean: { "--fd-accent": "#0ea5e9", "--fd-canvas": "#e0f2fe", "--fd-surface-2": "#f0f9ff", "--fd-line": "#bae6fd" },
      Forest: { "--fd-accent": "#16a34a", "--fd-canvas": "#ecfdf5", "--fd-surface-2": "#f0fdf4", "--fd-line": "#bbf7d0", "--fd-ink": "#14301f" },
      Sunset: { "--fd-accent": "#f97316", "--fd-canvas": "#fff7ed", "--fd-surface-2": "#ffedd5", "--fd-line": "#fed7aa", "--fd-radius": "14px" }
    };
    const write = () => {
      const lines = Array.from(el.querySelectorAll<HTMLInputElement>("[data-var]"))
        .filter((i) => dock.style.getPropertyValue(i.dataset["var"]!))
        .map((i) => `  ${i.dataset["var"]}: ${dock.style.getPropertyValue(i.dataset["var"]!)};`);
      css.textContent = `flexdock-manager${dock.theme === "dark" ? '[theme="dark"]' : ""} {\n${lines.join("\n") || "  /* defaults */"}\n}`;
    };
    for (const input of Array.from(el.querySelectorAll<HTMLInputElement>("[data-var]"))) {
      input.addEventListener("input", () => {
        dock.style.setProperty(input.dataset["var"]!, input.value + (input.dataset["unit"] ?? ""));
        write();
      });
    }
    el.querySelector("#preset")!.addEventListener("change", (e) => {
      const p = presets[(e.target as HTMLSelectElement).value] ?? {};
      dock.removeAttribute("style");
      dock.style.height = "100%";
      dock.theme = p["theme"] === "dark" ? "dark" : "light";
      for (const [k, v] of Object.entries(p)) if (k.startsWith("--")) dock.style.setProperty(k, v);
      write();
    });
    write();
  }
});

// ---------------------------------------------------------------- API
add({
  slug: "api", title: "API reference", section: "Reference",
  body: `<h1>API reference</h1>
  <h2>&lt;flexdock-manager&gt; properties</h2>
  <table><tr><th>Property</th><th>Type</th><th>Description</th></tr>
  <tr><td><code>model</code></td><td><code>FlexdockModel</code></td><td>The layout. Assigning resets undo history.</td></tr>
  <tr><td><code>theme</code> (attr)</td><td><code>"light" | "dark" | "auto"</code></td><td>Colour scheme.</td></tr>
  <tr><td><code>snap</code></td><td><code>number</code></td><td>Grid size (px) for floating windows; 0 = off.</td></tr>
  <tr><td><code>storageKey</code> (attr <code>storage-key</code>)</td><td><code>string</code></td><td>Auto-save/restore in localStorage.</td></tr>
  <tr><td><code>labels</code></td><td><code>Partial&lt;FlexdockLabels&gt;</code></td><td>UI strings.</td></tr>
  <tr><td><code>restored</code></td><td><code>boolean</code> (read-only)</td><td>Whether the last model came from storage.</td></tr>
  <tr><td><code>canUndo</code>, <code>canRedo</code></td><td><code>boolean</code></td><td>History state.</td></tr></table>
  <h2>Methods</h2>
  <table><tr><th>Method</th><th>Description</th></tr>
  <tr><td><code>place(id, target, zone, index?)</code></td><td>Move beside / into the group holding <code>target</code>. Zones: <code>left</code>, <code>right</code>, <code>above</code>, <code>below</code>, <code>into</code>.</td></tr>
  <tr><td><code>dockToEdge(id, zone)</code></td><td><code>edge-left</code> | <code>edge-right</code> | <code>edge-above</code> | <code>edge-below</code>.</td></tr>
  <tr><td><code>detach(id, box?)</code></td><td>Float in a window.</td></tr>
  <tr><td><code>stow(id, side?)</code> / <code>unstow(id)</code></td><td>Auto-hide to / back from an edge drawer.</td></tr>
  <tr><td><code>dismiss(id)</code></td><td>Close (cancellable); stays registered.</td></tr>
  <tr><td><code>reveal(id)</code></td><td>Show wherever it is, or bring it back.</td></tr>
  <tr><td><code>toggleZoom(id?)</code></td><td>Zoom / restore.</td></tr>
  <tr><td><code>activate(id)</code></td><td>Focus a view.</td></tr>
  <tr><td><code>addView(id, info, near?)</code> / <code>forget(id)</code></td><td>Register &amp; show / remove completely.</td></tr>
  <tr><td><code>undo()</code> / <code>redo()</code></td><td>History.</td></tr>
  <tr><td><code>snapshot()</code> / <code>restore(model)</code></td><td>Copy out / apply (undoable).</td></tr>
  <tr><td><code>popOut(id)</code> / <code>popIn(id)</code></td><td>Separate browser window.</td></tr>
  <tr><td><code>dropBetween(id, path, after, windowKey?)</code></td><td>Insert as a new group between two siblings (what a gutter drop does).</td></tr>
  <tr><td><code>dropIntoDocs(id, path, windowKey?)</code></td><td>Put a view into an empty document area.</td></tr>
  <tr><td><code>cancelDrag()</code></td><td>Abort the current drag and restore the layout (what <span class="kbd">Esc</span> does).</td></tr>
  <tr><td><code>openPalette()</code></td><td>Go-to-view palette.</td></tr>
  <tr><td><code>nudge(id, zone)</code>, <code>cycleTab(id, step)</code>, <code>focusNeighbour(zone)</code></td><td>Keyboard helpers.</td></tr></table>
  <h2>Model helpers (pure functions)</h2>
  <p><code>createModel</code>, <code>row</code>, <code>column</code>, <code>stack</code>, <code>docs</code>, <code>normalize</code>, <code>isModel</code>, <code>locate</code>, <code>viewsIn</code>, <code>stacksOf</code>,
  <code>place</code>, <code>placeAtEdge</code>, <code>detach</code>, <code>stow</code>, <code>unstow</code>, <code>dismiss</code>, <code>reveal</code>, <code>forget</code>, <code>addView</code>,
  <code>select</code>, <code>reorder</code>, <code>setWeights</code>, <code>toggleZoom</code>, <code>catalogue</code>, <code>copy</code>, <code>emptyModel</code>.</p>
  <h2>Other exports</h2>
  <p><code>FlexdockMinimap</code> (<code>&lt;flexdock-minimap for&gt;</code>), <code>Workspaces</code>, <code>Timeline</code>, <code>DEFAULT_LABELS</code>, <code>geometry</code>, <code>VERSION</code>.</p>
  <h2>Events</h2><p>See <a href="#/guide/events">Events</a>.</p>`
});

export const pages = pagesList;
