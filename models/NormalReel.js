const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const NormalReel = sequelize.define("NormalReel", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  video_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  caption: {
    type: DataTypes.TEXT
  },
  posted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

module.exports = NormalReel;