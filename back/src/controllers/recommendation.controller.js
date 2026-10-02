const axios = require("axios");
const CV = require("../models/CV");
const Enrollment = require("../models/Enrollment");
const Review = require("../models/Review");
const Course = require("../models/Course");

const FLASK_URL = process.env.FLASK_URL || 'http://127.0.0.1:5001';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // ✅ 1. Récupérer le CV de l'user
    const cv = await CV.findOne({ user: userId });
    const cv_skills = cv?.competences?.map(c => c.nom) || [];
    const cv_experiences = cv?.experiences?.map(e =>
      `${e.titre} ${e.description || ''}`
    ) || [];

    // ✅ 2. Récupérer les catégories des cours suivis
    const enrollments = await Enrollment.find({ user: userId })
      .populate('course', 'category');
    const enrolled_categories = [
      ...new Set(enrollments.map(e => e.course?.category).filter(Boolean))
    ];

    // ✅ 3. Récupérer les cours notés 5★
    const fiveStarReviews = await Review.find({ user: userId, rating: 5 })
      .populate('course', 'category');
    const five_star_subjects = [
      ...new Set(fiveStarReviews.map(r => r.course?.category).filter(Boolean))
    ];

    // ✅ 4. Récupérer TOUS les cours approuvés de la plateforme
    const allCourses = await Course.find({ isApproved: true })
      .populate('trainer', 'firstname lastname');

    // ✅ 5. Récupérer les enrollments count et avg rating pour chaque cours
    const platform_courses = await Promise.all(
      allCourses.map(async (course) => {
        const enrollCount = await Enrollment.countDocuments({ course: course._id });
        const reviews = await Review.find({ course: course._id });
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

        return {
          _id: course._id.toString(),
          title: course.title,
          description: course.description || '',
          category: course.category || '',
          price: course.price || 0,
          tags: course.tags || [],
          trainer: `${course.trainer?.firstname} ${course.trainer?.lastname}`,
          num_enrollments: enrollCount,
          avg_rating: avgRating,
          isApproved: course.isApproved
        };
      })
    );

    // ✅ 6. Exclure les cours déjà suivis
    const enrolledCourseIds = enrollments.map(e => e.course?._id?.toString());
    const available_courses = platform_courses.filter(
      c => !enrolledCourseIds.includes(c._id)
    );

    console.log(`🔍 Available courses for recommendation: ${available_courses.length}`);

    // ✅ 7. Appeler l'API Flask (authenticated internal call)
    const response = await axios.post(
      `${FLASK_URL}/recommend`,
      {
        cv_skills,
        cv_experiences,
        enrolled_categories,
        five_star_subjects,
        platform_courses: available_courses,
        top_n: 4
      },
      {
        timeout: 15000,
        headers: INTERNAL_API_TOKEN ? { 'X-Internal-Token': INTERNAL_API_TOKEN } : {}
      }
    );

    res.status(200).json({
      success: true,
      recommendations: response.data.recommendations,
      user_profile: response.data.user_profile
    });

  } catch (error) {
    console.error("❌ Recommendation error:", error.message);
    // ✅ Graceful degradation: the UI keeps working without recommendations
    res.status(200).json({ success: true, recommendations: [], user_profile: null });
  }
};