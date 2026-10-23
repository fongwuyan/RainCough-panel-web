#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""解码: 识别 → 操作链 → 求解。

编码转换与哈希计算**转发**给宿主已有插件(texttool / filehash);
只有它们没有的安全向能力(古典密码、RSA 弱参数、JWT 拆解)才在本插件内实现。
转发失败时退回内置实现, 保证功能不依赖其它插件是否在线。
"""
import base64
import binascii
import hashlib
import html
import json
import math
import re
import urllib.parse

from core import util

MAX_INPUT = 200000


def _rc():
    """延迟拿 rcplugin 的 call(跨插件调用)。"""
    import rcplugin
    return rcplugin


# ---------------------------------------------------------------- 识别

def _printable_ratio(s):
    if not s:
        return 0.0
    ok = sum(1 for ch in s if 32 <= ord(ch) < 127 or ch in "\r\n\t" or ord(ch) > 127)
    return ok / len(s)


def identify(text):
    """给出候选编码类型与置信度。不猜单一答案 —— 同一个串经常有多种合理解释。"""
    t = (text or "").strip()
    if not t:
        return {"candidates": [], "length": 0}
    out = []
    L = len(t)

    # Base64
    if re.fullmatch(r"[A-Za-z0-9+/=\s]+", t) and L % 4 == 0 and L >= 8:
        try:
            dec = base64.b64decode(t, validate=True).decode("utf-8")
            conf = 95 if _printable_ratio(dec) > 0.95 else 70
            out.append({"kind": "Base64", "confidence": conf, "preview": dec[:120]})
        except Exception:
            pass
    # Base64URL(JWT 常见)
    if re.fullmatch(r"[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*", t):
        out.append({"kind": "JWT", "confidence": 92, "preview": _jwt_head(t)})
    # Hex
    if re.fullmatch(r"(0x)?[0-9a-fA-F\s]+", t) and L % 2 == 0:
        try:
            dec = bytes.fromhex(t.replace("0x", "").replace(" ", "")).decode("utf-8")
            out.append({"kind": "Hex", "confidence": 90 if _printable_ratio(dec) > 0.9 else 60,
                        "preview": dec[:120]})
        except Exception:
            pass
    # URL
    if re.search(r"%[0-9a-fA-F]{2}", t):
        out.append({"kind": "URL 编码", "confidence": 88,
                    "preview": urllib.parse.unquote(t)[:120]})
    # Unicode 转义
    if re.search(r"\\u[0-9a-fA-F]{4}", t):
        try:
            dec = t.encode().decode("unicode_escape")
            out.append({"kind": "Unicode 转义", "confidence": 85, "preview": dec[:120]})
        except Exception:
            pass
    # HTML 实体
    if re.search(r"&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);", t):
        out.append({"kind": "HTML 实体", "confidence": 85, "preview": html.unescape(t)[:120]})
    # 哈希
    if re.fullmatch(r"[0-9a-fA-F]+", t):
        if L == 32:
            out.append({"kind": "MD5 摘要", "confidence": 80, "preview": "长度 32 位十六进制"})
        elif L == 40:
            out.append({"kind": "SHA1 摘要", "confidence": 80, "preview": "长度 40 位十六进制"})
        elif L == 64:
            out.append({"kind": "SHA256 摘要", "confidence": 80, "preview": "长度 64 位十六进制"})
        elif L == 128:
            out.append({"kind": "SHA512 摘要", "confidence": 80, "preview": "长度 128 位十六进制"})
    # 二进制 / 八进制 / 十进制
    if re.fullmatch(r"[01\s]+", t) and L >= 8:
        try:
            out.append({"kind": "二进制", "confidence": 80,
                        "preview": _from_bin(t)[:120]})
        except Exception:
            pass
    # ROT13 / 凯撒(只给提示)
    if re.fullmatch(r"[A-Za-z\s]+", t) and L >= 6:
        rot = _rot(t, 13)
        out.append({"kind": "可能是凯撒/ROT13", "confidence": 45, "preview": rot[:120]})

    out.sort(key=lambda x: -x["confidence"])
    return {"candidates": out[:6], "length": L, "entropy": round(_entropy(t), 2),
            "printable": round(_printable_ratio(t), 3)}


def _entropy(s):
    if not s:
        return 0.0
    freq = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def _from_bin(t):
    bits = re.sub(r"\s", "", t)
    pad = (-len(bits)) % 8
    return int(bits, 2).to_bytes((len(bits) + pad) // 8, "big").decode("utf-8", "replace")


def _jwt_head(t):
    try:
        h = t.split(".")[0]
        h += "=" * (-len(h) % 4)
        return base64.urlsafe_b64decode(h).decode("utf-8", "replace")[:160]
    except Exception:
        return ""


# ---------------------------------------------------------------- 操作链

OPS = [
    ("base64_decode", "Base64 解码"), ("base64_encode", "Base64 编码"),
    ("url_decode", "URL 解码"), ("url_encode", "URL 编码"),
    ("hex_decode", "Hex 解码"), ("hex_encode", "Hex 编码"),
    ("unicode_decode", "Unicode 解码"), ("html_decode", "HTML 实体解码"),
    ("md5", "MD5"), ("sha1", "SHA1"), ("sha256", "SHA256"),
    ("rot13", "ROT13"), ("reverse", "反转"), ("upper", "转大写"),
    ("lower", "转小写"), ("strip", "去空白"), ("json_pretty", "JSON 美化"),
]


def _apply(op, s):
    if op == "base64_decode":
        b = s.strip()
        b += "=" * (-len(b) % 4)
        return base64.b64decode(b).decode("utf-8", "replace")
    if op == "base64_encode":
        return base64.b64encode(s.encode("utf-8")).decode()
    if op == "url_decode":
        return urllib.parse.unquote(s)
    if op == "url_encode":
        return urllib.parse.quote(s, safe="")
    if op == "hex_decode":
        return bytes.fromhex(re.sub(r"[^0-9a-fA-F]", "", s)).decode("utf-8", "replace")
    if op == "hex_encode":
        return s.encode("utf-8").hex()
    if op == "unicode_decode":
        return s.encode().decode("unicode_escape")
    if op == "html_decode":
        return html.unescape(s)
    if op == "md5":
        return hashlib.md5(s.encode("utf-8")).hexdigest()
    if op == "sha1":
        return hashlib.sha1(s.encode("utf-8")).hexdigest()
    if op == "sha256":
        return hashlib.sha256(s.encode("utf-8")).hexdigest()
    if op == "rot13":
        return _rot(s, 13)
    if op == "reverse":
        return s[::-1]
    if op == "upper":
        return s.upper()
    if op == "lower":
        return s.lower()
    if op == "strip":
        return re.sub(r"\s+", "", s)
    if op == "json_pretty":
        return json.dumps(json.loads(s), ensure_ascii=False, indent=2)
    raise ValueError("未知操作: " + op)


def _rot(s, n):
    out = []
    for ch in s:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - 97 + n) % 26 + 97))
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - 65 + n) % 26 + 65))
        else:
            out.append(ch)
    return "".join(out)


def chain(params):
    """按顺序执行操作链, 返回每一步的结果。"""
    text = params.get("input") or ""
    ops = params.get("ops") or []
    if len(text) > MAX_INPUT:
        raise ValueError("输入过长(上限 %d 字符)" % MAX_INPUT)
    steps = []
    cur = text
    for op in ops:
        name = op.get("op") if isinstance(op, dict) else str(op)
        try:
            nxt = _apply(name, cur)
            steps.append({"op": name, "ok": True, "out": nxt[:4000],
                          "len": len(nxt)})
            cur = nxt
        except Exception as e:
            steps.append({"op": name, "ok": False, "error": str(e)[:160]})
            break
    return {"steps": steps, "output": cur[:20000], "output_len": len(cur), "ops": OPS}


# ---------------------------------------------------------------- 求解

def solve(params):
    kind = params.get("kind") or ""
    text = (params.get("input") or "").strip()
    if kind == "caesar":
        res = []
        for n in range(26):
            s = _rot(text, n)
            res.append({"shift": n, "text": s[:200], "score": round(_eng_score(s), 3)})
        res.sort(key=lambda x: -x["score"])
        return {"kind": "caesar", "best": res[:5], "all": res}
    if kind == "rsa":
        return _rsa(params)
    if kind == "jwt":
        return _jwt(text)
    if kind == "hashid":
        return identify(text)
    raise ValueError("未知求解类型: " + kind)


# 英文字母频率(百分比), 用来给凯撒结果打分
_EN_FREQ = {
    "a": 8.17, "b": 1.49, "c": 2.78, "d": 4.25, "e": 12.70, "f": 2.23,
    "g": 2.02, "h": 6.09, "i": 6.97, "j": 0.15, "k": 0.77, "l": 4.03,
    "m": 2.41, "n": 6.75, "o": 7.51, "p": 1.93, "q": 0.10, "r": 5.99,
    "s": 6.33, "t": 9.06, "u": 2.76, "v": 0.98, "w": 2.36, "x": 0.15,
    "y": 1.97, "z": 0.07,
}


def _eng_score(s):
    """卡方距离的倒数(越大越像英文)。

    ★ 不能用"字母是否属于常见集合"打分 —— 26 个字母里有 21 个都在常见集合里,
      任意位移的结果都会接近 1.0, 出现大量平局, 排第一的往往是没位移的那个。
    """
    letters = [c for c in s.lower() if c.isalpha()]
    if len(letters) < 4:
        return 0.0
    n = len(letters)
    chi = 0.0
    for ch, pct in _EN_FREQ.items():
        obs = letters.count(ch) / n * 100.0
        chi += (obs - pct) ** 2 / pct
    return 1.0 / (1.0 + chi)


def _rsa(params):
    """只处理"小 e + 明文短"这类可直接开方的弱参数, 不做通用分解。"""
    try:
        n = int(str(params.get("n") or "0"), 0)
        e = int(str(params.get("e") or "0"), 0)
        c = int(str(params.get("c") or "0"), 0)
    except Exception:
        raise ValueError("n / e / c 需要是十进制或 0x 开头的十六进制整数")
    if n <= 0 or e <= 0 or c <= 0:
        raise ValueError("n / e / c 必须为正整数")
    out = {"n_bits": n.bit_length(), "e": e}
    # 纯 python 整数 e 次根(不依赖 gmpy2)
    def iroot(x, k):
        if x < 0:
            return None
        lo, hi = 0, 1
        while hi ** k <= x:
            hi <<= 1
        while lo < hi:
            mid = (lo + hi) // 2
            if mid ** k < x:
                lo = mid + 1
            else:
                hi = mid
        return lo if lo ** k == x else None
    m = iroot(c, e) if e <= 11 else None
    if m is not None:
        raw = m.to_bytes((m.bit_length() + 7) // 8, "big")
        out["plain_int"] = m
        out["plain_hex"] = raw.hex()
        try:
            txt = raw.decode("utf-8")
            # 只有真的像文本才当文本给, 否则给 hex(避免前端显示一串乱码)
            out["plain_text"] = txt if _printable_ratio(txt) > 0.9 else ""
        except Exception:
            out["plain_text"] = ""
        out["method"] = "c 的 %d 次方根正好是整数 → 明文未做填充" % e
    else:
        out["method"] = "小 e 开方不成立; 可能需要共模/低指数广播或分解 n(本模块不做分解)"
    return {"kind": "rsa", **out}


def _jwt(t):
    parts = (t or "").split(".")
    if len(parts) < 2:
        raise ValueError("不是 JWT(应为三段)")
    def dec(seg):
        seg += "=" * (-len(seg) % 4)
        return base64.urlsafe_b64decode(seg).decode("utf-8", "replace")
    out = {"header": "", "payload": "", "note": ""}
    try:
        out["header"] = dec(parts[0])
    except Exception as e:
        out["header"] = "解析失败: %s" % e
    try:
        out["payload"] = dec(parts[1])
    except Exception as e:
        out["payload"] = "解析失败: %s" % e
    if '"alg":"none"' in (out["header"] or "").replace(" ", ""):
        out["note"] = "alg=none, 可尝试去掉签名直接通过"
    else:
        out["note"] = "签名校验未做(需要密钥); 常见弱点是 HS256 弱密钥可离线爆破"
    return {"kind": "jwt", **out}
