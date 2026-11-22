# BrainWeb

### Understand your browsing habits. Take control of your attention.

BrainWeb is a privacy-first Chrome extension that tracks your browsing activity on **X (Twitter) and LinkedIn** and turns it into meaningful insights through a dedicated analytics dashboard.

Instead of endlessly scrolling without knowing where your time goes, BrainWeb helps you understand your social media consumption, the type of content you view, and how much time you spend on these platforms.

---

## Features

### 📊 Browsing Analytics
- Track browsing activity across X and LinkedIn.
- Monitor the number of posts viewed.
- Understand your daily and lifetime browsing activity.

### ⏱️ Active Time Tracking
- Track active browsing time.
- Monitor how much time you spend on supported platforms.
- View daily activity statistics.

### 🧠 Content Insights
- Track different content formats, including text, images, videos, and articles.
- Categorize viewed content as sponsored or organic.
- Understand your content consumption patterns.

### 📈 Analytics Dashboard
- Dedicated dashboard for browsing insights.
- Daily and lifetime analytics.
- Platform-wise activity breakdown.
- Visual representation of your browsing habits.

### 🔒 Privacy First
- Designed to store tracking statistics locally in your browser.
- Does not intentionally collect the actual text or contents of posts.
- No account registration required for the current local-first experience.
- Your browser profiles maintain separate tracking data.

---
## Supported Platforms

| Platform | Support |
|---|---|
| X (Twitter) | ✅ |
| LinkedIn | ✅ |
| Other websites | ❌ |

---

## Tech Stack

**Browser Extension**
- JavaScript
- Chrome Extension Manifest V3
- Chrome Storage API
- Intersection Observer API

**Dashboard**
- Next.js
- React
- TypeScript

---

## How It Works

1. Install the BrainWeb Chrome extension.
2. Open X or LinkedIn.
3. BrainWeb observes supported content appearing in your active browsing session.
4. It records activity metrics such as viewed content counts and active browsing time.
5. Statistics are stored locally in your browser.
6. Open the BrainWeb dashboard to explore your analytics.

The extension communicates with the dashboard to display statistics from the browser where it is installed.

---

## Installation

### Option 1: Install from GitHub

1. Download or clone this repository:

   ```bash
   git clone https://github.com/urvashi-agrawal-dev/brainweb-dashboard.git
   ```

2. Open Google Chrome and navigate to:

   ```text
   chrome://extensions
   ```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Navigate to the downloaded project and select the `extension` folder containing `manifest.json`.

6. Pin BrainWeb to your Chrome toolbar.

7. Open X or LinkedIn and start browsing.

8. Click the BrainWeb extension icon and open the dashboard.

### Option 2: Download the Extension ZIP

1. Download the extension ZIP from the GitHub Releases section.
2. Extract the downloaded ZIP.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click **Load unpacked**.
6. Select the extracted extension folder containing `manifest.json`.

---

## Project Structure

```text
BrainWeb/
│
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.js
│   └── dashboard-config.js
│
├── dashboard/
│   └── src/
│       └── app/
│
├── docs/
│   └── screenshots/
│       ├── dashboard.png
│       └── extension-popup.png
│
└── README.md
```

---

## Privacy

BrainWeb is designed around a local-first approach.

- Tracking statistics are stored using Chrome's local storage.
- The extension focuses on activity metrics rather than collecting post contents.
- Data is separated by browser profile.
- The dashboard reads statistics from the installed extension.

Please review the extension's permissions and source code before installing.

---

## Current Limitations

- Currently supports X and LinkedIn.
- Designed for Google Chrome and compatible Chromium-based browsers.
- Statistics are stored separately in each browser profile.
- Previously untracked activity cannot be reconstructed retroactively.
- Website layout changes may require updates to content detection logic.

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome!

1. Fork this repository.
2. Create a feature branch.
3. Make your changes.
4. Submit a pull request.

For bugs or suggestions, open an issue in the GitHub repository.

---

## Roadmap

- [ ] Chrome Web Store publication
- [ ] More detailed browsing insights
- [ ] Improved analytics and reporting
- [ ] Additional supported platforms
- [ ] Exportable activity reports
- [ ] Enhanced customization options

---

## Author

**Urvashi Agrawal**

- GitHub: [@urvashi-agrawal-dev](https://github.com/urvashi-agrawal-dev)
- LinkedIn: [Urvashi Agrawal](https://linkedin.com/in/uraviva/)
- Portfolio: [urvashi-agrawal.dev](https://urvashi-agrawal.dev)

---

## License

See the repository's LICENSE file for licensing terms.

---

**If BrainWeb helps you understand your browsing habits, consider giving the project a ⭐ on GitHub!**
