const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const IncrementalReel = sequelize.define("IncrementalReel", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  video_url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  day_number: {
    type: DataTypes.INTEGER,
    defaultValue : 0,
    allowNull: false,
  },
  posted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = IncrementalReel;
