import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReportInputs, ReportResponse, ChecklistResponse, ComparisonAnalysisResponse, Template, Modality, ReportType } from "../types";
import { getTemplate } from "./templates";
import { getCustomTemplates } from "./templates";

const BASE_SYSTEM_INSTRUCTION = `
You are an advanced AI Radiology Report Assistant. You have been trained on a specific dataset of high-quality radiologist reports. 
Your goal is to mimic the structure, tone, and specific vocabulary of these reports exactly based on the requested style.

*** DRAFT FINDINGS INTERPRETATION RULES (CRITICAL) ***

1. **DIAGNOSIS EXPANSION (FOR ACUTE/SIGNIFICANT PATHOLOGY)**:
   - If the user inputs a **diagnosis** or **specific sign** (e.g., "Acute PE", "Appendicitis", "Small bowel obstruction", "HCC"), you MUST generate the **associated radiological findings** for that diagnosis.
   - **Do NOT** just repeat the diagnosis name in the findings. Describe the features that support it.
   - **Include Pertinent Negatives**: Mention what is NOT seen that is relevant to the diagnosis (e.g., for PE, mention "No lung infarction" or "No right heart strain"; for Appendicitis, mention "No abscess" or "No free fluid").
   - *Example Input*: "Acute PE at RUL segmental arteries"
   - *Example Output*: "Filling defect identified within the right upper lobe segmental pulmonary arteries. No associated lung consolidation or infarction is seen."

2. **CONCISENESS FOR INCIDENTAL/BENIGN FINDINGS**:
   - If the user inputs a **benign** or **incidental** finding (e.g., cysts, granulomas, degenerative changes), keep the description **extremely concise**.
   - **Do NOT** over-describe or use flowery language.
   - *Example Input*: "0.8cm right renal cyst"
   - *Example Output*: "A 0.8 cm right renal cyst." (NOT "There is a 0.8 cm thin-walled cystic lesion favors cyst").

*** GENERAL STYLE GUIDELINES ***

1. **MANDATORY VOCABULARY (USE THESE PHRASES)**:
   - **Normals**: Use "Unremarkable" or "Normal size. No focal lesions."
   - **Kidneys (Normal)**: "No stone, hydronephrosis or solid mass." or "Normal size with symmetrical enhancement without stone or hydronephrosis."
   - **Gallbladder (Normal)**: "No wall thickening, calcified gallstones or pericholecystic fat stranding." or "Smooth, thin wall."
   - **Bile Ducts (Normal)**: "No duct dilatation."
   - **Vessels (Normal)**: "Patent."
   - **GI Tract (Normal)**: "No distension or wall thickening."
   - **Peritoneum (Normal)**: "No free fluid, fluid collection or free air."
   - **Lymph Nodes (Normal)**: "No enlargement." or "No significant lymphadenopathy."
   - **Bones (Normal)**: "No gross bony destruction." or "Degenerative change of visualized spines."
   - **Lungs (Normal)**: "No definite pulmonary nodule or infiltration is detected." or "Clear lungs. Patent airways."
   - **Trauma Specifics (Normal)**:
     - Use "No injury" for Solid Organs, Aorta, etc.
     - Use "No fracture" for Bones.
     - Use "No hemo- or pneumothorax."

2. **REPORT GENERATION LOGIC**:
   - **Comparison**: If a comparison study is provided, explicitly state "Unchanged [finding]" or "Increased/Decreased size of [finding]".
   - **Pathology**: Describe lesions clearly with dimensions (e.g., "A 1.5 cm cyst...").
   - **Impressions**:
     - Must be a bulleted list using hyphens "- ".
     - Start with the most critical finding.
     - Keep it concise.
     - Example: "- Acute appendicitis with localized peritonitis."

3. **SAFETY & LEARNING**:
   - Flag laterality errors (Right vs Left).
   - Provide 1-2 high-yield learning points relevant to the findings.

OUTPUT FORMAT:
Return a JSON object with:
- draftReport: The full findings body (Formatted according to specific style rules).
- conciseSummary: A telegraphic summary.
- impression: The impression section (bulleted list).
- safetyChecks: Array of warning strings.
- learningPoints: Array of educational objects.
- followUpRecommendation: String or empty.
`;

