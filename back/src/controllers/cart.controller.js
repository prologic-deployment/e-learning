const Cart = require("../models/Cart");
const Course = require("../models/Course");
const { effectivePrice, priceInfo, round2 } = require("../utils/pricing");

/** Cart view with live prices (old price / new price) */
function cartView(cart) {
  const items = (cart.items || []).filter(i => i.course).map(i => {
    const c = i.course;
    const info = priceInfo(c);
    return {
      _id: i._id,
      course: { _id: c._id, title: c.title, description: c.description, image: c.image, category: c.category, trainer: c.trainer },
      price: info.finalPrice,          // what will be charged (before vouchers)
      originalPrice: info.price,
      onSale: info.onSale,
      discountPercent: info.discountPercent,
      saleEndsAt: info.saleEndsAt
    };
  });
  return {
    _id: cart._id,
    items,
    totalPrice: round2(items.reduce((s, i) => s + i.price, 0)),
    originalTotal: round2(items.reduce((s, i) => s + i.originalPrice, 0))
  };
}

// Voir mon panier
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate({ path: "items.course", select: "title description price salePrice saleEndsAt image category trainer", populate: { path: "trainer", select: "firstname lastname" } });

    if (!cart) {
      return res.status(200).json({ items: [], totalPrice: 0, originalTotal: 0 });
    }

    res.status(200).json(cartView(cart));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Ajouter un cours au panier
exports.addToCart = async (req, res) => {
  try {
    const { courseId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.price === 0) {
      return res.status(400).json({ message: "Free courses don't need a cart" });
    }

    // already bought or enrolled → nothing to pay
    const Purchase = require("../models/Purchase");
    const Enrollment = require("../models/Enrollment");
    const [paid, enrolled] = await Promise.all([
      Purchase.exists({ user: req.user._id, course: courseId, paymentStatus: "paid" }),
      Enrollment.exists({ user: req.user._id, course: courseId })
    ]);
    if (paid || enrolled) {
      return res.status(409).json({ message: "You already own this course", owned: true });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      // Créer un nouveau panier
      cart = await Cart.create({
        user: req.user._id,
        items: [{ course: courseId, price: effectivePrice(course) }],
        totalPrice: effectivePrice(course)
      });
    } else {
      // Vérifier si le cours est déjà dans le panier
      const exists = cart.items.find(
        item => item.course.toString() === courseId
      );

      if (exists) {
        return res.status(400).json({ message: "Course already in cart" });
      }

      cart.items.push({ course: courseId, price: effectivePrice(course) });
      cart.totalPrice = round2(cart.totalPrice + effectivePrice(course));
      await cart.save();
    }

    res.status(200).json({ message: "Course added to cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Supprimer un cours du panier
exports.removeFromCart = async (req, res) => {
  try {
    const { courseId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.find(
      item => item.course.toString() === courseId
    );

    if (!item) {
      return res.status(404).json({ message: "Course not found in cart" });
    }

    cart.totalPrice -= item.price;
    cart.items = cart.items.filter(
      item => item.course.toString() !== courseId
    );

    await cart.save();

    res.status(200).json({ message: "Course removed from cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Vider le panier
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndDelete({ user: req.user._id });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};