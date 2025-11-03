const {db} = require("../config/firebaseConfig");
const Operation = require("../models/Operation");
const Patient = require("../models/Patient");
const Surgeon = require("../models/Surgeon");

class OperationService {
  /**
   * Create a new operation
   */
  static async createOperation(operationData) {
    try {
      if (operationData.operationDate && !(operationData.operationDate instanceof Date)) {
        operationData.operationDate = new Date(operationData.operationDate);
      }
      if (operationData.scheduledStartTime && !(operationData.scheduledStartTime instanceof Date)) {
        operationData.scheduledStartTime = new Date(operationData.scheduledStartTime);
      }
      if (operationData.actualStartTime && !(operationData.actualStartTime instanceof Date)) {
        operationData.actualStartTime = new Date(operationData.actualStartTime);
      }
      if (operationData.actualEndTime && !(operationData.actualEndTime instanceof Date)) {
        operationData.actualEndTime = new Date(operationData.actualEndTime);
      }

      // Validate operation data
      const validation = Operation.validate(operationData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Verify patient exists
      const patientDoc = await db.collection("patients").doc(operationData.patientId).get();
      if (!patientDoc.exists) {
        throw new Error("Patient not found");
      }

      // Verify surgeon exists if a surgeonId is provided. If not provided allow a surgeon name in operationData.surgeon
      if (operationData.surgeonId) {
        const surgeonDoc = await db.collection("surgeons").doc(operationData.surgeonId).get();
        if (!surgeonDoc.exists) {
          throw new Error("Surgeon not found");
        }
      }

      // Check for room conflicts
      if (operationData.operatingRoom && operationData.scheduledStartTime) {
        const conflictQuery = await db.collection("operations")
          .where("operatingRoom", "==", operationData.operatingRoom)
          .where("operationDate", "==", operationData.operationDate)
          .where("status", "in", ["scheduled", "in-progress"])
          .get();

        for (const doc of conflictQuery.docs) {
          const existingOp = Operation.fromFirestore(doc);
          if (existingOp.scheduledStartTime && operationData.scheduledStartTime) {
            const existingStart = new Date(existingOp.scheduledStartTime);
            const newStart = new Date(operationData.scheduledStartTime);
            const existingEnd = new Date(existingStart.getTime() + (4 * 60 * 60 * 1000)); // Assume 4 hours
            const newEnd = new Date(newStart.getTime() + (4 * 60 * 60 * 1000));

            if ((newStart >= existingStart && newStart < existingEnd) ||
                (newEnd > existingStart && newEnd <= existingEnd) ||
                (newStart <= existingStart && newEnd >= existingEnd)) {
              throw new Error("Operating room conflict detected");
            }
          }
        }
      }

      // Create operation
      const operation = new Operation({
        ...operationData,
        surgeonName: operationData.surgeon || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const docRef = await db.collection("operations").add(operation.toFirestore());

      return {
        success: true,
        data: {
          id: docRef.id,
          ...operation.toFirestore(),
        },
      };
    } catch (error) {
      console.error("Error creating operation:", error);
      throw new Error(`Failed to create operation: ${error.message}`);
    }
  }

  /**
   * Get operation by ID with populated data
   */
  static async getOperationById(operationId) {
    try {
      const operationDoc = await db.collection("operations").doc(operationId).get();

      if (!operationDoc.exists) {
        throw new Error("Operation not found");
      }

      const operation = Operation.fromFirestore(operationDoc);

      // Populate patient data
      try {
        const patientDoc = await db.collection("patients").doc(operation.patientId).get();
        if (patientDoc.exists) {
          operation.patient = Patient.fromFirestore(patientDoc);
        }
      } catch (error) {
        console.warn(`Failed to fetch patient for operation ${operationId}:`, error);
      }

      // Populate surgeon data
      try {
        const surgeonDoc = await db.collection("surgeons").doc(operation.surgeonId).get();
        if (surgeonDoc.exists) {
          operation.surgeon = Surgeon.fromFirestore(surgeonDoc);
        }
      } catch (error) {
        console.warn(`Failed to fetch surgeon for operation ${operationId}:`, error);
      }

      return {
        success: true,
        data: operation,
      };
    } catch (error) {
      console.error("Error getting operation:", error);
      throw new Error(`Failed to get operation: ${error.message}`);
    }
  }

  /**
   * Get operations with filtering and pagination
   */
  static async getOperations(filters = {}, page = 1, limit = 10) {
    try {
      let query = db.collection("operations");

      // Apply filters
      if (filters.patientId) {
        query = query.where("patientId", "==", filters.patientId);
      }
      if (filters.surgeonId) {
        query = query.where("surgeonId", "==", filters.surgeonId);
      }
      if (filters.nurseId) {
        query = query.where("nurseId", "==", filters.nurseId);
      }
      if (filters.status) {
        query = query.where("status", "==", filters.status);
      }
      if (filters.operatingRoom) {
        query = query.where("operatingRoom", "==", filters.operatingRoom);
      }
      if (filters.startDate) {
        query = query.where("operationDate", ">=", filters.startDate);
      }
      if (filters.endDate) {
        query = query.where("operationDate", "<=", filters.endDate);
      }

      // Order by operation date (most recent first)
      query = query.orderBy("operationDate", "desc");

      // Apply pagination
      const offset = (page - 1) * limit;
      const snapshot = await query.offset(offset).limit(limit).get();

      const operations = [];
      for (const doc of snapshot.docs) {
        const operation = Operation.fromFirestore(doc);

        // Populate patient data
        try {
          const patientDoc = await db.collection("patients").doc(operation.patientId).get();
          if (patientDoc.exists) {
            operation.patient = Patient.fromFirestore(patientDoc);
          }
        } catch (error) {
          console.warn(`Failed to fetch patient for operation ${operation.id}:`, error);
        }

        // Populate surgeon data
        try {
          const surgeonDoc = await db.collection("surgeons").doc(operation.surgeonId).get();
          if (surgeonDoc.exists) {
            operation.surgeon = Surgeon.fromFirestore(surgeonDoc);
          }
        } catch (error) {
          console.warn(`Failed to fetch surgeon for operation ${operation.id}:`, error);
        }

        operations.push(operation);
      }

      // Get total count for pagination
      const totalQuery = db.collection("operations");
      if (filters.patientId) totalQuery.where("patientId", "==", filters.patientId);
      if (filters.surgeonId) totalQuery.where("surgeonId", "==", filters.surgeonId);
      if (filters.nurseId) totalQuery.where("nurseId", "==", filters.nurseId);
      if (filters.status) totalQuery.where("status", "==", filters.status);
      if (filters.operatingRoom) totalQuery.where("operatingRoom", "==", filters.operatingRoom);
      if (filters.startDate) totalQuery.where("operationDate", ">=", filters.startDate);
      if (filters.endDate) totalQuery.where("operationDate", "<=", filters.endDate);

      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        success: true,
        data: {
          operations,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error("Error getting operations:", error);
      throw new Error(`Failed to get operations: ${error.message}`);
    }
  }

  /**
   * Update operation
   */
  static async updateOperation(operationId, updateData) {
    try {
      // Check if operation exists
      const operationDoc = await db.collection("operations").doc(operationId).get();
      if (!operationDoc.exists) {
        throw new Error("Operation not found");
      }

      // Validate update data
      const validation = Operation.validate(updateData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Check for room conflicts if room or time is being updated
      if (updateData.operatingRoom || updateData.scheduledStartTime || updateData.operationDate) {
        const existingOp = Operation.fromFirestore(operationDoc);
        const room = updateData.operatingRoom || existingOp.operatingRoom;
        const date = updateData.operationDate || existingOp.operationDate;
        const startTime = updateData.scheduledStartTime || existingOp.scheduledStartTime;

        if (room && date && startTime) {
          const conflictQuery = await db.collection("operations")
            .where("operatingRoom", "==", room)
            .where("operationDate", "==", date)
            .where("status", "in", ["scheduled", "in-progress"])
            .get();

          for (const doc of conflictQuery.docs) {
            if (doc.id !== operationId) {
              const conflictOp = Operation.fromFirestore(doc);
              if (conflictOp.scheduledStartTime) {
                const existingStart = new Date(conflictOp.scheduledStartTime);
                const newStart = new Date(startTime);
                const existingEnd = new Date(existingStart.getTime() + (4 * 60 * 60 * 1000));
                const newEnd = new Date(newStart.getTime() + (4 * 60 * 60 * 1000));

                if ((newStart >= existingStart && newStart < existingEnd) ||
                    (newEnd > existingStart && newEnd <= existingEnd) ||
                    (newStart <= existingStart && newEnd >= existingEnd)) {
                  throw new Error("Operating room conflict detected");
                }
              }
            }
          }
        }
      }

      // Update operation
      const updatePayload = {
        ...updateData,
        updatedAt: new Date(),
      };

      await db.collection("operations").doc(operationId).update(updatePayload);

      // Get updated operation
      const updatedOperationDoc = await db.collection("operations").doc(operationId).get();
      const updatedOperation = Operation.fromFirestore(updatedOperationDoc);

      return {
        success: true,
        data: updatedOperation,
      };
    } catch (error) {
      console.error("Error updating operation:", error);
      throw new Error(`Failed to update operation: ${error.message}`);
    }
  }

  /**
   * Delete operation (admin only)
   */
  static async deleteOperation(operationId) {
    try {
      // Check if operation exists
      const operationDoc = await db.collection("operations").doc(operationId).get();
      if (!operationDoc.exists) {
        throw new Error("Operation not found");
      }

      const operation = Operation.fromFirestore(operationDoc);

      // Only allow deletion of scheduled operations
      if (operation.status !== "scheduled") {
        throw new Error("Only scheduled operations can be deleted");
      }

      // Delete operation
      await db.collection("operations").doc(operationId).delete();

      return {
        success: true,
        data: {message: "Operation deleted successfully"},
      };
    } catch (error) {
      console.error("Error deleting operation:", error);
      throw new Error(`Failed to delete operation: ${error.message}`);
    }
  }

  /**
   * Get operations by date range
   */
  static async getOperationsByDateRange(startDate, endDate, page = 1, limit = 10) {
    try {
      const filters = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };

      return await this.getOperations(filters, page, limit);
    } catch (error) {
      console.error("Error getting operations by date range:", error);
      throw new Error(`Failed to get operations by date range: ${error.message}`);
    }
  }

  /**
   * Get today's operations
   */
  static async getTodaysOperations(page = 1, limit = 10) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const filters = {
        startDate: today,
        endDate: tomorrow,
      };

      return await this.getOperations(filters, page, limit);
    } catch (error) {
      console.error("Error getting today's operations:", error);
      throw new Error(`Failed to get today's operations: ${error.message}`);
    }
  }

  /**
   * Get operation statistics
   */
  static async getOperationStats(startDate, endDate) {
    try {
      let query = db.collection("operations");

      if (startDate) {
        query = query.where("operationDate", ">=", startDate);
      }
      if (endDate) {
        query = query.where("operationDate", "<=", endDate);
      }

      const snapshot = await query.get();

      const stats = {
        totalOperations: 0,
        completedOperations: 0,
        cancelledOperations: 0,
        inProgressOperations: 0,
        scheduledOperations: 0,
        totalDuration: 0,
        averageDuration: 0,
        operationsByRoom: {},
        operationsByType: {},
      };

      let totalDurationMinutes = 0;
      let completedCount = 0;

      snapshot.forEach((doc) => {
        const operation = Operation.fromFirestore(doc);
        stats.totalOperations++;

        // Count by status
        switch (operation.status) {
        case "completed":
          stats.completedOperations++;
          if (operation.actualStartTime && operation.actualEndTime) {
            const duration = operation.getDuration();
            if (duration) {
              totalDurationMinutes += duration.totalMinutes;
              completedCount++;
            }
          }
          break;
        case "cancelled":
          stats.cancelledOperations++;
          break;
        case "in-progress":
          stats.inProgressOperations++;
          break;
        case "scheduled":
          stats.scheduledOperations++;
          break;
        }

        // Count by room
        if (operation.operatingRoom) {
          stats.operationsByRoom[operation.operatingRoom] =
            (stats.operationsByRoom[operation.operatingRoom] || 0) + 1;
        }

        // Count by type
        if (operation.operationType) {
          stats.operationsByType[operation.operationType] =
            (stats.operationsByType[operation.operationType] || 0) + 1;
        }
      });

      if (completedCount > 0) {
        stats.averageDuration = Math.round(totalDurationMinutes / completedCount);
        stats.totalDuration = totalDurationMinutes;
      }

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("Error getting operation stats:", error);
      throw new Error(`Failed to get operation stats: ${error.message}`);
    }
  }
}

module.exports = OperationService;
