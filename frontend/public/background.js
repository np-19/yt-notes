chrome.runtime.onInstalled.addListener(() => chrome.storage.local.get({ notes: [] }));