const STRUCTURAL_INSTRUCTION = `
*** STRUCTURAL REPORT GUIDELINES (STRICT ADHERENCE REQUIRED) ***

1. **FORMATTING**:
   - Use **UPPERCASE HEADERS** followed by a colon (e.g., "LIVER:", "KIDNEYS/URETERS:") for each organ system.
   - **CRITICAL**: The report must be a **VERTICAL LIST**.
   - **CRITICAL**: **EVERY** organ section MUST start on a **NEW LINE**.
   - **CRITICAL**: **EVERY** line MUST start with a **HYPHEN (-)** to separate findings clearly.
     - *Correct Format*:
       - LIVER: Normal size.
       - SPLEEN: Unremarkable.
       - KIDNEYS: A 0.8 cm right renal cyst.
   - Do NOT use continuous prose paragraphs. Use a structured list format with hyphens.

2. **ORGAN ORDERING (For Routine Scans)**:
   - **CT WHOLE ABDOMEN**: LIVER -> HEPATIC VESSELS -> GALLBLADDER/BILE DUCTS -> SPLEEN -> PANCREAS -> ADRENALS -> KIDNEYS/URETERS -> BLADDER -> PELVIC ORGANS -> GI TRACT -> PERITONEUM/RETROPERITONEUM -> OTHER VESSELS -> LYMPH NODES -> ABDOMINAL WALL/BONES -> LOWER THORAX.
   - **CT CHEST**: TUBES/LINES -> LUNGS/MAJOR AIRWAYS -> PLEURA -> DIAPHRAGM -> HEART/PERICARDIUM/GREAT VESSELS -> MEDIASTINUM -> CHEST WALL/AXILLA -> BONES -> INCLUDED UPPER ABDOMEN.
   - **CT TRAUMA**: TUBES/LINES -> LUNGS/MAJOR AIRWAYS -> PLEURA -> DIAPHRAGM -> AORTA -> HEART/MEDIASTINUM -> SOLID ORGANS -> GB/BILE DUCTS -> GI TRACT/MESENTERY -> NON-AORTIC VESSELS -> BLADDER/PELVIC ORGANS -> PERITONEUM/RETROPERITONEUM -> PELVIS -> SPINE -> OTHER BONES -> ABDOMINAL WALL/SOFT TISSUES.
`;

const DESCRIPTIVE_INSTRUCTION = `
*** DESCRIPTIVE REPORT GUIDELINES (STRICT ADHERENCE REQUIRED) ***

1. **FORMATTING**:
   - Write in **continuous prose** (paragraphs) OR simple bulleted sentences without headers.
   - **DO NOT** use uppercase headers like "LIVER:" or "SPLEEN:" at the start of sentences.
   - Group findings logically (e.g., Solid organs in one paragraph, hollow viscus in another, bones/soft tissues in another).
   - Use complete sentences (e.g., "The liver is normal in size." rather than "LIVER: Normal.").
   - Flow should be natural and narrative.
`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    draftReport: {
      type: Type.STRING,
      description: "The main findings section. Follow the requested report style (Structural or Descriptive) and vocabulary rules.",
    },
    conciseSummary: {
      type: Type.STRING,
      description: "A shortened, telegraphic summary of the report removing filler words.",
    },
    impression: {
      type: Type.STRING,
      description: "The impression section. Must be a bulleted list starting with hyphens '- '.",
    },
    safetyChecks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of safety warnings, laterality checks, or missing data requests.",
    },
    learningPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          point: { type: Type.STRING, description: "The educational content/tip." },
          link: { type: Type.STRING, description: "A Google Search URL for the guideline/topic." },
          linkText: { type: Type.STRING, description: "Title of the external resource." }
        },
        required: ["point"]
      },
      description: "Educational points for the resident regarding the pathology.",
    },
    followUpRecommendation: {
      type: Type.STRING,
      description: "Guideline-based follow-up recommendation if applicable, otherwise empty string.",
    }
  },
  required: ["draftReport", "conciseSummary", "impression", "safetyChecks", "learningPoints", "followUpRecommendation"],
};

