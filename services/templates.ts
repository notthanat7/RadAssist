import { Modality, ReportType, Template } from "../types";

const CUSTOM_TEMPLATES_KEY = 'radassist_custom_templates';

const DEFAULT_TEMPLATES: Record<string, Template[]> = {
  [Modality.CT]: [
    // --- CHEST TEMPLATES ---
    {
      id: 'ct_chest_learned',
      name: 'MDCT Chest (Standard)',
      modality: Modality.CT,
      type: 'Structural',
      keywords: ['chest', 'thorax', 'lung', 'routine'],
      content: `MDCT SCAN OF THE CHEST

HISTORY: {{HISTORY}}

TECHNIQUES: Axial scans of the chest were performed with IV contrast material according to the standard protocol.

COMPARISON: {{COMPARISON}}

FINDINGS: 
TUBES/LINES: None.
LUNGS/MAJOR AIRWAYS: Normal lung volumes. Clear lungs. Patent airways.
PLEURA: No effusion or pneumothorax.
DIAPHRAGM: Normal position.
HEART/PERICARDIUM/GREAT VESSELS: Normal heart size. No pericardial effusion.
MEDIASTINUM: Normal visualized thyroid. No lymph node enlargement.
CHEST WALL/AXILLA: No mass.
BONES: No suspicious lytic lesion.
INCLUDED UPPER ABDOMEN: Visualized portions are unremarkable.`
    },
    {
      id: 'ct_pa_learned',
      name: 'CT Pulmonary Angiogram (CTPA)',
      modality: Modality.CT,
      type: 'Structural',
      keywords: ['pe', 'pulmonary embolism', 'ctpa', 'angiogram', 'embolus'],
      content: `MDCT ANGIOGRAPHY SCAN OF THE PULMONARY ARTERIES

HISTORY: {{HISTORY}}

TECHNIQUES: Axial CTA scans of the chest were performed without and with IV contrast material according to the standard protocol.

COMPARISON: {{COMPARISON}}

FINDINGS: 
ADEQUACY: Optimal contrast opacification in pulmonary arteries. No significant respiratory or cardiac motion artifacts.
PULMONARY ARTERIES: No filling defects in the pulmonary arteries. MPA diameter = [..] cm.
RV/LV RATIO: <1, which is normal.
PULMONARY PERFUSION: Normal.

TUBES/LINES: None.
LUNGS/MAJOR AIRWAYS: Normal lung volumes. Clear lungs. Patent airways.
PLEURA: No effusion or pneumothorax.
DIAPHRAGM: Normal position.
HEART/PERICARDIUM/GREAT VESSELS: Normal heart size. No pericardial effusion.
MEDIASTINUM: Normal visualized thyroid. No lymph node enlargement.
CHEST WALL/AXILLA: No mass.
BONES: No suspicious lytic lesion.
INCLUDED UPPER ABDOMEN: Normal allowing scan technique and phase of contrast enhancement.`
    },
    
    // --- TRAUMA TEMPLATES ---
    {
      id: 'ct_trauma_body_learned',
      name: 'MDCT Trauma (Chest + Abd + Pelvis)',
      modality: Modality.CT,
      type: 'Structural',
      keywords: ['trauma', 'whole body', 'pan scan', 'mva', 'accident', 'injury'],
      content: `WHOLE-BODY MDCT FOR TRAUMA 
CHEST+WHOLE ABDOMEN

HISTORY: {{HISTORY}}

TECHNIQUES: Axial scans of the chest and whole abdomen were performed with IV contrast material according to standard protocol.

COMPARISON: {{COMPARISON}}

FINDINGS:
TUBES/LINES: None.
LUNGS/MAJOR AIRWAYS: Patent airways. No lung contusion or laceration.
PLEURA: No hemo- or pneumothorax.
DIAPHRAGM: Normal position. 
AORTA: No injury.
HEART/MEDIASTINUM: No pericardial fluid. No pneumomediastinum.

SOLID ORGANS: No injuries of the liver, spleen, pancreas, kidneys or adrenal glands. 
GB/BILE DUCTS: No dilatation. 
GI TRACT/MESENTERY: No wall thickening or fat stranding.
NON-AORTIC VESSELS: Unremarkable.
BLADDER/PELVIC ORGANS: Normal.
PERITONEUM/RETROPERITONEUM: No free fluid or extraluminal air.

PELVIS: No fracture.
SPINE: No fracture. 
OTHER BONES: No fracture.
ABDOMINAL WALL/SOFT TISSUES: Unremarkable.`
    },
    {
      id: 'ct_trauma_brain_learned',
      name: 'MDCT Trauma (Brain + C-Spine)',
      modality: Modality.CT,
      type: 'Structural',
      keywords: ['trauma', 'brain', 'head', 'c-spine', 'cervical', 'neck'],
      content: `WHOLE BODY MDCT FOR TRAUMA
BRAIN, C-SPINE, FACE & HEAD/NECK ARTERIES

HISTORY: {{HISTORY}}

TECHNIQUE: Axial scans were performed from the vertex to T1 without/with IV contrast according to standard protocol.

COMPARISON: {{COMPARISON}}

FINDINGS:
BRAIN PARENCHYMA/EXTRA-AXIAL SPACES: No intracranial hemorrhage, acute large territorial infarction or extra-axial collection. Appropriate brain volume for age.
MIDLINE SHIFT/HERNIATION: No midline shift or brain herniation. 
VENTRICLES: No hydrocephalus. 

SKULL/SKULL BASE/MASTOIDS: Normal. 
FACE: Normal. 

SPINAL ALIGNMENT: Normal.
CRANIOCERVICAL JUNCTION: No fracture or dislocation. 
SUBAXIAL CERVICAL SPINE: No fracture or dislocation.

THYROID/NECK SOFT TISSUES: No injury.
CRANIOCERVICAL ARTERIES: No injury.`
    },

    // --- ABDOMEN TEMPLATES ---
    {
      id: 'ct_whole_abdomen_learned',
      name: 'MDCT Whole Abdomen (Standard)',
      modality: Modality.CT,
      type: 'Structural',
      keywords: ['whole abdomen', 'abdomen', 'abd', 'lower abdomen', 'upper abdomen'],
      content: `MDCT SCAN OF THE WHOLE ABDOMEN

HISTORY: {{HISTORY}}

TECHNIQUES: Axial scan of the whole abdomen was performed with IV contrast material according to the standard protocol.

COMPARISON: {{COMPARISON}}

FINDINGS: 
LIVER: Normal size. No focal lesions.
HEPATIC VESSELS: Patent.
GALLBLADDER/BILE DUCTS: No wall thickening, calcified gallstones or pericholecystic fat stranding. No duct dilatation.
SPLEEN: Normal size. No focal lesions.
PANCREAS: No stone or duct dilatation.

ADRENALS: No nodule.
KIDNEYS/URETERS: No stone, hydronephrosis or solid mass.
BLADDER: Normal.
PELVIC ORGANS: Normal.

GI TRACT: No distension or wall thickening.
PERITONEUM/RETROPERITONEUM: No free fluid, fluid collection or free air.
OTHER VESSELS: Normal.
LYMPH NODES: No enlargement.

ABDOMINAL WALL/BONES: Unremarkable.
LOWER THORAX: Unremarkable.`
    },
    {
      id: 'ct_upper_abdomen_descriptive',
      name: 'CT Upper Abdomen (Descriptive)',
      modality: Modality.CT,
      type: 'Descriptive',
      keywords: ['upper abdomen', 'abd upper'],
      content: `CT SCAN OF UPPER ABDOMEN
HISTORY: {{HISTORY}}
TECHNIQUES: The CT scan of upper abdomen was performed on precontrast and postcontrast phases, using 1.25 mm slice thickness.
COMPARISON STUDY: {{COMPARISON}}
FINDINGS:
The study reveals normal sized liver with homogeneous density of liver parenchyma. No definite liver mass or biliary dilatation is found.
Portal vein and hepatic veins are patent.
Gallbladder has smooth, thin wall without opaque gallstone.
Spleen, pancreas, bilateral adrenal glands are unremarkable.
Both kidneys have normal size and symmetrical enhancement without stone or hydronephrosis.
Stomach and visualized bowels are unremarkable.
No ascites, peritoneal nodule or significant intraabdominal lymphadenopathy is found.
No bony destruction is found.
Both basal lungs are unremarkable.`
    }
  ],
  [Modality.MRI]: [
    {
      id: 'mri_brain_standard',
      name: 'MRI Brain (Standard)',
      modality: Modality.MRI,
      type: 'Descriptive',
      keywords: ['brain', 'head'],
      content: `MRI OF THE BRAIN
HISTORY: {{HISTORY}}
TECHNIQUES: Multiplanar multisequence MRI of the brain.
COMPARISON STUDY: {{COMPARISON}}
FINDINGS:
- Brain parenchyma shows normal signal intensity. No infarction, hemorrhage, or mass lesion is seen.
- Ventricles and sulci are prominent commensurate with age.
- Midline structures are centered.
- Brainstem and cerebellum are unremarkable.
- Major intracranial flow voids are preserved.
- Paranasal sinuses and mastoid air cells are clear.`
    }
  ],
  [Modality.ULTRASOUND]: [
     {
      id: 'us_whole_abdomen_standard',
      name: 'US Whole Abdomen (Standard)',
      modality: Modality.ULTRASOUND,
      type: 'Structural',
      keywords: ['whole abdomen', 'abdomen'],
      content: `ULTRASOUND OF WHOLE ABDOMEN
HISTORY: {{HISTORY}}
COMPARISON STUDY: {{COMPARISON}}
FINDINGS:
- LIVER: Normal size and homogeneous echogenicity. No focal mass.
- BILIARY SYSTEM: Gallbladder is well-distended with thin wall. No gallstone. CBD is not dilated.
- PANCREAS: Visualized portion is normal in size and echogenicity.
- SPLEEN: Normal size and echotexture.
- KIDNEYS: Normal size and cortical thickness bilaterally. No hydronephrosis or calculi.
- AORTA: Normal caliber.
- URINARY BLADDER: Well-distended with smooth wall.
- INTRAPERITONEAL: No free fluid or collection seen.`
    }
  ],
  [Modality.XRAY]: [
    {
      id: 'cxr_standard',
      name: 'Chest X-Ray (Standard)',
      modality: Modality.XRAY,
      type: 'Structural',
      keywords: ['chest', 'cxr'],
      content: `CHEST RADIOGRAPH
HISTORY: {{HISTORY}}
COMPARISON: {{COMPARISON}}
FINDINGS:
- LUNGS: Clear. No focal consolidation, pleural effusion, or pneumothorax.
- HEART: Cardiomediastinal silhouette is normal.
- VESSELS: Pulmonary vasculature is normal.
- BONES: Osseous structures are unremarkable.`
    }
  ]
};

