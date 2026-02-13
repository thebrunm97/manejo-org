/**
 * @file useRecordValidation.test.ts
 * @description Unit tests for the useRecordValidation hook.
 * Covers all activity types: Plantio, Manejo, Colheita, Outro.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    useRecordValidation,
    PlantioDraft,
    ManejoDraft,
    ColheitaDraft,
    OutroDraft
} from '../useRecordValidation';
import { ManejoSubtype, UnitType } from '../../../types/CadernoTypes';

// --- Helper Factories ---
const createBasePlantioDraft = (overrides: Partial<PlantioDraft> = {}): PlantioDraft => ({
    dataHora: '2026-01-16T10:00',
    locais: ['Talhão A'],
    produto: 'Alface',
    observacao: '',
    metodoPropagacao: 'Muda',
    qtdPlantio: '100',
    unidadePlantio: UnitType.UNID,
    houveDescartes: false,
    qtdDescartes: '',
    unidadeDescartes: UnitType.KG,
    ...overrides
});

const createBaseManejoDraft = (overrides: Partial<ManejoDraft> = {}): ManejoDraft => ({
    dataHora: '2026-01-16T10:00',
    locais: ['Talhão A'],
    produto: 'Tomate',
    observacao: '',
    subtipoManejo: ManejoSubtype.MANEJO_CULTURAL,
    tipoManejo: 'Adubação',
    insumo: '',
    dosagem: '',
    unidadeDosagem: UnitType.L_HA,
    responsavel: '',
    equipamento: '',
    itemHigienizado: '',
    produtoUtilizado: '',
    atividadeCultural: 'Capina',
    qtdTrabalhadores: '',
    ...overrides
});

const createBaseColheitaDraft = (overrides: Partial<ColheitaDraft> = {}): ColheitaDraft => ({
    dataHora: '2026-01-16T10:00',
    locais: ['Talhão A'],
    produto: 'Alface',
    observacao: '',
    lote: 'LOTE-260116',
    destino: 'Mercado Interno',
    classificacao: 'Primeira',
    qtdColheita: '50',
    unidadeColheita: UnitType.KG,
    houveDescartes: false,
    qtdDescartes: '',
    unidadeDescartes: UnitType.KG,
    ...overrides
});

const createBaseOutroDraft = (overrides: Partial<OutroDraft> = {}): OutroDraft => ({
    dataHora: '2026-01-16T10:00',
    locais: [],
    produto: '',
    observacao: 'Atividade geral',
    tipoOutro: 'outro',
    quantidade: '',
    unidade: UnitType.UNID,
    numeroDocumento: '',
    fornecedor: '',
    tipoOrigem: 'compra',
    destinoVenda: '',
    ...overrides
});

describe('useRecordValidation', () => {
    describe('validate() main dispatcher', () => {
        it('should return isValid=true when all fields are valid for plantio', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBasePlantioDraft();

            let validationResult;
            act(() => {
                validationResult = result.current.validate(draft, 'plantio');
            });

            expect(validationResult!.isValid).toBe(true);
            expect(Object.keys(validationResult!.errors)).toHaveLength(0);
        });

        it('should update errors state after validation', () => {
            const { result } = renderHook(() => useRecordValidation());
            const invalidDraft = createBasePlantioDraft({ produto: '', locais: [] });

            act(() => {
                result.current.validate(invalidDraft, 'plantio');
            });

            expect(result.current.errors).toHaveProperty('produto');
            expect(result.current.errors).toHaveProperty('locais');
        });
    });

    describe('validatePlantio', () => {
        it('should require dataHora', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBasePlantioDraft({ dataHora: '' });

            const errors = result.current.validatePlantio(draft);

            expect(errors).toHaveProperty('data', 'Data é obrigatória');
        });

        it('should require produto (cultura)', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBasePlantioDraft({ produto: '   ' });

            const errors = result.current.validatePlantio(draft);

            expect(errors).toHaveProperty('produto', 'Cultura é obrigatória');
        });

        it('should require metodoPropagacao', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBasePlantioDraft({ metodoPropagacao: '' });

            const errors = result.current.validatePlantio(draft);

            expect(errors).toHaveProperty('metodo', 'Método é obrigatório');
        });

        it('should require at least one local', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBasePlantioDraft({ locais: [] });

            const errors = result.current.validatePlantio(draft);

            expect(errors).toHaveProperty('locais', 'Local é obrigatório');
        });

        it('should return no errors for valid draft', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBasePlantioDraft();

            const errors = result.current.validatePlantio(draft);

            expect(Object.keys(errors)).toHaveLength(0);
        });
    });

    describe('validateManejo', () => {
        describe('MANEJO_CULTURAL subtype', () => {
            it('should require atividadeCultural', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.MANEJO_CULTURAL,
                    atividadeCultural: ''
                });

                const { errors } = result.current.validateManejo(draft);

                expect(errors).toHaveProperty('atividadeCultural', 'Atividade obrigatória');
            });

            it('should require produto OR locais', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.MANEJO_CULTURAL,
                    produto: '',
                    locais: [],
                    atividadeCultural: 'Capina'
                });

                const { errors } = result.current.validateManejo(draft);

                expect(errors).toHaveProperty('produto', 'Informe Cultura ou Local');
                expect(errors).toHaveProperty('locais', 'Informe Cultura ou Local');
            });

            it('should pass when produto is filled', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.MANEJO_CULTURAL,
                    produto: 'Tomate',
                    locais: [],
                    atividadeCultural: 'Poda'
                });

                const { errors } = result.current.validateManejo(draft);

                expect(errors).not.toHaveProperty('produto');
                expect(errors).not.toHaveProperty('locais');
            });
        });

        describe('APLICACAO_INSUMO subtype', () => {
            it('should require insumo and dosagem', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.APLICACAO_INSUMO,
                    insumo: '',
                    dosagem: ''
                });

                const { errors } = result.current.validateManejo(draft);

                expect(errors).toHaveProperty('insumo', 'Insumo obrigatório');
                expect(errors).toHaveProperty('dosagem', 'Dose obrigatória');
            });

            it('should block prohibited organic inputs (glifosato)', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.APLICACAO_INSUMO,
                    insumo: 'Roundup (glifosato)',
                    dosagem: '2'
                });

                const { errors, warning } = result.current.validateManejo(draft);

                expect(errors).toHaveProperty('insumo');
                expect(errors.insumo).toContain('PROIBIDO');
                expect(warning).toBeNull();
            });

            it('should return warning for attention inputs (cobre)', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.APLICACAO_INSUMO,
                    insumo: 'Calda bordalesa',
                    dosagem: '5'
                });

                const { errors, warning } = result.current.validateManejo(draft);

                expect(errors).not.toHaveProperty('insumo');
                expect(warning).not.toBeNull();
                expect(warning?.status).toBe('atencao');
            });

            it('should pass for allowed organic inputs', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.APLICACAO_INSUMO,
                    insumo: 'Composto orgânico',
                    dosagem: '10'
                });

                const { errors, warning } = result.current.validateManejo(draft);

                expect(errors).not.toHaveProperty('insumo');
                expect(warning).toBeNull();
            });
        });

        describe('HIGIENIZACAO subtype', () => {
            it('should require itemHigienizado and produtoUtilizado', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.HIGIENIZACAO,
                    itemHigienizado: '',
                    produtoUtilizado: ''
                });

                const { errors } = result.current.validateManejo(draft);

                expect(errors).toHaveProperty('itemHigienizado', 'Item obrigatório');
                expect(errors).toHaveProperty('produtoUtilizado', 'Produto obrigatório');
            });

            it('should pass when hygienization fields are filled', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseManejoDraft({
                    subtipoManejo: ManejoSubtype.HIGIENIZACAO,
                    itemHigienizado: 'Caixas de colheita',
                    produtoUtilizado: 'Água sanitária diluída'
                });

                const { errors } = result.current.validateManejo(draft);

                expect(Object.keys(errors)).toHaveLength(0);
            });
        });
    });

    describe('validateColheita', () => {
        it('should require dataHora', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBaseColheitaDraft({ dataHora: '' });

            const errors = result.current.validateColheita(draft);

            expect(errors).toHaveProperty('data', 'Data é obrigatória');
        });

        it('should require produto (cultura)', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBaseColheitaDraft({ produto: '' });

            const errors = result.current.validateColheita(draft);

            expect(errors).toHaveProperty('produto', 'Cultura é obrigatória');
        });

        it('should require qtdColheita > 0', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBaseColheitaDraft({ qtdColheita: '0' });

            const errors = result.current.validateColheita(draft);

            expect(errors).toHaveProperty('qtdColheita', 'Qtd é obrigatória');
        });

        it('should require qtdColheita to be filled', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBaseColheitaDraft({ qtdColheita: '' });

            const errors = result.current.validateColheita(draft);

            expect(errors).toHaveProperty('qtdColheita', 'Qtd é obrigatória');
        });

        it('should pass for valid colheita draft', () => {
            const { result } = renderHook(() => useRecordValidation());
            const draft = createBaseColheitaDraft();

            const errors = result.current.validateColheita(draft);

            expect(Object.keys(errors)).toHaveLength(0);
        });
    });

    describe('validateOutro', () => {
        describe('compra subtype', () => {
            it('should require produto, quantidade, and fornecedor', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseOutroDraft({
                    tipoOutro: 'compra',
                    produto: '',
                    quantidade: '',
                    fornecedor: ''
                });

                const errors = result.current.validateOutro(draft);

                expect(errors).toHaveProperty('produto', 'Produto obrigatório');
                expect(errors).toHaveProperty('quantidade', 'Qtd obrigatória');
                expect(errors).toHaveProperty('fornecedor', 'Fornecedor obrigatório');
            });

            it('should pass for valid compra draft', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseOutroDraft({
                    tipoOutro: 'compra',
                    produto: 'Adubo orgânico',
                    quantidade: '100',
                    fornecedor: 'Fornecedor XYZ'
                });

                const errors = result.current.validateOutro(draft);

                expect(Object.keys(errors)).toHaveLength(0);
            });
        });

        describe('venda subtype', () => {
            it('should require produto, quantidade, and destinoVenda', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseOutroDraft({
                    tipoOutro: 'venda',
                    produto: '',
                    quantidade: '',
                    destinoVenda: ''
                });

                const errors = result.current.validateOutro(draft);

                expect(errors).toHaveProperty('produto', 'Produto/Lote obrigatório');
                expect(errors).toHaveProperty('quantidade', 'Qtd obrigatória');
                expect(errors).toHaveProperty('destinoVenda', 'Destino obrigatório');
            });
        });

        describe('outro genérico subtype', () => {
            it('should require at least produto, locais, or observacao', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseOutroDraft({
                    tipoOutro: 'outro',
                    produto: '',
                    locais: [],
                    observacao: ''
                });

                const errors = result.current.validateOutro(draft);

                expect(errors).toHaveProperty('observacao', 'Preencha ao menos um campo');
                expect(errors).toHaveProperty('produto', 'Obrigatório');
                expect(errors).toHaveProperty('locais', 'Obrigatório');
            });

            it('should pass when observacao is filled', () => {
                const { result } = renderHook(() => useRecordValidation());
                const draft = createBaseOutroDraft({
                    tipoOutro: 'outro',
                    produto: '',
                    locais: [],
                    observacao: 'Visita técnica do auditor'
                });

                const errors = result.current.validateOutro(draft);

                expect(Object.keys(errors)).toHaveLength(0);
            });
        });
    });

    describe('clearError', () => {
        it('should remove a specific error field', () => {
            const { result } = renderHook(() => useRecordValidation());
            const invalidDraft = createBasePlantioDraft({ produto: '', locais: [] });

            act(() => {
                result.current.validate(invalidDraft, 'plantio');
            });

            expect(result.current.errors).toHaveProperty('produto');
            expect(result.current.errors).toHaveProperty('locais');

            act(() => {
                result.current.clearError('produto');
            });

            expect(result.current.errors).not.toHaveProperty('produto');
            expect(result.current.errors).toHaveProperty('locais');
        });
    });

    describe('clearAllErrors', () => {
        it('should clear all errors and organicWarning', () => {
            const { result } = renderHook(() => useRecordValidation());
            const invalidDraft = createBasePlantioDraft({ produto: '', locais: [] });

            act(() => {
                result.current.validate(invalidDraft, 'plantio');
            });

            expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

            act(() => {
                result.current.clearAllErrors();
            });

            expect(Object.keys(result.current.errors)).toHaveLength(0);
            expect(result.current.organicWarning).toBeNull();
        });
    });

    describe('checkInsumoOrganico', () => {
        it('should set organicWarning for attention inputs', () => {
            const { result } = renderHook(() => useRecordValidation());

            act(() => {
                result.current.checkInsumoOrganico('Sulfato de cobre');
            });

            expect(result.current.organicWarning).not.toBeNull();
            expect(result.current.organicWarning?.status).toBe('atencao');
        });

        it('should clear organicWarning for allowed inputs', () => {
            const { result } = renderHook(() => useRecordValidation());

            // First set a warning
            act(() => {
                result.current.checkInsumoOrganico('Cobre');
            });
            expect(result.current.organicWarning).not.toBeNull();

            // Then check an allowed input
            act(() => {
                result.current.checkInsumoOrganico('Composto orgânico');
            });
            expect(result.current.organicWarning).toBeNull();
        });

        it('should return the rule for prohibited inputs', () => {
            const { result } = renderHook(() => useRecordValidation());

            let rule;
            act(() => {
                rule = result.current.checkInsumoOrganico('Glifosato');
            });

            expect(rule?.status).toBe('proibido');
        });
    });
});
