import React from 'react'

export default function Unplaced({unplacedOrders}) {
    return (
        <div>
            <div className="unplaced-panel">
                <div className="unplaced-panel-title">🚫 Unplaced Boxes Summary</div>
                {Object.entries(unplacedOrders).map(([customer, boxes]) => (
                    <div key={customer} className="unplaced-row single-line">
                        <span className="unplaced-customer">🧍 {customer}</span>
                        <span className="unplaced-count">× {boxes.length}</span>
                        <span className="reason-text">Low priority or insufficient capacity</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
