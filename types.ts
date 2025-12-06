export enum Modality {
  CT = 'CT',
  MRI = 'MRI',
  XRAY = 'X-Ray',
  ULTRASOUND = 'Ultrasound',
  MAMMOGRAPHY = 'Mammography',
  FLUOROSCOPY = 'Fluoroscopy'
}

export type ReportType = 'Structural' | 'Descriptive';

export interface Template {
  id: string;
  name: string;
  type: ReportType;
  keywords: string[];
  content: string;
  modality: Modality;
  styleGuide?: string; // New field for learned style rules
}

export interface ReportInputs {
  studyDate: string;
  age: string;
  gender: 'M' | 'F';
  modality: Modality;
  anatomicalPart: string;
  findings: string;
  history: string;
  comparison: string;
  previousReportFindings: string;
  reportType: ReportType;
}

export interface LearningPoint {
  point: string;
  link?: string;
  linkText?: string;
}

export interface ReportResponse {
  draftReport: string;
  conciseSummary: string;
  safetyChecks: string[];
  learningPoints: LearningPoint[];
  impression: string;
  followUpRecommendation: string;
}

export interface ChecklistResponse {
  checklist: string[];
}

export interface ComparisonFinding {
  finding: string;
  location: string;
  previousSizeOrStatus: string;
  significance: 'Critical' | 'Monitor' | 'Incidental';
}

export interface ComparisonAnalysisResponse {
  targets: ComparisonFinding[];
  summary: string;
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  data: ReportResponse | null;
}

export interface SavedReport {
  id: string;
  timestamp: number;
  inputs: ReportInputs;
  data: ReportResponse;
}