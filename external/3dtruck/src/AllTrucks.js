import React, { useEffect, useState } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import TruckView from './Components/Truck1';
import TruckDetails from './Components/TruckDetails';
import CustomerDetail from './Components/CustomerDetail';
import Unplaced from './Components/Unplaced';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Model } from './Truck3d';


export default function AllTrucks() {
    const fileName = "v2_retail.csv";
    const fileName1 = "differentShape.csv";
    // console.log(params)
    const location = useLocation()
    // console.log(location)
    // console.log(location.state)

    const [truck, setTruck] = useState([]);
    const [index, setIndex] = useState(0);
    const [customerSummary, setCustomerSummary] = useState([]);
    const [unplacedOrders, setUnplacedOrders] = useState([]);

    const [showWeights, setShowWeights] = useState(false);
    const [TruckDisplay, setTruckDisplay] = useState(false);
    const [loading, setloading] = useState(false);
    const [selectedTruck, setSelectedTruck] = useState([]);

    const navigate = useNavigate()




    useEffect(() => {
        async function getData() {

            try {
                const data = location.state
                setSelectedTruck(data.data.trucks[index])
                setloading(true)

                // const response = await fetch(`${process.env.REACT_APP_API}/upload/getDataForThisCSV/boxOfSameSize/${fileName}`);
                // const response = await fetch(`${process.env.REACT_APP_API}/upload/getDataForThisCSV/boxOfDifferentSize/${fileName1}`);
                // const data = await response.json();
                setTruck(data.data.trucks);
                // setUnplacedOrders(data.data.not_placed);
                // setCustomerSummary(data.data.customer_summary);
                // console.log(data.data)
            } catch (e) {
                console.error("Error fetching truck data", e);
            }
            finally {
                setloading(false)
            }
        }
        getData();
    }, []);



    var LoadingContent = () => {
        return (
            <div className="loader-container">
                <div className="spinner" />
                <p className="loading-text">
                    Calculating route...<br />
                    This may take up to one minute.<br />
                    <strong>Please do not refresh.</strong>
                </p>
            </div>
        )
    }

    return (
        <>
            {loading && <LoadingContent />}

            {!loading && <div className='fullscreen-container'>



                {/* Top Left: Dropdown */}
                {truck.length > 1 && (
                    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
                        <select
                            value={index}
                            onChange={(e) => {
                                var index = parseInt(e.target.value)
                                setIndex(index)
                                setSelectedTruck(truck[index])
                            }}
                            className='select-btn'
                        >
                            {truck.map((t, i) => (
                                <option key={i} value={i}>
                                    Truck {i + 1} - {t.name || 'Unnamed Truck'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedTruck && <div style={{
                    position: "absolute",
                    left: "20%",
                    top: 10,
                    zIndex: 10
                }}>
                    <button
                        onClick={() => setShowWeights(prev => !prev)}
                        className={showWeights ? 'btn btn-success' : 'primary-button'}
                    >
                        {showWeights ? 'Hide Row Weights' : 'Show Row Weights'}
                    </button>
                </div>}

                <div style={{
                    position: "absolute",
                    right: "22%",
                    top: 15,
                    zIndex: 10
                }}>
                    <button
                        // onClick={showhtml}
                        className='primary-button'
                    >
                        <a
                            href="http://127.0.0.1:5500/map.html"
                            target="_blank"
                            style={{ color: "black" }}
                            rel="noopener noreferrer"
                        >
                            📍Navigate Routes
                        </a>
                    </button>
                </div>



                {selectedTruck && <div style={{
                    position: "absolute",
                    left: "30%",
                    top: 10,
                    zIndex: 10,
                }}>
                    <button
                        onClick={() => setTruckDisplay(prev => !prev)}
                        className={TruckDisplay ? 'btn btn-success' : 'primary-button'}
                    >
                        {TruckDisplay ? 'Hide Truck Details' : 'Show Truck Details'}
                    </button>
                </div>}


                {/* Top Center: Info Text */}
                {truck.length > 0 && (
                    <>
                        <div className="status-header">
                            <span>📂 File:</span>
                            <strong>{fileName}</strong>
                            <span className="separator">|</span>
                            <span>🚚 Truck:</span>
                            <strong>{index + 1} / {truck.length}</strong>
                        </div>
                    </>

                )}


                {/* Top Right: Truck Details */}
                {selectedTruck && TruckDisplay && (
                    <TruckDetails selectedTruck={selectedTruck} />
                )}


                {/* 3D Canvas
                {selectedTruck && (
                    <Canvas camera={{ position: [6, 6, 6], fov: 45 }} shadows>
                        <ambientLight intensity={0.9} />
                        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
                        <TruckView truck={selectedTruck} showWeights={showWeights} />
                        <OrbitControls enableZoom={true} />
                    </Canvas>
                )} */}

                {selectedTruck && (
                    <Canvas style={{ height: "100vh", backgroundColor: "#eaeaea" }} camera={{ position: [6, 6, 6], fov: 45 }} shadows>
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
                        {/* {!selectedTruck.name?.includes("24") && <Model truck={selectedTruck} scale={1} />}
                       {selectedTruck.name?.includes("24") && <TruckView truck={selectedTruck} /> }  */}

                       <TruckView truck={selectedTruck} />
                        <OrbitControls enableZoom={true} />
                    </Canvas>

                )}

                {/* custome color code middle right */}
                <CustomerDetail truck={truck} index={index} />

                {Object.keys(unplacedOrders).length > 0 && (
                    <Unplaced unplacedOrders={unplacedOrders} />
                )}

                {customerSummary && customerSummary.length > 0 && (
                    <div className="summary-panel">
                        <div className="summary-panel-title">📊 Customer Summary</div>
                        {customerSummary.map((item, idx) => (
                            <div key={idx} className="summary-row">
                                <span className="summary-customer">🧍 {item.customer_name}</span>
                                <span className="summary-priority">Priority {item.priority}</span>
                                <span className="summary-boxes">Boxes: {item.total_boxes}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>}
        </>
    );
}
