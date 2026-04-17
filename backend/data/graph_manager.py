import networkx as nx
import math

class GraphManager:
    def __init__(self):
        self.graph = nx.Graph()
        self._build_mumbai_graph()

    def _build_mumbai_graph(self):
        # Extended 18 Node Mumbai Graph
        nodes = {
            "A": {"name": "Andheri Station", "lat": 19.1197, "lng": 72.8464},
            "B": {"name": "SV Road Junction", "lat": 19.1170, "lng": 72.8420},
            "C": {"name": "DN Nagar", "lat": 19.1240, "lng": 72.8310},
            "D": {"name": "Juhu Circle", "lat": 19.1130, "lng": 72.8320},
            "E": {"name": "Vile Parle West", "lat": 19.1020, "lng": 72.8360},
            "F": {"name": "WEH Hub", "lat": 19.1150, "lng": 72.8550},
            "G": {"name": "Bandra Kurla Complex", "lat": 19.0658, "lng": 72.8643},
            "H": {"name": "Bandra Station", "lat": 19.0544, "lng": 72.8402},
            "I": {"name": "Dharavi", "lat": 19.0402, "lng": 72.8553},
            "J": {"name": "Dadar TT", "lat": 19.0178, "lng": 72.8437},
            "K": {"name": "Worli Naka", "lat": 19.0060, "lng": 72.8131},
            "L": {"name": "Lower Parel", "lat": 18.9950, "lng": 72.8270},
            "M": {"name": "Mahalaxmi Race Course", "lat": 18.9818, "lng": 72.8159},
            "N": {"name": "Mumbai Central", "lat": 18.9696, "lng": 72.8193},
            "O": {"name": "Marine Drive", "lat": 18.9440, "lng": 72.8242},
            "P": {"name": "Churchgate", "lat": 18.9322, "lng": 72.8264},
            "Q": {"name": "CSMT", "lat": 18.9398, "lng": 72.8354},
            "R": {"name": "Colaba Causeway", "lat": 18.9174, "lng": 72.8258}
        }
        
        for n_id, attrs in nodes.items():
            self.graph.add_node(n_id, **attrs)

        # Base edges spanning Andheri -> Colaba
        edges = [
            # Andheri sub-graph
            ("A", "B", 5), ("B", "C", 8), ("B", "D", 6), 
            ("C", "D", 7), ("D", "E", 5), ("A", "F", 6), ("F", "E", 15),
            # Bridges
            ("F", "G", 18), ("E", "H", 12),
            # BKC / Bandra / Dharavi
            ("G", "H", 8), ("G", "I", 10), ("H", "I", 8),
            # Dadar / Worli
            ("I", "J", 15), ("H", "K", 20), ("J", "L", 10), ("K", "L", 6),
            # South Mumbai
            ("L", "M", 5), ("J", "N", 12), ("M", "N", 8),
            ("M", "O", 15), ("N", "Q", 12), ("O", "P", 5),
            ("P", "Q", 4), ("P", "R", 10), ("Q", "R", 12)
        ]
        
        for u, v, w in edges:
            self.graph.add_edge(u, v, weight=w, base_weight=w, current_risk=0)
            
    def get_nodes(self):
        return {n: self.graph.nodes[n] for n in self.graph.nodes()}

    def extract_subgraph_nodes(self, selected_node_ids):
        # Compute a bounding box based on selected nodes + buffer
        if not selected_node_ids:
            return list(self.graph.nodes())
            
        lats = [self.graph.nodes[n]["lat"] for n in selected_node_ids]
        lngs = [self.graph.nodes[n]["lng"] for n in selected_node_ids]
        
        min_lat, max_lat = min(lats) - 0.05, max(lats) + 0.05
        min_lng, max_lng = min(lngs) - 0.05, max(lngs) + 0.05
        
        valid_nodes = []
        for n in self.graph.nodes():
            n_data = self.graph.nodes[n]
            if min_lat <= n_data["lat"] <= max_lat and min_lng <= n_data["lng"] <= max_lng:
                valid_nodes.append(n)
        return valid_nodes

    def extract_subgraph_edges(self, valid_nodes):
        result = []
        for u, v, data in self.graph.edges(data=True):
            if u in valid_nodes and v in valid_nodes:
                result.append({
                    "source": u,
                    "target": v,
                    "weight": data["weight"],
                    "base_weight": data["base_weight"],
                    "risk": data["current_risk"]
                })
        return result
        
    def get_edges(self):
        return self.extract_subgraph_edges(list(self.graph.nodes()))

    def get_baseline_route(self, start, end, stops=None):
        stops = stops or []
        import itertools
        
        if not stops:
            try:
                path = nx.dijkstra_path(self.graph, start, end, weight='base_weight')
                distance = nx.dijkstra_path_length(self.graph, start, end, weight='base_weight')
                return path, distance
            except nx.NetworkXNoPath:
                return [], float('inf')
        
        # Calculate optimal sequential routing through multiple stops for baseline
        best_cost = float('inf')
        best_path = []
        stop_ids = [s["id"] for s in stops]
        
        for perm in itertools.permutations(stop_ids):
            seq = [start] + list(perm) + [end]
            current_path = []
            current_cost = 0
            valid = True
            
            for i in range(len(seq) - 1):
                try:
                    seg_path = nx.dijkstra_path(self.graph, seq[i], seq[i+1], weight='base_weight')
                    seg_cost = nx.dijkstra_path_length(self.graph, seq[i], seq[i+1], weight='base_weight')
                    if i > 0:
                        seg_path = seg_path[1:]
                    current_path.extend(seg_path)
                    current_cost += seg_cost
                except nx.NetworkXNoPath:
                    valid = False
                    break
                    
            if valid and current_cost < best_cost:
                best_cost = current_cost
                best_path = current_path
                
        if best_cost == float('inf'):
             return [], float('inf')
             
        return best_path, best_cost
            
    def apply_event(self, edge, risk_factor, additional_time):
        u, v = edge
        if self.graph.has_edge(u, v):
            self.graph[u][v]['current_risk'] = risk_factor
            self.graph[u][v]['weight'] = self.graph[u][v]['base_weight'] + additional_time

    def reset_graph(self):
        for u, v in self.graph.edges():
            self.graph[u][v]['current_risk'] = 0
            self.graph[u][v]['weight'] = self.graph[u][v]['base_weight']

