const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const { upload } = require('../config/upload');
const documentController = require('../controllers/documentController');
const {
  upload: uploadValidator, update, replace, reject, byId, byEmployeeId, byCategoryId, versionDownload, expiringQuery,
} = require('../validators/documentValidator');

const router = Router();

router.get('/', authMiddleware, asyncHandler(documentController.getDocuments));
router.get('/my', authMiddleware, asyncHandler(documentController.getMyDocuments));
router.get('/expired', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(documentController.getExpiredDocuments));
router.get('/expiring', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), expiringQuery, asyncHandler(documentController.getExpiringDocuments));
router.get('/employee/:employeeId', authMiddleware, byEmployeeId, asyncHandler(documentController.getDocumentsByEmployee));
router.get('/category/:categoryId', authMiddleware, byCategoryId, asyncHandler(documentController.getDocumentsByCategory));

router.post('/', authMiddleware, upload.single('file'), uploadValidator, asyncHandler(documentController.uploadDocument));

router.get('/:id', authMiddleware, byId, asyncHandler(documentController.getDocumentById));
router.put('/:id', authMiddleware, update, asyncHandler(documentController.updateDocument));
router.delete('/:id', authMiddleware, byId, asyncHandler(documentController.deleteDocument));

router.get('/:id/download', authMiddleware, byId, asyncHandler(documentController.downloadDocument));
router.get('/:id/preview', authMiddleware, byId, asyncHandler(documentController.previewDocument));

router.get('/:id/versions', authMiddleware, byId, asyncHandler(documentController.getDocumentVersions));
router.get('/:id/versions/:versionId/download', authMiddleware, versionDownload, asyncHandler(documentController.downloadDocumentVersion));
router.post('/:id/replace', authMiddleware, upload.single('file'), replace, asyncHandler(documentController.replaceDocument));

router.patch('/:id/verify', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), byId, asyncHandler(documentController.verifyDocument));
router.patch('/:id/reject', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), reject, asyncHandler(documentController.rejectDocument));

module.exports = router;
