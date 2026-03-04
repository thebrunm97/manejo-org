package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load(".env")
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	tables := []string{"logs_processamento", "logs_treinamento", "logs_consumo"}
	for _, t := range tables {
		req, _ := http.NewRequest("GET", url+"/rest/v1/"+t+"?select=*&order=created_at.desc&limit=2", nil)
		req.Header.Set("apikey", key)
		req.Header.Set("Authorization", "Bearer "+key)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		defer resp.Body.Close()

		body, _ := ioutil.ReadAll(resp.Body)
		fmt.Printf("TABLE: %s\n%s\n\n", t, string(body))
	}
}
