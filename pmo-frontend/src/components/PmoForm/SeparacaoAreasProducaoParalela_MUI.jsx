// src/components/PmoForm/SeparacaoAreasProducaoParalela_MUI.jsx
// Zero MUI — Tailwind + HTML nativo

import React from 'react';

function SeparacaoAreasProducaoParalelaMUI({ data, onDataChange }) {
  const opcoesBase = [
    "Áreas diferentes e identificadas",
    "Espécies diferentes ou variedades que apresentam diferenças visuais",
    "Insumos identificados e armazenados separadamente",
    "Animais de espécies diferentes",
    "Animais da mesma espécie com finalidades produtivas diferentes"
  ];
  const stringSelecionados = data?.descricao_separacao_areas_producao_paralela || '';
  const selecionados = stringSelecionados ? stringSelecionados.split('; ').filter(Boolean) : [];

  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    let novosSelecionados = [...selecionados];
    if (checked) {
      novosSelecionados.push(value);
    } else {
      novosSelecionados = novosSelecionados.filter(opt => opt !== value);
    }
    onDataChange({ ...data, descricao_separacao_areas_producao_paralela: novosSelecionados.join('; ') });
  };

  const handleTextChange = (e) => {
    onDataChange({ ...data, [e.target.name]: e.target.value });
  };

  return (
    <>
      <p className="text-sm text-gray-500 mb-3">
        Em caso de produção paralela (produção orgânica e não orgânica), como realiza a separação das áreas?
      </p>

      <div className="space-y-1.5">
        {opcoesBase.map(opcao => (
          <label key={opcao} className="flex items-start gap-2.5 py-1 cursor-pointer group">
            <input
              type="checkbox"
              value={opcao}
              checked={selecionados.includes(opcao)}
              onChange={handleCheckboxChange}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900 select-none">
              {opcao}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-600 mb-1">Outros, citar:</label>
        <textarea
          name="descricao_separacao_areas_producao_paralela_outros"
          value={data?.descricao_separacao_areas_producao_paralela_outros || ''}
          onChange={handleTextChange}
          rows={2}
          className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                     focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                     placeholder-gray-400 resize-y"
        />
      </div>
    </>
  );
}
export default SeparacaoAreasProducaoParalelaMUI;