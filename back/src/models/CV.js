const mongoose = require("mongoose");
const { encryptAES, decryptAES } = require("../services/encryption.service");

const experienceSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  entreprise: { type: String, required: true },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date },
  description: { type: String }
});

const formationSchema = new mongoose.Schema({
  diplome: { type: String, required: true },
  etablissement: { type: String, required: true },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date }
});

const certificationSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  organisme: { type: String, required: true },
  dateObtention: { type: Date, required: true }
});

const competenceSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  niveau: {
    type: String,
    enum: ["Débutant", "Intermédiaire", "Avancé", "Expert"],
    default: "Débutant"
  }
});

const langueSchema = new mongoose.Schema({
  langue: { type: String, required: true },
  niveau: {
    type: String,
    enum: ["Débutant", "Intermédiaire", "Avancé", "Bilingue", "Natif"],
    default: "Débutant"
  }
});

const hobbySchema = new mongoose.Schema({
  nom: { type: String, required: true }
});

const cvSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  // Infos personnelles
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  // ✅ PII encrypted at rest (matches User.phone/address handling)
  email: {
    type: String,
    required: true,
    get: function (v) { return v ? decryptAES(v) : null; },
    set: function (v) { return v ? encryptAES(v) : null; }
  },
  telephone: {
    type: String,
    get: function (v) { return v ? decryptAES(v) : null; },
    set: function (v) { return v ? encryptAES(v) : null; }
  },
  description: { type: String },
  photo: { type: String },

  // Sections du formulaire
  experiences: [experienceSchema],
  formations: [formationSchema],
  certifications: [certificationSchema],
  competences: [competenceSchema],
  langues: [langueSchema],
  hobbies: [hobbySchema]
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

module.exports = mongoose.model("CV", cvSchema);