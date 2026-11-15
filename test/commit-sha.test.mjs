import assert from "node:assert/strict";
import { test } from "node:test";
import { commitSha } from "../index.mjs";

const HEAD = "a".repeat(40);
const MERGE = "b".repeat(40);
const event = (json) => () => JSON.stringify(json);

test("a pull request reports its head commit, not the merge commit", () => {
  const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: "/event.json", GITHUB_SHA: MERGE };
  assert.equal(commitSha(env, event({ pull_request: { head: { sha: HEAD } } })), HEAD);
  assert.equal(commitSha({ ...env, GITHUB_EVENT_NAME: "pull_request_target" }, event({ pull_request: { head: { sha: HEAD } } })), HEAD);
});

test("a push reports GITHUB_SHA", () => {
  assert.equal(commitSha({ GITHUB_EVENT_NAME: "push", GITHUB_SHA: MERGE }), MERGE);
});

test("an unreadable event falls back to GITHUB_SHA", () => {
  const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: "/missing.json", GITHUB_SHA: MERGE };
  assert.equal(commitSha(env, () => { throw new Error("ENOENT"); }), MERGE);
  assert.equal(commitSha(env, event({})), MERGE);
});

test("nothing usable sends nothing", () => {
  assert.equal(commitSha({}), "");
  assert.equal(commitSha({ GITHUB_SHA: "not-a-sha" }), "");
});
