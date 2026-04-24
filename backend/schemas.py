from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


class StopDef(BaseModel):
    id: str
    priority: Literal["High", "Medium", "Low"] = "Medium"
    deadline_mins: int = Field(default=60, ge=0, le=240)


class _VehicleUrgencyFields(BaseModel):
    priority: Optional[Literal["HIGH", "MEDIUM", "LOW"]] = None
    sla_deadline: Optional[Union[str, int, float]] = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value):
        if value is None:
            return None
        normalized = str(value).strip().upper()
        return normalized or None

    @field_validator("sla_deadline", mode="before")
    @classmethod
    def normalize_sla_deadline(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class VehicleDispatch(_VehicleUrgencyFields):
    vehicle_id: str = Field(default="V1")
    start: str
    end: str
    stops: List[StopDef] = Field(default_factory=list)
    fuel: Optional[float] = Field(default=None, ge=0, le=100)


class FleetDispatchRequest(BaseModel):
    assignments: List[VehicleDispatch]


class RouteRequest(_VehicleUrgencyFields):
    start: str
    end: str
    stops: List[StopDef] = Field(default_factory=list)
    vehicle_id: str = Field(default="V1")
    fuel: Optional[float] = Field(default=None, ge=0, le=100)
