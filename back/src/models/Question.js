const mongoose = require("mongoose");

const reponseSchema = new mongoose.Schema({
  contenu: { type: String, required: true },
  estCorrecte: { type: Boolean, default: false }
});

const questionSchema = new mongoose.Schema({
  contenu: { type: String, required: true },
  typeQuestion: {
    type: String,
    enum: ["MULTI", "SINGLE"],
    default: "SINGLE"
  },
  reponses: [reponseSchema]
}, { timestamps: true });

module.exports = mongoose.model("Question", questionSchema);