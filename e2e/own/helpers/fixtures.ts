import { test as base, expect } from "@playwright/test";
import { Dock, watchErrors } from "./lab.js";

/** `dock` mounts the standard layout; `errors` fails the test on any console error or page error. */
export const test = base.extend<{ dock: Dock; errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors = watchErrors(page);
    await use(errors);
    expect(errors, "console / page errors").toEqual([]);
  }, { auto: true }],
  dock: async ({ page }, use) => { await use(await Dock.mount(page)); }
});
export { expect };
