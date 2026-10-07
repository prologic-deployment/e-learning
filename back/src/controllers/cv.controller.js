const CV = require("../models/CV");
const generateCVPDF = require("../utils/generateCVPDF");
const fs = require("fs");

exports.saveCV = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, description } = req.body;

    // ✅ Parser les tableaux
    const parseField = (field) => {
      if (!field) return [];
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch {
        return [];
      }
    };

    const experiences = parseField(req.body.experiences);
    const formations = parseField(req.body.formations);
    const certifications = parseField(req.body.certifications);
    const competences = parseField(req.body.competences);
    const langues = parseField(req.body.langues);
    const hobbies = parseField(req.body.hobbies);

    // ✅ Construire l'objet update
    const updateData = {
      user: req.user._id,
      nom, prenom, email, telephone, description,
      experiences, formations, certifications,
      competences, langues, hobbies
    };

    // ✅ Ajouter la photo seulement si un fichier est uploadé
    if (req.file) {
      updateData.photo = `/uploads/images/${req.file.filename}`;
    }

    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      updateData,
      { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({ message: "CV saved successfully", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getMyCV = async (req, res) => {
  try {
    const cv = await CV.findOne({ user: req.user._id });
    if (!cv) return res.status(404).json({ message: "CV not found" });
    res.status(200).json(cv);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.addExperience = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $push: { experiences: req.body } },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json({ message: "Experience added", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteExperience = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { experiences: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    res.status(200).json({ message: "Experience deleted", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.addFormation = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $push: { formations: req.body } },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json({ message: "Formation added", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteFormation = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { formations: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    res.status(200).json({ message: "Formation deleted", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.addCompetence = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $push: { competences: req.body } },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json({ message: "Competence added", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteCompetence = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { competences: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    res.status(200).json({ message: "Competence deleted", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.addLangue = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $push: { langues: req.body } },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json({ message: "Langue added", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteLangue = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { langues: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    res.status(200).json({ message: "Langue deleted", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.addHobby = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $push: { hobbies: req.body } },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json({ message: "Hobby added", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteHobby = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { hobbies: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    res.status(200).json({ message: "Hobby deleted", cv });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin/Manager voir CV d'un user
exports.getCVByUser = async (req, res) => {
  try {
    const cv = await CV.findOne({ user: req.params.userId });
    if (!cv) return res.status(404).json({ message: "CV not found" });
    res.status(200).json(cv);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Télécharger mon CV en PDF
exports.downloadCV = async (req, res) => {
  try {
    const cv = await CV.findOne({ user: req.user._id });

    if (!cv) {
      return res.status(404).json({ message: "CV not found. Please create your CV first." });
    }

    // Générer le PDF
    const { filePath, fileName } = await generateCVPDF(cv);

    // Télécharger directement
    res.download(filePath, `CV_${cv.prenom}_${cv.nom}.pdf`, (err) => {
      if (err) {
        res.status(500).json({ message: "Error downloading CV" });
      }
      // Supprimer le fichier après téléchargement
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};