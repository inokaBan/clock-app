/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

module.exports = function (ctx) {
  const projectRoot = ctx && ctx.opts && ctx.opts.projectRoot ? ctx.opts.projectRoot : process.cwd();
  const gradleFile = path.join(
    projectRoot,
    "platforms",
    "android",
    "cordova-plugin-local-notification",
    "app-localnotification.gradle"
  );

  if (!fs.existsSync(gradleFile)) {
    return;
  }

  const src = fs.readFileSync(gradleFile, "utf8");
  const next = src.replace(/(^\s*)compile(\s+|\()/gm, (match, indent, suffix) => {
    return `${indent}implementation${suffix}`;
  });

  if (next !== src) {
    fs.writeFileSync(gradleFile, next, "utf8");
    console.log("Patched cordova-plugin-local-notification to use implementation() dependencies.");
  }
};
