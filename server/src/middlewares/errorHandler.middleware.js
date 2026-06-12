import multer from "multer";

/**
 * Express error-handling middleware specifically designed to catch and format
 * file upload errors thrown by Multer (e.g. limit violations, unsupported types).
 */
export function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Catch files exceeding set max-sizes
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "File size exceeds the allowed limit." });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    // Catch custom filter errors (e.g. MIME restrictions from fileFilter)
    return res
      .status(400)
      .json({ message: err.message || "File upload failed." });
  }
  next();
}