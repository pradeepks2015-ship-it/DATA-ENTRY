// Seoni Circle App — koi build step/framework nahi, sabhi js/*.js files ek hi global scope
// share karti hain (index.html me ek-ek karke <script defer> se load hoti hain) aur zyadatar
// top-level function index.html ke inline onclick="" se bulaye jaate hain — isliye
// no-unused-vars sirf function ke andar wale local variables par lagu hai, top-level par nahi.
const js = require("@eslint/js");
const globals = require("globals");
const noUnsanitized = require("eslint-plugin-no-unsanitized");

// js/*.js me pariभाषित sabhi top-level var/function — baaki files me istemal hote hain
const sharedGlobals = require("./eslint.shared-globals.json");

module.exports = [
  { ignores: ["js/vendor/**"] }, // third-party libraries, in kaa lint check nahi karte
  js.configs.recommended,
  {
    files: ["eslint.config.js"],
    languageOptions: { sourceType: "commonjs", ecmaVersion: 2021, globals: { ...globals.node } },
  },
  {
    // capture-screenshots.js jaisi scripts me Playwright page.waitForFunction(() => {...})
    // callbacks browser context me chalti hain, isliye document/window bhi chahiye.
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs", ecmaVersion: 2021, globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["js/**/*.js"],
    plugins: { "no-unsanitized": noUnsanitized },
    languageOptions: {
      sourceType: "script",
      ecmaVersion: 2021,
      globals: {
        ...globals.browser,
        ...Object.fromEntries(sharedGlobals.map((g) => [g, "writable"])),
        XLSX: "readonly",
        ExcelJS: "readonly",
        html2canvas: "readonly",
        L: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off",
      "no-useless-escape": "off",
      "no-misleading-character-class": "off", // ऀ-ॿ jaisi Devanagari Unicode range jaan-bujhkar hai
      // Har global yahin pariभाषित bhi hota hai — ESLint ko har definition site par "redeclare"
      // jaisa lagta hai, jabki yah is no-build-step, multi-file shared-namespace architecture
      // ka samanya pattern hai, koi asli bug nahi
      "no-redeclare": "off",
      // XSS suraksha: .innerHTML = ya insertAdjacentHTML() me kisi bhi non-literal
      // (variable-based) HTML string ko istemal karne se pehle escapeHtml()/mcJsEscape_()
      // se guzarna zaroori hai — yeh rule ab CI me automated check ke roop me lagu hai.
      "no-unsanitized/property": ["error", { escape: { methods: ["escapeHtml", "mcJsEscape_", "trustedHtml_"] } }],
      "no-unsanitized/method": ["error", { escape: { methods: ["escapeHtml", "mcJsEscape_", "trustedHtml_"] } }],
    },
  },
  {
    // page.evaluate(() => {...}) ke andar browser-context code bhi isi file me hai, jo app ke
    // global variables/functions istemal karta hai — isliye wahi sharedGlobals yahan bhi chahiye
    files: ["tests/**/*.js", "playwright.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: 2021,
      globals: {
        ...globals.node,
        ...globals.browser,
        ...Object.fromEntries(sharedGlobals.map((g) => [g, "writable"])),
        XLSX: "writable",
        ExcelJS: "writable",
        L: "writable",
      },
    },
    rules: {
      "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-redeclare": "off",
    },
  },
];
