require("dotenv").config();
const axios = require("axios");
const Token = require("./models/Token");

const GRAPH = "https://graph.facebook.com/v25.0";
const PAGE_ID = process.env.PAGE_ID;
const IG_USER_ID = process.env.IG_USER_ID;

// Public sample reel for testing; replace if you want a different one.
const TEST_VIDEO_URL =
  process.env.TEST_VIDEO_URL ||
  "https://www.w3schools.com/html/mov_bbb.mp4";

async function tryGet(label, url, params) {
  try {
    const r = await axios.get(url, { params });
    console.log(`  [OK] ${label}:`, JSON.stringify(r.data));
  } catch (e) {
    console.log(
      `  [ERR] ${label}:`,
      JSON.stringify(e.response?.data?.error || e.message)
    );
  }
}

async function main() {
  const tokenRow = await Token.findByPk(1);
  const userToken = tokenRow.user_token;

  const accts = await axios.get(`${GRAPH}/me/accounts`, {
    params: { fields: "id,access_token", access_token: userToken }
  });
  const page = accts.data.data.find(p => p.id === PAGE_ID);
  const pageToken = page.access_token;
  console.log("Page token ready.");

  // Create a fresh container
  console.log("\nCreating reel container...");
  let containerId;
  try {
    const c = await axios.post(`${GRAPH}/${IG_USER_ID}/media`, {
      media_type: "REELS",
      video_url: TEST_VIDEO_URL,
      caption: "diagnostic",
      share_to_feed: true,
      access_token: pageToken
    });
    containerId = c.data.id;
    console.log("Container id:", containerId);
  } catch (e) {
    console.error(
      "Container create failed:",
      JSON.stringify(e.response?.data, null, 2)
    );
    process.exit(1);
  }

  // Wait a few seconds for FB to register it
  await new Promise(r => setTimeout(r, 4000));

  console.log("\n--- Querying container with PAGE token ---");
  await tryGet("no fields", `${GRAPH}/${containerId}`, { access_token: pageToken });
  await tryGet("fields=id", `${GRAPH}/${containerId}`, { fields: "id", access_token: pageToken });
  await tryGet("fields=status_code", `${GRAPH}/${containerId}`, { fields: "status_code", access_token: pageToken });
  await tryGet("fields=status", `${GRAPH}/${containerId}`, { fields: "status", access_token: pageToken });
  await tryGet("fields=status_code,status", `${GRAPH}/${containerId}`, { fields: "status_code,status", access_token: pageToken });

  console.log("\n--- Querying container with USER token ---");
  await tryGet("fields=status_code", `${GRAPH}/${containerId}`, { fields: "status_code", access_token: userToken });

  console.log("\n--- Listing IG user's media containers (page token) ---");
  await tryGet(
    "ig user /media",
    `${GRAPH}/${IG_USER_ID}/media`,
    { fields: "id,status_code", limit: 5, access_token: pageToken }
  );

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
