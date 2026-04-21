from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class StopDef(BaseModel):
    id: str
    priority: Literal["High", "Medium", "Low"] = "Medium"
    deadline_mins: int = Field(default=60, ge=0, le=240)


class VehicleDispatch(BaseModel):
    vehicle_id: str = Field(default="V1")
    start: str
    end: str
    stops: List[StopDef] = []
    fuel: Optional[float] = Field(default=None, ge=0, le=100)


class FleetDispatchRequest(BaseModel):
    assignments: List[VehicleDispatch]


class RouteRequest(BaseModel):
    start: str
    end: str
    stops: List[StopDef] = []
    vehicle_id: str = Field(default="V1")
    fuel: Optional[float] = Field(default=None, ge=0, le=100)
