const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Token = sequelize.define(
  "Token",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    user_token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: "tokens",
    timestamps: false
  }
);

module.exports = Token;