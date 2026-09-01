const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const assetCategoryController = require('../controllers/assetCategoryController');
const { create, update, byId } = require('../validators/assetCategoryValidator');

const router = Router();

// Mounted at /assets/categories — registered before the generic /assets router.
const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

router.get('/', authMiddleware, asyncHandler(assetCategoryController.getCategories));
router.get('/:id', authMiddleware, byId, asyncHandler(assetCategoryController.getCategoryById));
router.post('/', authMiddleware, authorize(...FULL_ROLES), create, asyncHandler(assetCategoryController.createCategory));
router.put('/:id', authMiddleware, authorize(...FULL_ROLES), update, asyncHandler(assetCategoryController.updateCategory));
router.delete('/:id', authMiddleware, authorize(...FULL_ROLES), byId, asyncHandler(assetCategoryController.deleteCategory));

module.exports = router;
