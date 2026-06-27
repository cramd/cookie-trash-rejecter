# Cookie Trash Rejecter 🛡️🍪

A premium Chrome browser extension designed to automatically decline, reject, and dismiss cookie consent popups and banners, preserving your privacy and providing a clean, uninterrupted browsing experience.

## Features

- **Heuristic Auto-Rejection Clicker**: Dynamically scans web pages to locate "Reject All", "Decline", "Necessary Only", or "Opt-Out" options and programmatically clicks them.
- **Deep Shadow DOM Support**: Recursively traverses shadow roots to block modern, encapsulated consent managers (like Usercentrics and Cookiebot) that traditional blockers miss.
- **Auto-Settings Configuration**: For banners without direct rejection paths, it opens the settings modal, deselects non-essential tracking switches, and saves preferences automatically.
- **Layout & Scroll Restoration**: Instantly hides stubborn overlays and removes viewport locks (`overflow: hidden`) or screen shields so you can scroll normally.
- **Sleek Glassmorphic Statistics Popup**: Displays live statistics of blocked trackers on the current page and overall, with an expandable details history log.
- **Smart Anti-Looping Circuit Breaker**: Advanced heuristics that ignore large structural wrappers (preventing false positives on sites like GitHub or Cloudflare) and an automatic cutoff to stop infinite re-render loops.
- **100% Local and Private**: Runs entirely in your browser with zero external calls or data tracking.

---

## Codebase Structure

```
jolly-bell/
├── manifest.json         # Extension configuration (Manifest V3)
├── background.js        # Service worker managing state, badge labels, and stats
├── content.js           # Rejection engine injecting styling and click logic
├── README.md            # Project documentation
├── CHROMEWEBSTORE.md    # Store listing metadata copy and guidelines
├── icons/               # Pixel-accurate PNG extension icons
└── popup/               # Glassmorphism popup user interface
    ├── popup.html
    ├── popup.css
    └── popup.js
```

---

## Installation & Setup

Since this extension is in active developer mode, you can install it as an unpacked extension:

1. Download or clone this repository to a folder on your computer.
2. Open Google Chrome and navigate to the extension management page: `chrome://extensions/`.
3. In the top-right corner, toggle the **Developer mode** switch to **ON**.
4. In the top-left menu, click the **Load unpacked** button.
5. Select the `jolly-bell` project directory.
6. Pin **Cookie Trash Rejecter** to your extension bar, open your favorite website, and enjoy cleaner browsing!

---

## How It Works

1. **Early Styling Injector**: The content script immediately appends a global `<style>` element targeting common consent banner classes/IDs to hide them before they shift the webpage layout.
2. **Mutation Observer**: A light DOM observer detects late-injected banners (which are usually loaded asynchronously).
3. **Element Validation & Interaction**: Checks button labels against strict keyword arrays to identify positive actions (like "Accept All" which we avoid) and negative actions (like "Decline" which we click).
4. **Scroll Lock Cleanup**: Sweeps the document root and body, clearing fixed positions and overflow constraints injected by banner frameworks.

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