const CHECKLIST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    checklist: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Ordered list of anatomical structures or systems to review."
    }
  },
  required: ["checklist"]
};

const COMPARISON_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    targets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          finding: { type: Type.STRING, description: "Name of the pathology" },
          location: { type: Type.STRING, description: "Specific location" },
          previousSizeOrStatus: { type: Type.STRING, description: "Previous dimensions or status" },
          significance: { type: Type.STRING, enum: ["Critical", "Monitor", "Incidental"], description: "Clinical importance level" }
        },
        required: ["finding", "location", "previousSizeOrStatus", "significance"]
      },
      description: "List of specific findings from the previous report."
    },
    summary: {
      type: Type.STRING,
      description: "A brief 1-sentence summary of the overall prior status."
    }
  },
  required: ["targets", "summary"]
};

const TRAINING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    content: {
      type: Type.STRING,
      description: "The extracted master template text (blueprint) with {{HISTORY}} and {{COMPARISON}} tags."
    },
    styleGuide: {
      type: Type.STRING,
      description: "A concise list of rules describing the writing style (voice, punctuation, capitalization) found in the examples."
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 anatomical keywords inferred from the text (e.g., 'chest', 'brain')."
    }
  },
  required: ["content", "styleGuide", "keywords"]
};

export const generateRadiologyReport = async (inputs: ReportInputs): Promise<ReportResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Get the appropriate template (now prioritizes the 'Learned' templates)
  const templateObj = getTemplateObject(inputs.modality, inputs.anatomicalPart, inputs.reportType);
  
  // Combine Base instruction with Style-specific instruction
  let finalSystemInstruction = BASE_SYSTEM_INSTRUCTION;
  
  if (inputs.reportType === 'Structural') {
    finalSystemInstruction += `\n\n${STRUCTURAL_INSTRUCTION}`;
  } else {
    finalSystemInstruction += `\n\n${DESCRIPTIVE_INSTRUCTION}`;
  }

  let prompt = `
    Study Date: ${inputs.studyDate}
    Patient Age: ${inputs.age}
    Gender: ${inputs.gender}
    Modality: ${inputs.modality}
    Anatomical Part: ${inputs.anatomicalPart}
    Clinical History: ${inputs.history}
    
    COMPARISON STUDY DETAILS:
    Study Name/Date: ${inputs.comparison}
    Previous Report Findings (FOR COMPARISON): 
    "${inputs.previousReportFindings || 'None provided'}"

    REPORT STYLE REQUESTED: ${inputs.reportType.toUpperCase()}
    
    CURRENT DRAFT FINDINGS (Shorthand):
    ${inputs.findings}
  `;

  if (templateObj) {
    prompt += `
    
    *** DETECTED TEMPLATE BLUEPRINT ***
    The following is the STANDARD TEMPLATE for this exam. You MUST use this text as the blueprint/skeleton for the "draftReport".
    
    TEMPLATE START:
    ${templateObj.content}
    TEMPLATE END
    
    INSTRUCTIONS FOR TEMPLATE USAGE:
    1. HISTORY/COMPARISON: Replace {{HISTORY}} and {{COMPARISON}} placeholders with provided values (or "None").
    2. NORMAL FINDINGS: If the user's DRAFT FINDINGS do not mention a specific organ, KEEP the template's "normal" text for that organ exactly as is.
    3. ABNORMAL FINDINGS: If the user's DRAFT FINDINGS mention pathology, REPLACE the template's normal sentence for that organ with a detailed description.
    `;

    if (templateObj.styleGuide) {
       finalSystemInstruction += `\n\n*** STRICT STYLE GUIDE FROM TEMPLATE ***\nYou must adhere to the following learned style rules:\n${templateObj.styleGuide}`;
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: finalSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2, 
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response generated.");
    }

    try {
      const data = JSON.parse(text) as ReportResponse;
      return data;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      throw new Error("Failed to parse AI response. Please try again.");
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

const getTemplateObject = (modality: Modality, anatomicalPart: string, reportType: ReportType): Template | null => {
   const search = anatomicalPart.toLowerCase();
   const customTemplates = getCustomTemplates();
   
   // 1. Strict Custom Match
   const customExact = customTemplates.find(t => 
      t.modality === modality && 
      t.type === reportType &&
      t.keywords.some(k => search.includes(k))
   );
   if (customExact) return customExact;
   
   // 2. Fallback to Default (via getTemplate which we configured to be strict)
   const content = getTemplate(modality, anatomicalPart, reportType);
   if (content) {
       return {
           id: 'default',
           name: 'Default',
           modality,
           type: reportType,
           keywords: [],
           content: content
       };
   }
   
   // No fallback to loose match - return null to let Gemini generate structure dynamically based on System Instruction
   return null;
}


export const generateSearchPattern = async (modality: string, anatomicalPart: string): Promise<string[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Generate a standard radiology search pattern (checklist of organs/structures to review) for a ${modality} of the ${anatomicalPart}. Keep items concise (e.g. 'Liver parenchyma', 'Portal vein').`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: CHECKLIST_SCHEMA,
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text) as ChecklistResponse;
    return data.checklist;
  } catch (error) {
    console.error("Checklist Gen Error:", error);
    return [];
  }
};

export const analyzeComparisonFindings = async (previousReport: string): Promise<ComparisonAnalysisResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
  Analyze the following "Previous Radiology Report" text. 
  Extract distinct pathological findings that require comparison or tracking (e.g., nodules, masses, lymph nodes, cysts, fluid collections, fractures).
  Ignore normal anatomy.
  
  PREVIOUS REPORT TEXT:
  "${previousReport}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a radiology assistant. Break down prior reports into a structured tracking list for the radiologist to compare against the new study.",
        responseMimeType: "application/json",
        responseSchema: COMPARISON_ANALYSIS_SCHEMA,
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No analysis generated");
    
    return JSON.parse(text) as ComparisonAnalysisResponse;
  } catch (error) {
    console.error("Comparison Analysis Error:", error);
    throw error;
  }
};

export const trainTemplateFromExamples = async (
  examples: string, 
  modality: Modality, 
  name: string
): Promise<Template> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    I have provided a set of example radiology reports below.
    Your goal is to "LEARN" the style and structure from these reports to create a Master Template.
    
    TASKS:
    1. **Master Template**: Create a generic, empty structural template that matches the examples. 
       - Use {{HISTORY}} for clinical history location.
       - Use {{COMPARISON}} for comparison location.
       - Include the standard headers and "Normal" boilerplate text for organs found in the examples.
    2. **Style Guide**: Extract a set of rules describing the specific writing style.
       - E.g. "Uses passive voice", "Headings are uppercase", "No periods after sentence fragments", "Dates in DD/MM/YYYY format".
    3. **Keywords**: Infer 3-5 keywords that describe the anatomical part (e.g. "chest", "thorax", "lung").

    EXAMPLE REPORTS TO ANALYZE:
    "${examples.substring(0, 30000)}" 
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a Senior Radiologist Consultant. Analyze the provided reports to create a standardized template and style guide.",
        responseMimeType: "application/json",
        responseSchema: TRAINING_SCHEMA,
        temperature: 0.2,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from training.");

    const result = JSON.parse(text);
    
    // Determine report type based on content structure (heuristic)
    const type: ReportType = result.content.includes(':') && result.content.includes('\n-') 
        ? 'Structural' 
        : 'Descriptive';

    return {
      id: Date.now().toString(),
      name: name,
      modality: modality,
      type: type,
      keywords: result.keywords,
      content: result.content,
      styleGuide: result.styleGuide
    };
  } catch (error) {
    console.error("Training Error:", error);
    throw new Error("Failed to learn from examples. Please try again.");
  }
};