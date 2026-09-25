import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
for (const path of [
  "extension/background.js",
  "extension/followclean-bridge.js",
  "extension/instagram-profile.js",
  "extension/popup.js"
]) {
  new vm.Script(read(path), { filename: path });
}

const entries = new Map([
  ["followcleanQueue", ["perfil_da_conta_antiga"]],
  ["followcleanResults", { perfil_da_conta_antiga: { followersCount: 900 } }],
  ["followcleanBatch", { running: true, currentUsername: "perfil_da_conta_antiga" }]
]);
const copy = (keys) => {
  const names = typeof keys === "string" ? [keys] : keys;
  return Object.fromEntries(names.filter((key) => entries.has(key))
    .map((key) => [key, entries.get(key)]));
};
const dummyEvent = { addListener() {} };
const chrome = {
  storage: { local: {
    async get(keys) { return copy(keys); },
    async set(data) { for (const [key, value] of Object.entries(data)) entries.set(key, value); },
    async remove(keys) { for (const key of typeof keys === "string" ? [keys] : keys) entries.delete(key); }
  }},
  alarms: {
    async clear() { return true; }, async create() {}, async getAll() { return []; },
    onAlarm: dummyEvent
  },
  runtime: { onMessage: dummyEvent, onInstalled: dummyEvent, onStartup: dummyEvent },
  tabs: { onRemoved: dummyEvent }
};
const context = vm.createContext({ chrome, console, crypto: { randomUUID: () => "testing-device" },
  Date, Math, Promise, setTimeout() {} });
vm.runInContext(read("extension/background.js") +
  "\nglobalThis.__test = { getState, bindAccount, setScoped, getActiveAccount };", context);
const { getState, bindAccount, setScoped } = context.__test;

let state = await getState();
assert.equal(state.account, null);
assert.equal(state.queue.length, 0, "The old global queue must be quarantined.");
assert.equal(Object.keys(state.results).length, 0);
await bindAccount({ ownerId: "111", username: "primeira_conta" });
state = await getState();
assert.equal(state.queue.length, 0, "Legacy queue must not migrate automatically.");
await setScoped({
  followcleanQueue: ["perfil_a"],
  followcleanResults: { perfil_a: { username: "perfil_a", followersCount: 31 } },
  followcleanBatch: { running: true, currentUsername: "perfil_a" }
});
await bindAccount({ ownerId: "222", username: "segunda_conta" });
state = await getState();
assert.equal(state.account.ownerId, "222");
assert.equal(state.queue.length, 0, "Second Instagram account must start with an empty queue.");
assert.equal(Object.keys(state.results).length, 0, "Second account must not inherit first account counts.");
await setScoped({ followcleanQueue: ["perfil_b"] });
await bindAccount({ ownerId: "111", username: "primeira_conta" });
state = await getState();
assert.deepEqual(Array.from(state.queue), ["perfil_a"]);
assert.equal(state.batch.running, false, "Account switch must pause the old scanner.");
assert.equal(state.results.perfil_a.followersCount, 31);
assert.deepEqual(entries.get("followcleanQueue"), ["perfil_da_conta_antiga"],
  "Migration must preserve the previous extension data as a recovery archive.");
assert.match(read("extension/instagram-profile.js"), /FOLLOWCLEAN_PROFILE_CAPTURED/);
assert.doesNotMatch(read("extension/instagram-profile.js"), /chrome\.storage\.local\.set/);
assert.match(read("components/cleanup-manager.tsx"), /fromExtension && data\.ownerId !== account\.id/);
console.log("FollowClean extension account isolation: PASS");
