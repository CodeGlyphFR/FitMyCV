const DEFAULT_SITE_NAME = "CV Builder";
const DEFAULT_VERSION = "1.0.0";

function normalizeVersion(input){
  if (!input || typeof input !== "string") return DEFAULT_VERSION;
  return input.trim() || DEFAULT_VERSION;
}

function formatVersionDisplay(version){
  const safeVersion = normalizeVersion(version);
  const parts = safeVersion.split(".").filter(Boolean);
  if (parts.length === 0) return "1.0";
  while (parts.length > 1 && parts[parts.length - 1] === "0"){
    parts.pop();
  }
  if (parts.length === 1) parts.push("0");
  return parts.join(".");
}

const rawVersion = normalizeVersion(process.env.NEXT_PUBLIC_APP_VERSION);

export const SITE_VERSION = rawVersion;
export const SITE_TITLE = `${process.env.NEXT_PUBLIC_SITE_NAME?.trim() || DEFAULT_SITE_NAME} ${formatVersionDisplay(rawVersion)}`;
