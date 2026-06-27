# Chrome Web Store Listing — Cookie Trash Rejecter

> Last Updated: 2026-06-26

## Store Listing

**Extension Name**  
Cookie Trash Rejecter

**Short Description**  
Automatically rejects and hides cookie consent banners, saving your time and privacy.

**Detailed Description**  
An automatic cookie consent rejecter extension that declines tracking and hides cookie banners on all sites.

Key features:
- Heuristically detects and clicks negative options like "Reject All" or "Necessary Only".
- Disables marketing and tracking switches within custom preferences panels before submitting consent.
- Hides stubborn cookie banners instantly to prevent layout shift.
- Restores window scroll controls if banners attempt to lock the viewport.
- Fully operates locally on your machine with zero external data transmissions.

How to use it:
- Install the extension.
- The extension automatically blocks and declines cookie popups on all sites you visit.
- Click the extension icon to view statistics or toggle protection on/off globally or per-site.

Privacy & Permissions:
- This extension requires read permissions for websites in order to locate and programmatically click cookie consent elements. No website content, history, or identifiers are collected or sent to any server.

Support / Feedback:
- Source code and issue reporting is hosted on GitHub.

**Category**  
Productivity

**Single Purpose**  
Automatically rejects and hides cookie consent banners on websites.

**Primary Language**  
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |

### Screenshot Notes
- **Screenshot 1**: Demonstrates the popup window active on a page, showing blocked statistics (e.g. "This Page: 1 banner rejected", "Total Blocked: 24").
- **Screenshot 2**: Shows a website before and after, demonstrating a cookie banner disappearing and page scrolling behaving normally.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Required to persist the extension active status, the user's whitelisted websites, and the total blocked banner count. |
| `tabs` | permissions | Required to read the URL hostname of the active tab in order to determine if the site is whitelisted, and to manage the domain whitelist toggle in the popup. |
| `http://*/*` and `https://*/*` | host_permissions | Required to execute the content script on web pages to search for, click, and hide cookie consent dialogs as they load. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**  
https://github.com/marc/cookie-trash-rejecter/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public  
**Regions**: All regions  
**Pricing**: Free  

## Developer Info

**Publisher Name**  
Cookie Trash Dev Team

**Contact Email**  
support@cookietrashrejecter.dev

**Support URL / Email**  
https://github.com/marc/cookie-trash-rejecter/issues

**Homepage URL**  
https://github.com/marc/cookie-trash-rejecter

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-26 | Initial release containing heuristic click rejecter and glassmorphism stats popup. | Draft |

## Review Notes

### Known Issues / Limitations
- Does not block cookie consent engines if the web page renders them completely as critical visual elements (e.g., locking access with paywalls), but defaults to clicking rejection paths to preserve access and privacy.
