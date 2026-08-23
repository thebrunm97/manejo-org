// Copyright (c) 2021 Tulir Asokan
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package whatsmeow

import (
	"context"
	"fmt"
	"math/rand/v2"
	"os"
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

var (
	// KeepAliveResponseDeadline specifies the duration to wait for a response to websocket keepalive pings.
	KeepAliveResponseDeadline = 10 * time.Second
	// KeepAliveIntervalMin specifies the minimum interval for websocket keepalive pings.
	KeepAliveIntervalMin = 20 * time.Second
	// KeepAliveIntervalMax specifies the maximum interval for websocket keepalive pings.
	KeepAliveIntervalMax = 30 * time.Second

	// KeepAliveMaxFailTime specifies the maximum time to wait before forcing a reconnect if keepalives fail repeatedly.
	KeepAliveMaxFailTime = 3 * time.Minute
)

func (cli *Client) keepAliveLoop(ctx, connCtx context.Context) {
	lastSuccess := time.Now()
	var errorCount int
	for {
		interval := rand.Int64N(KeepAliveIntervalMax.Milliseconds()-KeepAliveIntervalMin.Milliseconds()) + KeepAliveIntervalMin.Milliseconds()
		select {
		case <-time.After(time.Duration(interval) * time.Millisecond):
			isSuccess, shouldContinue := cli.sendKeepAlive(connCtx)
			if !shouldContinue {
				return
			} else if !isSuccess {
				errorCount++
				go cli.dispatchEvent(&events.KeepAliveTimeout{
					ErrorCount:  errorCount,
					LastSuccess: lastSuccess,
				})
				if cli.EnableAutoReconnect && time.Since(lastSuccess) > KeepAliveMaxFailTime {
					cli.Log.Debugf("Forcing reconnect due to keepalive failure")
					cli.Disconnect()
					cli.resetExpectedDisconnect()
					go cli.autoReconnect(ctx)
				}
			} else {
				if errorCount > 0 {
					errorCount = 0
					go cli.dispatchEvent(&events.KeepAliveRestored{})
				}
				lastSuccess = time.Now()
			}
		case <-connCtx.Done():
			return
		}
	}
}

func (cli *Client) sendKeepAlive(ctx context.Context) (isSuccess, shouldContinue bool) {
	respCh, err := cli.sendIQAsync(ctx, infoQuery{
		Namespace: "w:p",
		Type:      "get",
		To:        types.ServerJID,
	})
	if ctx.Err() != nil {
		return false, false
	} else if err != nil {
		cli.Log.Warnf("Failed to send keepalive: %v", err)
		return false, true
	}
	select {
	case node := <-respCh:
		if node != nil && node.Tag == "iq" && node.Attrs != nil && node.Attrs["type"] == "error" {
			errNode, _ := node.GetOptionalChildByTag("error")
			if errNode.AttrGetter().OptionalString("code") == "401" {
				// 401 implies the connection auth token/signature failed.
				cli.Log.Errorf("CRITICAL: Heartbeat failed with 401 Unauthorized")
				
				// Write to logs
				f, err := os.OpenFile("pmo-bot-go/logs/auth_errors.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
				if err != nil {
					f, err = os.OpenFile("../pmo-bot-go/logs/auth_errors.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
				}
				if err == nil {
					reqID := node.Attrs["id"]
					f.WriteString(fmt.Sprintf("[%s] 401 Auth Error: RequestID=%v, Tag=%s\n", time.Now().Format(time.RFC3339), reqID, node.Tag))
					f.Close()
				}
				
				// "limpar o estado de autorização atual e disparar uma tentativa de re-autenticação imediata"
				if cli.RefreshCAT != nil {
					go func() {
						err := cli.RefreshCAT(context.Background())
						if err != nil {
							cli.Log.Errorf("Failed to refresh CAT on heartbeat 401: %v", err)
						}
					}()
				}
				cli.Disconnect()
				go cli.Connect()
				return false, false
			}
		}
		// All good
		return true, true
	case <-time.After(KeepAliveResponseDeadline):
		cli.Log.Warnf("Keepalive timed out")
		return false, true
	case <-ctx.Done():
		return false, false
	}
}
