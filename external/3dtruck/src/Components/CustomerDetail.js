import React from 'react'

export default function CustomerDetail({ truck, index }) {
    console.log(truck)
    if(truck.length == 0)return
    const selectedTruck = truck[index]

    function extractCustomerInfo(truck) {
        const PRIORITY_COLORS = {
            1: "#FFA500",   // Orange
            2: "#87CEEB",   // Sky Blue
            3: "#34D399",   // Green
            4: "#f472b6",   // Pink
            5: "#A78BFA",   // Purple
            6: "#FBBF24",   // Amber
            7: "#60A5FA",   // Blue
            8: "#F87171",   // Red
            9: "#4ADE80",   // Light Green
            10: "#C084FC",  // Lavender
            11: "#FACC15",  // Yellow
            12: "#2DD4BF",  // Teal
            13: "#FB923C",  // Deep Orange
            14: "#38BDF8",  // Light Blue
            15: "#E879F9",  // Magenta
            16: "#A3E635",  // Lime
            17: "#F43F5E",  // Rose
            18: "#06B6D4",  // Cyan
            19: "#F59E0B",  // Dark Yellow
            20: "#3B82F6",  // Primary Blue
            21: "#D946EF",  // Orchid
            22: "#10B981",  // Emerald
            23: "#F97316",  // Bright Orange
            24: "#2563EB",  // Royal Blue
            25: "#EC4899",  // Deep Pink
            26: "#22C55E",  // Forest Green
            27: "#EAB308",  // Golden
            28: "#8B5CF6",  // Violet
            29: "#EF4444",  // Bold Red
            30: "#14B8A6",  // Aqua
            31: "#FFA500",   // Orange
            32: "#87CEEB",   // Sky Blue
            33: "#34D399",   // Green
            34: "#f472b6",   // Pink
            35: "#A78BFA",   // Purple
            36: "#FBBF24",   // Amber
            37: "#60A5FA",   // Blue
            38: "#F87171",   // Red
            39: "#4ADE80",   // Light Green
            40: "#C084FC",
        };

        const map = new Map();
        truck.boxes.forEach((box) => {
            const key = box.customer_name;
            if (!map.has(key)) {
                map.set(key, { priority: box.priority, count: 0 });
            }
            map.get(key).count += 1;
        });

        return Array.from(map.entries()).map(([customer, data]) => ({
            customer,
            count: data.count,
            priority: data.priority,
            color: PRIORITY_COLORS[data.priority] || "#999",
        }));
    }
    const customerInfo = selectedTruck ? extractCustomerInfo(selectedTruck) : [];
    
    return (

        <>
            {customerInfo && customerInfo.length > 0 && <div>
                <div className="customer-panel">
                    <div className="customer-panel-title">📦 Customers in this Truck</div>
                    {customerInfo.map((info) => (
                        <div key={info.customer} className="customer-row">
                            <div className="color-badge" style={{ backgroundColor: info.color }}></div>
                            <div className="customer-name">{info.customer}</div>
                            <div className="customer-name"> priority {info.priority}</div>
                            <div className="box-count">× {info.count}</div>
                        </div>
                    ))}
                </div>
            </div>}

        </>

    )
}
