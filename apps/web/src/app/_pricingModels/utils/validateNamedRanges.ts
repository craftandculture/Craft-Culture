import ExcelJS from 'exceljs';

const EXPECTED_NAMED_RANGES: Record<string, string> = {};

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const validateNamedRanges = (workbook: ExcelJS.Workbook): ValidationResult => {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const definedNames = workbook.definedNames.model || [];

  for (const [rangeName] of Object.entries(EXPECTED_NAMED_RANGES)) {
    const found = definedNames.find((name) => name.name === rangeName);

    if (!found) {
      errors.push({
        type: 'error',
        message: `Missing required named range: ${rangeName}`,
        field: rangeName,
      });
    }
  }

  if (definedNames.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'No named ranges found in the workbook',
    });
  }

  const duplicateNames = definedNames
    .map((name) => name.name)
    .filter((name, index, arr) => arr.indexOf(name) !== index);

  if (duplicateNames.length > 0) {
    warnings.push({
      type: 'warning',
      message: `Duplicate named ranges found: ${duplicateNames.join(', ')}`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export default validateNamedRanges;
