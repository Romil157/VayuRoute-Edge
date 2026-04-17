import torch
import torch.nn as nn
import networkx as nx
import itertools

class RoutingAgent:
    def get_ai_route(self, predicted_edges, start, end, stops=None):
        stops = stops or []
        G = nx.Graph()
        
        # Build dynamic cost graph with baseline risk data structure
        for p in predicted_edges:
            G.add_edge(p["source"], p["target"], weight=p["weight"], raw_time=p["weight"], risk=p["risk"])
            
        def calculate_segment(u, v):
            # We compute pure Dijkstra on raw predicted time to find sequence viability. 
            # Sub-graph permutations will evaluate risk dynamically.
            try:
                path = nx.dijkstra_path(G, u, v, weight='raw_time')
                t_time = 0
                m_risk = 0
                for i in range(len(path)-1):
                    n1, n2 = path[i], path[i+1]
                    edge_data = G[n1][n2]
                    t_time += edge_data["raw_time"]
                    if edge_data["risk"] > m_risk:
                        m_risk = edge_data["risk"]
                return path, t_time, m_risk
            except nx.NetworkXNoPath:
                return None, float('inf'), 0

        # Sub-routine for direct routing (no stops)
        if not stops:
            path, t_time, m_risk = calculate_segment(start, end)
            if not path:
                return {"optimal": {"path": [], "time": 0, "risk": 0}, "alternatives": [], "cost_function": {}}
            conf = max(15, min(99, 100 - m_risk))
            base_res = {
                "path": path, "time": t_time, "risk": m_risk, "confidence": conf, "reason": "Optimal direct route."
            }
            cf = {"Time": t_time, "Risk": m_risk, "Fuel": int(t_time * 0.2), "Priority": 0}
            return {"optimal": base_res, "alternatives": [], "cost_function": cf}

        # Multi-stop / TSP Alternative Arrays Output
        stop_ids = [s["id"] for s in stops]
        stop_data_map = {s["id"]: s for s in stops}
        
        valid_permutations = []
        
        for perm in itertools.permutations(stop_ids):
            seq = [start] + list(perm) + [end]
            current_path = []
            current_time = 0
            current_max_risk = 0
            valid = True
            
            for i in range(len(seq) - 1):
                seg_path, seg_time, seg_risk = calculate_segment(seq[i], seq[i+1])
                if not seg_path:
                    valid = False
                    break
                
                if seg_risk > current_max_risk:
                    current_max_risk = seg_risk
                
                current_time += seg_time
                if i > 0:
                    seg_path = seg_path[1:]
                current_path.extend(seg_path)
                
            if valid:
                # Calculate Logistics Constraints Sub-Formula
                # Fuel is roughly 0.2 units / min
                f_cost = int(current_time * 0.2)
                
                # Priority Weighting
                p_cost = 0
                for s in stops:
                    if s["priority"] == "High" and current_time > 45: 
                        p_cost += 15 # Heavy penalty if high priority path sequence takes longer
                    if s["priority"] == "Medium" and current_time > 60:
                        p_cost += 5
                
                # Risk Constraint Multipliers
                r_cost = current_max_risk * 1.5 if current_max_risk > 50 else current_max_risk
                
                total_cost = current_time + r_cost + f_cost + p_cost
                
                conf = max(15, min(99, 100 - current_max_risk))
                
                valid_permutations.append({
                    "path": current_path,
                    "time": current_time,
                    "risk": current_max_risk,
                    "confidence": conf,
                    "cost_function": {"score": total_cost, "Time": current_time, "Risk": int(r_cost), "Fuel": f_cost, "Priority": p_cost}
                })

        if not valid_permutations:
            return {"optimal": {"path": [], "time": 0, "risk": 0}, "alternatives": [], "cost_function": {}}

        # Categorize the Alternatives
        # Sort by mathematical optimal first
        valid_permutations.sort(key=lambda x: x["cost_function"]["score"])
        
        optimal = dict(valid_permutations[0])
        optimal["reason"] = "Logistics equilibrium selected (Balanced limits)."
        
        # Sort by absolute lowest time
        fastest_list = sorted(valid_permutations, key=lambda x: x["time"])
        fastest = dict(fastest_list[0])
        fastest["reason"] = "Rejected: Dangerously high risk exposure."
        
        # Sort by absolute lowest risk
        safest_list = sorted(valid_permutations, key=lambda x: x["risk"])
        safest = dict(safest_list[0])
        safest["reason"] = "Rejected: Massive time delay limits SLAs."
        
        # De-duplicate alternatives logic
        alternatives = []
        if fastest["path"] != optimal["path"]:
            faster_alt = dict(fastest)
            faster_alt["type"] = "Faster but Risky"
            alternatives.append(faster_alt)

        if safest["path"] != optimal["path"] and safest["path"] != fastest["path"]:
            safer_alt = dict(safest)
            safer_alt["type"] = "Slower but Safest"
            alternatives.append(safer_alt)

        # Generate output dictionary
        return {
            "optimal": optimal,
            "alternatives": alternatives,
            "cost_function": optimal["cost_function"]
        }
