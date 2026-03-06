require("dotenv").config();

const express = require("express");
const cron = require("node-cron");

const supabase = require("./config/supabase");

const sequelize = require("./config/db");

const IncrementalReel = require("./models/IncrementalReel");
const NormalReel = require("./models/NormalReel");

const Token = require("./models/Token");

// IncrementalReel.sync();
// NormalReel.sync()
Token.sync()
const { postReel, refreshToken } = require("./services/instagramService");

const multer = require("multer");
const s3 = require("./config/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");


const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = 4001;

app.use(express.json());


console.log("BUCKET" , process.env.SUPABASE_BUCKET)



app.get("/incr", async (req, res) => {
  try {

    console.log("Incremental reel triggered");

    const reel = await IncrementalReel.findOne({
      where: { posted: false },
      order: [["day_number", "ASC"]]
    });

    if (!reel) {
      console.log("No reels with posted=false found");
      return res.json({ message: "No incremental reels left" });
    }

    const caption = `Day ${reel.day_number} without you 💔`;

    await postReel(reel.video_url, caption);

    await reel.update({ posted: true });

    res.json({
      message: "Incremental reel posted",
      day: reel.day_number
    });

  } catch (err) {
    console.error("Error posting incremental reel:", err);

    res.status(500).json({
      error: err.message
    });
  }
});




app.get("/normal", async (req, res) => {
  try {
    console.log("Normal reel triggered");

    const reel = await NormalReel.findOne({
      where: { posted: false },
      order: [["id", "ASC"]] // pick the oldest reel first
    });

    if (!reel) {
      return res.json({
        message: "No normal reels left"
      });
    }

    await postReel(reel.video_url, reel.caption);

    await NormalReel.update(
      { posted: true },
      { where: { id: reel.id } }
    );

    res.json({
      message: "Normal reel posted successfully",
      reelId: reel.id
    });

  } catch (err) {
    console.error("Error posting normal reel:", err);

    res.status(500).json({
      error: err.message
    });
  }
});


// incremental reel every 5 minutes
cron.schedule("*/15 * * * *", async () => {
  try {

    console.log("Cron: Checking incremental reels...");

    const reel = await IncrementalReel.findOne({
      where: { posted: false },
      order: [["day_number", "ASC"]]
    });

    if (!reel) {
      console.log("Cron: No incremental reels left");
      return;
    }

    const caption = `Day ${reel.day_number} without you 💔`;

    await postReel(reel.video_url, caption);

    await reel.update({ posted: true });

    console.log(`Cron: Posted Day ${reel.day_number}`);

  } catch (err) {

    console.error("Cron Error posting incremental reel:", err);

  }
});


// normal reel every 5 minutes
cron.schedule("*/30 * * * *", async () => {

  console.log("Running normal reel cron");

  const reel = await NormalReel.findOne({
    where: { posted: false }
  });

  if (!reel) return;

  await postReel(reel.video_url, reel.caption);

  reel.posted = true;
  await reel.save();

});


// refresh token every 50 days
cron.schedule("0 0 */50 * *", async () => {

  console.log("Refreshing token...");

  try {

    await refreshToken();

  } catch (err) {

    console.error("Token refresh failed:", err);

  }

});


/* -----------------------
   Start Server
----------------------- */

async function start() {

  try {

    await sequelize.sync();

    console.log("Database connected");
    console.log("Reel bot running");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {

    console.error("Startup error:", err);

  }

}

start();



app.get("/", (req, res) => {
  res.send("Reel automation server running 🚀");
});




app.post("/upload-incremental", upload.single("video"), async (req, res) => {

  try {

    const { day_number } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Video required" });
    }

    const fileName = `incremental-${Date.now()}-${req.file.originalname}`;
    console.log("Uploading file:", fileName);

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (error) throw error;

    const videoUrl =
      `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${fileName}`;

    const reel = await IncrementalReel.create({
      day_number,
      video_url: videoUrl,
      posted: false
    });

    res.json({
      message: "Video uploaded",
      data: reel
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: err.message });

  }

});



app.post("/upload-normal", upload.single("video"), async (req, res) => {

  try {

    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Video required" });
    }

    const fileName = `normal-${Date.now()}-${req.file.originalname}`;

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (error) throw error;

    const videoUrl =
      `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${fileName}`;

    const reel = await NormalReel.create({
      video_url: videoUrl,
      caption,
      posted: false
    });

    res.json({
      message: "Normal reel uploaded",
      data: reel
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

