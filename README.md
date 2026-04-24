# 🥗 GrocBot | Grocery Space Preview (Node.js Edition)

GrocBot is a WebXR-powered application built with **Vite** and **Three.js**. It helps you visualize if your groceries will fit in your fridge using Augmented Reality.

![AR View](MeraFridge1.png)

## 🛠 Tech Stack
- **Engine**: Three.js
- **Build Tool**: Vite
- **Language**: JavaScript (ESM)
- **Styling**: Vanilla CSS (Glassmorphism)

## 🚀 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Dev Server**:
   ```bash
   npm run dev
   ```

3. **Preview AR on Mobile**:
   Vite will provide a local IP address. Open that on your mobile browser (ensure you are on the same WiFi).
   *Note: AR often requires HTTPS. You may need to use a tool like `ngrok` or Vite's `--https` flag for mobile testing.*

## 📦 Deployment to GitHub Pages

GrocBot is configured with **GitHub Actions** for automated deployment. 

1. **Push to main**: Simply push your code to the `main` branch.
   ```bash
   git add .
   git commit -m "feat: automated deploy"
   git push origin main
   ```

2. **Wait for Workflow**: GitHub will automatically trigger the "Deploy GrocBot to Pages" action under the **Actions** tab.

3. **Enable Pages**: Ensure your GitHub Repository settings for Pages are set to **"GitHub Actions"** under the **Build and deployment > Source** section.

Your app will be live at `https://YOUR_USERNAME.github.io/GrocBot/`.

## 📱 Mobile AR Usage
- Open the live URL on a WebXR-compatible browser (e.g., Chrome on Android).
- Grant camera permissions.
- Tap "START AR" to enter the spatial preview.
- Point your camera at a flat surface to place your virtual fridge.
