"""
graph_manager.py
Loads the Mumbai road network from OpenStreetMap (osmnx) and caches it to disk.
Falls back to a handcrafted 18-node synthetic graph if osmnx is unavailable.

Public interface is identical to the pre-OSM version so no other file needs changes.
"""

import os
import math
import pickle
import networkx as nx

# ---------------------------------------------------------------------------
# OSM bounding box - Andheri-Kurla corridor
# ---------------------------------------------------------------------------
OSM_NORTH = 19.130
OSM_SOUTH = 19.060
OSM_EAST  = 72.880
OSM_WEST  = 72.830

CACHE_PATH = os.path.join(os.path.dirname(__file__), "mumbai_graph.gpickle")

# Flood-prone coordinate clusters (lat, lng, label)
FLOOD_ZONES = [
    (19.0728, 72.8826, "Kurla"),
    (19.1147, 72.8679, "Andheri East"),
    (19.0402, 72.8553, "Dharavi"),
]
FLOOD_RISK_RADIUS_DEG = 0.012   # ~1.3 km at Mumbai latitude
EDGE_FLOOD_RADIUS_DEG = 0.022   # lets corridor edges inherit nearby flood exposure


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _flood_risk_base(lat, lng):
    """Return 0.0-1.0 flood risk base for a node coordinate."""
    for flat, flng, _ in FLOOD_ZONES:
        dist = math.sqrt((lat - flat) ** 2 + (lng - flng) ** 2)
        if dist < FLOOD_RISK_RADIUS_DEG:
            return 0.6
    return 0.0


def _point_to_segment_distance_deg(px, py, ax, ay, bx, by):
    abx = bx - ax
    aby = by - ay
    if abx == 0 and aby == 0:
        return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)

    t = ((px - ax) * abx + (py - ay) * aby) / (abx ** 2 + aby ** 2)
    t = max(0.0, min(1.0, t))
    closest_x = ax + abx * t
    closest_y = ay + aby * t
    return math.sqrt((px - closest_x) ** 2 + (py - closest_y) ** 2)


def _edge_flood_risk_base(start_lat, start_lng, end_lat, end_lng):
    max_risk = max(
        _flood_risk_base(start_lat, start_lng),
        _flood_risk_base(end_lat, end_lng),
    )
    for flat, flng, _ in FLOOD_ZONES:
        dist = _point_to_segment_distance_deg(flat, flng, start_lat, start_lng, end_lat, end_lng)
        if dist < EDGE_FLOOD_RADIUS_DEG:
            proximity = 1.0 - (dist / EDGE_FLOOD_RADIUS_DEG)
            max_risk = max(max_risk, round(0.25 + proximity * 0.75, 3))
    return min(1.0, max_risk)


# ---------------------------------------------------------------------------
# Named anchor nodes - keep same letters as synthetic graph so simulator works
# ---------------------------------------------------------------------------
ANCHOR_NODES = {
    "A": (19.1197, 72.8464),  # Andheri Station
    "B": (19.1170, 72.8420),  # SV Road Junction
    "C": (19.1240, 72.8310),  # DN Nagar
    "D": (19.1130, 72.8320),  # Juhu Circle
    "E": (19.1020, 72.8360),  # Vile Parle West
    "F": (19.1150, 72.8550),  # WEH Hub
    "G": (19.0658, 72.8643),  # Bandra Kurla Complex
    "H": (19.0544, 72.8402),  # Bandra Station
    "I": (19.0402, 72.8553),  # Dharavi
    "J": (19.0178, 72.8437),  # Dadar TT
    "K": (19.0060, 72.8131),  # Worli Naka
    "L": (18.9950, 72.8270),  # Lower Parel
    "M": (18.9818, 72.8159),  # Mahalaxmi Race Course
    "N": (18.9696, 72.8193),  # Mumbai Central
    "O": (18.9440, 72.8242),  # Marine Drive
    "P": (18.9322, 72.8264),  # Churchgate
    "Q": (18.9398, 72.8354),  # CSMT
    "R": (18.9174, 72.8258),  # Colaba Causeway
}

