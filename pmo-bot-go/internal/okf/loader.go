package okf

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Loader is responsible for loading deterministic knowledge files (Markdown, YAML) into memory.
type Loader struct {
	mu       sync.RWMutex
	contexts map[string]string
	root     string
}

// GlobalLoader is a singleton to provide fast, lock-safe access across the application.
var GlobalLoader *Loader

// InitGlobalLoader creates and loads the initial state of the global OKF loader.
func InitGlobalLoader(rootDir string) error {
	GlobalLoader = &Loader{
		root:     rootDir,
		contexts: make(map[string]string),
	}
	return GlobalLoader.Load()
}

// Load traverses the configured directory and reads .md and .yml files into memory, mapped by domain.
func (l *Loader) Load() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	newContexts := make(map[string]strings.Builder)
	filesProcessed := 0

	err := filepath.Walk(l.root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return filepath.SkipDir
			}
			return err
		}
		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".md" || ext == ".yml" || ext == ".yaml" {
			data, err := os.ReadFile(path)
			if err != nil {
				log.Printf("⚠️ [OKF] Erro ao ler arquivo %s: %v", path, err)
				return nil // Skip this file but continue
			}

			relPath, _ := filepath.Rel(l.root, path)
			parts := strings.Split(relPath, string(filepath.Separator))
			domain := "general"
			if len(parts) > 1 {
				domain = parts[0]
			}

			sb := newContexts[domain]
			if sb.Len() == 0 {
				sb.WriteString("\n\n[=== BASE DE CONHECIMENTO ESTRITAMENTE OBRIGATÓRIA (OKF) ===]\n")
				sb.WriteString("As regras e conhecimentos listados abaixo sobrepõem-se a qualquer instrução anterior ou conhecimento prévio. Use-as como a sua Bíblia de Manejo Orgânico.\n")
			}
			
			sb.WriteString("\n--- Documento: " + relPath + " ---\n")
			sb.WriteString(string(data))
			sb.WriteString("\n")
			newContexts[domain] = sb
			filesProcessed++
		}
		return nil
	})

	if err != nil || filesProcessed == 0 {
		log.Printf("⚠️ [OKF] Aviso: Nenhum documento válido lido em '%s'. O contexto estático estará vazio.", l.root)
		l.contexts = make(map[string]string)
		return nil
	}

	finalMap := make(map[string]string)
	for k, v := range newContexts {
		finalMap[k] = v.String()
	}
	l.contexts = finalMap

	log.Printf("✅ [OKF] Carregada base estática em memória com sucesso. %d ficheiros lidos em %d domínios.", filesProcessed, len(l.contexts))
	return nil
}

// GetContextForDomain retrieves the safely cached knowledge context for the given domain, combined with the general context.
func (l *Loader) GetContextForDomain(domain string) string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	
	generalCtx := l.contexts["general"]
	
	if domain == "general" || domain == "" {
		return generalCtx
	}
	
	domainCtx := l.contexts[domain]
	if domainCtx != "" {
		return generalCtx + "\n" + domainCtx
	}
	
	return generalCtx
}
