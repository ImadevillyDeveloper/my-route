import hashlib
import math
import random
import re
import threading
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user, get_current_entrepreneur
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
_named_stops_cache: dict = {}  # mr_id -> [{name, lat, lng}, ...]


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
                {
                    "st_lat": float(s["st_lat"]),
                    "st_lng": float(s["st_long"]),
                    "st_id": str(s["st_id"]) if s.get("st_id") else None,
                }
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


def _fetch_named_stops(mr_id: str) -> list[dict]:
    """Returns [{name, lat, lng}, ...] for a route, deduplicated by stop name."""
    if mr_id in _named_stops_cache:
        return _named_stops_cache[mr_id]
    try:
        data = _navitrans_call("getRoute", {"mr_id": mr_id})
        races = data.get("result", {}).get("races", [])
        stops: list[dict] = []
        seen: set[str] = set()
        for race in races:
            for s in race.get("stopList", []):
                lat  = s.get("st_lat")
                lng  = s.get("st_long")
                name = (s.get("st_title") or s.get("st_name") or "").strip()
                if lat and lng and name and name not in seen:
                    stops.append({
                        "name": name, "lat": float(lat), "lng": float(lng),
                        "st_id": str(s["st_id"]) if s.get("st_id") else None,
                    })
                    seen.add(name)
        _named_stops_cache[mr_id] = stops
        return stops
    except Exception:
        return []


def _terminal_coords(route_number: str, db: Session) -> dict:
    """Returns {"start": {"name","lat","lng"} | None, "end": {...} | None} for a
    route's two terminals, matched against Route.start_point/end_point by the same
    destination-name convention _compute_and_save_mapping already relies on
    (Navitrans race destination text == Route.start_point/end_point text)."""
    route = db.query(models.Route).filter(models.Route.number == route_number).first()
    if not route:
        return {"start": None, "end": None}

    mr_id = _find_mr_id(route_number, db)
    if not mr_id:
        return {"start": None, "end": None}
    stops_data = _fetch_route_stops(mr_id, route_number, db)

    by_dest: dict[str, dict] = {}
    for rt in ("A", "B"):
        stop_list = stops_data.get(rt, [])
        dest = stops_data.get(rt + "_dest")
        if stop_list and dest:
            last = stop_list[-1]
            by_dest[dest] = {"name": dest, "lat": last["st_lat"], "lng": last["st_lng"], "st_id": last.get("st_id")}

    return {
        "start": by_dest.get(route.start_point),
        "end": by_dest.get(route.end_point),
    }


def _arrive_eta_min(systime: Optional[str], arrivetime: Optional[str]) -> Optional[int]:
    """tc_systime/tc_arrivetime — строки "ЧЧ:ММ[:СС]". Разница в минутах, с
    переходом через полночь (напр. systime 23:55, arrivetime 00:05 -> 10 мин)."""
    if not systime or not arrivetime:
        return None
    try:
        def _to_min(s: str) -> int:
            h, m = s.split(":")[:2]
            return int(h) * 60 + int(m)
        diff = _to_min(arrivetime) - _to_min(systime)
        return diff + 1440 if diff < 0 else diff
    except Exception:
        return None


def _fetch_stop_schedule(
    stop_name: str, lat: float, lng: float, st_id: Optional[str] = None,
    allowed_routes: Optional[set[str]] = None,
) -> schemas.StopScheduleOut:
    """Расписание выезда КОНКУРЕНТОВ с остановки — RPC-метод getStopArrive
    (тот же, что использует bus-55.ru для окошка "Прогноз" по клику на остановку).
    allowed_routes — маршруты, настроенные водителем как конкурентные в Настройках;
    всё остальное (включая свой собственный маршрут) отфильтровывается, отчёт по всем
    подряд не нужен."""
    if not st_id:
        return schemas.StopScheduleOut(stop_name=stop_name, departures=[], note="Для этой остановки нет данных Навитранса")
    if not allowed_routes:
        return schemas.StopScheduleOut(stop_name=stop_name, departures=[], note="Не выбраны маршруты для отображения в расписании")
    try:
        data = _navitrans_call("getStopArrive", {"st_id": st_id})
        rows = data.get("result", [])
        if not isinstance(rows, list):
            return schemas.StopScheduleOut(stop_name=stop_name, departures=[], note="Расписание временно недоступно")
        departures = []
        for r in rows[:30]:
            route_number = str(r.get("mr_num", "") or "").strip()
            if not route_number or route_number not in allowed_routes:
                continue
            departures.append(schemas.StopDeparture(
                route_number=route_number,
                eta_min=_arrive_eta_min(r.get("tc_systime"), r.get("tc_arrivetime")),
                destination=(r.get("laststation_title") or "").strip() or None,
            ))
            if len(departures) >= 10:
                break
        note = None if departures else "Ближайших рейсов конкурентов не найдено"
        return schemas.StopScheduleOut(stop_name=stop_name, departures=departures, note=note)
    except Exception:
        return schemas.StopScheduleOut(stop_name=stop_name, departures=[], note="Расписание временно недоступно")


