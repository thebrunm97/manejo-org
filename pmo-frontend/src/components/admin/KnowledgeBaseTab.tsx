// src/components/admin/KnowledgeBaseTab.tsx

import React, { useState } from 'react';
import { DocumentsPanel } from './knowledge/DocumentsPanel';
import { PlaygroundPanel } from './knowledge/PlaygroundPanel';
import { PlaygroundHistory } from './knowledge/PlaygroundHistory';

// Note: Future tabs like RulesEditor and Telemetry will be added here in subsequent phases.
type ActiveTab = 'documents' | 'rules' | 'playground' | 'history' | 'telemetry';

const KnowledgeBaseTab: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('documents');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-serif font-bold text-agro-floresta uppercase tracking-tight">
                    Knowledge Ops Panel
                </h2>
                <p className="text-sm text-agro-floresta/60 mt-2">
                    Gestão operacional do Organic Knowledge Framework (OKF). Faça upload de cartilhas, edite regras e monitore a telemetria do motor cognitivo.
                </p>
            </div>

            {/* Modular Navigation */}
            <div className="flex items-center gap-2 border-b border-agro-ouro/20 pb-4">
                <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors ${
                        activeTab === 'documents' 
                            ? 'bg-agro-floresta text-agro-ouro shadow-md' 
                            : 'text-agro-floresta/60 hover:bg-agro-floresta/5'
                    }`}
                >
                    Documentos
                </button>
                <button
                    disabled
                    className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-agro-floresta/30 cursor-not-allowed"
                    title="Disponível na Fase 2"
                >
                    Regras (Breve)
                </button>
                <button
                    onClick={() => setActiveTab('playground')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors ${
                        activeTab === 'playground' 
                            ? 'bg-agro-floresta text-agro-ouro shadow-md' 
                            : 'text-agro-floresta/60 hover:bg-agro-floresta/5'
                    }`}
                >
                    Playground
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors ${
                        activeTab === 'history' 
                            ? 'bg-agro-floresta text-agro-ouro shadow-md' 
                            : 'text-agro-floresta/60 hover:bg-agro-floresta/5'
                    }`}
                >
                    Histórico
                </button>
            </div>

            {/* Content Area */}
            <div className="pt-4">
                {activeTab === 'documents' && <DocumentsPanel />}
                {activeTab === 'playground' && <PlaygroundPanel />}
                {activeTab === 'history' && <PlaygroundHistory />}
                {/* Future components will be rendered here */}
            </div>
        </div>
    );
};

export default KnowledgeBaseTab;
