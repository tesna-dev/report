# Report tests to Tesna

Send your JUnit test results to [Tesna](https://tesna.dev), so every story shows what passed on Web, iOS and Android, and failures land in Triage with a likely cause.

```yaml
- uses: tesna-dev/report@v1
  if: always()   # report failures too
  with:
    api-key: ${{ secrets.TESNA_API_KEY }}
    project: CHE
    env: Web
```

1. In Tesna, open **Settings · API keys**, create a key, and save it as the repository secret `TESNA_API_KEY`.
2. Make your tests write a JUnit XML report (see below).
3. Add the step after your tests. `if: always()` makes sure failing runs are reported too.

Results match a Tesna test case by its **test key** (the test's name, or `classname.name`) or, failing that, by its exact title. Tests your coding agent writes and links with `link_automation` already have a key. The job summary lists anything that didn't match.

## Inputs

| Input | Required | Default | |
|---|---|---|---|
| `api-key` | yes | | A Tesna CI key (`tsn_…`) |
| `project` | yes | | Project key (`CHE`) or id |
| `env` | yes | | `Web`, `iOS`, `Android` or any environment in your workspace |
| `files` | no | `**/junit*.xml **/TEST-*.xml **/test-results/**/*.xml` | Space-separated globs |
| `url` | no | `https://tesna.dev` | |
| `fail-on-error` | no | `false` | Fail the job if Tesna rejects a report. By default it only warns, so Tesna never breaks your build. |

Outputs: `matched`, `unmatched`.

## Getting a JUnit report

| Tool | |
|---|---|
| Playwright | `npx playwright test --reporter=junit` with `PLAYWRIGHT_JUNIT_OUTPUT_NAME=junit.xml` |
| Cypress | `npx cypress run --reporter junit --reporter-options "mochaFile=junit-[hash].xml"` |
| Jest | `npx jest --reporters=default --reporters=jest-junit` (`npm i -D jest-junit`) |
| Vitest | `npx vitest run --reporter=junit --outputFile=junit.xml` |
| XCTest | `fastlane scan` writes `fastlane/test_output/report.junit`; set `files: "**/*.junit"` |
| Android (Gradle) | `./gradlew test connectedCheck` writes `build/test-results/**/TEST-*.xml` |
| pytest | `pytest --junitxml=junit.xml` |

## One job per platform

```yaml
jobs:
  e2e:
    strategy:
      matrix:
        include:
          - { platform: Web, runner: ubuntu-latest }
          - { platform: iOS, runner: macos-latest }
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v4
      # … run your tests …
      - uses: tesna-dev/report@v1
        if: always()
        with:
          api-key: ${{ secrets.TESNA_API_KEY }}
          project: CHE
          env: ${{ matrix.platform }}
```
