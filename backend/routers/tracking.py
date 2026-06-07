import hashlib
import math
import random
import threading
import time
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

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

_session: dict    = {"sid": None, "exp": 0.0}
_req_id: list     = [1]
_live_cache: dict = {"vehicles": [], "ts": 0.0}
_cache_lock       = threading.Lock()
_CACHE_TTL        = 30
_REFRESH_INTERVAL = 25

_route_stops_cache: dict = {}  # mr_id -> {A: [stops], B: [stops], A_dest: str, B_dest: str}
_mr_id_cache: dict       = {}  # route_number -> mr_id


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


def _navitrans_call(method: str, params: dict) -> dict:
    """Make a single authenticated Navitrans RPC call."""
    sid = _get_sid()
    if not sid:
        return {}
    rid = _next_id()
    url, magic = _sign(method, rid, sid)
    r = http_req.post(url, headers=BUS55_HEADERS, json={
        "jsonrpc": BUS55_RPC, "method": method,
        "ts": _ts(), "id": rid,
        "params": {"sid": sid, "magic": magic, **params},
    }, timeout=8)
    return _json.loads(r.content.decode("utf-8", errors="replace"))


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
    with _cache_lock:
        if _live_cache["vehicles"]:
            return list(_live_cache["vehicles"])
    vehicles = _fetch_all_units()
    with _cache_lock:
        _live_cache["vehicles"] = vehicles
        _live_cache["ts"] = time.time()
    return vehicles


def _background_refresh() -> None:
    time.sleep(5)
    while True:
        try:
            vehicles = _fetch_all_units()
            if vehicles:
                with _cache_lock:
                    _live_cache["vehicles"] = vehicles
                    _live_cache["ts"] = time.time()
        except Exception:
            pass
        time.sleep(_REFRESH_INTERVAL)


_refresh_thread = threading.Thread(target=_background_refresh, daemon=True)
_refresh_thread.start()


# ── Direction mapping helpers ──────────────────────────────────────

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _find_mr_id(route_number: str, db: Optional[Session] = None) -> Optional[str]:
    if route_number in _mr_id_cache:
        return _mr_id_cache[route_number]
    for v in _get_cached_units():
        if str(v.get("mr_num", "")) == route_number:
            mid = str(v.get("mr_id", ""))
            if mid:
                _mr_id_cache[route_number] = mid
                return mid
    if db:
        row = db.query(models.RouteNavitransId).filter_by(route_number=route_number).first()
        if row:
            _mr_id_cache[route_number] = row.mr_id
            return row.mr_id
    return None


def _fetch_route_stops(mr_id: str, route_number: str = "", db: Optional[Session] = None) -> dict:
    """Returns {A: [stops], B: [stops], A_dest: str, B_dest: str}. Persists to DB."""
    if mr_id in _route_stops_cache:
        return _route_stops_cache[mr_id]
    if db:
        row = db.query(models.RouteStopList).filter_by(mr_id=mr_id).first()
        if row:
            import json as _j
            data = _j.loads(row.stops_json)
            _route_stops_cache[mr_id] = data
            return data
    try:
        data = _navitrans_call("getRoute", {"mr_id": mr_id})
        races = data.get("result", {}).get("races", [])
        result: dict = {}
        for race in races:
            rt = race.get("rl_racetype", "")
            if not rt:
                continue
            result[rt] = [
                {"st_lat": float(s["st_lat"]), "st_lng": float(s["st_long"])}
                for s in race.get("stopList", [])
                if s.get("st_lat") and s.get("st_long")
            ]
            result[rt + "_dest"] = race.get("rl_laststation", "").strip()
        _route_stops_cache[mr_id] = result
        if db and result:
            import json as _j
            existing = db.query(models.RouteStopList).filter_by(mr_id=mr_id).first()
            if existing:
                existing.stops_json = _j.dumps(result, ensure_ascii=False)
            else:
                db.add(models.RouteStopList(
                    mr_id=mr_id, route_number=route_number,
                    stops_json=_j.dumps(result, ensure_ascii=False)
                ))
            db.commit()
        return result
    except Exception:
        return {}


