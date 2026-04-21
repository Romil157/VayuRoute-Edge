import pandas as pd
from collections import defaultdict
import random
import numpy as np
import time
from numba import njit

# Box and Truck Definitions
# dimension in meter
BOX_TYPES = {
    "b1": {"length": 0.4, "width": 0.4, "height": 0.3},
    "b2": {"length": 0.4, "width": 0.4, "height": 0.4},
    "b3": {"length": 0.6, "width": 0.4, "height": 0.6},
    "b4": {"length": 0.8, "width": 0.8, "height": 0.8},
}

TRUCKS = [
    {
        "name": "12-ft Truck",
        "length": 3.66,
        "width": 2.0,
        "height": 2.0,
        "max_weight": 3000,
        "count": 0,
    },
    {
        "name": "24-ft Truck",
        "length": 7.32,
        "width": 2.44,
        "height": 2.6,
        "max_weight": 8000,
        "count": 1,
    },
    {
        "name": "32-ft Truck",
        "length": 9.75,
        "width": 2.44,
        "height": 2.6,
        "max_weight": 10000,
        "count": 0,
    },
]

min_width = min(BOX_TYPES[b]["width"] for b in BOX_TYPES)
min_length = min(BOX_TYPES[b]["length"] for b in BOX_TYPES)

STEP_X = min_width   # 0.05
STEP_Y = round(min_length /2, 4)  # 0.09 or 0.1
STEP_Z = 0.1


def read_boxes_from_csv(path):
    df = pd.read_csv(path)
    df[["length", "width", "height"]] = df["box_type"].apply(
        lambda bt: pd.Series(BOX_TYPES[bt])
    )
    df["box_number"] = df.groupby("customer_name").cumcount() + 1
    return df.to_dict("records")


def create_truck_fleet():
    fleet = []
    for truck_def in TRUCKS:
        for _ in range(truck_def["count"]):
            fleet.append(
                {
                    "name": truck_def["name"],
                    "length": truck_def["length"],
                    "width": truck_def["width"],
                    "height": truck_def["height"],
                    "volume": truck_def["length"]
                    * truck_def["width"]
                    * truck_def["height"],
                    "max_weight": truck_def["max_weight"],
                    "boxes": [],
                    "weight": 0.0,
                    "used_volume": 0.0,
                }
            )
    return fleet

# @njit
def can_place(new_box, pos, placed_boxes, epsilon=0.001):
    nx, ny, nz = pos["x"], pos["y"], pos["z"]
    nw, nl, nh = new_box["width"], new_box["length"], new_box["height"]

    for box in placed_boxes:
        bx, by, bz = box["position"]["x"], box["position"]["y"], box["position"]["z"]
        bw, bl, bh = box["width"], box["length"], box["height"]

        if not (
            nx + nw <= bx + epsilon
            or bx + bw <= nx + epsilon
            or ny + nl <= by + epsilon
            or by + bl <= ny + epsilon
            or nz + nh <= bz + epsilon
            or bz + bh <= nz + epsilon
        ):
            return False
    return True


def is_supported_priority_aware(pos, size, placed_boxes, current_priority):
    if pos["z"] == 0:
        return True
    support_area = 0
    box_area = size["width"] * size["length"]

    for box in placed_boxes:
        below = box["position"]
        if abs((below["z"] + box["height"]) - pos["z"]) < 0.1:
            x_overlap = max(
                0,
                min(pos["x"] + size["width"], below["x"] + box["width"])
                - max(pos["x"], below["x"]),
            )
            y_overlap = max(
                0,
                min(pos["y"] + size["length"], below["y"] + box["length"])
                - max(pos["y"], below["y"]),
            )
            if x_overlap > 0 and y_overlap > 0:
                if box["priority"] < current_priority:
                    return False
                support_area += x_overlap * y_overlap
    return support_area >= 0.9 * box_area


def greedy_fill(boxes, truck):
    if not boxes:
        return []

    l = np.array([b["length"] for b in boxes])
    w = np.array([b["width"] for b in boxes])
    h = np.array([b["height"] for b in boxes])
    vol = l * w * h
    wt = np.array([b["weight"] for b in boxes])

    total_vol = 0.0
    total_wt = 0.0
    filled = []

    for i in range(len(boxes)):
        if total_wt + wt[i] <= truck["max_weight"] and total_vol + vol[i] <= truck["volume"]:
            filled.append(boxes[i])
            total_wt += wt[i]
            total_vol += vol[i]

    return filled



