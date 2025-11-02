const { auth, db } = require('../config/firebaseConfig');
const User = require('../models/User');

class AuthService {
  /**
   * Create a new user with role assignment
   */
  static async createUser(email, password, role, additionalData = {}) {
    try {
      // Validate role
      if (!['nurse', 'surgeon', 'admin'].includes(role)) {
        throw new Error('Invalid role. Must be nurse, surgeon, or admin');
      }

      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email,
        password,
        emailVerified: false
      });

      // Set custom claims for role
      await auth.setCustomUserClaims(userRecord.uid, {
        role: role
      });

      // Create user document in Firestore
      const userData = new User({
        uid: userRecord.uid,
        email,
        role,
        createdAt: new Date()
      });

      await db.collection('users').doc(userRecord.uid).set(userData.toFirestore());

      // If role is nurse or surgeon, create corresponding profile
      if (role === 'nurse' || role === 'surgeon') {
        const profileData = {
          userId: userRecord.uid,
          firstName: additionalData.firstName || '',
          lastName: additionalData.lastName || '',
          contact: additionalData.contact || '',
          createdAt: new Date()
        };

        if (role === 'nurse') {
          profileData.department = additionalData.department || '';
          profileData.licenseNumber = additionalData.licenseNumber || '';
          await db.collection('nurses').doc(userRecord.uid).set(profileData);
        } else if (role === 'surgeon') {
          profileData.specialization = additionalData.specialization || '';
          profileData.licenseNumber = additionalData.licenseNumber || '';
          await db.collection('surgeons').doc(userRecord.uid).set(profileData);
        }
      }

      return {
        success: true,
        data: {
          uid: userRecord.uid,
          email: userRecord.email,
          role: role
        }
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(uid) {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      return {
        success: true,
        data: User.fromFirestore(userDoc)
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Get user profile with role-specific data
   */
  static async getUserProfile(uid) {
    try {
      // Get basic user data
      const userResult = await this.getUserById(uid);
      if (!userResult.success) {
        throw new Error('User not found');
      }

      const user = userResult.data;
      let profileData = null;

      // Get role-specific profile data
      if (user.role === 'nurse') {
        const nurseQuery = await db.collection('nurses')
          .where('userId', '==', uid)
          .limit(1)
          .get();
        
        if (!nurseQuery.empty) {
          const nurseDoc = nurseQuery.docs[0];
          const nurseData = nurseDoc.data();
          profileData = {
            id: nurseDoc.id,
            firstName: nurseData.firstName,
            lastName: nurseData.lastName,
            department: nurseData.department,
            licenseNumber: nurseData.licenseNumber,
            contact: nurseData.contact
          };
        }
      } else if (user.role === 'surgeon') {
        const surgeonQuery = await db.collection('surgeons')
          .where('userId', '==', uid)
          .limit(1)
          .get();
        
        if (!surgeonQuery.empty) {
          const surgeonDoc = surgeonQuery.docs[0];
          const surgeonData = surgeonDoc.data();
          profileData = {
            id: surgeonDoc.id,
            firstName: surgeonData.firstName,
            lastName: surgeonData.lastName,
            specialization: surgeonData.specialization,
            licenseNumber: surgeonData.licenseNumber,
            contact: surgeonData.contact
          };
        }
      }

      return {
        success: true,
        data: {
          ...user,
          profile: profileData
        }
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(uid, newRole) {
    try {
      if (!['nurse', 'surgeon', 'admin'].includes(newRole)) {
        throw new Error('Invalid role. Must be nurse, surgeon, or admin');
      }

      // Update custom claims
      await auth.setCustomUserClaims(uid, {
        role: newRole
      });

      // Update user document
      await db.collection('users').doc(uid).update({
        role: newRole,
        updatedAt: new Date()
      });

      return {
        success: true,
        data: { uid, role: newRole }
      };
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  }

  /**
   * Delete user (admin only)
   */
  static async deleteUser(uid) {
    try {
      // Delete from Firebase Auth
      await auth.deleteUser(uid);

      // Delete user document
      await db.collection('users').doc(uid).delete();

      // Delete role-specific profile
      const nurseQuery = await db.collection('nurses')
        .where('userId', '==', uid)
        .get();
      
      if (!nurseQuery.empty) {
        const batch = db.batch();
        nurseQuery.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      const surgeonQuery = await db.collection('surgeons')
        .where('userId', '==', uid)
        .get();
      
      if (!surgeonQuery.empty) {
        const batch = db.batch();
        surgeonQuery.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      return {
        success: true,
        data: { message: 'User deleted successfully' }
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

module.exports = AuthService;
