const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Créer les dossiers automatiquement s'ils n'existent pas
const createFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

createFolder("uploads/videos");
createFolder("uploads/pdfs");
createFolder("uploads/images");
createFolder("uploads/certificates");
createFolder("uploads/avatars");
createFolder("uploads/cvs");

// Déterminer le dossier selon le type de fichier
const getDestination = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const videoTypes = [".mp4", ".mov", ".avi", ".mkv"];
  const imageTypes = [".jpg", ".jpeg", ".png", ".webp"];

  if (videoTypes.includes(ext)) return "uploads/videos";
  if (ext === ".pdf") return "uploads/pdfs";
  
  if (imageTypes.includes(ext)) {
    if (file.fieldname === "avatar") return "uploads/avatars";
    if (file.fieldname === "photo") return "uploads/images";
    return "uploads/images";
  }
  
  return "uploads/others";
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = getDestination(file);
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname || "file";
    cb(null, prefix + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /\.(pdf|mp4|mov|avi|mkv|jpg|jpeg|png|webp)$/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (extname) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error("File type not allowed"), { status: 400 }));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: fileFilter
});

upload.image = multer({storage, limits:{fileSize:5*1024*1024},fileFilter(req,file,cb){
  if(!/\.(jpg|jpeg|png|webp)$/i.test(file.originalname))return cb(Object.assign(new Error('File type not allowed'),{status:400}));
  fileFilter(req,file,cb);
}});
module.exports = upload;