/**
 * Patient Model
 * Represents a patient in the system
 */

class Patient {
  constructor(data) {
    this.id = data.id;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.dateOfBirth = data.dateOfBirth;
    this.medicalRecordNumber = data.medicalRecordNumber;
    this.contact = data.contact;
    this.admissionDate = data.admissionDate;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validation methods
  static validate(data) {
    const errors = [];

    if (!data.firstName || data.firstName.trim().length === 0)  {  
        errors.push("First name is required");
    }

    if (!data.lastName || data.lastName.trim().length === 0) {
      errors.push("Last name is required");
    }

    // dateOfBirth is optional for quick nurse entry; when provided it must be a valid date
    if (data.dateOfBirth && !this.isValidDate(data.dateOfBirth)) {
      errors.push("Valid date of birth is required when provided");
    }

    if (!data.medicalRecordNumber || data.medicalRecordNumber.trim().length === 0) {
      errors.push("Medical record number is required");
    }

    if (data.contact && !this.isValidPhone(data.contact)) {
      errors.push("Valid contact number is required");
    }

    if (data.admissionDate && !this.isValidDate(data.admissionDate)) {
      errors.push("Valid admission date is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  static isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
  }

  // Calculate age
  getAge() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  // Convert to Firestore document
  toFirestore() {
    const data = {
      firstName: this.firstName ?? null,
      lastName: this.lastName ?? null,
      dateOfBirth: this.dateOfBirth ? new Date(this.dateOfBirth) : null,
      medicalRecordNumber: this.medicalRecordNumber ?? null,
      contact: this.contact ?? null,
      admissionDate: this.admissionDate ? new Date(this.admissionDate) : null,
      createdAt: this.createdAt ? new Date(this.createdAt) : null,
      updatedAt: this.updatedAt ? new Date(this.updatedAt) : null,
    };
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  // Create from Firestore document
  static fromFirestore(doc) {
    const data = doc.data();
    return new Patient({
      id: doc.id,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth?.toDate(),
      medicalRecordNumber: data.medicalRecordNumber,
      contact: data.contact,
      admissionDate: data.admissionDate?.toDate(),
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    });
  }

  // Get full name
  getFullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}

module.exports = Patient;
