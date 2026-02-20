// src/components/PmoForm/Secao5.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react + TabelaDinamica standard.

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionShell from '../Plan/SectionShell';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';

// ==================================================================
// ||                         INTERFACES                           ||
// ==================================================================

interface ProdutoTerceirizado {
    id: string | number;
    fornecedor?: string;
    localidade?: string;
    produto?: string;
    quantidade_ano?: string | number;
    processamento?: boolean | string | null;
}

interface Secao5Data {
    produtos_terceirizados?: ProdutoTerceirizado[];
    [key: string]: any;
}

interface Secao5MUIProps {
    data: Secao5Data | null | undefined;
    onSectionChange: (data: Secao5Data) => void;
}

// ==================================================================
// ||                     HELPER COMPONENTS                        ||
// ==================================================================

/**
 * Accordion Panel helper with fixed button type to prevent accidental submits.
 */
const AccordionPanel: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <span className="font-bold text-sm text-gray-800">{title}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="p-4">{children}</div>}
        </div>
    );
};

// ==================================================================
// ||                     MAIN COMPONENT                           ||
// ==================================================================

const Secao5MUI: React.FC<Secao5MUIProps> = ({ data, onSectionChange }) => {

    // Configuração das colunas seguindo o novo padrão TabelaDinamica
    const columns: TableColumn[] = [
        { id: 'fornecedor', label: 'Fornecedor', type: 'text' },
        { id: 'localidade', label: 'Localidade', type: 'text' },
        { id: 'produto', label: 'Produto', type: 'text' },
        { id: 'quantidade_ano', label: 'Quantidade/ano', type: 'number' },
        {
            id: 'processamento',
            label: 'Processamento',
            type: 'select',
            options: [
                { value: 'true', label: 'Sim' },
                { value: 'false', label: 'Não' }
            ]
        },
    ];

    /**
     * Sincroniza os dados da TabelaDinamica com o estado da Secção 5.
     * Converte os valores booleanos vindos do select (strings "true"/"false")
     * de volta para booleanos para manter a integridade do schema original.
     */
    const handleTabelaChange = (novoArray: ProdutoTerceirizado[]) => {
        const normalizedArray = novoArray.map(item => {
            let procValue = item.processamento;
            if (procValue === 'true') procValue = true;
            else if (procValue === 'false') procValue = false;

            return {
                ...item,
                processamento: procValue
            };
        });

        onSectionChange({ ...data, produtos_terceirizados: normalizedArray });
    };

    return (
        <SectionShell
            sectionLabel="Seção 5"
            title="Produção Terceirizada"
        >
            <AccordionPanel title="5.1. Adquire produtos de terceiros para processar ou comercializar sem processamento?" defaultOpen>
                <TabelaDinamica<ProdutoTerceirizado>
                    columns={columns}
                    data={data?.produtos_terceirizados || []}
                    onDataChange={handleTabelaChange}
                    itemName="Produto Terceirizado"
                    itemNoun="o"
                />
            </AccordionPanel>
        </SectionShell>
    );
};

export default Secao5MUI;
