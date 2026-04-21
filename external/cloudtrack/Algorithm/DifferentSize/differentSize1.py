from collections import defaultdict
import numpy as np

STEP_X = 0.1
STEP_Y = 0.1
STEP_Z = 0.1


def pack_boxes_and_generate_output(customers: dict):
    BOX_TYPES = {
        "b1": {"length": 1.0, "width": 1.0, "height": 1.0, "weight": 10},
        "b2": {"length": 1.2, "width": 1.0, "height": 0.8, "weight": 12},
        "b3": {"length": 0.8, "width": 1.0, "height": 1.2, "weight": 8},
    }

    TRUCK_TEMPLATE = {
        "name": "12-ft Truck",
        "length": 5.0,
        "width": 5.0,
        "height": 3.0,
        "max_weight": 3000.0,
    }

    boxes = []
    box_id_counter = defaultdict(int)
    for customer, data in customers.items():
        priority = data["priority"]
        for box_type, count in data["orders"].items():
            dims = BOX_TYPES[box_type]
            for _ in range(count):
                box_id_counter[customer] += 1
                boxes.append(
                    {
                        "customer_name": customer,
                        "priority": priority,
                        "box_type": box_type,
                        "length": dims["length"],
                        "width": dims["width"],
                        "height": dims["height"],
                        "volume": dims["length"] * dims["width"] * dims["height"],
                        "weight": dims["weight"],
                        "box_number": box_id_counter[customer],
                        "position": None,
                    }
                )

    boxes.sort(
        key=lambda b: (b["priority"], -b["weight"])
    )  # simple priority + heavy first

    truck_fleet = [
        {
            "name": TRUCK_TEMPLATE["name"],
            "length": TRUCK_TEMPLATE["length"],
            "width": TRUCK_TEMPLATE["width"],
            "height": TRUCK_TEMPLATE["height"],
            "max_weight": TRUCK_TEMPLATE["max_weight"],
            "boxes": [],
            "weight": 0.0,
            "used_volume": 0.0,
            "volume": TRUCK_TEMPLATE["length"]
            * TRUCK_TEMPLATE["width"]
            * TRUCK_TEMPLATE["height"],
        }
    ]
    unplaced_boxes = []

    def is_within_bounds(x, y, z, box, truck):
        return (
            x + box["length"] <= truck["length"]
            and y + box["width"] <= truck["width"]
            and z + box["height"] <= truck["height"]
        )

    def is_colliding(x, y, z, box, placed_boxes):
        for other in placed_boxes:
            ox, oy, oz = other["position"]
            if not (
                x + box["length"] <= ox
                or ox + other["length"] <= x
                or y + box["width"] <= oy
                or oy + other["width"] <= y
                or z + box["height"] <= oz
                or oz + other["height"] <= z
            ):
                return True
        return False

    # Packing in truck using simple 3D greedy loop
    truck = truck_fleet[0]

    # Packing in truck using float step 3D greedy loop
    truck = truck_fleet[0]
    for box in boxes:
        if truck["weight"] + box["weight"] > truck["max_weight"]:
            unplaced_boxes.append(box)
            continue

        placed = False
        for z in np.arange(0, truck["height"] - box["height"] + 1e-6, STEP_Z):
            for y in np.arange(0, truck["width"] - box["width"] + 1e-6, STEP_Y):
                for x in np.arange(0, truck["length"] - box["length"] + 1e-6, STEP_X):
                    pos_x = round(x, 3)
                    pos_y = round(y, 3)
                    pos_z = round(z, 3)
                    if is_within_bounds(
                        pos_x, pos_y, pos_z, box, truck
                    ) and not is_colliding(pos_x, pos_y, pos_z, box, truck["boxes"]):
                        box["position"] = (pos_x, pos_y, pos_z)
                        truck["boxes"].append(box)
                        truck["weight"] += box["weight"]
                        truck["used_volume"] += box["volume"]
                        placed = True
                        break
                if placed:
                    break
            if placed:
                break

        if not placed:
            unplaced_boxes.append(box)

    return generate_final_output(truck_fleet, unplaced_boxes)


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
            position = box["position"]
            position_dict = (
                {"x": position[0], "y": position[1], "z": position[2]}
                if position
                else None
            )

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
                    "position": position_dict,
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
