<?php
/**
 * websocket_terminal.php — Baota 风格系统终端后端（PHP 实现）
 *
 * 独立监听 0.0.0.0:23080 的 WebSocket 服务器，每个连接 fork 一个子进程：
 *   - 子进程：FFI openpty() 分配真伪终端，再 fork 出 shell 并 dup2 => exec bash
 *   - 父/桥接进程：在 WS 与 pty master 之间双向直通（纯 UTF-8 直通，不做转义解析）
 *
 * 认证：连接查询串 token=... 必须与令牌文件内容一致（默认 /opt/touchgal/.term_token）
 * 由 touchgal Web 端经 /api/terminal/ws_token 提供。
 *
 * 用法： php8.2 websocket_terminal.php [端口] [令牌文件]
 */
declare(strict_types=1);

error_reporting(E_ERROR | E_PARSE);
set_time_limit(0);

/* ---------- 常量 ---------- */
$PORT      = isset($argv[1]) ? (int)$argv[1] : 23080;
$TOKENFILE = isset($argv[2]) ? $argv[2] : '/opt/touchgal/.term_token';
$HOST      = '0.0.0.0';
$SHELL     = '/bin/bash';
$READ_SIZE = 8192;
$MAX_ROWS  = 200;
$MAX_COLS  = 500;
$PING_INT  = 30;            // 空闲 ping 秒数

/* ---------- FFI 绑定 (libc) ---------- */
$ffi = FFI::cdef(
    "int openpty(int *amaster, int *aslave, char *name, void *termp, void *winp);" .
    "int ioctl(int fd, unsigned long request, ...);" .
    "int dup2(int oldfd, int newfd);" .
    "int close(int fd);",
    "libc.so.6"
);
define('TIOCSWINSZ', 0x5414);

function ffi_log(string $m): void {
    fwrite(STDERR, "[" . date('H:i:s') . "] $m\n");
}

/* ---------- 令牌 ---------- */
function load_token(string $file): string {
    $t = @file_get_contents($file);
    if ($t === false || trim($t) === '') return '';
    return rtrim($t);
}

function token_ok(string $file, string $got): bool {
    $exp = load_token($file);
    if ($exp === '') return false;
    return hash_equals($exp, $got);
}

/* ---------- WebSocket 编解码 ---------- */

function ws_encode(string $payload, int $opcode = 0x1): string {
    $len = strlen($payload);
    $first = chr(0x80 | $opcode);
    if ($len <= 125) {
        $head = $first . chr($len);
    } elseif ($len <= 65535) {
        $head = $first . chr(126) . pack('n', $len);
    } else {
        $head = $first . chr(127) . pack('J', $len);
    }
    return $head . $payload;
}

/**
 * 增量解析 WS 帧。返回 [消息数组] 或在帧不完整时返回 null。
 */
class WsBuffer {
    public $buf = '';
    public $frag_type = 0x1;
    public $frag_data = '';

    function feed(string $data): array {
        $this->buf .= $data;
        $out = [];
        while (true) {
            $r = $this->parseOne();
            if ($r === null) break;        // 不完整
            if ($r === false) return [];   // 协议错误，断开
            $this->buf = substr($this->buf, $this->consumed);
            $this->consumed = 0;
            if ($r === true) continue;     // 控制帧已处理(如 ping/pong) 直接继续
            $out[] = $r;                   // r = opcode or [opcode,data]
        }
        return $out;
    }
    public $consumed = 0;

