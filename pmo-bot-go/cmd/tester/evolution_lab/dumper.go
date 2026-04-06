package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		defer r.Body.Close()

		var payload map[string]interface{}
		json.Unmarshal(body, &payload)

		// Detect Source (Now based on fixed instance names)
		source := "UNKNOWN"
		if payload["instance"] == "coliseu-node" {
			source = "NODE (8081)"
		} else if payload["instance"] == "teste-instancia" {
			source = "GO (8082)"
		}

		fmt.Printf("\n[⚖️ JUIZ] Novo Webhook de %s em %s\n", source, r.RemoteAddr)
		prettyJSON, _ := json.MarshalIndent(payload, "", "  ")
		fmt.Printf("%s\n---------------------------\n", string(prettyJSON))

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	fmt.Println("Webhook Dumper (A Cadeira do Árbitro) listening on :3333...")
	if err := http.ListenAndServe(":3333", nil); err != nil {
		log.Fatal(err)
	}
}
