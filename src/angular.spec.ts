// Tests the shipped (partially compiled) Angular wrapper from dist/, as an app would consume it.
// Run `npm run build` first (build:verify does this).
import "@angular/compiler";
import { describe, expect, it } from "vitest";
import { Component, provideZonelessChangeDetection, signal } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { createModel, row, stack, type FlexdockModel } from "./index.js";

const { FlexdockLayoutComponent } = await import("../dist/angular.js" as string) as typeof import("./angular.js");

describe("angular wrapper", () => {
  it("projects content, binds inputs and emits outputs", async () => {
    const seen: string[] = [];
    @Component({
      selector: "test-host",
      standalone: true,
      imports: [FlexdockLayoutComponent],
      template: `<flexdock-layout [model]="model" [theme]="theme()" (layoutChange)="seen.push($event.reason)" (viewFocus)="seen.push('focus')">
        <div data-view="a">A</div><div data-view="b">B</div></flexdock-layout>`
    })
    class Host {
      model: FlexdockModel = createModel({ a: { title: "A" }, b: { title: "B" } }, row([stack(["a"]), stack(["b"])]));
      theme = signal<"light" | "dark">("light");
      seen = seen;
    }
    document.body.innerHTML = "<test-host></test-host>";
    const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
    const ref = app.bootstrap(Host);
    await app.whenStable();
    const el = document.querySelector("flexdock-manager")!;
    expect(el.querySelector('[data-view="a"]')!.slot).toBe("v:a");
    expect(el.model.views["a"]!.title).toBe("A");
    ref.instance.theme.set("dark");
    await app.whenStable();
    expect(el.theme).toBe("dark");
    el.place("a", "b", "into");
    expect(seen).toEqual(expect.arrayContaining(["place", "focus"]));
    app.destroy();
  });
});
