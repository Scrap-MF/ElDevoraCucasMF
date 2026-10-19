"use strict";

document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.shiftKey && event.key === "F12" && !event.altKey && !event.metaKey) {
    event.preventDefault();
    browser.runtime.sendMessage({ type: "download-cookies" }).catch(function (error) {
      console.error("Content-script download trigger failed:", error);
    });
  }
}, true);
