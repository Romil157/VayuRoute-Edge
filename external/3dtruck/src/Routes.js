import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import CSVUploader from "./Drag";
import Truck from "./Components/Truck";
import AllTrucks from "./AllTrucks";
import TruckCanvas, { Model } from "./Truck3d";
import Truck3d from "./Truck3d1";
import Scene from "./demo/Chatgpt1";
import Truck12Render from "./trucks/Truck-12FT-Render";
import Truck24Render from "./trucks/Truck-24FT-Render";


const CustomRoute = (
    <BrowserRouter>
        <Routes >
            <Route path="/" element={<CSVUploader />} />
            <Route path="/truck" element={<Truck />} />
            <Route path="/AllTrucks" element={< AllTrucks />} />
            <Route path="/3dtruckmodel" element={< Truck3d />} />
            <Route path="/12" element={< Truck12Render />} />
            <Route path="/24" element={< Truck24Render />} />
        </Routes>
    </BrowserRouter>
)

export default CustomRoute