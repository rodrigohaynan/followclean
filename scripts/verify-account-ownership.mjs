import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("lib/storage/indexeddb.ts", root), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", compiled)(
  () => ({ DEFAULT_CLEANUP_SETTINGS: { notFollowingBack: true, maxFollowers: 2000, reciprocityChecks: {} } }),
  module, module.exports,
);
const { exportBelongsToAccount, exportNamesAnotherAccount, setStorageAccount, currentStorageOwner } = module.exports;
const first = "instagram-rodrigohaynan-2026-09-17-VjJ3hrrX.zip";
const other = "instagram-outra.conta-2026-09-25-abcdef.zip";
assert.equal(exportBelongsToAccount(first, "rodrigohaynan"), true);
assert.equal(exportBelongsToAccount(first, "outra.conta"), false);
assert.equal(exportBelongsToAccount(other, "rodrigohaynan"), false);
assert.equal(exportBelongsToAccount(other, "outra.conta"), true);
assert.equal(exportBelongsToAccount("arquivo-desconhecido.zip", "rodrigohaynan"), false);
assert.equal(exportNamesAnotherAccount(first, "outra.conta"), true);
setStorageAccount("123456", "rodrigohaynan");
assert.equal(currentStorageOwner(), "123456");
setStorageAccount("987654", "outra.conta");
assert.equal(currentStorageOwner(), "987654");
assert.throws(() => setStorageAccount("../../danger", "invalid"), /inválida/);

const check = (file, expression) =>
  assert.match(readFileSync(new URL(file, root), "utf8"), expression);
check("app/api/cleanup/cloud/snapshot/route.ts", /body\?\.ownerId !== identity\.ownerId/);
check("app/api/cleanup/cloud/state/route.ts", /quarantined: true/);
check("android-app/app/src/main/java/br/com/followclean/app/MainActivity.kt", /followclean_android_account_\$owner/);
check("components/cleanup-manager.tsx", /data\.ownerId !== account\.id/);
console.log("Account ownership guards: PASS");
