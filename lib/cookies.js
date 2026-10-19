(function (global) {
  "use strict";

  const NETWORKS = [
    { id: "instagram", label: "Instagram", domains: ["instagram.com"] },
    { id: "tiktok", label: "TikTok", domains: ["tiktok.com"] },
    { id: "twitter", label: "Twitter/X", domains: ["twitter.com", "x.com"] },
    { id: "vsco", label: "VSCO", domains: ["vsco.co"] },
    { id: "threads", label: "Threads", domains: ["threads.com", "threads.net"] },
    { id: "facebook", label: "Facebook", domains: ["facebook.com", "fb.com", "m.facebook.com"] }
  ];

  function normalizeDomain(domain) {
    return String(domain || "").replace(/^\./, "").toLowerCase();
  }

  function isSupportedDomain(domain) {
    const normalized = normalizeDomain(domain);
    return NETWORKS.some(function (network) {
      return network.domains.some(function (siteDomain) {
        return normalized === siteDomain || normalized.endsWith("." + siteDomain);
      });
    });
  }

  function networkForDomain(domain) {
    const normalized = normalizeDomain(domain);
    return NETWORKS.find(function (network) {
      return network.domains.some(function (siteDomain) {
        return normalized === siteDomain || normalized.endsWith("." + siteDomain);
      });
    });
  }

  function selectedDomains(selectedIds) {
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    const domains = [];
    NETWORKS.forEach(function (network) {
      if (ids.indexOf(network.id) !== -1) {
        network.domains.forEach(function (domain) {
          if (domains.indexOf(domain) === -1) {
            domains.push(domain);
          }
        });
      }
    });
    return domains;
  }

  function filterCookies(cookies, selectedIds) {
    const domains = selectedDomains(selectedIds);
    if (domains.length === 0) {
      return [];
    }
    return (cookies || []).filter(function (cookie) {
      const normalized = normalizeDomain(cookie.domain);
      return domains.some(function (domain) {
        return normalized === domain || normalized.endsWith("." + domain);
      });
    });
  }

  function sanitizeField(value) {
    return String(value == null ? "" : value).replace(/[\t\r\n]/g, " ");
  }

  function toNetscape(cookies) {
    const lines = [
      "# Netscape HTTP Cookie File",
      "# This is a generated file! Do not edit.",
      ""
    ];

    const sorted = (cookies || []).slice().sort(function (a, b) {
      const domainCompare = String(a.domain).localeCompare(String(b.domain));
      if (domainCompare !== 0) {
        return domainCompare;
      }
      const pathCompare = String(a.path).localeCompare(String(b.path));
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return String(a.name).localeCompare(String(b.name));
    });

    sorted.forEach(function (cookie) {
      const domain = sanitizeField(cookie.domain);
      const includeSubdomains = cookie.hostOnly ? "FALSE" : "TRUE";
      const path = sanitizeField(cookie.path || "/");
      const secure = cookie.secure ? "TRUE" : "FALSE";
      const expires = cookie.session ? 0 : Math.floor(cookie.expirationDate || cookie.expires || 0);
      const name = sanitizeField(cookie.name);
      const value = sanitizeField(cookie.value);
      const prefix = cookie.httpOnly ? "#HttpOnly_" : "";
      lines.push(prefix + domain + "\t" + includeSubdomains + "\t" + path + "\t" +
        secure + "\t" + expires + "\t" + name + "\t" + value);
    });

    return lines.join("\n") + "\n";
  }

  function parseNetscape(content) {
    const cookies = [];
    const errors = [];

    String(content || "").split(/\r?\n/).forEach(function (rawLine) {
      const line = rawLine.replace(/\r$/, "");
      if (line.trim() === "" || line.indexOf("# ") === 0) {
        return;
      }

      let httpOnly = false;
      let cookieLine = line;
      if (cookieLine.indexOf("#HttpOnly_") === 0) {
        httpOnly = true;
        cookieLine = cookieLine.slice("#HttpOnly_".length);
      }

      const fields = cookieLine.split("\t");
      if (fields.length !== 7) {
        errors.push("Malformed cookie line: " + line);
        return;
      }
      if (fields[5].trim() === "") {
        errors.push("Cookie line without a name: " + line);
        return;
      }

      const expires = Number(fields[4].trim());
      if (!Number.isFinite(expires)) {
        errors.push("Invalid expiration value: " + line);
        return;
      }

      cookies.push({
        domain: fields[0],
        include_subdomains: fields[1] === "TRUE",
        hostOnly: fields[1] !== "TRUE",
        path: fields[2] || "/",
        secure: fields[3] === "TRUE",
        expires: expires,
        expirationDate: expires > 0 ? expires : undefined,
        session: expires === 0,
        name: fields[5],
        value: fields[6],
        httpOnly: httpOnly
      });
    });

    return {
      cookies: cookies,
      errors: errors
    };
  }

  function toCookieSetOptions(cookie) {
    const domain = normalizeDomain(cookie.domain);
    const secure = !!cookie.secure;
    const path = cookie.path || "/";
    const url = (secure ? "https://" : "http://") + domain + (path === "/" ? "/" : path);
    const details = {
      url: url,
      name: cookie.name,
      value: cookie.value,
      path: path,
      secure: secure,
      httpOnly: !!cookie.httpOnly
    };

    if (cookie.include_subdomains) {
      details.domain = domain;
    }
    if (cookie.expires && cookie.expires > 0) {
      details.expirationDate = cookie.expires;
    }

    return details;
  }

  function forceTxt(filename) {
    let name = String(filename == null ? "" : filename).trim();
    if (name === "") {
      name = "cookies";
    }
    name = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    if (!/\.txt$/i.test(name)) {
      name += ".txt";
    }
    return name;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the legacy copy path.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  }

  const api = {
    NETWORKS: NETWORKS,
    isSupportedDomain: isSupportedDomain,
    networkForDomain: networkForDomain,
    selectedDomains: selectedDomains,
    filterCookies: filterCookies,
    toNetscape: toNetscape,
    parseNetscape: parseNetscape,
    toCookieSetOptions: toCookieSetOptions,
    forceTxt: forceTxt,
    downloadText: downloadText,
    copyText: copyText
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.ElDevoraCucas = api;
})(typeof self !== "undefined" ? self : globalThis);
