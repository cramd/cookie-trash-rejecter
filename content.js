// Content Script for Cookie Trash Rejecter
// Automatically detects and rejects cookie consent banners

(async () => {
  // Read settings from storage
  const settings = await chrome.storage.local.get(["enabled", "whitelistedDomains"]);
  if (settings.enabled === false) {
    console.log("Cookie Trash Rejecter is globally disabled.");
    return;
  }
  
  const hostname = window.location.hostname;
  const isWhitelisted = (settings.whitelistedDomains || []).some(domain => 
    hostname === domain || hostname.endsWith("." + domain)
  );
  
  if (isWhitelisted) {
    console.log(`Cookie Trash Rejecter is disabled on ${hostname} (whitelisted).`);
    return;
  }

  // Inject initial global styles to hide common banners instantly to avoid layout shifts
  const css = `
    /* Common cookie banners and CMP containers */
    #onetrust-consent-sdk,
    #didomi-host,
    #cookie-law-info-bar,
    #hs-eu-cookie-confirmation,
    .cookie-banner,
    .cookieconsent,
    .cc-window,
    .cc-banner,
    .cookie-notice,
    .cookie-popup,
    [class*="cookie-banner" i],
    [id*="cookie-banner" i],
    [class*="cookiebanner" i],
    [id*="cookiebanner" i],
    [class*="cookie-consent" i],
    [id*="cookie-consent" i],
    [class*="cookieconsent" i],
    [id*="cookieconsent" i],
    [class*="cookie-notice" i],
    [id*="cookie-notice" i],
    [class*="cookie-popup" i],
    [id*="cookie-popup" i],
    #sp-messaging-container,
    .sp-messaging-container,
    #cc-banner-wrap,
    .cookie-consent-overlay {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
  `;
  
  const style = document.createElement("style");
  style.id = "cookie-trash-rejecter-styles";
  style.textContent = css;
  // Append as early as possible
  if (document.documentElement) {
    document.documentElement.appendChild(style);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.appendChild(style);
    });
  }

  // Set to keep track of processed banner elements
  const processedBanners = new Set();
  
  // Circuit breaker to prevent infinite loops on tricky sites
  let blockedCount = 0;
  const MAX_BLOCKS = 10;
  let circuitBreakerTripped = false;
  
  // Heuristic button matchers
  function isRejectButton(text) {
    const cleanText = text.toLowerCase().replace(/[^a-z\s-]/g, "").trim();
    
    // Direct Reject / Necessary Only phrases
    const rejectPhrases = [
      "reject all", "decline all", "refuse all", "decline", "reject", "refuse", "deny",
      "essential only", "necessary only", "strictly necessary", "only necessary", "use necessary",
      "accept necessary", "accept essential", "without accepting", "without consenting",
      "opt-out", "opt out", "reject non-essential", "disable tracking"
    ];
    
    const hasRejectPhrase = rejectPhrases.some(phrase => cleanText.includes(phrase));
    const hasAcceptAll = /accept\s+all|allow\s+all|agree\s+all|allow\s+cookies|accept\s+cookies|enable\s+cookies/i.test(cleanText);
    
    // If it's a necessary-only button, it might contain "accept" (e.g. "accept essential only"),
    // so we handle it explicitly.
    const isNecessaryOnly = /only\s+necessary|necessary\s+only|essential\s+only|only\s+essential|accept\s+necessary|accept\s+essential|strictly\s+necessary/i.test(cleanText);
    
    if (isNecessaryOnly) return true;
    if (hasRejectPhrase && !hasAcceptAll) return true;
    return false;
  }

  function isSettingsButton(text) {
    const cleanText = text.toLowerCase().trim();
    const settingsPhrases = [
      "manage", "settings", "customize", "preferences", "options", "configure",
      "cookie settings", "manage preferences", "cookie preferences", "details",
      "more options", "view details"
    ];
    return settingsPhrases.some(phrase => cleanText.includes(phrase));
  }

  function isSaveButton(text) {
    const cleanText = text.toLowerCase().trim();
    const savePhrases = [
      "save", "confirm", "submit", "apply", "agree to selected", "accept selected",
      "save preferences", "save choices", "save and exit", "allow selection",
      "confirm selection", "confirm choices"
    ];
    return savePhrases.some(phrase => cleanText.includes(phrase));
  }

  // Recursive DOM traversal to find button-like elements (including inside Shadow DOMs)
  function getButtonsRecursive(element) {
    const buttons = [];
    
    function traverse(node) {
      if (!node) return;
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        const role = node.getAttribute ? node.getAttribute("role") : null;
        const type = node.getAttribute ? node.getAttribute("type") : null;
        const className = node.className && typeof node.className === "string" ? node.className : "";
        const isBtnClass = /btn|button/i.test(className);
        
        // Helper: Check if anchor tag is just a dummy link (no active external navigation)
        const isDummyAnchor = () => {
          if (tagName !== "a") return false;
          const href = node.getAttribute("href");
          return !href || !href.trim() || /^(#|javascript:)/i.test(href.trim()) || role === "button";
        };
        
        if (
          tagName === "button" || 
          role === "button" || 
          type === "button" || 
          type === "submit" ||
          isDummyAnchor() ||
          (isBtnClass && tagName !== "a") // Let class button qualify unless it is a navigating link
        ) {
          buttons.push(node);
        }
        
        if (node.shadowRoot) {
          traverse(node.shadowRoot);
        }
      }
      
      let child = node.firstChild;
      while (child) {
        traverse(child);
        child = child.nextSibling;
      }
    }
    
    traverse(element);
    return buttons;
  }

  // Recursive DOM traversal to find toggles and checkboxes
  function getTogglesRecursive(element) {
    const toggles = [];
    
    function traverse(node) {
      if (!node) return;
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        const type = node.getAttribute ? node.getAttribute("type") : null;
        const role = node.getAttribute ? node.getAttribute("role") : null;
        const className = node.className && typeof node.className === "string" ? node.className : "";
        
        const isToggleClass = /toggle|switch|checkbox/i.test(className);
        const isNavigatingAnchor = tagName === "a" && (() => {
          const href = node.getAttribute("href");
          return href && !/^(#|javascript:)/i.test(href.trim()) && role !== "checkbox" && role !== "switch";
        })();
        
        if (
          !isNavigatingAnchor &&
          ((tagName === "input" && type === "checkbox") ||
           role === "checkbox" ||
           role === "switch" ||
           isToggleClass)
        ) {
          toggles.push(node);
        }
        
        if (node.shadowRoot) {
          traverse(node.shadowRoot);
        }
      }
      
      let child = node.firstChild;
      while (child) {
        traverse(child);
        child = child.nextSibling;
      }
    }
    
    traverse(element);
    return toggles;
  }

  // Robustly trigger click events on elements
  function clickElement(element) {
    if (!element) return;
    
    // 1. Native click
    element.click();
    
    // 2. Dispatch events for JS frameworks
    const events = ["mousedown", "mouseup", "click"];
    events.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
    });
  }

  // Check if a toggle/checkbox is essential or necessary (we should not disable necessary cookies)
  function isEssentialToggle(toggle) {
    if (toggle.disabled) return true;
    if (toggle.getAttribute("disabled") !== null) return true;
    if (toggle.getAttribute("aria-disabled") === "true") return true;
    
    let text = "";
    
    // Check if toggle has an associated label
    if (toggle.id) {
      const label = document.querySelector(`label[for="${toggle.id}"]`);
      if (label) text += " " + label.textContent;
    }
    
    // Check text of parents
    let parent = toggle.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      text += " " + parent.textContent;
      parent = parent.parentElement;
      depth++;
    }
    
    text = text.toLowerCase();
    
    // If it has necessary keywords and doesn't contain marketing/advertising words
    const isNecessary = /necessary|essential|required|strictly/i.test(text);
    const isMarketing = /marketing|advertising|targeting|statistic|analysis|analytics|performance|functional/i.test(text);
    
    return isNecessary && !isMarketing;
  }

  // Restore scrolling on document body / html if blocked by banner scripts
  function restoreScrolling() {
    const elements = [document.body, document.documentElement];
    elements.forEach(el => {
      if (!el) return;
      
      const style = window.getComputedStyle(el);
      if (style.overflow === "hidden" || style.overflowY === "hidden") {
        el.style.setProperty("overflow", "auto", "important");
        el.style.setProperty("overflow-y", "auto", "important");
      }
      if (style.position === "fixed") {
        el.style.setProperty("position", "static", "important");
      }
    });
    
    // Remove lock classes
    const lockClasses = [
      "modal-open", "scroll-locked", "cookie-consent-open", 
      "onetrust-hide-scroll", "didomi-popup-open", "sp-no-scroll"
    ];
    lockClasses.forEach(cls => {
      if (document.body && document.body.classList.contains(cls)) {
        document.body.classList.remove(cls);
      }
      if (document.documentElement && document.documentElement.classList.contains(cls)) {
        document.documentElement.classList.remove(cls);
      }
    });
  }

  // Auto-reject cookies by clicking buttons in a settings modal
  async function handleSettingsFlow(settingsButton) {
    console.log("Opening settings modal...");
    clickElement(settingsButton);
    
    // Wait for modal to render (300ms)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Search the DOM for checkboxes and toggles
    const toggles = getTogglesRecursive(document.body);
    let uncheckedCount = 0;
    
    toggles.forEach(toggle => {
      if (isEssentialToggle(toggle)) return; // Skip necessary cookies
      
      // Determine if checked
      let isChecked = false;
      if (toggle.tagName.toLowerCase() === "input") {
        isChecked = toggle.checked;
      } else {
        isChecked = toggle.getAttribute("aria-checked") === "true" || 
                    toggle.classList.contains("active") || 
                    toggle.classList.contains("checked");
      }
      
      if (isChecked) {
        clickElement(toggle);
        uncheckedCount++;
      }
    });
    
    console.log(`Unchecked ${uncheckedCount} tracking toggles.`);
    
    // Find and click the Save/Confirm button
    const allButtons = getButtonsRecursive(document.body);
    let saveButton = null;
    
    for (const btn of allButtons) {
      const text = (btn.textContent || "").trim();
      if (isSaveButton(text)) {
        saveButton = btn;
        break;
      }
    }
    
    if (saveButton) {
      console.log(`Clicking save button: "${saveButton.textContent.trim()}"`);
      clickElement(saveButton);
      return true;
    }
    
    return false;
  }

  // Handle a detected cookie banner
  async function handleCookieBanner(banner) {
    if (circuitBreakerTripped) return;
    if (blockedCount >= MAX_BLOCKS) {
      console.log("Cookie Trash Rejecter: Max blocks reached. Circuit breaker tripped.");
      circuitBreakerTripped = true;
      return;
    }
    
    if (processedBanners.has(banner)) return;
    processedBanners.add(banner);
    blockedCount++;
    
    console.log("Detected cookie consent banner:", banner);
    
    // Immediately hide the banner element to avoid visual clutter
    banner.style.setProperty("display", "none", "important");
    banner.style.setProperty("opacity", "0", "important");
    banner.style.setProperty("pointer-events", "none", "important");
    
    const buttons = getButtonsRecursive(banner);
    let actionTaken = false;
    let actionDesc = "Hid banner overlay";
    
    // Get a selector description for stats details panel
    const selectorDesc = banner.id 
      ? `#${banner.id}` 
      : (banner.className && typeof banner.className === "string" && banner.className.trim()
          ? `.${banner.className.trim().split(/\s+/)[0]}` 
          : banner.tagName.toLowerCase());
    
    // 1. Search for direct reject button
    let rejectBtn = null;
    for (const btn of buttons) {
      const text = (btn.textContent || "").trim();
      if (isRejectButton(text)) {
        rejectBtn = btn;
        break;
      }
    }
    
    if (rejectBtn) {
      const btnText = rejectBtn.textContent.trim().substring(0, 25);
      console.log(`Auto-clicking Reject button: "${btnText}"`);
      clickElement(rejectBtn);
      actionTaken = true;
      actionDesc = `Clicked "${btnText}"`;
    } else {
      // 2. Search for Settings/Preferences button
      let settingsBtn = null;
      for (const btn of buttons) {
        const text = (btn.textContent || "").trim();
        if (isSettingsButton(text)) {
          settingsBtn = btn;
          break;
        }
      }
      
      if (settingsBtn) {
        const settingsApplied = await handleSettingsFlow(settingsBtn);
        actionTaken = settingsApplied;
        actionDesc = settingsApplied 
          ? "Unchecked trackers & saved" 
          : "Opened settings (no save found)";
      }
    }
    
    if (!actionTaken) {
      console.log("Could not find appropriate rejection buttons. Falling back to hiding the banner element.");
    }
    
    // Send message to background script with details
    try {
      chrome.runtime.sendMessage({ 
        action: "bannerBlocked",
        details: {
          selector: selectorDesc,
          action: actionDesc,
          timestamp: Date.now()
        }
      });
    } catch (e) {
      // Ignore extension context invalidated errors
    }
    
    // Clean up scrolling locks and overlays
    restoreScrolling();
    
    // Also run cleanup again shortly after, as some scripts wait and re-lock scroll
    setTimeout(restoreScrolling, 500);
    setTimeout(restoreScrolling, 1500);
  }

  // Determine if a node matches cookie banner heuristics
  function isCookieBanner(element) {
    if (processedBanners.has(element)) return false;
    if (element === document.body || element === document.documentElement) return false;
    
    // CMP Class/ID checks (do these first because they are definitive)
    const knownSelectors = [
      "#onetrust-consent-sdk", "#didomi-host", "#sp-consent-notice", 
      ".cookie-banner", ".cookieconsent", ".cc-window", ".cc-banner",
      "#cookiebot", "#usercentrics-root", ".cookie-consent-overlay",
      "#hs-eu-cookie-confirmation", "#cookie-law-info-bar"
    ];
    for (const selector of knownSelectors) {
      if (element.matches && element.matches(selector)) {
        return true;
      }
    }

    // Exclude major structural tags
    const tagName = element.tagName.toLowerCase();
    const isMainTag = ['main', 'article', 'header', 'footer', 'nav', 'form'].includes(tagName);
    if (isMainTag) return false;
    
    // Quick size check to skip small elements
    const rect = element.getBoundingClientRect();
    const isSpecialHost = element.id === "didomi-host" || element.id === "usercentrics-root";
    
    if (!isSpecialHost && rect.width > 0 && rect.height > 0) {
      if (rect.width < 100 || rect.height < 40) {
        return false;
      }
      // If the element's area is larger than 80% of the viewport, it's likely a page wrapper
      const windowArea = window.innerWidth * window.innerHeight;
      const elArea = rect.width * rect.height;
      if (elArea > windowArea * 0.8) {
        return false;
      }
    }
    
    const text = (element.textContent || "").toLowerCase();
    
    // If there is an excessive amount of text, this is likely a privacy policy page or full article
    if (text.length > 3000) {
      return false;
    }
    
    // Scoring matches
    const hasCookie = text.includes("cookie");
    const hasConsent = text.includes("consent");
    const hasPrivacy = text.includes("privacy");
    const hasTracking = text.includes("tracking");
    const hasGdpr = text.includes("gdpr");
    
    const score = (hasCookie ? 2 : 0) + (hasConsent ? 1.5 : 0) + (hasPrivacy ? 1 : 0) + (hasTracking ? 1 : 0) + (hasGdpr ? 1.5 : 0);
    if (score >= 2.5) {
      return true;
    }
    
    return false;
  }

  // Candidate selector to query the DOM fast
  const candidateSelector = `
    [id*="cookie" i], [class*="cookie" i],
    [id*="consent" i], [class*="consent" i],
    [id*="privacy" i], [class*="privacy" i],
    [id*="gdpr" i], [class*="gdpr" i],
    [id*="cmp" i], [class*="cmp" i],
    #onetrust-consent-sdk, #didomi-host, #sp-consent-notice,
    .cookie-banner, .cookieconsent, .cc-window, .cc-banner,
    #cookiebot, #usercentrics-root,
    [role="dialog"], [role="alertdialog"]
  `.replace(/\s+/g, " ").trim();

  // Scan element and recursively traverse shadow roots
  function checkElementAndShadow(element) {
    if (circuitBreakerTripped || !element) return;
    
    if (isCookieBanner(element)) {
      handleCookieBanner(element);
      return;
    }
    
    // Check children
    if (element.querySelectorAll) {
      try {
        const children = element.querySelectorAll(candidateSelector);
        children.forEach(child => {
          if (isCookieBanner(child)) {
            handleCookieBanner(child);
          }
        });
      } catch (e) {}
    }
    
    // Check shadow root
    if (element.shadowRoot) {
      checkElementAndShadow(element.shadowRoot);
    }
  }

  // Initial Scan
  function scanDOM() {
    if (circuitBreakerTripped || !document.body) return;
    
    // Scan body
    checkElementAndShadow(document.body);
    
    // Scan all shadow hosts in the document
    try {
      const allElements = document.body.querySelectorAll("*");
      allElements.forEach(el => {
        if (el.shadowRoot) {
          checkElementAndShadow(el.shadowRoot);
        }
      });
    } catch (e) {}
    
    restoreScrolling();
  }

  // Run as soon as DOM is ready or loading
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanDOM);
  } else {
    scanDOM();
  }
  
  // Also run on window load to catch late banners
  window.addEventListener("load", () => {
    scanDOM();
    setTimeout(scanDOM, 1000);
  });

  // Watch for mutations
  const observer = new MutationObserver((mutations) => {
    if (circuitBreakerTripped) {
      observer.disconnect();
      return;
    }
    let shouldScan = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          shouldScan = true;
          checkElementAndShadow(node);
        }
      }
    }
    if (shouldScan) {
      restoreScrolling();
    }
  });

  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
