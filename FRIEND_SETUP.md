# Run ExceptionOS on your computer

This is the **v1.1.0 development candidate**, not an approved Marketplace release. It helps you understand a message, draft a response or unanswered follow-up, and track what happens next. English and Simplified Chinese are supported.

You can use your own browser. **Live AI requires your own Anna developer login and available model access/credits.** A separate OpenAI API key, Vercel deployment, and database are not required for the Anna app.

## 1. Prerequisites

Install Git, [Node.js](https://nodejs.org/) **22.13 or newer** (with npm), and uv/uvx. On macOS with Homebrew, install uv using `brew install uv`; other installation options are in the [official uv guide](https://docs.astral.sh/uv/getting-started/installation/). Reopen your terminal after installation.

```sh
git --version
node --version
npm --version
uv --version
uvx --version
```

Development has been verified on macOS; Windows/Linux have not been independently checked here. First-time installation needs internet access.

## 2. Download and install

```sh
git clone https://github.com/haneesh-bandaru/ExceptionOS.git
cd ExceptionOS
npm ci
npm run anna:validate
```

Run commands from this repository root unless told otherwise. If GitHub reports that the repository is unavailable, ask the owner for access and authenticate with your own GitHub account.

## 3. Connect your Anna account

Sign up or sign in at [Anna](https://anna.partners). Activate developer access in its Developer Console if needed, then run:

```sh
npx --yes @anna-ai/cli@0.1.58 login --host https://anna.partners
npx --yes @anna-ai/cli@0.1.58 whoami
```

Complete the device login in your browser. If the browser does not open, add `--no-browser` to the login command and follow the displayed instructions. Your credentials stay on your computer; do not copy the author's credentials.

If startup reports `HANDLE_REQUIRED`, choose your own available developer handle. Replace `YOUR_UNIQUE_HANDLE` with your choice:

```sh
npx --yes @anna-ai/cli@0.1.58 account set-handle YOUR_UNIQUE_HANDLE
```

The live harness may register a development app under your account. This is separate from Marketplace publication or submission.

## 4. Run in your browser

```sh
npm run anna:dev
```

Keep the terminal running and open **[http://localhost:5180](http://localhost:5180)** in Chrome, Safari, or Edge. If the harness offers a view chooser, select `main`. First startup can take longer while dependencies download.

Stop with **Ctrl+C**. Restart using the same command. Live mode uses Anna APS storage. The local URL works on your computer while the process runs; it is not a public link for another person.

## 5. Try the application

Use fictional information first, for example:

> Thanks for your application. Please send two examples of your campaign work so we can continue reviewing it.

1. Choose **I got a message**, paste the example, and optionally describe the outcome you want.
2. Read the model-processing consent and submit. Review Anna's interpretation, source quotes, and editable response.
3. Replace placeholders and try copying the response. The app does not send anything. Only record a response as sent if you actually sent it elsewhere; a test draft can remain unsent.
4. Choose a check-in and inspect the home screen's attention/waiting state.
5. Close and reopen the app; check that saved messages, drafts, and follow-up details return.
6. Try **I haven't heard back** using a fictional previous message. This should draft a follow-up without an incoming reply.
7. Try the language toggle, optional goal/action-plan flow, and closing/reopening a goal.

Live AI may consume your Anna credits. Review suggestions before using them. [PRIVACY.md](PRIVACY.md) explains the data stored and processed. Check-ins appear inside the app; there are no background reminders or inbox integrations.

## Offline UI preview

Stop the live harness, then run:

```sh
npm run anna:dev:offline
```

Open the same local URL. This disables live AI; AI actions will not generate live responses. Storage is temporary and can reset between sessions. First-time dependency downloads still need internet access.

## Troubleshooting

| Problem | Action |
| --- | --- |
| `uvx` not found | Install uv, reopen your terminal, and check `uvx --version`. |
| Authorization or APS error | Run `whoami`, log in again, and verify your Anna developer access. |
| `HANDLE_REQUIRED` | Set your own handle using the command above. |
| Model/credits error | Check your Anna model configuration and credits, then retry. Offline mode intentionally disables AI. |
| Port 5180 occupied | Stop your other harness or use the alternate-port command below. |
| Changes not visible | Run `npm run anna:build`, then reload. |
| Chromium missing during tests | Run `npx playwright install chromium`. |

For an alternate port, run from the repository root:

```sh
npm run anna:build
cd anna
npx --yes @anna-ai/cli@0.1.58 dev --slug exceptionos --view main --storage aps --port 5181
```

Open [http://localhost:5181](http://localhost:5181). Use `cd ..` afterward to return to the repository root. For harness diagnostics, run `npx --yes @anna-ai/cli@0.1.58 doctor` from the `anna` directory.

## Optional verification

From the repository root:

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run anna:validate
```

Browser tests simulate model/storage responses; they verify behavior, not live AI quality. The `scripts/test-anna-live-*.js` scripts use real model/storage calls and should not be run casually against important data.

## Repository map

| Path | Purpose |
| --- | --- |
| `anna/src/` | Current application source; edit here. |
| `anna/bundle/` | Generated app; rebuild rather than editing it directly. |
| `tests/` | Automated checks. |
| `docs/STATUS.md` | Current release status and remaining validation. |
| `sites/exceptionos-web/` | Unfinished standalone-browser starter, not the working ExceptionOS app. |
| `public/` and `src/` | Earlier web prototype. `npm start` launches this older product, not the current Anna app. |

Report issues with your commit (`git rev-parse --short HEAD`), OS/browser, reproduction steps, expected result, and actual result. Remove credentials and personal correspondence from screenshots/logs.

Running this checkout does not submit the app to Anna. Marketplace upload, publication, and resubmission remain under the owner's control.
