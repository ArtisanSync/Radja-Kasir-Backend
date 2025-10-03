import multer from "multer";
import path from "path";
import { errorResponse } from "../utils/response.js";
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("File yang diunggah harus berupa gambar."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return errorResponse(
              res,
              "Ukuran file gambar terlalu besar. Maksimal 10MB.",
              400
            );
          }
        }
        return errorResponse(res, err.message, 400);
      }
      next();
    });
  };
};
export const validateImageBuffer = (buffer) => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const jpgSignature = Buffer.from([0xff, 0xd8, 0xff]);

  if (buffer.length < 4) return false;

  const fileSignature = buffer.slice(0, 4);
  const jpgSig = buffer.slice(0, 3);

  return fileSignature.equals(pngSignature) || jpgSig.equals(jpgSignature);
};

export default upload;
