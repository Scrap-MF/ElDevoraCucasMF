"use strict";

const api = globalThis.ElDevoraCucas;

async function getSettings() {
  const result = await browser.storage.local.get(["selectedNetworks", "exportFileName", "shortcutEnabled"]);
  let selectedNetworks = Array.isArray(result.selectedNetworks) ? result.selectedNetworks.slice() : [];
  if (selectedNetworks.length === 0 || selectedNetworks.indexOf("all") !== -1) {
    selectedNetworks = api.NETWORKS.map(function (network) {
      return network.id;
    });
  }
  selectedNetworks = selectedNetworks.filter(function (id) {
    return id !== "all";
  });

  return {
    selectedNetworks: selectedNetworks,
    exportFileName: result.exportFileName || "cookies",
    shortcutEnabled: result.shortcutEnabled !== false
  };
}

async function downloadCookies() {
  try {
    const settings = await getSettings();
    if (!settings.shortcutEnabled) {
      return;
    }

    const cookies = await browser.cookies.getAll({});
    const filtered = api.filterCookies(cookies, settings.selectedNetworks);
    if (filtered.length === 0) {
      try {
        await browser.action.setBadgeText({ text: "0" });
        setTimeout(function () {
          browser.action.setBadgeText({ text: "" });
        }, 2000);
      } catch (error) {
        console.error("Badge update failed:", error);
      }
      return;
    }

    const text = api.toNetscape(filtered);
    const filename = api.forceTxt(settings.exportFileName);

    if (browser.downloads && browser.downloads.download) {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      await browser.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 10000);

      try {
        await browser.action.setBadgeText({ text: "✓" });
        setTimeout(function () {
          browser.action.setBadgeText({ text: "" });
        }, 2000);
      } catch (error) {
        console.error("Badge update failed:", error);
      }
      return;
    }

    await browser.storage.local.set({
      pendingDownload: {
        text: text,
        filename: filename
      }
    });
    await browser.tabs.create({ url: browser.runtime.getURL("options/options.html?download=1") });
  } catch (error) {
    console.error("Shortcut download failed:", error);
    throw error;
  }
}

browser.commands.onCommand.addListener(function (command) {
  if (command === "download-cookies") {
    downloadCookies().catch(function (error) {
      console.error("Shortcut download failed:", error);
    });
  }
});

browser.runtime.onMessage.addListener(function (message) {
  if (message && message.type === "download-cookies") {
    return downloadCookies()
      .then(function () {
        return { ok: true };
      })
      .catch(function (error) {
        console.error("Manual download trigger failed:", error);
        return { ok: false, error: String(error && error.message ? error.message : error) };
      });
  }
  return false;
});
