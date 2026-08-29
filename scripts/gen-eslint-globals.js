// js/*.js (vendor chhodkar) me pariभाषित sabhi top-level var/function ikattha karke
// eslint.shared-globals.json banata hai. Nayi global var/function jodne par chalayein:
// node scripts/gen-eslint-globals.js
const fs = require("fs");
const path = require("path");
const espree = require("espree");

const jsDir = path.join(__dirname, "..", "js");
const outFile = path.join(__dirname, "..", "eslint.shared-globals.json");

const globals = new Set();
for (const f of fs.readdirSync(jsDir).filter((n) => n.endsWith(".js"))) {
  const src = fs.readFileSync(path.join(jsDir, f), "utf8");
  const ast = espree.parse(src, { ecmaVersion: 2021, sourceType: "script" });
  for (const node of ast.body) {
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((d) => {
        if (d.id.type === "Identifier") globals.add(d.id.name);
      });
    } else if (node.type === "FunctionDeclaration" && node.id) {
      globals.add(node.id.name);
    }
  }
}
fs.writeFileSync(outFile, JSON.stringify([...globals].sort(), null, 2) + "\n");
console.log("eslint.shared-globals.json अपडेट हुई — कुल", globals.size, "globals");
