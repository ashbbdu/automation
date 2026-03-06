// const cron = require("node-cron");
// const express = require("express");
// const app = express();

// const IncrementalReel = require("../models/IncrementalReel");
// const NormalReel = require("../models/NormalReel");

// const { postReel, refreshToken } = require("../services/instagramService");
// const e = require("express");

// // Morning reel (incremental)
// // cron.schedule("*/2 * * * *", async () => {
// //   try {
// //     const reel = await IncrementalReel.findOne({
// //       where: { posted: false },
// //       order: [["day_number", "ASC"]],
// //     });

// //     if (!reel) return;

// //     const caption = `Day ${reel.day_number} without you 💔`;

// //     await postReel(reel.video_url, caption);

// //     reel.posted = true;
// //     await reel.save();
// //   } catch (err) {
// //     console.error("Error posting incremental reel:", err);
// //   }
// // });

// // // Evening reel (normal)
// // cron.schedule("0 18 * * *", async () => {
// //   try {
// //     const reel = await NormalReel.findOne({
// //       where: { posted: false },
// //     });

// //     if (!reel) return;

// //     await postReel(reel.video_url, reel.caption);

// //     reel.posted = true;
// //     await reel.save();
// //   } catch (err) {
// //     console.error("Error posting normal reel:", err);
// //   }
// // });



// app.get("/incr", async () => {
//     console.log("came")
//   try {
//     const reel = await IncrementalReel.findOne({
//       where: { posted: false },
//       order: [["day_number", "ASC"]],
//     });

//     if (!reel) return;

//     const caption = `Day ${reel.day_number} without you 💔`;

//     await postReel(reel.video_url, caption);

//     reel.posted = true;
//     await reel.save();
//   } catch (err) {
//     console.error("Error posting incremental reel:", err);
//   }
// });

// // Evening reel (normal)
// app.get("/normal", async () => {
//   try {
//     const reel = await NormalReel.findOne({
//       where: { posted: false },
//     });

//     if (!reel) return;

//     await postReel(reel.video_url, reel.caption);

//     reel.posted = true;
//     await reel.save();
//   } catch (err) {
//     console.error("Error posting normal reel:", err);
//   }
// });






// // refresh token every 50 days
// cron.schedule("0 0 */50 * *", async () => {
//   await refreshToken();
// });
