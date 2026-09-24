import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/rules/engine.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { buildCleanupQueue, DEFAULT_CLEANUP_SETTINGS, mergeReciprocityChecks } = module.exports;

const analysis = { notFollowingBack: ["samucasales10"] };
const metadata = [{ username: "samucasales10", followersCount: 346, dataSource: "android", updatedAt: "2026-09-24" }];
const stamp = "2026-09-24T08:00:00Z";
const candidate = (checks, createdAt = stamp, count = metadata) =>
  buildCleanupQueue(analysis, [], { ...DEFAULT_CLEANUP_SETTINGS, reciprocityChecks: checks }, count, createdAt);

assert.equal(candidate({})[0].classification, "priority", "export + valid count restores original priority");
assert.match(candidate({})[0].reasons.join(" "), /exportação/);
const confirmed = {
  samucasales10: { result: "not_following", checkedAt: stamp, analysisCreatedAt: stamp, method: "manual" },
};
assert.equal(candidate(confirmed)[0].classification, "priority", "two explicit methods allow priority");
assert.equal(candidate(confirmed, "2026-09-25T08:00:00Z")[0].classification, "priority", "new import uses current exported list without extra approval");
assert.equal(candidate(confirmed, stamp, [ { ...metadata[0], followersCount: 3000 } ])[0].classification, "above_limit", "large accounts remain outside priority");
assert.equal(candidate(confirmed, stamp, [])[0].classification, "review", "missing count cannot trigger priority");
assert.equal(candidate({ samucasales10: { ...confirmed.samucasales10, result: "follows" } }).length, 0, "confirmed reciprocal followers never enter cleanup queue");
assert.equal(candidate(confirmed, stamp, metadata).length, 1);
const recent = { result: "follows", checkedAt: "2026-09-24T09:00:00Z", analysisCreatedAt: stamp, method: "manual" };
assert.equal(mergeReciprocityChecks(confirmed, { samucasales10: recent }).samucasales10.result, "follows", "newer follow confirmation wins sync");
assert.equal(mergeReciprocityChecks({ samucasales10: recent }, confirmed).samucasales10.result, "follows", "stale upload cannot erase follow confirmation");
console.log("Reciprocity protection tests: PASS");
