//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	client := &http.Client{}
	req, _ := http.NewRequest("GET", url+"/rest/v1/pmos?limit=1", nil)
	req.Header.Add("apikey", key)
	req.Header.Add("Authorization", "Bearer "+key)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	
	var data []map[string]interface{}
	json.Unmarshal(body, &data)
	if len(data) > 0 {
		fmt.Println("PMOS Columns:")
		for k := range data[0] {
			fmt.Println("-", k)
		}
	} else {
		fmt.Println("No PMOs found or error:", string(body))
	}

	req2, _ := http.NewRequest("GET", url+"/rest/v1/propriedades?limit=1", nil)
	req2.Header.Add("apikey", key)
	req2.Header.Add("Authorization", "Bearer "+key)
	resp2, _ := client.Do(req2)
	defer resp2.Body.Close()
	body2, _ := io.ReadAll(resp2.Body)
	
	var data2 []map[string]interface{}
	json.Unmarshal(body2, &data2)
	if len(data2) > 0 {
		fmt.Println("PROPRIEDADES Columns:")
		for k := range data2[0] {
			fmt.Println("-", k)
		}
	} else {
		fmt.Println("No Propriedades found or error:", string(body2))
	}
}
