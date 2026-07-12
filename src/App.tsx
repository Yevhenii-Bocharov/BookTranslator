import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import BookList from "./pages/BookListPage/BookListPage";
import HomePage from "./pages/HomePage/HomePage";
import Header from "./components/Header/Header";
import OpenedBookPage from "./pages/OpenedBookPage/OpenedBookPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import DashboardPage from "./pages/DashboardPage/DashboardPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage/ProfileSettingsPage";
import ReadingListPage from "./pages/ReadingListPage/ReadingListPage";
import GutenbergReaderPage from "./pages/GutenbergReaderPage/GutenbergReaderPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/read/:id" element={<GutenbergReaderPage />} />
            <Route
              path="/reading"
              element={
                <ProtectedRoute>
                  <ReadingListPage />
                </ProtectedRoute>
              }
            />
            <Route path="/book/:id" element={<OpenedBookPage />} />
            <Route path="/books" element={<BookList />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/settings"
              element={
                <ProtectedRoute>
                  <ProfileSettingsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
