const Cart = require("../models/Cart");
const Course = require("../models/Course");

// Voir mon panier
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate("items.course", "title description price image");

    if (!cart) {
      return res.status(200).json({ items: [], totalPrice: 0 });
    }

    res.status(200).json(cart);
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

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      // Créer un nouveau panier
      cart = await Cart.create({
        user: req.user._id,
        items: [{ course: courseId, price: course.price }],
        totalPrice: course.price
      });
    } else {
      // Vérifier si le cours est déjà dans le panier
      const exists = cart.items.find(
        item => item.course.toString() === courseId
      );

      if (exists) {
        return res.status(400).json({ message: "Course already in cart" });
      }

      cart.items.push({ course: courseId, price: course.price });
      cart.totalPrice += course.price;
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
// Shared browser/server input contract. Route guards still run first.
for (const name of ["addToCart"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
