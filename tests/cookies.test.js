const assert = require("node:assert/strict");
const api = require("../lib/cookies.js");

const cookies = [
  {
    domain: ".instagram.com",
    hostOnly: false,
    path: "/",
    secure: true,
    session: false,
    expirationDate: 1893456000,
    httpOnly: true,
    name: "sessionid",
    value: "abc123"
  },
  {
    domain: "example.org",
    hostOnly: true,
    path: "/",
    secure: false,
    session: true,
    httpOnly: false,
    name: "ignored",
    value: "ignored"
  }
];

const filtered = api.filterCookies(cookies, ["instagram"]);
assert.equal(filtered.length, 1);
assert.equal(filtered[0].name, "sessionid");

const netscape = api.toNetscape(filtered);
assert.match(netscape, /^# Netscape HTTP Cookie File/);
assert.match(netscape, /#HttpOnly_\.instagram\.com\tTRUE\t\/\tTRUE\t1893456000\tsessionid\tabc123/);

assert.equal(api.forceTxt("personal"), "personal.txt");
assert.equal(api.forceTxt("already.txt"), "already.txt");
assert.equal(api.forceTxt(""), "cookies.txt");

const parsed = api.parseNetscape(
  "# Netscape HTTP Cookie File\n" +
  "# This is a generated file! Do not edit.\n\n" +
  "#HttpOnly_.instagram.com\tTRUE\t/\tTRUE\t1893456000\tsessionid\tabc123\n" +
  "example.org\tFALSE\t/\tFALSE\t0\tignored\tignored\n"
);
assert.equal(parsed.cookies.length, 2);
assert.equal(parsed.cookies[0].httpOnly, true);
assert.equal(parsed.cookies[0].include_subdomains, true);
assert.equal(parsed.cookies[1].session, true);

const options = api.toCookieSetOptions(parsed.cookies[0]);
assert.equal(options.url, "https://instagram.com/");
assert.equal(options.domain, "instagram.com");
assert.equal(options.httpOnly, true);
assert.equal(options.expirationDate, 1893456000);

const hostOnlyOptions = api.toCookieSetOptions(parsed.cookies[1]);
assert.equal(hostOnlyOptions.url, "http://example.org/");
assert.equal(Object.prototype.hasOwnProperty.call(hostOnlyOptions, "domain"), false);

// B4/B5: trim + comments skipped
const parsed2 = api.parseNetscape(
  "  # stray comment  \n" +
  "#HttpOnly_.x.com\tTRUE\t/\tTRUE\t100\tname\tval\n"
);
assert.equal(parsed2.cookies.length, 1);
assert.equal(parsed2.cookies[0].domain, ".x.com");
assert.equal(parsed2.cookies[0].httpOnly, true);
assert.equal(parsed2.cookies[0].value, "val");

// B9: "all"
const allFiltered = api.filterCookies(
  [{ domain: ".instagram.com", hostOnly: false, path: "/", secure: true, session: false, expirationDate: 1, httpOnly: false, name: "n", value: "v" }],
  ["all"]
);
assert.equal(allFiltered.length, 1);

// forceTxt edge
assert.equal(api.forceTxt("<<<"), "cookies.txt");
assert.equal(api.forceTxt("___"), "cookies.txt");

// toCookieSetOptions expirationDate fallback (B3)
const opts2 = api.toCookieSetOptions({ domain: "x.com", hostOnly: true, path: "/", secure: false, expirationDate: 200, name: "n", value: "v", httpOnly: false });
assert.equal(opts2.expirationDate, 200);

// Implant-related: parse + supported domain filtering
const implantParsed = api.parseNetscape(
  "#HttpOnly_.instagram.com\tTRUE\t/\tTRUE\t100\tsessionid\tabc\n" +
  "example.org\tFALSE\t/\tFALSE\t0\tignored\tignored\n"
);
const supported = implantParsed.cookies.filter(function (c) { return api.isSupportedDomain(c.domain); });
assert.equal(supported.length, 1);
assert.equal(api.networkForDomain(supported[0].domain).id, "instagram");

// resolveSelectedNetworks (popup selection logic extracted)
assert.deepEqual(api.resolveSelectedNetworks(["instagram", "all"]), api.NETWORKS.map(function (n) { return n.id; }));
assert.deepEqual(api.resolveSelectedNetworks(["instagram", "tiktok"]), ["instagram", "tiktok"]);
assert.deepEqual(api.resolveSelectedNetworks([]), []);

// JSON format round-trip
const jsonText = api.toJSON([{ domain: ".instagram.com", hostOnly: false, path: "/", secure: true, session: false, expirationDate: 100, httpOnly: true, name: "s", value: "v", sameSite: "lax", firstPartyDomain: "instagram.com", storeId: "firefox-default" }]);
const jsonParsed = api.parseJSON(jsonText);
assert.equal(jsonParsed.cookies.length, 1);
assert.equal(jsonParsed.cookies[0].sameSite, "lax");
assert.equal(jsonParsed.cookies[0].firstPartyDomain, "instagram.com");
assert.equal(jsonParsed.cookies[0].storeId, "firefox-default");
const opts3 = api.toCookieSetOptions(jsonParsed.cookies[0]);
assert.equal(opts3.sameSite, "lax");
assert.equal(opts3.firstPartyDomain, "instagram.com");
assert.equal(opts3.storeId, "firefox-default");
assert.equal(api.forceJson("data"), "data.json");
assert.equal(api.forceJson("x.json"), "x.json");

console.log("cookies tests passed");
