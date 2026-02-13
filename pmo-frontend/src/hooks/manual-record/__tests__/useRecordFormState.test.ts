/**
 * @file useRecordFormState.test.ts
 * @description Unit tests for the useRecordFormState hook.
 * Covers form initialization, draft updates, tab switching, and edit mode population.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    useRecordFormState,
    initialPlantioDraft,
    initialManejoDraft,
    initialColheitaDraft,
    initialOutroDraft,
    getNowISO,
    getLoteSuggestion
} from '../useRecordFormState';
import {
    ActivityType,
    UnitType,
    ManejoSubtype,
    CadernoCampoRecord
} from '../../../types/CadernoTypes';

// Mock Date for consistent testing
const MOCK_DATE = new Date('2026-01-16T10:30:00');

describe('useRecordFormState', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(MOCK_DATE);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Helper functions', () => {
        it('getNowISO should return ISO string without seconds', () => {
            const result = getNowISO();
            // Format: "2026-01-16 10:30" (sv locale)
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
        });

        it('getLoteSuggestion should return LOTE-YYMMDD format', () => {
            const result = getLoteSuggestion();
            expect(result).toBe('LOTE-260116');
        });
    });

    describe('Initialization (creation mode)', () => {
        it('should initialize with plantio as default activeTab', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            expect(result.current.activeTab).toBe('plantio');
        });

        it('should set isEditMode to false when no recordToEdit', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            expect(result.current.isEditMode).toBe(false);
        });

        it('should initialize drafts with current dataHora', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            expect(result.current.plantioDraft.dataHora).toBeTruthy();
            expect(result.current.manejoDraft.dataHora).toBeTruthy();
            expect(result.current.colheitaDraft.dataHora).toBeTruthy();
            expect(result.current.outroDraft.dataHora).toBeTruthy();
        });

        it('should initialize colheitaDraft with lote suggestion', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            expect(result.current.colheitaDraft.lote).toBe('LOTE-260116');
        });
    });

    describe('setActiveTab', () => {
        it('should change activeTab', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            expect(result.current.activeTab).toBe('plantio');

            act(() => {
                result.current.setActiveTab('manejo');
            });

            expect(result.current.activeTab).toBe('manejo');
        });
    });

    describe('getCurrentDraft', () => {
        it('should return plantioDraft when activeTab is plantio', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('plantio');
            });

            const draft = result.current.getCurrentDraft();
            expect(draft).toHaveProperty('metodoPropagacao');
            expect(draft).toHaveProperty('unidadePlantio');
        });

        it('should return manejoDraft when activeTab is manejo', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('manejo');
            });

            const draft = result.current.getCurrentDraft();
            expect(draft).toHaveProperty('subtipoManejo');
            expect(draft).toHaveProperty('insumo');
        });

        it('should return colheitaDraft when activeTab is colheita', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('colheita');
            });

            const draft = result.current.getCurrentDraft();
            expect(draft).toHaveProperty('lote');
            expect(draft).toHaveProperty('classificacao');
        });

        it('should return outroDraft when activeTab is outro', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('outro');
            });

            const draft = result.current.getCurrentDraft();
            expect(draft).toHaveProperty('tipoOutro');
            expect(draft).toHaveProperty('fornecedor');
        });
    });

    describe('updateDraft', () => {
        it('should update plantio draft fields', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('plantio');
            });

            act(() => {
                result.current.updateDraft('produto', 'Tomate');
                result.current.updateDraft('locais', ['Talhão 1', 'Talhão 2']);
            });

            expect(result.current.plantioDraft.produto).toBe('Tomate');
            expect(result.current.plantioDraft.locais).toEqual(['Talhão 1', 'Talhão 2']);
        });

        it('should update manejo draft fields', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('manejo');
            });

            act(() => {
                result.current.updateDraft('insumo', 'Composto orgânico');
                result.current.updateDraft('subtipoManejo', ManejoSubtype.APLICACAO_INSUMO);
            });

            expect(result.current.manejoDraft.insumo).toBe('Composto orgânico');
            expect(result.current.manejoDraft.subtipoManejo).toBe(ManejoSubtype.APLICACAO_INSUMO);
        });

        it('should update colheita draft fields', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('colheita');
            });

            act(() => {
                result.current.updateDraft('qtdColheita', '150');
                result.current.updateDraft('classificacao', 'Segunda');
            });

            expect(result.current.colheitaDraft.qtdColheita).toBe('150');
            expect(result.current.colheitaDraft.classificacao).toBe('Segunda');
        });

        it('should update outro draft fields', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('outro');
            });

            act(() => {
                result.current.updateDraft('tipoOutro', 'compra');
                result.current.updateDraft('fornecedor', 'Cooperativa ABC');
            });

            expect(result.current.outroDraft.tipoOutro).toBe('compra');
            expect(result.current.outroDraft.fornecedor).toBe('Cooperativa ABC');
        });
    });

    describe('clearDraft', () => {
        it('should reset plantio draft to initial state with fresh dataHora', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            // Modify the draft first
            act(() => {
                result.current.setActiveTab('plantio');
                result.current.updateDraft('produto', 'Alface');
                result.current.updateDraft('locais', ['Canteiro 1']);
            });

            expect(result.current.plantioDraft.produto).toBe('Alface');

            // Clear the draft
            act(() => {
                result.current.clearDraft('plantio');
            });

            expect(result.current.plantioDraft.produto).toBe('');
            expect(result.current.plantioDraft.locais).toEqual([]);
            expect(result.current.plantioDraft.metodoPropagacao).toBe('Muda');
            expect(result.current.plantioDraft.dataHora).toBeTruthy();
        });

        it('should reset colheita draft and regenerate lote suggestion', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            act(() => {
                result.current.setActiveTab('colheita');
                result.current.updateDraft('lote', 'CUSTOM-LOTE');
            });

            act(() => {
                result.current.clearDraft('colheita');
            });

            expect(result.current.colheitaDraft.lote).toBe('LOTE-260116');
        });
    });

    describe('resetAllDrafts', () => {
        it('should reset all drafts and set activeTab to plantio', () => {
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: null })
            );

            // Modify multiple drafts using direct setters (since updateDraft is tab-specific)
            act(() => {
                result.current.setManejoDraft(prev => ({ ...prev, insumo: 'Test Insumo' }));
                result.current.setColheitaDraft(prev => ({ ...prev, qtdColheita: '999' }));
                result.current.setActiveTab('colheita');
            });

            expect(result.current.activeTab).toBe('colheita');
            expect(result.current.manejoDraft.insumo).toBe('Test Insumo');
            expect(result.current.colheitaDraft.qtdColheita).toBe('999');

            // Reset all
            act(() => {
                result.current.resetAllDrafts();
            });

            expect(result.current.activeTab).toBe('plantio');
            expect(result.current.manejoDraft.insumo).toBe('');
            expect(result.current.colheitaDraft.qtdColheita).toBe('');
        });
    });

    describe('Edit mode population', () => {
        const createMockPlantioRecord = (): CadernoCampoRecord => ({
            id: 'record-123',
            pmo_id: 1,
            data_registro: '2026-01-15T09:00:00Z',
            tipo_atividade: ActivityType.PLANTIO,
            produto: 'Cenoura',
            talhao_canteiro: 'Talhão A; Talhão B',
            observacao_original: 'Plantio de inverno',
            detalhes_tecnicos: {
                metodo_propagacao: 'Semente',
                qtd_utilizada: 500,
                unidade_medida: UnitType.G
            }
        });

        const createMockManejoRecord = (): CadernoCampoRecord => ({
            id: 'record-456',
            pmo_id: 1,
            data_registro: '2026-01-15T14:00:00Z',
            tipo_atividade: ActivityType.MANEJO,
            produto: 'Tomate',
            talhao_canteiro: 'Estufa 1',
            observacao_original: '',
            detalhes_tecnicos: {
                subtipo: ManejoSubtype.APLICACAO_INSUMO,
                nome_insumo: 'Biofertilizante',
                dosagem: 5,
                unidade_dosagem: UnitType.L_HA
            }
        });

        const createMockColheitaRecord = (): CadernoCampoRecord => ({
            id: 'record-789',
            pmo_id: 1,
            data_registro: '2026-01-15T08:00:00Z',
            tipo_atividade: ActivityType.COLHEITA,
            produto: 'Alface',
            talhao_canteiro: 'Canteiro 3',
            observacao_original: 'Colheita matinal',
            detalhes_tecnicos: {
                lote: 'LOTE-250115',
                destino: 'Feira Orgânica',
                classificacao: 'Primeira',
                qtd: 75,
                unidade: UnitType.KG
            }
        });

        it('should populate plantioDraft from existing Plantio record', () => {
            const record = createMockPlantioRecord();
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.isEditMode).toBe(true);
            expect(result.current.activeTab).toBe('plantio');
            expect(result.current.plantioDraft.produto).toBe('Cenoura');
            expect(result.current.plantioDraft.locais).toEqual(['Talhão A', 'Talhão B']);
            expect(result.current.plantioDraft.metodoPropagacao).toBe('Semente');
            expect(result.current.plantioDraft.qtdPlantio).toBe('500');
            expect(result.current.plantioDraft.unidadePlantio).toBe(UnitType.G);
        });

        it('should populate manejoDraft from existing Manejo record', () => {
            const record = createMockManejoRecord();
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.isEditMode).toBe(true);
            expect(result.current.activeTab).toBe('manejo');
            expect(result.current.manejoDraft.produto).toBe('Tomate');
            expect(result.current.manejoDraft.subtipoManejo).toBe(ManejoSubtype.APLICACAO_INSUMO);
            expect(result.current.manejoDraft.insumo).toBe('Biofertilizante');
            expect(result.current.manejoDraft.dosagem).toBe('5');
        });

        it('should populate colheitaDraft from existing Colheita record', () => {
            const record = createMockColheitaRecord();
            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.isEditMode).toBe(true);
            expect(result.current.activeTab).toBe('colheita');
            expect(result.current.colheitaDraft.produto).toBe('Alface');
            expect(result.current.colheitaDraft.lote).toBe('LOTE-250115');
            expect(result.current.colheitaDraft.destino).toBe('Feira Orgânica');
            expect(result.current.colheitaDraft.qtdColheita).toBe('75');
            expect(result.current.colheitaDraft.unidadeColheita).toBe(UnitType.KG);
        });

        it('should parse talhao_canteiro with semicolon separator', () => {
            const record = createMockPlantioRecord();
            record.talhao_canteiro = 'Local A; Local B ; Local C';

            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.plantioDraft.locais).toEqual(['Local A', 'Local B', 'Local C']);
        });

        it('should populate locais from caderno_campo_canteiros N:N data', () => {
            const record: CadernoCampoRecord = {
                ...createMockPlantioRecord(),
                talhao_canteiro: 'Legado Ignorado',
                caderno_campo_canteiros: [
                    { canteiros: { id: 1, nome: 'Canteiro 1' } },
                    { canteiros: { id: 2, nome: 'Canteiro 2' } },
                    { canteiros: { id: 3, nome: 'Canteiro 3' } }
                ]
            };

            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.plantioDraft.locais).toEqual(['Canteiro 1', 'Canteiro 2', 'Canteiro 3']);
        });

        it('should fallback to talhao_canteiro when caderno_campo_canteiros is empty', () => {
            const record: CadernoCampoRecord = {
                ...createMockPlantioRecord(),
                talhao_canteiro: 'Talhão X; Talhão Y',
                caderno_campo_canteiros: []
            };

            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.plantioDraft.locais).toEqual(['Talhão X', 'Talhão Y']);
        });

        it('should handle missing detalhes_tecnicos gracefully', () => {
            const record: CadernoCampoRecord = {
                id: 'record-empty',
                pmo_id: 1,
                data_registro: '2026-01-15T10:00:00Z',
                tipo_atividade: ActivityType.OUTRO,
                produto: 'Genérico',
                detalhes_tecnicos: {}
            };

            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.activeTab).toBe('outro');
            expect(result.current.isEditMode).toBe(true);
        });

        it('should infer Manejo subtype from legacy fields', () => {
            const record: CadernoCampoRecord = {
                id: 'record-legacy',
                pmo_id: 1,
                data_registro: '2026-01-15T10:00:00Z',
                tipo_atividade: ActivityType.MANEJO,
                produto: 'Cultura X',
                detalhes_tecnicos: {
                    item_higienizado: 'Ferramentas' // Should infer HIGIENIZACAO
                }
            };

            const { result } = renderHook(() =>
                useRecordFormState({ open: true, recordToEdit: record })
            );

            expect(result.current.manejoDraft.subtipoManejo).toBe(ManejoSubtype.HIGIENIZACAO);
            expect(result.current.manejoDraft.itemHigienizado).toBe('Ferramentas');
        });
    });

    describe('Dialog open/close behavior', () => {
        it('should not run useEffect when open is false', () => {
            const record = {
                id: 'test',
                pmo_id: 1,
                data_registro: '2026-01-15T10:00:00Z',
                tipo_atividade: ActivityType.PLANTIO,
                produto: 'Test',
                detalhes_tecnicos: {}
            } as CadernoCampoRecord;

            const { result } = renderHook(() =>
                useRecordFormState({ open: false, recordToEdit: record })
            );

            // Should stay on default tab since open=false
            // Note: The initial state is still set, but useEffect won't populate from record
            expect(result.current.activeTab).toBe('plantio');
        });
    });
});
