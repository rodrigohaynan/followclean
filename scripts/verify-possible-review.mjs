import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/rules/possible-review.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", compiled)(
  () => ({}), module, module.exports,
);
const { possibleReviewCandidates } = module.exports;
const profile = (username, followersCount, dataSource = "android", parserVersion = 2) =>
  ({ username, followersCount, dataSource, parserVersion, updatedAt: "2026-09-25T12:00:00Z" });
const candidates = ["below", "edge", "above", "above", "missing", "legacy", "__deleted__1", "invalid", "negative"];
const metadata = [
  profile("below", 1999), profile("edge", 2000), profile("above", 2001),
  profile("legacy", 7000, "extension", 1), profile("invalid", NaN),
  profile("negative", -1)
];
const actual = possibleReviewCandidates(candidates, metadata, 2000);
assert.deepEqual(actual, ["below", "edge", "invalid", "legacy", "missing", "negative"]);
assert.equal(actual.includes("above"), false, "Previously verified above-limit profiles must not be rechecked.");
assert.equal(actual.includes("edge"), true, "The configured limit is inclusive.");
assert.equal(possibleReviewCandidates(candidates, metadata, 3000).includes("above"), true,
  "Changing the user's chosen limit must update eligibility.");
assert.equal(possibleReviewCandidates(candidates, metadata, 1000).includes("edge"), false);
console.log("Possible recheck respects configured follower limit: PASS");
