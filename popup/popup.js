// Popup Interactive Logic for Cookie Trash Rejecter

document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
  const globalToggle = document.getElementById("global-toggle");
  const globalStatus = document.getElementById("global-status");
  const domainToggle = document.getElementById("domain-toggle");
  const currentDomainEl = document.getElementById("current-domain");
  const pageBlockedCountEl = document.getElementById("page-blocked-count");
  const totalBlockedCountEl = document.getElementById("total-blocked-count");
  const reloadTabBtn = document.getElementById("reload-tab-btn");
  const reportSiteBtn = document.getElementById("report-site-btn");
  const popupContainer = document.querySelector(".popup-container");
  
  // Details Panel elements
  const pageStatBox = document.getElementById("page-stat-box");
  const detailsPanel = document.getElementById("details-panel");
  const detailsList = document.getElementById("details-list");
  const closeDetailsBtn = document.getElementById("close-details-btn");

  let activeTab = null;
  let activeHostname = "";

  // 1. Get active tab details
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTab = tab;
      const url = new URL(tab.url);
      activeHostname = url.hostname;
      currentDomainEl.textContent = activeHostname || "unknown domain";
    } else {
      // Disable domain toggle if tab URL is inaccessible (e.g. chrome://)
      document.getElementById("domain-control").style.opacity = "0.5";
      domainToggle.disabled = true;
      currentDomainEl.textContent = "restricted page";
    }
  } catch (e) {
    console.error("Error reading tab info:", e);
    currentDomainEl.textContent = "restricted page";
  }

  // 2. Fetch and render storage data
  const data = await chrome.storage.local.get([
    "enabled",
    "whitelistedDomains",
    "totalBlocked"
  ]);

  const globalEnabled = data.enabled !== false; // Default true
  const whitelistedDomains = data.whitelistedDomains || [];
  const totalBlocked = data.totalBlocked || 0;

  // Set Global toggle state
  globalToggle.checked = globalEnabled;
  updateGlobalStatus(globalEnabled);

  // Set Domain toggle state
  if (activeHostname) {
    const isWhitelisted = whitelistedDomains.some(domain => 
      activeHostname === domain || activeHostname.endsWith("." + domain)
    );
    // Checked if NOT whitelisted (meaning protection is ACTIVE on this site)
    domainToggle.checked = !isWhitelisted;
  }

  // Set Total Blocked count
  animateNumber(totalBlockedCountEl, totalBlocked);

  // Set Tab specific count
  if (activeTab) {
    const tabKey = `tab_blocked_${activeTab.id}`;
    const tabData = await chrome.storage.local.get(tabKey);
    const tabBlocked = tabData[tabKey] || 0;
    animateNumber(pageBlockedCountEl, tabBlocked);
  } else {
    pageBlockedCountEl.textContent = "0";
  }

  // 3. Event Listeners
  
  // Toggle Global Blocker
  globalToggle.addEventListener("change", async () => {
    const isEnabled = globalToggle.checked;
    await chrome.storage.local.set({ enabled: isEnabled });
    updateGlobalStatus(isEnabled);
    showToast(isEnabled ? "Protection activated globally" : "Protection paused globally");
  });

  // Toggle Domain specific Blocker
  domainToggle.addEventListener("change", async () => {
    if (!activeHostname) return;

    const isActiveOnSite = domainToggle.checked;
    const currentData = await chrome.storage.local.get("whitelistedDomains");
    let list = currentData.whitelistedDomains || [];

    if (isActiveOnSite) {
      // Enable protection -> Remove from whitelist
      list = list.filter(domain => domain !== activeHostname);
      showToast(`Blocker active on ${activeHostname}`);
    } else {
      // Disable protection -> Add to whitelist
      if (!list.includes(activeHostname)) {
        list.push(activeHostname);
      }
      showToast(`Blocker disabled on ${activeHostname}`);
    }

    await chrome.storage.local.set({ whitelistedDomains: list });
  });

  // Reload page
  reloadTabBtn.addEventListener("click", () => {
    if (activeTab && activeTab.id) {
      chrome.tabs.reload(activeTab.id);
      window.close(); // Close extension popup
    }
  });

  // Report Site
  reportSiteBtn.addEventListener("click", () => {
    showToast("Report submitted! We'll adjust heuristics.");
    reportSiteBtn.disabled = true;
    reportSiteBtn.style.opacity = "0.5";
  });

  // Toggle Page Blocked Details Panel
  pageStatBox.addEventListener("click", async () => {
    const isShowing = detailsPanel.classList.contains("show");
    if (isShowing) {
      detailsPanel.classList.remove("show");
    } else {
      await renderBlockedDetails();
      detailsPanel.classList.add("show");
    }
  });

  closeDetailsBtn.addEventListener("click", () => {
    detailsPanel.classList.remove("show");
  });

  // Render list of blocked selectors and actions
  async function renderBlockedDetails() {
    detailsList.innerHTML = "";
    
    if (!activeTab) {
      detailsList.innerHTML = '<div class="details-empty">Unavailable on this page</div>';
      return;
    }
    
    const tabDetailsKey = `tab_blocked_details_${activeTab.id}`;
    const tabData = await chrome.storage.local.get(tabDetailsKey);
    const details = tabData[tabDetailsKey] || [];
    
    if (details.length === 0) {
      detailsList.innerHTML = '<div class="details-empty">No banners blocked on this page</div>';
      return;
    }
    
    // Sort details: newest first
    const sortedDetails = [...details].reverse();
    
    sortedDetails.forEach(item => {
      const itemEl = document.createElement("div");
      itemEl.className = "details-item";
      
      const selectorSpan = document.createElement("span");
      selectorSpan.className = "item-selector";
      selectorSpan.textContent = item.selector || "unknown";
      
      const actionSpan = document.createElement("span");
      actionSpan.className = "item-action";
      actionSpan.textContent = item.action || "blocked";
      
      itemEl.appendChild(selectorSpan);
      itemEl.appendChild(actionSpan);
      detailsList.appendChild(itemEl);
    });
  }

  // Helper: Update Global label
  function updateGlobalStatus(isEnabled) {
    if (isEnabled) {
      globalStatus.textContent = "Active";
      globalStatus.classList.remove("paused");
    } else {
      globalStatus.textContent = "Paused";
      globalStatus.classList.add("paused");
    }
  }

  // Helper: Number Counter Animation
  function animateNumber(element, target) {
    let start = 0;
    const duration = 800; // ms
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const value = Math.floor(start + (target - start) * progress * (2 - progress));
      element.textContent = String(value);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = String(target);
      }
    }

    requestAnimationFrame(update);
  }

  // Helper: Show Beautiful Custom Toast Notification
  function showToast(message) {
    // Remove existing toast if present
    const existing = document.querySelector(".toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    // Append styles directly for convenience and reliability
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "70px",
      left: "50%",
      transform: "translateX(-50%) translateY(20px)",
      background: "rgba(18, 20, 29, 0.95)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      color: "#ffffff",
      padding: "8px 16px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: "500",
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)",
      zIndex: "1000",
      pointerEvents: "none",
      opacity: "0",
      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      whiteSpace: "nowrap",
      textAlign: "center"
    });

    document.body.appendChild(toast);

    // Trigger animate-in
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });

    // Auto-remove after 2 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(10px)";
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2000);
  }
});
