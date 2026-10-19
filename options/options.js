"use strict";

const api = globalThis.ElDevoraCucas;
const cookieTextInput = document.getElementById("cookie-text");
const cookieFileInput = document.getElementById("cookie-file");
const pasteButton = document.getElementById("paste-clipboard");
const implantButton = document.getElementById("implant");
const dropZone = document.getElementById("drop-zone");
const status = document.getElementById("import-status");

const implantLabel = implantButton.textContent;
const pasteLabel = pasteButton.textContent;

function setButtonState(button, state, label) {
  button.classList.remove("is-loading", "is-success", "is-error");
  if (state) {
    button.classList.add("is-" + state);
  }
  button.disabled = state === "loading";
  if (label) {
    button.textContent = label;
  }
}

function resetButton(button, label, delay) {
  setTimeout(function () {
    setButtonState(button, null, label);
  }, delay || 2000);
}

async function readClipboardCandidates() {
  const candidates = [];

  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim() !== "") {
      candidates.push(text);
    }
  } catch (error) {
    // Fall through to the richer clipboard read API.
  }

  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          try {
            const blob = await item.getType(type);
            const text = await blob.text();
            if (text && text.trim() !== "") {
              candidates.push(text);
            }
          } catch (error) {
            // Ignore types that cannot be read as text.
          }
        }
      }
    }
  } catch (error) {
    console.error("Clipboard read failed:", error);
  }

  return candidates;
}

function chooseClipboardText(candidates) {
  const valid = candidates.find(function (text) {
    return api.parseNetscape(text).cookies.length > 0;
  });
  return valid || candidates[0] || null;
}

async function getImportText() {
  if (cookieTextInput && cookieTextInput.value.trim() !== "") {
    return cookieTextInput.value;
  }

  const file = cookieFileInput.files && cookieFileInput.files[0];
  if (file) {
    return await file.text();
  }

  return null;
}

if (pasteButton) {
  pasteButton.addEventListener("click", async function () {
    setButtonState(pasteButton, "loading", "Pasting...");
    const candidates = await readClipboardCandidates();
    const text = chooseClipboardText(candidates);
    if (!text) {
      setButtonState(pasteButton, "error", "Failed");
      status.textContent = "Clipboard does not contain cookie text.";
      resetButton(pasteButton, pasteLabel);
      return;
    }
    if (cookieTextInput) {
      cookieTextInput.value = text;
    }
    const parsed = api.parseNetscape(text);
    setButtonState(pasteButton, "success", "Pasted");
    status.textContent = "Pasted " + parsed.cookies.length + " cookies from the clipboard.";
    resetButton(pasteButton, pasteLabel);
  });
}

if (dropZone) {
  dropZone.addEventListener("dragover", function (event) {
    event.preventDefault();
    dropZone.classList.add("is-dragover");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("is-dragover");
  });

  dropZone.addEventListener("drop", async function (event) {
    event.preventDefault();
    dropZone.classList.remove("is-dragover");

    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) {
      try {
        const text = await file.text();
        if (cookieTextInput) {
          cookieTextInput.value = text;
        }
        const parsed = api.parseNetscape(text);
        status.textContent = "Dropped " + file.name + " (" + parsed.cookies.length + " cookies).";
      } catch (error) {
        status.textContent = "Could not read dropped file.";
        console.error("Drop read failed:", error);
      }
      return;
    }

    const text = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
    if (text && text.trim() !== "") {
      if (cookieTextInput) {
        cookieTextInput.value = text;
      }
      const parsed = api.parseNetscape(text);
      status.textContent = "Dropped text (" + parsed.cookies.length + " cookies).";
    } else {
      status.textContent = "Drop a cookies.txt file here.";
    }
  });
}

