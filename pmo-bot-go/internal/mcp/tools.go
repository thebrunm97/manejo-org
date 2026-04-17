// Package mcp implements the Model Context Protocol server and its tools.
// This file is intentionally empty after modular refactoring.
// See the following files for the implementation:
//   - tools_registry.go  — tool definitions (CalcularAdubacaoDef) and InitializeTools
//   - tools_producao.go  — handleRegistrarColheita, handleRegistrarVenda
//   - tools_manejo.go    — handleCalcularAdubacao, handleAdicionarInsumoPMO,
//                          handleRegistrarLimpeza, handleRegistrarPropagacaoVegetal,
//                          handleRegistrarCompostagem, handleRegistrarCompraInsumo
//   - tools_infra.go     — handleCriarNovoTalhao, handleCriarNovosCanteiros,
//                          handleCriarInfraestruturaFazenda, handleSelecionarFazenda,
//                          handleSelecionarPMO
//   - tools_rag.go       — handleConsultarDadosFazenda, handleConsultarBaseConhecimento
//   - utils.go           — sanitize, parseArgToFloat
package mcp