    private function parseOne() {
        $b = $this->buf;
        $n = strlen($b);
        if ($n < 2) return null;
        $b0 = ord($b[0]); $b1 = ord($b[1]);
        $fin = ($b0 & 0x80) !== 0;
        $opcode = $b0 & 0x0f;
        $masked = ($b1 & 0x80) !== 0;
        $len = $b1 & 0x7f;
        $off = 2;
        if ($len === 126) {
            if ($n < 4) return null;
            $len = unpack('n', substr($b, 2, 2))[1];
            $off = 4;
        } elseif ($len === 127) {
            if ($n < 10) return null;
            $len = unpack('J', substr($b, 2, 8))[1];
            $off = 10;
        }
        $maskKey = '';
        if ($masked) {
            if ($n < $off + 4) return null;
            $maskKey = substr($b, $off, 4);
            $off += 4;
        }
        if ($n < $off + $len) return null;

        $payload = substr($b, $off, $len);
        if ($masked) {
            $unmasked = '';
            for ($i = 0; $i < $len; $i++) {
                $unmasked .= $payload[$i] ^ $maskKey[$i % 4];
            }
            $payload = $unmasked;
        }
        $this->consumed = $off + $len;

        // 帧类型
        if ($opcode === 0x8) {        // close
            ffi_log("recv close");
            return false;
        }
        if ($opcode === 0x9) {        // ping -> 回 pong
            return true;              // (pong 由调用方发送)
        }
        if ($opcode === 0xA) {        // pong
            return true;
        }
        if ($opcode === 0x1 || $opcode === 0x2) {   // text / binary
            if ($fin) {
                return [$opcode, $payload];
            } else {
                $this->frag_type = $opcode;
                $this->frag_data = $payload;
                return true;
            }
        }
        if ($opcode === 0x0) {        // continuation
            $this->frag_data .= $payload;
            if ($fin) {
                $d = $this->frag_data;
                $t = $this->frag_type;
                $this->frag_data = ''; $this->frag_type = 0x1;
                return [$t, $d];
            }
            return true;
        }
        return true;
    }
}

/* ---------- PTY 建立 + shell ---------- */

function make_pty(&$master, &$slave): bool {
    global $ffi;
    $m = FFI::new("int");
    $s = FFI::new("int");
    $r = $ffi->openpty(FFI::addr($m), FFI::addr($s), null, null, null);
    if ($r !== 0) return false;
    $master = $m->cdata;
    $slave  = $s->cdata;
    return true;
}

function pty_resize(int $fd, int $rows, int $cols): void {
    global $ffi;
    $ws = FFI::new("struct { unsigned short ws_row; unsigned short ws_col; unsigned short ws_xpixel; unsigned short ws_ypixel; }");
    $ws->ws_row = (int)$rows;
    $ws->ws_col = (int)$cols;
    $ws->ws_xpixel = 0; $ws->ws_ypixel = 0;
    $ffi->ioctl($fd, TIOCSWINSZ, FFI::addr($ws));
}

/**
 * 阻塞读取首个 WS 文本帧，解析 JSON 控制消息（init/resize）。
 * 会话目标(local/ssh)与凭据由浏览器在 init 帧中下发。超时默认本地。
 */
function read_initial_frame($conn): array {
    stream_set_blocking($conn, true);
    $wb      = new WsBuffer();
    $deadline = microtime(true) + 5;
    $meta    = [];
    while (microtime(true) < $deadline) {
        $chunk = @fread($conn, 8192);
        if ($chunk === false || $chunk === '') break;
        $msgs = $wb->feed($chunk);
        foreach ($msgs as $m) {
            if ($m === false) return $meta;     // 协议错误
            if ($m === true) continue;
            list($op, $payload) = $m;
            if ($op === 0xA) continue;          // pong
            if ($payload !== '' && $payload[0] === '{') {
                $j = @json_decode($payload, true);
                if (is_array($j)) {
                    $type = $j['type'] ?? '';
                    if ($type === 'init') return $j;
                    if ($type === 'resize') { $meta['rows'] = $j['rows'] ?? $meta['rows']; $meta['cols'] = $j['cols'] ?? $meta['cols']; }
                }
            }
        }
        usleep(20000);
    }
    return $meta;
}

/**
 * 处理单个连接（在 fork 出的子进程中运行，永不返回）。
 */
