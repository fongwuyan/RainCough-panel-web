package pluginx

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"
)

const maxFrame = 8 << 20 // 8MB 单帧上限

type rpcFrame struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type conn struct {
	c    net.Conn
	x    *PluginX
	name string

	wmu     sync.Mutex
	mu      sync.Mutex
	pending map[int64]chan *rpcFrame
	seq     int64
	closed  bool
}

func newConn(c net.Conn, x *PluginX, name string) *conn {
	return &conn{c: c, x: x, name: name, pending: map[int64]chan *rpcFrame{}}
}

// ---- 发送 ----

func (c *conn) send(frame *rpcFrame) error {
	data, err := json.Marshal(frame)
	if err != nil {
		return err
	}
	c.wmu.Lock()
	defer c.wmu.Unlock()
	if c.closed {
		return errors.New("连接已关闭")
	}
	_, err = c.c.Write(append(data, '\n'))
	return err
}

// request 主系统 → 插件 的同步请求。
func (c *conn) request(method string, params interface{}, timeout time.Duration) (json.RawMessage, error) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil, errors.New("连接已关闭")
	}
	c.seq++
	id := c.seq
	ch := make(chan *rpcFrame, 1)
	c.pending[id] = ch
	c.mu.Unlock()

	paramsRaw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	if err := c.send(&rpcFrame{JSONRPC: "2.0", ID: json.RawMessage(fmt.Sprint(id)), Method: method, Params: paramsRaw}); err != nil {
		c.removePending(id)
		return nil, err
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	select {
	case fr := <-ch:
		if fr.Error != nil {
			return nil, &RPCError{Code: fr.Error.Code, Message: fr.Error.Message, Data: fr.Error.Data}
		}
		return fr.Result, nil
	case <-time.After(timeout):
		c.removePending(id)
		return nil, &RPCError{Code: -32601, Message: "插件请求超时: " + method}
	}
}

func (c *conn) removePending(id int64) {
	c.mu.Lock()
	delete(c.pending, id)
	c.mu.Unlock()
}

// ---- 响应 ----

func (c *conn) respond(id json.RawMessage, result interface{}, rpcErr *rpcError) {
	fr := &rpcFrame{JSONRPC: "2.0", ID: id}
	if rpcErr != nil {
		fr.Error = rpcErr
	} else {
		b, _ := json.Marshal(result)
		fr.Result = b
	}
	_ = c.send(fr)
}

// ---- 读循环 ----

func (c *conn) readLoop() {
	defer c.close()
	r := bufio.NewReaderSize(c.c, maxFrame)
	for {
		line, err := r.ReadBytes('\n')
		if err != nil {
			if err != io.EOF && !c.closed {
				c.x.onDisconnect(c.name)
			}
			return
		}
		if len(line) > maxFrame {
			continue
		}
		var fr rpcFrame
		if err := json.Unmarshal(line, &fr); err != nil {
			continue
		}
		if fr.Method != "" && len(fr.ID) > 0 && string(fr.ID) != "null" {
			// 插件 → 主系统 请求: 独立 goroutine 处理, 读循环保持畅通
			// (handler 内可能再经接口库调用其他插件并同步等待响应)
			go c.handleRequest(&fr)
			continue
		}
		// 响应
		var id int64
		if json.Unmarshal(fr.ID, &id) == nil {
			c.mu.Lock()
			ch := c.pending[id]
			delete(c.pending, id)
			c.mu.Unlock()
			if ch != nil {
				ch <- &fr
			}
		}
	}
}

// handleRequest 插件 → 主系统 的请求。
func (c *conn) handleRequest(fr *rpcFrame) {
	var result interface{}
	var rpcErr *rpcError
	switch fr.Method {
	case "register":
		result, rpcErr = c.x.handleRegister(c, fr.Params)
	case "heartbeat":
		result, rpcErr = c.x.handleHeartbeat(c, fr.Params)
	case "unregister":
		result, rpcErr = c.x.handleUnregister(c)
	case "call":
		result, rpcErr = c.x.handleCall(c, fr.Params)
	default:
		rpcErr = &rpcError{Code: -32601, Message: "未知方法: " + fr.Method}
	}
	c.respond(fr.ID, result, rpcErr)
}

func (c *conn) close() {
	c.mu.Lock()
	c.closed = true
	c.mu.Unlock()
	_ = c.c.Close()
	// 未决请求置错
	c.mu.Lock()
	for id, ch := range c.pending {
		ch <- &rpcFrame{Error: &rpcError{Code: 4301, Message: "插件连接已断开"}}
		delete(c.pending, id)
		_ = id
	}
	c.mu.Unlock()
}

func (c *conn) isClosed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}

// RPCError 统一 RPC 错误。
type RPCError struct {
	Code    int
	Message string
	Data    interface{}
}

func (e *RPCError) Error() string {
	return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message)
}

// parseParams 解析 params 到目标类型。
func parseParams(raw json.RawMessage, v interface{}) error {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return json.Unmarshal(raw, v)
}
