import React from 'react';
import ReactDOM from 'react-dom/client';

// bootstrap links
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

import CustomRoute from './Routes';
import "../src/css/index.css"

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  CustomRoute
);


