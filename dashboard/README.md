# BrainWeb

BrainWeb is a privacy-first analytics dashboard for the local Chrome extension. Analytics are stored in `chrome.storage.local`; the dashboard does not use a backend or send tracking data to a service.

## Run locally

1. In `dashboard`, install dependencies if needed and run `npm run dev`.
2. Open `http://localhost:3000` in Chrome.
3. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension` folder.
4. Open the dashboard using **Open dashboard** in the extension popup. It includes the current Chrome profile's extension ID automatically.

The extension accepts dashboard messages from `http://localhost:3000` during development. The dashboard ID is validated from the popup-provided `extensionId` query parameter; no ID is hardcoded in the dashboard.

## Production dashboard origin

Before packaging for production, set `environment` to `"production"` and set both `productionDashboardUrl` and `dashboardUrl` in `extension/dashboard-config.js` to the exact HTTPS dashboard URL. Production mode uses `productionDashboardUrl`; if it is missing, the popup disables the dashboard link and displays a configuration warning rather than falling back to localhost. Replace the `https://brainweb.example.com/*` example in `extension/manifest.json` with that exact origin's match pattern (for example, `https://your-dashboard.example/*`). Keep only origins you control. The worker allows only localhost and the configured production origin, and Chrome's manifest must be reloaded/updated after changing it. The dashboard uses the ID passed by the extension popup.

## Privacy and analytics

The extension records numerical counts, content categories, active seconds, local calendar dates, and platform classifications. Temporary salted hashes of post identifiers are kept in per-tab session storage solely to avoid recounting posts after a reload; those hashes are not sent to the extension or included in analytics and expire with the tab session. BrainWeb does not collect post text, private messages, credentials, screenshots, or full browsing history. Sponsored classification uses explicit platform DOM labels; when no reliable label is present, a post is counted as organic, so platform markup changes can affect this classification. Export and clear actions are available from the dashboard Settings page; clearing requires confirmation.