ANCHOR_NAMES = {
    "A": "Andheri Station",
    "B": "SV Road Junction",
    "C": "DN Nagar",
    "D": "Juhu Circle",
    "E": "Vile Parle West",
    "F": "WEH Hub",
    "G": "Bandra Kurla Complex",
    "H": "Bandra Station",
    "I": "Dharavi",
    "J": "Dadar TT",
    "K": "Worli Naka",
    "L": "Lower Parel",
    "M": "Mahalaxmi Race Course",
    "N": "Mumbai Central",
    "O": "Marine Drive",
    "P": "Churchgate",
    "Q": "CSMT",
    "R": "Colaba Causeway",
}


class GraphManager:
    def __init__(self):
        self.graph = nx.Graph()
        self.graph_source = "synthetic"  # overridden if OSM loads
        self._build_graph()

    # ------------------------------------------------------------------
    # Graph construction
    # ------------------------------------------------------------------

    def _build_graph(self):
        """Try OSM -> cache -> synthetic, in that order."""
        if self._try_load_osm_cache():
            return
        if self._try_fetch_osm():
            return
        self._build_synthetic_graph()

    def _try_load_osm_cache(self):
        if not os.path.exists(CACHE_PATH):
            return False
        try:
            with open(CACHE_PATH, "rb") as f:
                raw_g = pickle.load(f)
            self._convert_osm_to_named(raw_g)
            self.graph_source = "osm"
            print("[GraphManager] OSM graph loaded from cache.")
            return True
        except Exception as exc:
            print(f"[GraphManager] Cache load failed: {exc}")
            self._remove_invalid_cache()
            return False

    def _remove_invalid_cache(self):
        try:
            os.remove(CACHE_PATH)
            print("[GraphManager] Removed incompatible OSM cache. A fresh cache will be rebuilt.")
        except FileNotFoundError:
            pass
        except OSError as exc:
            print(f"[GraphManager] Failed to remove invalid cache: {exc}")

    def _try_fetch_osm(self):
        try:
            import osmnx as ox
            print("[GraphManager] Fetching OSM road network (Andheri-Kurla)...")
            # osmnx >= 2.0: bbox=(left, bottom, right, top) = (west, south, east, north)
            bbox = (OSM_WEST, OSM_SOUTH, OSM_EAST, OSM_NORTH)
            raw_g = ox.graph_from_bbox(
                bbox,
                network_type="drive",
                simplify=True,
            )
            # Convert directed MultiDiGraph to undirected Graph
            try:
                raw_g = ox.convert.to_undirected(raw_g)
            except Exception:
                import networkx as _nx
                raw_g = _nx.Graph(raw_g)
            with open(CACHE_PATH, "wb") as f:
                pickle.dump(raw_g, f)
            self._convert_osm_to_named(raw_g)
            self.graph_source = "osm"
            print(f"[GraphManager] OSM graph fetched and cached ({len(self.graph.nodes())} named nodes).")
            return True
        except Exception as exc:
            print(f"[GraphManager] OSM fetch failed: {exc}. Falling back to synthetic graph.")
            return False

    def _convert_osm_to_named(self, osm_g):
        """
        Map OSM integer node IDs to the 18 letter-named anchor nodes via
        nearest-neighbour lookup so the rest of the codebase is unaffected.
        """
        self.graph = nx.Graph()

        # Build letter-node to OSM-node mapping
        osm_nodes = list(osm_g.nodes(data=True))
        letter_to_osm = {}
        for letter, (alat, alng) in ANCHOR_NODES.items():
            best_dist = float("inf")
            best_osm = None
            for osm_id, attrs in osm_nodes:
                olat = attrs.get("y", 0)
                olng = attrs.get("x", 0)
                d = math.sqrt((alat - olat) ** 2 + (alng - olng) ** 2)
                if d < best_dist:
                    best_dist = d
                    best_osm = osm_id
            letter_to_osm[letter] = best_osm

        osm_to_letter = {v: k for k, v in letter_to_osm.items()}

        # Add named nodes
        for letter, osm_id in letter_to_osm.items():
            alat, alng = ANCHOR_NODES[letter]
            frb = _flood_risk_base(alat, alng)
            self.graph.add_node(letter,
                name=ANCHOR_NAMES[letter],
                lat=alat,
                lng=alng,
                flood_risk_base=frb,
                flood_risk_current=frb)

        # Add edges that connect any two named anchor nodes through the OSM graph
        for u_letter, u_osm in letter_to_osm.items():
            for v_letter, v_osm in letter_to_osm.items():
                if u_letter >= v_letter:
                    continue
                if self.graph.has_edge(u_letter, v_letter):
                    continue
                try:
                    length_m = nx.shortest_path_length(osm_g, u_osm, v_osm, weight="length")
                    # Convert metres to minutes at 30 km/h
                    travel_min = round((length_m / 1000.0) / 30.0 * 60.0, 1)
                    # Only add edges for adjacent-ish nodes
                    if travel_min <= 40:
                        edge_flood_risk = _edge_flood_risk_base(
                            ANCHOR_NODES[u_letter][0],
                            ANCHOR_NODES[u_letter][1],
                            ANCHOR_NODES[v_letter][0],
                            ANCHOR_NODES[v_letter][1],
                        )
                        self.graph.add_edge(u_letter, v_letter,
                            weight=travel_min,
                            base_weight=travel_min,
                            distance_m=round(length_m, 0),
                            current_risk=0.0,
                            flood_risk_base=edge_flood_risk,
                            speed_kmh=30)
                except Exception:
                    pass

        # Ensure the graph is connected; add synthetic fallback edges if needed
        self._ensure_connectivity()

    def _ensure_connectivity(self):
        """
        Add lightweight synthetic edges between disconnected components so
        routing always finds a path between any two named nodes.
        """
        SYNTHETIC_EDGES = [
            ("A", "B", 5), ("B", "C", 8), ("B", "D", 6),
            ("C", "D", 7), ("D", "E", 5), ("A", "F", 6), ("F", "E", 15),
            ("F", "G", 18), ("E", "H", 12),
            ("G", "H", 8), ("G", "I", 10), ("H", "I", 8),
            ("I", "J", 15), ("H", "K", 20), ("J", "L", 10), ("K", "L", 6),
            ("L", "M", 5), ("J", "N", 12), ("M", "N", 8),
            ("M", "O", 15), ("N", "Q", 12), ("O", "P", 5),
            ("P", "Q", 4), ("P", "R", 10), ("Q", "R", 12),
        ]
        for u, v, w in SYNTHETIC_EDGES:
            if not self.graph.has_edge(u, v):
                edge_flood_risk = _edge_flood_risk_base(
                    ANCHOR_NODES[u][0],
                    ANCHOR_NODES[u][1],
                    ANCHOR_NODES[v][0],
                    ANCHOR_NODES[v][1],
                )
                self.graph.add_edge(u, v,
                    weight=w,
                    base_weight=w,
                    distance_m=w * 500,
                    current_risk=0.0,
                    flood_risk_base=edge_flood_risk,
                    speed_kmh=30)
        # Set flood_risk_base on any nodes added implicitly
        for n in self.graph.nodes():
            if "flood_risk_base" not in self.graph.nodes[n]:
                alat, alng = ANCHOR_NODES.get(n, (0, 0))
                frb = _flood_risk_base(alat, alng)
                self.graph.nodes[n]["flood_risk_base"] = frb
                self.graph.nodes[n]["flood_risk_current"] = frb

    def _build_synthetic_graph(self):
        """Original 18-node synthetic Mumbai graph - offline fallback."""
        self.graph_source = "synthetic"
        for letter, (lat, lng) in ANCHOR_NODES.items():
            frb = _flood_risk_base(lat, lng)
            self.graph.add_node(letter,
                name=ANCHOR_NAMES[letter],
                lat=lat,
                lng=lng,
                flood_risk_base=frb,
                flood_risk_current=frb)

        edges = [
            ("A", "B", 5),  ("B", "C", 8),  ("B", "D", 6),
            ("C", "D", 7),  ("D", "E", 5),  ("A", "F", 6),  ("F", "E", 15),
            ("F", "G", 18), ("E", "H", 12),
            ("G", "H", 8),  ("G", "I", 10), ("H", "I", 8),
            ("I", "J", 15), ("H", "K", 20), ("J", "L", 10), ("K", "L", 6),
            ("L", "M", 5),  ("J", "N", 12), ("M", "N", 8),
            ("M", "O", 15), ("N", "Q", 12), ("O", "P", 5),
            ("P", "Q", 4),  ("P", "R", 10), ("Q", "R", 12),
        ]
        for u, v, w in edges:
            edge_flood_risk = _edge_flood_risk_base(
                ANCHOR_NODES[u][0],
                ANCHOR_NODES[u][1],
                ANCHOR_NODES[v][0],
                ANCHOR_NODES[v][1],
            )
            self.graph.add_edge(u, v,
                weight=w,
                base_weight=w,
                distance_m=w * 500,
                current_risk=0.0,
                flood_risk_base=edge_flood_risk,
                speed_kmh=30)
        print("[GraphManager] Synthetic 18-node graph loaded (offline fallback).")

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def get_nodes(self):
        return {n: dict(self.graph.nodes[n]) for n in self.graph.nodes()}

    def get_node(self, node_id):
        return dict(self.graph.nodes[node_id]) if node_id in self.graph.nodes else None

    def resolve_node_id(self, value):
        if not value:
            return None
        if value in self.graph.nodes:
            return value

        normalized = str(value).strip().lower()
        for node_id, attrs in self.graph.nodes(data=True):
            if attrs.get("name", "").strip().lower() == normalized:
                return node_id
        return None

    def extract_subgraph_nodes(self, selected_node_ids):
        if not selected_node_ids:
            return list(self.graph.nodes())
        valid = [n for n in selected_node_ids if n in self.graph.nodes()]
        if not valid:
            return list(self.graph.nodes())
        lats = [self.graph.nodes[n]["lat"] for n in valid]
        lngs = [self.graph.nodes[n]["lng"] for n in valid]
        min_lat, max_lat = min(lats) - 0.05, max(lats) + 0.05
        min_lng, max_lng = min(lngs) - 0.05, max(lngs) + 0.05
        return [
            n for n in self.graph.nodes()
            if min_lat <= self.graph.nodes[n]["lat"] <= max_lat
            and min_lng <= self.graph.nodes[n]["lng"] <= max_lng
        ]

    def extract_subgraph_edges(self, valid_nodes):
        result = []
        node_set = set(valid_nodes)
        for u, v, data in self.graph.edges(data=True):
            if u in node_set and v in node_set:
                node_risk = max(
                    self.graph.nodes[u].get("flood_risk_current", 0.0),
                    self.graph.nodes[v].get("flood_risk_current", 0.0),
                )
                flood_risk = max(
                    float(data.get("current_risk", 0.0)),
                    float(data.get("flood_risk_base", 0.0)) * 100.0,
                    float(node_risk) * 100.0,
                )
                result.append({
                    "source": u,
                    "target": v,
                    "weight": data["weight"],
                    "base_weight": data["base_weight"],
                    "risk": round(flood_risk, 2),
                })
        return result

    def get_edges(self):
        return self.extract_subgraph_edges(list(self.graph.nodes()))

    def get_edge_details(self, source, target):
        if not self.graph.has_edge(source, target):
            return None
        data = self.graph[source][target]
        return {
            "source": source,
            "target": target,
            "distance_m": float(data.get("distance_m", data.get("base_weight", 0) * 500)),
            "base_weight": float(data.get("base_weight", data.get("weight", 0))),
            "weight": float(data.get("weight", data.get("base_weight", 0))),
            "risk": float(max(
                data.get("current_risk", 0.0),
                data.get("flood_risk_base", 0.0) * 100.0,
                self.graph.nodes[source].get("flood_risk_current", 0.0) * 100.0,
                self.graph.nodes[target].get("flood_risk_current", 0.0) * 100.0,
            )),
            "speed_kmh": float(data.get("speed_kmh", 30.0)),
        }

    def path_to_coordinates(self, path):
        coordinates = []
        for node_id in path:
            node = self.get_node(node_id)
            if not node:
                continue
            coordinates.append({
                "node": node_id,
                "name": node.get("name", node_id),
                "lat": float(node["lat"]),
                "lng": float(node["lng"]),
            })
        return coordinates

    def get_baseline_route(self, start, end, stops=None):
        stops = stops or []
        import itertools

        if start not in self.graph or end not in self.graph:
            return [], float("inf")

        if not stops:
            try:
                path = nx.dijkstra_path(self.graph, start, end, weight="base_weight")
                dist = nx.dijkstra_path_length(self.graph, start, end, weight="base_weight")
                return path, dist
            except nx.NetworkXNoPath:
                return [], float("inf")

        best_cost = float("inf")
        best_path = []
        stop_ids = [s["id"] for s in stops if s["id"] in self.graph]

        for perm in itertools.permutations(stop_ids):
            seq = [start] + list(perm) + [end]
            current_path, current_cost, valid = [], 0, True
            for i in range(len(seq) - 1):
                try:
                    seg = nx.dijkstra_path(self.graph, seq[i], seq[i + 1], weight="base_weight")
                    seg_cost = nx.dijkstra_path_length(self.graph, seq[i], seq[i + 1], weight="base_weight")
                    if i > 0:
                        seg = seg[1:]
                    current_path.extend(seg)
                    current_cost += seg_cost
                except nx.NetworkXNoPath:
                    valid = False
                    break
            if valid and current_cost < best_cost:
                best_cost = current_cost
                best_path = current_path

        return (best_path, best_cost) if best_cost < float("inf") else ([], float("inf"))

    def apply_event(self, edge, risk_factor, additional_time):
        u, v = edge
        if self.graph.has_edge(u, v):
            self.graph[u][v]["current_risk"] = risk_factor
            self.graph[u][v]["weight"] = self.graph[u][v]["base_weight"] + additional_time

    def reset_graph(self):
        for u, v in self.graph.edges():
            self.graph[u][v]["current_risk"] = 0.0
            self.graph[u][v]["weight"] = self.graph[u][v]["base_weight"]

    def boost_flood_nodes(self, boost=0.4):
        """
        Synchronise flood_risk_current with the current rain intensity.
        This keeps the risk signal stable across ticks instead of
        compounding indefinitely while the weather remains unchanged.
        """
        for n, data in self.graph.nodes(data=True):
            base = data.get("flood_risk_base", 0.0)
            weather_boost = boost if base > 0 else 0.0
            self.graph.nodes[n]["flood_risk_current"] = min(1.0, base + weather_boost)

    def sync_weather_risk(self, rain_intensity):
        weather_boost = 0.0
        if rain_intensity > 0.6:
            weather_boost = 0.4
        elif rain_intensity > 0.2:
            weather_boost = 0.2

        for n, data in self.graph.nodes(data=True):
            base = data.get("flood_risk_base", 0.0)
            self.graph.nodes[n]["flood_risk_current"] = min(1.0, base + (weather_boost if base > 0 else 0.0))

        for _, _, data in self.graph.edges(data=True):
            edge_base = float(data.get("flood_risk_base", 0.0)) * 100.0
            data["current_risk"] = round(min(100.0, edge_base + weather_boost * 60.0), 2)
