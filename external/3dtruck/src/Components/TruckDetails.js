import React from 'react'
import "../../src/css/index.css"
import truckData from '../config/truckData'


export default function TruckDetails({ selectedTruck }) {
    const dimensions = selectedTruck.dimensions
    return (
        <div>
            <div className='truckDetailBox'>
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px" }}>
                    🚚 Truck Details
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#6b7280" }}>Name:</span>
                    <span style={{ fontWeight: "500" }}>{selectedTruck.name}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#6b7280" }}>Dimensions:</span>
                    <span>{dimensions.length.value}m × {dimensions.width.value}m × {dimensions.height.value}m</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#6b7280" }}>Max Weight:</span>
                    <span>{selectedTruck.max_weight.value} kg</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#6b7280" }}>Used Weight:</span>
                    <span>{selectedTruck.used_weight.value} kg</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#6b7280" }}>Total Boxes:</span>
                    <span>{selectedTruck.total_boxes}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#6b7280" }}>Occupied Volume:</span>
                    <span>{selectedTruck.occupied_volume}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#6b7280" }}>Occupied Weight:</span>
                    <span>{selectedTruck.occupied_weight}</span>
                </div>
            </div>
        </div>
    )
}
