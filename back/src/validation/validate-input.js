const fs = require("node:fs/promises");
const { validateRequest } = require("./input-policy");
/** Runs after authentication/authorization and multipart parsing, before writes. */
exports.withInputValidation = (handler) => async (req, res, next) => {
  try {
    const files = req.file
      ? [
          {
            fieldname: req.file.fieldname,
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
          },
        ]
      : [];
    const issues = validateRequest(
      req.method,
      req.originalUrl,
      req.body || {},
      files,
    );
    for (const [key, value] of Object.entries(req.params || {}))
      if (
        /^(id|userId|courseId|lessonId|enrollmentId|reviewId|targetId|attemptId)$/.test(
          key,
        ) &&
        !/^[a-f\d]{24}$/i.test(value)
      )
        issues[key] = "Choose a valid record.";
    if (
      req.file &&
      ["avatar", "photo"].includes(req.file.fieldname) &&
      !issues[req.file.fieldname]
    ) {
      const handle = await fs.open(req.file.path, "r");
      const bytes = Buffer.alloc(12);
      try {
        await handle.read(bytes, 0, 12, 0);
      } finally {
        await handle.close();
      }
      const ext = req.file.originalname.split(".").pop().toLowerCase();
      const valid =
        ext === "png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : ext === "webp"
            ? bytes.toString("ascii", 0, 4) === "RIFF" &&
              bytes.toString("ascii", 8, 12) === "WEBP"
            : ["jpg", "jpeg"].includes(ext) &&
              bytes[0] === 255 &&
              bytes[1] === 216 &&
              bytes[2] === 255;
      if (!valid)
        issues[req.file.fieldname] =
          "The file content does not match its image type.";
    }
    if (Object.keys(issues).length) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res
        .status(400)
        .json({
          code: "VALIDATION_ERROR",
          message: "Check your entries. " + Object.values(issues)[0],
          errors: issues,
        });
    }
    return await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};
