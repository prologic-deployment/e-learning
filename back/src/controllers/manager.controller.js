const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const { notifyDeadlineReminder } = require("../services/notification.service");

// ================= ASSIGN USER TO MANAGER (Admin only) =================
exports.assignUserToManager = async (req, res) => {
  try {
    const { userId, managerId } = req.body;

    const manager = await User.findById(managerId);
    if (!manager || manager.role !== "manager") {
      return res.status(400).json({ message: "Manager not found or invalid" });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== "user") {
      return res.status(400).json({ message: "User not found or invalid" });
    }

    user.manager = managerId;
    await user.save();

    res.status(200).json({ message: "User assigned to manager successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= ASSIGN COURSE TO USERS (Manager only) =================
exports.assignCourseToUsers = async (req, res) => {
  try {
    const { courseId, userIds, deadline } = req.body; //  ajoute deadline

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const users = await User.find({ _id: { $in: userIds }, manager: req.user._id });
    if (users.length === 0) {
      return res.status(400).json({ message: "No valid users in your team" });
    }

    for (let user of users) {
      let enrollment = await Enrollment.findOne({ user: user._id, course: courseId });

      if (!enrollment) {
        enrollment = await Enrollment.create({
          user: user._id,
          course: courseId,
          deadline: deadline ? new Date(deadline) : null //  ajoute deadline
        });
      } else if (deadline) {
        enrollment.deadline = new Date(deadline);
        enrollment.reminderSent = false;
        await enrollment.save();
      }

      // 🔔 Notifier le user
      await notifyDeadlineReminder(user._id, course, deadline ?
        Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null
      );
    }

    res.status(200).json({ message: "Course assigned successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= TEAM PROGRESS (Manager only) =================
exports.getTeamProgress = async (req, res) => {
  try {
    const members = await User.find({ manager: req.user._id }).select('firstname lastname').lean();
    const enrollments = members.length ? await Enrollment.find({ user: { $in: members.map(m=>m._id) } })
      .select('user course progress completed').populate('course','title').lean() : [];
    const buckets = new Map(members.map(m=>[String(m._id),[]]));
    for(const e of enrollments) {
      if(e.course) buckets.get(String(e.user)).push({courseId:e.course._id,title:e.course.title,progress:e.progress,completed:e.completed});
    }
    res.json(members.map(m=>({user:{id:m._id,firstname:m.firstname,lastname:m.lastname},courses:buckets.get(String(m._id))})));
  } catch (error) { res.status(500).json({message:'Unable to load team progress.'}); }
};

// Shared browser/server input contract. Route guards still run first.
for (const name of ["assignUserToManager", "assignCourseToUsers"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
