export const loadTruckData = async () => {
  const res = await fetch("/path/to/your/truckData.json");
  const data = await res.json();
  return data.trucks;
};
