import { VERSION } from "flexdock";

const target = document.getElementById("version");
if (target) target.textContent = `Version ${VERSION}`;
