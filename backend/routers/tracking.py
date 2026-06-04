import hashlib
import math
import random
import time
from typing import Optional
from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..auth import get_current_user

try:
    import json as _json
    import requests as http_req
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False

router = APIRouter(prefix="/tracking", tags=["tracking"])

OMSK_LAT = 54.9885
OMSK_LNG = 73.3242

# ── bus-55.ru Navitrans API ────────────────────────────────────────
BUS55_BASE    = "https://bus-55.ru/api/rpc.php"
BUS55_RPC     = "2․2"
BUS55_SYS_ID  = "omsk"
BUS55_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent":   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin":       "https://bus-55.ru",
    "Referer":      "https://bus-55.ru/",
}

_session: dict  = {"sid": None, "exp": 0.0}
_req_id: list   = [1]
_live_cache: dict = {"vehicles": [], "ts": 0.0}
_CACHE_TTL = 12  # seconds — shared across all requests


def _ts() -> int:
    t = int(time.time())
    while t % 10 in (0, 3, 7):
        t += 1
    return t


def _next_id() -> int:
    while True:
        _req_id[0] += 1
        if _req_id[0] % 7 != 0:
            return _req_id[0]


def _sign(method: str, req_id: int, sid: str):
    raw  = hashlib.sha1(f"{method}~{BUS55_SYS_ID}~{req_id}~{sid}".encode()).hexdigest()
    guid = f"{raw[0:8]}-{raw[8:12]}-{raw[12:16]}-{raw[24:28]}-{raw[28:40]}"
    return f"{BUS55_BASE}?m={guid}", raw[16:24]


def _start_session() -> Optional[str]:
    if not _HAS_REQUESTS:
        return None
    try:
        r = http_req.post(BUS55_BASE, headers=BUS55_HEADERS, json={
            "jsonrpc": BUS55_RPC, "method": "startSession",
            "ts": _ts(), "params": {}, "id": 1,
        }, timeout=6)
        sid = r.json()["result"]["sid"]
        _session["sid"] = sid
        _session["exp"] = time.time() + 3500
        return sid
    except Exception:
        return None


def _get_sid() -> Optional[str]:
    if not _session["sid"] or time.time() > _session["exp"]:
        return _start_session()
    return _session["sid"]


def _fetch_all_units() -> list[dict]:
    """Fetch all active vehicles from bus-55.ru in the Omsk bounding box."""
    if not _HAS_REQUESTS:
        return []
    sid = _get_sid()
    if not sid:
        return []

    for attempt in range(2):
        try:
            rid = _next_id()
            url, magic = _sign("getUnitsInRect", rid, sid)
            r = http_req.post(url, headers=BUS55_HEADERS, json={
                "jsonrpc": BUS55_RPC, "method": "getUnitsInRect",
                "ts": _ts(), "id": rid,
                "params": {
                    "sid": sid, "magic": magic,
                    "minlat": 54.80, "maxlat": 55.15,
                    "minlong": 73.10, "maxlong": 73.70,
                },
            }, timeout=8)
            # Always decode as UTF-8 regardless of what the server claims in Content-Type
            data = _json.loads(r.content.decode("utf-8", errors="replace"))

            if "error" in data:
                code = data["error"].get("code", 0)
                if code == -33100 and attempt == 0:
                    _session["sid"] = None
                    sid = _start_session()
                    if not sid:
                        return []
                    continue
                return []

            vehicles = data.get("result", [])
            return vehicles if isinstance(vehicles, list) else []

        except Exception:
            if attempt == 0:
                _session["sid"] = None
                sid = _start_session()
                if not sid:
                    return []
            else:
                return []
    return []


def _get_cached_units() -> list[dict]:
    """Return cached vehicle list, refreshing if TTL expired."""
    now = time.time()
    if now - _live_cache["ts"] < _CACHE_TTL and _live_cache["vehicles"]:
        return _live_cache["vehicles"]
    vehicles = _fetch_all_units()
    _live_cache["vehicles"] = vehicles
    _live_cache["ts"] = now
    return vehicles


# ── Fallback mock ─────────────────────────────────────────────────
DIRECTIONS = ["Центр → ОмскТех", "ОмскТех → Центр", "Центр → Левый берег", "Левый берег → Центр"]


def _random_coord(lat: float, lng: float, r: float = 0.05):
    a = random.uniform(0, 2 * math.pi)
    d = random.uniform(0, r)
    return lat + d * math.cos(a), lng + d * math.sin(a)


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/position", response_model=schemas.PositionOut)
def get_position(current_user: models.User = Depends(get_current_user)):
    # Зафиксировано: Театральная площадь, направление → СТЦ Мега (запад)
    return schemas.PositionOut(lat=54.9894, lng=73.3780, speed=34.0)


@router.get("/rivals/live", response_model=list[schemas.RivalOut])
def get_rivals_live(
    routes: str = Query(default=""),
    current_user: models.User = Depends(get_current_user),
):
    """Real-time rival vehicles from bus-55.ru (Navitrans), filtered by route numbers."""
    route_list = [r.strip() for r in routes.split(",") if r.strip()]
    if not route_list:
        return []

    route_set = set(route_list)
    all_vehicles = _get_cached_units()
    result: list[schemas.RivalOut] = []

    for i, v in enumerate(all_vehicles):
        try:
            mr_num = str(v.get("mr_num", ""))
            if mr_num not in route_set:
                continue
            lat = float(v.get("u_lat", 0) or 0)
            lng = float(v.get("u_long", 0) or 0)
            if not lat or not lng:
                continue
            first = v.get("rl_firststation_title") or "?"
            last  = v.get("rl_laststation_title")  or "?"
            direction = f"{first} → {last}"
            plate = str(v.get("u_statenum", "") or "").strip()
            model = str(v.get("u_model", "") or "").strip()
            uid   = str(v.get("u_id", i + 1))
            result.append(schemas.RivalOut(
                id=i + 1,
                unit_id=uid,
                lat=lat,
                lng=lng,
                speed=float(v.get("u_speed", 0) or 0),
                direction=direction,
                route_number=mr_num,
                plate_number=plate if plate else None,
                model=model if model else None,
                status="active" if str(v.get("u_inv", "0")) == "1" else "inactive",
            ))
        except Exception:
            continue

    return result


@router.get("/rivals", response_model=list[schemas.RivalOut])
def get_rivals(
    direction: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
):
    rivals = []
    for i in range(random.randint(3, 8)):
        lat, lng = _random_coord(OMSK_LAT, OMSK_LNG, 0.04)
        d = random.choice(DIRECTIONS)
        if direction and direction not in d:
            continue
        rivals.append(schemas.RivalOut(
            id=i + 1, lat=lat, lng=lng,
            speed=random.uniform(20, 70), direction=d,
            route_number=random.choice(["212", "120", "73", "44", "79", "91"]),
            status="active",
        ))
    return rivals


@router.post("/request", response_model=schemas.RecommendationOut)
def request_recommendation(
    request: schemas.TrackingRequest,
    current_user: models.User = Depends(get_current_user),
):
    speed = random.uniform(30, 55)
    messages = [
        f"Рекомендуем скорость {speed:.0f} км/ч — конкурентов мало на маршруте",
        f"Увеличьте скорость до {speed:.0f} км/ч — конкурент сзади в 500м",
        f"Снизьте скорость до {speed:.0f} км/ч — высадите пассажиров на следующей",
    ]
    return schemas.RecommendationOut(
        recommended_speed=round(speed, 1),
        message=random.choice(messages),
    )
