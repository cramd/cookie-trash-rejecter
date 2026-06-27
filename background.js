// Service worker for Cookie Trash Rejecter

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    enabled: true,
    whitelistedDomains: [],
    totalBlocked: 0
  };
  
  const current = await chrome.storage.local.get(Object.keys(defaults));
  const updates = {};
  
  for (const [key, value] of Object.entries(defaults)) {
    if (current[key] === undefined) {
      updates[key] = value;
    }
  }
  
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
  
  console.log("Cookie Trash Rejecter installed and initialized.");
});

// Clean up tab-specific counts when tabs are closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const keys = [`tab_blocked_${tabId}`, `tab_blocked_details_${tabId}`];
  await chrome.storage.local.remove(keys);
});

// Reset tab stats when a page starts loading or navigating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    const keys = [`tab_blocked_${tabId}`, `tab_blocked_details_${tabId}`];
    await chrome.storage.local.remove(keys);
    // Clear badge text
    await chrome.action.setBadgeText({ text: "", tabId: tabId });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "bannerBlocked") {
    (async () => {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ success: false });
        return;
      }
      
      // Update global count
      const { totalBlocked = 0 } = await chrome.storage.local.get("totalBlocked");
      const newTotal = totalBlocked + 1;
      await chrome.storage.local.set({ totalBlocked: newTotal });
      
      // Update tab-specific count
      const tabKey = `tab_blocked_${tabId}`;
      const tabData = await chrome.storage.local.get(tabKey);
      const tabBlocked = (tabData[tabKey] || 0) + 1;
      await chrome.storage.local.set({ [tabKey]: tabBlocked });
      
      // Update tab-specific details list
      const tabDetailsKey = `tab_blocked_details_${tabId}`;
      const tabDetailsData = await chrome.storage.local.get(tabDetailsKey);
      const tabDetails = tabDetailsData[tabDetailsKey] || [];
      const itemDetails = message.details || {
        selector: "unknown",
        action: "blocked banner",
        timestamp: Date.now()
      };
      tabDetails.push(itemDetails);
      await chrome.storage.local.set({ [tabDetailsKey]: tabDetails });
      
      // Update badge
      await chrome.action.setBadgeText({
        text: String(tabBlocked),
        tabId: tabId
      });
      
      await chrome.action.setBadgeBackgroundColor({
        color: "#00F2FE", // Premium neon cyan badge
        tabId: tabId
      });
      
      sendResponse({ success: true, tabBlocked, totalBlocked: newTotal });
    })();
    return true; // Keep message channel open for async response
  }
});
