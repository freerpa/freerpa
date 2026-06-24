
import { windowManager } from "node-window-manager";
import { screen } from 'electron';
export const screenshots = () => {
  const monitors = screen.getAllDisplays()
  console.log(monitors)
}