implantButton.addEventListener("click", async function () {
  const text = await getImportText();
  if (!text) {
    status.textContent = "Paste cookie text or select a cookie file first.";
    setButtonState(implantButton, "error", "Failed");
    resetButton(implantButton, implantLabel);
    return;
  }

  setButtonState(implantButton, "loading", "Implanting...");
  try {
    const parsed = api.parseNetscape(text);
    const supported = parsed.cookies.filter(function (cookie) {
      return api.isSupportedDomain(cookie.domain);
    });

    if (parsed.cookies.length === 0) {
      throw new Error("No valid Netscape cookies found. " + (parsed.errors.length ? parsed.errors[0] : ""));
    }
    if (supported.length === 0) {
      throw new Error("No supported-network cookies found in the file.");
    }

    let success = 0;
    let failed = 0;
    let firstError = "";
    for (const cookie of supported) {
      try {
        const result = await browser.cookies.set(api.toCookieSetOptions(cookie));
        console.log("Implanted cookie:", cookie.domain, cookie.name, result);
        success += 1;
      } catch (error) {
        failed += 1;
        if (!firstError) {
          firstError = (error && error.message) ? error.message : String(error);
        }
        console.error("Failed to implant cookie:", cookie.domain, cookie.name, error);
      }
    }

    if (cookieFileInput) {
      cookieFileInput.value = "";
    }

    if (failed === 0) {
      setButtonState(implantButton, "success", "Implanted");
      status.textContent = "Implanted " + success + " cookies.";
      window.alert("Implanted " + success + " cookies.");
    } else if (success > 0) {
      setButtonState(implantButton, "success", "Partial");
      status.textContent = "Implanted " + success + " cookies; " + failed + " failed. First error: " + firstError;
      window.alert("Implanted " + success + " cookies; " + failed + " failed.\nFirst error: " + firstError);
    } else {
      setButtonState(implantButton, "error", "Failed");
      status.textContent = "Failed to implant cookies. First error: " + firstError;
      window.alert("Failed to implant cookies.\nFirst error: " + firstError);
    }
  } catch (error) {
    setButtonState(implantButton, "error", "Failed");
    const message = error && error.message ? error.message : "Failed to implant cookies.";
    status.textContent = message;
    console.error("Implant failed:", error);
    window.alert(message);
  }

  resetButton(implantButton, implantLabel);
});

const shortcutValue = document.getElementById("shortcut-value");
const shortcutEnabledInput = document.getElementById("shortcut-enabled");
const changeShortcutButton = document.getElementById("change-shortcut");

async function loadShortcutSettings() {
  if (!shortcutValue) {
    return;
  }

  try {
    const commands = await browser.commands.getAll();
    const command = commands.find(function (item) {
      return item.name === "download-cookies";
    });
    shortcutValue.textContent = "Current shortcut: " + (command && command.shortcut ? command.shortcut : "not set");
  } catch (error) {
    shortcutValue.textContent = "Current shortcut: unavailable";
    console.error("Could not read shortcut:", error);
  }

  const result = await browser.storage.local.get("shortcutEnabled");
  if (shortcutEnabledInput) {
    shortcutEnabledInput.checked = result.shortcutEnabled !== false;
  }
}

if (shortcutEnabledInput) {
  shortcutEnabledInput.addEventListener("change", function () {
    browser.storage.local.set({ shortcutEnabled: shortcutEnabledInput.checked }).catch(function (error) {
      console.error("Could not save shortcut setting:", error);
    });
  });
}

const testShortcutButton = document.getElementById("test-shortcut");
if (testShortcutButton) {
  testShortcutButton.addEventListener("click", async function () {
    status.textContent = "Testing download...";
    try {
      const response = await browser.runtime.sendMessage({ type: "download-cookies" });
      if (response && response.ok) {
        status.textContent = "Test download completed.";
      } else {
        status.textContent = "Test download failed: " + (response && response.error ? response.error : "unknown error");
      }
    } catch (error) {
      status.textContent = "Test download failed: " + (error && error.message ? error.message : String(error));
      console.error("Test download failed:", error);
    }
  });
}

if (changeShortcutButton) {
  changeShortcutButton.addEventListener("click", function () {
    browser.tabs.create({ url: "about:addons" }).catch(function (error) {
      console.error("Could not open shortcut settings:", error);
      window.alert("Open Firefox Settings > Add-ons and Themes > Manage Extension Shortcuts to change the shortcut.");
    });
  });
}

async function handlePendingDownload() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("download") !== "1") {
    return;
  }

  const result = await browser.storage.local.get("pendingDownload");
  const pending = result.pendingDownload;
  if (!pending || !pending.text) {
    return;
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([pending.text], { type: "text/plain;charset=utf-8" }));
  link.download = pending.filename || "cookies.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
  }, 1000);

  await browser.storage.local.remove("pendingDownload");
  if (status) {
    status.textContent = "Downloaded " + (pending.filename || "cookies.txt") + " from shortcut.";
  }
}

loadShortcutSettings().catch(function (error) {
  console.error("Could not load shortcut settings:", error);
});

handlePendingDownload().catch(function (error) {
  console.error("Could not handle pending download:", error);
});
