// src/components/PmoForm/Secao2RecordDetailsDialog.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React from 'react';
import { X, Flower, PawPrint, Factory } from 'lucide-react';
import { VegetalItem, AnimalItem, AgroindItem } from './Secao2';

export type Secao2ItemType = 'VEGETAL' | 'ANIMAL' | 'AGROIND_VEG' | 'AGROIND_ANI';

export interface Secao2RecordDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    item: VegetalItem | AnimalItem | AgroindItem | null;
    type: Secao2ItemType;
}

const getIconByType = (type: Secao2ItemType) => {
    switch (type) {
        case 'VEGETAL': return <Flower size={22} />;
        case 'ANIMAL': return <PawPrint size={22} />;
        case 'AGROIND_VEG':
        case 'AGROIND_ANI': return <Factory size={22} />;
        default: return <Flower size={22} />;
    }
};

const getChipLabel = (type: Secao2ItemType) => {
    switch (type) {
        case 'VEGETAL': return 'PPV – Produção Vegetal';
        case 'ANIMAL': return 'PPA – Produção Animal';
        case 'AGROIND_VEG': return 'PPOV – Agroind. Vegetal';
        case 'AGROIND_ANI': return 'PPOA – Agroind. Animal';
        default: return 'Atividade';
    }
};

const DetailField: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-800">{value || '-'}</p>
    </div>
);

const Secao2RecordDetailsDialog: React.FC<Secao2RecordDetailsDialogProps> = ({
    open,
    onClose,
    item,
    type,
}) => {
    if (!open || !item) return null;

    const getTitle = () => {
        if (type === 'VEGETAL' || type === 'AGROIND_VEG') {
            return (item as VegetalItem | AgroindItem).produto || 'Sem nome';
        }
        if (type === 'AGROIND_ANI') return (item as AgroindItem).produto || 'Sem nome';
        if (type === 'ANIMAL') return (item as AnimalItem).especie || 'Sem espécie';
        return 'Atividade';
    };

    const isVegetal = type === 'VEGETAL';
    const isAnimal = type === 'ANIMAL';
    const isAgroind = type.startsWith('AGROIND');

    const vegItem = isVegetal ? (item as VegetalItem) : null;
    const animItem = isAnimal ? (item as AnimalItem) : null;
    const agroItem = isAgroind ? (item as AgroindItem) : null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* HEADER */}
                <div className="flex items-center justify-between p-5 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-xl text-gray-800">
                            {getIconByType(type)}
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold text-gray-900 leading-tight">{getTitle()}</h2>
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-green-500 text-green-700">
                                {getChipLabel(type)}
                            </span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* BODY */}
                <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-100 pt-4">

                    {/* SEÇÃO 1: INFORMAÇÕES PRINCIPAIS */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                        <h3 className="text-sm font-extrabold text-gray-900 mb-3">Informações principais</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {isVegetal && vegItem && (
                                <>
                                    <DetailField label="Área Plantada" value={`${vegItem.area_plantada || '-'} ${vegItem.area_plantada_unidade}`} />
                                    <DetailField label="Produção Esperada/Ano" value={`${vegItem.producao_esperada_ano || '-'} ${vegItem.producao_unidade}`} />
                                </>
                            )}
                            {isAnimal && animItem && (
                                <>
                                    <DetailField label="Nº de Animais" value={animItem.n_de_animais} />
                                    <DetailField label="Produção Esperada" value={`${animItem.producao_esperada_ano || '-'} ${animItem.producao_unidade}`} />
                                    <DetailField label="Peso Vivo Médio" value={`${animItem.media_de_peso_vivo || '-'} kg`} />
                                </>
                            )}
                            {isAgroind && agroItem && (
                                <>
                                    <DetailField label="Frequência" value={agroItem.frequencia_producao} />
                                    <DetailField label="Época" value={agroItem.epoca_producao} />
                                    <div className="col-span-2">
                                        <DetailField label="Produção Esperada" value={`${agroItem.producao_esperada_ano || '-'} ${agroItem.producao_unidade}`} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* SEÇÃO 2: LOCALIZAÇÃO */}
                    <div>
                        <h3 className="text-sm font-extrabold text-gray-900 mb-3">Localização / Áreas</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {isVegetal && vegItem && (
                                <div className="col-span-2">
                                    <DetailField
                                        label="Talhões / Canteiros"
                                        value={
                                            typeof vegItem.talhoes_canteiros === 'string'
                                                ? vegItem.talhoes_canteiros
                                                : (vegItem.talhoes_canteiros as { _display?: string; talhao_nome?: string })?._display
                                                || (vegItem.talhoes_canteiros as { talhao_nome?: string })?.talhao_nome
                                                || 'Não especificado'
                                        }
                                    />
                                </div>
                            )}
                            {isAnimal && animItem && (
                                <>
                                    <DetailField label="Área Externa (ha)" value={animItem.area_externa} />
                                    <DetailField label="Área Instalações (m²)" value={animItem.area_interna_instalacoes} />
                                </>
                            )}
                            {isAgroind && (
                                <div className="col-span-2">
                                    <p className="text-sm text-gray-500">
                                        Localização vinculada à estrutura de processamento da propriedade.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SEÇÃO 3: DETALHES ADICIONAIS */}
                    {(isAnimal || isAgroind) && (
                        <div>
                            <h3 className="text-sm font-extrabold text-gray-900 mb-3">Detalhes adicionais</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {isAnimal && animItem && (
                                    <>
                                        <DetailField label="Exploração" value={animItem.exploracao} />
                                        <DetailField label="Estágio de Vida" value={animItem.estagio_de_vida} />
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="flex justify-end p-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                    <button type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Secao2RecordDetailsDialog;