def _count_ordered_common_stops(stops_a: list, stops_b: list, threshold_m: float = 80.0) -> int:
    """Count stops common to both lists that appear in the same order (same direction)."""
    matches: list[tuple[int, int]] = []
    for i, sa in enumerate(stops_a):
        for j, sb in enumerate(stops_b):
            if _haversine_m(sa["st_lat"], sa["st_lng"], sb["st_lat"], sb["st_lng"]) < threshold_m:
                matches.append((i, j))
                break
    if len(matches) < 2:
        return len(matches)
    j_seq = [m[1] for m in matches]
    in_order = sum(1 for k in range(len(j_seq) - 1) if j_seq[k] < j_seq[k + 1])
    # Majority vote: more than half of consecutive pairs must be increasing
    return len(matches) if in_order > (len(j_seq) - 1) / 2 else 0


def _compute_and_save_mapping(our_route: str, comp_route: str, db: Session) -> int:
    """Compute stop-sequence direction mapping and upsert to DB. Returns pairs saved."""
    our_mr_id = _find_mr_id(our_route, db)
    if not our_mr_id:
        return 0

    # Fetch and persist our route's stop list regardless of competitor status,
    # so it's available in route_stop_lists for future calls even when our buses
    # are not on the line according to Navitrans.
    _route_stops_cache.pop(our_mr_id, None)
    our_stops = _fetch_route_stops(our_mr_id, our_route, db)

    comp_mr_id = _find_mr_id(comp_route, db)
    if not comp_mr_id:
        return 0

    _route_stops_cache.pop(comp_mr_id, None)
    comp_stops = _fetch_route_stops(comp_mr_id, comp_route, db)

    saved = 0
    for our_rt in ("A", "B"):
        our_list = our_stops.get(our_rt, [])
        our_dest = our_stops.get(our_rt + "_dest", "")
        if not our_list or not our_dest:
            continue
        for comp_rt in ("A", "B"):
            comp_list = comp_stops.get(comp_rt, [])
            comp_dest = comp_stops.get(comp_rt + "_dest", "")
            if not comp_list or not comp_dest:
                continue
            count = _count_ordered_common_stops(our_list, comp_list)
            if count >= 3:
                existing = db.query(models.CompetitorDirectionMap).filter_by(
                    our_route_number=our_route,
                    our_destination=our_dest,
                    competitor_route_number=comp_route,
                ).first()
                if existing:
                    if count > existing.common_stop_count:
                        existing.competitor_destination = comp_dest
                        existing.common_stop_count = count
                else:
                    db.add(models.CompetitorDirectionMap(
                        our_route_number=our_route,
                        our_destination=our_dest,
                        competitor_route_number=comp_route,
                        competitor_destination=comp_dest,
                        common_stop_count=count,
                    ))
                    db.flush()  # make the new row visible to subsequent filter_by queries
                saved += 1
    db.commit()
    return saved


# ── Fallback mock ─────────────────────────────────────────────────
DIRECTIONS = ["Центр → ОмскТех", "ОмскТех → Центр", "Центр → Левый берег", "Левый берег → Центр"]


def _random_coord(lat: float, lng: float, r: float = 0.05):
    a = random.uniform(0, 2 * math.pi)
    d = random.uniform(0, r)
    return lat + d * math.cos(a), lng + d * math.sin(a)


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/position", response_model=schemas.PositionOut)
def get_position(current_user: models.User = Depends(get_current_user)):
    return schemas.PositionOut(lat=54.9894, lng=73.3780, speed=34.0)


def _refresh_and_persist_mr_ids(db: Session) -> None:
    """Force a fresh Navitrans fetch and persist all discovered route->mr_id pairs to DB."""
    vehicles = _fetch_all_units()
    if not vehicles:
        return
    with _cache_lock:
        _live_cache["vehicles"] = vehicles
        _live_cache["ts"] = time.time()
    seen: set[str] = set()
    for v in vehicles:
        mr_num = str(v.get("mr_num", "")).strip()
        mr_id  = str(v.get("mr_id",  "")).strip()
        if not mr_num or not mr_id or mr_num in seen:
            continue
        seen.add(mr_num)
        _mr_id_cache[mr_num] = mr_id
        existing = db.query(models.RouteNavitransId).filter_by(route_number=mr_num).first()
        if existing:
            existing.mr_id = mr_id
        else:
            db.add(models.RouteNavitransId(route_number=mr_num, mr_id=mr_id))
    db.commit()


