// electron-builder afterPack: drop usage strings Electron's template plist
// declares for hardware this app never touches. A scanner or reviewer
// otherwise sees microphone + camera + Bluetooth declared; we only use the
// microphone (declared honestly via extendInfo).
const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const plist = path.join(context.appOutDir, appName, "Contents", "Info.plist");
  for (const key of ["NSCameraUsageDescription", "NSBluetoothAlwaysUsageDescription", "NSBluetoothPeripheralUsageDescription"]) {
    try { execFileSync("/usr/bin/plutil", ["-remove", key, plist], { stdio: "ignore" }); } catch { /* key absent */ }
  }
};
