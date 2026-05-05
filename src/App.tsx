import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import BookList from "./pages/BookListPage/BookListPage";
import HomePage from "./pages/HomePage/HomePage";
import Header from "./components/Header/Header";
import OpenedBookPage from "./pages/OpenedBookPage/OpenedBookPage";

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/book/:id" element={<OpenedBookPage />} />
        <Route path="/books" element={<BookList />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
