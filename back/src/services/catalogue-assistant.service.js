const Course = require("../models/Course");
const ignored = new Set(
  "the and for with want learn learning looking course courses what which are available show list please hello can take have any find about would like tell your platform les des une est pour avec dans que qui veux voudrais cherche trouve trouver propose disponible disponibles tous tout sont quel quels quelle quelles peux moi sur apprendre cours bonjour salut formation formations gratuit gratuits gratuite gratuites free paid payant payants premium english french".split(
    " ",
  ),
);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function findPublicCourses(message) {
  const terms = message
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôöùûüçñ+#]+/i)
    .filter((word) => word.length >= 3 && !ignored.has(word))
    .slice(0, 8);
  const filter = { isApproved: true, isArchived: { $ne: true } };
  if (/\b(free|gratuit\w*)\b/i.test(message)) filter.price = 0;
  else if (/\b(paid|payant\w*|premium)\b/i.test(message))
    filter.price = { $gt: 0 };
  if (terms.length)
    filter.$or = terms.flatMap((term) =>
      ["title", "description", "category", "tags"].map((field) => ({
        [field]: { $regex: escape(term), $options: "i" },
      })),
    );
  // Explicit projection: no lessons, exam answers, enrollments or private user data.
  return Course.find(filter)
    .select("title description category price trainer")
    .populate("trainer", "firstname lastname")
    .sort({ createdAt: -1 })
    .limit(6)
    .maxTimeMS(3000)
    .lean();
}
function catalogueReply(courses, language) {
  const fr = language === "fr";
  if (!courses.length)
    return fr
      ? "Je ne trouve aucun cours publié correspondant à votre demande. Essayez un autre sujet ou consultez le catalogue."
      : "I could not find any published courses matching your request. Try another topic or browse the course library.";
  const heading = fr
    ? "Voici les cours publiés correspondant à votre recherche :"
    : "Here are published courses matching your search:";
  return (
    heading +
    "\n\n" +
    courses
      .map(
        (c) =>
          `${c.title}\n${c.category || ""}${c.category ? " · " : ""}${c.price === 0 ? (fr ? "Gratuit" : "Free") : c.price + " TND"}${c.trainer ? "\n" + [c.trainer.firstname, c.trainer.lastname].filter(Boolean).join(" ") : ""}`,
      )
      .join("\n\n")
  );
}
module.exports = { findPublicCourses, catalogueReply };
