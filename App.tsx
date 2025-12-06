import React, { useState, useEffect, useRef } from 'react';
import { Modality, ReportInputs, GenerationState, ReportType, Template, SavedReport, ComparisonFinding } from './types';
import { generateRadiologyReport, generateSearchPattern, analyzeComparisonFindings } from './services/geminiService';
import { saveCustomTemplate, getCustomTemplates, updateCustomTemplate, deleteCustomTemplate } from './services/templates';
import { saveReportToHistory, getHistory, deleteReportFromHistory } from './services/history';
import ReportOutput from './components/ReportOutput';
import { 
  IconActivity, IconWand, IconList, IconRefresh, IconPlus, IconX, IconSave, IconCheck,
  IconUser, IconTrash, IconLayers, IconZap, IconGrid, IconAlignLeft, IconEdit, IconCopy, 
  IconClock, IconArrowLeft, IconCompare, IconBarChart, IconPieChart, IconDownload, IconUpload, IconStop,
  IconTarget, IconMicroscope, IconEye, IconUserPlus
} from './components/Icons';

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<'generator' | 'history' | 'templates'>('generator');
  
  // Helper to get today's date in DD/MM/YYYY
  const getTodayDateString = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const initialInputs: ReportInputs = {
    studyDate: getTodayDateString(),
    age: '',
    gender: 'M',
    modality: Modality.CT,
    anatomicalPart: '',
    findings: '',
    history: '',
    comparison: '',
    previousReportFindings: '',
    reportType: 'Structural'
  };

  const [inputs, setInputs] = useState<ReportInputs>(initialInputs);

  const [showComparisonInput, setShowComparisonInput] = useState(false);
  
  // Comparison Analysis State
  const [isAnalyzingComparison, setIsAnalyzingComparison] = useState(false);
  const [comparisonAnalysis, setComparisonAnalysis] = useState<{targets: ComparisonFinding[], summary: string} | null>(null);
  const [checkedTargets, setCheckedTargets] = useState<Set<number>>(new Set());

  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    data: null
  });

  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing...");

  // Refs for abort control
  const abortControllerRef = useRef<boolean>(false);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [checklist, setChecklist] = useState<{
    isLoading: boolean;
    items: string[];
    checked: Set<number>;
  }>({
    isLoading: false,
    items: [],
    checked: new Set()
  });

  // History State
  const [historyItems, setHistoryItems] = useState<SavedReport[]>([]);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<SavedReport | null>(null);
  const [historySort, setHistorySort] = useState<'date' | 'modality'>('date');

  // Template Modal
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<Template>>({
    name: '',
    modality: Modality.CT,
    type: 'Structural',
    keywords: [],
    content: ''
  });
  const [keywordsInput, setKeywordsInput] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);
  
  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EFFECT ---
  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
    setHistoryItems(getHistory());
  }, []);

  // --- STATS CALCULATION ---
  const stats = React.useMemo(() => {
    const total = historyItems.length;
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    
    const reportsToday = historyItems.filter(i => i.timestamp >= todayStart.getTime()).length;
    
    const byModality = historyItems.reduce((acc, item) => {
        acc[item.inputs.modality] = (acc[item.inputs.modality] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Get top modality
    const topModalityEntry = Object.entries(byModality).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    const topModality = topModalityEntry ? `${topModalityEntry[0]} (${topModalityEntry[1]})` : 'N/A';

    return { total, reportsToday, topModality };
  }, [historyItems]);

  // --- HISTORY SORTING & GROUPING ---
  const getSortedAndGroupedHistory = () => {
    // 1. Sort
    const sorted = [...historyItems].sort((a, b) => {
        if (historySort === 'date') {
            return b.timestamp - a.timestamp;
        } else {
            // Sort by modality, then by date desc
            const modCompare = a.inputs.modality.localeCompare(b.inputs.modality);
            if (modCompare !== 0) return modCompare;
            return b.timestamp - a.timestamp;
        }
    });

    // 2. Group
    const groups: Record<string, SavedReport[]> = {};
    sorted.forEach(item => {
        let key = '';
        if (historySort === 'date') {
            const date = new Date(item.timestamp);
            const today = new Date();
            if (date.toDateString() === today.toDateString()) key = "Today";
            else key = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            key = item.inputs.modality;
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    return groups;
  };

  // --- DATA MANAGEMENT HANDLERS ---
  const handleExportData = () => {
    const data = {
      history: getHistory(),
      templates: getCustomTemplates(),
      exportDate: new Date().toISOString(),
      version: '1.7'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `radassist_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportDataTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Basic validation
        if (!data.history && !data.templates) {
          alert("Invalid backup file format.");
          return;
        }

        if (confirm(`Restore ${data.history?.length || 0} reports and ${data.templates?.length || 0} templates? This will merge with your current data.`)) {
          if (data.history) {
             localStorage.setItem('radassist_history', JSON.stringify(data.history));
             setHistoryItems(data.history);
          }
          if (data.templates) {
             localStorage.setItem('radassist_custom_templates', JSON.stringify(data.templates));
             setCustomTemplates(data.templates);
          }
          alert("Data restored successfully!");
        }
      } catch (err) {
        console.error("Import error", err);
        alert("Failed to import data. Please check the file.");
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };


  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleGenderSelect = (gender: 'M' | 'F') => {
    setInputs(prev => ({ ...prev, gender }));
  };

  const handleModalitySelect = (modality: Modality) => {
    setInputs(prev => ({ ...prev, modality }));
  };

  const handleReportTypeChange = (type: ReportType) => {
    setInputs(prev => ({ ...prev, reportType: type }));
  };

  // Helper to clear data (no confirmation)
  const performReset = () => {
    setInputs({
        ...initialInputs,
        studyDate: getTodayDateString() // Recalculate to ensure accuracy
    });
    setShowComparisonInput(false);
    setComparisonAnalysis(null);
    setChecklist({ isLoading: false, items: [], checked: new Set() });
    setState({ isLoading: false, error: null, data: null });
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to clear all fields?")) {
      performReset();
    }
  };

  const handleNewPatient = () => {
    // Directly reset without confirmation
    performReset();
    
    // Scroll to top to see cleared fields
    setTimeout(() => {
      document.querySelector('input[name="studyDate"]')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleGenerateChecklist = async () => {
    if (!inputs.anatomicalPart) return;
    setChecklist(prev => ({ ...prev, isLoading: true, items: [], checked: new Set() }));
    const items = await generateSearchPattern(inputs.modality, inputs.anatomicalPart);
    setChecklist({ isLoading: false, items, checked: new Set() });
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist(prev => {
      const newChecked = new Set(prev.checked);
      if (newChecked.has(index)) {
        newChecked.delete(index);
      } else {
        newChecked.add(index);
      }
      return { ...prev, checked: newChecked };
    });
  };

  const handleAnalyzeComparison = async () => {
    if (!inputs.previousReportFindings) return;
    setIsAnalyzingComparison(true);
    setCheckedTargets(new Set());
    try {
        const result = await analyzeComparisonFindings(inputs.previousReportFindings);
        setComparisonAnalysis(result);
    } catch (e) {
        console.error(e);
        alert("Failed to analyze previous report.");
    } finally {
        setIsAnalyzingComparison(false);
    }
  };

  const toggleTargetChecked = (index: number) => {
    setCheckedTargets(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        return newSet;
    });
  };

  const handleStopGeneration = () => {
    abortControllerRef.current = true;
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
    }
    setState(prev => ({ ...prev, isLoading: false }));
  };

  const handleGenerate = async () => {
    if (!inputs.anatomicalPart || !inputs.findings) {
      setState(prev => ({ ...prev, error: "Please provide both Anatomical Part and Findings." }));
      return;
    }

    setState({ isLoading: true, error: null, data: null });
    abortControllerRef.current = false;
    
    // Simulate steps for UX
    const steps = [
      "Analyzing anatomical context...",
      "Structuring findings...",
      "Comparing with previous study..." ,
      "Cross-referencing safety protocols...",
      "Finalizing medical terminology...",
      "Generating report..."
    ];

    let stepIndex = 0;
    setLoadingStatus(steps[0]);
    loadingIntervalRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) setLoadingStatus(steps[stepIndex]);
    }, 800);

    try {
      const result = await generateRadiologyReport(inputs);
      
      // Check if aborted during the await
      if (abortControllerRef.current) {
         return; // Do nothing, user cancelled
      }

      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      setState({ isLoading: false, error: null, data: result });
      
      // Save to History
      const newReport: SavedReport = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        inputs: inputs,
        data: result
      };
      saveReportToHistory(newReport);
      setHistoryItems(getHistory()); // Update local state

      // Scroll to result
      setTimeout(() => {
        document.getElementById('report-output')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      if (abortControllerRef.current) return;
      
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      setState({ isLoading: false, error: err.message || "An unexpected error occurred", data: null });
    }
  };

  // History Handlers
  const handleLoadHistory = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Load this report? Current inputs will be overwritten.")) {
      setInputs(report.inputs);
      // Ensure comparison toggle is open if data exists
      if (report.inputs.previousReportFindings) {
        setShowComparisonInput(true);
      }
      // Reset specific new states
      setComparisonAnalysis(null);
      
      setState({ isLoading: false, error: null, data: report.data });
      setView('generator');
      setTimeout(() => {
        document.getElementById('report-output')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleViewHistoryReport = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHistoryReport(report);
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Delete this report from history?")) {
      deleteReportFromHistory(id);
      setHistoryItems(prev => prev.filter(i => i.id !== id));
      if (selectedHistoryReport?.id === id) setSelectedHistoryReport(null);
    }
  };

  // Template Handlers
  const openTemplateModal = (templateToEdit?: Template) => {
    if (templateToEdit) {
      setNewTemplate({
        id: templateToEdit.id,
        name: templateToEdit.name,
        modality: templateToEdit.modality,
        type: templateToEdit.type,
        content: templateToEdit.content,
        keywords: templateToEdit.keywords
      });
      setKeywordsInput(templateToEdit.keywords.join(', '));
    } else {
      setNewTemplate({
        name: '',
        modality: inputs.modality,
        type: inputs.reportType,
        content: '',
        keywords: inputs.anatomicalPart ? [inputs.anatomicalPart.toLowerCase()] : []
      });
      setKeywordsInput(inputs.anatomicalPart || '');
    }
    setTemplateSaved(false);
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!newTemplate.name || !newTemplate.content || !keywordsInput) return;
    const keywords = keywordsInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    
    if (newTemplate.id) {
      // Update existing
      const templateToUpdate: Template = {
        id: newTemplate.id,
        name: newTemplate.name!,
        modality: newTemplate.modality as Modality,
        type: newTemplate.type as ReportType,
        keywords: keywords,
        content: newTemplate.content!
      };
      updateCustomTemplate(templateToUpdate);
    } else {
      // Create new
      const templateToSave: Template = {
        id: Date.now().toString(),
        name: newTemplate.name!,
        modality: newTemplate.modality as Modality,
        type: newTemplate.type as ReportType,
        keywords: keywords,
        content: newTemplate.content!
      };
      saveCustomTemplate(templateToSave);
    }

    setTemplateSaved(true);
    // Refresh list
    setCustomTemplates(getCustomTemplates());
    
    setTimeout(() => {
      setIsTemplateModalOpen(false);
      setTemplateSaved(false);
    }, 1000);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this template?")) {
      deleteCustomTemplate(id);
      // Force update by filtering current state to ensure UI reflects deletion immediately
      setCustomTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  // --- RENDER HELPERS ---

  const ModalityButton: React.FC<{ mode: Modality }> = ({ mode }) => (
    <button
      onClick={() => handleModalitySelect(mode)}
      className={`
        relative overflow-hidden group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200
        ${inputs.modality === mode 
          ? 'bg-medical-blue/20 border-medical-blue text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]' 
          : 'bg-rad-800 border-rad-700 text-slate-400 hover:bg-rad-700 hover:border-rad-600'
        }
      `}
    >
      <div className={`mb-1 transition-transform group-hover:scale-110 ${inputs.modality === mode ? 'text-medical-blue' : 'text-slate-500'}`}>
        {mode === Modality.CT && <IconLayers className="w-6 h-6" />}
        {mode === Modality.MRI && <IconActivity className="w-6 h-6" />}
        {mode === Modality.XRAY && <IconZap className="w-6 h-6" />}
        {mode === Modality.ULTRASOUND && <IconWand className="w-6 h-6" />}
        {(mode === Modality.MAMMOGRAPHY || mode === Modality.FLUOROSCOPY) && <IconGrid className="w-6 h-6" />}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{mode}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-rad-900 text-slate-100 font-sans selection:bg-medical-blue/30 selection:text-white">
      
      {/* --- HEADER --- */}
      <header className="bg-rad-900/80 backdrop-blur-md border-b border-rad-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('generator')}>
            <div className="bg-gradient-to-br from-medical-blue to-indigo-600 p-2 rounded-lg shadow-lg shadow-medical-blue/20">
              <IconActivity className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">RadAssist <span className="text-medical-blue font-light">AI</span></h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Better work, better life.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* View Switcher */}
             <div className="flex bg-rad-800 rounded-lg p-1 border border-rad-700">
                <button 
                  onClick={() => setView('generator')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${view === 'generator' ? 'bg-rad-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  <IconWand className="w-3 h-3" />
                  <span className="hidden sm:inline">Generator</span>
                </button>
                <button 
                  onClick={() => setView('history')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${view === 'history' ? 'bg-rad-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  <IconClock className="w-3 h-3" />
                  <span className="hidden sm:inline">History</span>
                </button>
                 <button 
                  onClick={() => setView('templates')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${view === 'templates' ? 'bg-rad-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  <IconCopy className="w-3 h-3" />
                  <span className="hidden sm:inline">Templates</span>
                </button>
             </div>

             <div className="h-4 w-px bg-rad-700 hidden sm:block"></div>
             
             {/* New Patient Button */}
             <button 
                onClick={handleNewPatient}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-medical-blue/10 hover:bg-medical-blue/20 text-medical-blue border border-medical-blue/30 rounded-lg transition-colors text-xs font-bold cursor-pointer z-50"
                title="Start New Patient"
              >
                <IconUserPlus className="w-3.5 h-3.5" />
                <span>New Patient</span>
             </button>
             
             <button 
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                title="Reset Form"
              >
                <IconTrash className="w-3.5 h-3.5" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {view === 'history' && (
           // --- HISTORY VIEW ---
           <div className="animate-fade-in space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setView('generator')} className="p-2 rounded-full hover:bg-rad-800 text-slate-400 hover:text-white transition-colors">
                       <IconArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col">
                       <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <IconClock className="w-5 h-5 text-medical-blue" />
                        Report History
                       </h2>
                       <div className="flex items-center gap-2 mt-1">
                          <button 
                             onClick={() => setHistorySort('date')}
                             className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border transition-colors ${historySort === 'date' ? 'bg-medical-blue text-white border-medical-blue' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
                          >
                             Sort by Date
                          </button>
                          <button 
                             onClick={() => setHistorySort('modality')}
                             className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border transition-colors ${historySort === 'modality' ? 'bg-medical-blue text-white border-medical-blue' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
                          >
                             Sort by Modality
                          </button>
                       </div>
                    </div>
                 </div>
                 
                 {/* Backup Controls */}
                 <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    <button 
                      onClick={handleImportDataTrigger}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rad-800 hover:bg-rad-700 border border-rad-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                      title="Import Backup"
                    >
                      <IconUpload className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Import</span>
                    </button>
                    <button 
                      onClick={handleExportData}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rad-800 hover:bg-rad-700 border border-rad-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                      title="Export Backup"
                    >
                      <IconDownload className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                 </div>
              </div>

              {historyItems.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-rad-800 rounded-2xl bg-rad-900/50">
                   <IconClock className="w-12 h-12 text-rad-700 mx-auto mb-4" />
                   <p className="text-slate-500">No generated reports yet.</p>
                   <button onClick={() => setView('generator')} className="mt-4 text-medical-blue hover:underline text-sm">Create your first report</button>
                </div>
              ) : (
                <div className="space-y-8">
                   {/* GROUPED LIST VIEW */}
                   {Object.entries(getSortedAndGroupedHistory()).map(([groupName, items]) => (
                      <div key={groupName} className="animate-fade-in">
                         <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1 border-b border-rad-800 pb-1 w-fit">{groupName}</h3>
                         <div className="bg-rad-800/30 border border-rad-700/50 rounded-xl overflow-hidden divide-y divide-rad-800">
                            {items.map((item) => (
                              <div 
                                key={item.id}
                                onClick={(e) => handleLoadHistory(item, e)}
                                className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-rad-800 cursor-pointer transition-colors"
                              >
                                 <div className="flex items-center gap-4 flex-grow min-w-0">
                                    {/* Time/Date Badges */}
                                    <div className="flex flex-col items-center justify-center w-14 flex-shrink-0 gap-1">
                                       <span className="text-xs font-mono text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                       {historySort !== 'date' && (
                                         <span className="text-[10px] text-slate-600">{new Date(item.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                       )}
                                    </div>
                                    
                                    {/* Icon & Details */}
                                    <div className={`p-2 rounded-lg bg-rad-900 border border-rad-700 flex-shrink-0 ${item.inputs.modality === Modality.CT ? 'text-blue-400' : 'text-slate-400'}`}>
                                       {item.inputs.modality === Modality.CT && <IconLayers className="w-5 h-5" />}
                                       {item.inputs.modality === Modality.MRI && <IconActivity className="w-5 h-5" />}
                                       {item.inputs.modality === Modality.XRAY && <IconZap className="w-5 h-5" />}
                                       {item.inputs.modality === Modality.ULTRASOUND && <IconWand className="w-5 h-5" />}
                                       {(item.inputs.modality === Modality.MAMMOGRAPHY || item.inputs.modality === Modality.FLUOROSCOPY) && <IconGrid className="w-5 h-5" />}
                                    </div>

                                    <div className="flex flex-col min-w-0">
                                       <div className="flex items-center gap-2 mb-0.5">
                                          <span className="font-bold text-slate-200 text-sm truncate">{item.inputs.anatomicalPart || "Unknown"}</span>
                                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-rad-900 text-slate-500 rounded border border-rad-700">{item.inputs.modality}</span>
                                       </div>
                                       <p className="text-xs text-slate-500 truncate max-w-md">
                                          {item.inputs.age}yo {item.inputs.gender} • {item.inputs.history || "No history"}
                                       </p>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-2 pl-14 sm:pl-0">
                                     <button 
                                      onClick={(e) => handleViewHistoryReport(item, e)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-medical-blue bg-rad-900 border border-rad-700 hover:border-medical-blue/30 rounded-lg transition-colors"
                                     >
                                        <IconEye className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">View</span>
                                     </button>
                                     <button 
                                      onClick={(e) => handleDeleteHistory(item.id, e)}
                                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Delete"
                                     >
                                        <IconX className="w-4 h-4" />
                                     </button>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
              )}
           </div>
        )}
        
        {view === 'templates' && (
           // --- TEMPLATES VIEW ---
           <div className="animate-fade-in space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setView('generator')} className="p-2 rounded-full hover:bg-rad-800 text-slate-400 hover:text-white transition-colors">
                       <IconArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <IconCopy className="w-5 h-5 text-medical-blue" />
                      Template Library
                    </h2>
                 </div>
                 <button 
                  onClick={() => openTemplateModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-medical-blue hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-medical-blue/20"
                >
                  <IconPlus className="w-4 h-4" />
                  Create New Template
                </button>
              </div>

              {customTemplates.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-rad-800 rounded-2xl bg-rad-900/50">
                   <IconCopy className="w-12 h-12 text-rad-700 mx-auto mb-4" />
                   <p className="text-slate-500">No custom templates saved yet.</p>
                   <p className="text-slate-600 text-xs mt-2">Create templates to speed up your reporting workflow.</p>
                   <button onClick={() => openTemplateModal()} className="mt-4 text-medical-blue hover:underline text-sm">Create your first template</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customTemplates.map((t) => (
                    <div key={t.id} className="group bg-rad-800/50 border border-rad-700 rounded-xl p-5 hover:border-rad-600 hover:bg-rad-800 transition-all">
                       <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col">
                             <h3 className="font-bold text-white text-lg leading-tight truncate pr-4">{t.name}</h3>
                             <div className="flex gap-2 mt-1">
                                <span className="text-[10px] font-bold text-medical-blue bg-medical-blue/10 px-2 py-0.5 rounded border border-medical-blue/20 uppercase">{t.modality}</span>
                                <span className="text-[10px] font-medium text-slate-400 bg-rad-900 px-2 py-0.5 rounded border border-rad-700">{t.type}</span>
                             </div>
                          </div>
                          <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => openTemplateModal(t)}
                               className="p-1.5 rounded hover:bg-rad-700 text-slate-400 hover:text-white transition-colors"
                               title="Edit"
                             >
                               <IconEdit className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={(e) => handleDeleteTemplate(t.id, e)}
                               className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
                               title="Delete"
                             >
                               <IconTrash className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                       
                       <div className="mb-4">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Keywords</p>
                          <div className="flex flex-wrap gap-1">
                             {t.keywords.map((k, i) => (
                               <span key={i} className="text-xs text-slate-300 bg-rad-900/50 px-2 py-1 rounded border border-rad-700/50">{k}</span>
                             ))}
                          </div>
                       </div>

                       <div className="mt-4 pt-3 border-t border-rad-700/50">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Content Preview</p>
                          <div className="text-xs text-slate-400 font-mono line-clamp-3 bg-rad-900/30 p-2 rounded">
                             {t.content}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
           </div>
        )}

        {view === 'generator' && (
           // --- GENERATOR VIEW ---
           <div className="flex flex-col gap-6 lg:gap-8 animate-fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* LEFT COLUMN: PATIENT CONTEXT (4/12) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Patient Demographics Card */}
                <div className="bg-rad-800/50 backdrop-blur-sm border border-rad-700 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-4 text-slate-300">
                    <IconUser className="w-4 h-4 text-medical-blue" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">Patient Demographics</h3>
                  </div>
                  
                  <div className="space-y-4">
                    
                    {/* Date Input */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Study Date</label>
                      <input
                        type="text"
                        name="studyDate"
                        value={inputs.studyDate}
                        onChange={handleInputChange}
                        placeholder="DD/MM/YYYY"
                        className="w-full bg-rad-900/50 border border-rad-600 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-medical-blue/50 focus:border-medical-blue outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Age</label>
                        <input
                          type="text"
                          name="age"
                          value={inputs.age}
                          onChange={handleInputChange}
                          autoComplete="off"
                          placeholder="e.g. 55"
                          className="w-full bg-rad-900/50 border border-rad-600 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-medical-blue/50 focus:border-medical-blue outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Gender</label>
                        <div className="flex p-1 bg-rad-900/50 rounded-lg border border-rad-600">
                          {['M', 'F'].map((g) => (
                            <button
                              key={g}
                              onClick={() => handleGenderSelect(g as 'M' | 'F')}
                              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                inputs.gender === g 
                                  ? 'bg-rad-700 text-white shadow-sm' 
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Clinical History</label>
                      <textarea
                        name="history"
                        value={inputs.history}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="e.g. RUQ pain, fever, leukocytosis..."
                        className="w-full bg-rad-900/50 border border-rad-600 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-medical-blue/50 focus:border-medical-blue outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Comparison Study Card */}
                <div className="bg-rad-800/50 backdrop-blur-sm border border-rad-700 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <IconCompare className="w-4 h-4 text-medical-blue" />
                        <h3 className="text-sm font-bold uppercase tracking-wide">Comparison Study</h3>
                      </div>
                      <button 
                        onClick={() => setShowComparisonInput(!showComparisonInput)}
                        className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${showComparisonInput ? 'bg-medical-blue text-white' : 'bg-rad-900 text-slate-500 border border-rad-600 hover:text-slate-300'}`}
                      >
                        {showComparisonInput ? 'ACTIVE' : 'ADD PREVIOUS REPORT'}
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Study Name / Date</label>
                        <input
                          type="text"
                          name="comparison"
                          value={inputs.comparison}
                          onChange={handleInputChange}
                          placeholder="e.g. CT Chest 2023-01-15"
                          className="w-full bg-rad-900/50 border border-rad-600 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-medical-blue/50 focus:border-medical-blue outline-none transition-all"
                        />
                      </div>
                      
                      {showComparisonInput && (
                        <div className="animate-fade-in space-y-3">
                          <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1 flex justify-between">
                                  <span>Previous Report Findings</span>
                                  <span className="text-[10px] text-medical-blue">AI Analysis Enabled</span>
                              </label>
                              <textarea
                                name="previousReportFindings"
                                value={inputs.previousReportFindings}
                                onChange={handleInputChange}
                                rows={6}
                                placeholder="Paste the FINDINGS section from the previous report here. The AI will compare lesion sizes and stability."
                                className="w-full bg-rad-900/50 border border-rad-600 rounded-lg px-3 py-2.5 text-xs text-white font-mono focus:ring-2 focus:ring-medical-blue/50 focus:border-medical-blue outline-none transition-all resize-y"
                              />
                          </div>
                          
                          {/* Comparison Analyzer Button */}
                          <button 
                              onClick={handleAnalyzeComparison}
                              disabled={isAnalyzingComparison || !inputs.previousReportFindings}
                              className="w-full py-2 bg-indigo-600/20 border border-indigo-500/50 hover:bg-indigo-600/30 text-indigo-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                              {isAnalyzingComparison ? <IconRefresh className="w-3.5 h-3.5 animate-spin" /> : <IconMicroscope className="w-3.5 h-3.5" />}
                              {isAnalyzingComparison ? "Analyzing..." : "Analyze Prior Findings"}
                          </button>
                        </div>
                      )}
                  </div>
                </div>

                {/* Style Selector Card */}
                <div className="bg-rad-800/50 backdrop-blur-sm border border-rad-700 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-4 text-slate-300">
                    <IconAlignLeft className="w-4 h-4 text-medical-blue" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">Report Style</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleReportTypeChange('Structural')}
                      className={`
                        px-3 py-3 rounded-xl border text-left transition-all
                        ${inputs.reportType === 'Structural' 
                          ? 'bg-medical-blue/10 border-medical-blue/50 ring-1 ring-medical-blue/50' 
                          : 'bg-rad-900/50 border-rad-600 hover:bg-rad-800'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <IconList className={`w-3.5 h-3.5 ${inputs.reportType === 'Structural' ? 'text-medical-blue' : 'text-slate-500'}`} />
                        <span className={`text-xs font-semibold ${inputs.reportType === 'Structural' ? 'text-white' : 'text-slate-400'}`}>Structural</span>
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">Organ-based headers</div>
                    </button>

                    <button
                      onClick={() => handleReportTypeChange('Descriptive')}
                      className={`
                        px-3 py-3 rounded-xl border text-left transition-all
                        ${inputs.reportType === 'Descriptive' 
                          ? 'bg-medical-blue/10 border-medical-blue/50 ring-1 ring-medical-blue/50' 
                          : 'bg-rad-900/50 border-rad-600 hover:bg-rad-800'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <IconAlignLeft className={`w-3.5 h-3.5 ${inputs.reportType === 'Descriptive' ? 'text-medical-blue' : 'text-slate-500'}`} />
                        <span className={`text-xs font-semibold ${inputs.reportType === 'Descriptive' ? 'text-white' : 'text-slate-400'}`}>Descriptive</span>
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">Continuous prose</div>
                    </button>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: RADIOLOGIST CONSOLE (8/12) */}
              <div className="lg:col-span-8 space-y-6">
                
                <div className="bg-rad-800 border border-rad-700 rounded-2xl shadow-xl overflow-hidden">
                  
                  {/* Header / Modality Selection */}
                  <div className="p-5 border-b border-rad-700 bg-rad-800/50">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Examination Type</h3>
                    </div>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Object.values(Modality).map(m => (
                        <ModalityButton key={m} mode={m} />
                      ))}
                    </div>
                  </div>

                  {/* Anatomy & Checklist Area */}
                  <div className="p-5 bg-rad-900/30">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="flex-grow">
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Anatomical Part</label>
                          <div className="relative">
                            <input
                              type="text"
                              name="anatomicalPart"
                              value={inputs.anatomicalPart}
                              onChange={handleInputChange}
                              onBlur={handleGenerateChecklist}
                              placeholder="e.g. Whole Abdomen"
                              className="w-full bg-rad-900 border border-rad-600 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-medical-blue focus:border-transparent outline-none transition-all pl-4"
                            />
                          </div>
                        </div>
                        <div className="sm:w-1/3 flex items-end">
                          <button
                            onClick={handleGenerateChecklist}
                            disabled={checklist.isLoading || !inputs.anatomicalPart}
                            className="w-full h-[46px] flex items-center justify-center gap-2 bg-rad-700 hover:bg-rad-600 border border-rad-600 text-slate-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                          >
                            {checklist.isLoading ? <IconRefresh className="w-3.5 h-3.5 animate-spin" /> : <IconList className="w-3.5 h-3.5" />}
                            {checklist.items.length > 0 ? "Refresh Search Pattern" : "Load Checklist"}
                          </button>
                        </div>
                    </div>

                    {/* Active Checklist Display */}
                    {checklist.items.length > 0 && (
                      <div className="mb-2 p-3 bg-rad-900/50 rounded-xl border border-rad-700/50">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Search Pattern (Click to verify)</p>
                        <div className="flex flex-wrap gap-2">
                            {checklist.items.map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => toggleChecklistItem(idx)}
                                className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                                  checklist.checked.has(idx) 
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                    : 'bg-rad-800 border-rad-600 text-slate-400 hover:border-slate-500'
                                }`}
                              >
                                {checklist.checked.has(idx) && <IconCheck className="w-3 h-3 inline mr-1" />}
                                {item}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Findings Input */}
                  <div className="p-5 border-t border-rad-700 bg-rad-800 relative">

                    {/* COMPARISON TRACKING DASHBOARD (MOVED HERE) */}
                    {comparisonAnalysis && (
                      <div className="mb-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-indigo-300">
                              <div className="bg-indigo-500/20 p-1.5 rounded-lg">
                                  <IconTarget className="w-4 h-4" />
                              </div>
                              <div>
                                  <h4 className="text-sm font-bold uppercase tracking-wide">Comparison Targets</h4>
                                  <p className="text-[10px] text-indigo-300/70 italic leading-tight max-w-md">"{comparisonAnalysis.summary}"</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setComparisonAnalysis(null)}
                              className="text-slate-500 hover:text-indigo-300 p-1"
                              title="Dismiss"
                            >
                              <IconX className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                            {comparisonAnalysis.targets.map((target, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => toggleTargetChecked(idx)}
                                className={`
                                  p-3 rounded-lg border cursor-pointer transition-all flex gap-3 items-start group
                                  ${checkedTargets.has(idx) 
                                    ? 'bg-green-500/10 border-green-500/30' 
                                    : 'bg-rad-900/60 border-indigo-500/20 hover:bg-indigo-900/40 hover:border-indigo-500/40'}
                                `}
                              >
                                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checkedTargets.has(idx) ? 'bg-green-500 border-green-500' : 'border-indigo-400/30 group-hover:border-indigo-400'}`}>
                                    {checkedTargets.has(idx) && <IconCheck className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div>
                                    <div className={`text-sm font-semibold mb-0.5 ${checkedTargets.has(idx) ? 'text-green-400 line-through decoration-green-500/50' : 'text-slate-100'}`}>
                                      {target.finding}
                                    </div>
                                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-2">
                                      <span className="bg-rad-900 px-1.5 rounded border border-rad-700">{target.location}</span>
                                      <span className="text-indigo-300 font-medium">{target.previousSizeOrStatus}</span>
                                    </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-medium text-slate-500 ml-1">Draft Findings (Shorthand)</label>
                      <span className="text-[10px] text-slate-500 bg-rad-900 px-2 py-0.5 rounded-full border border-rad-700">AI Enabled</span>
                    </div>
                    <textarea
                      name="findings"
                      value={inputs.findings}
                      onChange={handleInputChange}
                      rows={8}
                      placeholder="Type your findings here (e.g., 'Liver: 2cm cyst seg 8. Pancreas normal. Kidneys: b/l simple cysts...')"
                      className="w-full bg-rad-900 border border-rad-600 rounded-xl px-4 py-4 text-sm text-white font-mono leading-relaxed focus:ring-2 focus:ring-medical-blue focus:border-transparent outline-none transition-all placeholder-slate-600 resize-y"
                    />
                    
                    {/* Generate Button Area */}
                    <div className="mt-4 flex flex-col items-end">
                      {state.isLoading ? (
                        <div className="w-full bg-rad-900/50 border border-rad-700 rounded-xl p-3 flex items-center justify-between animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-medical-blue/30 border-t-medical-blue rounded-full animate-spin"></div>
                              <span className="text-sm text-medical-blue font-medium">{loadingStatus}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-mono hidden sm:inline">Processing...</span>
                              <button 
                                  onClick={handleStopGeneration}
                                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded border border-red-500/30 transition-colors flex items-center gap-1"
                              >
                                  <IconStop className="w-3 h-3" /> Stop
                              </button>
                            </div>
                        </div>
                      ) : (
                          <button
                            onClick={handleGenerate}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-medical-blue to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-medical-blue/20 hover:shadow-medical-blue/40 transform hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                          >
                            <IconWand className="w-5 h-5" />
                            <span>Generate Report</span>
                          </button>
                      )}
                      {state.error && (
                          <p className="mt-3 text-xs text-red-400 flex items-center gap-1">
                            <IconX className="w-3 h-3" /> {state.error}
                          </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

             {/* OUTPUT SECTION - FULL WIDTH BELOW INPUTS */}
             <div id="report-output" className="w-full">
                {state.data && <ReportOutput data={state.data} inputs={inputs} />}
             </div>
           </div>
        )}

      </main>

      {/* --- HISTORY REPORT VIEW MODAL --- */}
      {selectedHistoryReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedHistoryReport(null)}>
          <div className="bg-rad-900 border border-rad-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
             {/* Modal Header */}
             <div className="p-4 border-b border-rad-700 bg-rad-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="bg-medical-blue/20 p-2 rounded-lg text-medical-blue">
                      <IconClock className="w-5 h-5" />
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-white leading-tight">Historical Report</h3>
                      <p className="text-xs text-slate-400">{new Date(selectedHistoryReport.timestamp).toLocaleString()} • {selectedHistoryReport.inputs.anatomicalPart}</p>
                   </div>
                </div>
                <button onClick={() => setSelectedHistoryReport(null)} className="text-slate-400 hover:text-white p-2 rounded hover:bg-rad-700 transition-colors">
                   <IconX className="w-6 h-6" />
                </button>
             </div>
             
             {/* Modal Body */}
             <div className="p-6 overflow-y-auto bg-rad-900">
                <ReportOutput data={selectedHistoryReport.data} inputs={selectedHistoryReport.inputs} />
             </div>
          </div>
        </div>
      )}

      {/* --- TEMPLATE MODAL --- */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-rad-800 border border-rad-600 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-rad-700 flex justify-between items-center bg-rad-900/50">
              <div className="flex items-center gap-2">
                <div className="bg-medical-blue/20 p-1.5 rounded text-medical-blue">
                   <IconPlus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">{newTemplate.id ? 'Edit Template' : 'New Template'}</h3>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-white">
                <IconX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                    placeholder="e.g. Normal CT Head"
                    className="w-full bg-rad-900 border border-rad-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-medical-blue outline-none"
                  />
                </div>
                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1">Modality</label>
                   <select
                    value={newTemplate.modality}
                    onChange={(e) => setNewTemplate({...newTemplate, modality: e.target.value as Modality})}
                    className="w-full bg-rad-900 border border-rad-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-medical-blue outline-none"
                  >
                    {Object.values(Modality).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1">Keywords</label>
                   <input
                    type="text"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="e.g. Brain, Head"
                    className="w-full bg-rad-900 border border-rad-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-medical-blue outline-none"
                  />
                </div>
                 <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1">Style</label>
                   <select
                    value={newTemplate.type}
                    onChange={(e) => setNewTemplate({...newTemplate, type: e.target.value as ReportType})}
                    className="w-full bg-rad-900 border border-rad-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-medical-blue outline-none"
                  >
                    <option value="Structural">Structural</option>
                    <option value="Descriptive">Descriptive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Content Blueprint</label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                  rows={8}
                  placeholder={`Use {{HISTORY}} and {{COMPARISON}} tags.\nExample:\n- LIVER: Normal.\n- SPLEEN: Unremarkable.`}
                  className="w-full bg-rad-900 border border-rad-600 rounded-lg px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-medical-blue outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-rad-700 bg-rad-900/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-rad-600 text-slate-300 hover:bg-rad-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveTemplate}
                disabled={!newTemplate.name || !newTemplate.content || !keywordsInput || templateSaved}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-all text-sm
                  ${templateSaved ? 'bg-green-600' : 'bg-medical-blue hover:bg-sky-500'}
                  disabled:opacity-50
                `}
              >
                 {templateSaved ? <IconCheck className="w-4 h-4" /> : <IconSave className="w-4 h-4" />}
                 {templateSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;