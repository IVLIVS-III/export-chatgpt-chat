chrome.runtime.onInstalled.addListener(() => {
});

const chatgpt = 'https://chatgpt.com';

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith(chatgpt)) {
    await chrome.scripting.insertCSS({
    files: ["message.css"],
    target: { tabId: tab.id },
    });
    // Insert the JS file when the user turns the extension on
    await chrome.scripting.executeScript({
    files: ["export.js"],
    target: { tabId: tab.id },
    });
    await chrome.scripting.removeCSS({
    files: ["message.css"],
    target: { tabId: tab.id },
    });
  }
});
