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

function preferredStorage() {
  return (browser.storage && browser.storage.session) ? browser.storage.session : browser.storage.local;
}

async function downloadCookies(format) {
  format = format === "json" ? "json" : "txt";
  try {
    const settings = await getSettings();
    if (!settings.shortcutEnabled) {
      return { ok: false, reason: "disabled" };
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
      return { ok: true, count: 0 };
    }

    let text;
    let filename;
    if (format === "json") {
      text = api.toJSON(filtered);
      filename = api.forceJson(settings.exportFileName.replace(/\.txt$/i, ""));
    } else {
      text = api.toNetscape(filtered);
      filename = api.forceTxt(settings.exportFileName);
    }

    if (browser.downloads && browser.downloads.download) {
      const blob = new Blob([text], { type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      let downloadId = null;
      try {
        downloadId = await browser.downloads.download({
          url: url,
          filename: filename,
          saveAs: false
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }

      const revoke = function () {
        URL.revokeObjectURL(url);
      };
      if (downloadId != null && browser.downloads.onChanged) {
        const listener = function (delta) {
          if (delta.id !== downloadId) {
            return;
          }
          if (delta.state && (delta.state.current === "complete" || delta.state.current === "interrupted")) {
            revoke();
            browser.downloads.onChanged.removeListener(listener);
          }
        };
        browser.downloads.onChanged.addListener(listener);
        setTimeout(revoke, 60000);
      } else {
        setTimeout(revoke, 10000);
      }

      try {
        await browser.action.setBadgeText({ text: "✓" });
        setTimeout(function () {
          browser.action.setBadgeText({ text: "" });
        }, 2000);
      } catch (error) {
        console.error("Badge update failed:", error);
      }
      return { ok: true, count: filtered.length };
    }

    await preferredStorage().set({
      pendingDownload: {
        text: text,
        filename: filename
      }
    });
    await browser.tabs.create({ url: browser.runtime.getURL("options/options.html?download=1") });
    return { ok: true, count: filtered.length };
  } catch (error) {
    console.error("Shortcut download failed:", error);
    throw error;
  }
}

browser.commands.onCommand.addListener(function (command) {
  if (command === "download-cookies") {
    downloadCookies("txt").catch(function (error) {
      console.error("Shortcut download failed:", error);
    });
  } else if (command === "download-cookies-json") {
    downloadCookies("json").catch(function (error) {
      console.error("Shortcut download failed:", error);
    });
  }
});

browser.runtime.onMessage.addListener(function (message) {
  if (message && message.type === "download-cookies") {
    return downloadCookies("txt")
      .then(function (result) {
        return result || { ok: true };
      })
      .catch(function (error) {
        console.error("Manual download trigger failed:", error);
        return { ok: false, error: String(error && error.message ? error.message : error) };
      });
  }
  if (message && message.type === "download-cookies-json") {
    return downloadCookies("json")
      .then(function (result) {
        return result || { ok: true };
      })
      .catch(function (error) {
        console.error("Manual download trigger failed:", error);
        return { ok: false, error: String(error && error.message ? error.message : error) };
      });
  }
  return false;
});

if (browser.runtime && browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(function () {
    try {
      browser.storage.local.remove("pendingDownload");
    } catch (error) {
      console.error("Could not clear pending download:", error);
    }
    if (browser.storage.session) {
      try {
        browser.storage.session.remove("pendingDownload");
      } catch (error) {
        console.error("Could not clear pending download:", error);
      }
    }
  });
}