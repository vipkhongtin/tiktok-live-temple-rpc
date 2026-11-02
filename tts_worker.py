#!/usr/bin/env python3
"""
Persistent Multi-Voice Vietnamese TTS Daemon (Edge-TTS Neural + ZeroTTS Offline AI).
Voices supported:
  - 'hoaimy'    : Microsoft Edge Neural Nữ Hoài My (vi-VN-HoaiMyNeural) - Truyền cảm, nhanh, nhẹ CPU 0%
  - 'namminh'   : Microsoft Edge Neural Nam Minh (vi-VN-NamMinhNeural) - Trầm ấm, trang nghiêm
  - 'maichi'    : ZeroTTS Offline AI (maichi) - Tự động lazy-load model khi được chọn (hoặc fallback sang Hoài My)
  - 'google_vi' : Handled by Node.js or fallback to Hoài My
"""
import asyncio
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "3")
os.environ.setdefault("OMP_WAIT_POLICY", "PASSIVE")
os.environ.setdefault("MKL_NUM_THREADS", "3")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "3")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "3")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


try:
    import edge_tts
    HAS_EDGE_TTS = True
except Exception:
    HAS_EDGE_TTS = False

try:
    import numpy as np
    from zerotts import ZeroTTS, normalize_vi_text
    from zerotts.chunking import normalize_punctuation
    HAS_ZEROTTS = True
except Exception:
    HAS_ZEROTTS = False

CACHE_DIR = Path(__file__).resolve().parent / "data" / "tts-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
MAX_CACHE_FILES = 240

EDGE_VOICE_MAP = {
    "hoaimy": "vi-VN-HoaiMyNeural",
    "namminh": "vi-VN-NamMinhNeural",
}

LOCAL_MODEL_CANDIDATES = [
    os.environ.get("ZEROTTS_MODEL_PATH", ""),
    str(Path(__file__).resolve().parent / "models" / "zerotts"),
]

VIETNAMESE_ALLOWED_RE = re.compile(
    r"[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]"
)
BRACKET_EMOTE_RE = re.compile(r"\[[^\]]{1,24}\]")
REPEATED_CHARS_RE = re.compile(r"(.)\1{2,}", re.IGNORECASE)
MULTI_PUNCT_RE = re.compile(r"([.,!?])\1+")
MULTI_SPACE_RE = re.compile(r"\s+")


def resolve_model_source() -> str:
    for candidate in LOCAL_MODEL_CANDIDATES:
        if candidate and os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "config.json")):
            return candidate
    return "zeroweight-ai/ZeroTTS"


