#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();

function readJson(relativePath){
  const fullPath = path.join(projectRoot, relativePath);
  const raw = fs.readFileSync(fullPath, "utf8");
  return { fullPath, data: JSON.parse(raw) };
}

function writeJson({ fullPath, data }){
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseVersion(version){
  const [major = "1", minor = "0", patch = "0"] = String(version || "1.0.0").split(".");
  return {
    major: Number.parseInt(major, 10) || 1,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}

function computePatchIncrement(){
  const countRaw = execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
  const commitCount = Number.parseInt(countRaw, 10) || 0;
  return commitCount + 1;
}

function main(){
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");

  const current = parseVersion(packageJson.data.version);
  const patch = computePatchIncrement();
  const newVersion = `${current.major}.${current.minor}.${patch}`;

  if (packageJson.data.version === newVersion){
    console.log(`Version already up to date (${newVersion}).`);
    return;
  }

  packageJson.data.version = newVersion;
  writeJson(packageJson);

  if (packageLock.data.version){
    packageLock.data.version = newVersion;
  }
  if (packageLock.data.packages && packageLock.data.packages[""]){
    packageLock.data.packages[""].version = newVersion;
  }
  writeJson(packageLock);

  console.log(`Version bumped to ${newVersion}`);
}

main();
