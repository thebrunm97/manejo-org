# Lista de arquivos para deletar
$arquivos = @(
    "pmo-frontend/src/components/PmoForm/Secao2.jsx",
    "pmo-frontend/src/components/PmoForm/Secao3.jsx",
    "pmo-frontend/src/components/PmoForm/Secao4.jsx",
    "pmo-frontend/src/components/PmoForm/Secao5.jsx",
    "pmo-frontend/src/components/PmoForm/Secao6.jsx",
    "pmo-frontend/src/components/PmoForm/Secao7.jsx",
    "pmo-frontend/src/components/PmoForm/Secao8.jsx",
    "pmo-frontend/src/components/PmoForm/Secao11.jsx",
    "pmo-frontend/src/components/PmoForm/Secao12.jsx",
    "pmo-frontend/src/components/PmoForm/Secao13.jsx",
    "pmo-frontend/src/components/PmoForm/Secao14.jsx",
    "pmo-frontend/src/components/PmoForm/Secao15.jsx",
    "pmo-frontend/src/components/PmoForm/Secao16.jsx",
    "pmo-frontend/src/components/PmoForm/Secao17.jsx",
    "pmo-frontend/src/components/PmoForm/Secao18.jsx",
    "pmo-frontend/src/components/PmoForm/Historico.jsx",
    "pmo-frontend/src/components/PmoForm/CheckboxGroup.jsx",
    "pmo-frontend/src/components/PmoForm/Situacao.jsx",
    "pmo-frontend/src/components/PmoForm/SeparacaoAreasProducaoParalela.jsx",
    "pmo-frontend/src/components/PmoForm/Secao2_MUI.jsx", 
    "pmo-frontend/src/components/PmoForm/Secao10_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/TabelaDinamica.jsx",
    "pmo-frontend/src/components/PmoForm/TabelaDinamica_MUI.jsx"
    "pmo-frontend/src/components/PmoForm/DesktopStepper_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/StepperNavigation_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/MobileBottomNav.jsx",
    "pmo-frontend/src/components/PmoForm/SectionsModal.jsx",
    "pmo-frontend/src/components/PmoForm/PmoParaImpressao.jsx"
    "pmo-frontend/src/components/PmoForm/CheckboxGroup_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Situacao_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Coordenadas_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/DadosCadastrais_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/AreaPropriedade_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/LocalizacaoSafInput.jsx"
    "pmo-frontend/src/components/PmoForm/Secao1_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao3_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao4_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao5_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao6_MUI.jsx"
    "pmo-frontend/src/components/PmoForm/Secao7_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao8_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao9_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao11_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao12_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao13_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao14_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao15_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao16_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao17_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/Secao18_MUI.jsx",
    "pmo-frontend/src/context/AuthContext.jsx",
    "pmo-frontend/src/components/Navbar.jsx",
    "pmo-frontend/src/components/DashboardLayout.jsx", 
    "pmo-frontend/src/components/MainLayout.jsx",
    "pmo-frontend/src/components/ErrorBoundary.jsx",
    "pmo-frontend/src/components/DebugErrorBoundary.jsx",
    "pmo-frontend/src/components/Display/DisplayField.jsx",
    "pmo-frontend/src/components/Map/FarmMap.jsx",
    "pmo-frontend/src/components/Map/AnaliseFormDialog.jsx",
    "pmo-frontend/src/components/Map/TalhaoDetails.jsx",
    "pmo-frontend/src/pages/MapaPropriedade.jsx",
    "pmo-frontend/src/pages/MinhasCulturas.jsx",
    "pmo-frontend/src/pages/DashboardPage_MUI.jsx",
    "pmo-frontend/src/pages/PmoFormPage.jsx",
    "pmo-frontend/src/pages/PmoParaImpressao.jsx",
    "pmo-frontend/src/pages/TalhaoDetails.jsx",
    "pmo-frontend/src/pages/PmoDetailPage.jsx",
    "pmo-frontend/src/pages/PmoDetailPage_MUI.jsx",
    "pmo-frontend/src/pages/DesignLab.jsx",
    "pmo-frontend/src/main.jsx",
    "pmo-frontend/src/components/ProtectedRoute.jsx",
    "pmo-frontend/src/components/Common/DebouncedTextField.jsx",
    "pmo-frontend/src/components/Dashboard/HarvestDashboard.jsx",
    "pmo-frontend/src/components/PmoForm/Historico_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/MapaCroqui_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/RoteiroAcesso_MUI.jsx",
    "pmo-frontend/src/components/PmoForm/SeletorLocalizacaoSaf.jsx",
    "pmo-frontend/src/components/PmoForm/SeletorVisualSaf.jsx"
)


# Loop de deleção
foreach ($arq in $arquivos) {
    if (Test-Path $arq) {
        Remove-Item $arq -Force
        Write-Host "DELETADO: $arq" -ForegroundColor Green
    }
    else {
        Write-Host "JA DELETADO: $arq" -ForegroundColor Gray
    }
}