// Retrieve custom templates from localStorage
export const getCustomTemplates = (): Template[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load custom templates", e);
    return [];
  }
};

export const saveCustomTemplate = (template: Template) => {
  try {
    const current = getCustomTemplates();
    const updated = [...current, template];
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save custom template", e);
  }
};

export const updateCustomTemplate = (template: Template) => {
  try {
    const current = getCustomTemplates();
    const index = current.findIndex(t => t.id === template.id);
    if (index !== -1) {
      current[index] = template;
      localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.error("Failed to update template", e);
  }
};

export const deleteCustomTemplate = (id: string) => {
  try {
    const current = getCustomTemplates();
    const updated = current.filter(t => t.id !== id);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
  } catch (e) {
     console.error("Failed to delete template", e);
  }
};

export const getTemplate = (modality: Modality, anatomicalPart: string, reportType: ReportType): string | null => {
  const search = anatomicalPart.toLowerCase();
  
  // 1. Search CUSTOM templates first
  const customTemplates = getCustomTemplates();
  const customMatches = customTemplates.filter(t => t.modality === modality && t.keywords.some(k => search.includes(k)));
  
  // Exact type match in custom
  const customExact = customMatches.find(t => t.type === reportType);
  if (customExact) return customExact.content;
  
  // REMOVED: Fallback to any custom match. This prevents Style mixing.
  // if (customMatches.length > 0) return customMatches[0].content;

  // 2. Search DEFAULT templates
  const group = DEFAULT_TEMPLATES[modality];
  if (!group) return null;

  const defaultMatches = group.filter(t => t.type === reportType);
  const exactMatch = defaultMatches.find(t => t.keywords.some(k => search.includes(k)));
  
  if (exactMatch) return exactMatch.content;

  // Fallback to any match in the SAME TYPE group
  const looseMatch = defaultMatches.find(t => t.keywords.some(k => search.includes(k)));
  return looseMatch ? looseMatch.content : null;
};