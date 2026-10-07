
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { encryptAES, decryptAES, hashSHA256 } = require("../services/encryption.service");

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
      trim: true
    },
    lastname: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
validate: {
        validator: function (value) {
          // ✅ Si c'est déjà un hash bcrypt, on accepte
          if (value.startsWith('$2b$') || value.startsWith('$2a$')) return true;
          return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
        },
        message: "Password must be at least 8 characters, include 1 uppercase letter and 1 number"
      }
    },
    role: [{
      type: String,
      enum: ["user", "trainer", "admin", "manager"],
      default: "user"
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },


    phone: {
      type: String,
      get: function(v) {
        // Déchiffrer automatiquement lors de la lecture
        return v ? decryptAES(v) : null;
      },
      set: function(v) {
        // Chiffrer automatiquement lors de l'écriture
        return v ? encryptAES(v) : null;
      }
    },

    address: {
      type: String,
      get: function(v) {
        return v ? decryptAES(v) : null;
      },
      set: function(v) {
        return v ? encryptAES(v) : null;
      }
    },

  
    loginAttempts: { type: Number, default: 0, select: false },
    loginBlockedUntil: { type: Date, default: null, select: false },
    twoFactor: {
      type: new mongoose.Schema({
        enabled: { type: Boolean, default: false },
        secret: String, pendingSecret: String, pendingHash: String, pendingExpires: Date,
        lastStep: { type: Number, default: -1 },
        recoveryHashes: { type: [String], default: [] },
        failures: { type: Number, default: 0 }, blockedUntil: { type: Date, default: null }
      }, { _id: false }),
      default: () => ({}), select: false
    },

    resetPasswordToken: {
      type: String,  // ✅ Stocké HACHÉ (SHA-256) — le token en clair n'est jamais persisté
      default: null,
      select: false
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },

    // ✅ SECURITY: incremented on password change/reset — tokens carrying an
    // older value are rejected, invalidating all existing sessions.
    tokenVersion: {
      type: Number,
      default: 0,
      select: false
    },

   
    trainerProfile: {
      biographie: { type: String },
      specialite: { type: String },
      experienceTotal: { type: Number, default: 0 },
      disponibilite: { type: Boolean, default: true }
    },

    
    apprenantProfile: {
      niveauEducation: {
        type: String,
        enum: ["Bac", "Bac+2", "Bac+3", "Bac+5", "Doctorat", "Autre"],
        default: "Autre"
      },
      domaineEtude: { type: String },
      objectifApprentissage: { type: String }
    },
    badges: [
      {
        badge: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Badge"
        },
        earnedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]

  },
  {
    timestamps: true,
    toJSON: { getters: true },   // ✅ Activer les getters pour déchiffrer
    toObject: { getters: true }
  }
);


// ✅ email index is already created by `unique: true` above — an explicit
// duplicate index triggered a Mongoose warning on every boot.

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});



/**
 * Comparer le mot de passe
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Générer un token de réinitialisation de mot de passe (haché SHA-256)
 * @returns {string} - Token en clair (à envoyer par email)
 */
userSchema.methods.generateResetToken = function () {
  // Générer un token aléatoire (64 caractères hex)
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hacher avec SHA-256 avant stockage
  this.resetPasswordToken = hashSHA256(resetToken);
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken; // Retourner en clair pour l'envoyer par email
};

/**
 * Vérifier un token de réinitialisation
 * @param {string} candidateToken - Token fourni dans l'URL
 * @returns {boolean} - True si valide
 */
userSchema.methods.verifyResetToken = function (candidateToken) {
  if (!this.resetPasswordToken || !this.resetPasswordExpires) {
    return false;
  }

  // Vérifier expiration
  if (Date.now() > this.resetPasswordExpires) {
    return false;
  }

  // Hacher le token candidat
  const hashedToken = hashSHA256(candidateToken);

  // Comparer avec le token stocké
  return hashedToken === this.resetPasswordToken;
};

/**
 * Nettoyer le token de réinitialisation après utilisation
 */
userSchema.methods.clearResetToken = function () {
  this.resetPasswordToken = null;
  this.resetPasswordExpires = null;
};


userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    // Defense in depth until the explicit legacy-field cleanup is applied.
    for (const field of ['otp', 'otpExpires', 'otpAttempts', 'otpBlockedUntil']) delete ret[field];
    delete ret.twoFactor;
    delete ret.tokenVersion;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;

    delete ret.loginAttempts;
    delete ret.loginBlockedUntil;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);