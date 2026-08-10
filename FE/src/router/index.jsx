import { createHashRouter, Navigate } from "react-router-dom";
import App from "@/App";
import MainPage from "../pages/MainPage/MainPage";

const router = createHashRouter([
    {
        element: <App />,
        children: [
            {
                path: "/",
                element: <MainPage />,
            },
        ],
    },
]);

export default router;
