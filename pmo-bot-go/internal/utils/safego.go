package utils

import "log/slog"

// SafeGo executa fn em uma goroutine com recover, para que um pânico numa
// tarefa de fundo (sem gin.Recovery() acima, nem qualquer supervisor) não
// derrube o processo inteiro. Mesmo padrão já usado em
// internal/notify/disparo.go, extraído aqui para reuso (DT-121).
//
// label identifica a origem do pânico nos logs — sem ele, um recover
// silencioso vira um bug impossível de rastrear depois.
func SafeGo(label string, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("pânico em goroutine de fundo recuperado",
					slog.String("origem", label),
					slog.Any("panico", r),
				)
			}
		}()
		fn()
	}()
}
