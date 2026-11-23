chrome.action.onClicked.addListener(async (tab) => {
  const startURL = new URL(chrome.runtime.getURL("index.html"));
  if (tab.id != null && tab.url) {
    const url = new URL(tab.url);
    if (url.protocol === "https:" && !url.port) {
      startURL.hash = new URLSearchParams({ tab: tab.id, origin: url.origin }).toString();
    }
  }
  await chrome.tabs.create({ url: startURL.href });
});
