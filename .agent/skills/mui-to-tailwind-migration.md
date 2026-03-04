---
name: mui-to-tailwind
description: Guia para converter componentes Material UI para Tailwind CSS mantendo o design system do Manejo Orgânico.
---

# Regras de Conversão

1. **Box e Containers:**
   - `<Box sx={{ p: 2, display: 'flex' }}>` -> `<div className="p-4 flex">` (Lembre-se: spacing 1 do MUI = 4px = w-1/h-1 do Tailwind).
   - Use `className={cn("base-classes", className)}` para permitir overrides.

2. **Tipografia:**
   - `<Typography variant="h1">` -> `<h1 className="text-3xl font-bold text-primary-900">`
   - Use a fonte 'Inter' definida no tema.

3. **Cores:**
   - Use as variáveis mapeadas: `bg-primary-main`, `text-secondary-dark`, `border-divider`.
   - NUNCA use cores hardcoded (ex: #15803d). Use sempre as classes do tema.

4. **Componentes Híbridos (Fase de Transição):**
   - Se o componente for complexo (ex: DataGrid), mantenha o MUI mas estilize o wrapper com Tailwind.
   - Para botões simples, converta para `<button className="...">` se possível, ou use classes no MUI Button.

5. **Exemplo Prático (Antes vs Depois):**
   *Antes:*
   ```jsx
   <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
     <Box sx={{ p: 2 }}>
       <Typography variant="h6" color="primary.main">Título</Typography>
     </Box>
   </Card>
   ```
   *Depois:*
   ```jsx
   <div className="rounded-lg border border-divider bg-white p-4">
     <h6 className="text-sm font-semibold text-primary-main">Título</h6>
   </div>
   ```
