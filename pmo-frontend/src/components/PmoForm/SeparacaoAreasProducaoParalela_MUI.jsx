import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, TextField, Typography } from '@mui/material';

function SeparacaoAreasProducaoParalelaMUI({ data, onDataChange }) {
  const opcoesBase = ["Áreas diferentes e identificadas", "Espécies diferentes ou variedades que apresentam diferenças visuais", "Insumos identificados e armazenados separadamente", "Animais de espécies diferentes", "Animais da mesma espécie com finalidades produtivas diferentes"];
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
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>Em caso de produção paralela (produção orgânica e não orgânica), como realiza a separação das áreas?</Typography>
      <FormGroup>
        {opcoesBase.map(opcao => (
          <FormControlLabel key={opcao} control={<Checkbox value={opcao} checked={selecionados.includes(opcao)} onChange={handleCheckboxChange} />} label={opcao} />
        ))}
      </FormGroup>
      <TextField label="Outros, citar:" name="descricao_separacao_areas_producao_paralela_outros" value={data?.descricao_separacao_areas_producao_paralela_outros || ''} onChange={handleTextChange} fullWidth variant="outlined" multiline rows={2} margin="normal" />
    </>
  );
}
export default SeparacaoAreasProducaoParalelaMUI;