const { db } = require('../config/firebaseConfig');
const Patient = require('../models/Patient');

class PatientService {
  /**
   * Create a new patient
   */
  static async createPatient(patientData) {
    try {

    if (patientData.dateOfBirth && !(patientData.dateOfBirth instanceof Date)) {
      patientData.dateOfBirth = new Date(patientData.dateOfBirth);
    }
    if (patientData.admissionDate && !(patientData.admissionDate instanceof Date)) {
      patientData.admissionDate = new Date(patientData.admissionDate);
    }

      // Validate patient data
      const validation = Patient.validate(patientData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if medical record number already exists
      const existingPatient = await db.collection('patients')
        .where('medicalRecordNumber', '==', patientData.medicalRecordNumber)
        .limit(1)
        .get();

      if (!existingPatient.empty) {
        throw new Error('Patient with this medical record number already exists');
      }

      // Create patient
      const patient = new Patient({
        ...patientData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const docRef = await db.collection('patients').add(patient.toFirestore());

      return {
        success: true,
        data: {
          id: docRef.id,
          ...patient.toFirestore()
        }
      };
    } catch (error) {
      console.error('Error creating patient:', error);
      throw new Error(`Failed to create patient: ${error.message}`);
    }
  }

  /**
   * Get patient by ID
   */
  static async getPatientById(patientId) {
    try {
      const patientDoc = await db.collection('patients').doc(patientId).get();
      
      if (!patientDoc.exists) {
        throw new Error('Patient not found');
      }

      return {
        success: true,
        data: Patient.fromFirestore(patientDoc)
      };
    } catch (error) {
      console.error('Error getting patient:', error);
      throw new Error(`Failed to get patient: ${error.message}`);
    }
  }

  /**
   * Get all patients with pagination
   */
  static async getAllPatients(page = 1, limit = 10, searchTerm = '') {
    try {
      let query = db.collection('patients').orderBy('createdAt', 'desc');

      // Apply search filter if provided
      if (searchTerm) {
        // Note: Firestore doesn't support full-text search, so we'll filter by name
        query = query.where('firstName', '>=', searchTerm)
                    .where('firstName', '<=', searchTerm + '\uf8ff');
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      const snapshot = await query.offset(offset).limit(limit).get();

      const patients = [];
      snapshot.forEach(doc => {
        patients.push(Patient.fromFirestore(doc));
      });

      // Get total count for pagination
      const totalSnapshot = await db.collection('patients').get();
      const total = totalSnapshot.size;

      return {
        success: true,
        data: {
          patients,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      console.error('Error getting patients:', error);
      throw new Error(`Failed to get patients: ${error.message}`);
    }
  }

  /**
   * Update patient
   */
  static async updatePatient(patientId, updateData) {
    try {

    if (updateData.dateOfBirth && !(updateData.dateOfBirth instanceof Date)) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }
    if (updateData.admissionDate && !(updateData.admissionDate instanceof Date)) {
      updateData.admissionDate = new Date(updateData.admissionDate);
    }

      // Check if patient exists
      const patientDoc = await db.collection('patients').doc(patientId).get();
      if (!patientDoc.exists) {
        throw new Error('Patient not found');
      }

      // Validate update data
      const validation = Patient.validate(updateData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if medical record number is being changed and already exists
      if (updateData.medicalRecordNumber) {
        const existingPatient = await db.collection('patients')
          .where('medicalRecordNumber', '==', updateData.medicalRecordNumber)
          .get();

        const duplicateExists = existingPatient.docs.some(doc => doc.id !== patientId);
        if (duplicateExists) {
          throw new Error('Patient with this medical record number already exists');
        }
      }

      // Update patient
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      await db.collection('patients').doc(patientId).update(updatePayload);

      // Get updated patient
      const updatedPatientDoc = await db.collection('patients').doc(patientId).get();
      const updatedPatient = Patient.fromFirestore(updatedPatientDoc);

      return {
        success: true,
        data: updatedPatient
      };
    } catch (error) {
      console.error('Error updating patient:', error);
      throw new Error(`Failed to update patient: ${error.message}`);
    }
  }

  /**
   * Delete patient (soft delete by setting a deleted flag)
   */
  static async deletePatient(patientId) {
    try {
      // Check if patient exists
      const patientDoc = await db.collection('patients').doc(patientId).get();
      if (!patientDoc.exists) {
        throw new Error('Patient not found');
      }

      // Check if patient has any operations
      const operationsQuery = await db.collection('operations')
        .where('patientId', '==', patientId)
        .limit(1)
        .get();

      if (!operationsQuery.empty) {
        throw new Error('Cannot delete patient with existing operations');
      }

      // Soft delete by adding deleted flag
      await db.collection('patients').doc(patientId).update({
        deleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      return {
        success: true,
        data: { message: 'Patient deleted successfully' }
      };
    } catch (error) {
      console.error('Error deleting patient:', error);
      throw new Error(`Failed to delete patient: ${error.message}`);
    }
  }

  /**
   * Search patients by name or medical record number
   */
  static async searchPatients(searchTerm, limit = 10) {
    try {
      const results = [];

      // Search by first name
      const firstNameQuery = await db.collection('patients')
        .where('firstName', '>=', searchTerm)
        .where('firstName', '<=', searchTerm + '\uf8ff')
        .limit(limit)
        .get();

      firstNameQuery.forEach(doc => {
        results.push(Patient.fromFirestore(doc));
      });

      // Search by last name
      const lastNameQuery = await db.collection('patients')
        .where('lastName', '>=', searchTerm)
        .where('lastName', '<=', searchTerm + '\uf8ff')
        .limit(limit)
        .get();

      lastNameQuery.forEach(doc => {
        // Avoid duplicates
        if (!results.find(p => p.id === doc.id)) {
          results.push(Patient.fromFirestore(doc));
        }
      });

      // Search by medical record number
      const mrnQuery = await db.collection('patients')
        .where('medicalRecordNumber', '==', searchTerm)
        .limit(limit)
        .get();

      mrnQuery.forEach(doc => {
        // Avoid duplicates
        if (!results.find(p => p.id === doc.id)) {
          results.push(Patient.fromFirestore(doc));
        }
      });

      return {
        success: true,
        data: results.slice(0, limit)
      };
    } catch (error) {
      console.error('Error searching patients:', error);
      throw new Error(`Failed to search patients: ${error.message}`);
    }
  }
}

module.exports = PatientService;
