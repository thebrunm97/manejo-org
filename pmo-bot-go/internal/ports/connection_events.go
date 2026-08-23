package ports

// ConnectionEventNotifier recebe eventos de CONNECTION do webhook da Evolution
// (Disconnected, ConnectFailure, LoggedOut, Connected, QRCode) — mais rápido
// que esperar o próximo tick de 60s do self-heal (DT-53).
//
// Implementada pelo selfheal.Healer. Vive em `ports`, não em `webhook`, porque
// é o pacote webhook quem depende desta interface (mesma direção de
// dependência de ports.Notifier e ports.MessageSender), nunca o contrário.
type ConnectionEventNotifier interface {
	// NotificarEvento não deve bloquear: quem chama é o handler HTTP do
	// webhook, que precisa devolver 200 rápido (a regra de ouro do handler).
	NotificarEvento(evento string)
}
