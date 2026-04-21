import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToastContainer, toast } from "react-toastify";
import { FiUploadCloud } from "react-icons/fi";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router";


const CSVUploader = () => {
    const [file, setFile] = useState(null);
    const [isLoading, setisLoading] = useState(false);
    const [PlanRoutes, setPlanRoutes] = useState(false);
    const fileInputRef = useRef();
    const navigate = useNavigate()

    const onDrop = useCallback((acceptedFiles) => {
        const uploadedFile = acceptedFiles[0];
        if (!uploadedFile) {
            toast.error("Please upload a valid .csv file");
            return;
        }

        setFile(uploadedFile);
        toast.success(`File selected: ${uploadedFile.name}`);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "text/csv": [".csv" , ".xls"],
            "application/vnd.ms-excel": [".csv" , ".xlsx"],
        },
        noClick: true,
        noKeyboard: true,
    });

    const triggerFileDialog = () => {
        fileInputRef.current.click();
    };

    const handleUpload = async () => {
        // if (!file) {
        //     toast.warning("Please select a file before uploading.");
        //     return;
        // }
        // console.log(file)

        // const formData = new FormData();
        // formData.append("file", file);
        // setisLoading(true)

        try {
            // const res = await fetch(`${process.env.REACT_APP_API}/api/v1/optimizer`, {
            //     method: "POST",
            //     body: formData,
            // });

            const res = await fetch(`${process.env.REACT_APP_API}/api/v1/different` , {
                method : "POST"
            })
            var msg = await res.json()
            console.log(msg)
            toast.success("Uploaded successfully!");
            setPlanRoutes(true)
            navigate("/AllTrucks" , {state : msg})

        } catch (err) {
            toast.error("Upload failed.");
            console.error(err);
        }
        finally {
            setisLoading(false)
        }
    };

    const planRoute = () => {
       navigate("/AllTrucks")
    }

    return (
        <div className="vh-100 d-flex flex-column justify-content-center align-items-center bg-light">
            <ToastContainer position="top-center" />

            {/* DROP AREA */}
            <div
                {...getRootProps()}
                className={` rounded-4 p-5 text-center bg-light shadow-lg w-75 ${isDragActive ? "border-primary bg-light" : "border-secondary"
                    }`}
                style={{ borderStyle: "dashed", transition: "0.3s" }}
            >
                <input
                    {...getInputProps()}
                    ref={fileInputRef}
                    onChange={(e) => onDrop(e.target.files)}
                />

                <FiUploadCloud size={50} className="text-danger mb-3" />
                <h2 className="fw-bold">Upload CSV file</h2>
                <p className="text-muted mb-3">
                    Drag and drop your CSV file here or use the button below.
                </p>

                {/* Manual Trigger Button */}
                <button
                    type="button"
                    onClick={triggerFileDialog}
                    className="btn btn-danger px-4 py-2 mt-3 rounded-4 fs-5"
                >
                    Select CSV File
                </button>

                {file && (
                    <div className="d-flex justify-content-center mt-4 pt-2 mb-0">
                        <div className="alert alert-info px-5 py-2 rounded-2 mb-0">
                            <strong>Selected:</strong> {file.name}
                        </div>
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <button
                type="button"
                onClick={handleUpload}
                className="btn btn-success mt-4 px-3 py-1 fs-5 shadow rounded-3"
                // disabled={!file}
            >
                {isLoading && (
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                )}
                {!isLoading && "Upload file"}
            </button>
            {PlanRoutes && <button
                type="button"
                onClick={planRoute}
                className="btn btn-success mt-4 px-3 py-1 fs-5 shadow rounded-3"
                disabled={!file}
            >
                {isLoading && (
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Planning Routes...</span>
                    </div>
                )}
                {!isLoading && "Plan Route"}
            </button>}
        </div>
    );
};

export default CSVUploader;
