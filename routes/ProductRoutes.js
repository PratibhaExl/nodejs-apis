import express from 'express';
import { AddProduct, DeleteProduct, GetAllProducts, UpdateProduct, getAllCategory, getProductById, placeOrder, getOrdersByUser,
    updateOrderStatus,
    getAllOrders
} from '../controllers/ProductsController.js';
import verifyToken from '../middlewares/authJWT.js';
import uploadFile from '../fileupload.js';
const router=express.Router();
router.get("/getallproducts",GetAllProducts);
router.get("/getproductbyid/:id",getProductById);
router.get("/getcategories",getAllCategory);
router.post("/addproduct",uploadFile.single('attach'),AddProduct);
router.post("/update/:id",uploadFile.single('attach'),UpdateProduct);
router.delete("/delete/:id", DeleteProduct);
router.post("/getallorders",getAllOrders);
router.post("/placeorder",placeOrder);
router.post("/myorders",getOrdersByUser);
router.post('/updateOrderStatus', updateOrderStatus);

export default router;