def _nearest_stop_idx(lat: float, lng: float, stops: list) -> tuple[int, float]:
    """Returns (index, distance_m) of the nearest stop."""
    best_idx, best_dist = 0, float("inf")
    for i, s in enumerate(stops):
        d = _haversine_m(lat, lng, s["st_lat"], s["st_lng"])
        if d < best_dist:
            best_dist, best_idx = d, i
    return best_idx, best_dist


def _route_dist_m(from_idx: int, to_idx: int, stops: list) -> float:
    """Cumulative distance along stop sequence from from_idx to to_idx."""
    total = 0.0
    for i in range(from_idx, to_idx):
        total += _haversine_m(stops[i]["st_lat"], stops[i]["st_lng"],
                              stops[i + 1]["st_lat"], stops[i + 1]["st_lng"])
    return total


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


GPS_STALE_S = 90  # GPS-позиция считается устаревшей и не показывается через этот интервал


@router.post("/gps")
def post_gps(
    body: schemas.GpsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Водитель периодически шлёт свою GPS-позицию — используется как запасной
    источник местоположения ТС на карте предпринимателя, если по этому ТС
    нет данных с Навитранса."""
    current_user.gps_lat = body.lat
    current_user.gps_lng = body.lng
    current_user.gps_speed = body.speed
    current_user.gps_updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


def _route_sort_key(route: str) -> tuple:
    m = re.match(r"(\d+)(.*)", route)
    if m:
        return (0, int(m.group(1)), m.group(2))
    return (1, 0, route)


@router.get("/routes", response_model=list[str])
def get_known_routes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """All route numbers known from Navitrans — currently live plus previously discovered."""
    routes: set[str] = set()
    for v in _get_cached_units():
        raw = v.get("mr_num")
        if raw is None:
            continue
        num = str(raw).strip()
        if num and num.lower() != "none":
            routes.add(num)
    for row in db.query(models.RouteNavitransId.route_number).all():
        if row[0] and row[0].strip().lower() != "none":
            routes.add(row[0])
    return sorted(routes, key=_route_sort_key)


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

    # ── GPS-фолбэк: водитель начал смену на ТС этого маршрута, но
    # свежих данных с Навитранса по его гос. номеру нет ─────────────
    navitrans_plates: dict[str, set[str]] = {}
    for r in result:
        if r.route_number:
            navitrans_plates.setdefault(r.route_number, set()).add((r.plate_number or "").strip())

    gps_drivers = db.query(models.User).filter(
        models.User.role == models.UserRole.driver,
        models.User.route_number.in_(route_list),
        models.User.active_shift_start.isnot(None),
        models.User.gps_updated_at.isnot(None),
    ).all()

    now = datetime.now(timezone.utc)
    for d in gps_drivers:
        route_num = (d.route_number or "").strip()
        # Временная подмена ТС на смену (active_shift_vehicle_plate) имеет приоритет
        # над постоянно назначенным vehicle_plate — именно на ней сейчас едет водитель.
        plate = (d.active_shift_vehicle_plate or d.vehicle_plate or "").strip()
        if not route_num or not plate:
            continue
        if plate in navitrans_plates.get(route_num, set()):
            continue  # свежие данные с Навитранса уже есть — GPS не нужен
        if (now - d.gps_updated_at).total_seconds() > GPS_STALE_S:
            continue  # GPS слишком старый — не показываем "призрак"

        route = db.query(models.Route).filter(models.Route.number == route_num).first()
        if route:
            direction = (
                f"{route.end_point} → {route.start_point}" if d.active_direction == "back"
                else f"{route.start_point} → {route.end_point}"
            )
        else:
            direction = f"Маршрут {route_num}"

        result.append(schemas.RivalOut(
            id=len(result) + 1,
            unit_id=f"driver-{d.id}",
            lat=d.gps_lat,
            lng=d.gps_lng,
            speed=d.gps_speed or 0.0,
            direction=direction,
            route_number=route_num,
            plate_number=plate,
            model=None,
            status="active",
            source="gps",
        ))

    return result


@router.get("/my-vehicles/live", response_model=list[schemas.RivalOut])
def get_my_vehicles_live(
    current_user: models.User = Depends(get_current_entrepreneur),
    db: Session = Depends(get_db),
):
    """Реальные позиции ВСЕХ ТС предпринимателя (для карты, пока не выбран
    избранный маршрут): сначала данные Навитранса (ГЛОНАСС) по совпадению
    гос.номера, для непойманных там — GPS водителя, если у него открыта смена
    именно на этом ТС. Никаких вымышленных/случайных координат или времени —
    ТС, для которого нет ни того ни другого, просто не попадает в список."""
    vehicles = db.query(models.Vehicle).filter(
        models.Vehicle.owner_id == current_user.id,
        models.Vehicle.plate_number.isnot(None),
    ).all()
    if not vehicles:
        return []
    my_plates = {v.plate_number for v in vehicles}

    all_units = _get_cached_units()
    result: list[schemas.RivalOut] = []
    matched_plates: set[str] = set()

    for i, u in enumerate(all_units):
        plate = str(u.get("u_statenum", "") or "").strip()
        if plate not in my_plates or plate in matched_plates:
            continue
        lat = float(u.get("u_lat", 0) or 0)
        lng = float(u.get("u_long", 0) or 0)
        if not lat or not lng:
            continue
        first = u.get("rl_firststation_title") or "?"
        last  = u.get("rl_laststation_title") or "?"
        result.append(schemas.RivalOut(
            id=i + 1,
            unit_id=str(u.get("u_id", i + 1)),
            lat=lat,
            lng=lng,
            speed=float(u.get("u_speed", 0) or 0),
            direction=f"{first} → {last}",
            route_number=str(u.get("mr_num", "")) or None,
            plate_number=plate,
            model=str(u.get("u_model", "") or "") or None,
            status="active" if str(u.get("u_inv", "0")) == "1" else "inactive",
        ))
        matched_plates.add(plate)

    # GPS-фолбэк для ТС, не найденных в Навитрансе — только если на нём прямо
    # сейчас открыта смена (постоянное ТС водителя или подмена на эту смену).
    remaining = my_plates - matched_plates
    if remaining:
        gps_drivers = db.query(models.User).filter(
            models.User.role == models.UserRole.driver,
            models.User.owner_id == current_user.id,
            models.User.active_shift_start.isnot(None),
            models.User.gps_updated_at.isnot(None),
        ).all()
        now = datetime.now(timezone.utc)
        for d in gps_drivers:
            plate = (d.active_shift_vehicle_plate or d.vehicle_plate or "").strip()
            if plate not in remaining:
                continue
            if (now - d.gps_updated_at).total_seconds() > GPS_STALE_S:
                continue  # GPS слишком старый — не показываем "призрак"

            route = db.query(models.Route).filter(models.Route.number == d.route_number).first() if d.route_number else None
            if route:
                direction = (
                    f"{route.end_point} → {route.start_point}" if d.active_direction == "back"
                    else f"{route.start_point} → {route.end_point}"
                )
            else:
                direction = f"Маршрут {d.route_number}" if d.route_number else "—"

            result.append(schemas.RivalOut(
                id=len(result) + 1,
                unit_id=f"driver-{d.id}",
                lat=d.gps_lat,
                lng=d.gps_lng,
                speed=d.gps_speed or 0.0,
                direction=direction,
                route_number=d.route_number,
                plate_number=plate,
                model=None,
                status="active",
                source="gps",
            ))
            matched_plates.add(plate)

    return result


@router.get("/nearest-stop", response_model=schemas.NearestStopOut)
def get_nearest_stop(
    route_number: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Nearest named stop on a route to a given point (for rival vehicle info)."""
    mr_id = _find_mr_id(route_number, db)
    if not mr_id:
        return schemas.NearestStopOut(name=None)
    stops = _fetch_named_stops(mr_id)
    if not stops:
        return schemas.NearestStopOut(name=None)
    best = min(stops, key=lambda s: _haversine_m(lat, lng, s["lat"], s["lng"]))
    return schemas.NearestStopOut(name=best["name"])


@router.get("/route-terminals", response_model=schemas.TerminalCoordsOut)
def get_route_terminals(
    route_number: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Координаты двух конечных маршрута — для клиентского определения прибытия по GPS."""
    coords = _terminal_coords(route_number, db)
    return schemas.TerminalCoordsOut(
        start=schemas.NamedStopOut(**coords["start"]) if coords["start"] else None,
        end=schemas.NamedStopOut(**coords["end"]) if coords["end"] else None,
    )


@router.get("/route-endpoints", response_model=schemas.RouteEndpointsOut)
def get_route_endpoints(
    route_number: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Официальные названия конечных маршрута по данным Навитранса (rl_laststation
    обоих направлений) — источник для автозаполнения Route.start_point/end_point.
    В отличие от /route-terminals, не требует, чтобы эти поля уже были заполнены
    и не зависит от наличия сейчас живых машин на маршруте."""
    mr_id = _find_mr_id(route_number, db)
    if not mr_id:
        return schemas.RouteEndpointsOut(start=None, end=None)
    stops_data = _fetch_route_stops(mr_id, route_number, db)
    return schemas.RouteEndpointsOut(
        start=stops_data.get("A_dest") or None,
        end=stops_data.get("B_dest") or None,
    )


@router.get("/named-stops", response_model=list[schemas.NamedStopOut])
def get_named_stops_route(
    route_number: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Все именованные остановки маршрута — для выбора остановки-ориентира в настройках."""
    mr_id = _find_mr_id(route_number, db)
    if not mr_id:
        return []
    return [schemas.NamedStopOut(**s) for s in _fetch_named_stops(mr_id)]


@router.get("/stop-schedule", response_model=schemas.StopScheduleOut)
def get_stop_schedule(
    stop_name: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    st_id: Optional[str] = Query(default=None),
    current_user: models.User = Depends(get_current_user),
):
    """Расписание выезда конкурентов с остановки — см. _fetch_stop_schedule.
    Маршруты для отображения — schedule_routes_json, если водитель его настроил
    (личный подсписок конкурентных); иначе, пока не настроил — все конкурентные."""
    try:
        if current_user.schedule_routes_json is not None:
            allowed = set(_json.loads(current_user.schedule_routes_json))
        elif current_user.rival_routes_json:
            allowed = set(_json.loads(current_user.rival_routes_json))
        else:
            allowed = set()
    except Exception:
        allowed = set()
    return _fetch_stop_schedule(stop_name, lat, lng, st_id, allowed)


# ── Рейсы ("Trip") ──────────────────────────────────────────────

@router.post("/trips/open", response_model=schemas.TripOut)
def open_trip(
    body: schemas.TripOpen,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Открывает новый рейс. Идемпотентно: если рейс уже открыт — возвращает его же."""
    if current_user.active_trip_id:
        existing = db.query(models.Trip).filter(models.Trip.id == current_user.active_trip_id).first()
        if existing and existing.ended_at is None:
            return existing

    trip = models.Trip(
        driver_id=current_user.id,
        route_number=body.route_number,
        shift_start_ref=body.shift_start_ref or current_user.active_shift_start or "",
        start_terminal=body.start_terminal,
        direction=body.direction,
        started_at=datetime.now(timezone.utc),
    )
    db.add(trip)
    db.flush()
    current_user.active_trip_id = trip.id
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/trips/{trip_id}/close", response_model=schemas.TripOut)
def close_trip(
    trip_id: int,
    body: schemas.TripClose,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Закрывает рейс. Идемпотентно: повторный вызов на уже закрытом рейсе — не ошибка."""
    trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id, models.Trip.driver_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(404, "Рейс не найден")

    if trip.ended_at is None:
        trip.ended_at = datetime.now(timezone.utc)
        trip.end_terminal = body.end_terminal
        trip.close_method = body.close_method
        if current_user.active_trip_id == trip.id:
            current_user.active_trip_id = None
        db.commit()
        db.refresh(trip)
    return trip


@router.post("/trips/{trip_id}/override", response_model=schemas.TripOut)
def override_trip(
    trip_id: int,
    body: schemas.TripOverride,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Водитель вручную помечает рейс с аномальной длительностью как корректный (или снимает пометку)."""
    trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id, models.Trip.driver_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(404, "Рейс не найден")
    trip.override_valid = body.valid
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/trips/{trip_id}")
def forget_trip(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Полностью удаляет ошибочно созданный рейс — он больше нигде не учитывается."""
    trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id, models.Trip.driver_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(404, "Рейс не найден")
    if current_user.active_trip_id == trip.id:
        current_user.active_trip_id = None
    db.delete(trip)
    db.commit()
    return {"ok": True}


@router.get("/trips", response_model=list[schemas.TripOut])
def list_trips(
    report_id: Optional[int] = Query(default=None),
    shift_start_ref: Optional[str] = Query(default=None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Список рейсов — по отчёту (для модалки в деталях отчёта) или по смене (для форм отчёта)."""
    q = db.query(models.Trip).filter(models.Trip.driver_id == current_user.id)
    if report_id is not None:
        q = q.filter(models.Trip.report_id == report_id)
    if shift_start_ref:
        q = q.filter(models.Trip.shift_start_ref == shift_start_ref)
    return q.order_by(models.Trip.started_at).all()


# ── AI Hint endpoint ──────────────────────────────────────────────

@router.get("/hint", response_model=schemas.HintOut)
def get_hint(
    our_route: str = Query(...),
    our_lat: float = Query(...),
    our_lng: float = Query(...),
    our_speed: float = Query(0.0),          # km/h
    our_destination: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return an AI driving hint based on competitor positions and ETAs."""
    NO_HINT = schemas.HintOut(type="none")

    # 1. Our stop list
    our_mr_id = _find_mr_id(our_route, db)
    if not our_mr_id:
        return NO_HINT
    stops_data = _fetch_route_stops(our_mr_id, our_route, db)
    our_rt = next((rt for rt in ("A", "B") if stops_data.get(rt + "_dest") == our_destination), None)
    if not our_rt:
        return NO_HINT
    our_stops = stops_data.get(our_rt, [])
    if len(our_stops) < 2:
        return NO_HINT

    our_idx, _ = _nearest_stop_idx(our_lat, our_lng, our_stops)
    our_spd_ms = max(our_speed / 3.6, 1.0)  # m/s, floor at 1 to avoid ÷0

    # 2. Direction mappings → which rival destinations are valid
    mappings = db.query(models.CompetitorDirectionMap).filter_by(
        our_route_number=our_route, our_destination=our_destination
    ).all()
    if not mappings:
        return NO_HINT
    allowed = {m.competitor_route_number: m.competitor_destination for m in mappings}

    # 3. Scan live vehicles and classify as ahead / behind
    all_vehicles = _get_cached_units()
    rivals_ahead: list[tuple[float, dict]] = []   # (dist_m, vehicle)
    rivals_behind: list[tuple[float, float, float, dict]] = []  # (dist_m, gap_s, r_spd_kmh, v)

    for v in all_vehicles:
        mr_num = str(v.get("mr_num", "")).strip()
        if mr_num not in allowed:
            continue
        last_st = str(v.get("rl_laststation_title", "") or "").strip()
        if last_st != allowed[mr_num]:
            continue

        r_lat = float(v.get("u_lat", 0) or 0)
        r_lng = float(v.get("u_long", 0) or 0)
        r_spd_kmh = float(v.get("u_speed", 0) or 0)
        r_spd_ms = max(r_spd_kmh / 3.6, 1.0)
        if not r_lat or not r_lng:
            continue

        r_idx, _ = _nearest_stop_idx(r_lat, r_lng, our_stops)

        if r_idx > our_idx:
            # Rival is ahead on our stop sequence
            dist = _route_dist_m(our_idx, r_idx, our_stops)
            rivals_ahead.append((dist, v))

        elif r_idx < our_idx:
            # Rival is behind — find next conflict: next stop ahead of us both
            conflict_idx = min(our_idx + 1, len(our_stops) - 1)

            # Our ETA to conflict stop
            our_dist_to_conf = _route_dist_m(our_idx, conflict_idx, our_stops)
            our_eta = our_dist_to_conf / our_spd_ms

            # Rival ETA to conflict stop (straight-line from their position)
            r_dist_to_conf = _haversine_m(
                r_lat, r_lng,
                our_stops[conflict_idx]["st_lat"], our_stops[conflict_idx]["st_lng"],
            )
            r_eta = r_dist_to_conf / r_spd_ms

            gap_s = r_eta - our_eta           # positive = we arrive first
            dist_behind = _route_dist_m(r_idx, our_idx, our_stops)
            rivals_behind.append((dist_behind, gap_s, r_spd_kmh, v))

    rivals_ahead.sort(key=lambda x: x[0])
    rivals_behind.sort(key=lambda x: x[0])

    nearest_ahead = rivals_ahead[0] if rivals_ahead else None
    nearest_behind = rivals_behind[0] if rivals_behind else None

    # ── Decision logic ────────────────────────────────────────────
    AHEAD_DANGER_M   = 800    # rival ahead within this distance is a threat
    BEHIND_DANGER_M  = 2000   # rival behind within this distance matters
    GAP_TIGHT_S      = 60     # less than this → rival behind is threatening
    GAP_RACE_S       = 120    # can try to widen gap if less than this

    hint_type = "none"
    message: str | None = None
    ahead_info: schemas.HintRival | None = None
    behind_info: schemas.HintRival | None = None

    # Helper
    def _plate(v: dict) -> str | None:
        p = str(v.get("u_statenum", "") or "").strip()
        return p if p else None

    # -- Ahead rival handling --
    if nearest_ahead:
        dist_m, v = nearest_ahead
        mr = str(v.get("mr_num", ""))
        ahead_info = schemas.HintRival(route=mr, plate=_plate(v), distance_m=int(dist_m))

        if dist_m <= AHEAD_DANGER_M:
            # Check whether slowing is safe given rival behind
            behind_ok = (
                not nearest_behind
                or nearest_behind[0] > BEHIND_DANGER_M
                or nearest_behind[1] > GAP_TIGHT_S * 2  # big comfortable gap behind
            )
            if behind_ok:
                hint_type = "slow_down"
                message = (
                    f"Маршрут {mr} в {int(dist_m)} м впереди — "
                    f"замедлитесь, пропустите его вперёд"
                )
            else:
                # Ahead close AND behind threatening → hold speed
                bm = str(nearest_behind[3].get("mr_num", ""))
                hint_type = "maintain"
                message = (
                    f"Маршрут {mr} в {int(dist_m)} м впереди, "
                    f"маршрут {bm} настигает сзади — держите скорость"
                )

    # -- Behind rival handling (only when no dangerous rival ahead) --
    if nearest_behind and (not nearest_ahead or nearest_ahead[0] > AHEAD_DANGER_M):
        dist_m, gap_s, r_spd_kmh, v = nearest_behind
        mr = str(v.get("mr_num", ""))
        behind_info = schemas.HintRival(
            route=mr, plate=_plate(v),
            distance_m=int(dist_m), gap_s=int(gap_s)
        )

        if dist_m <= BEHIND_DANGER_M:
            if gap_s < 0:
                # Rival arrives at next conflict stop before us
                hint_type = "slow_down"
                message = (
                    f"Маршрут {mr} в {int(dist_m)} м сзади и опередит вас "
                    f"на следующей остановке на {int(-gap_s)} с — "
                    f"сбросьте скорость и пропустите"
                )
            elif gap_s <= GAP_TIGHT_S:
                # We arrive first, but barely — speed up to widen gap
                if our_speed < 50:   # only suggest if not already fast
                    hint_type = "speed_up"
                    message = (
                        f"Маршрут {mr} в {int(dist_m)} м сзади — "
                        f"вы опередите его на {int(gap_s)} с. "
                        f"Ускорьтесь, чтобы увеличить отрыв"
                    )
                else:
                    hint_type = "maintain"
                    message = (
                        f"Маршрут {mr} в {int(dist_m)} м сзади — "
                        f"вы опережаете на {int(gap_s)} с. Держите скорость"
                    )
            elif gap_s <= GAP_RACE_S:
                hint_type = "maintain"
                message = (
                    f"Маршрут {mr} в {int(dist_m)} м сзади — "
                    f"вы опережаете на {int(gap_s)} с. Всё хорошо"
                )
            # gap > GAP_RACE_S — no hint needed, comfortable lead

    # Always return a meaningful status
    if hint_type == "none":
        if not mappings:
            message = "Конкурентные маршруты не настроены"
        elif not all_vehicles:
            message = "Нет данных о транспорте"
        elif not rivals_ahead and not rivals_behind:
            message = "Конкурентов поблизости нет — ситуация спокойная"
        else:
            # rivals exist but outside danger zones — show nearest info
            hint_type = "maintain"
            parts = []
            if nearest_ahead:
                parts.append(f"маршрут {nearest_ahead[1].get('mr_num','')} в {int(nearest_ahead[0])} м впереди")
            if nearest_behind:
                parts.append(f"маршрут {nearest_behind[3].get('mr_num','')} в {int(nearest_behind[0])} м сзади")
            message = "Конкурентная ситуация стабильная: " + ", ".join(parts)

    return schemas.HintOut(
        type=hint_type,
        message=message,
        ahead=ahead_info,
        behind=behind_info,
    )


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
