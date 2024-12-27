import React, { useState } from "react";
import { saveSnapshot, getSnapshots, clearSnapshots } from "../lib/dbUtils";

const SnapShow = () => {
  const [snapshots, setSnapshots] = useState([]);

  const handleSaveSnapshot = async () => {
    const newSnapshot = {
      image: "data:image/png;base64,...", // Replace with actual Base64 string
      anomalyType: "more than 2 hands", // Example anomaly type
      timestamp: new Date().toISOString(),
    };
    const id = await saveSnapshot(newSnapshot);
    console.log(`Snapshot saved with ID: ${id}`);
  };

  const handleFetchSnapshots = async () => {
    const data = await getSnapshots();
    setSnapshots(data);
    snapshots.map((snap) => {
        console.log(snap.image)
    })
  };

  const handleClearSnapshots = async () => {
    await clearSnapshots();
    setSnapshots([]);
    console.log("All snapshots cleared.");
  };

  return (
    <div>
      <button onClick={handleSaveSnapshot}>Save Snapshot</button>
      <button onClick={handleFetchSnapshots}>Fetch Snapshots</button>
      <button onClick={handleClearSnapshots}>Clear Snapshots</button>

      <h3>Snapshots:</h3>
      <div>
        {snapshots.map((snap) => (
          <div key={snap.id}>
            
            <img src={snap.image} alt={`Snapshot ${snap.id}`} style={{ width: "150px" }} />
            
            <p>Type: {snap.anomalyType}</p>
            <p>Timestamp: {snap.timestamp}</p>
          </div>
        )) }
      </div>
    </div>
  );
};

export default SnapShow;
