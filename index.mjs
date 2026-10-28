import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const input = (name, fallback = "") => (process.env[`INPUT_${name.toUpperCase().replace(/ /g, "_")}`] ?? "").trim() || fallback;
const strict = input("fail-on-error", "false") === "true";
const append = (file, text) => file && appendFileSync(file, text + "\n");
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const warn = (msg) => {
  console.log(`::${strict ? "error" : "warning"}::${msg.replace(/\r?\n/g, "%0A")}`);
  if (strict) process.exitCode = 1;
};

export function toRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function findFiles(root, globs) {
  const patterns = globs.map(toRegex);
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git") continue;
      const full = join(dir, name);
      const st = statSync(full, { throwIfNoEntry: false });
      if (!st) continue;
      if (st.isDirectory()) walk(full);
      else {
        const rel = relative(root, full).split(sep).join("/");
        if (patterns.some((p) => p.test(rel))) out.push(rel);
      }
    }
  };
  walk(root);
  return out.sort();
}

async function main() {
  const key = input("api-key");
  const project = input("project");
  const env = input("env");
  const base = input("url", "https://tesna.dev").replace(/\/+$/, "");
  const globs = input("files", "**/junit*.xml **/TEST-*.xml **/test-results/**/*.xml").split(/\s+/);
  if (!key) return warn("api-key is empty. Add your Tesna CI key (tsn_…) as a repository secret.");
  if (!project || !env) return warn("Set both project (e.g. CHE) and env (e.g. Web, iOS, Android).");

  const root = process.env.GITHUB_WORKSPACE || process.cwd();
  const files = findFiles(root, globs);
  if (!files.length) return warn(`No JUnit reports found for: ${globs.join(" ")}`);

  const url = `${base}/api/v1/runs/ingest?project=${encodeURIComponent(project)}&env=${encodeURIComponent(env)}`;
  const total = { matched: 0, passed: 0, failed: 0, skipped: 0 };
  const unmatched = [];
  let link = "";
  for (const file of files) {
    let res, body;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/xml" },
        body: readFileSync(join(root, file)),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      warn(`Couldn't reach Tesna at ${base}: ${e.message}`);
      continue;
    }
    if (!res.ok) {
      warn(`Tesna rejected ${file} (${res.status}): ${body.error ?? res.statusText}${body.environments ? `. Environments: ${body.environments.join(", ")}` : ""}`);
      continue;
    }
    total.matched += body.matched ?? 0;
    total.passed += body.counts?.passed ?? 0;
    total.failed += body.counts?.needs_triage ?? 0;
    total.skipped += body.counts?.skipped ?? 0;
    unmatched.push(...(body.unmatched ?? []));
    link = body.project_url ?? link;
    console.log(`Sent ${file}: ${body.matched} matched, ${body.unmatched?.length ?? 0} unmatched`);
  }

  append(process.env.GITHUB_OUTPUT, `matched=${total.matched}\nunmatched=${unmatched.length}`);
  const line = `${count(total.matched, "result", "results")} matched a test case: ${total.passed} passed, ${total.failed} failed, ${total.skipped} skipped.`;
  console.log(`Tesna · ${env}: ${line} ${unmatched.length} unmatched.`);
  const summary = [`### Tesna · ${env}`, "", line];
  if (link) summary.push(`[Open the project in Tesna](${link})`);
  if (unmatched.length) {
    summary.push("", `<details><summary>${count(unmatched.length, "result", "results")} matched no test case</summary>`, "");
    summary.push(...unmatched.slice(0, 50).map((n) => `- \`${n}\``));
    summary.push("", "Set this name as the Tesna test case's test key, or have your agent link the test (`link_automation`).", "</details>");
  }
  append(process.env.GITHUB_STEP_SUMMARY, summary.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
