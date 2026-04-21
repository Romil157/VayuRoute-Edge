import pandas as pd

# Constants
BOX_LENGTH = 0.46
BOX_WIDTH = 0.46
BOX_HEIGHT = 0.41
BOX_VOLUME = BOX_LENGTH * BOX_WIDTH * BOX_HEIGHT

TRUCKS = [
    {"name": "12-ft Truck", "length": 3.66, "width": 2.0, "height": 2.0, "max_weight": 3000, "cost": 1000},
    {"name": "24-ft Truck", "length": 7.32, "width": 2.44, "height": 2.6, "max_weight": 8000, "cost": 1800},
    {"name": "32-ft Truck", "length": 9.75, "width": 2.44, "height": 2.6, "max_weight": 10000, "cost": 2200}
]

def pack_trucks_from_csv(csv_file_path, truck_choice_idx=[0, 1, 2], total_trucks=[3, 1, 1]):
    if len(truck_choice_idx) != len(total_trucks):
        raise ValueError("truck_choice_idx and total_trucks must be of same length")

    df = pd.read_csv(csv_file_path)
    df['box_number'] = df.groupby('customer_name').cumcount() + 1
    df['global_id'] = range(1, len(df) + 1)

    # Sort by priority (lower value = higher priority)
    df = df.sort_values(by='priority')
    boxes = df.to_dict('records')

    # Build truck fleet and calculate volume
    truck_fleet = []
    for idx, truck_idx in enumerate(truck_choice_idx):
        selected = TRUCKS[truck_idx]
        TRUCK_VOLUME = selected['length'] * selected['width'] * selected['height']
        for i in range(total_trucks[idx]):
            truck_fleet.append({
                'type_index': truck_idx,
                'name': selected['name'],
                'volume': TRUCK_VOLUME,
                'max_weight': selected['max_weight'],
                'cost': selected['cost'],
                'boxes': [],
                'weight': 0.0
            })

    # Sort trucks by ascending volume and weight → try to fit into smallest suitable truck
    truck_fleet.sort(key=lambda x: (x['volume'], x['max_weight']))

    # Assign boxes (priority sorted) to smallest fitting truck
    for box in boxes:
        placed = False
        for truck in truck_fleet:
            used_volume = len(truck['boxes']) * BOX_VOLUME
            if (used_volume + BOX_VOLUME <= truck['volume']) and (truck['weight'] + box['weight'] <= truck['max_weight']):
                truck['boxes'].append(box)
                truck['weight'] += box['weight']
                placed = True
                break

        if not placed:
            print(f"❌ Cannot assign box {box['customer_name']} - Box {box['box_number']} ({box['weight']}kg). All trucks full.")

    # Output results and total cost
    total_cost = 0
    print("\n📦 Packing Result:\n")
    for idx, truck in enumerate(truck_fleet, 1):
        if not truck['boxes']:
            continue  # Skip unused trucks

        print(f"\n🚚 Truck {idx} ({truck['name']} - ₹{truck['cost']}):")
        for box in truck['boxes']:
            print(f"  {box['customer_name']} (Priority {box['priority']}) - Box {box['box_number']} - {box['weight']}kg [ID #{box['global_id']}]")

        volume_used = len(truck['boxes']) * BOX_VOLUME
        remaining_volume = truck['volume'] - volume_used
        volume_pct = (volume_used / truck['volume']) * 100

        print(f"  Total Weight: {truck['weight']} kg")
        print(f"  Volume Used: {volume_used:.2f} m³ ({volume_pct:.2f}%)")
        print(f"  Remaining Volume: {remaining_volume:.2f} m³")

        total_cost += truck['cost']

    print(f"\n💰 Total Cost: ₹{total_cost}")




# pack_trucks_from_csv(csv_file_path= "../uploads/1750513113.5196495_main.csv")
pack_trucks_from_csv(csv_file_path= "../uploads/test2.csv")
