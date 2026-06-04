# Enterprise POS SaaS - One-Click Deployment Guide

## 1. Cloud Database Setup (Supabase)
1. Create a project on [Supabase](https://supabase.com).
2. Copy the **Connection String** (PostgreSQL).
3. Set `DATABASE_URL` in your backend environment.

## 2. Backend Deployment (Render)
1. Connect your GitHub repo to **Render**.
2. Create a **Web Service**.
3. Use the following Root Directory: `backend/`
4. Set Environment Variables:
   - `DATABASE_URL`: Your Supabase URI.
   - `JWT_SECRET`: A long random string.
   - `PORT`: 5000 (standard).

## 3. Frontend Deployment (Vercel)
1. Connect your repo to **Vercel**.
2. Select the `frontend/` directory as the root.
3. Configure the **Build Command**: `npm run build`
4. Deploy!

## 4. Initial Access & Setup
1. Log in with `admin` / `admin123`.
2. Navigate to **Licenses**.
3. Generate a new License Key for your clients.
4. Clients using mobile or desktop will see an "Authorize Device" screen.
5. You must approve these devices in the **Devices** section before they can log in.

## 5. Mobile Installation (PWA)
- **iPhone (iOS)**: Open the URL in Safari, tap "Share", then "Add to Home Screen".
- **Android**: Open the URL in Chrome, tap "Add to Home Screen" or the install prompt.
