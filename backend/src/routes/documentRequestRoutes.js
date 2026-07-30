const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const { upload } = require('../config/upload');
const documentRequestController = require('../controllers/documentRequestController');
const {
  create, update, uploadForRequest, reject, byId, byEmployeeId,
} = require('../validators/documentRequestValidator');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(documentRequestController.getRequests));
router.get('/my', authMiddleware, asyncHandler(documentRequestController.getMyRequests));
router.get('/employee/:employeeId', authMiddleware, byEmployeeId, asyncHandler(documentRequestController.getRequestsByEmployee));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), create, asyncHandler(documentRequestController.createRequest));

router.get('/:id', authMiddleware, byId, asyncHandler(documentRequestController.getRequestById));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), update, asyncHandler(documentRequestController.updateRequest));
router.patch('/:id/cancel', authMiddleware, byId, asyncHandler(documentRequestController.cancelRequest));
router.post('/:id/upload', authMiddleware, upload.single('file'), uploadForRequest, asyncHandler(documentRequestController.uploadForRequest));
router.patch('/:id/approve', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), byId, asyncHandler(documentRequestController.approveRequest));
router.patch('/:id/reject', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), reject, asyncHandler(documentRequestController.rejectRequest));

module.exports = router;
