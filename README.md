# Canvas Synced

Canvas Synced is a Chrome extension that exports your active Canvas LMS courses and assignments using your existing Canvas login. It works from your school’s Canvas tab, including custom HTTPS domains that serve the Canvas API on the same origin.

## Install in Chrome

1. Download [`canvas-synced.zip`](https://github.com/eric-s-ai-slop/canvas-synced/releases/latest/download/canvas-synced.zip) and extract it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted **canvas-synced** folder containing `manifest.json`.
4. Sign in to your school’s Canvas site in Chrome. From that tab, open Chrome’s Extensions menu and click **Canvas Synced**.
5. In the exporter tab, click **Read Canvas**, then **Download JSON**. Keep the original Canvas tab open while it reads.

[Chrome’s instructions for loading an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

## What you get

The JSON file lists course IDs, names, codes, links, and assignments with titles, links, and available due, unlock, and lock dates. If Canvas blocks a list or a limit is reached, the extension marks the export as partial and shows which data it could read.

Chrome grants temporary access to the current tab when you click the extension. Canvas Synced sends read-only requests to that tab’s Canvas API. Your Canvas session provides authentication, so setup requires no API token. The export stays on your device until you share it. The extension has no backend, analytics, or background scans.

If the extension reports a sign-in or tab-access error, reopen your school’s Canvas dashboard, sign in, and launch Canvas Synced from that tab. Availability depends on your school allowing unpacked extensions and browser-session access to the Canvas API.

## Develop

Use Node.js 22 or later and `zip`. The project has no package dependencies.

```sh
npm test
npm run build
```

For local development, load the repository’s `extension` folder in Chrome. The build produces `dist/canvas-synced.zip` for distribution.
