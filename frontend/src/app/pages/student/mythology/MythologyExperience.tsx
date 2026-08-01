import CinematicHeader from "./components/CinematicHeader";
import MythologicalForest from "./components/MythologicalForest";
import HallOfRecords from "./components/HallOfRecords";
import KarmicRewards from "./components/KarmicRewards";

export default function MythologyExperience() {
  return (
    <div className="min-h-screen">
      <CinematicHeader />
      <MythologicalForest />
      <HallOfRecords />
      <KarmicRewards />
    </div>
  );
}
