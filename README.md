# ⛵ Dockly — Stegerholmens Hamn

A modern web application for managing a small-boat marina — berths, docks, land storage, marketplace, news and more. Built with **Next.js 16**, **Firebase** (Auth, Firestore, Storage, Hosting) and **Material UI**. The tenant-facing UI is in **Swedish**.

---

## ✨ Features

### 🏠 Public Pages
| Page | Description |
|------|-------------|
| **Home** | Hero with harbour photo, quick-links to docks / info / marketplace and a Google Maps embed |
| **Docks** | Browse all docks, see manager contact info, association vs. private status |
| **Info** | About the association, berth rules, seasons and environmental regulations |
| **FAQ** | Accordion with common questions (berth application, parking, pricing, etc.) |
| **News** | News feed with multi-image posts, **markdown** editing and emoji reactions (👍❤️😂🎉⚓) |
| **Marketplace** | Buy, sell, sublet & wanted listings with categories (incl. 2nd-hand subletting), images. Contact info hidden behind login for privacy |

### 🔐 Logged-in Features
| Feature | Description |
|---------|-------------|
| **Login** | Firebase Authentication (email / password) with profile creation on first login |
| **Dashboard (Mina grejer)** | Profile editing, profilsynlighet & SMS toggles, personal satellite map showing own objects, boat & land-storage image uploads, GPS editing for non-berth resources and land-storage entries, unread messages |
| **Berth Interest** | Submit a berth application with boat dimensions, preferred dock, phone and optional boat photo. Track status & receive replies from managers |
| **Directory** | Browse all berths with role-based privacy: managers see full contact info + SMS, tenants see limited data |

### 🗺️ Interactive Map
| Feature | Description |
|---------|-------------|
| **Berth Polygons** | Berths drawn as oriented rectangles sized to boat dimensions |
| **Dock Polygons** | Dock outlines on the map |
| **Resource Markers** | Sea huts, boxes and other resources with click-to-view details |
| **Land Storage Markers** | Winter storage positions |
| **Abandoned Objects** | ⚠️ markers for abandoned boats/objects with EXIF-based positioning |
| **POI Markers** | Purple pill-shaped markers for Points of Interest (toilets, ramps, etc.) |
| **Info Panel** | Click any marker to see full details, images and owner info |
| **Map Hint** | Contextual hint banner prompting users to click markers for details |
| **Claim Ownership** | Logged-in users can claim ownership of an abandoned object |
| **Purchase Interest** | Create a "Köpes" marketplace listing directly from an abandoned object |
| **Stats Overlay** | Live count of berths, land plots and abandoned objects |

### 👔 Management
| Feature | Description |
|---------|-------------|
| **Manager Panel** | Dock managers can toggle payment and status for berths on their docks |
| **SMS** | Managers can send SMS directly to tenants from the directory and map panels |

### ⚙️ Admin Panel
Full CRUD for the entire system, accessible to superadmins:

- **Users** — roles, profile data, account management
- **Docks** — name, type, manager assignment, images, map positioning
- **Resources** — berths, sea huts, boxes with owner, pricing, dimensions
- **Land Storage** — winter berth entries with map coordinates
- **News** — create/edit posts
- **Marketplace** — manage all listings
- **Interest Applications** — review, reply and update status
- **Abandoned Objects** — register, edit, position on map, view claim & purchase status
- **Points of Interest** — create / edit / delete POIs with map positioning and image upload
- **Image Lightbox** — click any admin thumbnail for a full-size preview

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | Material UI (MUI) v6 |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Maps | Google Maps (`@vis.gl/react-google-maps`) |
| SMS | 46elks API |
| Hosting | Firebase Hosting |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Create .env.local with your keys
cp .env.example .env.local   # then fill in values

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Deploy

```bash
npx next build && npx firebase deploy --only hosting
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase project config |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Maps JavaScript API key |
| `ELKS_API_USER` / `ELKS_API_PASSWORD` | 46elks SMS credentials |

---

## 📁 Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── admin/        # Superadmin CRUD panel
│   ├── dashboard/    # User profile & berth info
│   ├── directory/    # Berth directory with privacy
│   ├── docks/        # Public dock listing
│   ├── faq/          # Frequently asked questions
│   ├── info/         # About the harbour
│   ├── interest/     # Berth application form
│   ├── land-storage/ # Land storage management
│   ├── login/        # Authentication
│   ├── manager/      # Dock manager tools
│   ├── map/          # Interactive harbour map
│   ├── marketplace/  # Buy & sell listings
│   ├── news/         # News feed with reactions
│   └── setup/        # Initial setup wizard
├── components/       # Shared components (Navbar, ProtectedRoute)
├── context/          # AuthContext with role-based access
└── lib/              # Firebase config, types, utilities
```

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Superadmin** | Full admin panel, all data, SMS, user management |
| **Dock Manager** | Manage their assigned docks, view tenant details, send SMS |
| **Tenant** | Dashboard, interest applications, marketplace, directory (limited) |
| **Guest** | Public pages: home, docks, info, FAQ, news, marketplace (read-only) |