function handle_conn($conn, string $tokenfile, int $initRows, int $initCols): void {
    global $ffi;

    // 1) 建立 PTY
    $master = 0; $slave = 0;
    if (!make_pty($master, $slave)) {
        fwrite($conn, ws_encode("会话启动失败", 0x1));
        @fclose($conn);
        ffi_log("openpty failed");
        exit(1);
    }

    // 2) 读取首帧 init 决定目标（local/ssh）
    $init  = read_initial_frame($conn);
    $rows  = isset($init['rows']) ? (int)$init['rows'] : $initRows;
    $cols  = isset($init['cols']) ? (int)$init['cols'] : $initCols;
    $rows  = max(2, min($GLOBALS['MAX_ROWS'], $rows));
    $cols  = max(2, min($GLOBALS['MAX_COLS'], $cols));
    $target = (string)($init['target'] ?? 'local');

    // SSH 凭据/参数（在父进程中准备，交给 exec 的子进程使用）
    $GLOBALS['__SSH_DEST'] = null;
    $GLOBALS['__SSH_KEYS'] = [];
    $GLOBALS['__SSHPASS']  = '';
    $GLOBALS['__SSH_USE_CMD'] = false;
    $GLOBALS['__KEYFILE']  = null;
    $GLOBALS['__SSH_PKEY'] = false;

    if ($target === 'ssh') {
        $host  = (string)($init['host'] ?? '');
        $user  = (string)($init['username'] ?? '');
        $pw    = (string)($init['password'] ?? '');
        $pkey  = (string)($init['pkey'] ?? '');
        $pph   = (string)($init['passphrase'] ?? '');
        $port  = trim((string)($init['port'] ?? '22'));
        $dest  = ($user !== '' ? $user . '@' : '') . trim($host);
        if ($dest === '' || $dest === '@') { $dest = null; }
        $GLOBALS['__SSH_DEST'] = $dest;
        if ($dest !== null) {
            $keys = ['-o','StrictHostKeyChecking=no','-o','UserKnownHostsFile=/dev/null','-o','LogLevel=ERROR','-o','ServerAliveInterval=15'];
            if (preg_match('/^\d+$/', $port) && (int)$port !== 22) { $keys[] = '-p'; $keys[] = $port; }
            if ($pkey !== '') {
                $kf = tempnam(sys_get_temp_dir(), 'btsk');
                if ($kf !== false) { @file_put_contents($kf, $pkey); @chmod($kf, 0600); }
                $GLOBALS['__KEYFILE'] = $kf !== false ? $kf : null;
                if ($GLOBALS['__KEYFILE']) { $keys[] = '-i'; $keys[] = $GLOBALS['__KEYFILE']; }
                $GLOBALS['__SSHPASS'] = $pph;
                $GLOBALS['__SSH_USE_CMD'] = $pph !== '';   // 有口令才需要 sshpass 注入
                $GLOBALS['__SSH_PKEY'] = true;
            } else {
                $GLOBALS['__SSHPASS'] = $pw;
                $GLOBALS['__SSH_USE_CMD'] = true;          // 密码认证必需 sshpass
            }
            $GLOBALS['__SSH_KEYS'] = $keys;
        }
    }
    pty_resize($master, $rows, $cols);

    // 3) fork 出 shell/ssh 子进程
    $pid = pcntl_fork();
    if ($pid === 0) {
        // ---- shell/ssh 子进程 ----
        if (function_exists('posix_setsid')) posix_setsid();
        $ffi->dup2($slave, 0);
        $ffi->dup2($slave, 1);
        $ffi->dup2($slave, 2);
        $ffi->close($slave);
        $ffi->close($master);
        $env = $_ENV;
        $env['TERM'] = 'xterm-256color';
        $env['COLUMNS'] = (string)$cols;
        $env['LINES']   = (string)$rows;
        $env['HOME'] = getenv('HOME') ?: '/root';
        if ($GLOBALS['__SSH_DEST'] !== null && $GLOBALS['__SSH_DEST'] !== '@') {
            $env['SSHPASS'] = $GLOBALS['__SSHPASS'];
            $loc = $GLOBALS['__SSH_USE_CMD'] ? '/usr/bin/sshpass' : '/usr/bin/ssh';
            $argv0 = [];
            if ($GLOBALS['__SSH_USE_CMD']) {
                $argv0[] = '-e';
                if ($GLOBALS['__SSH_PKEY']) { $argv0[] = '-P'; $argv0[] = 'passphrase'; }
                $argv0[] = 'ssh';
            }
            $argv0[] = '-tt';
            foreach ($GLOBALS['__SSH_KEYS'] as $k) $argv0[] = $k;
            $argv0[] = $GLOBALS['__SSH_DEST'];
            pcntl_exec($loc, $argv0, $env);
        } else {
            pcntl_exec($GLOBALS['SHELL'] ?: '/bin/bash', [], $env);
        }
        exit(127);
    }
    if ($pid < 0) {
        fwrite($conn, ws_encode("fork失败", 0x1));
        @fclose($conn);
        exit(1);
    }

    // 3) 桥接进程：关闭 slave 的自身引用，但保留 slave fd 数字供 resize 用
    //    我们以 master 的 curl/fs stream 读写。
    $ps = fopen('php://fd/' . $master, 'r+');
    if (!$ps) {
        fwrite($conn, ws_encode("pty stream 失败", 0x1));
        @fclose($conn);
        exit(1);
    }
    stream_set_blocking($ps, false);
    stream_set_blocking($conn, false);

    $wb = new WsBuffer();
    $pongBuffered = 0;
    $lastSend = time();

    // UTF-8 增量解码
    $decoder = new class {
        private $buf = '';
        function put(string $d): string {
            $this->buf .= $d;
            $out = '';
            // 解码，保留不完整尾部
            $len = strlen($this->buf);
            $valid = 0;
            for ($i = 0; $i < $len; $i++) {
                $o = ord($this->buf[$i]);
                if ($o >= 0x00 && $o < 0x80) { $valid = $i + 1; continue; }
                if (($o & 0xE0) === 0xC0) { if ($len - $i >= 2) { $valid = $i + 2; $i++; } else break; }
                elseif (($o & 0xF0) === 0xE0) { if ($len - $i >= 3) { $valid = $i + 3; $i += 2; } else break; }
                elseif (($o & 0xF8) === 0xF0) { if ($len - $i >= 4) { $valid = $i + 4; $i += 3; } else break; }
                else { $valid = $i + 1; }   // 无效字节，单字节丢弃
            }
            if ($valid > 0) {
                $out = substr($this->buf, 0, $valid);
                $this->buf = substr($this->buf, $valid);
            }
            return $out;
        }
    };

    $status_sent = false;

    // 4) 主循环：select 监听 WS 输入 + pty 输出 + shell 退出信号
    $running = true;
    $shell_alive = true;
    $exitcode = null;

    while ($running) {
        $read = [];
        if (is_resource($conn)) $read[] = $conn;
        if (is_resource($ps))   $read[] = $ps;
        if (!$read) break;

        $w = null; $e = null;
        $n = @stream_select($read, $w, $e, 5);
        if ($n === false) {
            if (!is_resource($conn) && !is_resource($ps)) break;
            // 信号中断或超时
        }

        // ---- pty 输出 -> WS ----
        if (is_resource($ps) && $read && array_search($ps, $read, true) !== false) {
            $data = @fread($ps, 8192);
            if ($data === false || $data === '') {
                // EOF
                $running = false;
            } elseif ($data !== '') {
                $text = $decoder->put($data);
                if ($text !== '') {
                    $frame = ws_encode($text, 0x1);
                    if (is_resource($conn)) @fwrite($conn, $frame);
                    $lastSend = time();
                }
            }
        }

        // ---- WS 输入 -> pty ----
        if (is_resource($conn) && $read && array_search($conn, $read, true) !== false) {
            $data = @fread($conn, 8192);
            if ($data === false || $data === '') {
                $running = false;
            } elseif ($data !== '') {
                $msgs = $wb->feed($data);
                if (is_array($msgs) && $msgs === [] && $wb->consumed === 0 && strpos($data, "\xff") !== false) {
                    // 兼容性：直接文本行（旧注入）忽略
                }
                foreach ($msgs as $m) {
                    if ($m === false) { $running = false; break; }
                    if ($m === true) continue;
                    list($op, $payload) = $m;
                    if ($op === 0xA) continue; // pong
                    // JSON 控制消息 {type:'input'|'resize'|'ping'}
                    if ($payload !== '' && $payload[0] === '{') {
                        $j = @json_decode($payload, true);
                        if (is_array($j)) {
                            $t = $j['type'] ?? '';
                            if ($t === 'resize') {
                                $r = (int)($j['rows'] ?? $initRows);
                                $c = (int)($j['cols'] ?? $initCols);
                                $r = max(2, min($GLOBALS['MAX_ROWS'], $r));
                                $c = max(2, min($GLOBALS['MAX_COLS'], $c));
                                pty_resize($master, $r, $c);
                                continue;
                            }
                            if ($t === 'ping') {
                                continue;
                            }
                            if ($t === 'input' || $t === '') {
                                if (isset($j['data'])) {
                                    $dataIn = (string)$j['data'];
                                    if ($dataIn !== '') @fwrite($ps, $dataIn);
                                }
                                continue;
                            }
                        }
                    }
                    // 否则当作原始输入（直接透传）
                    if ($payload !== '') @fwrite($ps, $payload);
                }
            }
        }

        // shell 是否存活
        if ($shell_alive) {
            $status = pcntl_waitpid($pid, $wstatus, WNOHANG);
            if ($status === $pid) {
                $shell_alive = false;
                $exitcode = pcntl_wexitstatus($wstatus);
                if ($exitcode === null || $exitcode === false) $exitcode = 0;
            }
        }

        // shell 结束 → 发退出事件并关闭
        if (!$shell_alive && !$status_sent) {
            $status_sent = true;
            if (is_resource($conn)) {
                @fwrite($conn, ws_encode(json_encode(['type' => 'exit', 'code' => $exitcode]), 0x1));
            }
            $running = false;
        }

        // 心跳 ping
        if (is_resource($conn) && (time() - $lastSend) >= $GLOBALS['PING_INT']) {
            @fwrite($conn, ws_encode('', 0x9));
            $lastSend = time();
        }
    }

    // 清理
    if ($GLOBALS['__KEYFILE']) { @unlink($GLOBALS['__KEYFILE']); $GLOBALS['__KEYFILE'] = null; }
    if (is_resource($ps)) { @fclose($ps); }
    if (is_resource($conn)) {
        try { @fwrite($conn, ws_encode('', 0x8)); } catch (Throwable $e) {}
        @fclose($conn);
    }
    $ffi->close($master);
    if ($pid > 0) {
        @posix_kill($pid, 9);
        @pcntl_waitpid($pid, $st, WNOHANG);
    }
    exit(0);
}

