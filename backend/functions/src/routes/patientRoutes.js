const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/patientController');
const { verifyToken, requireNurseOrAdmin } = require('../middlewares/verifyToken');

// All patient routes require authentication
router.use(verifyToken);

// Patient CRUD operations
router.post('/', requireNurseOrAdmin, PatientController.createPatient);
router.get('/', PatientController.getAllPatients);
router.get('/search', PatientController.searchPatients);
router.get('/stats', PatientController.getPatientStats);
router.get('/:id', PatientController.getPatient);
router.put('/:id', requireNurseOrAdmin, PatientController.updatePatient);
router.delete('/:id', requireNurseOrAdmin, PatientController.deletePatient);

module.exports = router;
