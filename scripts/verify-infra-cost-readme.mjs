#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function parseLines(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedFiles() {
  const changed = new Set();

  for (const file of parseLines(run("git diff --name-only"))) {
    changed.add(file);
  }

  for (const file of parseLines(run("git diff --name-only --cached"))) {
    changed.add(file);
  }

  const baseRef = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : process.env.COST_CHECK_BASE_REF || "";

  if (baseRef) {
    for (const file of parseLines(run(`git diff --name-only ${baseRef}...HEAD`))) {
      changed.add(file);
    }
  }

  return [...changed];
}

function isInfraCodePath(filePath) {
  if (!filePath.startsWith("infra/")) return false;
  if (filePath === "infra/README.md") return false;
  if (filePath.endsWith(".md")) return false;
  return true;
}

function extractReviewMarker(content) {
  const match = content.match(/Cost estimate last reviewed:\s*(\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : null;
}

function readCurrentReadme() {
  return run("cat infra/README.md");
}

function readBaseReadme() {
  const baseRef = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : process.env.COST_CHECK_BASE_REF || "";

  if (!baseRef) return "";
  return run(`git show ${baseRef}:infra/README.md`);
}

const changedFiles = getChangedFiles();
const infraCodeChanged = changedFiles.some(isInfraCodePath);

if (!infraCodeChanged) {
  console.log("No infrastructure code changes detected. Cost estimate guard passed.");
  process.exit(0);
}

const readmeChanged = changedFiles.includes("infra/README.md");
if (!readmeChanged) {
  console.error("Infrastructure files changed but infra/README.md was not updated.");
  console.error("Please update the cost estimate section and the review date marker.");
  process.exit(1);
}

const currentReadme = readCurrentReadme();
const currentMarker = extractReviewMarker(currentReadme);

if (!currentMarker) {
  console.error("Missing review marker in infra/README.md.");
  console.error("Add a line like: Cost estimate last reviewed: YYYY-MM-DD");
  process.exit(1);
}

const baseReadme = readBaseReadme();
if (baseReadme) {
  const baseMarker = extractReviewMarker(baseReadme);
  if (baseMarker && baseMarker === currentMarker) {
    console.error("Infrastructure changed but cost review marker date was not updated.");
    console.error(`Current marker is still ${currentMarker}. Bump it after re-checking cost estimates.`);
    process.exit(1);
  }
}

console.log("Infrastructure cost estimate guard passed.");