def prune_cache_if_needed() -> None:
    try:
        files = sorted(
            list(CACHE_DIR.glob("*.wav")) + list(CACHE_DIR.glob("*.mp3")),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old_file in files[MAX_CACHE_FILES:]:
            try:
                old_file.unlink()
            except OSError:
                pass
    except Exception:
        pass


def clean_and_normalize_text(raw_text: str, use_zerotts_norm: bool = False) -> str:
    if not raw_text:
        return ""
    text = unicodedata.normalize("NFC", unicodedata.normalize("NFKC", str(raw_text)))
    text = BRACKET_EMOTE_RE.sub(" ", text)
    text = VIETNAMESE_ALLOWED_RE.sub(" ", text)
    text = MULTI_PUNCT_RE.sub(r"\1", text)
    text = REPEATED_CHARS_RE.sub(r"\1\1", text)
    text = MULTI_SPACE_RE.sub(" ", text).strip(" .,!?-")

    letters = re.findall(r"[a-zA-ZÀ-ỹĂăĐđĨĩŨũƠơƯư]", text)
    if len(letters) < 2:
        return ""

    if len(text) > 190:
        text = text[:190].rsplit(" ", 1)[0]

    if use_zerotts_norm and HAS_ZEROTTS:
        normalized = normalize_vi_text(text)
        normalized = normalize_punctuation(normalized).strip()
        normalized = VIETNAMESE_ALLOWED_RE.sub(" ", normalized)
        normalized = MULTI_SPACE_RE.sub(" ", normalized).strip()
    else:
        normalized = text

    if normalized and normalized[-1] not in ".!?":
        normalized += "."
    return normalized


def polish_waveform(wav, sample_rate: int):
    arr = np.asarray(wav, dtype=np.float32).reshape(-1)
    if arr.size == 0:
        return arr.reshape(1, 0)
    arr = arr - np.mean(arr)
    peak = float(np.max(np.abs(arr)))
    if peak > 0.90:
        arr = arr * (0.90 / peak)
    fade_in = min(int(sample_rate * 0.012), arr.size // 4)
    fade_out = min(int(sample_rate * 0.020), arr.size // 4)
    if fade_in > 1:
        ramp_in = 0.5 * (1.0 - np.cos(np.linspace(0, np.pi, fade_in, dtype=np.float32)))
        arr[:fade_in] *= ramp_in
    if fade_out > 1:
        ramp_out = 0.5 * (1.0 + np.cos(np.linspace(0, np.pi, fade_out, dtype=np.float32)))
        arr[-fade_out:] *= ramp_out
    return arr.reshape(1, -1)


async def synth_edge_tts(norm_text: str, voice_key: str) -> dict:
    edge_voice = EDGE_VOICE_MAP.get(voice_key, "vi-VN-HoaiMyNeural")
    cache_key = hashlib.sha1(f"edge_v1::{edge_voice}::{norm_text}".encode("utf-8")).hexdigest()[:20]
    out_name = f"edge_{voice_key}_{cache_key}.mp3"
    out_path = CACHE_DIR / out_name

    if out_path.is_file() and out_path.stat().st_size > 200:
        return {
            "ok": True,
            "cached": True,
            "engine": f"Edge-Neural ({edge_voice})",
            "voice": voice_key,
            "file": out_name,
            "url": f"/tts-cache/{out_name}",
            "synthSec": 0.0,
        }

    t0 = time.time()
    communicate = edge_tts.Communicate(norm_text, edge_voice, rate="-4%", pitch="-2Hz" if voice_key == "namminh" else "+0Hz")
    await communicate.save(str(out_path))
    synth_sec = round(time.time() - t0, 2)

    return {
        "ok": True,
        "cached": False,
        "engine": f"Edge-Neural ({edge_voice})",
        "voice": voice_key,
        "file": out_name,
        "url": f"/tts-cache/{out_name}",
        "synthSec": synth_sec,
    }


def main() -> None:
    t0 = time.time()
    if not HAS_EDGE_TTS and not HAS_ZEROTTS:
        emit({
            "type": "error",
            "fatal": True,
            "error": "Neither edge-tts nor zerotts is installed in Python environment.",
        })
        sys.exit(1)

    available_voices = ["hoaimy", "namminh", "maichi", "google_vi"]
    emit({
        "type": "ready",
        "model": "Edge-Neural (Hoài My / Nam Minh) + ZeroTTS (Mai Chi)",
        "voice": "hoaimy",
        "voices": available_voices,
        "sampleRate": 48000,
        "loadSec": round(time.time() - t0, 2),
    })

    zero_tts_instance = None
    synth_count = 0

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            text = (req.get("text") or "").strip()
            voice = (req.get("voice") or "hoaimy").strip().lower()

            use_zero = voice == "maichi" and HAS_ZEROTTS
            norm_text = clean_and_normalize_text(text, use_zerotts_norm=use_zero)
            if not norm_text:
                emit({"type": "result", "id": req_id, "ok": False, "error": "Filtered empty/spam text"})
                continue

            # 1. Nếu chọn giọng Hoài My / Nam Minh (hoặc fallback từ Mai Chi khi chưa tải model ZeroTTS)
            if voice in ("hoaimy", "namminh") and HAS_EDGE_TTS:
                res = asyncio.run(synth_edge_tts(norm_text, voice))
                res["type"] = "result"
                res["id"] = req_id
                synth_count += 1
                if synth_count % 20 == 0:
                    prune_cache_if_needed()
                emit(res)
                continue

            # 2. Nếu chọn giọng Mai Chi (ZeroTTS Offline AI)
            if voice == "maichi" and HAS_ZEROTTS:
                try:
                    if zero_tts_instance is None:
                        model_src = resolve_model_source()
                        zero_tts_instance = ZeroTTS.from_pretrained(model_src, intra_op_num_threads=3)
                    cache_key = hashlib.sha1(f"v3::maichi::{norm_text}".encode("utf-8")).hexdigest()[:20]
                    out_name = f"maichi_{cache_key}.wav"
                    out_path = CACHE_DIR / out_name
                    if out_path.is_file() and out_path.stat().st_size > 200:
                        emit({
                            "type": "result",
                            "id": req_id,
                            "ok": True,
                            "cached": True,
                            "engine": "ZeroTTS (Mai Chi)",
                            "voice": "maichi",
                            "file": out_name,
                            "url": f"/tts-cache/{out_name}",
                            "synthSec": 0.0,
                        })
                        continue
                    t_synth = time.time()
                    raw_wav = zero_tts_instance.synthesize(norm_text, voice="maichi", eoa_extra_frames=2)
                    clean_audio = polish_waveform(raw_wav, int(zero_tts_instance.sample_rate))
                    zero_tts_instance.save_audio(clean_audio, str(out_path))
                    synth_sec = round(time.time() - t_synth, 2)
                    emit({
                        "type": "result",
                        "id": req_id,
                        "ok": True,
                        "cached": False,
                        "engine": "ZeroTTS (Mai Chi)",
                        "voice": "maichi",
                        "file": out_name,
                        "url": f"/tts-cache/{out_name}",
                        "synthSec": synth_sec,
                    })
                    continue
                except Exception as zero_err:
                    # Nếu ZeroTTS chưa có model offline, tự động chuyển mượt sang giọng Nữ Hoài My Neural
                    if HAS_EDGE_TTS:
                        res = asyncio.run(synth_edge_tts(norm_text, "hoaimy"))
                        res["type"] = "result"
                        res["id"] = req_id
                        emit(res)
                        continue
                    raise zero_err

            # Fallback mặc định sang Edge TTS Hoài My
            if HAS_EDGE_TTS:
                res = asyncio.run(synth_edge_tts(norm_text, "hoaimy"))
                res["type"] = "result"
                res["id"] = req_id
                emit(res)
            else:
                emit({"type": "result", "id": req_id, "ok": False, "error": "Unsupported voice"})

        except Exception as exc:
            emit({
                "type": "result",
                "id": req_id,
                "ok": False,
                "error": str(exc),
            })


if __name__ == "__main__":
    main()
