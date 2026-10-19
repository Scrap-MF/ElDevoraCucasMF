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

console.log("cookies tests passed");
