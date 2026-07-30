const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const documentCategoryController = require('../controllers/documentCategoryController');
const { create, update, byId } = require('../validators/documentCategoryValidator');

const router = Router();

router.get('/', authMiddleware, asyncHandler(documentCategoryController.getCategories));
router.get('/:id', authMiddleware, byId, asyncHandler(documentCategoryController.getCategoryById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), create, asyncHandler(documentCategoryController.createCategory));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), update, asyncHandler(documentCategoryController.updateCategory));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), byId, asyncHandler(documentCategoryController.deleteCategory));

module.exports = router;
