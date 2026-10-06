const Course = require("../models/Course");

// GET /api/courses/archived — admin backoffice listing.
// isArchived/archivedAt are `select: false` in the schema, so the fields are
// explicitly re-selected here (otherwise every course would look archived=false).
exports.getArchivedCourses = async (req, res) => {
  try {
    const courses = await Course.find({ isArchived: true })
      .select("+isArchived +archivedAt")
      .populate("trainer", "firstname lastname")
      .sort({ archivedAt: -1 });

    res.status(200).json({ courses });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