@router.post("/competitor-mapping")
def compute_competitor_mapping(
    our_route: str = Query(...),
    competitor_route: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Compute and save stop-sequence direction mapping for a competitor route."""
    _refresh_and_persist_mr_ids(db)
    saved = _compute_and_save_mapping(our_route, competitor_route, db)
    return {"saved_pairs": saved, "our_route": our_route, "competitor_route": competitor_route}


@router.get("/rivals/live", response_model=list[schemas.RivalOut])
def get_rivals_live(
    routes: str = Query(default=""),
    our_route: str = Query(default=""),
    our_destination: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Real-time rival vehicles from Navitrans, filtered by route and direction mapping."""
    route_list = [r.strip() for r in routes.split(",") if r.strip()]
    if not route_list:
        return []

    route_set = set(route_list)
    all_vehicles = _get_cached_units()

    # Passively persist any newly discovered mr_ids to DB (deduplicated)
    _new: dict[str, str] = {}
    for v in all_vehicles:
        mr_num = str(v.get("mr_num", "")).strip()
        mr_id  = str(v.get("mr_id",  "")).strip()
        if mr_num and mr_id and mr_num not in _mr_id_cache and mr_num not in _new:
            _new[mr_num] = mr_id
    new_mr_ids = list(_new.items())
    if new_mr_ids:
        for mr_num, mr_id in new_mr_ids:
            _mr_id_cache[mr_num] = mr_id
            if not db.query(models.RouteNavitransId).filter_by(route_number=mr_num).first():
                db.add(models.RouteNavitransId(route_number=mr_num, mr_id=mr_id))
        db.commit()
        # Auto-compute mapping for newly discovered rival routes that still lack one
        if our_route:
            for mr_num, _mr_id in new_mr_ids:
                if mr_num in route_set:
                    already = db.query(models.CompetitorDirectionMap).filter_by(
                        our_route_number=our_route,
                        competitor_route_number=mr_num,
                    ).first()
                    if not already:
                        _compute_and_save_mapping(our_route, mr_num, db)

    # Build direction filter from DB
    # allowed: routes with a positive direction match -> set of rl_laststation_title values to show
    # any_mapped: all competitor routes we have ANY mapping for (for this our_route)
    # Logic: if we have at least one mapping → apply strict mode:
    #   - routes with a match in this direction → show only matching vehicles
    #   - routes with no match in this direction → hide entirely
    # If no mappings at all → show everything (computation hasn't run yet)
    allowed: dict[str, set[str]] = {}
    any_mapped: set[str] = set()
    if our_route and our_destination:
        mappings = db.query(models.CompetitorDirectionMap).filter_by(
            our_route_number=our_route,
            our_destination=our_destination,
        ).all()
        for m in mappings:
            allowed.setdefault(m.competitor_route_number, set()).add(m.competitor_destination)
        # Also collect all routes we've ever computed for this our_route (any direction)
        all_mappings = db.query(models.CompetitorDirectionMap.competitor_route_number).filter_by(
            our_route_number=our_route,
        ).distinct().all()
        any_mapped = {r[0] for r in all_mappings}

    result: list[schemas.RivalOut] = []
    for i, v in enumerate(all_vehicles):
        try:
            mr_num = str(v.get("mr_num", ""))
            if mr_num not in route_set:
                continue

            # Direction filter (strict mode when we have any mapping data):
            if our_route and our_destination and any_mapped:
                if mr_num in any_mapped:
                    # We've computed this route — apply exact filter
                    if mr_num not in allowed:
                        continue  # computed but no match in this direction → hide
                    last_station = str(v.get("rl_laststation_title", "") or "").strip()
                    if last_station not in allowed[mr_num]:
                        continue
                # Routes not yet computed → show all (computation still pending)

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
