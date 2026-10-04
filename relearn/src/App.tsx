import { LearningModule } from './pages/LearningModule';
import ClickSpark from './components/ClickSpark';

function App() {
  return (
    <ClickSpark
      sparkColor="#38bdf8"
      sparkSize={12}
      sparkRadius={22}
      sparkCount={10}
      duration={450}
      extraScale={1.1}
    >
      <LearningModule />
    </ClickSpark>
  );
}

export default App;
