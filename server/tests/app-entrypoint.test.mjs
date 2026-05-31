import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isDirectRun } from "../src/app.js";

describe("server entrypoint detection", () => {
  it("recognizes Linux node src/app.js execution", () => {
    assert.equal(isDirectRun("file:///opt/add-whatsapp/server/src/app.js", "/opt/add-whatsapp/server/src/app.js"), true);
  });

  it("recognizes Windows node src/app.js execution", () => {
    assert.equal(isDirectRun("file:///C:/Users/m1591/Desktop/Add-WhatsApp/server/src/app.js", "C:\\Users\\m1591\\Desktop\\Add-WhatsApp\\server\\src\\app.js"), true);
  });
});
