"use strict";

const api = globalThis.ElDevoraCucas;
const networkInputs = Array.from(document.querySelectorAll(".dropdown-panel input[type='checkbox']"));
const allNetworksInput = document.querySelector(".dropdown-panel input[value='all']");
const networkSummary = document.getElementById("network-summary");
const exportFileNameInput = document.getElementById("export-file-name");
const exportStatus = document.getElementById("export-status");

const exportButton = document.getElementById("download");
const copyButton = document.getElementById("copy");
const openImplantButton = document.getElementById("open-implant");
const exportLabel = exportButton.textContent;
const copyLabel = copyButton.textContent;

function selectedNetworks() {
  const values = networkInputs
    .filter(function (input) {
      return input.checked;
    })
    .map(function (input) {
      return input.value;
    });

  if (values.indexOf("all") !== -1) {
    return api.NETWORKS.map(function (network) {
      return network.id;
    });
  }

  return values.filter(function (value) {
    return value !== "all";
  });
}

function updateSummary() {
  const networks = selectedNetworks();
  if (networks.length === api.NETWORKS.length) {
    networkSummary.textContent = "Networks (all selected)";
  } else if (networks.length === 0) {
    networkSummary.textContent = "Networks (none selected)";
  } else {
    networkSummary.textContent = "Networks (" + networks.length + " selected)";
  }
  updateActionButtons();
}

function updateActionButtons() {
  const disabled = selectedNetworks().length === 0;
  if (exportButton) {
    exportButton.disabled = disabled;
  }
  if (copyButton) {
    copyButton.disabled = disabled;
  }
}

const SELECTED_NETWORKS_KEY = "selectedNetworks";
const EXPORT_FILE_NAME_KEY = "exportFileName";

async function loadPreferences() {
  const result = await browser.storage.local.get([SELECTED_NETWORKS_KEY, EXPORT_FILE_NAME_KEY]);
  const stored = Array.isArray(result[SELECTED_NETWORKS_KEY]) ? result[SELECTED_NETWORKS_KEY] : null;
  let ids = stored && stored.length ? stored.slice() : api.NETWORKS.map(function (network) {
    return network.id;
  });

  if (ids.indexOf("all") !== -1) {
    ids = api.NETWORKS.map(function (network) {
      return network.id;
    });
  }
  ids = ids.filter(function (id) {
    return id !== "all";
  });

  networkInputs.forEach(function (input) {
    if (input.value !== "all") {
      input.checked = ids.indexOf(input.value) !== -1;
    }
  });

  if (allNetworksInput) {
    allNetworksInput.checked = ids.length === api.NETWORKS.length;
  }
  if (result[EXPORT_FILE_NAME_KEY]) {
    exportFileNameInput.value = result[EXPORT_FILE_NAME_KEY];
  }
  updateSummary();
  updateActionButtons();
}

function savePreferences() {
  const ids = selectedNetworks();
  browser.storage.local.set({
    selectedNetworks: ids,
    exportFileName: exportFileNameInput.value
  }).catch(function (error) {
    console.error("Could not save preferences:", error);
  });
}

function setAllNetworks(checked) {
  networkInputs.forEach(function (input) {
    input.checked = checked;
  });
  updateSummary();
}

if (allNetworksInput) {
  allNetworksInput.addEventListener("change", function () {
    setAllNetworks(allNetworksInput.checked);
    savePreferences();
  });
}

networkInputs.forEach(function (input) {
  if (input === allNetworksInput) {
    return;
  }
  input.addEventListener("change", function () {
    const allChecked = networkInputs
      .filter(function (item) {
        return item !== allNetworksInput;
      })
      .every(function (item) {
        return item.checked;
      });

    if (allNetworksInput) {
      allNetworksInput.checked = allChecked;
    }
    updateSummary();
    savePreferences();
  });
});

updateSummary();

if (exportFileNameInput) {
  exportFileNameInput.addEventListener("input", savePreferences);
}

loadPreferences().catch(function (error) {
  console.error("Could not load preferences:", error);
});

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

async function exportCookies() {
  const networks = selectedNetworks();
  if (networks.length === 0) {
    exportStatus.textContent = "Select at least one network.";
    return null;
  }

  const cookies = await browser.cookies.getAll({});
  const filtered = api.filterCookies(cookies, networks);

  if (filtered.length === 0) {
    exportStatus.textContent = "No cookies found for the selected networks.";
    return null;
  }

  return {
    text: api.toNetscape(filtered),
    count: filtered.length
  };
}

exportButton.addEventListener("click", async function () {
  setButtonState(exportButton, "loading", "Downloading...");
  const result = await exportCookies();
  if (!result) {
    setButtonState(exportButton, "error", "Failed");
    resetButton(exportButton, exportLabel);
    return;
  }

  const filename = api.forceTxt(exportFileNameInput.value);
  api.downloadText(filename, result.text);
  await new Promise(function (resolve) {
    setTimeout(resolve, 1200);
  });
  setButtonState(exportButton, "success", "Downloaded");
  exportStatus.textContent = "Downloaded " + filename + " (" + result.count + " cookies).";
  resetButton(exportButton, exportLabel);
});

copyButton.addEventListener("click", async function () {
  const result = await exportCookies();
  if (!result) {
    setButtonState(copyButton, "error", "Failed");
    resetButton(copyButton, copyLabel);
    return;
  }

  const copied = await api.copyText(result.text);
  if (copied) {
    setButtonState(copyButton, "success", "Copied");
    exportStatus.textContent = "Copied " + result.count + " cookies to the clipboard.";
  } else {
    setButtonState(copyButton, "error", "Failed");
    exportStatus.textContent = "Could not copy cookies to the clipboard.";
  }
  resetButton(copyButton, copyLabel);
});

if (openImplantButton) {
  openImplantButton.addEventListener("click", function () {
    if (browser.runtime && browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
    }
  });
}

