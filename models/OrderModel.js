import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: String,
  category: String,
  price: Number,
  description: String,
  availableItems: Number,
  manufacturer: String,
  imagePath: String
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  fullname: { type: String, required: true },
  role: { type: String, required: true },
  cartItems: { type: [CartItemSchema], required: true },
  totalPrice: { type: Number, required: true },
  orderStatus: { type: String, required: true },
}, { timestamps: true });

const OrderModel = mongoose.model('Order', OrderSchema);
export default OrderModel;
