// require("dotenv").config();
// const axios = require("axios");

// const GRAPH = "https://graph.facebook.com/v19.0";

// let USER_TOKEN = process.env.USER_TOKEN;

// const PAGE_ID = process.env.PAGE_ID;
// const IG_USER_ID = process.env.IG_USER_ID;
// const APP_ID = process.env.APP_ID;
// const APP_SECRET = process.env.APP_SECRET;
// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = print.env.CLIENT_SECRET;



// async function refreshToken() {

//   const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${USER_TOKEN}`;

//   const res = await axios.get(url);

//   USER_TOKEN = res.data.access_token;

//   console.log("Token refreshed");

// }



// async function getPageToken() {

//   const res = await axios.get(
//     `${GRAPH}/me/accounts?access_token=${USER_TOKEN}`
//   );

//   const page = res.data.data.find(p => p.id === PAGE_ID);

//   if (!page) {
//     throw new Error("Page not found for this token");
//   }

//   return page.access_token;

// }



// async function createReel(pageToken, videoUrl, caption) {

//   const res = await axios.post(
//     `${GRAPH}/${IG_USER_ID}/media`,
//     {
//       media_type: "REELS",
//       video_url: videoUrl,
//       caption,
//       share_to_feed: true,
//       access_token: pageToken
//     }
//   );

//   return res.data.id;

// }



// async function publishReel(pageToken, creationId) {

//   await axios.post(
//     `${GRAPH}/${IG_USER_ID}/media_publish`,
//     {
//       creation_id: creationId,
//       access_token: pageToken
//     }
//   );

// }



// async function postReel(videoUrl, caption) {

//   const pageToken = await getPageToken();

//   const creationId = await createReel(pageToken, videoUrl, caption);

//   console.log("Reel container created:", creationId);

//   let status = "IN_PROGRESS";

//   while (status !== "FINISHED") {

//     const res = await axios.get(
//       `${GRAPH}/${creationId}?fields=status_code&access_token=${pageToken}`
//     );

//     status = res.data.status_code;

//     console.log("Processing status:", status);

//     if (status === "ERROR") {
//       throw new Error("Instagram processing failed");
//     }

//     if (status !== "FINISHED") {
//       await new Promise(r => setTimeout(r, 5000));
//     }

//   }

//   console.log("Reel processing complete");

//   await publishReel(pageToken, creationId);

//   console.log("Reel published successfully");

// }


// module.exports = {
//   postReel,
//   refreshToken
// };




// new code

require("dotenv").config();
const axios = require("axios");
const Token = require("../models/Token");

const GRAPH = "https://graph.facebook.com/v19.0";

const PAGE_ID = process.env.PAGE_ID;
const IG_USER_ID = process.env.IG_USER_ID;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;


/* -----------------------
   Get User Token
----------------------- */

async function getUserToken() {

  const tokenRow = await Token.findByPk(1);

  if (!tokenRow) {
    throw new Error("Token not found in database");
  }

  return tokenRow.user_token;

}


/* -----------------------
   Save Token
----------------------- */

async function saveUserToken(newToken) {

  await Token.update(
    {
      user_token: newToken,
      updated_at: new Date()
    },
    {
      where: { id: 1 }
    }
  );

  console.log("Token updated in DB");

}


/* -----------------------
   Refresh Token
----------------------- */

async function refreshToken() {

  try {

    const userToken = await getUserToken();

    const url =
      `${GRAPH}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${CLIENT_ID}` +
      `&client_secret=${CLIENT_SECRET}` +
      `&fb_exchange_token=${userToken}`;

    const res = await axios.get(url);

    const newToken = res.data.access_token;
    console.log(newToken , "here is new token")

    await saveUserToken(newToken);

    console.log("User token refreshed successfully");

  } catch (err) {

    console.error(
      "Token refresh failed:",
      err.response?.data || err.message
    );

  }

}


/* -----------------------
   Get Page Token
----------------------- */

async function getPageToken() {

  const userToken = await getUserToken();

  const res = await axios.get(
    `${GRAPH}/me/accounts?access_token=${userToken}`
  );

  const page = res.data.data.find(p => p.id === PAGE_ID);

  if (!page) {
    throw new Error("Page not found for this token");
  }

  return page.access_token;

}


/* -----------------------
   Create Reel Container
----------------------- */

async function createReel(pageToken, videoUrl, caption) {

  const res = await axios.post(
    `${GRAPH}/${IG_USER_ID}/media`,
    {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: true,
      access_token: pageToken
    }
  );

  return res.data.id;

}


/* -----------------------
   Publish Reel
----------------------- */

async function publishReel(pageToken, creationId) {

  await axios.post(
    `${GRAPH}/${IG_USER_ID}/media_publish`,
    {
      creation_id: creationId,
      access_token: pageToken
    }
  );

}


/* -----------------------
   Wait For Processing
----------------------- */

async function waitForProcessing(pageToken, creationId) {

  let status = "IN_PROGRESS";
  let attempts = 0;
  const MAX_ATTEMPTS = 60; // 5 minutes

  while (status !== "FINISHED" && attempts < MAX_ATTEMPTS) {

    const res = await axios.get(
      `${GRAPH}/${creationId}?fields=status_code&access_token=${pageToken}`
    );

    status = res.data.status_code;

    console.log("Processing status:", status);

    if (status === "ERROR") {
      throw new Error("Instagram processing failed");
    }

    if (status !== "FINISHED") {
      await new Promise(r => setTimeout(r, 5000));
    }

    attempts++;

  }

  if (status !== "FINISHED") {
    throw new Error("Instagram processing timeout");
  }

}


/* -----------------------
   Post Reel
----------------------- */

async function postReel(videoUrl, caption) {

  const pageToken = await getPageToken();

  const creationId = await createReel(pageToken, videoUrl, caption);

  console.log("Reel container created:", creationId);

  await waitForProcessing(pageToken, creationId);

  console.log("Reel processing complete");

  await publishReel(pageToken, creationId);

  console.log("Reel published successfully");

}


module.exports = {
  postReel,
  refreshToken
};