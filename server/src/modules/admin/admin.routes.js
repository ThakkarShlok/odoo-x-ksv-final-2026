/**
 * Admin catalogue-management routes. EVERY route is gated by authMiddleware + requireRole('ADMIN')
 * — the 3-layer RBAC chain (authenticate → authorise-by-role). A CUSTOMER token reaches these and
 * gets a 403; an anonymous request gets a 401. Image upload additionally runs the multer middleware
 * (which streams the file to disk and 422s a bad type/size) BEFORE the controller.
 *
 * Mounted in parallel with the legacy /api/products (now deprecated) rather than replacing it in
 * place — see the header of modules/products/products.controller.js for why: the old routes stay
 * live so nothing already calling them breaks, while all NEW admin work targets this clean surface.
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { uploadProductImage } from '../../middleware/upload.js';
import {
  createCategoryRules,
  updateCategoryRules,
  idParamRules,
  listProductsRules,
  createProductRules,
  updateProductRules,
  createUnitRules,
  updateUnitRules,
  unitIdParamRules,
  imageProductParamRules,
  imageIdParamRules,
  listPricelistItemsRules,
  createPricelistItemRules,
  updatePricelistItemRules,
} from './admin.validators.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listPricelists,
  listPricelistItems,
  createPricelistItem,
  updatePricelistItem,
  deletePricelistItem,
} from './admin.taxonomy.controller.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  listImages,
  uploadImage,
  setPrimaryImage,
  deleteImage,
} from './admin.products.controller.js';

const router = Router();

// One gate for the whole surface — no route below is reachable without a valid ADMIN token.
router.use(authMiddleware, requireRole('ADMIN'));

// ----- Categories -----------------------------------------------------------
router.get('/categories', listCategories);
router.post('/categories', createCategoryRules, validate, createCategory);
router.patch('/categories/:id', updateCategoryRules, validate, updateCategory);
router.delete('/categories/:id', idParamRules, validate, deleteCategory);

// ----- Pricelists / rates ---------------------------------------------------
router.get('/pricelists', listPricelists);
router.get('/pricelist-items', listPricelistItemsRules, validate, listPricelistItems);
router.post('/pricelist-items', createPricelistItemRules, validate, createPricelistItem);
router.patch('/pricelist-items/:id', updatePricelistItemRules, validate, updatePricelistItem);
router.delete('/pricelist-items/:id', idParamRules, validate, deletePricelistItem);

// ----- Products -------------------------------------------------------------
router.get('/products', listProductsRules, validate, listProducts);
router.post('/products', createProductRules, validate, createProduct);
router.get('/products/:id', idParamRules, validate, getProduct);
router.patch('/products/:id', updateProductRules, validate, updateProduct);
router.delete('/products/:id', idParamRules, validate, deleteProduct);

// ----- Product units (product-scoped) ---------------------------------------
router.get('/products/:id/units', idParamRules, validate, listUnits);
router.post('/products/:id/units', createUnitRules, validate, createUnit);
router.patch('/units/:unitId', updateUnitRules, validate, updateUnit);
router.delete('/units/:unitId', unitIdParamRules, validate, deleteUnit);

// ----- Product images (product-scoped; multipart upload) --------------------
router.get('/products/:id/images', imageProductParamRules, validate, listImages);
router.post('/products/:id/images', imageProductParamRules, validate, uploadProductImage, uploadImage);
router.patch('/products/:id/images/:imageId/primary', imageIdParamRules, validate, setPrimaryImage);
router.delete('/products/:id/images/:imageId', imageIdParamRules, validate, deleteImage);

export default router;
