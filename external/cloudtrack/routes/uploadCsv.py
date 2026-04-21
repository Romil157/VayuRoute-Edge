from fastapi import APIRouter,UploadFile,File
from datetime import datetime
from Algorithm.truckFilling import pack_trucks_from_csv
from Algorithm.DifferentSize.differentsize import main as differentSize
# from Algorithm.DifferentSize.differentSize1 import pack_boxes_and_generate_output  as differentSize1
import time
import os

upload = APIRouter(prefix="/upload" , tags=["upload csv"])
UPLOAD_DIR = "uploads"


@upload.post("/upload-csv")
async def uploadFile(file : UploadFile = File(...)):
    print(file)
    name = f'{time.time()}_{file.filename}'
    path = os.path.join(UPLOAD_DIR , name)
    
    with open(path , "wb") as f:
        content = await file.read()
        f.write(content)
        

    response = pack_trucks_from_csv(path)
    return {"message" : response}
    
@upload.get('/')
def greet():
    return {"from file route"}

@upload.get("/getAllUploadedFile")
def allUploadedFiel():
        files = [f for f in os.listdir(UPLOAD_DIR) if f.endswith(".csv")]
        print(files)
        return files

@upload.get("/getDataForThisCSV/boxOfSameSize/{filename}")
def getDataForThisCSV(filename:str):
    path = os.path.join(UPLOAD_DIR, filename)
    response = pack_trucks_from_csv(path)
    return {"message" : response}


@upload.get("/getDataForThisCSV/boxOfDifferentSize/{filename}")
def getDataForThisCSV1(filename:str):
    
    path = os.path.join(UPLOAD_DIR, filename)
    response = differentSize(path)
    return response

    