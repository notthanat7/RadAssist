import React, { useState } from 'react';
import { ReportResponse, ReportInputs } from '../types';
import { IconAlertTriangle, IconBookOpen, IconCopy, IconCheck, IconCalendar, IconExternalLink, IconList } from './Icons';

interface ReportOutputProps {
  data: ReportResponse;
  inputs: ReportInputs;
}

const ReportOutput: React.FC<ReportOutputProps> = ({ data, inputs }) => {
  const [copied, setCopied] = useState(false);

  const formatHeader = () => {
    return `EXAMINATION: ${inputs.modality} ${inputs.anatomicalPart}\n` +
           `DATE: ${inputs.studyDate}\n` +
           `HISTORY: ${inputs.history || 'None provided'}\n` +
           `COMPARISON STUDY: ${inputs.comparison || 'None'}\n\n`;
  };

  const handleCopy = () => {
    let fullText = formatHeader() + 
                   `FINDINGS:\n${data.draftReport}\n\n` + 
                   `IMPRESSION:\n${data.impression}`;
    
    if (data.followUpRecommendation) {
      fullText += `\n\nRECOMMENDATION:\n${data.followUpRecommendation}`;
    }
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ensureUrl = (link: string) => {
    if (!link) return '';
    if (link.startsWith('http')) return link;
    return `https://${link}`;
  };

  const hasFollowUp = data.followUpRecommendation && data.followUpRecommendation.trim() !== "" && data.followUpRecommendation !== "None";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in pb-12 w-full">
      
      {/* SECTION A: Draft Report (Left Column - 2/3 width) */}
      <div className="xl:col-span-2">
        <div className="bg-rad-800 border border-rad-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
          {/* Toolbar */}
          <div className="bg-rad-900/50 backdrop-blur-sm p-4 border-b border-rad-700 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-200 tracking-wider uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              Generated Report
            </h2>
            <button 
              onClick={handleCopy}
              className={`
                flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all
                ${copied 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-rad-700 hover:bg-rad-600 text-slate-200 border border-rad-600'}
              `}
            >
              {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy Report"}
            </button>
          </div>
          
          <div className="p-8 bg-rad-900/90 font-mono text-base leading-7 text-slate-300">
            
            {/* Header Section */}
            <div className="mb-10 pb-8 border-b border-rad-700/50">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-slate-500 font-bold uppercase min-w-[150px] text-sm">Examination</span>
                  <span className="text-white font-semibold uppercase text-sm sm:text-base">{inputs.modality} {inputs.anatomicalPart}</span>
                </div>
                 <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-slate-500 font-bold uppercase min-w-[150px] text-sm">Date</span>
                  <span className="text-white text-sm sm:text-base">{inputs.studyDate}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-slate-500 font-bold uppercase min-w-[150px] text-sm">History</span>
                  <span className="text-white text-sm sm:text-base">{inputs.history || "None provided"}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-slate-500 font-bold uppercase min-w-[150px] text-sm">Comparison</span>
                  <span className="text-white text-sm sm:text-base">{inputs.comparison || "None"}</span>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <h3 className="text-medical-blue font-bold mb-4 uppercase tracking-wider text-sm border-b border-medical-blue/20 pb-1 w-fit">Findings</h3>
              <div className="whitespace-pre-wrap pl-1">{data.draftReport}</div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-medical-blue font-bold mb-4 uppercase tracking-wider text-sm border-b border-medical-blue/20 pb-1 w-fit">Impression</h3>
                <div className="whitespace-pre-wrap pl-1 font-semibold text-slate-100">{data.impression}</div>
              </div>

              {/* Concise Summary Section */}
              {data.conciseSummary && (
                <div className="bg-rad-800/50 rounded-xl p-4 border border-rad-700/50 mt-6">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                     <IconList className="w-3.5 h-3.5" />
                     Shorten Report (Telegraphic)
                  </h4>
                  <div className="whitespace-pre-wrap font-mono text-sm text-slate-400 italic leading-relaxed">
                    {data.conciseSummary}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* SECTION B: Analysis Sidebar (Right Column - 1/3 width, stacked) */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        
        {/* Safety Check */}
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm flex flex-col">
          <div className="bg-amber-900/30 p-4 border-b border-amber-900/40 flex items-center gap-2">
            <IconAlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-amber-100 uppercase tracking-wide">Safety Check</h2>
          </div>
          <div className="p-5 flex-grow">
            {data.safetyChecks.length > 0 ? (
              <ul className="space-y-3">
                {data.safetyChecks.map((check, idx) => (
                  <li key={idx} className="flex gap-3 items-start text-sm text-amber-200/90 leading-snug">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    {check}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-green-400 flex items-center gap-2">
                <IconCheck className="w-4 h-4" /> No immediate safety concerns flagged.
              </p>
            )}
          </div>
        </div>

        {/* Follow-up Recommendation (Conditional) */}
        {hasFollowUp && (
          <div className="bg-teal-950/20 border border-teal-900/40 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm flex flex-col">
            <div className="bg-teal-900/30 p-4 border-b border-teal-900/40 flex items-center gap-2">
              <IconCalendar className="w-5 h-5 text-teal-400" />
              <h2 className="text-sm font-bold text-teal-100 uppercase tracking-wide">Follow-up</h2>
            </div>
            <div className="p-5 flex-grow flex gap-3 items-start">
               <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
               <p className="text-sm text-teal-200/90 leading-snug">{data.followUpRecommendation}</p>
            </div>
          </div>
        )}

        {/* Learning Corner */}
        <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm flex flex-col">
          <div className="bg-indigo-900/30 p-4 border-b border-indigo-900/40 flex items-center gap-2">
            <IconBookOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-indigo-100 uppercase tracking-wide">Resident Learning Corner</h2>
          </div>
          <div className="p-5 flex-grow">
            <ul className="space-y-4">
              {data.learningPoints.map((item, idx) => (
                <li key={idx} className="flex gap-3 items-start text-sm text-indigo-200/90 leading-snug">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <div className="flex flex-col gap-1.5 w-full">
                    <span>{item.point}</span>
                    {item.link && (
                      <a 
                        href={ensureUrl(item.link)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-medical-blue hover:text-sky-300 hover:underline transition-colors w-fit bg-indigo-900/50 px-2.5 py-1.5 rounded border border-indigo-800 mt-1 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.linkText || "View Guideline"}
                        <IconExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReportOutput;