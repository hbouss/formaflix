import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Course from "./pages/Course";
import Player from "./pages/Player";
import Library from "./pages/Library";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/course/:id" element={<Course/>}/>
        <Route path="/player/:id" element={<Player/>}/>
        <Route path="/library" element={<Library/>}/>
        <Route path="/signin" element={<SignIn/>}/>
        <Route path="/signup" element={<SignUp/>}/>
      </Routes>
    </BrowserRouter>
  );
}