/* ---------- HTTP 握手 ---------- */

function ws_handshake($conn, string $tokenfile, array &$rows_cols): bool {
    // 读请求头（阻塞读，最多 8KB / 5s）
    stream_set_blocking($conn, true);
    $req = '';
    $deadline = microtime(true) + 5;
    while (strpos($req, "\r\n\r\n") === false && strlen($req) < 16384 && microtime(true) < $deadline) {
        $chunk = @fread($conn, 1024);
        if ($chunk === false || $chunk === '') break;
        $req .= $chunk;
    }
    if (!preg_match('#^GET\s+(\S+)\s+HTTP/1\.1#i', $req, $m)) {
        return false;
    }
    $uri = $m[1];

    $headers = [];
    foreach (explode("\r\n", $req) as $line) {
        if (strpos($line, ':') !== false) {
            list($k, $v) = explode(':', $line, 2);
            $headers[strtolower(trim($k))] = trim($v);
        }
    }
    // Sec-WebSocket-Key
    $key = $headers['sec-websocket-key'] ?? '';
    if ($key === '') return false;

    // token 校验（查询串）
    $q = parse_url($uri, PHP_URL_QUERY) ?? '';
    $got = '';
    parse_str($q, $params);
    $got = $params['token'] ?? '';
    if (!token_ok($tokenfile, $got)) {
        fwrite($conn, "HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\ninvalid token\r\n");
        return false;
    }

    // 初始尺寸（可选从查询串）
    $rows_cols[0] = isset($params['rows']) ? max(2, min($GLOBALS['MAX_ROWS'], (int)$params['rows'])) : 24;
    $rows_cols[1] = isset($params['cols']) ? max(2, min($GLOBALS['MAX_COLS'], (int)$params['cols'])) : 80;

    $accept = base64_encode(sha1($key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));
    $resp = "HTTP/1.1 101 Switching Protocols\r\n"
          . "Upgrade: websocket\r\n"
          . "Connection: Upgrade\r\n"
          . "Sec-WebSocket-Accept: $accept\r\n"
          . "\r\n";
    fwrite($conn, $resp);
    fflush($conn);
    stream_set_blocking($conn, false);
    return true;
}

/* ---------- 主服务器 ---------- */

$srv = @stream_socket_server("tcp://$HOST:$PORT", $errno, $errstr,
    STREAM_SERVER_BIND | STREAM_SERVER_LISTEN);
if (!$srv) {
    ffi_log("无法监听 $HOST:$PORT : $errstr");
    exit(1);
}
ffi_log("终端 WS 服务器已启动 ws://$HOST:$PORT  (token 文件=$TOKENFILE)");

if (function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    pcntl_signal(SIGCHLD, SIG_IGN);
}

while (true) {
    $conn = @stream_socket_accept($srv, -1);
    if (!$conn) { usleep(50000); continue; }

    $rc = [24, 80];
    if (!ws_handshake($conn, $TOKENFILE, $rc)) {
        @fclose($conn);
        continue;
    }
    [$rows, $cols] = $rc;

    $pid = pcntl_fork();
    if ($pid === 0) {
        fclose($srv);
        handle_conn($conn, $TOKENFILE, $rows, $cols);   // 不返回
        exit(0);
    } elseif ($pid > 0) {
        fclose($conn);
        pcntl_waitpid($pid, $st, WNOHANG);
    } else {
        @fclose($conn);
        usleep(50000);
    }
}