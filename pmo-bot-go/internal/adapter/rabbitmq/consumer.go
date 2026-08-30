package rabbitmq

import (
	"context"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

type Consumer struct {
	url      string
	conn     *amqp.Connection
	ch       *amqp.Channel
	handler  func(context.Context, *ports.IncomingMessage, []byte) error
	exchange string
	queue    string
}

func NewConsumer(url, exchange, queue string) *Consumer {
	return &Consumer{
		url:      url,
		exchange: exchange,
		queue:    queue,
	}
}

func (c *Consumer) Connect() error {
// ... unchanged until Consume
	var err error
	for i := 0; i < 5; i++ {
		c.conn, err = amqp.Dial(c.url)
		if err == nil {
			break
		}
		log.Printf("⚠️ [RabbitMQ] Falha ao conectar: %v. Tentando novamente...", err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return fmt.Errorf("failed to connect to rabbitmq: %w", err)
	}

	c.ch, err = c.conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open channel: %w", err)
	}

	err = c.ch.ExchangeDeclare(
		c.exchange,
		"topic", // type
		true,    // durable
		false,   // auto-deleted
		false,   // internal
		false,   // no-wait
		nil,     // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	q, err := c.ch.QueueDeclare(
		c.queue,
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	// Evolution API publishes global events with routing keys like: messages.upsert, messages.update
	// Note: We use # to match everything under messages.upsert.
	err = c.ch.QueueBind(
		q.Name,
		"messages.upsert.#",
		c.exchange,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to bind queue: %w", err)
	}

	return nil
}

func (c *Consumer) Consume(handler func(context.Context, *ports.IncomingMessage, []byte) error) error {
	c.handler = handler

	msgs, err := c.ch.Consume(
		c.queue,
		"pmo-bot-go-consumer",
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,   // args
	)
	if err != nil {
		return fmt.Errorf("failed to register a consumer: %w", err)
	}

	log.Println("✅ [RabbitMQ] Consumidor registrado. Aguardando mensagens...")

	go func() {
		for d := range msgs {
			c.processDelivery(d)
		}
	}()

	return nil
}

func (c *Consumer) processDelivery(d amqp.Delivery) {
	// Payload from Evolution is a JSON matching the webhook format
	payload, err := evolution.ParseWebhook(d.Body)
	if err != nil {
		log.Printf("⚠️ [RabbitMQ] Falha no ParseWebhook: %v", err)
		d.Reject(false) // discard invalid message
		return
	}

	if payload == nil {
		d.Ack(false) // Not an upsert or something we care about
		return
	}

	ctx := context.Background()
	err = c.handler(ctx, payload, d.Body)

	if err != nil {
		// If error, requeue or drop based on error type. For now, drop to avoid loop.
		log.Printf("⚠️ [RabbitMQ] Erro no processamento: %v", err)
		d.Reject(false)
		return
	}

	// Acknowledge after handler puts it into HarnessQueue or processes it.
	d.Ack(false)
}

func (c *Consumer) Close() {
	if c.ch != nil {
		c.ch.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
