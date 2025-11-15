import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProjectListPage } from "./pages/ProjectListPage";
// import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ProjectListPage />} />
        {/*<Route path="/new-project" element={<NewProjectPage />} />*/}
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
