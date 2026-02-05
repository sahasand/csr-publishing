/**
 * Validation Module
 *
 * Exports all validation functionality including:
 * - Document validation runner
 * - Package-level validation
 * - Individual check functions
 */

// Document validation runner
export {
  runValidation,
  runValidationAndUpdateStatus,
  type ValidationResultItem,
  type ValidationSummary,
} from './runner';

// Package-level validation
export {
  validatePackage,
  formatValidationReport,
  serializeValidationReport,
  type ValidationIssue,
  type FileValidationResult,
  type CrossReferenceResult,
  type PackageValidationReport,
  type PackageValidationOptions,
  type ValidationSeverity,
} from './package-validator';

// Check functions and registry
export {
  getCheckFunction,
  hasCheckFunction,
  getAvailableCheckFunctions,
  type CheckFunction,
  type CheckResult,
  type ValidationCheckResult,
} from './checks';

// XML validation
export {
  validateIndexXml,
  validateUsRegionalXml,
  validateEctdXml,
  formatXmlValidationReport,
  type XmlValidationSeverity,
  type XmlValidationIssue,
  type XmlValidationResult,
  type XmlValidationOptions,
} from './xml-validator';
