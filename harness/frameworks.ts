// Live framework demos for the "Frameworks" guide. Loaded on demand so the rest of the site stays small.
import { createModel, row, stack, docs, type DockoramaModel } from "dockorama";

const base = (): DockoramaModel => createModel(
  { files: { title: "Files", icon: "📁" }, main: { title: "main.ts" }, notes: { title: "notes.md" }, log: { title: "Output" } },
  row([stack(["files"]), docs(["main", "notes"]), stack(["log"])], [1, 3, 1])
);
const status = (host: HTMLElement) => {
  const p = document.createElement("p");
  p.className = "muted fw-status";
  p.textContent = "Rearrange the panels: the framework state updates here.";
  host.after(p);
  return (t: string) => { p.textContent = t; };
};

export async function mountReact(host: HTMLElement): Promise<void> {
  const [{ createElement: h, useState }, { createRoot }, { DockoramaLayout }] = await Promise.all([
    import("react"), import("react-dom/client"), import("dockorama/react")
  ]);
  const say = status(host);
  function App() {
    const [model, setModel] = useState(base);
    const [changes, setChanges] = useState(0);
    return h(DockoramaLayout, {
      model, style: { height: "100%" },
      onLayoutChange: (d) => { setModel(d.model); setChanges((n) => n + 1); say(`React state: ${changes + 1} change(s), last “${d.reason}”`); }
    },
    h("div", { "data-view": "files", className: "v" }, h("h3", null, "Files (React)")),
    h("div", { "data-view": "main", className: "v" }, h("h3", null, "main.ts")),
    h("div", { "data-view": "notes", className: "v" }, h("h3", null, "notes.md")),
    h("div", { "data-view": "log", className: "v" }, h("small", null, "Rendered by React")));
  }
  createRoot(host).render(h(App));
}

export async function mountVue(host: HTMLElement): Promise<void> {
  const [{ createApp, h, ref }, { DockoramaLayout }] = await Promise.all([import("vue"), import("dockorama/vue")]);
  const say = status(host);
  createApp({
    setup() {
      const model = ref(base());
      return () => h(DockoramaLayout, {
        model: model.value, style: "height:100%",
        "onUpdate:model": (m: DockoramaModel) => { model.value = m; },
        "onLayout-change": (d: { reason: string }) => say(`Vue state updated: “${d.reason}”`)
      }, () => ["files", "main", "notes", "log"].map((id) => h("div", { "data-view": id, class: "v" }, [h("h3", `${id} (Vue)`)])));
    }
  }).mount(host);
}

export async function mountAngular(host: HTMLElement): Promise<void> {
  await import("@angular/compiler");
  const [{ Component, provideZonelessChangeDetection, signal }, { createApplication }, { DockoramaLayoutComponent }] = await Promise.all([
    import("@angular/core"), import("@angular/platform-browser"), import("dockorama/angular")
  ]);
  const say = status(host);
  @Component({
    selector: "dk-angular-demo",
    standalone: true,
    imports: [DockoramaLayoutComponent],
    template: `<dockorama-layout style="height:100%" [model]="model()" (layoutChange)="onChange($event)">
      <div class="v" data-view="files"><h3>Files (Angular)</h3></div>
      <div class="v" data-view="main"><h3>main.ts</h3></div>
      <div class="v" data-view="notes"><h3>notes.md</h3></div>
      <div class="v" data-view="log"><small>{{ count() }} change(s)</small></div>
    </dockorama-layout>`
  })
  class Demo {
    model = signal(base());
    count = signal(0);
    onChange(d: { model: DockoramaModel; reason: string }) { this.model.set(d.model); this.count.update((n) => n + 1); say(`Angular signal updated: “${d.reason}”`); }
  }
  const el = document.createElement("dk-angular-demo");
  el.style.cssText = "display:block;height:100%";
  host.append(el);
  const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
  app.bootstrap(Demo, el);
}

export async function mountSvelte(host: HTMLElement): Promise<void> {
  const { dockorama } = await import("dockorama/svelte");
  const say = status(host);
  const el = document.createElement("dockorama-manager");
  el.style.height = "100%";
  for (const id of ["files", "main", "notes", "log"]) el.insertAdjacentHTML("beforeend", `<div class="v" data-view="${id}"><h3>${id} (action)</h3></div>`);
  host.append(el);
  dockorama(el, { model: base(), on: { change: (d) => say(`Action callback: “${d.reason}”`) } });
}