def smart_place_boxes(truck, boxes):
    placed = []
    unplaced = []

    # boxes.sort(key=lambda b: (b["priority"], b["length"] * b["width"] * b["height"]))
    priorities = np.array([b["priority"] for b in boxes])
    volumes = np.array([b["length"] * b["width"] * b["height"] for b in boxes])
    sorted_indices = np.lexsort((volumes, priorities))
    boxes = [boxes[i] for i in sorted_indices]

    max_x = truck["width"]
    max_y = truck["length"]
    max_z = truck["height"]

    for box in boxes:
        box_dims = {
            "length": box["length"],
            "width": box["width"],
            "height": box["height"],
        }
        placed_flag = False

        y = max_y-box["length"] +0.5
        while y >= box["length"] and not placed_flag:
            x = 0.0
            while x + box["width"] <= max_x and not placed_flag:
                z = 0.0
                while z + box["height"] <= max_z and not placed_flag:
                    pos = {"x": round(x, 4), "y": round(y, 4), "z": round(z, 4)}
                    if can_place(
                        box, pos, placed, epsilon=0.001
                    ) and is_supported_priority_aware(
                        pos, box_dims, placed, box["priority"]
                    ):
                        box["position"] = pos
                        placed.append(box)
                        placed_flag = True
                        break
                    z += STEP_Z
                x += STEP_X
            y -= STEP_Y

        if not placed_flag:
            unplaced.append(box)

    return placed, unplaced


def generate_final_output(truck_fleet, unplaced_boxes):
    message = {"total_trucks_used": 0, "trucks": [], "not_placed": defaultdict(list)}
    for i, truck in enumerate(truck_fleet, start=1):
        if not truck["boxes"]:
            continue
        vol_percent = round((truck["used_volume"] / truck["volume"]) * 100, 2)
        wt_percent = round((truck["weight"] / truck["max_weight"]) * 100, 2)
        truck_data = {
            "truck_number": i,
            "name": truck["name"],
            "max_weight": truck["max_weight"],
            "used_weight": round(truck["weight"], 2),
            "occupied_volume": f"{vol_percent}%",
            "occupied_weight": f"{wt_percent}%",
            "volume": f"{round(truck['volume'], 2)} cubic meter",
            "total_boxes": len(truck["boxes"]),
            "boxes": [],
        }
        for box in truck["boxes"]:
            truck_data["boxes"].append(
                {
                    "custom_id": f"{box['customer_name']}#{box['box_number']}",
                    "customer_name": box["customer_name"],
                    "box_number": box["box_number"],
                    "priority": box["priority"],
                    "weight": box["weight"],
                    "box_type": box["box_type"],
                    "dimensions": {
                        "length": box["length"],
                        "width": box["width"],
                        "height": box["height"],
                    },
                    "position": box["position"],
                }
            )
        message["trucks"].append(truck_data)
    for box in unplaced_boxes:
        message["not_placed"][box["customer_name"]].append(
            {
                "box_number": box["box_number"],
                "weight": box["weight"],
                "priority": box["priority"],
                "box_type": box["box_type"],
                "dimensions": {
                    "length": box["length"],
                    "width": box["width"],
                    "height": box["height"],
                },
            }
        )
    message["not_placed"] = dict(message["not_placed"])
    message["total_trucks_used"] = len(message["trucks"])
    return {"message": message}


def compute_stats_numpy(boxes):
    if not boxes:
        return 0.0, 0.0
    lengths = np.array([b["length"] for b in boxes])
    widths = np.array([b["width"] for b in boxes])
    heights = np.array([b["height"] for b in boxes])
    weights = np.array([b["weight"] for b in boxes])
    volumes = lengths * widths * heights
    return np.sum(volumes), np.sum(weights)

def main(csv_path):
    boxes = read_boxes_from_csv(csv_path)
    truck_fleet = create_truck_fleet()
    all_unplaced = sorted(
        boxes,
        key=lambda b: (b["priority"], -1 * b["length"] * b["width"] * b["height"]),
    )

    for truck in truck_fleet:
        guess_fit = greedy_fill(all_unplaced, truck)
        placed, _ = smart_place_boxes(truck, guess_fit)

        if placed:
            min_y = min(box["position"]["y"] for box in placed)
            if min_y > 0:
                for box in placed:
                    box["position"]["y"] -= min_y
        truck["boxes"] = placed
        truck["used_volume"], truck["weight"] = compute_stats_numpy(placed)
        all_unplaced = [b for b in all_unplaced if b not in placed]

    return generate_final_output(truck_fleet, all_unplaced)


# To run:
start = time.time()
# result = main("../../uploads/differentShape.csv")
print(time.time() - start)
# import json; print(json.dumps(result, indent=2))
