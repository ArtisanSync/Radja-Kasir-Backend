import multer from "multer";
import path from "path";
import { errorResponse } from "../utils/response.js";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpg", 
  "image/jpeg"
];

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg"];

const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    return cb(
      new Error("Only PNG and JPG image files are allowed"),
      false
    );
  }
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return cb(
      new Error("Invalid file extension. Only .png, .jpg, and .jpeg are allowed"),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
    fieldSize: 1024 * 1024,
  },
});

export const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case "LIMIT_FILE_SIZE":
              return errorResponse(
                res,
                "File too large. Maximum size is 5MB",
                400
              );
            case "LIMIT_FILE_COUNT":
              return errorResponse(
                res,
                "Too many files. Only 1 file allowed",
                400
              );
            case "LIMIT_FIELD_VALUE":
              return errorResponse(
                res,
                "Field value too large",
                400
              );
            case "LIMIT_UNEXPECTED_FILE":
              return errorResponse(
                res,
                `Unexpected field name. Expected: ${fieldName}`,
                400
              );
            default:
              return errorResponse(
                res,
                "File upload error occurred",
                400
              );
          }
        }
        return errorResponse(res, err.message, 400);
      }
      if (!req.file) {
        return errorResponse(
          res,
          "No file uploaded. Please select a PNG or JPG image",
          400
        );
      }
      req.file.uploadTimestamp = new Date().toISOString();
      
      next();
    });
  };
};

export const validateImageBuffer = (buffer) => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  const jpgSignature = Buffer.from([0xFF, 0xD8, 0xFF]);

  if (buffer.length < 4) return false;

  const fileSignature = buffer.slice(0, 4);
  const jpgSig = buffer.slice(0, 3);

  return (
    fileSignature.equals(pngSignature) ||
    jpgSig.equals(jpgSignature)
  );
};

export default upload;