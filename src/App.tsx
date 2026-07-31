import { RouterProvider } from "react-router-dom";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { router } from "./router";

function App() {
  return (
    <Theme theme={neutralTheme}>
      <RouterProvider router={router} />
    </Theme>
  );
}

export default App;
