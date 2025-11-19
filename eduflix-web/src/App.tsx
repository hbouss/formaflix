import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Course from "./pages/Course";
import Player from "./pages/Player";
import Library from "./pages/Library";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import QuizPage from "./pages/Quiz";
import MyList from "./pages/MyList.tsx";
import MobileCourseInfo from "./pages/MobileCourseInfo";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

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
        <Route path="/my-list" element={<MyList/>}/>
        <Route path="/quiz/:id" element={<QuizPage/>}/>
        <Route path="/info/:id" element={<MobileCourseInfo/>} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}